import fs from "node:fs"
import { describe, expect, it } from "vitest"

const app = fs.readFileSync("src/App.tsx", "utf8")
const client = fs.readFileSync("src/hostedProductClient.ts", "utf8")
const index = fs.readFileSync("index.html", "utf8")

describe("Phase 5 production read-only product mode", () => {
  it("activates production reads while keeping product mutations closed", () => {
    expect(client).toContain("productionReadProductMode")
    expect(client).toContain('meta[name="wcb-product-read-mode"]')
    expect(client).toContain("productReadMode")
    expect(client).toContain("productionMutationProductMode")
    expect(client).toContain('meta[name="wcb-product-mutation-mode"]')
    expect(index).toContain('<meta name="wcb-product-read-mode" content="hosted" />')
    expect(index).not.toContain('name="wcb-product-mutation-mode"')
    expect(index).toContain('<meta name="wcb-control-mode" content="hosted" />')
  })

  it("routes public Marketplace, detail, and preview through authoritative production reads", () => {
    const browse = app.slice(app.indexOf("function Browse()"), app.indexOf("function projectStructure"))
    const detail = app.slice(app.indexOf("function Detail("), app.indexOf("function ProjectPreviewPage"))
    const preview = app.slice(app.indexOf("function ProjectPreviewPage"), app.indexOf("function authNext()"))
    expect(browse).toContain("const hosted=productReadMode()")
    expect(browse).toContain("hostedProductClient.browse")
    expect(detail).toContain("const hosted=productReadMode()")
    expect(detail).toContain("hostedProductClient.detail")
    expect(preview).toContain("const hosted=productReadMode()")
    expect(preview).toContain("hostedProductClient.detail")
    expect(preview).not.toContain("const p=projects.find")
  })

  it("uses real account/workspace/library reads on the production read switch", () => {
    const appShell = app.slice(app.indexOf("function AppShell"), app.indexOf("function Protected"))
    const library = app.slice(app.indexOf("function useProductLibrary"), app.indexOf("function Dashboard"))
    const settings = app.slice(app.indexOf("function Settings()"), app.indexOf("\nfunction ", app.indexOf("function Settings()")+20))
    expect(appShell).toContain("const hosted=productReadMode()")
    expect(library).toContain("const hosted = productReadMode()")
    expect(settings).toContain("live=productReadMode()")
    expect(settings).toContain("hostedProductClient.account()")
    expect(settings).toContain("hostedProductClient.updateAccount(name)")
  })

  it("keeps Seller and Checkout on the full hosted boundary while Control stays independently gated", () => {
    const seller = app.slice(app.indexOf("function Seller("), app.indexOf("\nfunction ", app.indexOf("function Seller(")+20))
    const control = app.slice(app.indexOf("function Control()"), app.indexOf("\nfunction ", app.indexOf("function Control()")+20))
    const checkout = app.slice(app.indexOf("function Checkout()"), app.indexOf("\nfunction ", app.indexOf("function Checkout()")+20))
    expect(seller).toContain("hostedProductMode()")
    expect(checkout).toContain("hostedProductMode()")
    expect(control).toContain("controlMode()")
    expect(client).toContain("productionControlMode")
    expect(client).toContain("controlMode = () => hostedProductMode() || productionControlMode()")
    expect(seller).not.toContain("productReadMode()")
    expect(control).not.toContain("productReadMode()")
  })

  it("keeps working-copy creation behind the explicit product mutation switch", () => {
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
