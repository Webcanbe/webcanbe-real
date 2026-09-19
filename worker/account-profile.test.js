import { describe, expect, it } from "vitest"
import { databaseAccount, updateDatabaseAccount } from "./account-profile.js"

describe("DB-backed account profile adapter", () => {
  it("reads the provider-independent account profile by internal user id", async () => {
    const calls = []
    const db = {
      async query(sql, params) {
        calls.push({ sql, params })
        return {
          rows: [{
            display_name: "Sihoo",
            email: "sihoo@example.com",
            email_verified: true,
            picture_url: "https://example.com/avatar.png",
            created_at: "2026-09-19T00:00:00Z",
            updated_at: "2026-09-19T01:00:00Z",
          }],
          rowCount: 1,
        }
      },
    }
    const account = await databaseAccount(db, { userId: "11111111-1111-4111-8111-111111111111" })
    expect(calls[0].params).toEqual(["11111111-1111-4111-8111-111111111111"])
    expect(account).toMatchObject({
      userId: "11111111-1111-4111-8111-111111111111",
      displayName: "Sihoo",
      email: "sihoo@example.com",
      emailVerified: true,
    })
  })

  it("updates only the editable display name", async () => {
    const calls = []
    const db = {
      async query(sql, params) {
        calls.push({ sql, params })
        return {
          rows: [{
            display_name: params[1],
            email: "sihoo@example.com",
            email_verified: true,
            picture_url: null,
            created_at: "2026-09-19T00:00:00Z",
            updated_at: "2026-09-19T01:00:00Z",
          }],
          rowCount: 1,
        }
      },
    }
    const account = await updateDatabaseAccount(
      db,
      { userId: "11111111-1111-4111-8111-111111111111" },
      { displayName: "  Min Sihoo  " },
    )
    expect(calls[0].sql).toContain("SET display_name=$2")
    expect(calls[0].params).toEqual(["11111111-1111-4111-8111-111111111111", "Min Sihoo"])
    expect(account.displayName).toBe("Min Sihoo")
  })

  it("rejects unknown fields, empty names, and oversized names", async () => {
    const db = { query: async () => { throw new Error("should not query") } }
    await expect(updateDatabaseAccount(db, { userId: "u" }, { email: "x@example.com" })).rejects.toThrow("Invalid account update")
    await expect(updateDatabaseAccount(db, { userId: "u" }, { displayName: "   " })).rejects.toThrow("Invalid display name")
    await expect(updateDatabaseAccount(db, { userId: "u" }, { displayName: "x".repeat(121) })).rejects.toThrow("Invalid display name")
  })
})
