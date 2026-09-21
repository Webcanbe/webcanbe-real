import { describe, expect, it } from "vitest"
import { databaseReadiness } from "./readiness.js"

describe("production database readiness", () => {
  it("requires all critical Phase 5 tables", async () => {
    const db = { query: async () => ({ rows: [{
      sessions: true,
      identities: true,
      workspaces: true,
      profiles: true,
      catalogs: true,
      releases: true,
      rights: true,
      listings: true,
      entitlements: true,
      materializations: true,
    }] }) }
    await expect(databaseReadiness(db)).resolves.toEqual({
      ok: true,
      requiredCount: 10,
      readyCount: 10,
    })
  })

  it("fails readiness when a critical table is missing", async () => {
    const db = { query: async () => ({ rows: [{
      sessions: true,
      identities: true,
      workspaces: true,
      profiles: true,
      catalogs: true,
      releases: true,
      rights: true,
      listings: false,
      entitlements: true,
      materializations: true,
    }] }) }
    await expect(databaseReadiness(db)).resolves.toEqual({
      ok: false,
      requiredCount: 10,
      readyCount: 9,
    })
  })
})
