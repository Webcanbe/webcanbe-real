import fs from "node:fs"
import { describe, expect, it } from "vitest"

const rollback = fs.readFileSync("scripts/cloudflare-rollback.mjs", "utf8")
const runbook = fs.readFileSync("docs/operations/cloudflare-rollback.md", "utf8")

describe("Phase 5 Cloudflare rollback operations", () => {
  it("requires an explicit version ID and production confirmation", () => {
    expect(rollback).toContain("WEBCANBE_ROLLBACK_CONFIRM")
    expect(rollback).toContain("ROLLBACK_PRODUCTION")
    expect(rollback).toContain("worker-version-id")
    expect(rollback).toContain("wrangler")
    expect(rollback).toContain("rollback")
    expect(rollback).toContain("versionId")
  })

  it("does not automatically select the previous version", () => {
    expect(rollback).toContain('["wrangler", "rollback", versionId')
    expect(rollback).not.toContain('["wrangler", "rollback", "--message"')
    expect(runbook).toContain("Do not guess.")
    expect(runbook).toContain("immediately previous version may itself be bad")
  })

  it("separates Worker rollback from database recovery", () => {
    expect(runbook).toContain("does **not** rewind PostgreSQL data")
    expect(runbook).toContain("database-backup-restore.md")
    expect(runbook).toContain("live production rollback drill has **not** been intentionally executed")
  })
})
