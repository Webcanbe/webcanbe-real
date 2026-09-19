import { describe, expect, it } from "vitest"
import { databaseAccount, updateDatabaseAccount } from "./account-profile.js"

const userId = "11111111-1111-4111-8111-111111111111"

function mockDb({ displayName = "Sihoo" } = {}) {
  const calls = []
  return {
    calls,
    db: {
      async query(sql, params) {
        calls.push({ sql, params })
        if (sql.includes("FROM wcb_user_profiles") || sql.includes("UPDATE wcb_user_profiles")) {
          return {
            rows: [{
              display_name: sql.includes("UPDATE") ? params[1] : displayName,
              email: "sihoo@example.com",
              email_verified: true,
              picture_url: "https://example.com/avatar.png",
              created_at: "2026-09-19T00:00:00Z",
              updated_at: "2026-09-19T01:00:00Z",
            }],
            rowCount: 1,
          }
        }
        if (sql.includes("FROM wcb_identity_accounts")) {
          return {
            rows: [
              { issuer: "https://accounts.google.com" },
              { issuer: "https://securetoken.google.com/webcanbe-b607e" },
              { issuer: "https://securetoken.google.com/webcanbe-b607e" },
            ],
            rowCount: 3,
          }
        }
        if (sql.includes("FROM wcb_sessions")) {
          return { rows: [{ total: "2" }], rowCount: 1 }
        }
        throw new Error("unexpected query")
      },
    },
  }
}

describe("DB-backed account profile adapter", () => {
  it("reads profile, verified provider families, and active first-party session count", async () => {
    const { db, calls } = mockDb()
    const account = await databaseAccount(db, { userId })
    expect(calls[0].params).toEqual([userId])
    expect(account).toMatchObject({
      userId,
      displayName: "Sihoo",
      email: "sihoo@example.com",
      emailVerified: true,
      providers: ["Google", "Firebase Authentication"],
      activeSessions: 2,
    })
    expect(calls[1].sql).toContain("wcb_identity_accounts")
    expect(calls[1].sql).toContain("active")
    expect(calls[2].sql).toContain("expires_at>clock_timestamp()")
  })

  it("updates only the editable display name and keeps auth summary server-derived", async () => {
    const { db, calls } = mockDb()
    const account = await updateDatabaseAccount(
      db,
      { userId },
      { displayName: "  Min Sihoo  " },
    )
    expect(calls[0].sql).toContain("SET display_name=$2")
    expect(calls[0].params).toEqual([userId, "Min Sihoo"])
    expect(account).toMatchObject({
      displayName: "Min Sihoo",
      providers: ["Google", "Firebase Authentication"],
      activeSessions: 2,
    })
  })

  it("rejects unknown fields, empty names, and oversized names", async () => {
    const db = { query: async () => { throw new Error("should not query") } }
    await expect(updateDatabaseAccount(db, { userId: "u" }, { email: "x@example.com" })).rejects.toThrow("Invalid account update")
    await expect(updateDatabaseAccount(db, { userId: "u" }, { displayName: "   " })).rejects.toThrow("Invalid display name")
    await expect(updateDatabaseAccount(db, { userId: "u" }, { displayName: "x".repeat(121) })).rejects.toThrow("Invalid display name")
  })
})
