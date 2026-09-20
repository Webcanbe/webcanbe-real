import fs from "node:fs"
import { describe, expect, it } from "vitest"

const smoke = fs.readFileSync("scripts/production-smoke-public.mjs", "utf8")
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8")) as { scripts: Record<string, string> }
const workflow = fs.readFileSync(".github/workflows/phase5-production-smoke.yml", "utf8")

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
    expect(smoke).toContain('Boolean(csp) && !csp.includes("\'unsafe-eval\'")')
    expect(smoke).toContain("x-request-id")
    expect(smoke).toContain("/__webcanbe-smoke-missing-route")
    expect(smoke).toContain("unknown SPA route returns real 404")
    expect(smoke).toContain("/dashboard")
    expect(smoke).toContain("x-robots-tag")
    expect(smoke).toContain("production Control switch is deployed")
    expect(smoke).toContain('wcb-control-mode" content="hosted"')
    expect(smoke).toContain("product read and materialization mutation switches are deployed")
  })

  it("checks crawler policy and Worker database boundaries without credentials", () => {
    expect(smoke).toContain("/robots.txt")
    expect(smoke).toContain("/sitemap.xml")
    expect(smoke).toContain("/__webcanbe/ops/readiness")
    expect(smoke).toContain("/__webcanbe/api/product/catalog/browse")
    expect(smoke).toContain("Product database is not configured.")
    expect(smoke).toContain("readiness does not expose credentials")
    expect(smoke).toContain("anonymous private read is refused")
    expect(smoke).toContain("/__webcanbe/api/workspaces")
    expect(smoke).toContain("/__webcanbe/api/product/purchases")
    expect(smoke).toContain("/__webcanbe/api/product/workspace-projects/list")
    expect(smoke).toContain("/__webcanbe/api/account/get")
    expect(smoke).toContain("anonymous materialization is refused before mutation evaluation")
  })

  it("is exposed as an operator command and automatically runs after successful main CI", () => {
    expect(pkg.scripts["smoke:production:public"]).toBe("node scripts/production-smoke-public.mjs")
    expect(workflow).toContain('workflows: ["Phase 5 UI verify"]')
    expect(workflow).toContain("branches: [main]")
    expect(workflow).toContain("workflow_dispatch")
    expect(workflow).toContain("Production smoke attempt")
    expect(workflow).toContain("WEBCANBE_EXPECT_DATABASE")
  })
})
