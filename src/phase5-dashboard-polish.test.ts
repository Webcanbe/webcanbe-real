import fs from "node:fs"
import { describe, expect, it } from "vitest"

const app = fs.readFileSync("src/App.tsx", "utf8")

describe("Phase 5 dashboard polish", () => {
  it("keeps dashboard navigation inside the real protected dashboard route", () => {
    expect(app).not.toContain('["Dashboard", "/dashboard-preview"')
    expect(app).not.toContain('<Link to="/dashboard-preview"')
    expect(app).toContain('["Dashboard", "/dashboard"')
  })

  it("removes the hardcoded purchases badge", () => {
    expect(app).not.toContain('MessagesSquare, "3"')
    expect(app).toContain("purchaseBadge > 0 ? String(purchaseBadge)")
  })

  it("makes search, notifications, profile and activity controls functional", () => {
    expect(app).toContain("rd-search-results")
    expect(app).toContain("setNoticesOpen")
    expect(app).toContain("setHeaderAccountOpen")
    expect(app).toContain('setTab("activity")')
    expect(app).toContain('onKeyDown={event => { if (event.key === "Enter"')
  })

  it("marks unavailable appearance controls as disabled instead of pretending they work", () => {
    expect(app).toContain('aria-label="Light theme"')
    expect(app).toContain('aria-label="Display settings unavailable"')
    expect(app).toContain("disabled><Sun/>")
    expect(app).toContain("disabled><SlidersHorizontal/>")
  })
})
