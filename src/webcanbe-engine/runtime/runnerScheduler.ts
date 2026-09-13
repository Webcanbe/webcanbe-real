import { DatabaseSync } from "node:sqlite"
import { createHash } from "node:crypto"
import { RunnerCleanupError, type ControlledExecution, type ControlledJob, type RunnerProvider } from "./controlledPreview"

export type RunnerOwner = Readonly<{ userId: string; workspaceId: string; projectId: string; sessionId: string }>
export type ResourceBudget = Readonly<{ memoryMiB: number; cpuPercent: number; tasks: number; artifactBytes: number }>
export const LOCAL_RESOURCE_BUDGET: ResourceBudget = Object.freeze({ memoryMiB: 1536, cpuPercent: 150, tasks: 192, artifactBytes: 32 * 1024 * 1024 })
export type RunnerAllocation = Readonly<{ owner: RunnerOwner; idempotencyKey: string; startupDeadline: number; executionDeadline: number; idleMs: number; budget: ResourceBudget }>
export type RunnerLease = { generation: string; requestHash: string; allocation: RunnerAllocation; state: "allocating" | "running" | "stopping" | "stopped" | "quarantined" }
export interface SessionLeaseStore {
  reserve(lease: RunnerLease, limits: { global: number; tenant: number; project: number }): "new" | "replay"
  transition(generation: string, state: RunnerLease["state"]): void
  unsettled(): RunnerLease[]
  close(): void
}
/** Durable single-controller lease adapter. The separate SQLite writer lease is
 * held until close/process death. A second scheduler cannot steal live jobs. */
export class SqliteLeaseStore implements SessionLeaseStore {
  private readonly db: DatabaseSync
  private readonly controller: DatabaseSync
  constructor(file: string) {
    this.controller = new DatabaseSync(file + ".controller")
    try { this.controller.exec("PRAGMA busy_timeout=1; BEGIN IMMEDIATE") } catch { this.controller.close(); throw new Error("A scheduler already owns this provider.") }
    try {
      this.db = new DatabaseSync(file)
      this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=1000;
        CREATE TABLE IF NOT EXISTS leases (generation TEXT PRIMARY KEY, request_hash TEXT, session TEXT, request_key TEXT, workspace TEXT, project TEXT, allocation TEXT, state TEXT, UNIQUE(session,request_key));`)
    } catch (error) { this.controller.exec("ROLLBACK"); this.controller.close(); throw error }
  }
  close() { this.db.close(); this.controller.exec("ROLLBACK"); this.controller.close() }
  reserve(lease: RunnerLease, limits: { global: number; tenant: number; project: number }) {
    this.db.exec("BEGIN IMMEDIATE")
    try {
      const a = lease.allocation, existing = this.db.prepare("SELECT * FROM leases WHERE generation=? OR (session=? AND request_key=?)").get(lease.generation, a.owner.sessionId, a.idempotencyKey)
      if (existing) {
        if (existing.request_hash !== lease.requestHash || existing.generation !== lease.generation || !["allocating", "running"].includes(String(existing.state))) throw new Error("Runner allocation replay or ownership conflict.")
        this.db.exec("COMMIT"); return "replay" as const
      }
      const active = "state!='stopped'"
      const count = (suffix: string, ...args: string[]) => Number(this.db.prepare(`SELECT count(*) AS n FROM leases WHERE ${active} ${suffix}`).get(...args)!.n)
      if (count("") >= limits.global || count("AND workspace=?", a.owner.workspaceId) >= limits.tenant || count("AND project=?", a.owner.projectId) >= limits.project) throw new Error("Runner admission capacity reached.")
      if (Number(this.db.prepare("SELECT count(*) AS n FROM leases").get()!.n) >= 10000) throw new Error("Runner lease retention limit reached; operator maintenance required.")
      this.db.prepare("INSERT INTO leases VALUES(?,?,?,?,?,?,?,?)").run(lease.generation, lease.requestHash, a.owner.sessionId, a.idempotencyKey, a.owner.workspaceId, a.owner.projectId, JSON.stringify(a), lease.state)
      this.db.exec("COMMIT"); return "new" as const
    } catch (error) { this.db.exec("ROLLBACK"); throw error }
  }
  transition(generation: string, state: RunnerLease["state"]) { this.db.prepare("UPDATE leases SET state=? WHERE generation=?").run(state, generation) }
  unsettled(): RunnerLease[] { return this.db.prepare("SELECT * FROM leases WHERE state!='stopped'").all().map(row => ({ generation: String(row.generation), requestHash: String(row.request_hash), allocation: JSON.parse(String(row.allocation)), state: row.state as RunnerLease["state"] })) }
}

/** Scheduling semantics, not an isolation simulator or hosted cloud provider.
 * The underlying concrete provider must enforce the budget and external deadline.
 * Recovery stops durable orphan allocations before accepting a new request. */
export class ScheduledRunnerProvider implements RunnerProvider {
  private readonly handles = new Map<string, Promise<ControlledExecution>>()
  private readonly closers = new Map<string, () => Promise<void>>()
  private readonly requests = new Map<string, string>()
  private ready?: Promise<void>
  private quarantined = false
  private closed = false
  constructor(private readonly provider: RunnerProvider, private readonly leases: SessionLeaseStore, private readonly authorized: (owner: RunnerOwner) => boolean, private readonly now = Date.now, private readonly limits = { global: 4, tenant: 2, project: 2 }) {}
  private async recover() {
    for (const lease of this.leases.unsettled()) {
      try {
        if (!this.provider.revoke) throw new Error("Provider cannot recover orphan allocations.")
        this.leases.transition(lease.generation, "stopping")
        await this.provider.revoke(lease.generation)
        this.leases.transition(lease.generation, "stopped")
      } catch { this.quarantined = true; this.leases.transition(lease.generation, "quarantined"); throw new RunnerCleanupError("Scheduler recovery cleanup is uncertain; admission quarantined.") }
    }
  }
  async open(job: ControlledJob, signal: AbortSignal): Promise<ControlledExecution> {
    await (this.ready ??= this.recover())
    const allocation = job.allocation
    if (this.closed || this.quarantined) throw new RunnerCleanupError("Scheduler is closed or quarantined.")
    if (!allocation || !this.authorized(allocation.owner) || signal.aborted) throw new Error("Runner ownership is unavailable.")
    const { budget } = allocation
    if (Object.entries(LOCAL_RESOURCE_BUDGET).some(([key, value]) => budget[key as keyof ResourceBudget] !== value) || allocation.startupDeadline <= this.now() || allocation.startupDeadline > this.now() + 15_000 || allocation.executionDeadline !== job.expiresAt || job.expiresAt <= this.now() || job.expiresAt > this.now() + 60_000 || allocation.idleMs < 100 || allocation.idleMs > 60_000 || !Number.isInteger(allocation.idleMs) || !/^[\w-]{8,160}$/.test(allocation.idempotencyKey)) throw new Error("Runner resource or deadline contract is unsupported.")
    const requestHash = createHash("sha256").update(JSON.stringify(job)).digest("hex")
    const replay = this.handles.get(job.generation)
    if (replay) { if (this.requests.get(job.generation) !== requestHash) throw new Error("Runner allocation replay conflict."); return replay }
    const lease: RunnerLease = { generation: job.generation, requestHash, allocation, state: "allocating" }
    if (this.leases.reserve(lease, this.limits) === "replay") throw new Error("Allocation has no live controller handle; recovery required.")
    const pending = this.allocate(job, signal)
    this.handles.set(job.generation, pending); this.requests.set(job.generation, requestHash)
    return pending
  }
  private async allocate(job: ControlledJob, signal: AbortSignal): Promise<ControlledExecution> {
    const a = job.allocation!, abort = new AbortController()
    let execution: ControlledExecution | undefined, stopped = false, closing: Promise<void> | undefined, lastActivity = this.now(), startup = true
    const live = () => !stopped && !this.closed && !this.quarantined && !signal.aborted && this.authorized(a.owner) && this.now() < a.executionDeadline && this.now() - lastActivity < a.idleMs && (!startup || this.now() < a.startupDeadline)
    const stop = (): Promise<void> => closing ??= (async () => {
      stopped = true; abort.abort(); clearInterval(timer); signal.removeEventListener("abort", cancelled)
      try {
        this.leases.transition(job.generation, "stopping")
        // Revoke is a durable tombstone as well as process-tree cleanup. It must
        // prevent a pending launch from starting after cancellation.
        if (!this.provider.revoke) throw new Error("Provider lacks explicit revocation.")
        await this.provider.revoke(job.generation)
        if (execution) await execution.close()
        this.leases.transition(job.generation, "stopped")
        this.handles.delete(job.generation); this.requests.delete(job.generation); this.closers.delete(job.generation)
      } catch { this.quarantined = true; this.leases.transition(job.generation, "quarantined"); throw new RunnerCleanupError("Runner cleanup failed; scheduler quarantined.") }
    })()
    const cancelled = () => { void stop().catch(() => {}) }
    const timer = setInterval(() => { if (!live()) cancelled() }, 50); timer.unref()
    this.closers.set(job.generation, stop); signal.addEventListener("abort", cancelled, { once: true })
    try {
      execution = await this.provider.open(job, abort.signal)
      if (!live()) { await execution.close(); await stop(); throw new Error("Runner started after cancellation or expiry.") }
      startup = false
      this.leases.transition(job.generation, "running")
      const perform = async <T>(operation: () => Promise<T>, activity = false): Promise<T> => {
        if (!live()) { await stop(); throw new Error("Runner lease is unavailable.") }
        try { const value = await operation(); if (!live()) throw new Error("Stale worker response."); if (activity) lastActivity = this.now(); return value }
        catch (error) { await stop(); throw error }
      }
      return {
        capture: () => perform(() => execution!.capture()),
        ...(execution.sample ? { sample: () => perform(() => execution!.sample!()) } : {}),
        input: input => perform(() => execution!.input(input), true),
        ...(execution.update ? { update: update => perform(() => execution!.update!(update), true) } : {}),
        close: stop,
      }
    } catch (error) { await stop(); throw error }
  }
  async close() {
    this.closed = true
    await this.ready
    const results = await Promise.allSettled([...this.closers.values()].map(close => close()))
    this.leases.close()
    if (results.some(result => result.status === "rejected")) throw new RunnerCleanupError("Scheduler cleanup requires operator recovery.")
  }
}
