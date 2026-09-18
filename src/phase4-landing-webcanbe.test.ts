import fs from "node:fs"
import { describe, expect, it } from "vitest"

describe("Phase 4 WebCanBe landing copy", () => {
  it("keeps the Launch UI visual shell but owns the visible product copy", () => {
    const home = fs.readFileSync("src/Home.tsx", "utf8")
    const html = fs.readFileSync("public/wcb-landing/index.html", "utf8")
    const copy = fs.readFileSync("public/wcb-landing/copy.txt", "utf8")

    expect(home).toContain('src="/wcb-landing/index.html"')
    expect(copy).toContain("Edit visually. Leave with real code you own.")
    expect(copy).toContain("The source is the product")
    expect(copy).toContain("Documentation")
    expect(copy).toContain("Changelog")
    expect(copy).not.toContain("Launch UI")
    expect(copy).not.toContain("Mikołaj Dobrucki")
    expect(copy.toLowerCase()).not.toContain("dark theme")
    expect(copy.toLowerCase()).not.toContain("color theme")
    expect(copy.toLowerCase()).not.toContain("border radius")
    expect(copy.toLowerCase()).not.toContain("shuffle")
    expect(html).toContain("--brand:#5b5cf0")
    expect(html).not.toContain('https://github.com/launch-ui/launch-ui')
    expect(html).not.toContain('https://twitter.com/mikolajdobrucki')
  })
})
