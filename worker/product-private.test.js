import { describe, expect, it } from "vitest"
import { databasePurchases, databaseWorkspaceProjects } from "./product-private.js"

describe("Workers private product reads", () => {
  it("scopes purchases to the authenticated user and maps the entitlement contract", async () => {
    const calls = []
    const db = {
      async query(sql, params) {
        calls.push({ sql, params })
        return { rows: [{
          entitlement_id: "11111111-1111-1111-1111-111111111111",
          user_id: "22222222-2222-2222-2222-222222222222",
          release_id: "33333333-3333-3333-3333-333333333333",
          provider: "stripe",
          provider_reference: "pi_123",
          status: "active",
          granted_at: "2026-09-19T00:00:00Z",
          revoked_at: null,
        }] }
      }
    }
    const result = await databasePurchases(db, { userId: "22222222-2222-2222-2222-222222222222" })
    expect(calls).toHaveLength(1)
    expect(calls[0].sql).toContain("WHERE user_id=$1")
    expect(calls[0].params).toEqual(["22222222-2222-2222-2222-222222222222"])
    expect(result[0]).toMatchObject({ providerReference: "pi_123", status: "active" })
  })

  it("requires active workspace authority for working-copy reads", async () => {
    const calls = []
    const db = {
      async query(sql, params) {
        calls.push({ sql, params })
        return { rows: [{
          workspace_project_id: "44444444-4444-4444-4444-444444444444",
          workspace_id: "55555555-5555-5555-5555-555555555555",
          entitlement_id: "11111111-1111-1111-1111-111111111111",
          release_id: "33333333-3333-3333-3333-333333333333",
          source_project_id: "66666666-6666-6666-6666-666666666666",
          source_revision_id: "rev_1",
          source_content_hash: "a".repeat(64),
          snapshot_hash: "b".repeat(64),
          created_at: "2026-09-19T00:00:00Z",
        }] }
      }
    }
    const result = await databaseWorkspaceProjects(db, { userId: "22222222-2222-2222-2222-222222222222" })
    expect(calls).toHaveLength(1)
    expect(calls[0].sql).toContain("m.user_id=$1")
    expect(calls[0].sql).toContain("wcb_workspace_members")
    expect(calls[0].sql).toContain("wm.active")
    expect(calls[0].sql).toContain("wm.role IN ('owner','editor')")
    expect(result[0]).toMatchObject({
      workspaceProjectId: "44444444-4444-4444-4444-444444444444",
      releaseSnapshotHash: "b".repeat(64),
    })
  })

  it("returns truthful empty arrays for a clean account instead of fabricating purchases or working copies", async () => {
    const calls = []
    const db = {
      async query(sql, params) {
        calls.push({ sql, params })
        return { rows: [] }
      }
    }
    const session = { userId: "77777777-7777-4777-8777-777777777777" }
    expect(await databasePurchases(db, session)).toEqual([])
    expect(await databaseWorkspaceProjects(db, session)).toEqual([])
    expect(calls).toHaveLength(2)
    expect(calls.every(call => call.params[0] === session.userId)).toBe(true)
  })

  it("never accepts a caller-supplied user id for private library reads", async () => {
    const seen = []
    const db = {
      async query(_sql, params) {
        seen.push(params)
        return { rows: [] }
      }
    }
    const session = { userId: "88888888-8888-4888-8888-888888888888" }
    await databasePurchases(db, session)
    await databaseWorkspaceProjects(db, session)
    expect(seen).toEqual([[session.userId], [session.userId]])
  })
})
