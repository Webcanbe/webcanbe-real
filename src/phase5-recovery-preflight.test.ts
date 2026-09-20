import fs from "node:fs"
import { describe, expect, it } from "vitest"

const preflight = fs.readFileSync("scripts/db/recovery-preflight.mjs", "utf8")
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"))
const docs = fs.readFileSync("docs/operations/database-backup-restore.md", "utf8")

describe("Phase 5 recovery database preflight", () => {
  it("is read-only and accepts an explicit recovery database URL", () => {
    expect(preflight).toContain("RECOVERY_DATABASE_URL")
    expect(preflight).toContain("WEBCANBE_DATABASE_URL")
    expect(preflight).toContain("application_name: \"webcanbe_recovery_preflight\"")
    expect(preflight).toContain("await client.query(")
    expect(preflight).not.toMatch(/\b(insert|update|delete|alter|drop|truncate|create)\b/i)
  })

  it("checks browser grants and bounded runtime roles", () => {
    expect(preflight).toContain("Browser table grants remain stripped")
    expect(preflight).toContain("Browser routine grants remain stripped")
    expect(preflight).toContain("Runtime role is bounded")
    expect(preflight).toContain("Hyperdrive login role is bounded")
    expect(preflight).toContain("rolsuper")
    expect(preflight).toContain("rolbypassrls")
  })

  it("checks required launch-era immutability guards and migration history", () => {
    expect(preflight).toContain("wcb_immutable_project_release")
    expect(preflight).toContain("wcb_guard_published_listing_release")
    expect(preflight).toContain("wcb_immutable_control_audit")
    expect(preflight).toContain("supabase_migrations.schema_migrations")
    expect(preflight).toContain("tableCount >= 40")
    expect(preflight).toContain("migrationCount >= 11")
  })

  it("is wired into the operator command and recovery runbook", () => {
    expect(pkg.scripts["db:recovery:preflight"]).toBe("node scripts/db/recovery-preflight.mjs")
    expect(docs).toContain("## Automated recovery preflight")
    expect(docs).toContain("npm run db:recovery:preflight")
    expect(docs).toContain("performs only SELECT queries")
  })
})
