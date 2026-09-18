import fs from "node:fs"
import { describe, expect, it } from "vitest"

const app = fs.readFileSync("src/App.tsx", "utf8")
const css = fs.readFileSync("src/phase4-final-ui.css", "utf8")
const main = fs.readFileSync("src/main.tsx", "utf8")

describe("Phase 4 final UI", () => {
  it("loads the final UI layer last", () => {
    expect(main).toContain('import "./phase4-final-ui.css"')
    expect(main.indexOf('import "./phase4-final-ui.css"')).toBeGreaterThan(main.indexOf('import "./phase4-brand.css"'))
  })

  it("uses a static ChatGPT-style English auth modal", () => {
    expect(app).toContain('className="auth auth-demo"')
    expect(app).toContain("Log in or sign up")
    expect(app).toContain("Continue with Google")
    expect(app).toContain("Continue with GitHub")
    expect(app).toContain("Continue with phone")
    expect(app).toContain("Email address")
    expect(app).not.toContain('type="password"')
    expect(css).toContain(".auth-demo-modal")
  })

  it("uses an always-open Ropean-style sidebar and dashboard shell", () => {
    expect(app).toContain("<details open")
    expect(app).toContain("Source-first workspace")
    expect(app).toContain("rope-metric-grid")
    expect(css).toContain(".rope-sidebar")
    expect(css).toContain("--final-accent:#5b5cf0")
  })

  it("adds working documentation and footer routes", () => {
    for (const route of ["/docs","/docs/getting-started","/docs/customization","/docs/visual-editor","/docs/code-editor","/docs/export","/docs/compatibility","/docs/security","/changelog","/about","/contact","/updates","/licenses","/terms","/privacy"]) expect(app).toContain(route)
  })
})
