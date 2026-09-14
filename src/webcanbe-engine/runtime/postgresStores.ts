import { SourceConflict } from "../mutations/durableSource"
import { boundedHistory } from "../mutations/durableSource"
import { createHash } from "node:crypto"
import type { Pool, PoolClient } from "pg"
import { AuthorityDenied, requireOpaqueId, roleOperations, type ProjectGrant, type ServerSession, type ProjectRole } from "./hostedAuthority"
import type { SessionOperation } from "./projectRegistry"
import { safeArchivePath, ZIP_LIMITS } from "./projectRegistry"
import type { RevisionLedger } from "../core/types"
import type { ArtifactReference } from "./storageContracts"
import type { PreviewSnapshot } from "./controlledPreview"

export { pgTransaction } from "./postgresTransaction"
import { pgTransaction } from "./postgresTransaction"
/** Durable server-owned grants. Provisioning is deliberately not an HTTP API.
 * Session records must originate from a verified identity/session issuer. */
export class PostgresAccess {
  constructor(readonly pool: Pool) {}
  async check(grant: ProjectGrant, operation: SessionOperation = "inspect") {
    try { await pgTransaction(this.pool, client => this.authorize(client, grant, operation)); return true } catch { return false }
  }
  async requireWorkspaceIn(client: PoolClient, session: ServerSession, workspaceId: string) {
    requireOpaqueId(workspaceId)
    const row = await client.query(`SELECT w.workspace_id FROM wcb_workspace_members w JOIN wcb_sessions s ON s.user_id=w.user_id
      WHERE w.workspace_id=$1 AND w.user_id=$2 AND w.active AND w.role IN ('owner','editor') AND s.session_id=$3 AND s.active
      AND s.expires_at=to_timestamp($4/1000.0) AND s.expires_at>clock_timestamp()
      AND NOT EXISTS(SELECT 1 FROM wcb_disabled_users d WHERE d.user_id=s.user_id) FOR SHARE OF w,s`, [workspaceId, session.userId, session.sessionId, session.expiresAt])
    if (!row.rowCount) throw new AuthorityDenied()
  }
  async requireWorkspace(session: ServerSession, workspaceId: string) { await pgTransaction(this.pool, client => this.requireWorkspaceIn(client, session, workspaceId)) }
  async workspaces(session: ServerSession) {
    const rows = (await this.pool.query("SELECT workspace_id FROM wcb_workspace_members WHERE user_id=$1 AND active AND role IN ('owner','editor')", [session.userId])).rows
    const result: string[] = []
    for (const row of rows) { await this.requireWorkspace(session, row.workspace_id); result.push(row.workspace_id) }
    return result
  }
  async projects(session: ServerSession) {
    const rows = (await this.pool.query("SELECT project_id FROM wcb_project_members WHERE user_id=$1 AND active", [session.userId])).rows
    const grants: ProjectGrant[] = []
    for (const row of rows) { try { grants.push(await this.grant(session, row.project_id)) } catch (error) { if (!(error instanceof AuthorityDenied)) throw error } }
    return grants
  }
  async registerSession(session: ServerSession) {
    requireOpaqueId(session.userId); requireOpaqueId(session.sessionId)
    await pgTransaction(this.pool, async client => {
      await client.query("SELECT id FROM wcb_identity_lock WHERE id=1 FOR UPDATE")
      if ((await client.query("SELECT user_id FROM wcb_disabled_users WHERE user_id=$1", [session.userId])).rowCount) throw new AuthorityDenied()
      await client.query("INSERT INTO wcb_sessions(session_id,user_id,expires_at,active) VALUES($1,$2,to_timestamp($3/1000.0),true) ON CONFLICT DO NOTHING", [session.sessionId, session.userId, session.expiresAt])
    })
  }
  async revokeSession(sessionId: string) { await this.pool.query("UPDATE wcb_sessions SET active=false WHERE session_id=$1", [sessionId]) }
  async revokeUser(userId: string) {
    requireOpaqueId(userId)
    await pgTransaction(this.pool, async client => {
      await client.query("SELECT id FROM wcb_identity_lock WHERE id=1 FOR UPDATE")
      await client.query("INSERT INTO wcb_disabled_users VALUES($1) ON CONFLICT DO NOTHING", [userId])
      await client.query("UPDATE wcb_sessions SET active=false WHERE user_id=$1", [userId])
    })
  }
  async workspace(workspace: string, user: string, role: ProjectRole | null) {
    requireOpaqueId(workspace); requireOpaqueId(user)
    await this.pool.query("INSERT INTO wcb_workspace_members VALUES($1,$2,$3,1,$4) ON CONFLICT(workspace_id,user_id) DO UPDATE SET role=excluded.role,active=excluded.active,epoch=wcb_workspace_members.epoch+1", [workspace, user, role ?? "viewer", role !== null])
  }
  async project(project: string, workspace: string) { requireOpaqueId(project); requireOpaqueId(workspace); await this.pool.query("INSERT INTO wcb_projects(project_id,workspace_id) VALUES($1,$2)", [project, workspace]) }
  async member(project: string, user: string, role: ProjectRole | null) {
    requireOpaqueId(project); requireOpaqueId(user)
    await this.pool.query("INSERT INTO wcb_project_members VALUES($1,$2,$3,1,$4) ON CONFLICT(project_id,user_id) DO UPDATE SET role=excluded.role,active=excluded.active,epoch=wcb_project_members.epoch+1", [project, user, role ?? "viewer", role !== null])
  }
  async grant(session: ServerSession, project: string, operation: SessionOperation = "inspect"): Promise<ProjectGrant> {
    return pgTransaction(this.pool, async client => this.lookup(client, session, project, operation))
  }
  private async lookup(client: PoolClient, session: ServerSession, project: string, operation: SessionOperation): Promise<ProjectGrant> {
    requireOpaqueId(project); requireOpaqueId(session.userId); requireOpaqueId(session.sessionId)
    const { rows } = await client.query(`SELECT p.workspace_id,m.role,m.epoch,w.epoch AS workspace_epoch FROM wcb_sessions s
      JOIN wcb_project_members m ON m.user_id=s.user_id AND m.project_id=$1 AND m.active
      JOIN wcb_projects p ON p.project_id=m.project_id AND NOT p.deleted
      JOIN wcb_workspace_members w ON w.workspace_id=p.workspace_id AND w.user_id=s.user_id AND w.active
      WHERE s.session_id=$2 AND s.user_id=$3 AND NOT EXISTS(SELECT 1 FROM wcb_disabled_users d WHERE d.user_id=s.user_id) AND s.active AND s.expires_at=to_timestamp($4/1000.0) AND s.expires_at>clock_timestamp()
      FOR SHARE OF s,m,w`, [project, session.sessionId, session.userId, session.expiresAt])
    const row = rows[0]
    if (!row || !roleOperations(row.role).includes(operation)) throw new AuthorityDenied()
    return { ...session, projectId: project, workspaceId: row.workspace_id, role: row.role, membershipVersion: Number(row.epoch), workspaceVersion: Number(row.workspace_epoch) }
  }
  async authorize(client: PoolClient, grant: ProjectGrant, operation: SessionOperation) {
    const current = await this.lookup(client, grant, grant.projectId, operation)
    if (current.workspaceId !== grant.workspaceId || current.role !== grant.role || current.membershipVersion !== grant.membershipVersion || current.workspaceVersion !== grant.workspaceVersion) throw new AuthorityDenied()
  }
}
export type HostedSourceState = { files: Map<string, Buffer>; history: RevisionLedger; revision: string; epoch: string }
const filePayload = (files: Map<string, Buffer>) => {
  let size = 0; const seen = new Set<string>(), result: Record<string, string> = Object.create(null)
  for (const [file, bytes] of files) {
    size += bytes.length
    if (safeArchivePath(file) !== file || seen.has(file.toLowerCase()) || bytes.length > ZIP_LIMITS.fileBytes || size > ZIP_LIMITS.totalBytes || files.size > ZIP_LIMITS.entries) throw new Error("Invalid hosted source files.")
    seen.add(file.toLowerCase()); result[file] = bytes.toString("base64")
  }
  return result
}
function verifyHistory(project: string, files: Map<string, Buffer>, history: RevisionLedger) {
  boundedHistory(history)
  if (history.schema !== 1 || history.projectId !== project || !history.revisions.length || JSON.stringify(history).length > 64 * 1024 * 1024) throw new Error("Invalid or over-quota hosted history.")
  const editable = [...files].filter(([file]) => /^src\/.+\.(?:tsx?|jsx?|css|json)$/.test(file)).map(([file, bytes]) => [file, bytes.toString("utf8")]).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
  const hash = createHash("sha256").update(JSON.stringify(editable)).digest("hex")
  if (history.revisions.at(-1)!.contentHash !== hash) throw new Error("Source and history digest disagree.")
  return history.revisions.at(-1)!.revisionId
}
/** Async hosted equivalent of ProjectSourceStore + RevisionHistoryStore. Real
 * source file bytes and the existing ledger commit together in PostgreSQL.
 * No canvas schema. Private materialization is a cache, never a commit point. */
export class PostgresProjectStore {
  constructor(private access: PostgresAccess) {}
  async create(session: ServerSession, workspaceId: string, projectId: string, name: string, files: Map<string, Buffer>, history: RevisionLedger) {
    requireOpaqueId(projectId)
    const payload = filePayload(files), ledger = structuredClone(history), revision = verifyHistory(projectId, files, ledger)
    await pgTransaction(this.access.pool, async client => {
      await this.access.requireWorkspaceIn(client, session, workspaceId)
      // Serialize per-workspace admission without depending on an editor process.
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [workspaceId])
      if (Number((await client.query("SELECT count(*) AS n FROM wcb_projects WHERE workspace_id=$1 AND NOT deleted", [workspaceId])).rows[0].n) >= 20) throw new Error("Workspace project capacity reached.")
      await client.query("INSERT INTO wcb_projects(project_id,workspace_id,name,revision,files,history,source_epoch) VALUES($1,$2,$3,$4,$5,$6,1)", [projectId, workspaceId, name.slice(0,200), revision, JSON.stringify(payload), JSON.stringify(ledger)])
      await client.query("INSERT INTO wcb_project_members VALUES($1,$2,'owner',1,true)", [projectId, session.userId])
      await this.access.requireWorkspaceIn(client, session, workspaceId)
    })
  }
  async read(grant: ProjectGrant): Promise<HostedSourceState> {
    return pgTransaction(this.access.pool, async client => {
      await this.access.authorize(client, grant, "source")
      const row = (await client.query("SELECT revision,files,history,source_epoch FROM wcb_projects WHERE project_id=$1 AND workspace_id=$2 AND NOT deleted FOR SHARE", [grant.projectId, grant.workspaceId])).rows[0]
      if (!row?.revision) throw new AuthorityDenied()
      const files = new Map<string, Buffer>(Object.entries(row.files).map(([file, base64]) => [file, Buffer.from(String(base64), "base64")]))
      filePayload(files)
      if (verifyHistory(grant.projectId, files, row.history) !== row.revision) throw new Error("Stored source integrity failed.")
      await this.access.authorize(client, grant, "source")
      return { files, history: row.history, revision: row.revision, epoch: String(row.source_epoch) }
    })
  }
  async accept(grant: ProjectGrant, expected: { revision: string | null; epoch: string }, files: Map<string, Buffer>, history: RevisionLedger, fault?: () => Promise<void>) {
    // Capture caller-owned buffers/ledger before any await.
    const captured = new Map([...files].map(([name, bytes]) => [name, Buffer.from(bytes)])), ledger = structuredClone(history), payload = filePayload(captured)
    const revision = verifyHistory(grant.projectId, captured, ledger)
    return pgTransaction(this.access.pool, async client => {
      await this.access.authorize(client, grant, "code")
      const old = (await client.query("SELECT revision,source_epoch,history FROM wcb_projects WHERE project_id=$1 AND workspace_id=$2 AND NOT deleted FOR UPDATE", [grant.projectId, grant.workspaceId])).rows[0]
      if (!old) throw new AuthorityDenied()
      // Exact retry after an uncertain COMMIT is idempotent; changed payload is not.
      if (old.revision === revision) {
        const row = (await client.query("SELECT files=$2::jsonb AND history=$3::jsonb AS same FROM wcb_projects WHERE project_id=$1", [grant.projectId, JSON.stringify(payload), JSON.stringify(ledger)])).rows[0]
        if (row.same) return { revision, epoch: String(old.source_epoch), replayed: true }
        // A rejected draft appends a receipt without changing a source revision.
        // Only that append is allowed; old source/revisions/inverses stay exact.
        const last = ledger.transactions.at(-1)
        const prefix = (await client.query("SELECT files=$2::jsonb AND history->'revisions'=$3::jsonb AND history->'transactions'=$4::jsonb AND history->'past'=$5::jsonb AND history->'future'=$6::jsonb AS same FROM wcb_projects WHERE project_id=$1", [grant.projectId, JSON.stringify(payload), JSON.stringify(ledger.revisions), JSON.stringify(ledger.transactions.slice(0,-1)), JSON.stringify(ledger.past), JSON.stringify(ledger.future)])).rows[0]
        if (expected.revision !== revision || expected.epoch !== String(old.source_epoch) || !prefix.same || last?.status !== "rejected" || last.success !== false || ledger.transactions.length !== old.history.transactions.length + 1) throw new Error("Immutable revision conflict.")
        await client.query("UPDATE wcb_projects SET history=$2,source_epoch=source_epoch+1 WHERE project_id=$1", [grant.projectId, JSON.stringify(ledger)])
        await this.access.authorize(client, grant, "code")
        return { revision, epoch: String(BigInt(old.source_epoch)+1n), replayed: false }
      }
      if (old.revision !== expected.revision || String(old.source_epoch) !== expected.epoch) throw new SourceConflict("Stale source revision or fencing token.")
      if (expected.revision !== null && (ledger.revisions.at(-1)!.parentRevisionId !== expected.revision || ledger.revisions.length !== old.history.revisions.length + 1)) throw new Error("History ancestry conflict.")
      if (expected.revision !== null) {
        const same = (await client.query("SELECT history->'revisions'=$2::jsonb AND history->'transactions'=$3::jsonb AS same FROM wcb_projects WHERE project_id=$1", [grant.projectId, JSON.stringify(ledger.revisions.slice(0, -1)), JSON.stringify(ledger.transactions.slice(0, -1))])).rows[0]
        if (!same.same) throw new Error("History ancestry conflict.")
      }
      await client.query("UPDATE wcb_projects SET revision=$3,files=$4,history=$5,source_epoch=source_epoch+1 WHERE project_id=$1 AND workspace_id=$2", [grant.projectId, grant.workspaceId, revision, JSON.stringify(payload), JSON.stringify(ledger)])
      await fault?.()
      await this.access.authorize(client, grant, "code")
      return { revision, epoch: String(BigInt(old.source_epoch) + 1n), replayed: false }
    })
  }
  async remove(grant: ProjectGrant, expectedEpoch: string) {
    await pgTransaction(this.access.pool, async client => {
      await this.access.authorize(client, grant, "code")
      if (grant.role !== "owner") throw new AuthorityDenied()
      const changed = await client.query("UPDATE wcb_projects SET deleted=true,files=NULL,history=NULL,source_epoch=source_epoch+1 WHERE project_id=$1 AND workspace_id=$2 AND source_epoch=$3 AND NOT deleted RETURNING project_id", [grant.projectId, grant.workspaceId, expectedEpoch])
      if (!changed.rowCount) throw new Error("Stale delete fencing token.")
      await client.query("UPDATE wcb_artifacts SET retired=true,payload='{}' WHERE project_id=$1 AND workspace_id=$2", [grant.projectId, grant.workspaceId])
    })
  }
}
/** Async ArtifactStore implementation. PostgreSQL byte payloads avoid a split
 * bucket/database commit. Retired keys cannot be recreated by a delayed put. */
export class PostgresArtifactStore {
  constructor(private access: PostgresAccess) {}
  private async allowed(client: PoolClient, grant: ProjectGrant, ref: ArtifactReference) {
    if (ref.workspaceId !== grant.workspaceId || ref.projectId !== grant.projectId || !/^[a-f0-9]{64}$/.test(ref.digest)) throw new AuthorityDenied()
    requireOpaqueId(ref.generation); await this.access.authorize(client, grant, "preview")
  }
  private key(ref: ArtifactReference) { return [ref.workspaceId, ref.projectId, ref.revision, ref.generation, ref.digest] }
  private verify(snapshot: PreviewSnapshot, ref: ArtifactReference) {
    if (!snapshot || snapshot.digest !== ref.digest || snapshot.files.length > 2000 || Buffer.byteLength(JSON.stringify(snapshot)) > 48 * 1024 * 1024 || createHash("sha256").update(JSON.stringify({ html: snapshot.html, files: snapshot.files.map(file => ({ path: file.path, contentType: file.contentType, base64: file.base64 })) })).digest("hex") !== ref.digest) throw new Error("Artifact digest or size mismatch.")
  }
  async put(grant: ProjectGrant, ref: ArtifactReference, snapshot: PreviewSnapshot) {
    const copy = structuredClone(snapshot); this.verify(copy, ref)
    await pgTransaction(this.access.pool, async client => {
      await this.allowed(client, grant, ref)
      // Serialize quota/retirement races for a project; no object key is authority.
      const project = await client.query("SELECT project_id FROM wcb_projects WHERE project_id=$1 AND workspace_id=$2 AND NOT deleted FOR UPDATE", [ref.projectId, ref.workspaceId])
      if (!project.rowCount) throw new AuthorityDenied()
      await this.allowed(client, grant, ref)
      const old = (await client.query("SELECT payload,retired FROM wcb_artifacts WHERE workspace_id=$1 AND project_id=$2 AND revision=$3 AND generation=$4 AND digest=$5", this.key(ref))).rows[0]
      if (old) { if (old.retired || JSON.stringify(old.payload) !== JSON.stringify(JSON.parse(JSON.stringify(copy)))) {
        // jsonb normalizes object key order, compare structurally in SQL.
        const same = (await client.query("SELECT payload=$6::jsonb AS same,retired FROM wcb_artifacts WHERE workspace_id=$1 AND project_id=$2 AND revision=$3 AND generation=$4 AND digest=$5", [...this.key(ref), JSON.stringify(copy)])).rows[0]
        if (same.retired || !same.same) throw new Error("Immutable or retired artifact conflict.")
      } return }
      const count = (await client.query("SELECT count(*) AS n FROM wcb_artifacts WHERE project_id=$1 AND NOT retired", [ref.projectId])).rows[0].n
      if (Number(count) >= 16) throw new Error("Artifact capacity reached.")
      await client.query("INSERT INTO wcb_artifacts VALUES($1,$2,$3,$4,$5,$6,false)", [...this.key(ref), JSON.stringify(copy)])
    })
  }
  async get(grant: ProjectGrant, ref: ArtifactReference): Promise<PreviewSnapshot> {
    return pgTransaction(this.access.pool, async client => {
      await this.allowed(client, grant, ref)
      const row = (await client.query("SELECT payload FROM wcb_artifacts WHERE workspace_id=$1 AND project_id=$2 AND revision=$3 AND generation=$4 AND digest=$5 AND NOT retired", this.key(ref))).rows[0]
      if (!row) throw new AuthorityDenied()
      this.verify(row.payload, ref); await this.allowed(client, grant, ref); return { digest: row.payload.digest, html: row.payload.html, files: row.payload.files.map((file: PreviewSnapshot["files"][number]) => ({ path: file.path, contentType: file.contentType, base64: file.base64 })) }
    })
  }
  async remove(grant: ProjectGrant, ref: ArtifactReference) {
    await pgTransaction(this.access.pool, async client => { await this.allowed(client, grant, ref); await this.retireIn(client, ref) })
  }
  private async retireIn(client: PoolClient, ref: ArtifactReference) {
    await client.query("INSERT INTO wcb_artifacts VALUES($1,$2,$3,$4,$5,'{}',true) ON CONFLICT(workspace_id,project_id,revision,generation,digest) DO UPDATE SET retired=true,payload='{}'", this.key(ref))
  }
  async retire(ref: ArtifactReference) { await pgTransaction(this.access.pool, client => this.retireIn(client, ref)) }
}
