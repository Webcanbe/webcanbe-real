import fs from "node:fs"
import { describe, expect, it } from "vitest"

describe("Phase 4 landing hero visibility", () => {
  it("renders the Launch UI animation shell in its mounted state", () => {
    const html = fs.readFileSync("public/wcb-landing/index.html", "utf8")
    expect(html).toContain("mounted")
    expect(html).toContain("Edit visually. Leave with real code you own.")
    expect(html).toContain('class="hero-variants"')
  })
})
