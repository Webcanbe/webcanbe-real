import fs from "node:fs"
import { describe, expect, it } from "vitest"

describe("Phase 4 landing retention contract", () => {
  it("retains Launch UI sections while using WebCanBe copy and marketplace routing", () => {
    const html = fs.readFileSync("public/wcb-landing/index.html", "utf8")
    const copy = fs.readFileSync("public/wcb-landing/copy.txt", "utf8")
    for (const kept of [
      "Documentation",
      "Getting started",
      "Customization",
      "Visual editor",
      "Marketplace projects",
      "Questions about ownership",
      "Choose how you want to work",
      "Everything edits the same source.",
    ]) expect(copy).toContain(kept)

    expect(copy).toContain("Edit visually. Leave with real code you own.")
    expect(copy).not.toContain("Color theme")
    expect(copy).not.toContain("Border radius")
    expect(copy).not.toContain("Shuffle")
    expect(html).toContain('href="/browse"')
    expect(html).toContain("mounted")
  })
})
