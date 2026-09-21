import { describe, expect, it } from "vitest"
import { canonicalJson as canonicalTs, releaseSnapshotHash as hashTs } from "./webcanbe-engine/runtime/snapshotIntegrity"
import { canonicalJson as canonicalWorker, releaseSnapshotHash as hashWorker } from "../worker/snapshot-integrity.js"

describe("Phase 5 canonical immutable release snapshots", () => {
  it("canonicalizes nested object keys while preserving array order", () => {
    const a = { z: 1, a: { y: true, x: "value" }, list: [{ b: 2, a: 1 }, "x"] }
    const b = { list: [{ a: 1, b: 2 }, "x"], a: { x: "value", y: true }, z: 1 }
    expect(canonicalTs(a)).toBe(canonicalTs(b))
    expect(canonicalWorker(a)).toBe(canonicalWorker(b))
    expect(canonicalTs(a)).toBe(canonicalWorker(a))
  })

  it("keeps browser/domain and Worker release hashes identical", () => {
    const first = {
      projectId: "11111111-1111-4111-8111-111111111111",
      revisionId: "rev_22222222-2222-4222-8222-222222222222",
      contentHash: "a".repeat(64),
      files: [["src/App.tsx", "YWJj"]] as const,
      history: {
        schema: 1,
        sourceScope: 2,
        projectId: "11111111-1111-4111-8111-111111111111",
        revisions: [{ revisionId: "rev_22222222-2222-4222-8222-222222222222", contentHash: "a".repeat(64), actor: "u" }],
        transactions: [],
        past: [],
        future: [],
      },
    }
    const dbRoundTrip = {
      ...first,
      history: {
        past: [],
        future: [],
        schema: 1,
        projectId: first.history.projectId,
        revisions: [{ actor: "u", contentHash: "a".repeat(64), revisionId: first.revisionId }],
        sourceScope: 2,
        transactions: [],
      },
    }
    expect(hashTs(first)).toBe(hashTs(dbRoundTrip))
    expect(hashWorker(first)).toBe(hashWorker(dbRoundTrip))
    expect(hashTs(first)).toBe(hashWorker(first))
  })
})
