import fs from "node:fs"
import { describe, expect, it } from "vitest"

const migration = fs.readFileSync("deployment/hosted/postgres-product-operator-updated-at.sql", "utf8")
const schema = fs.readFileSync("deployment/hosted/postgres.sql", "utf8")
const roles = fs.readFileSync("deployment/hosted/postgres-control-roles.sql", "utf8")
const bigperson = fs.readFileSync("worker/bigperson-auth.js", "utf8")
const control = fs.readFileSync("worker/control-mutations.js", "utf8")

describe("Phase 5 product operator timestamp contract", () => {
  it("keeps updated_at in fresh and upgrade schemas", () => {
    expect(schema).toContain("updated_at timestamptz NOT NULL DEFAULT clock_timestamp()")
    expect(schema).toContain("ALTER TABLE wcb_product_operators ADD COLUMN IF NOT EXISTS updated_at timestamptz")
    expect(roles).toContain("ADD COLUMN IF NOT EXISTS updated_at timestamptz")
    expect(roles).toContain("ALTER COLUMN updated_at SET NOT NULL")
  })

  it("backfills existing operator rows without destructive DDL", () => {
    expect(migration).toContain("UPDATE wcb_product_operators")
    expect(migration).toContain("WHERE updated_at IS NULL")
    expect(migration).toContain("ALTER COLUMN updated_at SET DEFAULT clock_timestamp()")
    expect(migration).toContain("ALTER COLUMN updated_at SET NOT NULL")
    expect(migration).not.toMatch(/\bDROP\b|\bDELETE\b|\bTRUNCATE\b/i)
  })

  it("matches every runtime write that maintains operator authority", () => {
    expect(bigperson).toContain("updated_at=clock_timestamp()")
    expect(control).toContain("updated_at=clock_timestamp()")
  })
})
