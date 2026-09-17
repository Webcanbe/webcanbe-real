import fs from "node:fs"
import { describe, expect, it } from "vitest"

describe("Phase 4 exact Launch UI landing composition", () => {
  it("ports the pinned upstream homepage composition without WebCanBe redesign", () => {
    const home = fs.readFileSync("src/Home.tsx", "utf8")
    const page = fs.readFileSync("src/launch-ui/app/page.tsx", "utf8")
    const source = fs.readFileSync("src/launch-ui/SOURCE.md", "utf8")
    const app = fs.readFileSync("src/App.tsx", "utf8")
    const order = ["<Navbar />", "<Hero />", "<Logos />", "<Items />", "<Stats />", "<Pricing />", "<FAQ />", "<CTA />", "<Footer />"]
    let cursor = -1
    for (const marker of order) {
      const next = page.indexOf(marker, cursor + 1)
      expect(next, marker).toBeGreaterThan(cursor)
      cursor = next
    }
    expect(home).toContain('LaunchUIHome')
    expect(home).toContain('className="launch-ui-page dark"')
    expect(source).toContain("b0d4d5bce91d13523450416ce1797109076b2787")
    expect(fs.existsSync("public/dashboard-light.png")).toBe(true)
    expect(fs.existsSync("public/dashboard-dark.png")).toBe(true)
    for (const productRoute of ["/browse", "/project/", "/login", "/signup", "/workspace/", "/projects", "/dashboard", "/settings", "/plans", "/seller"]) expect(app).toContain(productRoute)
  })
})
