import fs from "node:fs"
import { describe, expect, it } from "vitest"

const app = fs.readFileSync("src/App.tsx", "utf8")

describe("Phase 5 Ropean dashboard interactions", () => {
  const dashboard = app.slice(app.indexOf("function RopeanDashboardShell"), app.indexOf("function Settings()"))

  it("keeps dashboard navigation inside one Ropean shell", () => {
    expect(dashboard).toContain("onView(next)")
    expect(dashboard).toContain('choose("projects")')
    expect(dashboard).toContain('choose("marketplace")')
    expect(dashboard).not.toContain('<Link key={label} to={to}')
  })

  it("restores real collapsible sidebar navigation", () => {
    expect(dashboard).toContain("rd-collapsible-trigger")
    expect(dashboard).toContain("rd-collapsible-content")
    expect(dashboard).toContain('setWorkspaceOpen(v => !v)')
    expect(dashboard).toContain('setSettingsOpen(v => !v)')
    expect(dashboard).toContain("<ChevronRight")
  })

  it("restores both bottom account and top profile dropdown menus", () => {
    expect(dashboard).toContain("rd-account-dropdown")
    expect(dashboard).toContain("rd-profile-dropdown")
    expect(dashboard).toContain("Upgrade to Pro")
    expect(dashboard).toContain("Billing")
    expect(dashboard).toContain("Notifications")
    expect(dashboard).toContain("New workspace")
  })

  it("keeps the compact search dialog and live purchase badge", () => {
    expect(dashboard).toContain('className="rd-search-dialog"')
    expect(dashboard).toContain('placeholder="Search Webcanbe"')
    expect(dashboard).toContain("purchaseBadge > 0 ? String(purchaseBadge)")
    expect(dashboard).not.toContain('MessagesSquare, "3"')
  })
})
