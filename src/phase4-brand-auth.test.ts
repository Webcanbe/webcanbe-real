import fs from "node:fs"
import { describe, expect, it } from "vitest"

const app = fs.readFileSync("src/App.tsx", "utf8")
const css = fs.readFileSync("src/phase4-brand.css", "utf8")
const main = fs.readFileSync("src/main.tsx", "utf8")

describe("Phase 4 WebCanBe brand and auth UI", () => {
  it("applies one electric-indigo brand layer after the other Phase 4 styles", () => {
    expect(main).toContain('import "./phase4-brand.css"')
    expect(main.indexOf('import "./phase4-brand.css"')).toBeGreaterThan(main.indexOf('import "./phase4-public-flow.css"'))
    expect(css).toContain("--wcb-brand: #5b5cf0")
    expect(css).toContain(".app-sidebar nav a.active")
    expect(css).toContain(".button.primary")
    expect(css).toContain(".workspace-actions .workspace-publish")
  })

  it("uses a shadcn-style split auth surface without inventing password auth", () => {
    expect(app).toContain('className="auth auth-split"')
    expect(app).toContain('className="auth-split-visual"')
    expect(app).toContain('src="/mainline/hero.webp"')
    expect(app).toContain("hostedProductClient.authStart()")
    expect(app).toContain('className="auth-provider-button"')
    expect(app).not.toContain('type="password"')
    expect(css).toContain(".auth.auth-split")
    expect(css).toContain(".auth-visual-frame")
  })
})
