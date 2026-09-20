import fs from "node:fs"
import { describe, expect, it } from "vitest"

const index = fs.readFileSync("index.html", "utf8")
const wrangler = JSON.parse(fs.readFileSync("wrangler.jsonc", "utf8")) as { vars?: Record<string,string> }
const worker = fs.readFileSync("worker/index.js", "utf8")
const app = fs.readFileSync("src/App.tsx", "utf8")
const fixture = fs.readFileSync("scripts/launch/materialization-smoke-fixture.mjs", "utf8")

describe("Phase 5 Gate 3 staged materialization activation", () => {
  it("requires both frontend and Worker mutation switches", () => {
    expect(index).toContain('<meta name="wcb-product-read-mode" content="hosted" />')
    expect(index).toContain('<meta name="wcb-product-mutation-mode" content="hosted" />')
    expect(wrangler.vars?.WEBCANBE_PRODUCT_MUTATIONS).toBe("enabled")
    expect(worker).toContain('if (env.WEBCANBE_PRODUCT_MUTATIONS !== "enabled") return json({ error: "Product mutations are not enabled." }, 503)')
  })

  it("activates working-copy creation without opening Seller or payment mutation routes", () => {
    const purchases = app.slice(app.indexOf("function Purchases()"), app.indexOf("type DashboardView"))
    const seller = app.slice(app.indexOf("function Seller("), app.indexOf("\nfunction ", app.indexOf("function Seller(")+20))
    expect(purchases).toContain("productMutationMode()")
    expect(purchases).toContain("hostedProductClient.materialize")
    expect(seller).toContain("hostedProductMode()")
    expect(seller).not.toContain("productMutationMode()")
    expect(worker).not.toContain("/__webcanbe/api/product/seller/")
    expect(worker).not.toContain("/__webcanbe/api/product/entitlements/test/grant-self")
  })

  it("keeps the launch smoke fixture private from the Marketplace", () => {
    expect(fixture).toContain("purpose: \"materialization-launch-smoke\"")
    expect(fixture).toContain('provider: "launch-smoke"')
    expect(fixture).not.toContain("INSERT INTO wcb_listings")
    expect(fixture).toContain("publicListingCreated: false")
  })

  it("keeps materialization behind session, CSRF, workspace and entitlement authority", () => {
    const privateProduct = worker.slice(worker.indexOf("async function privateProduct"), worker.indexOf("async function readiness"))
    expect(privateProduct).toContain("resolveDatabaseSession")
    expect(privateProduct).toContain("verifyDatabaseCsrf")
    expect(privateProduct).toContain("PRIVATE_API_RATE_LIMITER")
    expect(privateProduct).toContain("materializeDatabaseWorkspaceProject")
  })
})
