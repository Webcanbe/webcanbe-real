import { describe, expect, it } from "vitest"
import { PAYMENT_RETURN_URLS, handlePrivatePaymentRequest, publicPaymentConfiguration } from "./http.js"

describe("payment HTTP contract", () => {
  it("publishes the locked concurrency and deploy-slot entitlements", () => {
    const configuration = publicPaymentConfiguration()
    const plans = Object.fromEntries(configuration.plans.map(plan => [plan.key, plan]))

    expect(plans.free).toMatchObject({ aiConcurrency: 1, deploySlots: 1 })
    expect(plans.pro_monthly).toMatchObject({ aiConcurrency: 2, deploySlots: 5 })
    expect(plans.pro_annual).toMatchObject({ aiConcurrency: 2, deploySlots: 5 })
    expect(plans.studio_monthly).toMatchObject({ aiConcurrency: 4, deploySlots: 20 })
    expect(plans.studio_annual).toMatchObject({ aiConcurrency: 4, deploySlots: 20 })
    expect(configuration.marketplace).toEqual({ minimumPaidListingMinor: 900, freeListingsAllowed: true })
  })

  it("only redirects PayPal flows to routes present in the application", () => {
    expect(PAYMENT_RETURN_URLS).toEqual({
      marketplaceReturn: "https://webcanbe.com/checkout/return?payment=return",
      marketplaceCancel: "https://webcanbe.com/checkout/return?payment=cancelled",
      subscriptionReturn: "https://webcanbe.com/settings?subscription=return",
      subscriptionCancel: "https://webcanbe.com/settings?subscription=cancelled",
      aiPackReturn: "https://webcanbe.com/settings?ai-pack=return",
      aiPackCancel: "https://webcanbe.com/settings?ai-pack=cancelled",
    })
  })

  it("returns only the signed-in user's billing summary and purchased balance", async () => {
    const repo = {
      currentSubscriptionForUser: async userId => ({ subscriptionId: "11111111-1111-4111-8111-111111111111", userId, planKey: "pro_annual", providerPlanId: "secret-plan", idempotencyKey: "secret-key", status: "past_due", createdAt: "2026-09-01T00:00:00.000Z", failedAt: "2026-09-21T00:00:00.000Z" }),
      aiActionBalanceForUser: async () => ({ purchased: 487 }),
    }
    const response = await handlePrivatePaymentRequest(new Request("https://webcanbe.com/__webcanbe/api/payments/status", { method: "POST" }), "/__webcanbe/api/payments/status", { repo, provider: {}, session: { userId: "buyer" }, env: {} })
    expect(await response.json()).toEqual({ billing: { currentPlanKey: "pro_annual", subscription: { subscriptionId: "11111111-1111-4111-8111-111111111111", planKey: "pro_annual", status: "past_due", createdAt: "2026-09-01T00:00:00.000Z", failedAt: "2026-09-21T00:00:00.000Z" }, aiActions: { purchased: 487 } } })
  })
})
