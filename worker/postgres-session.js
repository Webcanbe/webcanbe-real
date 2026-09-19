import { createHash, randomBytes, randomUUID } from "node:crypto"

const tokenHash = value => createHash("sha256").update(value).digest("hex")
const randomToken = () => randomBytes(32).toString("base64url")

export class DatabaseAuthorityDenied extends Error {
  constructor(message = "Database session authority is unavailable.") {
    super(message)
    this.name = "DatabaseAuthorityDenied"
  }
}

function validateIdentity(identity) {
  if (!identity || typeof identity !== "object") throw new DatabaseAuthorityDenied()
  if (typeof identity.issuer !== "string" || !identity.issuer || identity.issuer.length > 255) throw new DatabaseAuthorityDenied()
  if (typeof identity.subject !== "string" || !identity.subject || identity.subject.length > 255) throw new DatabaseAuthorityDenied()
}

function validateLifetime(lifetimeMs) {
  if (!Number.isSafeInteger(lifetimeMs) || lifetimeMs < 300000 || lifetimeMs > 604800000) throw new DatabaseAuthorityDenied()
}

async function rollback(db) {
  try { await db.query("ROLLBACK") } catch {}
}

export async function issueDatabaseSession(db, identity, options = {}) {
  validateIdentity(identity)
  const lifetimeMs = options.lifetimeMs ?? 604800000
  const allowSelfRegistration = options.allowSelfRegistration === true
  validateLifetime(lifetimeMs)

  await db.query("BEGIN")
  try {
    await db.query("SELECT id FROM wcb_identity_lock WHERE id=1 FOR UPDATE")

    const identityResult = await db.query(
      "SELECT user_id,active FROM wcb_identity_accounts WHERE issuer=$1 AND subject=$2 FOR UPDATE",
      [identity.issuer, identity.subject],
    )
    let row = identityResult.rows[0]
    let workspaceId

    if (row && row.active !== true) throw new DatabaseAuthorityDenied()

    if (!row) {
      if (!allowSelfRegistration) throw new DatabaseAuthorityDenied()
      const userId = randomUUID()
      workspaceId = randomUUID()
      await db.query(
        "INSERT INTO wcb_identity_accounts(issuer,subject,user_id,active) VALUES($1,$2,$3,true)",
        [identity.issuer, identity.subject, userId],
      )
      await db.query(
        "INSERT INTO wcb_workspace_members(workspace_id,user_id,role,epoch,active) VALUES($1,$2,'owner',1,true)",
        [workspaceId, userId],
      )
      row = { user_id: userId, active: true }
    }

    const userId = String(row.user_id)
    const disabled = await db.query("SELECT user_id FROM wcb_disabled_users WHERE user_id=$1", [userId])
    if (disabled.rowCount) throw new DatabaseAuthorityDenied()

    await db.query("DELETE FROM wcb_sessions WHERE expires_at<=clock_timestamp() OR NOT active")
    const counts = (await db.query(
      "SELECT count(*) AS total,count(*) FILTER(WHERE user_id=$1) AS users FROM wcb_sessions",
      [userId],
    )).rows[0]
    if (Number(counts?.total ?? 0) >= 1000 || Number(counts?.users ?? 0) >= 20) throw new DatabaseAuthorityDenied()

    const sessionId = randomUUID()
    const token = randomToken()
    const csrf = randomToken()
    const sessionResult = await db.query(
      "INSERT INTO wcb_sessions(session_id,user_id,expires_at,active,token_hash,csrf_hash) VALUES($1,$2,date_trunc('milliseconds',clock_timestamp())+$3*interval '1 millisecond',true,$4,$5) RETURNING expires_at",
      [sessionId, userId, lifetimeMs, tokenHash(token), tokenHash(csrf)],
    )
    const expiresAt = new Date(sessionResult.rows[0].expires_at).getTime()
    if (!Number.isFinite(expiresAt)) throw new DatabaseAuthorityDenied()

    await db.query("COMMIT")
    return Object.freeze({
      session: Object.freeze({ sessionId, userId, expiresAt }),
      token,
      csrf,
      cookie: `__Host-wcb-session=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${Math.ceil(lifetimeMs / 1000)}`,
      ...(workspaceId ? { workspaceId } : {}),
    })
  } catch (error) {
    await rollback(db)
    throw error instanceof DatabaseAuthorityDenied ? error : new DatabaseAuthorityDenied()
  }
}

export async function resolveDatabaseSession(db, token) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) return undefined
  const result = await db.query(
    "SELECT s.session_id,s.user_id,s.expires_at FROM wcb_sessions s LEFT JOIN wcb_disabled_users d ON d.user_id=s.user_id WHERE token_hash=$1 AND active AND expires_at>clock_timestamp() AND d.user_id IS NULL",
    [tokenHash(token)],
  )
  const row = result.rows[0]
  if (!row) return undefined
  const expiresAt = new Date(row.expires_at).getTime()
  if (!Number.isFinite(expiresAt)) return undefined
  return Object.freeze({ sessionId: String(row.session_id), userId: String(row.user_id), expiresAt })
}

export async function rotateDatabaseCsrf(db, session) {
  const csrf = randomToken()
  const result = await db.query(
    "UPDATE wcb_sessions s SET csrf_hash=$4 WHERE session_id=$1 AND user_id=$2 AND expires_at=to_timestamp($3/1000.0) AND expires_at>clock_timestamp() AND active AND NOT EXISTS(SELECT 1 FROM wcb_disabled_users d WHERE d.user_id=s.user_id)",
    [session.sessionId, session.userId, session.expiresAt, tokenHash(csrf)],
  )
  if (!result.rowCount) throw new DatabaseAuthorityDenied()
  return csrf
}

export async function verifyDatabaseCsrf(db, session, csrf) {
  if (typeof csrf !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(csrf)) return false
  const result = await db.query(
    "SELECT s.session_id FROM wcb_sessions s LEFT JOIN wcb_disabled_users d ON d.user_id=s.user_id WHERE s.session_id=$1 AND s.user_id=$2 AND expires_at=to_timestamp($3/1000.0) AND expires_at>clock_timestamp() AND active AND csrf_hash=$4 AND d.user_id IS NULL",
    [session.sessionId, session.userId, session.expiresAt, tokenHash(csrf)],
  )
  return Boolean(result.rowCount)
}

export async function revokeDatabaseSession(db, sessionId) {
  if (typeof sessionId !== "string" || !sessionId) throw new DatabaseAuthorityDenied()
  await db.query("UPDATE wcb_sessions SET active=false WHERE session_id=$1", [sessionId])
}

export async function databaseWorkspaces(db, session) {
  const current = await db.query(
    "SELECT s.session_id FROM wcb_sessions s LEFT JOIN wcb_disabled_users d ON d.user_id=s.user_id WHERE s.session_id=$1 AND s.user_id=$2 AND s.active AND s.expires_at=to_timestamp($3/1000.0) AND s.expires_at>clock_timestamp() AND d.user_id IS NULL",
    [session.sessionId, session.userId, session.expiresAt],
  )
  if (!current.rowCount) throw new DatabaseAuthorityDenied()
  const result = await db.query(
    "SELECT workspace_id FROM wcb_workspace_members WHERE user_id=$1 AND active AND role IN ('owner','editor') ORDER BY workspace_id",
    [session.userId],
  )
  return result.rows.map(row => String(row.workspace_id))
}
