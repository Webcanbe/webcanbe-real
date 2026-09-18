import { createHash, randomBytes, randomUUID } from "node:crypto"
import type { Pool, PoolClient } from "pg"
import type { IncomingMessage } from "node:http"
import { AuthorityDenied, requireOpaqueId, validateHostedOrigins, type HostedOriginPolicy, type ServerSession } from "./hostedAuthority"
import type { LoginAttempt, LoginStore, LoginSessionStore, VerifiedIdentity } from "./hostedIdentity"
import { pgTransaction } from "./postgresTransaction"
import { PostgresAccess } from "./postgresStores"
const hash = (value: string) => createHash("sha256").update(value).digest("hex")
const random = () => randomBytes(32).toString("base64url")
/** Portable durable OIDC state + server-owned subject mapping + hashed sessions.
 * Uses the same PostgreSQL authority records as source/artifact access, so there
 * is no second session database whose revocation can diverge. */
export class PostgresIdentityStore implements LoginStore, LoginSessionStore {
  constructor(private pool: Pool, private registration: Readonly<{ allowSelfRegistration?: boolean; sessionLifetimeMs?: number }> = {}) {}
  async provision(identity: VerifiedIdentity, userId: string) {
    requireOpaqueId(userId)
    if (!identity.issuer || !identity.subject || identity.subject.length > 255) throw new AuthorityDenied()
    await pgTransaction(this.pool, async client => {
      await client.query("SELECT id FROM wcb_identity_lock WHERE id=1 FOR UPDATE")
      const old = (await client.query("SELECT user_id FROM wcb_identity_accounts WHERE issuer=$1 AND subject=$2", [identity.issuer, identity.subject])).rows[0]
      if (old && old.user_id !== userId) throw new AuthorityDenied()
      await client.query("INSERT INTO wcb_identity_accounts VALUES($1,$2,$3,true) ON CONFLICT(issuer,subject) DO UPDATE SET active=true", [identity.issuer, identity.subject, userId])
    })
  }
  async disable(identity: VerifiedIdentity) { await pgTransaction(this.pool, async client => {
    await client.query("SELECT id FROM wcb_identity_lock WHERE id=1 FOR UPDATE")
    await client.query("UPDATE wcb_identity_accounts SET active=false WHERE issuer=$1 AND subject=$2", [identity.issuer, identity.subject])
  }) }
  async account(identity: VerifiedIdentity) {
    const row = (await this.pool.query("SELECT user_id FROM wcb_identity_accounts i WHERE issuer=$1 AND subject=$2 AND active AND NOT EXISTS(SELECT 1 FROM wcb_disabled_users d WHERE d.user_id=i.user_id)", [identity.issuer, identity.subject])).rows[0]
    if (!row) throw new AuthorityDenied()
    return String(row.user_id)
  }
  async create(): Promise<LoginAttempt> {
    const attempt = { state: random(), binding: random(), nonce: random(), verifier: random() }
    return pgTransaction(this.pool, async client => {
      await client.query("SELECT id FROM wcb_identity_lock WHERE id=1 FOR UPDATE")
      await client.query("DELETE FROM wcb_login_attempts WHERE expires_at<=clock_timestamp()")
      if (Number((await client.query("SELECT count(*) AS n FROM wcb_login_attempts")).rows[0].n) >= 1000) throw new AuthorityDenied()
      const row = (await client.query("INSERT INTO wcb_login_attempts VALUES($1,$2,$3,$4,clock_timestamp()+interval '5 minutes') RETURNING expires_at", [hash(attempt.state), hash(attempt.binding), attempt.nonce, attempt.verifier])).rows[0]
      return { ...attempt, expires: new Date(row.expires_at).getTime() }
    })
  }
  async consume(state: string, binding: string): Promise<LoginAttempt> {
    if (!/^[\w-]{43}$/.test(state) || !/^[\w-]{43}$/.test(binding)) throw new AuthorityDenied()
    const row = (await this.pool.query("DELETE FROM wcb_login_attempts WHERE state_hash=$1 AND binding_hash=$2 AND expires_at>clock_timestamp() RETURNING nonce,verifier,expires_at", [hash(state), hash(binding)])).rows[0]
    if (!row) throw new AuthorityDenied()
    return { state, binding, nonce: row.nonce, verifier: row.verifier, expires: new Date(row.expires_at).getTime() }
  }
  async issueVerifiedIdentity(identity: VerifiedIdentity) {
    const lifetimeMs = this.registration.sessionLifetimeMs ?? 600000
    if (!Number.isSafeInteger(lifetimeMs) || lifetimeMs < 300000 || lifetimeMs > 604800000) throw new AuthorityDenied()
    return pgTransaction(this.pool, async client => {
      await client.query("SELECT id FROM wcb_identity_lock WHERE id=1 FOR UPDATE")
      let row = (await client.query("SELECT user_id FROM wcb_identity_accounts WHERE issuer=$1 AND subject=$2 AND active FOR SHARE", [identity.issuer, identity.subject])).rows[0]
      if (!row && this.registration.allowSelfRegistration === true) {
        const userId = randomUUID(), workspaceId = randomUUID()
        await client.query("INSERT INTO wcb_identity_accounts(issuer,subject,user_id,active) VALUES($1,$2,$3,true)", [identity.issuer, identity.subject, userId])
        await client.query("INSERT INTO wcb_workspace_members(workspace_id,user_id,role,epoch,active) VALUES($1,$2,'owner',1,true)", [workspaceId, userId])
        row = { user_id: userId }
      }
      if (!row) throw new AuthorityDenied()
      return this.issueIn(client, row.user_id, lifetimeMs)
    })
  }
  async issueVerifiedSession(userId: string, lifetimeMs = 600000) {
    requireOpaqueId(userId)
    if (!Number.isSafeInteger(lifetimeMs) || lifetimeMs < 1 || lifetimeMs > 600000) throw new AuthorityDenied()
    return pgTransaction(this.pool, async client => {
      await client.query("SELECT id FROM wcb_identity_lock WHERE id=1 FOR UPDATE")
      return this.issueIn(client, userId, lifetimeMs)
    })
  }
  private async issueIn(client: PoolClient, userId: string, lifetimeMs: number) {
      if ((await client.query("SELECT user_id FROM wcb_disabled_users WHERE user_id=$1", [userId])).rowCount) throw new AuthorityDenied()
      await client.query("DELETE FROM wcb_sessions WHERE expires_at<=clock_timestamp() OR NOT active")
      const counts = (await client.query("SELECT count(*) AS total,count(*) FILTER(WHERE user_id=$1) AS users FROM wcb_sessions", [userId])).rows[0]
      if (Number(counts.total) >= 1000 || Number(counts.users) >= 20) throw new AuthorityDenied()
      const token = random(), csrf = random(), sessionId = randomUUID()
      const row = (await client.query("INSERT INTO wcb_sessions(session_id,user_id,expires_at,active,token_hash,csrf_hash) VALUES($1,$2,date_trunc('milliseconds',clock_timestamp())+$3*interval '1 millisecond',true,$4,$5) RETURNING expires_at", [sessionId, userId, lifetimeMs, hash(token), hash(csrf)])).rows[0]
      const session = Object.freeze({ sessionId, userId, expiresAt: new Date(row.expires_at).getTime() })
      return { session, token, csrf, cookie: `__Host-wcb-session=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${Math.ceil(lifetimeMs/1000)}` }
  }
  async resolve(token: string): Promise<ServerSession | undefined> {
    if (!/^[\w-]{43}$/.test(token)) return undefined
    const row = (await this.pool.query("SELECT s.session_id,s.user_id,s.expires_at FROM wcb_sessions s LEFT JOIN wcb_disabled_users d ON d.user_id=s.user_id WHERE token_hash=$1 AND active AND expires_at>clock_timestamp() AND d.user_id IS NULL", [hash(token)])).rows[0]
    return row ? Object.freeze({ sessionId: row.session_id, userId: row.user_id, expiresAt: new Date(row.expires_at).getTime() }) : undefined
  }
  async csrf(session: ServerSession, token: string) {
    if (!/^[\w-]{43}$/.test(token)) return false
    return Boolean((await this.pool.query("SELECT s.session_id FROM wcb_sessions s LEFT JOIN wcb_disabled_users d ON d.user_id=s.user_id WHERE s.session_id=$1 AND s.user_id=$2 AND expires_at=to_timestamp($3/1000.0) AND expires_at>clock_timestamp() AND active AND csrf_hash=$4 AND d.user_id IS NULL", [session.sessionId, session.userId, session.expiresAt, hash(token)])).rowCount)
  }
  async rotateCsrf(session: ServerSession) {
    const token = random()
    const changed = await this.pool.query("UPDATE wcb_sessions s SET csrf_hash=$4 WHERE session_id=$1 AND user_id=$2 AND expires_at=to_timestamp($3/1000.0) AND expires_at>clock_timestamp() AND active AND NOT EXISTS(SELECT 1 FROM wcb_disabled_users d WHERE d.user_id=s.user_id)", [session.sessionId, session.userId, session.expiresAt, hash(token)])
    if (!changed.rowCount) throw new AuthorityDenied()
    return token
  }
  async revokeSession(sessionId: string) { await new PostgresAccess(this.pool).revokeSession(sessionId) }
  async revokeUser(userId: string) { await new PostgresAccess(this.pool).revokeUser(userId) }
}
/** Async production HTTP seam for the async hosted services. The existing local
 * Vite adapter remains synchronous and cannot silently use a Promise as auth. */
export class PostgresSessionBoundary {
  constructor(private sessions: PostgresIdentityStore, readonly origins: HostedOriginPolicy) { validateHostedOrigins(origins) }
  async authenticate(request: IncomingMessage): Promise<ServerSession> {
    if (request.method !== "POST" || request.headers.origin !== this.origins.editorOrigin || request.headers.host !== new URL(this.origins.editorOrigin).host || !(request.socket as { encrypted?: boolean }).encrypted || request.headers["x-wcb-editor-key"] !== undefined || !/^application\/json(?:;|$)/i.test(request.headers["content-type"] ?? "")) throw new AuthorityDenied()
    const cookies = (request.headers.cookie ?? "").split(";").map(c => c.trim().split("=")), matches = cookies.filter(([key]) => key === "__Host-wcb-session"), csrf = request.headers["x-wcb-csrf"]
    if (matches.length !== 1 || matches[0].length !== 2 || cookies.some(([key]) => /wcb-(?:preview|runner)/i.test(key)) || typeof csrf !== "string") throw new AuthorityDenied()
    const session = await this.sessions.resolve(matches[0][1])
    if (!session || !await this.sessions.csrf(session, csrf)) throw new AuthorityDenied()
    return session
  }
}
