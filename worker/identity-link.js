export class IdentityLinkConflict extends Error {
  constructor(message = "Identity is already linked to another Webcanbe account.") {
    super(message)
    this.name = "IdentityLinkConflict"
  }
}

export class IdentityLinkDenied extends Error {
  constructor(message = "Identity linking was refused.") {
    super(message)
    this.name = "IdentityLinkDenied"
  }
}

function validateIdentity(identity) {
  if (!identity || typeof identity !== "object") throw new IdentityLinkDenied()
  if (typeof identity.issuer !== "string" || !identity.issuer || identity.issuer.length > 255) throw new IdentityLinkDenied()
  if (typeof identity.subject !== "string" || !identity.subject || identity.subject.length > 255) throw new IdentityLinkDenied()
}

async function rollback(db) {
  try { await db.query("ROLLBACK") } catch {}
}

export async function linkDatabaseIdentity(db, session, identity) {
  validateIdentity(identity)
  if (!session || typeof session.sessionId !== "string" || typeof session.userId !== "string" || typeof session.expiresAt !== "number") {
    throw new IdentityLinkDenied()
  }

  await db.query("BEGIN")
  try {
    const current = await db.query(
      `SELECT s.session_id
         FROM wcb_sessions s
         LEFT JOIN wcb_disabled_users d ON d.user_id=s.user_id
        WHERE s.session_id=$1
          AND s.user_id=$2
          AND s.active
          AND s.expires_at=to_timestamp($3/1000.0)
          AND s.expires_at>clock_timestamp()
          AND d.user_id IS NULL
        FOR SHARE`,
      [session.sessionId, session.userId, session.expiresAt],
    )
    if (!current.rowCount) throw new IdentityLinkDenied()

    await db.query("SELECT id FROM wcb_identity_lock WHERE id=1 FOR UPDATE")

    const existing = (await db.query(
      "SELECT user_id,active FROM wcb_identity_accounts WHERE issuer=$1 AND subject=$2 FOR UPDATE",
      [identity.issuer, identity.subject],
    )).rows[0]

    if (existing && String(existing.user_id) !== session.userId) {
      throw new IdentityLinkConflict()
    }

    if (!existing) {
      await db.query(
        "INSERT INTO wcb_identity_accounts(issuer,subject,user_id,active) VALUES($1,$2,$3,true)",
        [identity.issuer, identity.subject, session.userId],
      )
    } else if (existing.active !== true) {
      await db.query(
        "UPDATE wcb_identity_accounts SET active=true WHERE issuer=$1 AND subject=$2 AND user_id=$3",
        [identity.issuer, identity.subject, session.userId],
      )
    }

    await db.query("COMMIT")
    return Object.freeze({
      linked: true,
      issuer: identity.issuer,
      subject: identity.subject,
      userId: session.userId,
      alreadyLinked: Boolean(existing && existing.active === true),
    })
  } catch (error) {
    await rollback(db)
    if (error instanceof IdentityLinkConflict || error instanceof IdentityLinkDenied) throw error
    throw new IdentityLinkDenied()
  }
}
