import { describe, expect, it } from "vitest"
import { IdentityLinkConflict, linkDatabaseIdentity } from "./identity-link.js"

const session = {
  sessionId: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  expiresAt: 1789785600000,
}
const identity = {
  issuer: "https://securetoken.google.com/webcanbe-b607e",
  subject: "firebase-subject-123",
}

function dbFor(existing) {
  const calls = []
  return {
    calls,
    db: {
      async query(sql, params) {
        calls.push({ sql, params })
        if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [], rowCount: null }
        if (sql.includes("FROM wcb_sessions")) {
          if (!sql.includes("FOR SHARE OF s")) throw new Error("session row lock must not target nullable outer-join rows")
          return { rows: [{ session_id: session.sessionId }], rowCount: 1 }
        }
        if (sql.includes("wcb_identity_lock")) return { rows: [{ id: 1 }], rowCount: 1 }
        if (sql.startsWith("SELECT user_id,active FROM wcb_identity_accounts")) return { rows: existing ? [existing] : [], rowCount: existing ? 1 : 0 }
        if (sql.startsWith("INSERT INTO wcb_identity_accounts")) return { rows: [], rowCount: 1 }
        if (sql.startsWith("UPDATE wcb_identity_accounts")) return { rows: [], rowCount: 1 }
        throw new Error("unexpected query")
      },
    },
  }
}

describe("explicit identity linking", () => {
  it("locks only the concrete session row while rechecking a live first-party session", async () => {
    const { db, calls } = dbFor(undefined)
    const result = await linkDatabaseIdentity(db, session, identity)
    expect(result).toMatchObject({ linked: true, userId: session.userId, alreadyLinked: false })
    expect(calls.some(call => call.sql.includes("FROM wcb_sessions"))).toBe(true)
    expect(calls.some(call => call.sql.includes("wcb_identity_lock"))).toBe(true)
    expect(calls.some(call => call.sql.startsWith("INSERT INTO wcb_identity_accounts"))).toBe(true)
  })

  it("is idempotent when the verified identity is already linked to the same account", async () => {
    const { db, calls } = dbFor({ user_id: session.userId, active: true })
    const result = await linkDatabaseIdentity(db, session, identity)
    expect(result.alreadyLinked).toBe(true)
    expect(calls.some(call => call.sql.startsWith("INSERT INTO wcb_identity_accounts"))).toBe(false)
    expect(calls.some(call => call.sql.startsWith("UPDATE wcb_identity_accounts"))).toBe(false)
  })

  it("reactivates only the same account mapping", async () => {
    const { db, calls } = dbFor({ user_id: session.userId, active: false })
    const result = await linkDatabaseIdentity(db, session, identity)
    expect(result.alreadyLinked).toBe(false)
    expect(calls.some(call => call.sql.startsWith("UPDATE wcb_identity_accounts"))).toBe(true)
  })

  it("refuses to merge an identity already owned by another account", async () => {
    const { db, calls } = dbFor({ user_id: "33333333-3333-4333-8333-333333333333", active: true })
    await expect(linkDatabaseIdentity(db, session, identity)).rejects.toBeInstanceOf(IdentityLinkConflict)
    expect(calls.at(-1)?.sql).toBe("ROLLBACK")
  })

  it("never accepts email as linking authority", async () => {
    const { db } = dbFor(undefined)
    await expect(linkDatabaseIdentity(db, session, {
      issuer: "",
      subject: "",
      email: "same@example.com",
    })).rejects.toThrow("Identity linking was refused")
  })
})
