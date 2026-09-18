import { request } from "node:https"
import type { RequestOptions } from "node:https"
import { createHash, randomUUID } from "node:crypto"
import type { ControlledExecution, ControlledJob, RunnerProvider } from "./controlledPreview"
import { RunnerCleanupError } from "./runnerContracts"
import type { RunnerOwner } from "./runnerScheduler"
import { PostgresLeaseStore, type Fence } from "./postgresFencing"
export type HostedRunnerHost = { id: string; origin: string; ca: string; cert: string; key: string; lookup?: RequestOptions["lookup"] }
/** A real remote-provider client. A configured HTTPS/mTLS Linux gateway performs
 * fixed OS-isolated jobs. Tests using local Lima are explicitly local evidence. */
export class HostedLinuxRunnerProvider implements RunnerProvider {
  readonly isolationBoundary = "hosted-linux" as const
  private readonly controller = randomUUID()
  private readonly active = new Map<string, { fence: Fence; close: () => Promise<void> }>()
  private readonly pending = new Map<string, { hash: string; result: Promise<ControlledExecution> }>()
  private closed = false
  constructor(private leases: PostgresLeaseStore, private hosts: readonly HostedRunnerHost[], private authorized: (owner: RunnerOwner) => Promise<boolean>) {
    if (!hosts.length || new Set(hosts.map(h => h.id)).size !== hosts.length) throw new Error("Unique hosted worker hosts are required.")
    for (const host of hosts) { const url = new URL(host.origin); if (url.protocol !== "https:" || url.origin !== host.origin || !host.ca || !host.cert || !host.key) throw new Error("Verified worker mTLS is required.") }
  }
  private rpc(fence: Fence, command: string, value: object = {}) {
    const host = this.hosts.find(host => host.id === fence.hostId)
    if (!host) throw new RunnerCleanupError("Orphan belongs to an unconfigured host; capacity remains quarantined.")
    return new Promise<any>((resolve, reject) => {
      const body = JSON.stringify({ fence, command, ...value })
      if (Buffer.byteLength(body) > 48 * 1024 * 1024) return reject(new Error("Hosted input limit exceeded."))
      const req = request(host.origin + "/rpc", { method: "POST", ca: host.ca, cert: host.cert, key: host.key, lookup: host.lookup, timeout: 14000, headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } }, res => {
        let size = 0; const chunks: Buffer[] = []
        res.on("data", chunk => { size += chunk.length; if (size > 16 * 1024 * 1024) res.destroy(new Error("Hosted output limit exceeded.")); else chunks.push(Buffer.from(chunk)) })
        res.on("error", reject)
        res.on("end", () => { try { if (res.statusCode !== 200) throw new Error("Hosted worker rejected the command."); resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))) } catch { reject(new Error("Hosted worker response was rejected.")) } })
      })
      const deadline = setTimeout(() => req.destroy(new Error("Hosted worker command timed out.")), 14000)
      req.on("close", () => clearTimeout(deadline))
      req.on("timeout", () => req.destroy(new Error("Hosted worker command timed out."))); req.on("error", () => reject(new Error("Hosted worker transport unavailable."))); req.end(body)
    })
  }
  async recover() {
    for (const orphan of await this.leases.expired()) {
      let fence: Fence
      try { fence = await this.leases.takeOver(orphan.generation, this.controller) } catch { continue }
      try { await this.rpc(fence, "revoke"); await this.leases.stopped(fence, true) }
      catch { await this.leases.stopped(fence, false).catch(() => {}); throw new RunnerCleanupError("Hosted orphan cleanup unverified; capacity retained.") }
    }
  }
  async open(job: ControlledJob, signal: AbortSignal): Promise<ControlledExecution> {
    // Snapshot caller data before asynchronous authorization/scheduling.
    const captured = structuredClone(job), hash = createHash("sha256").update(JSON.stringify(captured)).digest("hex"), previous = this.pending.get(job.generation)
    if (previous) { if (previous.hash !== hash) throw new Error("Hosted duplicate allocation conflict."); return previous.result }
    const result = this.allocate(captured, signal).catch(error => { this.pending.delete(job.generation); throw error }); this.pending.set(job.generation, { hash, result }); return result
  }
  private async allocate(job: ControlledJob, signal: AbortSignal): Promise<ControlledExecution> {
    if (this.closed || signal.aborted || !job.allocation || !await this.authorized(job.allocation.owner)) throw new Error("Hosted runner owner unavailable.")
    await this.recover()
    // Stable distribution; central quotas/fencing remain authoritative.
    const host = this.hosts[parseInt(job.generation.slice(0, 8), 16) % this.hosts.length]
    const fence = await this.leases.reserve(job, this.controller, host.id)
    let stopped = false, closing: Promise<void> | undefined, heartbeatBusy = false, timer: ReturnType<typeof setInterval> | undefined
    const live = async () => { if (stopped || this.closed || signal.aborted || !await this.authorized(job.allocation!.owner)) throw new Error("Hosted runner lease unavailable."); await this.leases.guard(fence, async () => {}) }
    const close = () => closing ??= (async () => {
      stopped = true; clearInterval(timer); signal.removeEventListener("abort", cancelled)
      try {
        if (await this.leases.beginStop(fence)) { await this.rpc(fence, "revoke"); await this.leases.stopped(fence, true) }
        this.active.delete(job.generation); this.pending.delete(job.generation)
      } catch { await this.leases.stopped(fence, false).catch(() => {}); throw new RunnerCleanupError("Hosted cleanup uncertain; retained lease requires recovery.") }
    })()
    const cancelled = () => { void close().catch(() => {}) }
    signal.addEventListener("abort", cancelled, { once: true }); this.active.set(job.generation, { fence, close })
    timer = setInterval(() => {
      if (heartbeatBusy || stopped) return
      heartbeatBusy = true
      void (async () => { try { await live(); await this.leases.heartbeat(fence) } catch { await close().catch(() => {}) } finally { heartbeatBusy = false } })()
    }, 1000); timer.unref()
    try {
      await live(); await this.rpc(fence, "open", { job }); await live(); await this.leases.running(fence)
      const perform = async (command: string, value: object = {}) => { try { await live(); const result = await this.rpc(fence, command, value); await live(); return result } catch (error) { await close(); throw error } }
      const sample = async () => {
        const result = await perform("sample")
        if (typeof result.png !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(result.png) || result.png.length > 12 * 1024 * 1024) throw new Error("Invalid hosted raster output.")
        return { bytes: Buffer.from(result.png, "base64"), observation: result.observation }
      }
      return { check: () => perform("check"), sample, capture: async () => (await sample()).bytes, input: async input => { await perform("input", { input }) }, update: async update => { await perform("update", { update }) }, close }
    } catch (error) { await close(); throw error }
  }
  async revoke(generation: string) {
    const entry = this.active.get(generation)
    if (entry) return entry.close()
    await this.recover() // no unfenced remote stop is possible
    if ((await this.leases.status(generation))?.state !== "stopped") throw new RunnerCleanupError("Generation cleanup is not verified by this controller.")
  }
  async close() {
    this.closed = true
    const results = await Promise.allSettled([...this.active.values()].map(entry => entry.close()))
    if (results.some(r => r.status === "rejected")) throw new RunnerCleanupError("Hosted provider cleanup incomplete.")
  }
}
