function cleanName(value) {
  if (typeof value !== "string") throw new Error("Invalid display name.")
  const clean = value.trim()
  if (!clean || clean.length > 120) throw new Error("Invalid display name.")
  return clean
}

function providerLabel(issuer) {
  if (issuer === "https://accounts.google.com") return "Google"
  if (typeof issuer === "string" && issuer.startsWith("https://securetoken.google.com/")) return "Firebase Authentication"
  return "Other verified provider"
}

function accountFromRow(row, userId, providers = [], activeSessions = 0) {
  return Object.freeze({
    userId,
    displayName: typeof row?.display_name === "string" ? row.display_name : "Webcanbe user",
    email: typeof row?.email === "string" ? row.email : "",
    emailVerified: row?.email_verified === true,
    picture: typeof row?.picture_url === "string" ? row.picture_url : "",
    createdAt: row?.created_at ? new Date(String(row.created_at)).toISOString() : "",
    updatedAt: row?.updated_at ? new Date(String(row.updated_at)).toISOString() : "",
    providers: Object.freeze([...providers]),
    activeSessions,
  })
}

async function accountAuthoritySummary(db, userId) {
  const identities = await db.query(
    "SELECT issuer FROM wcb_identity_accounts WHERE user_id=$1 AND active ORDER BY issuer,subject",
    [userId],
  )
  const providers = [...new Set(identities.rows.map(row => providerLabel(row.issuer)))]
  const sessions = await db.query(
    "SELECT count(*) AS total FROM wcb_sessions WHERE user_id=$1 AND active AND expires_at>clock_timestamp()",
    [userId],
  )
  const activeSessions = Number(sessions.rows[0]?.total ?? 0)
  return {
    providers,
    activeSessions: Number.isSafeInteger(activeSessions) && activeSessions >= 0 ? activeSessions : 0,
  }
}

export async function databaseAccount(db, session) {
  const result = await db.query(
    "SELECT display_name,email,email_verified,picture_url,created_at,updated_at FROM wcb_user_profiles WHERE user_id=$1",
    [session.userId],
  )
  const authority = await accountAuthoritySummary(db, session.userId)
  return accountFromRow(result.rows[0], session.userId, authority.providers, authority.activeSessions)
}

export async function updateDatabaseAccount(db, session, input) {
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(key => key !== "displayName")) {
    throw new Error("Invalid account update.")
  }
  const displayName = cleanName(input.displayName)
  const result = await db.query(
    `UPDATE wcb_user_profiles
        SET display_name=$2,updated_at=clock_timestamp()
      WHERE user_id=$1
      RETURNING display_name,email,email_verified,picture_url,created_at,updated_at`,
    [session.userId, displayName],
  )
  if (!result.rowCount) throw new Error("Account profile is unavailable.")
  const authority = await accountAuthoritySummary(db, session.userId)
  return accountFromRow(result.rows[0], session.userId, authority.providers, authority.activeSessions)
}
