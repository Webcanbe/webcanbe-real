import fs from "node:fs"
import { describe, expect, it } from "vitest"

describe("Phase 4 WebCanBe landing", () => {
  it("uses the local editable landing and preserves product routes", () => {
    const home = fs.readFileSync("src/Home.tsx", "utf8")
    const app = fs.readFileSync("src/App.tsx", "utf8")
    expect(home).toContain('src="/wcb-landing/index.html"')
    expect(home).toContain('title="WebCanBe"')
    for (const route of ["/browse", "/project/", "/login", "/signup", "/workspace/", "/projects", "/dashboard", "/settings", "/plans", "/seller"]) expect(app).toContain(route)
  })
})
