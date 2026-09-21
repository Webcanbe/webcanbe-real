import { describe, expect, it } from "vitest"
import { PAYMENT_RETURN_URLS, publicPaymentConfiguration } from "./http.js"

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
      marketplaceReturn: "https://webcanbe.com/purchases?payment=return",
      marketplaceCancel: "https://webcanbe.com/browse?payment=cancelled",
      subscriptionReturn: "https://webcanbe.com/settings?subscription=return",
      subscriptionCancel: "https://webcanbe.com/settings?subscription=cancelled",
      aiPackReturn: "https://webcanbe.com/settings?ai-pack=return",
      aiPackCancel: "https://webcanbe.com/settings?ai-pack=cancelled",
    })
  })
})
