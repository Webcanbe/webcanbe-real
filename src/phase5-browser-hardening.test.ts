import fs from "node:fs"
import { describe, expect, it } from "vitest"

const app = fs.readFileSync("src/App.tsx", "utf8")
const script = fs.readFileSync("scripts/launch/browser-smoke.mjs", "utf8")
const workflow = fs.readFileSync(".github/workflows/phase5-browser-compat-smoke.yml", "utf8")

describe("Phase 5 browser launch hardening", () => {
  it("makes auth and session-loading states explicitly accessible", () => {
    expect(app).toContain('role="status" aria-live="polite" aria-busy="true"')
    expect(app).toContain('aria-labelledby="wcb-auth-title"')
    expect(app).toContain('id="wcb-auth-title"')
    expect(app).toContain('aria-label="Close sign-in"')
    expect(app).toContain('aria-label={emailStep?"Password":"Email address"}')
    expect(app).toContain('className="auth-demo-error" role="alert"')
  })

  it("clips vendor carousel overflow at the landing host boundary", () => {
    const css = fs.readFileSync("src/phase4-final-ui.css", "utf8")
    expect(css).toContain(".landing-react-host{min-height:100vh;width:100%;max-width:100vw;min-width:0;overflow-x:clip;background:#fff}")
  })
  it("repairs injected landing controls without rewriting the vendor document", () => {
    const home = fs.readFileSync("src/Home.tsx", "utf8")
    expect(home).toContain("function hardenLandingAccessibility")
    expect(home).toContain('button[data-slot="sheet-trigger"]')
    expect(home).toContain('button.setAttribute("aria-label", "Open navigation")')
    expect(home).toContain('button[data-slot="slide-button"]')
    expect(home).toContain('button.setAttribute("aria-hidden", "true")')
    expect(home).toContain("button.tabIndex = -1")
    expect(home).toContain("hardenLandingAccessibility(host.current)")
  })

  it("runs production smoke in all three major browser engines", () => {
    expect(script).toContain('["chromium", chromium]')
    expect(script).toContain('["firefox", firefox]')
    expect(script).toContain('["webkit", webkit]')
    expect(script).toContain('["desktop", { width: 1440, height: 900 }]')
    expect(script).toContain('["mobile", { width: 390, height: 844 }]')
  })

  it("checks responsive overflow, keyboard focus, accessible names, JS exceptions and a launch timing budget", () => {
    expect(script).toContain("has no meaningful horizontal overflow")
    expect(script).toContain('button:not([disabled]):not([aria-hidden="true"])')
    expect(script).toContain('waitForSelector("h1"')
    expect(script).toContain("buttons have accessible names")
    expect(script).toContain("fields have accessible names")
    expect(script).toContain("accepts keyboard focus")
    expect(script).toContain("has no uncaught page error")
    expect(script).toContain("DCL stays within launch budget")
  })

  it("locks the truthful auth and pre-payment UI in real browsers", () => {
    expect(script).toContain("login uses Google SVG mark")
    expect(script).toContain("login uses GitHub SVG mark")
    expect(script).toContain("unavailable phone login is disabled")
    expect(script).toContain("paid plans stay disabled")
    expect(script).toContain("plans explain billing state")
  })

  it("enforces deterministic production build-size budgets", () => {
    const budget = fs.readFileSync("scripts/launch/build-budget.mjs", "utf8")
    expect(budget).toContain("15 * 1024 * 1024")
    expect(budget).toContain("2 * 1024 * 1024")
    expect(budget).toContain("700 * 1024")
    expect(budget).toContain("500 * 1024")
    expect(budget).toContain("appCssTotal: 180 * 1024")
    expect(budget).toContain("300 * 1024")
    expect(budget).toContain("production source maps")
  })

  it("pins the Playwright runtime and runs on main", () => {
    expect(workflow).toContain("mcr.microsoft.com/playwright:v1.56.1-noble")
    expect(workflow).toContain("playwright@1.56.1")
    expect(workflow).toContain("HOME: /root")
    expect(workflow).toContain('workflows: ["Phase 5 production smoke"]')
    expect(workflow).toContain("branches: [main]")
    expect(workflow).toContain("github.event.workflow_run.conclusion == 'success'")
    expect(workflow).toContain("github.event.workflow_run.head_sha || github.sha")
    expect(workflow).not.toContain("for attempt")
    expect(workflow).not.toContain("sleep 20")
    expect(workflow).toContain("node scripts/launch/browser-smoke.mjs")
  })
})
