import fs from "node:fs"
import { describe, expect, it } from "vitest"

describe("Phase 4 Launch UI landing composition", () => {
  it("preserves the Launch UI section rhythm and WebCanBe route boundary", () => {
    const home = fs.readFileSync("src/Home.tsx", "utf8")
    const app = fs.readFileSync("src/App.tsx", "utf8")
    const order = ["<Navbar/>", "<Hero/>", "<Logos/>", "<Items/>", "<ProductStory/>", "<Stats/>", "<Pricing/>", "<FAQ/>", "<CTA/>", "<Footer/>"]
    let cursor = -1
    for (const marker of order) {
      const next = home.indexOf(marker, cursor + 1)
      expect(next, marker).toBeGreaterThan(cursor)
      cursor = next
    }
    for (const productRoute of ["/browse", "/project/", "/login", "/signup", "/workspace/", "/projects", "/dashboard", "/settings", "/plans", "/seller"]) expect(app).toContain(productRoute)
    expect(home).toContain('/mainline/hero.webp')
    expect(home).toContain('/mainline/features/triage-card.svg')
    expect(home).not.toMatch(/next\/(?:image|link|navigation|font)|next-themes|Styleglide/i)
  })
})
