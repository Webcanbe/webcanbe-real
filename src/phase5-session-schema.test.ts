import fs from "node:fs"
import { describe, expect, it } from "vitest"

const migration = fs.readFileSync("deployment/hosted/postgres-session-created-at.sql", "utf8")
const schema = fs.readFileSync("deployment/hosted/postgres.sql", "utf8")
const session = fs.readFileSync("worker/postgres-session.js", "utf8")
const worker = fs.readFileSync("worker/index.js", "utf8")
const providerMigration = fs.readFileSync("deployment/hosted/postgres-session-auth-provider.sql", "utf8")

describe("Phase 5 DB session creation timestamp", () => {
  it("keeps created_at in the canonical wcb_sessions schema", () => {
    expect(schema).toContain("created_at timestamptz NOT NULL DEFAULT clock_timestamp()")
    expect(schema).toContain("ALTER TABLE wcb_sessions ADD COLUMN IF NOT EXISTS created_at timestamptz")
    expect(schema).toContain("ALTER TABLE wcb_sessions ALTER COLUMN created_at SET NOT NULL")
  })

  it("backfills existing seven-day production sessions before enforcing NOT NULL", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS created_at timestamptz")
    expect(migration).toContain("created_at = expires_at - interval '7 days'")
    expect(migration).toContain("ALTER COLUMN created_at SET DEFAULT clock_timestamp()")
    expect(migration).toContain("ALTER COLUMN created_at SET NOT NULL")
    expect(migration).not.toMatch(/\bDROP\b|\bDELETE\b|\bTRUNCATE\b/i)
  })

  it("matches the runtime session resolver freshness dependency", () => {
    expect(session).toContain("s.created_at")
    expect(session).toContain("const createdAt = new Date(row.created_at).getTime()")
  })

  it("preserves verified provider provenance when issuing DB sessions", () => {
    expect(worker).toContain("provider: identity.provider")
    expect(session).toContain("cleanOptional(identity.provider, 100)")
    expect(session).toContain("identity.subject, cleanOptional(identity.provider, 100) ?? null")
  })

  it("backfills only known Google/Firebase providers for older sessions", () => {
    expect(providerMigration).toContain("auth_provider IS NULL")
    expect(providerMigration).toContain("https://accounts.google.com")
    expect(providerMigration).toContain("THEN 'google'")
    expect(providerMigration).toContain("https://securetoken.google.com/webcanbe-b607e")
    expect(providerMigration).toContain("THEN 'firebase'")
    expect(providerMigration).not.toMatch(/\bDELETE\b|\bTRUNCATE\b|\bDROP\b/i)
  })

})
