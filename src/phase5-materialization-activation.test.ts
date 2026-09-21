import fs from "node:fs"
import { describe, expect, it } from "vitest"

const index = fs.readFileSync("index.html", "utf8")
const wrangler = JSON.parse(fs.readFileSync("wrangler.jsonc", "utf8")) as { vars?: Record<string,string> }
const worker = fs.readFileSync("worker/index.js", "utf8")
const app = fs.readFileSync("src/App.tsx", "utf8")
const client = fs.readFileSync("src/hostedProductClient.ts", "utf8")
const fixture = fs.readFileSync("scripts/launch/materialization-smoke-fixture.mjs", "utf8")

describe("Phase 5 Gate 3 prepared materialization activation", () => {
  it("keeps both production mutation switches closed until the deliberate activation commit", () => {
    expect(index).toContain('<meta name="wcb-product-read-mode" content="hosted" />')
    expect(index).not.toContain('name="wcb-product-mutation-mode"')
    expect(wrangler.vars?.WEBCANBE_PRODUCT_MUTATIONS).toBeUndefined()
    expect(worker).toContain('if (env.WEBCANBE_PRODUCT_MUTATIONS !== "enabled") return json({ error: "Product mutations are not enabled." }, 503)')
  })

  it("has the exact two bounded activation seams ready without opening Seller or payment mutation routes", () => {
    expect(client).toContain("productionMutationProductMode")
    expect(client).toContain('meta[name="wcb-product-mutation-mode"]')
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
    expect(fixture).toContain('purpose: "materialization-launch-smoke"')
    expect(fixture).toContain('provider: "launch-smoke"')
    expect(fixture).not.toContain("INSERT INTO wcb_listings")
    expect(fixture).toContain("publicListingCreated: false")
  })

  it("preserves Gate 2 provider-linking fixes while preparing materialization", () => {
    expect(app).toContain("hostedProductClient.linkFirebaseIdentity")
    expect(app).toContain("currentFirebaseProviderIds")
    expect(app).toContain('providers.includes("github.com")')
    expect(app).toContain("GATE2_LINKED_KEY")
  })

  it("keeps materialization behind session, CSRF, workspace and entitlement authority", () => {
    const privateProduct = worker.slice(worker.indexOf("async function privateProduct"), worker.indexOf("async function readiness"))
    expect(privateProduct).toContain("resolveDatabaseSession")
    expect(privateProduct).toContain("verifyDatabaseCsrf")
    expect(privateProduct).toContain("PRIVATE_API_RATE_LIMITER")
    expect(privateProduct).toContain("materializeDatabaseWorkspaceProject")
  })
})
