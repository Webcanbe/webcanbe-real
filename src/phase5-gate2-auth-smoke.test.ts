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

  it("links Firebase identities to the current first-party account before provider login smoke", () => {
    const smoke = app.slice(app.indexOf("function Gate2AuthSmoke()"), app.indexOf("function Checkout()"))
    expect(smoke).toContain("hostedProductClient.authStart()")
    expect(smoke).toContain("signInWithGithubFirebase()")
    expect(smoke).toContain("createEmailAccountFirebase(email,password)")
    expect(smoke).toContain("signInWithEmailFirebase(email,password)")
    expect(smoke).toContain("hostedProductClient.linkFirebaseIdentity")
    expect(smoke).toContain("hostedProductClient.firebaseExchange")
    expect(smoke).toContain("Sign in with Google first before linking GitHub.")
    expect(smoke).toContain("Sign in with Google first before linking Email.")
    expect(smoke).toContain("prevents accidental creation of a second Webcanbe internal account")
    expect(smoke).toContain('disabled={busy||!linkedProviders.includes("GitHub")}')
    expect(smoke).toContain('disabled={busy||!email||!password||!linkedProviders.includes("Email")}')
    expect(smoke).toContain("GATE2_LINKED_KEY")
    expect(smoke).toContain('setPassword("")')
    expect(smoke).not.toContain("localStorage.setItem")
  })

  it("keeps raw internal account IDs out of the rendered result copy", () => {
    const smoke = app.slice(app.indexOf("function Gate2AuthSmoke()"), app.indexOf("function Checkout()"))
    expect(smoke).toContain("internal account identifiers are not rendered")
    expect(smoke).not.toContain("{account.userId}")
  })
})
