import fs from "node:fs"
import { describe, expect, it } from "vitest"

const app = fs.readFileSync("src/App.tsx", "utf8")

describe("Phase 5 Gate 2 authenticated read smoke", () => {
  it("adds a hidden noindex diagnostic route without expanding product mutation authority", () => {
    expect(app).toContain('const GATE2_AUTH_SMOKE_PATH = "/_ops/gate2-auth-smoke"')
    expect(app).toContain("function Gate2AuthSmoke()")
    expect(app).toContain("else if(basePath===GATE2_AUTH_SMOKE_PATH)page=<Gate2AuthSmoke/>")
    const smoke = app.slice(app.indexOf("function Gate2AuthSmoke()"), app.indexOf("function Checkout()"))
    expect(smoke).toContain("productReadMode()")
    expect(smoke).toContain("productionAuthMode()")
    expect(smoke).not.toContain("productMutationMode()")
    expect(smoke).not.toContain("materialize(")
    expect(smoke).not.toContain("grantTestEntitlementForSelf")
  })

  it("checks the authoritative private read surfaces and public catalog", () => {
    const smoke = app.slice(app.indexOf("function Gate2AuthSmoke()"), app.indexOf("function Checkout()"))
    expect(smoke).toContain("hostedProductClient.account()")
    expect(smoke).toContain("hostedProductClient.workspaces()")
    expect(smoke).toContain("hostedProductClient.purchases()")
    expect(smoke).toContain("hostedProductClient.workspaceProjects()")
    expect(smoke).toContain("hostedProductClient.browse({limit:100})")
    expect(smoke).toContain('label:"Refresh persistence"')
    expect(smoke).toContain('label:"Logout invalidation"')
  })

  it("exercises all three production authentication entry paths without persisting credentials", () => {
    const smoke = app.slice(app.indexOf("function Gate2AuthSmoke()"), app.indexOf("function Checkout()"))
    expect(smoke).toContain("hostedProductClient.authStart()")
    expect(smoke).toContain("signInWithGithubFirebase()")
    expect(smoke).toContain("createEmailAccountFirebase(email,password)")
    expect(smoke).toContain("signInWithEmailFirebase(email,password)")
    expect(smoke).toContain("hostedProductClient.firebaseExchange")
    expect(smoke).toContain("setPassword("")")
    expect(smoke).not.toContain("localStorage.setItem")
  })

  it("keeps raw internal account IDs out of the rendered result copy", () => {
    const smoke = app.slice(app.indexOf("function Gate2AuthSmoke()"), app.indexOf("function Checkout()"))
    expect(smoke).toContain("internal account identifiers are not rendered")
    expect(smoke).not.toContain("{account.userId}")
  })
})
