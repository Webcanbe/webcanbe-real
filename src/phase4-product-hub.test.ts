import fs from "node:fs"
import { describe, expect, it } from "vitest"
const app = fs.readFileSync("src/App.tsx","utf8")
describe("Phase 4 product hub", () => {
  it("keeps projects and purchases separate and uses a native dashboard", () => {
    expect(app).toContain("function Projects()")
    expect(app).toContain("function Purchases()")
    expect(app).toContain("function Dashboard()")
    expect(app).toContain("Continue building")
    expect(app).toContain("Needs attention")
    expect(app).toContain("Recent activity")
    expect(app).not.toContain("ropean-original-dashboard")
  })
  it("keeps the real workspace editor route", () => {
    expect(app).toContain("<CompatibleWorkspace/>")
    expect(app).toContain('basePath.startsWith("/workspace/")')
  })
})
