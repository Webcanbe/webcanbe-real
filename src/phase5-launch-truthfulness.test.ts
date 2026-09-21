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
    const dashboard = app.slice(app.indexOf("function Dashboard()"), app.indexOf("function Settings()"))
    expect(dashboard).toContain("Profile data is backed by the production account store.")
    expect(dashboard).toContain("Verified sign-in methods and active Webcanbe sessions are backed by the production account store")
    expect(dashboard).not.toContain("Full editable profile fields will use the account backend when that phase is connected.")
    expect(dashboard).not.toContain("Additional account controls will connect to the production account store.")
    expect(dashboard).not.toContain("Google sign-in is active.")
  })

  it("does not present paid plans as purchasable before billing activation", () => {
    const plans = app.slice(app.indexOf("function Plans()"), app.indexOf("function CreatorListingEditor"))
    expect(plans).toContain("Paid billing is not active yet")
    expect(plans).toContain("configured launch prices and limits")
    expect(plans).toContain("Annual preview")
    expect(plans).toContain("Coming soon")
    expect(plans).toContain('disabled={plan.id !== "free"}')
    expect(plans).toContain("Billing coming soon")
    expect(plans).not.toContain("Most chosen")
    expect(plans).not.toContain("Choose ${p.name}")
  })

  it("reads public plan values from the single launch catalog", async () => {
    const catalog = await import("./webcanbe-engine/runtime/planCatalog")
    expect(catalog.PUBLIC_PLAN_CATALOG).toEqual([
      expect.objectContaining({ id: "free", monthlyPriceUsd: 0, annualPriceUsd: 0, activeProjects: 3, includedAiActionsMonthly: 20, aiConcurrency: 1, deploySlots: 1 }),
      expect.objectContaining({ id: "pro", monthlyPriceUsd: 12, annualPriceUsd: 120, activeProjects: 20, includedAiActionsMonthly: 300, aiConcurrency: 2, deploySlots: 5 }),
      expect.objectContaining({ id: "studio", monthlyPriceUsd: 29, annualPriceUsd: 290, activeProjects: 100, includedAiActionsMonthly: 1000, aiConcurrency: 4, deploySlots: 20 }),
    ])
    expect(catalog.AI_ACTION_ADD_ONS).toEqual([{ actions: 100, priceUsd: 5 }, { actions: 500, priceUsd: 15 }, { actions: 1500, priceUsd: 35 }])
    expect(catalog.MARKETPLACE_POLICY).toEqual({ minimumPaidPriceUsd: 9, freeListingsAllowed: true })
  })

  it("gives hosted marketplace failures and empty catalog results an actionable state", () => {
    const browse = app.slice(app.indexOf("function Browse()"), app.indexOf("function projectStructure"))
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
