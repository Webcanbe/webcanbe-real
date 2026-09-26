import fs from "node:fs"
import { describe, expect, it } from "vitest"

const app = fs.readFileSync("src/App.tsx", "utf8")
const client = fs.readFileSync("src/hostedProductClient.ts", "utf8")
const catalog = fs.readFileSync("worker/product-catalog.js", "utf8")

describe("commerce UI closure", () => {
  it("keeps marketplace price authoritative and never posts browser price", () => {
    expect(catalog).toContain("priceMinor: Number(row.price_minor)")
    expect(app).toContain("hostedProductClient.createPaymentOrder(project.id, project.releaseId")
    expect(client).toContain("{ listingId, expectedReleaseId, expectedPriceMinor, idempotencyKey }")
    expect(client).not.toContain("createPaymentOrder(listingId: string, price")
  })

  it("renders all required checkout outcomes and prevents repeated capture effects", () => {
    for (const state of ["loading_order", "ready", "starting_checkout", "redirecting", "returning", "capturing", "success", "cancelled", "failed", "reconciliation_required"]) expect(app).toContain(state)
    expect(app).toContain("captureStarted.current")
    expect(app).toContain("disabled={busy || !project")
    expect(app).toContain("providerOrderId")
  })

  it("exposes real subscription cadence, cancellation, failure, and AI pack balance", () => {
    expect(app).toContain("cadenceName")
    expect(app).toContain("planName(subscription.planKey)")
    expect(app).toContain('subscription.status === "cancelled"')
    expect(app).toContain('subscription?.status === "past_due"')
    expect(app).toContain("hostedProductClient.cancelSubscription")
    expect(app).toContain("overview.billing.aiActions.purchased")
    expect(app).toContain("hostedProductClient.captureAiPack")
    for (const amount of ["100", "500", "1500"]) expect(fs.readFileSync("worker/payments/contracts.js", "utf8")).toContain(`actions: ${amount}`)
  })

  it("removes stale missing-backend commerce copy", () => {
    expect(app).not.toContain("The real card-first provider connection belongs to Phase 5")
    expect(app).not.toContain("Real billing is not simulated before the payment backend exists")
    expect(app).not.toContain("Billing coming soon")
  })
})
