import { createHash, randomBytes, randomUUID } from "node:crypto"
import { DatabaseSync } from "node:sqlite"
import type { IncomingMessage } from "node:http"
import type { SessionOperation } from "./projectRegistry"

// Opaque public identities. Storage locators are never identities or API inputs.
export type UserId = string & { readonly __identity: "user" }
export type WorkspaceId = string & { readonly __identity: "workspace" }
export type TeamId = WorkspaceId
export type ProjectId = string & { readonly __identity: "project" }
export type RunnerSessionId = string & { readonly __identity: "runner-session" }
export type PreviewGenerationId = string & { readonly __identity: "preview-generation" }
export type RevisionId = string & { readonly __identity: "revision" }
export type ProjectRole = "owner" | "editor" | "viewer"
export const opaqueId = () => randomUUID()
export function requireOpaqueId(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value)) throw new AuthorityDenied()
}
export class AuthorityDenied extends Error { constructor() { super("Project or session is unavailable.") } }
const hash = (value: string) => createHash("sha256").update(value).digest("hex")
export const readOperations: SessionOperation[] = ["inspect", "compatibility", "preview", "source", "export", "files", "validate", "history"]
export const writeOperations: SessionOperation[] = ["mutate", "undo", "redo", "code", "revert", "checkpoint"]
export const roleOperations = (role: ProjectRole): SessionOperation[] => role === "viewer" ? [...readOperations] : [...readOperations, ...writeOperations]
export type ServerSession = Readonly<{ sessionId: string; userId: string; expiresAt: number }>
export type ProjectGrant = Readonly<ServerSession & { projectId: string; workspaceId: string; role: ProjectRole; membershipVersion: number; workspaceVersion: number }>
export interface AuthenticatedSessionStore {
  resolve(token: string): ServerSession | undefined
  active(session: ServerSession): boolean
  csrf(session: ServerSession, token: string): boolean
  revokeSession(sessionId: string): void
}
export interface MembershipStore {
  grant(session: ServerSession, projectId: string, operation?: SessionOperation): ProjectGrant
  check(grant: ProjectGrant, operation?: SessionOperation): boolean
  projects(session: ServerSession): string[]
  requireWorkspace(session: ServerSession, workspaceId: string): void
  registerProject(session: ServerSession, workspaceId: string, projectId: string): void
}

/** Real single-host SQLite adapter. Provisioning/identity-provider verification is
 * server-only; issueVerifiedSession is NOT a login endpoint or an identity proof.
 * Future durable adapters must preserve the fresh lookup and version semantics. */
export class SqliteAuthorityStore implements AuthenticatedSessionStore, MembershipStore {
  private readonly db: DatabaseSync
  constructor(file: string, private readonly now = Date.now) {
    this.db = new DatabaseSync(file)
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=1000;
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token_hash TEXT UNIQUE NOT NULL, csrf_hash TEXT NOT NULL, expires INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS workspaces (workspace_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL, version INTEGER NOT NULL, active INTEGER NOT NULL, PRIMARY KEY(workspace_id,user_id));
      CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS members (project_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL, version INTEGER NOT NULL, active INTEGER NOT NULL, PRIMARY KEY(project_id,user_id));`)
  }
  close() { this.db.close() }
  // Trusted provisioning seam. Never accept these calls directly from a browser.
  setWorkspaceMember(workspaceId: string, userId: string, role: ProjectRole | null) {
    requireOpaqueId(workspaceId); requireOpaqueId(userId); this.validRole(role)
    this.db.prepare(`INSERT INTO workspaces VALUES(?,?,?,1,?) ON CONFLICT(workspace_id,user_id) DO UPDATE SET role=excluded.role, version=version+1, active=excluded.active`).run(workspaceId, userId, role ?? "viewer", role ? 1 : 0)
  }
  setProjectMember(projectId: string, userId: string, role: ProjectRole | null) {
    requireOpaqueId(projectId); requireOpaqueId(userId); this.validRole(role)
    if (!this.db.prepare("SELECT id FROM projects WHERE id=?").get(projectId)) throw new AuthorityDenied()
    this.db.prepare(`INSERT INTO members VALUES(?,?,?,1,?) ON CONFLICT(project_id,user_id) DO UPDATE SET role=excluded.role, version=version+1, active=excluded.active`).run(projectId, userId, role ?? "viewer", role ? 1 : 0)
  }
  private validRole(role: ProjectRole | null) { if (role !== null && !["owner", "editor", "viewer"].includes(role)) throw new AuthorityDenied() }
  issueVerifiedSession(userId: string, lifetimeMs = 600_000) {
    requireOpaqueId(userId)
    if (!Number.isSafeInteger(lifetimeMs) || lifetimeMs < 1 || lifetimeMs > 600_000) throw new AuthorityDenied()
    const token = randomBytes(32).toString("base64url"), csrf = randomBytes(32).toString("base64url")
    const session = { sessionId: opaqueId(), userId, expiresAt: this.now() + lifetimeMs }
    this.db.prepare("DELETE FROM sessions WHERE expires<=? OR revoked=1").run(this.now())
    if (Number(this.db.prepare("SELECT count(*) AS count FROM sessions").get()!.count) >= 1000 || Number(this.db.prepare("SELECT count(*) AS count FROM sessions WHERE user_id=?").get(userId)!.count) >= 20) throw new AuthorityDenied()
    this.db.prepare("INSERT INTO sessions VALUES(?,?,?,?,?,0)").run(session.sessionId, userId, hash(token), hash(csrf), session.expiresAt)
    return { session: Object.freeze(session), token, csrf, cookie: `__Host-wcb-session=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${Math.ceil(lifetimeMs / 1000)}` }
  }
  resolve(token: string): ServerSession | undefined {
    if (!/^[\w-]{43}$/.test(token)) return undefined
    const row = this.db.prepare("SELECT id,user_id,expires FROM sessions WHERE token_hash=? AND expires>? AND revoked=0").get(hash(token), this.now())
    return row ? Object.freeze({ sessionId: String(row.id), userId: String(row.user_id), expiresAt: Number(row.expires) }) : undefined
  }
  active(session: ServerSession) { return Boolean(this.db.prepare("SELECT id FROM sessions WHERE id=? AND user_id=? AND expires=? AND expires>? AND revoked=0").get(session.sessionId, session.userId, session.expiresAt, this.now())) }
  csrf(session: ServerSession, token: string) { return this.active(session) && /^[\w-]{43}$/.test(token) && Boolean(this.db.prepare("SELECT id FROM sessions WHERE id=? AND csrf_hash=?").get(session.sessionId, hash(token))) }
  revokeSession(sessionId: string) { this.db.prepare("UPDATE sessions SET revoked=1 WHERE id=?").run(sessionId) }
  requireWorkspace(session: ServerSession, workspaceId: string) {
    requireOpaqueId(workspaceId)
    if (!this.active(session) || !this.db.prepare("SELECT workspace_id FROM workspaces WHERE workspace_id=? AND user_id=? AND active=1 AND role IN ('owner','editor')").get(workspaceId, session.userId)) throw new AuthorityDenied()
  }
  registerProject(session: ServerSession, workspaceId: string, projectId: string) {
    requireOpaqueId(projectId)
    this.db.exec("BEGIN IMMEDIATE")
    try {
      this.requireWorkspace(session, workspaceId)
      this.db.prepare("INSERT INTO projects VALUES(?,?)").run(projectId, workspaceId)
      this.setProjectMember(projectId, session.userId, "owner")
      this.db.exec("COMMIT")
    } catch (error) { this.db.exec("ROLLBACK"); throw error }
  }
  grant(session: ServerSession, projectId: string, operation: SessionOperation = "inspect"): ProjectGrant {
    requireOpaqueId(projectId)
    if (!this.active(session)) throw new AuthorityDenied()
    const row = this.db.prepare(`SELECT p.workspace_id, m.role, m.version, w.version AS workspace_version FROM projects p
      JOIN members m ON m.project_id=p.id AND m.user_id=? AND m.active=1
      JOIN workspaces w ON w.workspace_id=p.workspace_id AND w.user_id=m.user_id AND w.active=1 WHERE p.id=?`).get(session.userId, projectId)
    if (!row || !roleOperations(row.role as ProjectRole).includes(operation)) throw new AuthorityDenied()
    return Object.freeze({ ...session, projectId, workspaceId: String(row.workspace_id), role: row.role as ProjectRole, membershipVersion: Number(row.version), workspaceVersion: Number(row.workspace_version) })
  }
  check(grant: ProjectGrant, operation: SessionOperation = "inspect") {
    try { const current = this.grant(grant, grant.projectId, operation); return current.workspaceId === grant.workspaceId && current.membershipVersion === grant.membershipVersion && current.workspaceVersion === grant.workspaceVersion && current.role === grant.role } catch { return false }
  }
  projects(session: ServerSession) {
    if (!this.active(session)) throw new AuthorityDenied()
    return this.db.prepare("SELECT project_id FROM members WHERE user_id=? AND active=1").all(session.userId).map(row => String(row.project_id)).filter(id => { try { this.grant(session, id); return true } catch { return false } })
  }
}

export type HostedOriginPolicy = Readonly<{ editorOrigin: string; viewerOrigin: string; editorSite: string; viewerSite: string }>
export function validateHostedOrigins(policy: HostedOriginPolicy) {
  const editor = new URL(policy.editorOrigin), viewer = new URL(policy.viewerOrigin)
  // Site names must be provisioned by the operator against the public suffix list,
  // never inferred by taking the final two hostname labels (e.g. co.uk).
  const atSite = (hostname: string, site: string) => /^[a-z0-9.-]+$/.test(site) && site.includes(".") && (hostname === site || hostname.endsWith("." + site))
  if (editor.origin !== policy.editorOrigin || viewer.origin !== policy.viewerOrigin || editor.protocol !== "https:" || viewer.protocol !== "https:" || editor.username || viewer.username || !atSite(editor.hostname, policy.editorSite) || !atSite(viewer.hostname, policy.viewerSite) || policy.editorSite === policy.viewerSite || policy.editorSite.endsWith("." + policy.viewerSite) || policy.viewerSite.endsWith("." + policy.editorSite)) throw new Error("Separate HTTPS editor and viewer cookie sites are required.")
}
/** Cookie-only hosted boundary. No editor key fallback, forwarded host trust,
 * query credentials, localStorage bearer, or browser-supplied user identity. */
export class HostedSessionBoundary {
  constructor(readonly sessions: AuthenticatedSessionStore, readonly memberships: MembershipStore, readonly origins: HostedOriginPolicy, readonly localQa = false) { validateHostedOrigins(origins) }
  authenticate(request: IncomingMessage): ServerSession {
    const origin = this.origins.editorOrigin
    if (request.method !== "POST" || request.headers.origin !== origin || request.headers.host !== new URL(origin).host || (!this.localQa && !(request.socket as { encrypted?: boolean }).encrypted) || request.headers["x-wcb-editor-key"] !== undefined || !/^application\/json(?:;|$)/i.test(request.headers["content-type"] ?? "")) throw new AuthorityDenied()
    const cookies = (request.headers.cookie ?? "").split(";").map(value => value.trim().split("="))
    const matches = cookies.filter(([key]) => key === "__Host-wcb-session")
    if (matches.length !== 1 || matches[0].length !== 2 || cookies.some(([key]) => /wcb-(?:preview|runner)/i.test(key))) throw new AuthorityDenied()
    const session = this.sessions.resolve(matches[0][1]), csrf = request.headers["x-wcb-csrf"]
    if (!session || typeof csrf !== "string" || !this.sessions.csrf(session, csrf)) throw new AuthorityDenied()
    return session
  }
}
