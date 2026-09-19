import fs from "node:fs"
import { describe, expect, it } from "vitest"

const app = fs.readFileSync("src/App.tsx", "utf8")
const client = fs.readFileSync("src/hostedProductClient.ts", "utf8")
const index = fs.readFileSync("index.html", "utf8")

describe("Phase 5 production read-only product mode", () => {
  it("defines a production-only read mode without activating it yet", () => {
    expect(client).toContain("productionReadProductMode")
    expect(client).toContain('meta[name="wcb-product-read-mode"]')
    expect(client).toContain("productReadMode")
    expect(client).toContain("productionMutationProductMode")
    expect(client).toContain('meta[name="wcb-product-mutation-mode"]')
    expect(index).not.toContain('name="wcb-product-read-mode"')
    expect(index).not.toContain('name="wcb-product-mutation-mode"')
  })

  it("prepares only read-oriented account/workspace/library surfaces for the future switch", () => {
    const appShell = app.slice(app.indexOf("function AppShell"), app.indexOf("function Protected"))
    const library = app.slice(app.indexOf("function useProductLibrary"), app.indexOf("function Dashboard"))
    const settings = app.slice(app.indexOf("function Settings()"), app.indexOf("\nfunction ", app.indexOf("function Settings()")+20))
    expect(appShell).toContain("const hosted=productReadMode()")
    expect(library).toContain("const hosted = productReadMode()")
    expect(settings).toContain("live=productReadMode()")
    expect(settings).toContain("hostedProductClient.account()")
    expect(settings).toContain("hostedProductClient.updateAccount(name)")
  })

  it("does not enable seller/control or checkout mutation surfaces through the read-only switch", () => {
    const seller = app.slice(app.indexOf("function Seller("), app.indexOf("\nfunction ", app.indexOf("function Seller(")+20))
    const control = app.slice(app.indexOf("function Control()"), app.indexOf("\nfunction ", app.indexOf("function Control()")+20))
    const checkout = app.slice(app.indexOf("function Checkout()"), app.indexOf("\nfunction ", app.indexOf("function Checkout()")+20))
    expect(seller).toContain("hostedProductMode()")
    expect(control).toContain("hostedProductMode()")
    expect(checkout).toContain("hostedProductMode()")
    expect(seller).not.toContain("productReadMode()")
    expect(control).not.toContain("productReadMode()")
  })

  it("keeps working-copy creation behind the full hosted mutation mode", () => {
    const purchases = app.slice(app.indexOf("function Purchases()"), app.indexOf("type DashboardView"))
    expect(purchases).toContain("const mutationsEnabled = productMutationMode()")
    expect(purchases).toContain('if (!mutationsEnabled)')
    expect(purchases).toContain("Creation not enabled")
    expect(purchases).toContain("hostedProductClient.materialize")
  })

  it("never substitutes demo catalog or purchase rows for empty production data", () => {
    const dashboard = app.slice(app.indexOf("function Dashboard()"), app.indexOf("function Settings()"))
    const releaseProject = app.slice(app.indexOf("function releaseProject"), app.indexOf("function HubTabs"))
    expect(dashboard).toContain("const catalog = lib.hosted ? lib.catalog : projects")
    expect(dashboard).toContain("const purchaseRows = lib.hosted")
    expect(dashboard).toContain("The production catalog is empty. Demo listings are not substituted.")
    expect(releaseProject).not.toContain("projects[0]")
  })

  it("renders explicit dashboard loading and failure states before product data is trusted", () => {
    const dashboard = app.slice(app.indexOf("function Dashboard()"), app.indexOf("function Settings()"))
    expect(dashboard).toContain("if (lib.loading)")
    expect(dashboard).toContain("Loading your product state")
    expect(dashboard).toContain("if (lib.error)")
    expect(dashboard).toContain("Dashboard data could not be loaded")
  })
})
