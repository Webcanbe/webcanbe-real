import fs from "node:fs"
import { describe, expect, it } from "vitest"

const migration = fs.readFileSync("deployment/hosted/postgres-session-created-at.sql", "utf8")
const schema = fs.readFileSync("deployment/hosted/postgres.sql", "utf8")
const session = fs.readFileSync("worker/postgres-session.js", "utf8")

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
})
