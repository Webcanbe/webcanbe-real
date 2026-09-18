import fs from "node:fs"
import { describe, expect, it } from "vitest"

const app = fs.readFileSync("src/App.tsx", "utf8")

describe("Phase 5 dashboard restore", () => {
  const dashboard = app.slice(app.indexOf("function RopeanDashboardShell"), app.indexOf("function Settings()"))

  it("keeps sidebar navigation inside the Ropean dashboard shell", () => {
    expect(dashboard).toContain("onView(target)")
    expect(dashboard).toContain('onClick={() => onView("projects")}')
    expect(dashboard).toContain('onClick={() => onView("marketplace")}')
    expect(dashboard).not.toContain('<Link key={label} to={to}')
  })

  it("restores the original dashboard profile and header controls without custom popovers", () => {
    expect(dashboard).toContain('aria-label="Notifications"><Bell/>')
    expect(dashboard).toContain('aria-label="Profile">WC</button>')
    expect(dashboard).toContain('<b>Webcanbe account</b><small>Signed in</small>')
    expect(dashboard).not.toContain("rd-header-popover")
    expect(dashboard).not.toContain("rd-account-popover")
  })

  it("restores the compact original search dialog instead of the custom result panel", () => {
    expect(dashboard).toContain('className="rd-search-dialog"')
    expect(dashboard).toContain('placeholder="Search Webcanbe"')
    expect(dashboard).not.toContain("rd-search-results")
  })

  it("uses a live purchases badge without the old hardcoded value", () => {
    expect(dashboard).toContain("purchaseBadge > 0 ? String(purchaseBadge)")
    expect(dashboard).not.toContain('MessagesSquare, "3"')
  })
})
