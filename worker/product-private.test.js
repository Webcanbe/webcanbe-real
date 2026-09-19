import assert from "node:assert/strict"
import test from "node:test"
import { databasePurchases, databaseWorkspaceProjects } from "./product-private.js"

test("databasePurchases is user-scoped and maps the public entitlement contract", async () => {
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
  assert.equal(calls.length, 1)
  assert.match(calls[0].sql, /WHERE user_id=\$1/)
  assert.deepEqual(calls[0].params, ["22222222-2222-2222-2222-222222222222"])
  assert.equal(result[0].providerReference, "pi_123")
  assert.equal(result[0].status, "active")
})

test("databaseWorkspaceProjects requires both ownership record and active workspace authority", async () => {
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
  assert.equal(calls.length, 1)
  assert.match(calls[0].sql, /m\.user_id=\$1/)
  assert.match(calls[0].sql, /wcb_workspace_members/)
  assert.match(calls[0].sql, /wm\.active/)
  assert.match(calls[0].sql, /owner','editor/)
  assert.equal(result[0].workspaceProjectId, "44444444-4444-4444-4444-444444444444")
  assert.equal(result[0].releaseSnapshotHash, "b".repeat(64))
})
