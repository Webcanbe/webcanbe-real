import fs from "node:fs"
import { describe, expect, it } from "vitest"

const app = fs.readFileSync("src/App.tsx", "utf8")

describe("Phase 5 launch truthfulness cleanup", () => {
  it("never maps unavailable phone sign-in to another provider", () => {
    const auth = app.slice(app.indexOf("function Auth("), app.indexOf("const docPages"))
    expect(auth).toContain('title="Phone sign-in is not connected yet"')
    expect(auth).toContain('<button className="auth-demo-provider" disabled title="Phone sign-in is not connected yet">')
    expect(auth).not.toContain("phonePending")
    const phoneButton = auth.slice(auth.indexOf('title="Phone sign-in is not connected yet"') - 120, auth.indexOf('title="Phone sign-in is not connected yet"') + 240)
    expect(phoneButton).not.toContain("runGoogle")
  })

  it("removes stale account-backend copy from the dashboard", () => {
    const dashboard = app.slice(app.indexOf("function Dashboard("), app.indexOf("function Settings()"))
    expect(app).toContain("hostedProductClient.updateAccount(name.trim())")
    expect(app).toContain("account.providers?.join")
    expect(app).toContain("account.activeSessions")
    expect(dashboard).not.toContain("Full editable profile fields will use the account backend when that phase is connected.")
    expect(dashboard).not.toContain("Additional account controls will connect to the production account store.")
    expect(dashboard).not.toContain("Google sign-in is active.")
  })

  it("enables paid plans only when the payment service says checkout is available", () => {
    const plans = app.slice(app.indexOf("function Plans()"), app.indexOf("function CreatorListingEditor"))
    expect(plans).toContain("Paid checkout is currently unavailable")
    expect(plans).toContain("configuration.checkoutAvailable")
    expect(plans).toContain(">Annual<")
    expect(plans).toContain("Checkout unavailable")
    expect(plans).toContain("hostedProductClient.createSubscription")
    expect(plans).not.toContain("Most chosen")
    expect(plans).toContain("Choose ${row.name}")
  })

  it("reads public plan values from the authoritative payment endpoint", () => {
    const catalog = fs.readFileSync("src/webcanbe-engine/runtime/planCatalog.ts", "utf8")
    expect(catalog).toContain('fetcher("/__webcanbe/api/payments/config"')
    expect(app).toContain("loadPublicPaymentConfiguration()")
    expect(catalog).not.toContain("PUBLIC_PLAN_CATALOG")
    expect(catalog).not.toContain("AI_ACTION_ADD_ONS")
  })

  it("gives hosted marketplace failures and empty catalog results an actionable state", () => {
    const browse = app.slice(app.indexOf("function Browse("), app.indexOf("function projectStructure"))
    const detail = app.slice(app.indexOf("function Detail("), app.indexOf("function ProjectPreviewPage"))
    expect(browse).toContain("Marketplace is unavailable")
    expect(browse).toContain("No matching projects")
    expect(browse).toContain("Try again")
    expect(detail).toContain("This project is unavailable")
    expect(detail).toContain("Back to marketplace")
  })

  it("keeps the public update page aligned with current launch closure", () => {
    expect(app).toContain("Launch closure is in progress: production reads are live")
    expect(app).not.toContain("Phase 4 UI finalization is in progress.")
  })
})
