import fs from "node:fs"
import { describe, expect, it } from "vitest"

describe("Phase 4 live Launch UI landing mirror", () => {
  it("uses the live Launch UI homepage snapshot at the public root", () => {
    const home = fs.readFileSync("src/Home.tsx", "utf8")
    const page = fs.readFileSync("public/launch-ui-live/index.html", "utf8")
    const source = fs.readFileSync("public/launch-ui-live/live-source.html", "utf8")
    const app = fs.readFileSync("src/App.tsx", "utf8")

    expect(home).toContain('src="/launch-ui-live/index.html"')
    for (const marker of [
      "Give your big idea the design it deserves",
      "It's all about design quality",
      "Everything you need. Nothing you don't.",
      "What's inside?",
    ]) expect(source).toContain(marker)

    expect(page.length).toBeGreaterThan(50000)
    expect(page).not.toContain("<script")
    for (const productRoute of ["/browse", "/project/", "/login", "/signup", "/workspace/", "/projects", "/dashboard", "/settings", "/plans", "/seller"]) expect(app).toContain(productRoute)
  })
})
