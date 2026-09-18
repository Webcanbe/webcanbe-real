import fs from "node:fs"
import { describe, expect, it } from "vitest"

const app = fs.readFileSync("src/App.tsx", "utf8")
const landing = fs.readFileSync("public/wcb-landing/index.html", "utf8")
const index = fs.readFileSync("index.html", "utf8")

describe("Phase 5 brand pass", () => {
  it("uses the official transparent three-stroke favicon with Webcanbe casing in app chrome", () => {
    expect(app).toContain('src="/favicon.png"')
    expect(app).toContain('<span className="wcb-wordmark">Webcanbe</span>')
    expect(index).toContain('href="/favicon.png"')
  })

  it("does not rewrite the retained landing brand implementation", () => {
    expect(landing.split("/brand/webcanbe-logo.svg").length - 1).toBeGreaterThanOrEqual(3)
  })

  it("keeps the dashboard brand as the official mark plus Webcanbe text", () => {
    expect(app).toContain("rd-team-official-logo")
    expect(app).toContain("<b>Webcanbe</b><small>Source-first workspace</small>")
  })

  it("does not inject custom dashboard profile popovers", () => {
    const dashboard = app.slice(app.indexOf("function RopeanDashboardShell"), app.indexOf("function Settings()"))
    expect(dashboard).not.toContain("rd-account-popover")
    expect(dashboard).not.toContain("rd-profile-popover")
    expect(dashboard).not.toContain("setHeaderAccountOpen")
    expect(dashboard).not.toContain("setSidebarAccountOpen")
  })
})
