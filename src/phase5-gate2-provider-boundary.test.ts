import fs from "node:fs"
import { describe, expect, it } from "vitest"

const app = fs.readFileSync("src/App.tsx", "utf8")
const script = fs.readFileSync("scripts/launch/gate2-provider-boundary-smoke.mjs", "utf8")
const workflow = fs.readFileSync(".github/workflows/phase5-gate2-provider-boundary-smoke.yml", "utf8")

describe("Phase 5 Gate 2 provider-boundary smoke", () => {
  it("keeps the existing linked-provider UX guard in the production diagnostic", () => {
    expect(app).toContain('disabled={busy||!linkedProviders.includes("GitHub")}')
    expect(app).toContain('getItem(GATE2_LINKED_KEY)')
  })

  it("opens only the GitHub provider boundary and forbids Webcanbe identity writes", () => {
    expect(script).toContain('sessionStorage.setItem("wcb-gate2-linked-providers"')
    expect(script).toContain('getByRole("button", { name: "Test linked GitHub" })')
    expect(script).toContain('host === "github.com" || host.endsWith(".github.com")')
    expect(script).toContain('"/__webcanbe/auth/firebase-exchange"')
    expect(script).toContain('"/__webcanbe/api/account/identities/link/firebase"')
    expect(script).toContain("forbiddenRequests.length === 0")
    expect(script).toContain('"__Host-wcb-session"')
    expect(script).toContain("await popup.close()")
    expect(script).toContain("failedResponses.push")
    expect(script).toContain("url.origin}${url.pathname}")
    expect(script).not.toContain("url.search")
    expect(script).toContain("return url.origin + url.pathname")
    expect(script).toContain("redactedUrl(providerUrl)")
    expect(script).toContain("INFO  Firebase authDomain init helper")
    expect(script).not.toContain("Firebase authDomain init config resolves")
  })

  it("uses a pinned credential-free Playwright workflow against production", () => {
    expect(workflow).toContain("mcr.microsoft.com/playwright:v1.56.1-noble")
    expect(workflow).toContain("playwright@1.56.1")
    expect(workflow).toContain("WEBCANBE_GATE2_ORIGIN: https://webcanbe.com")
    expect(workflow).toContain("node scripts/launch/gate2-provider-boundary-smoke.mjs")
    expect(workflow).not.toContain("secrets.")
    expect(workflow).toContain("phase5-gate2-provider-boundary-smoke")
  })
})
