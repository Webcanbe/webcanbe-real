function cleanName(value) {
  if (typeof value !== "string") throw new Error("Invalid display name.")
  const clean = value.trim()
  if (!clean || clean.length > 120) throw new Error("Invalid display name.")
  return clean
}

function accountFromRow(row, userId) {
  return Object.freeze({
    userId,
    displayName: typeof row?.display_name === "string" ? row.display_name : "Webcanbe user",
    email: typeof row?.email === "string" ? row.email : "",
    emailVerified: row?.email_verified === true,
    picture: typeof row?.picture_url === "string" ? row.picture_url : "",
    createdAt: row?.created_at ? new Date(String(row.created_at)).toISOString() : "",
    updatedAt: row?.updated_at ? new Date(String(row.updated_at)).toISOString() : "",
  })
}

export async function databaseAccount(db, session) {
  const result = await db.query(
    "SELECT display_name,email,email_verified,picture_url,created_at,updated_at FROM wcb_user_profiles WHERE user_id=$1",
    [session.userId],
  )
  return accountFromRow(result.rows[0], session.userId)
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
  return accountFromRow(result.rows[0], session.userId)
}
