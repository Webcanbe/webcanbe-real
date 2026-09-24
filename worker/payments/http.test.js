import { describe, expect, it } from "vitest"
import { PAYMENT_RETURN_URLS, handlePrivatePaymentRequest, publicPaymentConfiguration } from "./http.js"
import { PaymentError } from "./contracts.js"

describe("payment HTTP contract", () => {
  it("refuses new plan and AI pack checkouts while preserving other payment routes", async () => {
    const repo = { insertSubscription: () => { throw new Error("must not write") }, insertAiPackOrder: () => { throw new Error("must not write") } }
    const provider = { createSubscription: () => { throw new Error("must not call PayPal") }, createOrder: () => { throw new Error("must not call PayPal") } }
    for (const [path, code] of [["subscriptions/create", "subscriptions_preparing"], ["ai-packs/create", "ai_packs_preparing"]]) {
      const route = `/__webcanbe/api/payments/${path}`
      const response = await handlePrivatePaymentRequest(new Request(`https://webcanbe.com${route}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }), route, { repo, provider, session: { userId: "buyer" }, env: { PAYPAL_ENVIRONMENT: "live" } })
      expect(response.status).toBe(503)
      expect((await response.json()).code).toBe(code)
    }
  })
  it("verifies every configured Live plan with the runtime provider without creating subscriptions", async () => {
    const prices = { pro_monthly: ["MONTH", "12.00"], pro_annual: ["YEAR", "120.00"], studio_monthly: ["MONTH", "29.00"], studio_annual: ["YEAR", "290.00"] }
    const keys = { PAYPAL_PLAN_PRO_MONTHLY: "P-PM", PAYPAL_PLAN_PRO_ANNUAL: "P-PA", PAYPAL_PLAN_STUDIO_MONTHLY: "P-SM", PAYPAL_PLAN_STUDIO_ANNUAL: "P-SA" }
    const byId = Object.fromEntries(Object.entries(keys).map(([key, id]) => [id, key.replace("PAYPAL_PLAN_", "").toLowerCase()]))
    const queried = []
    const provider = { getPlan: async id => { queried.push(id); const [unit, value] = prices[byId[id]]; return { id, status: "ACTIVE", billing_cycles: [{ tenure_type: "REGULAR", frequency: { interval_unit: unit, interval_count: 1 }, pricing_scheme: { fixed_price: { currency_code: "USD", value } } }] } } }
    const path = "/__webcanbe/api/payments/plans/verify"
    const response = await handlePrivatePaymentRequest(new Request(`https://webcanbe.com${path}`, { method: "POST" }), path, { repo: {}, provider, session: { userId: "buyer" }, env: { PAYPAL_ENVIRONMENT: "live", ...keys } })
    expect(response.status).toBe(200)
    const result = await response.json()
    expect(result.environment).toBe("live")
    expect(result.plans).toEqual(expect.arrayContaining([
      { key: "pro_monthly", providerPlanId: "P-PM", status: "ACTIVE", currency: "USD", priceMinor: 1200, cadence: "month", contractMatches: true },
      { key: "studio_annual", providerPlanId: "P-SA", status: "ACTIVE", currency: "USD", priceMinor: 29000, cadence: "year", contractMatches: true },
    ]))
    expect(queried).toHaveLength(4)
    expect(JSON.stringify(result)).not.toContain("secret")
  })

  it("refuses an inactive or mispriced Live plan and any sandbox audit", async () => {
    const path = "/__webcanbe/api/payments/plans/verify"
    const request = new Request(`https://webcanbe.com${path}`, { method: "POST" })
    const env = { PAYPAL_ENVIRONMENT: "live", PAYPAL_PLAN_PRO_MONTHLY: "P-PM", PAYPAL_PLAN_PRO_ANNUAL: "P-PA", PAYPAL_PLAN_STUDIO_MONTHLY: "P-SM", PAYPAL_PLAN_STUDIO_ANNUAL: "P-SA" }
    const provider = { getPlan: async id => ({ id, status: "INACTIVE", billing_cycles: [] }) }
    expect((await handlePrivatePaymentRequest(request.clone(), path, { repo: {}, provider, session: { userId: "buyer" }, env })).status).toBe(409)
    expect((await handlePrivatePaymentRequest(request, path, { repo: {}, provider, session: { userId: "buyer" }, env: { ...env, PAYPAL_ENVIRONMENT: "sandbox" } })).status).toBe(409)
  })
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
    expect(await response.json()).toEqual({ billing: { currentPlanKey: "free", subscription: { subscriptionId: "11111111-1111-4111-8111-111111111111", planKey: "pro_annual", status: "past_due", createdAt: "2026-09-01T00:00:00.000Z", failedAt: "2026-09-21T00:00:00.000Z" }, aiActions: { purchased: 487 } } })
  })
  it.each(["creating", "approval_pending", "past_due", "cancelled", "expired", "active"])("reports the authoritative current plan for %s", async status => {
    const repo = {
      currentSubscriptionForUser: async () => ({ subscriptionId: "11111111-1111-4111-8111-111111111111", planKey: "studio_annual", status, createdAt: "2026-09-01T00:00:00Z" }),
      aiActionBalanceForUser: async () => ({ purchased: 100 }),
    }
    const response = await handlePrivatePaymentRequest(new Request("https://webcanbe.com/__webcanbe/api/payments/status", { method: "POST" }), "/__webcanbe/api/payments/status", { repo, provider: {}, session: { userId: "buyer" }, env: {} })
    const { billing } = await response.json()
    expect(billing.currentPlanKey).toBe(status === "active" ? "studio_annual" : "free")
    expect(billing.subscription).toMatchObject({ planKey: "studio_annual", status })
    expect(billing.aiActions.purchased).toBe(100)
  })

  it("preserves paid plan access through a cancelled subscription's recorded period end", async () => {
    const repo = {
      currentSubscriptionForUser: async () => ({ subscriptionId: "11111111-1111-4111-8111-111111111111", planKey: "pro_monthly", status: "cancelled", createdAt: "2026-09-01T00:00:00Z", cancelledAt: "2026-09-20T00:00:00Z", currentPeriodEnd: "2026-10-01T00:00:00Z" }),
      aiActionBalanceForUser: async () => ({ purchased: 0 }),
    }
    const before = await handlePrivatePaymentRequest(new Request("https://webcanbe.com/__webcanbe/api/payments/status", { method: "POST" }), "/__webcanbe/api/payments/status", { repo, provider: {}, session: { userId: "buyer" }, env: {}, clock: () => Date.parse("2026-09-23T00:00:00Z") })
    expect((await before.json()).billing.currentPlanKey).toBe("pro_monthly")
    const after = await handlePrivatePaymentRequest(new Request("https://webcanbe.com/__webcanbe/api/payments/status", { method: "POST" }), "/__webcanbe/api/payments/status", { repo, provider: {}, session: { userId: "buyer" }, env: {}, clock: () => Date.parse("2026-10-01T00:00:00Z") })
    expect((await after.json()).billing.currentPlanKey).toBe("free")
  })

  it("checks only the owner's PayPal subscription and returns safe status fields", async () => {
    const id = "11111111-1111-4111-8111-111111111111"
    const subscription = { subscriptionId: id, userId: "buyer", providerSubscriptionId: "I-PAYPAL", providerPlanId: "P-EXPECTED" }
    let calls = 0
    const provider = { getSubscription: async () => { calls++; return { id: "I-PAYPAL", custom_id: id, plan_id: "P-EXPECTED", status: "APPROVAL_PENDING", subscriber: { email_address: "private@example.com" }, billing_info: { last_failed_payment: { reason_code: "PAYMENT_DENIED" } } } } }
    const request = new Request("https://webcanbe.com/__webcanbe/api/payments/subscriptions/inspect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscriptionId: id }) })
    const denied = await handlePrivatePaymentRequest(request.clone(), "/__webcanbe/api/payments/subscriptions/inspect", { repo: { subscriptionById: async () => subscription }, provider, session: { userId: "other" }, env: {} })
    expect(denied.status).toBe(404)
    expect(calls).toBe(0)
    const allowed = await handlePrivatePaymentRequest(request, "/__webcanbe/api/payments/subscriptions/inspect", { repo: { subscriptionById: async () => subscription }, provider, session: { userId: "buyer" }, env: {} })
    expect(await allowed.json()).toEqual({ provider: { status: "APPROVAL_PENDING", planMatches: true, referenceMatches: true, lastFailedReason: "PAYMENT_DENIED" } })
  })

  it("reports an unverifiable provider ID without mutating the pending subscription", async () => {
    const id = "11111111-1111-4111-8111-111111111111"
    const subscription = { subscriptionId: id, userId: "buyer", providerSubscriptionId: "I-PAYPAL", providerPlanId: "P-EXPECTED", status: "approval_pending" }
    const provider = { getSubscription: async () => { const error = new PaymentError(409, "paypal_request_failed", "Provider error"); Object.assign(error, { providerHttpStatus: 404, providerName: "RESOURCE_NOT_FOUND", providerIssue: "INVALID_RESOURCE_ID" }); throw error } }
    const repo = { subscriptionById: async () => subscription, markSubscriptionForReconciliation: () => { throw new Error("Inspection must be read only") } }
    const request = new Request("https://webcanbe.com/__webcanbe/api/payments/subscriptions/inspect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscriptionId: id }) })
    const response = await handlePrivatePaymentRequest(request, "/__webcanbe/api/payments/subscriptions/inspect", { repo, provider, session: { userId: "buyer" }, env: {} })
    expect(await response.json()).toEqual({ provider: { status: "PROVIDER_NOT_FOUND", planMatches: false, referenceMatches: false, message: "PayPal cannot find this subscription in the configured merchant environment. Billing review is needed before another checkout." } })
    expect(subscription.status).toBe("approval_pending")
  })
})
