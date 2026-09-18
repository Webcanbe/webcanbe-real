import fs from "node:fs"
import { describe, expect, it } from "vitest"
const app = fs.readFileSync("src/App.tsx","utf8")
const home = fs.readFileSync("src/Home.tsx","utf8")
const landing = fs.readFileSync("public/wcb-landing/index.html","utf8")
describe("Phase 4 unified shell", () => {
  it("keeps one navigation system for landing and product routes", () => {
    expect(home).toContain("onNavigate")
    expect(app).toContain('["Product", "/docs/visual-editor"]')
    expect(app).toContain('["Marketplace", "/browse"]')
    expect(app).toContain('["Learn", "/docs"]')
    expect(app).toContain('["Resources", "/changelog"]')
    expect(landing).not.toContain('id="wcb-auth-bridge"')
  })
  it("has working shell controls instead of decorative buttons", () => {
    expect(app).toContain("setCollapsed")
    expect(app).toContain("setPalette")
    expect(app).toContain('aria-label="Notifications"')
    expect(app).toContain("Sign out")
    expect(app).toContain("function NotFound")
  })
  it("removes known stale landing destinations", () => {
    expect(landing).not.toContain("designwithcode.dev")
    expect(landing).not.toContain("contact@mikolajdobrucki.com")
    expect(landing).not.toContain('href="/pricing"')
    expect(landing).not.toContain('href="/feedback-program"')
    expect(landing).not.toContain('href="#"')
  })
})
