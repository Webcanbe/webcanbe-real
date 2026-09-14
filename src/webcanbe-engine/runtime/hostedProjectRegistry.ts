import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto"
import { AuthorityDenied, type ProjectGrant, type ServerSession } from "./hostedAuthority"
import { PostgresAccess, PostgresProjectStore } from "./postgresStores"
import { pgTransaction } from "./postgresTransaction"
import { withHostedSource } from "./postgresSourceCheckout"
import { detectProject, extractSafeZip, type ProjectRecord, type SessionAuthority, type SessionOperation } from "./projectRegistry"
import { DurableSource } from "../mutations/durableSource"
import { MutationHistory } from "../mutations/sourceMutations"
import type { IncrementalPreviewCompiler } from "./incrementalPreview"
import type { RunnerOwner } from "./runnerScheduler"
const hash = (text: string) => createHash("sha256").update(text).digest("hex")

/** Async hosted registry. PostgreSQL is the ONLY source/history/session authority.
 * No local operator, SQLite registry or persistent source mirror is constructed. */
export class HostedProjectRegistry {
  constructor(readonly access: PostgresAccess, readonly source: PostgresProjectStore, readonly applicationRoot: string) {}
  async importZip(account: ServerSession, workspaceId: string, name: string, archive: Buffer) {
    await this.access.requireWorkspace(account, workspaceId)
    const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "wcb-hosted-import-")))
    try {
      const unpacked = path.join(temporary, "archive")
      await extractSafeZip(archive, unpacked)
      let root = unpacked
      if (!fs.existsSync(path.join(root, "package.json"))) {
        const entries = fs.readdirSync(root, { withFileTypes: true })
        if (entries.length === 1 && entries[0].isDirectory()) root = path.join(root, entries[0].name)
      }
      const id = randomUUID(), detection = detectProject(root, this.applicationRoot)
      if (!detection.supported || !fs.existsSync(path.join(root, "src"))) throw new Error(detection.reason ?? "Unsupported project intake.")
      const project: ProjectRecord = { id, name: name.slice(0, 200), root, sourceRoot: path.join(root, "src"), imported: true, detection, history: new MutationHistory() }
      const staging = new DurableSource(project, path.join(temporary, "history"), { disposableStaging: true, actor: account.userId })
      const files = new Map(fs.readdirSync(root, { recursive: true, withFileTypes: true }).filter(e => e.isFile()).map(e => {
        const full = path.join(e.parentPath, e.name)
        return [path.relative(root, full).split(path.sep).join("/"), fs.readFileSync(full)]
      }))
      await this.source.create(account, workspaceId, id, name, files, staging.history())
      return { id, name: project.name, imported: true, detection }
    } finally { fs.rmSync(temporary, { recursive: true, force: true }) }
  }
  async list(account: ServerSession) {
    const projects = []
    for (const grant of await this.access.projects(account)) {
      const result = await withHostedSource(this.source, grant, this.applicationRoot, async project => this.publicProject(grant, project))
      projects.push(result.value)
    }
    return projects
  }
  async publicProject(grant: ProjectGrant, project: ProjectRecord) {
    if (!await this.access.check(grant)) throw new AuthorityDenied()
    const row = (await this.access.pool.query("SELECT name FROM wcb_projects WHERE project_id=$1 AND workspace_id=$2 AND NOT deleted", [grant.projectId, grant.workspaceId])).rows[0]
    if (!row || !await this.access.check(grant)) throw new AuthorityDenied()
    return { id: project.id, name: row.name, imported: true, detection: project.detection }
  }
  async createSession(grant: ProjectGrant) {
    const previewId = randomUUID(), capability = randomBytes(32).toString("base64url")
    const expiresAt = Math.min(grant.expiresAt, Date.now() + 600000)
    await pgTransaction(this.access.pool, async client => {
      await this.access.authorize(client, grant, "inspect")
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,1))", [grant.sessionId])
      await client.query("DELETE FROM wcb_editor_capabilities WHERE expires_at<=clock_timestamp() OR revoked")
      if (Number((await client.query("SELECT count(*) AS n FROM wcb_editor_capabilities WHERE grant_json->>'sessionId'=$1", [grant.sessionId])).rows[0].n) >= 100) throw new Error("Session capacity reached.")
      await client.query("INSERT INTO wcb_editor_capabilities VALUES($1,$2,$3,$4,to_timestamp($5/1000.0),false)", [previewId, grant.projectId, hash(capability), JSON.stringify(grant), expiresAt])
    })
    return { projectId: grant.projectId, previewId, capability, expiresAt: new Date(expiresAt).toISOString() }
  }
  private async capability(projectId: string, previewId: string) {
    if (!/^[a-f0-9-]{36}$/.test(previewId) || !/^[a-f0-9-]{36}$/.test(projectId)) return undefined
    const row = (await this.access.pool.query("SELECT token_hash,grant_json,expires_at FROM wcb_editor_capabilities WHERE preview_id=$1 AND project_id=$2 AND NOT revoked AND expires_at>clock_timestamp()", [previewId, projectId])).rows[0]
    if (!row) return undefined
    const grant = row.grant_json as ProjectGrant
    if (grant.projectId !== projectId || !await this.access.check(grant, "inspect")) return undefined
    return { grant, tokenHash: String(row.token_hash), expiresAt: new Date(row.expires_at).getTime() }
  }
  async authorize(projectId: string, previewId: string, capability: string, operation: SessionOperation) {
    const record = await this.capability(projectId, previewId)
    return Boolean(record && typeof capability === "string" && timingSafeEqual(Buffer.from(hash(capability)), Buffer.from(record.tokenHash)) && await this.access.check(record.grant, operation))
  }
  async sessionBinding(projectId: string, previewId: string) { const record = await this.capability(projectId, previewId); return record && { grant: record.grant } }
  async sessionActive(projectId: string, previewId: string) { const record = await this.capability(projectId, previewId); return Boolean(record && await this.access.check(record.grant, "preview")) }
  async sessionExpiry(projectId: string, previewId: string) { return (await this.capability(projectId, previewId))?.expiresAt }
  async sessionOwner(projectId: string, previewId: string): Promise<RunnerOwner> {
    const record = await this.capability(projectId, previewId)
    if (!record) throw new AuthorityDenied()
    return { userId: record.grant.userId, workspaceId: record.grant.workspaceId, projectId, sessionId: previewId }
  }
  async runnerAuthorized(owner: RunnerOwner) {
    try { const current = await this.sessionOwner(owner.projectId, owner.sessionId); return current.userId === owner.userId && current.workspaceId === owner.workspaceId && await this.sessionActive(owner.projectId, owner.sessionId) } catch { return false }
  }
  async revision(projectId: string, previewId?: string) {
    const binding = previewId && await this.sessionBinding(projectId, previewId)
    if (!binding) throw new AuthorityDenied()
    return (await this.source.read(binding.grant)).revision
  }
  async revokeSession(projectId: string, previewId: string) { await this.access.pool.query("UPDATE wcb_editor_capabilities SET revoked=true WHERE project_id=$1 AND preview_id=$2", [projectId, previewId]) }
  async withPreviewSource<T>(projectId: string, authority: SessionAuthority, action: (project: ProjectRecord, files: Map<string, string>) => Promise<T>, compiler?: IncrementalPreviewCompiler) {
    if (!await this.authorize(projectId, authority.previewId, authority.capability, "preview")) throw new AuthorityDenied()
    const binding = await this.sessionBinding(projectId, authority.previewId)
    if (!binding) throw new AuthorityDenied()
    const result = await withHostedSource(this.source, binding.grant, this.applicationRoot, async (project, staging) => action(project, staging.files()), false, compiler?.hostedCheckout())
    if (!await this.authorize(projectId, authority.previewId, authority.capability, "preview")) throw new AuthorityDenied()
    return result.value
  }
}
