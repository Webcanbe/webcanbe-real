import fs from "node:fs"
import { describe, expect, it } from "vitest"
const app = fs.readFileSync("src/App.tsx","utf8")
const home = fs.readFileSync("src/Home.tsx","utf8")
describe("Phase 4 brand and auth shell", () => {
  it("uses native Webcanbe dashboard and landing routes without external iframes", () => {
    expect(app).toContain("function Dashboard()")
    expect(app).toContain("function RopeanDashboardShell")
    expect(app).not.toContain("shadcn-admin-template.ropean.org")
    expect(home).toContain('fetch("/wcb-landing/index.html"')
    expect(home).not.toContain("<iframe")
  })
  it("gates private routes and signs out to the landing page", () => {
    expect(app).toContain('go("/login?next="')
    expect(app).toContain('sessionStorage.removeItem("wcb-demo-auth")')
    expect(app).toContain('go("/")')
  })
})
