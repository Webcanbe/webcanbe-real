import { describe, expect, it } from "vitest"
import {
  DatabaseAuthorityDenied,
  databaseWorkspaces,
  issueDatabaseSession,
  resolveDatabaseSession,
  revokeDatabaseSession,
  revokeAllDatabaseSessions,
  rotateDatabaseCsrf,
  verifyDatabaseCsrf,
} from "./postgres-session.js"

function fakeDb(handler) {
  const calls = []
  return {
    calls,
    query: async (sql, params = []) => {
      calls.push({ sql, params })
      return handler(sql, params, calls)
    },
  }
}

const expiresAt = new Date("2026-09-26T00:00:00.000Z")

describe("PostgreSQL-backed Worker session adapter", () => {
  it("issues a session for an existing verified issuer/subject mapping", async () => {
    const userId = "11111111-1111-4111-8111-111111111111"
    const db = fakeDb(sql => {
      if (sql === "BEGIN" || sql === "COMMIT") return { rows: [], rowCount: 0 }
      if (sql.includes("wcb_identity_lock")) return { rows: [{ id: 1 }], rowCount: 1 }
      if (sql.startsWith("SELECT user_id,active FROM wcb_identity_accounts")) return { rows: [{ user_id: userId, active: true }], rowCount: 1 }
      if (sql.startsWith("SELECT user_id FROM wcb_disabled_users")) return { rows: [], rowCount: 0 }
      if (sql.startsWith("INSERT INTO wcb_user_profiles")) return { rows: [], rowCount: 1 }
      if (sql.startsWith("DELETE FROM wcb_sessions")) return { rows: [], rowCount: 0 }
      if (sql.startsWith("SELECT count(*) AS total")) return { rows: [{ total: "0", users: "0" }], rowCount: 1 }
      if (sql.startsWith("INSERT INTO wcb_sessions")) return { rows: [{ expires_at: expiresAt }], rowCount: 1 }
      throw new Error("Unexpected SQL: " + sql)
    })
    const issued = await issueDatabaseSession(db, { issuer: "https://accounts.google.com", subject: "google-sub", provider: "google", email: "user@example.com", emailVerified: true, name: "Webcanbe User", picture: "https://example.com/avatar.png" }, { allowSelfRegistration: true })
    expect(issued.session.userId).toBe(userId)
    expect(issued.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(issued.csrf).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(issued.cookie).toContain("__Host-wcb-session=")
    expect(db.calls.some(call => call.sql.includes("INSERT INTO wcb_workspace_members"))).toBe(false)
    const profileCall = db.calls.find(call => call.sql.includes("INSERT INTO wcb_user_profiles"))
    expect(profileCall?.params.slice(0, 5)).toEqual([userId, "Webcanbe User", "user@example.com", true, "https://example.com/avatar.png"])
    const sessionCall = db.calls.find(call => call.sql.startsWith("INSERT INTO wcb_sessions"))
    expect(sessionCall?.params[7]).toBe("google")
  })

  it("atomically creates an internal user and owner workspace for a new verified identity", async () => {
    let insertedUser
    let insertedWorkspace
    const db = fakeDb((sql, params) => {
      if (sql === "BEGIN" || sql === "COMMIT") return { rows: [], rowCount: 0 }
      if (sql.includes("wcb_identity_lock")) return { rows: [{ id: 1 }], rowCount: 1 }
      if (sql.startsWith("SELECT user_id,active FROM wcb_identity_accounts")) return { rows: [], rowCount: 0 }
      if (sql.startsWith("INSERT INTO wcb_identity_accounts")) { insertedUser = params[2]; return { rows: [], rowCount: 1 } }
      if (sql.startsWith("INSERT INTO wcb_workspace_members")) { insertedWorkspace = params[0]; expect(params[1]).toBe(insertedUser); return { rows: [], rowCount: 1 } }
      if (sql.startsWith("SELECT user_id FROM wcb_disabled_users")) return { rows: [], rowCount: 0 }
      if (sql.startsWith("INSERT INTO wcb_user_profiles")) return { rows: [], rowCount: 1 }
      if (sql.startsWith("DELETE FROM wcb_sessions")) return { rows: [], rowCount: 0 }
      if (sql.startsWith("SELECT count(*) AS total")) return { rows: [{ total: "1", users: "0" }], rowCount: 1 }
      if (sql.startsWith("INSERT INTO wcb_sessions")) return { rows: [{ expires_at: expiresAt }], rowCount: 1 }
      throw new Error("Unexpected SQL: " + sql)
    })
    const issued = await issueDatabaseSession(db, { issuer: "https://securetoken.google.com/webcanbe-b607e", subject: "firebase-uid", email: "firebase@example.com", emailVerified: false }, { allowSelfRegistration: true })
    expect(insertedUser).toMatch(/^[0-9a-f-]{36}$/)
    expect(insertedWorkspace).toMatch(/^[0-9a-f-]{36}$/)
    expect(issued.workspaceId).toBe(insertedWorkspace)
    expect(issued.session.userId).toBe(insertedUser)
  })

  it("does not reactivate a disabled identity or silently remap it", async () => {
    const db = fakeDb(sql => {
      if (sql === "BEGIN" || sql === "ROLLBACK") return { rows: [], rowCount: 0 }
      if (sql.includes("wcb_identity_lock")) return { rows: [{ id: 1 }], rowCount: 1 }
      if (sql.startsWith("SELECT user_id,active FROM wcb_identity_accounts")) return { rows: [{ user_id: "11111111-1111-4111-8111-111111111111", active: false }], rowCount: 1 }
      throw new Error("Unexpected SQL: " + sql)
    })
    await expect(issueDatabaseSession(db, { issuer: "issuer", subject: "subject" }, { allowSelfRegistration: true })).rejects.toBeInstanceOf(DatabaseAuthorityDenied)
    expect(db.calls.at(-1).sql).toBe("ROLLBACK")
    expect(db.calls.some(call => call.sql.startsWith("INSERT INTO wcb_identity_accounts"))).toBe(false)
  })

  it("revokes every active session for the authenticated user after validating the current session", async () => {
    const session = {
      sessionId: "22222222-2222-4222-8222-222222222222",
      userId: "11111111-1111-4111-8111-111111111111",
      expiresAt: expiresAt.getTime(),
    }
    const db = fakeDb((sql, params) => {
      if (sql.startsWith("SELECT session_id FROM wcb_sessions WHERE session_id=$1")) {
        expect(params).toEqual([session.sessionId, session.userId, session.expiresAt])
        return { rows: [{ session_id: session.sessionId }], rowCount: 1 }
      }
      if (sql.startsWith("UPDATE wcb_sessions SET active=false WHERE user_id=$1")) {
        expect(params).toEqual([session.userId])
        return { rows: [{ session_id: "a" }, { session_id: "b" }, { session_id: "c" }], rowCount: 3 }
      }
      throw new Error("Unexpected SQL: " + sql)
    })
    expect(await revokeAllDatabaseSessions(db, session)).toBe(3)
  })

  it("resolves, rotates CSRF, verifies CSRF and revokes the same durable session", async () => {
    const session = {
      sessionId: "22222222-2222-4222-8222-222222222222",
      userId: "11111111-1111-4111-8111-111111111111",
      expiresAt: expiresAt.getTime(),
    }
    const createdAt = new Date("2026-09-20T00:00:00.000Z")
    const db = fakeDb(sql => {
      if (sql.startsWith("SELECT s.session_id,s.user_id,s.created_at,s.expires_at")) return { rows: [{ session_id: session.sessionId, user_id: session.userId, created_at: createdAt, expires_at: expiresAt, auth_issuer: "https://accounts.google.com", auth_subject: "google-subject", auth_provider: "google", display_name: "Sihoo", email: "sihoo@example.com", email_verified: true, picture_url: "https://example.com/p.png" }], rowCount: 1 }
      if (sql.startsWith("UPDATE wcb_sessions s SET csrf_hash")) return { rows: [], rowCount: 1 }
      if (sql.startsWith("SELECT s.session_id FROM wcb_sessions s LEFT JOIN wcb_disabled_users")) return { rows: [{ session_id: session.sessionId }], rowCount: 1 }
      if (sql.startsWith("UPDATE wcb_sessions SET active=false")) return { rows: [], rowCount: 1 }
      if (sql.startsWith("SELECT workspace_id FROM wcb_workspace_members")) return { rows: [{ workspace_id: "33333333-3333-4333-8333-333333333333" }], rowCount: 1 }
      throw new Error("Unexpected SQL: " + sql)
    })
    const resolved = await resolveDatabaseSession(db, "t".repeat(43))
    expect(resolved).toEqual({ ...session, createdAt: createdAt.getTime(), authIssuer: "https://accounts.google.com", authSubject: "google-subject", authProvider: "google", displayName: "Sihoo", email: "sihoo@example.com", emailVerified: true, picture: "https://example.com/p.png" })
    const csrf = await rotateDatabaseCsrf(db, session)
    expect(csrf).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(await verifyDatabaseCsrf(db, session, csrf)).toBe(true)
    expect(await databaseWorkspaces(db, session)).toEqual(["33333333-3333-4333-8333-333333333333"])
    await revokeDatabaseSession(db, session.sessionId)
  })
})
