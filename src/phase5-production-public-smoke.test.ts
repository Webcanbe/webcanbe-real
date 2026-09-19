import fs from "node:fs"
import { describe, expect, it } from "vitest"

const smoke = fs.readFileSync("scripts/production-smoke-public.mjs", "utf8")
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8")) as { scripts: Record<string, string> }

describe("Phase 5 public production smoke runner", () => {
  it("targets HTTPS production and has an explicit database expectation", () => {
    expect(smoke).toContain('const DEFAULT_ORIGIN = "https://webcanbe.com"')
    expect(smoke).toContain("WEBCANBE_EXPECT_DATABASE")
    expect(smoke).toContain('new Set(["either", "unconfigured", "ready"])')
    expect(smoke).toContain('origin.protocol !== "https:"')
  })

  it("checks baseline security and real route semantics", () => {
    expect(smoke).toContain("strict-transport-security")
    expect(smoke).toContain("content-security-policy")
    expect(smoke).toContain("x-request-id")
    expect(smoke).toContain("/__webcanbe-smoke-missing-route")
    expect(smoke).toContain("unknown SPA route returns real 404")
    expect(smoke).toContain("/dashboard")
    expect(smoke).toContain("x-robots-tag")
  })

  it("checks crawler policy and Worker database boundaries without credentials", () => {
    expect(smoke).toContain("/robots.txt")
    expect(smoke).toContain("/sitemap.xml")
    expect(smoke).toContain("/__webcanbe/ops/readiness")
    expect(smoke).toContain("/__webcanbe/api/product/catalog/browse")
    expect(smoke).toContain("Product database is not configured.")
    expect(smoke).toContain("readiness does not expose credentials")
  })

  it("is exposed as an operator command", () => {
    expect(pkg.scripts["smoke:production:public"]).toBe("node scripts/production-smoke-public.mjs")
  })
})
