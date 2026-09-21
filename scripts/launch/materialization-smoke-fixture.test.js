import { describe, expect, it } from "vitest"
import { buildMaterializationSmokeFixture, materializationSmokeFixtureSql } from "./materialization-smoke-fixture.mjs"
import { verifyReleaseSnapshot } from "../../worker/materialization.js"

const userId = "11111111-1111-4111-8111-111111111111"
const workspaceId = "22222222-2222-4222-8222-222222222222"

describe("launch materialization smoke fixture", () => {
  it("builds deterministic source/release provenance accepted by the production verifier", () => {
    const a = buildMaterializationSmokeFixture({ userId, workspaceId, version: "v1" })
    const b = buildMaterializationSmokeFixture({ userId, workspaceId, version: "v1" })
    expect(a).toEqual(b)
    expect(a.fileCount).toBeGreaterThan(5)
    expect(a.editableFileCount).toBeGreaterThan(2)
    expect(a.files.some(([file]) => file === "package.json")).toBe(true)
    expect(a.files.some(([file]) => file === "src/App.tsx")).toBe(true)
    expect(a.files.some(([file]) => file.startsWith("node_modules/"))).toBe(false)
    expect(a.files.some(([file]) => file.startsWith(".git/"))).toBe(false)

    const verified = verifyReleaseSnapshot({
      source_project_id: a.sourceProjectId,
      source_revision_id: a.revisionId,
      source_content_hash: a.sourceContentHash,
      snapshot_hash: a.snapshotHash,
      files: a.files,
      history: a.history,
    })
    expect(verified.sourceProjectId).toBe(a.sourceProjectId)
    expect(verified.sourceRevisionId).toBe(a.revisionId)
    expect(verified.sourceContentHash).toBe(a.sourceContentHash)
    expect(verified.snapshotHash).toBe(a.snapshotHash)
  })

  it("survives PostgreSQL JSONB-style history key reordering", () => {
    const a = buildMaterializationSmokeFixture({ userId, workspaceId, version: "v1" })
    const head = a.history.revisions[0]
    const dbHistory = {
      past: a.history.past,
      future: a.history.future,
      schema: a.history.schema,
      projectId: a.history.projectId,
      revisions: [{
        actor: head.actor,
        producer: head.producer,
        createdAt: head.createdAt,
        projectId: head.projectId,
        revisionId: head.revisionId,
        contentHash: head.contentHash,
        parentRevisionId: head.parentRevisionId,
      }],
      sourceScope: a.history.sourceScope,
      transactions: a.history.transactions,
      sourceDirectory: a.history.sourceDirectory,
    }
    expect(() => verifyReleaseSnapshot({
      source_project_id: a.sourceProjectId,
      source_revision_id: a.revisionId,
      source_content_hash: a.sourceContentHash,
      snapshot_hash: a.snapshotHash,
      files: a.files,
      history: dbHistory,
    })).not.toThrow()
  })

  it("changes identity when the target user/workspace changes", () => {
    const a = buildMaterializationSmokeFixture({ userId, workspaceId, version: "v1" })
    const b = buildMaterializationSmokeFixture({
      userId: "33333333-3333-4333-8333-333333333333",
      workspaceId,
      version: "v1",
    })
    expect(a.releaseId).not.toBe(b.releaseId)
    expect(a.entitlementId).not.toBe(b.entitlementId)
    expect(a.snapshotHash).not.toBe(b.snapshotHash)
  })

  it("emits an idempotent transaction with no public Listing insertion", () => {
    const sql = materializationSmokeFixtureSql({ userId, workspaceId, version: "v1" })
    expect(sql).toContain("BEGIN;")
    expect(sql).toContain("INSERT INTO wcb_catalog_projects")
    expect(sql).toContain("INSERT INTO wcb_project_releases")
    expect(sql).toContain("INSERT INTO wcb_license_entitlements")
    expect(sql).toContain("'launch-smoke'")
    expect(sql).toContain("ON CONFLICT(release_id) DO NOTHING")
    expect(sql).not.toContain("INSERT INTO wcb_listings")
    expect(sql).toContain("COMMIT;")
  })

  it("refuses malformed operator target identifiers", () => {
    expect(() => buildMaterializationSmokeFixture({ userId: "not-a-uuid", workspaceId })).toThrow()
    expect(() => buildMaterializationSmokeFixture({ userId, workspaceId: "not-a-uuid" })).toThrow()
    expect(() => buildMaterializationSmokeFixture({ userId, workspaceId, version: "../../bad" })).toThrow()
  })
})
