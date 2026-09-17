import fs from "node:fs"
import { describe, expect, it } from "vitest"

describe("Phase 4 live Launch UI landing", () => {
  it("renders the live Launch UI homepage unchanged at the public root", () => {
    const home = fs.readFileSync("src/Home.tsx", "utf8")
    const app = fs.readFileSync("src/App.tsx", "utf8")

    expect(home).toContain('src="https://www.launchuicomponents.com/"')
    expect(home).toContain('width: "100vw"')
    expect(home).toContain('height: "100vh"')
    expect(home).not.toContain("WebCanBe")
    expect(home).not.toContain("landing.module.css")

    for (const productRoute of [
      "/browse", "/project/", "/login", "/signup", "/workspace/",
      "/projects", "/dashboard", "/settings", "/plans", "/seller",
    ]) expect(app).toContain(productRoute)
  })
})
