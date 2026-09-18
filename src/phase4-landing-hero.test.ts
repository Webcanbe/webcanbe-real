import fs from "node:fs"
import { describe, expect, it } from "vitest"

describe("Phase 4 landing hero visibility", () => {
  it("keeps the selected mounted hero while removing the hidden variant wrapper", () => {
    const html = fs.readFileSync("public/wcb-landing/index.html", "utf8")
    expect(html).toContain("mounted")
    expect(html).toContain("Edit visually. Leave with real code you own.")
    expect(html).not.toContain('class="hero-variants"')
    expect(html).not.toContain(".hero-variants>*")
  })
})
