import fs from "node:fs"
import { describe, expect, it } from "vitest"

const app = fs.readFileSync("src/App.tsx", "utf8")
const css = fs.readFileSync("src/phase4-final-ui.css", "utf8")

describe("Phase 5 auth brand marks and loading spinner", () => {
  it("uses real Google and GitHub brand mark SVGs in the auth modal", () => {
    expect(app).toContain("function GoogleBrandMark()")
    expect(app).toContain('fill="#4285F4"')
    expect(app).toContain('fill="#34A853"')
    expect(app).toContain('fill="#FBBC05"')
    expect(app).toContain('fill="#EA4335"')
    expect(app).toContain("function GitHubBrandMark()")
    expect(app).toContain('className="auth-provider-brand auth-provider-github"')
    expect(app).toContain("<GoogleBrandMark/>")
    expect(app).toContain("<GitHubBrandMark/>")
    expect(app).not.toContain('<span className="google-g">G</span>')
    expect(app).not.toContain("<Github/>")
  })

  it("replaces the route top bar with a centered translucent gray circular spinner", () => {
    expect(css).toContain("html.wcb-route-leaving body::before")
    expect(css).toContain("top:50%")
    expect(css).toContain("left:50%")
    expect(css).toContain("border-radius:999px")
    expect(css).toContain("rgba(91,92,100,.16)")
    expect(css).toContain("rgba(91,92,100,.62)")
    expect(css).toContain("wcb-spinner-rotate")
    expect(css).not.toContain("wcb-route-line")
  })

  it("uses the same spinner family for session checking and auth busy state", () => {
    expect(app).toContain("<LoadingSpinner/>")
    expect(app).toContain("<LoadingSpinner small/>")
    expect(app).toContain("Checking your session…")
    expect(css).toContain(".wcb-spinner")
    expect(css).toContain(".wcb-spinner-small")
    expect(css).toContain(".route-gate .wcb-spinner")
  })
})
