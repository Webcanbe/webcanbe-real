import { describe, expect, it } from "vitest"
import { browseCatalog, catalogDetail } from "./product-catalog.js"
import { withHyperdrive } from "./hyperdrive.js"

const row = {
  listing_id: "11111111-1111-4111-8111-111111111111",
  catalog_project_id: "22222222-2222-4222-8222-222222222222",
  release_id: "33333333-3333-4333-8333-333333333333",
  slug: "northstar-studio",
  title: "Northstar Studio",
  summary: "A real source-backed project",
  status: "published",
  availability: "available",
  tags: ["react", "marketing"],
  demo_metadata: { price: 79 },
  price_minor: 7900,
  currency: "USD",
  updated_at: "2026-09-19T00:00:00.000Z",
  version: "1.0.0",
  source_project_id: "44444444-4444-4444-8444-444444444444",
  source_revision_id: "rev_1",
  source_content_hash: "content-hash",
  snapshot_hash: "snapshot-hash",
  release_created_at: "2026-09-18T00:00:00.000Z",
  public_metadata: { creator: "Webcanbe creator" },
  qualification_status: "ready",
  qualification_version: "1",
  compatibility_evidence: { total: 1, full: 1 },
  reasons: ["Full visual support"],
}

describe("Workers public catalog adapter", () => {
  it("preserves the published/available/active browse boundary and public listing shape", async () => {
    const calls = []
    const db = { query: async (sql, params) => { calls.push({sql,params}); return { rows: [row] } } }
    const result = await browseCatalog(db, { query: "northstar", tags: ["React"], limit: 10 })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      listingId: row.listing_id,
      releaseId: row.release_id,
      slug: row.slug,
      releaseVersion: "1.0.0",
      sourceRevisionId: "rev_1",
      snapshotHash: "snapshot-hash",
      priceMinor: 7900,
      currency: "USD",
      ready: { status: "ready" },
    })
    expect(calls[0].sql).toContain("l.status='published'")
    expect(calls[0].sql).toContain("l.availability='available'")
    expect(calls[0].sql).toContain("c.status='active'")
  })

  it("preserves immutable release provenance on detail", async () => {
    const db = { query: async (_sql, params) => {
      expect(params).toEqual(["northstar-studio"])
      return { rows: [row] }
    } }
    const listing = await catalogDetail(db, "northstar-studio")
    expect(listing).toMatchObject({
      listingId: row.listing_id,
      release: {
        releaseId: row.release_id,
        sourceProjectId: row.source_project_id,
        sourceRevisionId: row.source_revision_id,
        sourceContentHash: row.source_content_hash,
        snapshotHash: row.snapshot_hash,
      },
      publicMetadata: { creator: "Webcanbe creator" },
    })
  })

  it("rejects unknown filters and bounds browse limits", async () => {
    const db = { query: async () => ({ rows: [row, row] }) }
    await expect(browseCatalog(db, { unknown: true })).rejects.toThrow("Invalid catalog filter")
    await expect(browseCatalog(db, { tags: ["x".repeat(1)], limit: 1.5 })).rejects.toThrow("Invalid catalog filter")
    expect(await browseCatalog(db, { limit: 1 })).toHaveLength(1)
  })

  it("fails closed when Hyperdrive is not configured", async () => {
    await expect(withHyperdrive({}, async () => "unexpected")).rejects.toMatchObject({ code: "WCB_DATABASE_UNAVAILABLE" })
  })
})
