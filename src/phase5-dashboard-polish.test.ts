import fs from "node:fs"
import { describe, expect, it } from "vitest"

const app = fs.readFileSync("src/App.tsx", "utf8")
const css = fs.readFileSync("src/phase4-final-ui.css", "utf8")

describe("Phase 5 Ropean dashboard interactions", () => {
  const dashboard = app.slice(app.indexOf("function RopeanDashboardShell"), app.indexOf("function Settings()"))

  it("keeps dashboard navigation inside one Ropean shell", () => {
    expect(dashboard).toContain("onView(next)")
    expect(dashboard).toContain('choose("projects")')
    expect(dashboard).toContain('choose("marketplace")')
    expect(dashboard).not.toContain('<Link key={label} to={to}')
  })

  it("restores the approved visible dashboard menu set", () => {
    expect(dashboard).toContain('navButton("Dashboard","overview",LayoutDashboard)')
    expect(dashboard).toContain('navButton("My projects","projects",ListTodo)')
    expect(dashboard).toContain('navButton("Marketplace","marketplace",PackageCheck)')
    expect(dashboard).toContain('navButton("Purchases","purchases",MessagesSquare')
    expect(dashboard).toContain('navButton("Creator Studio","creator",Users)')
    expect(dashboard).toContain("<span>Source-backed editing</span>")
    expect(dashboard).toContain('navButton("Workspace","workspace",ShieldCheck)')
    expect(dashboard).toContain('navButton("Documentation","docs",Bug)')
    expect(dashboard).toContain("<span>Settings</span>")
    expect(dashboard).toContain('navButton("Help Center","help",HelpCircle)')
  })

  it("keeps real collapsible sidebar navigation", () => {
    expect(dashboard).toContain("rd-collapsible-trigger")
    expect(dashboard).toContain("rd-collapsible-content")
    expect(dashboard).toContain('setWorkspaceOpen(v => !v)')
    expect(dashboard).toContain('setSettingsOpen(v => !v)')
    expect(dashboard).toContain("<ChevronRight")
  })

  it("keeps both bottom account and top profile dropdown menus", () => {
    expect(dashboard).toContain("rd-account-dropdown")
    expect(dashboard).toContain("rd-profile-dropdown")
    expect(dashboard).toContain("Upgrade to Pro")
    expect(dashboard).toContain("Billing")
    expect(dashboard).toContain("Notifications")
    expect(dashboard).toContain("New workspace")
  })

  it("prevents sidebar clipping from hiding the bottom account dropdown", () => {
    expect(css).toContain(".rd-sidebar{z-index:80;overflow:visible}")
    expect(css).toContain(".rd-sidebar-footer{position:relative;z-index:100;overflow:visible}")
    expect(css).toContain(".rd-account-dropdown{left:calc(100% + 4px);bottom:8px")
  })

  it("adds subtle dashboard, dropdown and collapsible motion", () => {
    expect(app).toContain('<main key={view} className="rd-main">')
    expect(css).toContain("@keyframes rdDropdownIn")
    expect(css).toContain("@keyframes rdCollapseIn")
    expect(css).toContain("@keyframes rdContentIn")
    expect(css).toContain("@media(prefers-reduced-motion:reduce)")
  })

  it("keeps the compact search dialog and live purchase badge", () => {
    expect(dashboard).toContain('className="rd-search-dialog"')
    expect(dashboard).toContain('placeholder="Search Webcanbe"')
    expect(dashboard).toContain("purchaseBadge > 0 ? String(purchaseBadge)")
    expect(dashboard).not.toContain('MessagesSquare, "3"')
  })
})
