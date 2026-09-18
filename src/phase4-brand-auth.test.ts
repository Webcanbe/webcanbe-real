import fs from "node:fs"
import { describe, expect, it } from "vitest"
const app = fs.readFileSync("src/App.tsx","utf8")
const css = fs.readFileSync("src/phase4-final-ui.css","utf8")
const main = fs.readFileSync("src/main.tsx","utf8")
describe("Phase 4 final UI", () => {
  it("loads the final UI layer last", () => {
    expect(main).toContain('import "./phase4-final-ui.css"')
    expect(main.indexOf('import "./phase4-final-ui.css"')).toBeGreaterThan(main.indexOf('import "./phase4-brand.css"'))
  })
  it("keeps the static ChatGPT-style English auth modal", () => {
    expect(app).toContain('className="auth-demo-layer"')
    expect(app).toContain("Log in or sign up")
    expect(app).toContain("Continue with Google")
    expect(app).toContain("Continue with GitHub")
    expect(app).toContain("Continue with phone")
    expect(app).not.toContain('type="password"')
    expect(css).toContain(".auth-demo-modal")
  })
  it("temporarily shows the exact Ropean dashboard during UI finalization", () => {
    expect(app).toContain('src="https://shadcn-admin-template.ropean.org/"')
    expect(app).toContain('className="ropean-original-dashboard"')
  })
  it("keeps working documentation and footer routes", () => {
    for (const route of ["/docs","/docs/getting-started","/docs/customization","/docs/visual-editor","/docs/code-editor","/docs/export","/docs/compatibility","/docs/security","/changelog","/about","/contact","/updates","/licenses","/terms","/privacy"]) expect(app).toContain(route)
  })
})
