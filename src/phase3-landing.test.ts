import fs from "node:fs"
import { describe, expect, it } from "vitest"

describe("Phase 3 Mainline landing port", () => {
  it("preserves the long Mainline homepage section rhythm and WebCanBe route boundary", () => {
    const home = fs.readFileSync("src/Home.tsx", "utf8")
    const app = fs.readFileSync("src/App.tsx", "utf8")
    const order = ["<Navbar/>", "styles.hero", "styles.logos", "styles.features", "styles.resource", "<Testimonials/>", "<Pricing/>", "<FAQ/>", "<Footer/>"]
    let cursor = -1
    for (const marker of order) {
      const next = home.indexOf(marker, cursor + 1)
      expect(next, marker).toBeGreaterThan(cursor)
      cursor = next
    }
    for (const productRoute of ["/browse", "/project/", "/login", "/signup", "/workspace/", "/projects", "/dashboard", "/settings", "/plans", "/seller"]) expect(app).toContain(productRoute)
    expect(home).not.toMatch(/next\/(?:image|link|navigation|font)|next-themes|Styleglide/i)
  })
})
