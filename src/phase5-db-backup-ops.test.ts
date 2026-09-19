import fs from "node:fs"
import { describe, expect, it } from "vitest"

const backup = fs.readFileSync("scripts/db/backup.mjs", "utf8")
const verify = fs.readFileSync("scripts/db/verify-backup.mjs", "utf8")
const docs = fs.readFileSync("docs/operations/database-backup-restore.md", "utf8")
const gitignore = fs.readFileSync(".gitignore", "utf8")

describe("Phase 5 database backup operations", () => {
  it("keeps the database secret out of pg_dump command-line arguments", () => {
    expect(backup).toContain("WEBCANBE_DATABASE_URL")
    expect(backup).toContain("PGPASSWORD: decodeURIComponent(url.password)")
    expect(backup).toContain('spawnSync("pg_dump"')
    expect(backup).not.toContain('"--dbname", raw')
    expect(backup).not.toContain("raw,")
    expect(backup).toContain("delete pgEnv.WEBCANBE_DATABASE_URL")
  })

  it("creates a data-only archive for Webcanbe tables with a checksum", () => {
    expect(backup).toContain('"--data-only"')
    expect(backup).toContain('"--table=public.wcb_*"')
    expect(backup).toContain('createHash("sha256")')
    expect(backup).toContain('target + ".sha256"')
  })

  it("verifies archive readability, checksum, and Webcanbe table data entries", () => {
    expect(verify).toContain('spawnSync("pg_restore", ["--list", target]')
    expect(verify).toContain("Backup checksum mismatch.")
    expect(verify).toContain("/TABLE DATA public wcb_")
    expect(verify).toContain("tables.size < 20")
  })

  it("keeps backup artifacts out of source control and documents recovery-first restore", () => {
    expect(gitignore).toContain("backups/")
    expect(docs).toContain("Do not restore directly over the only production database")
    expect(docs).toContain("Create a separate recovery PostgreSQL/Supabase project")
    expect(docs).toContain("Security Advisor")
  })
})
