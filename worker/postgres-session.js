import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto"

const tokenHash = value => createHash("sha256").update(value).digest("hex")
const randomToken = () => randomBytes(32).toString("base64url")

// A session probe must not invalidate CSRF tokens already held by another tab.
// Derive a separate, unguessable token from the HttpOnly session credential;
// only the same-origin session endpoint reveals it to the application.
export function stableDatabaseCsrf(token) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new DatabaseAuthorityDenied()
  return createHash("sha256").update("webcanbe-csrf-v1:").update(token).digest("base64url")
}

export class DatabaseAuthorityDenied extends Error {
  constructor(message = "Database session authority is unavailable.") {
    super(message)
    this.name = "DatabaseAuthorityDenied"
  }
}

function cleanOptional(value, maximum) {
  if (value === undefined || value === null || value === "") return undefined
  if (typeof value !== "string") throw new DatabaseAuthorityDenied()
  const clean = value.trim()
  if (!clean || clean.length > maximum) throw new DatabaseAuthorityDenied()
  return clean
}

function validateIdentity(identity) {
  if (!identity || typeof identity !== "object") throw new DatabaseAuthorityDenied()
  if (typeof identity.issuer !== "string" || !identity.issuer || identity.issuer.length > 255) throw new DatabaseAuthorityDenied()
  if (typeof identity.subject !== "string" || !identity.subject || identity.subject.length > 255) throw new DatabaseAuthorityDenied()
  cleanOptional(identity.email, 320)
  cleanOptional(identity.name, 120)
  cleanOptional(identity.picture, 1000)
  cleanOptional(identity.provider, 100)
  if (identity.emailVerified !== undefined && typeof identity.emailVerified !== "boolean") throw new DatabaseAuthorityDenied()
}

function profileFromIdentity(identity) {
  const email = cleanOptional(identity.email, 320)
  const name = cleanOptional(identity.name, 120)
  const picture = cleanOptional(identity.picture, 1000)
  const fallback = email ? email.split("@")[0].slice(0, 120) : "Webcanbe user"
  return Object.freeze({
    displayName: name ?? fallback,
    email,
    emailVerified: Boolean(email && identity.emailVerified === true),
    picture,
  })
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
  const profile = profileFromIdentity(identity)
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

    await db.query(
      `INSERT INTO wcb_user_profiles(user_id,display_name,email,email_verified,picture_url,created_at,updated_at)
       VALUES($1,$2,$3,$4,$5,clock_timestamp(),clock_timestamp())
       ON CONFLICT(user_id) DO UPDATE SET
         email=COALESCE(EXCLUDED.email,wcb_user_profiles.email),
         email_verified=CASE WHEN EXCLUDED.email IS NULL THEN wcb_user_profiles.email_verified ELSE EXCLUDED.email_verified END,
         picture_url=COALESCE(EXCLUDED.picture_url,wcb_user_profiles.picture_url),
         updated_at=clock_timestamp()`,
      [userId, profile.displayName, profile.email ?? null, profile.emailVerified, profile.picture ?? null],
    )

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
      "INSERT INTO wcb_sessions(session_id,user_id,expires_at,active,token_hash,csrf_hash,auth_issuer,auth_subject,auth_provider) VALUES($1,$2,date_trunc('milliseconds',clock_timestamp())+$3*interval '1 millisecond',true,$4,$5,$6,$7,$8) RETURNING expires_at",
      [sessionId, userId, lifetimeMs, tokenHash(token), tokenHash(csrf), identity.issuer, identity.subject, cleanOptional(identity.provider, 100) ?? null],
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
    `SELECT s.session_id,s.user_id,s.created_at,s.expires_at,s.auth_issuer,s.auth_subject,s.auth_provider,p.display_name,p.email,p.email_verified,p.picture_url
       FROM wcb_sessions s
       LEFT JOIN wcb_disabled_users d ON d.user_id=s.user_id
       LEFT JOIN wcb_user_profiles p ON p.user_id=s.user_id
      WHERE token_hash=$1 AND active AND expires_at>clock_timestamp() AND d.user_id IS NULL`,
    [tokenHash(token)],
  )
  const row = result.rows[0]
  if (!row) return undefined
  const createdAt = new Date(row.created_at).getTime()
  const expiresAt = new Date(row.expires_at).getTime()
  if (!Number.isFinite(createdAt) || !Number.isFinite(expiresAt)) return undefined
  return Object.freeze({
    sessionId: String(row.session_id),
    userId: String(row.user_id),
    createdAt,
    expiresAt,
    authIssuer: row.auth_issuer ? String(row.auth_issuer) : undefined,
    authSubject: row.auth_subject ? String(row.auth_subject) : undefined,
    authProvider: row.auth_provider ? String(row.auth_provider) : undefined,
    displayName: typeof row.display_name === "string" ? row.display_name : "Webcanbe user",
    email: typeof row.email === "string" ? row.email : "",
    emailVerified: row.email_verified === true,
    picture: typeof row.picture_url === "string" ? row.picture_url : "",
  })
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

export async function verifyDatabaseCsrf(db, session, csrf, sessionToken) {
  if (typeof csrf !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(csrf)) return false
  if (sessionToken !== undefined) {
    let expected
    try { expected = stableDatabaseCsrf(sessionToken) } catch { return false }
    if (!timingSafeEqual(Buffer.from(csrf), Buffer.from(expected))) return false
    const active = await db.query(
      "SELECT s.session_id FROM wcb_sessions s LEFT JOIN wcb_disabled_users d ON d.user_id=s.user_id WHERE s.session_id=$1 AND s.user_id=$2 AND expires_at=to_timestamp($3/1000.0) AND expires_at>clock_timestamp() AND active AND token_hash=$4 AND d.user_id IS NULL",
      [session.sessionId, session.userId, session.expiresAt, tokenHash(sessionToken)],
    )
    return Boolean(active.rowCount)
  }
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

export async function revokeAllDatabaseSessions(db, session) {
  if (!session || typeof session.userId !== "string" || !session.userId) throw new DatabaseAuthorityDenied()
  const current = await db.query(
    "SELECT session_id FROM wcb_sessions WHERE session_id=$1 AND user_id=$2 AND active AND expires_at=to_timestamp($3/1000.0) AND expires_at>clock_timestamp()",
    [session.sessionId, session.userId, session.expiresAt],
  )
  if (!current.rowCount) throw new DatabaseAuthorityDenied()
  const result = await db.query(
    "UPDATE wcb_sessions SET active=false WHERE user_id=$1 AND active RETURNING session_id",
    [session.userId],
  )
  return result.rowCount ?? result.rows.length
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

export class WorkspaceCreationError extends Error {}

/** Creates only a new workspace owned by the authenticated account. Retry-safe per UUID. */
export async function createDatabaseWorkspace(db, session, input) {
  if (!input || Object.keys(input).length !== 1 || typeof input.workspaceId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.workspaceId)) throw new WorkspaceCreationError('Invalid workspace request.')
  await db.query('BEGIN')
  try {
    // Serialize creation so parallel requests cannot exceed the account limit or claim an existing workspace.
    await db.query('SELECT id FROM wcb_identity_lock WHERE id=1 FOR UPDATE')
    const existing = await databaseWorkspaces(db, session)
    if (existing.includes(input.workspaceId)) { await db.query('COMMIT'); return input.workspaceId }
    if (existing.length >= 20) throw new WorkspaceCreationError('This account has reached the 20 workspace limit.')
    const occupied = await db.query('SELECT workspace_id FROM wcb_workspace_members WHERE workspace_id=$1 LIMIT 1', [input.workspaceId])
    if (occupied.rowCount) throw new WorkspaceCreationError('Workspace identifier is unavailable. Try again.')
    await db.query("INSERT INTO wcb_workspace_members(workspace_id,user_id,role,epoch,active) VALUES($1,$2,'owner',1,true)", [input.workspaceId, session.userId])
    await db.query('COMMIT')
    return input.workspaceId
  } catch (error) { await db.query('ROLLBACK'); throw error }
}
