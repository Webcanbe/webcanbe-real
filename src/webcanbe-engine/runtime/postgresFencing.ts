import { createHash } from "node:crypto"
import type { Pool, PoolClient, PoolConfig } from "pg"
import { Pool as PgPool } from "pg"
import { pgTransaction } from "./postgresTransaction"
import { requireOpaqueId } from "./authorityIdentity"
import { LOCAL_RESOURCE_BUDGET } from "./runnerContracts"
import type { ControlledJob } from "./controlledPreview"
export type Fence = Readonly<{ generation: string; controller: string; epoch: string; hostId: string }>
export type FencedLease = Fence & { state: "allocating" | "running" | "stopping" | "stopped" | "quarantined"; expiresAt: number }
export function hostedPostgresPool(config: PoolConfig, localTest = false) {
  if (!localTest && config.connectionString) {
    const url = new URL(config.connectionString)
    if ([...url.searchParams.keys()].some(key => /^ssl/i.test(key))) throw new Error("Hosted PostgreSQL URL cannot override TLS policy.")
  }
  if (!localTest && (!config.ssl || typeof config.ssl !== "object" || config.ssl.rejectUnauthorized === false || !config.ssl.ca)) throw new Error("Hosted PostgreSQL requires verified TLS with a configured CA.")
  return new PgPool({ ...config, max: 8, connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000 })
}
const lease = (row: any): FencedLease => ({ generation: row.generation, controller: row.controller, epoch: String(row.epoch), hostId: row.host_id, state: row.state, expiresAt: new Date(row.lease_until).getTime() })
/** DB clock and row locks are the authority. Handles are caches, never leases.
 * Reclaim retires an orphan, it never resumes an old generation's project code. */
export class PostgresLeaseStore {
  constructor(readonly pool: Pool, private limits: { global: number; tenant: number; project: number; host?: number } = { global: 4, tenant: 2, project: 2, host: 2 }, private leaseMs = 5000) {
    if (leaseMs < 100 || leaseMs > 10000 || Object.values(limits).some(n => !Number.isInteger(n) || n < 1 || n > 1000)) throw new Error("Invalid hosted lease policy.")
  }
  async reserve(job: ControlledJob, controller: string, hostId: string): Promise<FencedLease> {
    requireOpaqueId(job.generation); requireOpaqueId(controller)
    const a = job.allocation
    if (!a || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(hostId) || !/^[\w-]{8,160}$/.test(a.idempotencyKey) || a.executionDeadline !== job.expiresAt || Object.entries(LOCAL_RESOURCE_BUDGET).some(([k,v]) => a.budget[k as keyof typeof a.budget] !== v) || job.network.external !== "deny") throw new Error("Unsupported hosted allocation.")
    for (const id of Object.values(a.owner)) requireOpaqueId(id)
    const requestHash = createHash("sha256").update(JSON.stringify(job)).digest("hex")
    return pgTransaction(this.pool, async client => {
      // Pool lock serializes admission counts across every controller/host.
      await client.query("SELECT id FROM wcb_runner_pool WHERE id=1 FOR UPDATE")
      const old = (await client.query("SELECT * FROM wcb_runner_leases WHERE generation=$1 OR (session_id=$2 AND request_key=$3) FOR UPDATE", [job.generation, a.owner.sessionId, a.idempotencyKey])).rows[0]
      if (old) {
        if (old.generation !== job.generation || old.controller !== controller || old.host_id !== hostId || old.request_hash !== requestHash || !["allocating","running"].includes(old.state)) throw new Error("Allocation replay or ownership conflict.")
        await this.assert(client, lease(old)); return lease(old)
      }
      const counts = (await client.query("SELECT count(*) AS global,count(*) FILTER(WHERE workspace_id=$1) AS tenant,count(*) FILTER(WHERE project_id=$2) AS project,count(*) FILTER(WHERE host_id=$3) AS host FROM wcb_runner_leases WHERE state!='stopped'", [a.owner.workspaceId, a.owner.projectId, hostId])).rows[0]
      if (Object.entries({ ...this.limits, host: this.limits.host ?? 2 }).some(([k,v]) => Number(counts[k]) >= v)) throw new Error("Hosted admission capacity reached.")
      const result = await client.query(`INSERT INTO wcb_runner_leases VALUES($1,$2,1,$3,$4,$5,$6,$7,$8,$9,to_timestamp($10/1000.0),LEAST(clock_timestamp()+$11*interval '1 millisecond',to_timestamp($10/1000.0)),'allocating')
        RETURNING *, (deadline>clock_timestamp() AND deadline<=clock_timestamp()+interval '60 seconds') AS valid`, [job.generation, controller, hostId, JSON.stringify(a.owner), requestHash, a.owner.sessionId, a.idempotencyKey, a.owner.workspaceId, a.owner.projectId, job.expiresAt, this.leaseMs])
      if (!result.rows[0].valid) throw new Error("Invalid execution deadline.")
      return lease(result.rows[0])
    })
  }
  private async assert(client: PoolClient, fence: Fence, allowStopping = false) {
    requireOpaqueId(fence.generation); requireOpaqueId(fence.controller)
    if (!/^[1-9]\d{0,18}$/.test(fence.epoch)) throw new Error("Invalid fencing token.")
    const row = (await client.query("SELECT *,lease_until>clock_timestamp() AS live,deadline>clock_timestamp() AS runnable FROM wcb_runner_leases WHERE generation=$1 FOR UPDATE", [fence.generation])).rows[0]
    if (!row || row.controller !== fence.controller || String(row.epoch) !== fence.epoch || row.host_id !== fence.hostId || !row.live || !(allowStopping ? ["allocating","running","stopping","quarantined"] : ["allocating","running"]).includes(row.state) || !allowStopping && !row.runnable) throw new Error("Stale controller fencing token or expired worker lease.")
    return row
  }
  async guard<T>(fence: Fence, action: () => Promise<T>, allowStopping = false, job?: ControlledJob) {
    return pgTransaction(this.pool, async client => {
      const row = await this.assert(client, fence, allowStopping)
      if (job && row.request_hash !== createHash("sha256").update(JSON.stringify(job)).digest("hex")) throw new Error("Runner input does not match admitted artifact/owner.")
      const value = await action()
      await this.assert(client, fence, allowStopping) // late results never regain authority
      return value
    })
  }
  async heartbeat(fence: Fence) {
    return pgTransaction(this.pool, async client => {
      await this.assert(client, fence)
      const row = (await client.query("UPDATE wcb_runner_leases SET lease_until=LEAST(deadline,clock_timestamp()+$2*interval '1 millisecond') WHERE generation=$1 RETURNING *", [fence.generation, this.leaseMs])).rows[0]
      return lease(row)
    })
  }
  async running(fence: Fence) {
    await pgTransaction(this.pool, async client => { await this.assert(client, fence); await client.query("UPDATE wcb_runner_leases SET state='running' WHERE generation=$1", [fence.generation]) })
  }
  async beginStop(fence: Fence) {
    return pgTransaction(this.pool, async client => {
      const row = (await client.query("SELECT * FROM wcb_runner_leases WHERE generation=$1 FOR UPDATE", [fence.generation])).rows[0]
      if (row?.controller === fence.controller && String(row.epoch) === fence.epoch && row.host_id === fence.hostId && row.state === "stopped") return false
      await this.assert(client, fence, true)
      await client.query("UPDATE wcb_runner_leases SET state='stopping',lease_until=clock_timestamp()+interval '15 seconds' WHERE generation=$1", [fence.generation])
      return true
    })
  }
  async stopped(fence: Fence, verified: boolean) {
    await pgTransaction(this.pool, async client => {
      const row = await this.assert(client, fence, true)
      if (row.state !== "stopping") throw new Error("Cleanup was not admitted.")
      await client.query("UPDATE wcb_runner_leases SET state=$2 WHERE generation=$1", [fence.generation, verified ? "stopped" : "quarantined"])
    })
  }
  async expired(): Promise<FencedLease[]> {
    return (await this.pool.query("SELECT * FROM wcb_runner_leases WHERE state!='stopped' AND (lease_until<=clock_timestamp() OR deadline<=clock_timestamp()) ORDER BY lease_until LIMIT 100")).rows.map(lease)
  }
  async takeOver(generation: string, controller: string): Promise<FencedLease> {
    requireOpaqueId(generation); requireOpaqueId(controller)
    return pgTransaction(this.pool, async client => {
      const row = (await client.query(`UPDATE wcb_runner_leases SET controller=$2,epoch=epoch+1,state='stopping',lease_until=clock_timestamp()+interval '15 seconds'
        WHERE generation=$1 AND state!='stopped' AND (lease_until<=clock_timestamp() OR (deadline<=clock_timestamp() AND state IN ('allocating','running'))) RETURNING *`, [generation, controller])).rows[0]
      if (!row) throw new Error("Live controller cannot be displaced.")
      return lease(row)
    })
  }
  async status(generation: string): Promise<FencedLease | undefined> {
    requireOpaqueId(generation)
    const row = (await this.pool.query("SELECT * FROM wcb_runner_leases WHERE generation=$1", [generation])).rows[0]
    return row ? lease(row) : undefined
  }
  async accounting() {
    return (await this.pool.query("SELECT state,count(*)::integer AS jobs,count(*)::integer*1536 AS memory_mib,count(*)::integer*150 AS cpu_percent,count(*)::integer*192 AS tasks FROM wcb_runner_leases WHERE state!='stopped' GROUP BY state")).rows
  }
}
