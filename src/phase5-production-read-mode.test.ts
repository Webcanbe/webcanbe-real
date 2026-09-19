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
    expect(index).not.toContain('name="wcb-product-read-mode"')
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
})
