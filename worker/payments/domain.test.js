import { describe, expect, it } from "vitest"
import { PAYMENT_CURRENCY, PaymentError } from "./contracts.js"
import {
  applyCaptureWebhook,
  applyDispute,
  applyRefund,
  applySubscriptionEvent,
  buildPayoutBatch,
  captureMarketplaceOrder,
  createMarketplaceOrder,
  createPlanSubscription,
  reconcileManualPayout,
  reconcileMonthlySubscriptionGrant,
  recordVerifiedWebhook,
} from "./domain.js"
import { handlePayPalWebhook, processPayPalEvent } from "./webhook.js"
import { captureAiPackOrder, createAiPackOrder } from "./ai-packs.js"

const buyer = "11111111-1111-4111-8111-111111111111"
const otherBuyer = "22222222-2222-4222-8222-222222222222"
const seller = "33333333-3333-4333-8333-333333333333"
const listingId = "44444444-4444-4444-8444-444444444444"
const releaseId = "55555555-5555-4555-8555-555555555555"

class MemoryRepository {
  constructor(priceMinor = 900) {
    this.sequence = 100
    this.orders = []; this.entitlements = []; this.identities = []; this.ledger = []; this.refunds = []
    this.subscriptions = []; this.subscriptionPayments = []; this.grants = []; this.aiPackOrders = []; this.purchasedCredits = []; this.events = []; this.reconciliation = []; this.reversals = []; this.batches = []
    this.listing = { listingId, releaseId, sellerUserId: seller, title: "Launch kit", priceMinor, currency: PAYMENT_CURRENCY, status: "published", availability: "available", releaseStatus: "published", creatorTerms: { founding: false } }
    this.uuid = () => `00000000-0000-4000-8000-${String(++this.sequence).padStart(12, "0")}`
  }
  atomic(action) { return action(this) }
  checkoutListing(id) { return id === listingId ? structuredClone(this.listing) : undefined }
  creatorPaidSalesMinor(sellerUserId) { return this.orders.filter(row => row.sellerUserId === sellerUserId && row.status === "completed").reduce((sum, row) => sum + row.grossMinor, 0) }
  markCreatorFirstPaidListing(_sellerUserId, at) { this.listing.creatorTerms.firstPaidListingAt ||= at }
  orderByBuyerKey(userId, key) { return this.orders.find(row => row.buyerUserId === userId && row.idempotencyKey === key) }
  insertOrder(row) { this.orders.push(structuredClone(row)); return structuredClone(row) }
  orderById(id) { return structuredClone(this.orders.find(row => row.orderId === id)) }
  orderForUpdate(id) { return this.orderById(id) }
  orderByProviderOrder(id) { return structuredClone(this.orders.find(row => row.providerOrderId === id)) }
  orderByCapture(id) { return structuredClone(this.orders.find(row => row.providerCaptureId === id)) }
  orderByCaptureForUpdate(id) { return this.orderByCapture(id) }
  updateOrder(id, patch) { const row = this.orders.find(item => item.orderId === id); Object.assign(row, structuredClone(patch)); return structuredClone(row) }
  aiPackOrderByUserKey(userId,key) { return structuredClone(this.aiPackOrders.find(row=>row.userId===userId&&row.idempotencyKey===key)) }
  aiPackOrderById(id) { return structuredClone(this.aiPackOrders.find(row=>row.aiPackOrderId===id)) }
  aiPackOrderForUpdate(id) { return this.aiPackOrderById(id) }
  aiPackOrderByProviderOrder(id) { return structuredClone(this.aiPackOrders.find(row=>row.providerOrderId===id)) }
  aiPackOrderByCapture(id) { return structuredClone(this.aiPackOrders.find(row=>row.providerCaptureId===id)) }
  aiPackOrderByCaptureForUpdate(id) { return this.aiPackOrderByCapture(id) }
  insertAiPackOrder(row) { this.aiPackOrders.push(structuredClone(row)); return structuredClone(row) }
  updateAiPackOrder(id,patch) { const row=this.aiPackOrders.find(item=>item.aiPackOrderId===id); Object.assign(row,structuredClone(patch)); return structuredClone(row) }
  ensurePurchasedAiCredit(row) { const existing=this.purchasedCredits.find(item=>item.aiPackOrderId===row.aiPackOrderId); if(existing)return structuredClone(existing); this.purchasedCredits.push(structuredClone(row)); return structuredClone(row) }
  lockPaymentCapture() {}
  lockAiUsageUser() {}
  recordPaymentReversal(row) { if(this.reversals.some(item=>item.provider===row.provider&&item.kind===row.kind&&item.providerId===row.providerId))return false; this.reversals.push(structuredClone(row)); return true }
  paymentReversalForCaptureForUpdate(providerCaptureId,currency) { return structuredClone(this.reversals.filter(row=>row.providerCaptureId===providerCaptureId&&(!row.currency||row.currency===currency)).sort((a,b)=>(a.kind==="refund"?-1:1)-(b.kind==="refund"?-1:1)||a.occurredAt.localeCompare(b.occurredAt))[0]) }
  revokePurchasedAiCredit(aiPackOrderId, revokedAt, revocationReason) { const row=this.purchasedCredits.find(item=>item.aiPackOrderId===aiPackOrderId); if(row&&!row.revokedAt)Object.assign(row,{revokedAt,revocationReason}); return structuredClone(row) }
  insertPaymentIdentity(row) { if (this.identities.some(item => item.provider === row.provider && item.kind === row.kind && item.providerId === row.providerId)) return false; this.identities.push(structuredClone(row)); return true }
  ensureEntitlement(row) { const existing = this.entitlements.find(item => item.orderId === row.orderId); if (existing) return structuredClone(existing); this.entitlements.push(structuredClone(row)); return structuredClone(row) }
  revokeEntitlementForOrder(orderId, revokedAt, reason) { const row = this.entitlements.find(item => item.orderId === orderId); if (row && row.status === "active") Object.assign(row, { status: "revoked", revokedAt, reason }); return structuredClone(row) }
  insertLedgerEntry(row) { const existing = this.ledger.find(item => item.idempotencyKey === row.idempotencyKey); if (existing) return structuredClone(existing); this.ledger.push(structuredClone(row)); return structuredClone(row) }
  creatorReversedMinor(orderId) { return -this.ledger.filter(row => row.orderId === orderId && row.creatorAmountMinor < 0).reduce((sum, row) => sum + row.creatorAmountMinor, 0) }
  platformReversedMinor(orderId) { return -this.ledger.filter(row => row.orderId === orderId && row.platformFeeMinor < 0).reduce((sum, row) => sum + row.platformFeeMinor, 0) }
  refundedMinor(orderId) { return this.refunds.filter(row => row.orderId === orderId).reduce((sum, row) => sum + row.refundMinor, 0) }
  refundByKey(key) { return structuredClone(this.refunds.find(row => row.idempotencyKey === key)) }
  refundByProviderId(id) { return structuredClone(this.refunds.find(row => row.providerRefundId === id)) }
  insertRefund(row) { this.refunds.push(structuredClone(row)); return structuredClone(row) }
  flagReconciliation(row) { this.reconciliation.push(structuredClone(row)); return row }
  subscriptionByUserKey(userId, key) { return structuredClone(this.subscriptions.find(row => row.userId === userId && row.idempotencyKey === key)) }
  currentSubscriptionForUser(userId) { return structuredClone(this.subscriptions.find(row => row.userId === userId && ["creating","approval_pending","active","past_due","cancelled","reconciliation_required"].includes(row.status))) }
  subscriptionByProviderId(id) { return structuredClone(this.subscriptions.find(row => row.providerSubscriptionId === id)) }
  subscriptionByProviderIdForUpdate(id) { return this.subscriptionByProviderId(id) }
  subscriptionForUpdate(id) { return structuredClone(this.subscriptions.find(row => row.subscriptionId === id)) }
  insertSubscription(row) { this.subscriptions.push(structuredClone(row)); return structuredClone(row) }
  updateSubscription(id, patch) { const row = this.subscriptions.find(item => item.subscriptionId === id); Object.assign(row, structuredClone(patch)); return structuredClone(row) }
  markSubscriptionForReconciliation(id, providerSubscriptionId) { const row = this.subscriptions.find(item => item.subscriptionId === id && item.providerSubscriptionId === providerSubscriptionId); if (!row || !["creating", "approval_pending"].includes(row.status)) return undefined; Object.assign(row, { status: "reconciliation_required", approvalUrl: null }); return structuredClone(row) }
  markSubscriptionApprovalPending(id, providerSubscriptionId) { const row = this.subscriptions.find(item => item.subscriptionId === id && item.providerSubscriptionId === providerSubscriptionId && item.status === "creating"); if (!row) return undefined; row.status = "approval_pending"; return structuredClone(row) }
  insertSubscriptionPayment(row) { if (this.subscriptionPayments.some(item => item.providerPaymentId === row.providerPaymentId)) return false; this.subscriptionPayments.push(structuredClone(row)); return true }
  ensureAiGrant(row) { const existing = this.grants.find(item => item.subscriptionId === row.subscriptionId && item.grantMonth === row.grantMonth); if (existing) return structuredClone(existing); this.grants.push(structuredClone(row)); return structuredClone(row) }
  insertProviderEvent(row) { const existing=this.events.find(item=>item.providerEventId===row.providerEventId); if(existing){if(existing.status!=="failed")return false; Object.assign(existing,{...structuredClone(row),status:"received",error:undefined}); return true} this.events.push({ ...structuredClone(row), status: "received" }); return true }
  markProviderEventProcessed(id) { this.events.find(row => row.providerEventId === id).status = "processed" }
  markProviderEventFailed(id, error) { Object.assign(this.events.find(row => row.providerEventId === id), { status: "failed", error }) }
  availableLedgerEntries(instant) { return this.ledger.filter(row => !row.payoutBatchId && new Date(row.holdUntil) <= new Date(instant)).map(row => structuredClone(row)) }
  payoutBatchByKey(key) { return structuredClone(this.batches.find(row => row.batchKey === key)) }
  payoutBatchForUpdate(id) { return structuredClone(this.batches.find(row => row.batchId === id)) }
  insertPayoutBatch(row) { this.batches.push(structuredClone(row)); for (const member of row.members) for (const id of member.ledgerEntryIds) this.ledger.find(entry => entry.entryId === id).payoutBatchId = row.batchId; return structuredClone(row) }
  updatePayoutBatch(id, patch) { const row = this.batches.find(item => item.batchId === id); Object.assign(row, structuredClone(patch)); return structuredClone(row) }
  markPayoutEntriesPaid(batch, paidAt) { for (const member of batch.members) for (const id of member.ledgerEntryIds) Object.assign(this.ledger.find(row => row.entryId === id), { state: "paid", paidAt }) }
}

class StubProvider {
  constructor() { this.createCalls = 0; this.captureCalls = 0; this.refundCalls = 0; this.subscriptionCalls = 0 }
  createOrder(order) { this.createCalls++; this.grossMinor = order.grossMinor; return { providerOrderId: `PP-${order.orderId}`, status: "CREATED", approvalUrl: "https://sandbox.paypal.test/approve" } }
  getOrder(id) { return { id, status: "CREATED", purchase_units: [{ reference_id: id.slice(3), custom_id: id.slice(3), amount: { currency_code: "USD", value: `${Math.floor(this.grossMinor / 100)}.${String(this.grossMinor % 100).padStart(2, "0")}` } }] } }
  captureOrder(id, requestId) {
    this.captureCalls++
    const orderId = id.slice(3)
    return { providerOrderId: id, providerCaptureId: `CAP-${orderId}`, status: "COMPLETED", grossMinor: this.grossMinor, currency: "USD", customId: orderId, capturedAt: "2026-09-01T00:00:00.000Z", requestId }
  }
  refundCapture(_capture, amount, currency) { this.refundCalls++; return { providerRefundId: `REF-${this.refundCalls}`, status: "COMPLETED", refundMinor: amount, currency, refundedAt: "2026-09-20T00:00:00.000Z" } }
  createSubscription({ subscriptionId, planId }) { this.subscriptionCalls++; this.subscriptionPlanId = planId; return { providerSubscriptionId: `SUB-${subscriptionId}`, status: "APPROVAL_PENDING", approvalUrl: "https://sandbox.paypal.test/subscription" } }
  getPlan(id, plan) { return { id, status: "ACTIVE", billing_cycles: [{ tenure_type: "REGULAR", frequency: { interval_unit: plan.cadence === "month" ? "MONTH" : "YEAR", interval_count: 1 }, pricing_scheme: { fixed_price: { currency_code: "USD", value: (plan.priceMinor / 100).toFixed(2) } } }] } }
  getSubscription(id) { return { id, custom_id: id.slice(4), plan_id: this.subscriptionPlanId, status: "APPROVAL_PENDING" } }
}

const options = { publicPaidLaunchAt: "2026-09-01T00:00:00.000Z", returnUrl: "https://webcanbe.com/purchases", cancelUrl: "https://webcanbe.com/marketplace", clock: () => Date.parse("2026-09-01T00:00:00.000Z") }

async function completedSale(price = 900) {
  const repo = new MemoryRepository(price), provider = new StubProvider()
  const order = await createMarketplaceOrder(repo, provider, { userId: buyer }, { listingId, idempotencyKey: "checkout-1" }, options)
  await captureMarketplaceOrder(repo, provider, { userId: buyer }, { orderId: order.orderId })
  return { repo, provider, order: repo.orders[0] }
}

describe("provider-neutral marketplace payments", () => {
  it("completes a free listing without contacting PayPal and grants once", async () => {
    const repo = new MemoryRepository(0), provider = new StubProvider()
    const first = await createMarketplaceOrder(repo, provider, { userId: buyer }, { listingId, idempotencyKey: "free" }, options)
    const replay = await createMarketplaceOrder(repo, provider, { userId: buyer }, { listingId, idempotencyKey: "free" }, options)
    expect(first).toMatchObject({ status: "completed", grossMinor: 0 })
    expect(replay.orderId).toBe(first.orderId)
    expect(provider.createCalls).toBe(0)
    expect(repo.entitlements).toHaveLength(1)
  })

  it("rejects missing, stale, and unavailable listing state before provider work", async () => {
    const repo = new MemoryRepository(), provider = new StubProvider()
    await expect(createMarketplaceOrder(repo, provider, { userId: buyer }, { listingId: "99999999-9999-4999-8999-999999999999", idempotencyKey: "missing" }, options)).rejects.toMatchObject({ code: "listing_unavailable" })
    for (const patch of [{ status: "archived" }, { availability: "unavailable" }, { releaseStatus: "draft" }]) {
      Object.assign(repo.listing, { status: "published", availability: "available", releaseStatus: "published" }, patch)
      await expect(createMarketplaceOrder(repo, provider, { userId: buyer }, { listingId, idempotencyKey: `stale-${Object.keys(patch)[0]}` }, options)).rejects.toMatchObject({ code: "listing_unavailable" })
    }
    expect(provider.createCalls).toBe(0)
  })

  it("uses authoritative server price and rejects client price/creator tampering", async () => {
    const repo = new MemoryRepository(), provider = new StubProvider()
    await expect(createMarketplaceOrder(repo, provider, { userId: buyer }, { listingId, idempotencyKey: "checkout", priceMinor: 1 }, options)).rejects.toMatchObject({ code: "invalid_request" })
    const order = await createMarketplaceOrder(repo, provider, { userId: buyer }, { listingId, idempotencyKey: "checkout" }, options)
    expect(order.grossMinor).toBe(900)
    expect(repo.orders[0]).toMatchObject({ sellerUserId: seller, currency: "USD", grossMinor: 900 })
  })

  it("makes create/capture and entitlement/ledger grants exactly once", async () => {
    const repo = new MemoryRepository(), provider = new StubProvider()
    const first = await createMarketplaceOrder(repo, provider, { userId: buyer }, { listingId, idempotencyKey: "same" }, options)
    const replay = await createMarketplaceOrder(repo, provider, { userId: buyer }, { listingId, idempotencyKey: "same" }, options)
    expect(replay.orderId).toBe(first.orderId)
    expect(provider.createCalls).toBe(1)
    await captureMarketplaceOrder(repo, provider, { userId: buyer }, { orderId: first.orderId })
    await captureMarketplaceOrder(repo, provider, { userId: buyer }, { orderId: first.orderId })
    expect(repo.entitlements).toHaveLength(1)
    expect(repo.ledger.filter(row => row.kind === "sale")).toHaveLength(1)
    expect(provider.captureCalls).toBe(1)
  })

  it("captures an approval return by provider token and keeps duplicate returns idempotent", async () => {
    const repo = new MemoryRepository(), provider = new StubProvider()
    const order = await createMarketplaceOrder(repo, provider, { userId: buyer }, { listingId, idempotencyKey: "provider-return" }, options)
    await captureMarketplaceOrder(repo, provider, { userId: buyer }, { providerOrderId: `PP-${order.orderId}` })
    await captureMarketplaceOrder(repo, provider, { userId: buyer }, { providerOrderId: `PP-${order.orderId}` })
    expect(provider.captureCalls).toBe(1)
    expect(repo.entitlements).toHaveLength(1)
  })

  it("resumes an interrupted provider create with the same Webcanbe order", async () => {
    const repo = new MemoryRepository(), provider = new StubProvider()
    const create = provider.createOrder.bind(provider)
    provider.createOrder = async order => { if (provider.createCalls++ === 0) throw new Error("temporary provider failure"); provider.createCalls--; return create(order) }
    await expect(createMarketplaceOrder(repo, provider, { userId: buyer }, { listingId, idempotencyKey: "resume" }, options)).rejects.toThrow("temporary provider failure")
    expect(repo.orders).toHaveLength(1)
    const resumed = await createMarketplaceOrder(repo, provider, { userId: buyer }, { listingId, idempotencyKey: "resume" }, options)
    expect(resumed.orderId).toBe(repo.orders[0].orderId)
    expect(resumed.status).toBe("approval_pending")
  })

  it("refuses cross-user capture and quarantines capture mismatches", async () => {
    const repo = new MemoryRepository(), provider = new StubProvider()
    const order = await createMarketplaceOrder(repo, provider, { userId: buyer }, { listingId, idempotencyKey: "one" }, options)
    await expect(captureMarketplaceOrder(repo, provider, { userId: otherBuyer }, { orderId: order.orderId })).rejects.toMatchObject({ code: "order_not_found" })
    provider.captureOrder = async id => ({ providerOrderId: id, providerCaptureId: "bad", status: "COMPLETED", grossMinor: 1, currency: "USD", customId: order.orderId, capturedAt: "2026-09-01T00:00:00.000Z" })
    await expect(captureMarketplaceOrder(repo, provider, { userId: buyer }, { orderId: order.orderId })).rejects.toMatchObject({ code: "capture_mismatch" })
    expect(repo.orders[0].status).toBe("reconciliation_required")
    expect(repo.entitlements).toHaveLength(0)
  })

  it("records verified webhook replay once and holds unknown out-of-order captures", async () => {
    const repo = new MemoryRepository()
    const event = { id: "WH-1", event_type: "PAYMENT.CAPTURE.COMPLETED", create_time: "2026-09-01T00:00:00.000Z" }
    const first = await recordVerifiedWebhook(repo, event, async () => ({ state: "processed" }))
    const replay = await recordVerifiedWebhook(repo, event, async () => { throw new Error("must not run") })
    expect(first.state).toBe("processed")
    expect(replay.state).toBe("duplicate")
    const result = await applyCaptureWebhook(repo, { providerOrderId: "missing", providerCaptureId: "CAP-missing", status: "COMPLETED", grossMinor: 900, currency: "USD", customId: "missing", capturedAt: event.create_time })
    expect(result.state).toBe("reconciliation_required")
    expect(repo.entitlements).toHaveLength(0)
  })

  it("retries a previously failed provider event without double-processing a success", async () => {
    const repo = new MemoryRepository(), event = { id: "WH-RETRY", event_type: "PAYMENT.CAPTURE.COMPLETED", create_time: "2026-09-01T00:00:00.000Z" }
    await expect(recordVerifiedWebhook(repo, event, async () => { throw new Error("temporary") })).rejects.toThrow("temporary")
    expect(repo.events[0].status).toBe("failed")
    await expect(recordVerifiedWebhook(repo, event, async () => ({ state: "recovered" }))).resolves.toEqual({ state: "recovered" })
    expect(repo.events[0].status).toBe("processed")
  })

  it("does not process an unverified browser-style webhook", async () => {
    const repo = new MemoryRepository()
    const request = new Request("https://webcanbe.com/__webcanbe/api/payments/webhooks/paypal", { method: "POST", body: JSON.stringify({ id: "fake", event_type: "PAYMENT.CAPTURE.COMPLETED" }) })
    const response = await handlePayPalWebhook(request, repo, { verifyWebhook: async () => { throw new Error("bad signature") } })
    expect(response.status).toBe(403)
    expect(repo.events).toHaveLength(0)
  })
})

describe("subscription entitlement and monthly AI grants", () => {
  it("refuses a provider plan with the wrong live price before creating a subscription", async () => {
    const repo = new MemoryRepository(), provider = new StubProvider()
    provider.getPlan = async id => ({ id, status: "ACTIVE", billing_cycles: [{ tenure_type: "REGULAR", frequency: { interval_unit: "MONTH", interval_count: 1 }, pricing_scheme: { fixed_price: { currency_code: "USD", value: "29.00" } } }] })
    await expect(createPlanSubscription(repo, provider, { userId: buyer }, { planKey: "pro_monthly", idempotencyKey: "wrong-plan" }, { ...options, planIds: { pro_monthly: "P-WRONG" } })).rejects.toMatchObject({ code: "paypal_plan_unverified" })
    expect(provider.subscriptionCalls).toBe(0)
    expect(repo.subscriptions).toHaveLength(0)
  })
  it("quarantines a new PayPal 201 subscription whose immediate GET returns 404 without creating another", async () => {
    const repo = new MemoryRepository(), provider = new StubProvider()
    provider.getSubscription = async () => { const error = new PaymentError(409, "paypal_request_failed", "Not found"); Object.assign(error, { providerHttpStatus: 404, providerName: "RESOURCE_NOT_FOUND", providerIssue: "INVALID_RESOURCE_ID" }); throw error }
    const input = { planKey: "pro_monthly", idempotencyKey: "fresh-404" }
    const config = { ...options, planIds: { pro_monthly: "P-MONTHLY" } }
    await expect(createPlanSubscription(repo, provider, { userId: buyer }, input, config)).rejects.toMatchObject({ code: "subscription_reconciliation_required" })
    expect(repo.subscriptions[0]).toMatchObject({ status: "reconciliation_required", providerSubscriptionId: `SUB-${repo.subscriptions[0].subscriptionId}`, approvalUrl: null })
    await expect(createPlanSubscription(repo, provider, { userId: buyer }, { ...input, idempotencyKey: "another" }, config)).rejects.toMatchObject({ code: "subscription_reconciliation_required" })
    expect(provider.subscriptionCalls).toBe(1)
  })
  it("blocks a stale approval on the same and a new key without starting another PayPal subscription", async () => {
    const repo = new MemoryRepository(), provider = new StubProvider()
    const config = { ...options, planIds: { pro_monthly: "P-MONTHLY" } }
    const input = { planKey: "pro_monthly", idempotencyKey: "first" }
    const previous = await createPlanSubscription(repo, provider, { userId: buyer }, input, config)
    provider.getSubscription = async () => { const error = new PaymentError(409, "paypal_request_failed", "PayPal unavailable"); Object.assign(error, { providerHttpStatus: 404, providerName: "RESOURCE_NOT_FOUND", providerIssue: "INVALID_RESOURCE_ID" }); throw error }
    await expect(createPlanSubscription(repo, provider, { userId: buyer }, input, config)).rejects.toMatchObject({ code: "subscription_reconciliation_required" })
    await expect(createPlanSubscription(repo, provider, { userId: buyer }, { ...input, idempotencyKey: "second" }, config)).rejects.toMatchObject({ code: "subscription_reconciliation_required" })
    expect(repo.subscriptions).toHaveLength(1)
    expect(repo.subscriptions[0]).toMatchObject({ subscriptionId: previous.subscriptionId, status: "reconciliation_required" })
    expect(provider.subscriptionCalls).toBe(1)
    expect(repo.grants).toHaveLength(0)
  })

  it("allows a fresh checkout after an unpaid cancellation", async () => {
    const repo = new MemoryRepository(), provider = new StubProvider()
    const config = { ...options, planIds: { pro_monthly: "P-MONTHLY" } }
    const previous = await createPlanSubscription(repo, provider, { userId: buyer }, { planKey: "pro_monthly", idempotencyKey: "first" }, config)
    repo.updateSubscription(previous.subscriptionId, { status: "cancelled", cancelledAt: "2026-09-01T00:00:00.000Z" })
    const next = await createPlanSubscription(repo, provider, { userId: buyer }, { planKey: "pro_monthly", idempotencyKey: "second" }, config)
    expect(next.subscriptionId).not.toBe(previous.subscriptionId)
    expect(provider.subscriptionCalls).toBe(2)
  })

  it("keeps a paid-through cancelled subscription without starting another charge", async () => {
    const repo = new MemoryRepository(), provider = new StubProvider()
    const config = { ...options, planIds: { pro_monthly: "P-MONTHLY" } }
    const previous = await createPlanSubscription(repo, provider, { userId: buyer }, { planKey: "pro_monthly", idempotencyKey: "first" }, config)
    repo.updateSubscription(previous.subscriptionId, { status: "cancelled", cancelledAt: "2026-09-01T00:00:00.000Z", currentPeriodEnd: "2026-10-01T00:00:00.000Z" })
    const next = await createPlanSubscription(repo, provider, { userId: buyer }, { planKey: "pro_monthly", idempotencyKey: "second" }, config)
    expect(next.subscriptionId).toBe(previous.subscriptionId)
    expect(provider.subscriptionCalls).toBe(1)
  })

  it("grants annual subscribers monthly and deduplicates renewal events", async () => {
    const repo = new MemoryRepository(), provider = new StubProvider()
    const created = await createPlanSubscription(repo, provider, { userId: buyer }, { planKey: "pro_annual", idempotencyKey: "annual" }, { ...options, planIds: { pro_annual: "P-ANNUAL" } })
    const base = { providerSubscriptionId: created.providerSubscriptionId, providerEventId: "EV-ACTIVE", kind: "activated", occurredAt: "2026-09-10T00:00:00.000Z", currentPeriodEnd: "2027-09-10T00:00:00.000Z" }
    await applySubscriptionEvent(repo, base)
    await reconcileMonthlySubscriptionGrant(repo, created.subscriptionId, "2026-10-01T00:00:00.000Z")
    await reconcileMonthlySubscriptionGrant(repo, created.subscriptionId, "2026-10-20T00:00:00.000Z")
    expect(repo.grants.map(row => [row.grantMonth, row.includedActions])).toEqual([["2026-09", 300], ["2026-10", 300]])
    const renewal = { ...base, kind: "renewed", providerEventId: "EV-RENEW", providerPaymentId: "SALE-1", occurredAt: "2027-09-10T00:00:00.000Z", grossMinor: 12000, currency: "USD", currentPeriodEnd: "2028-09-10T00:00:00.000Z" }
    await applySubscriptionEvent(repo, renewal)
    expect((await applySubscriptionEvent(repo, renewal)).state).toBe("duplicate")
    expect((await applySubscriptionEvent(repo, { ...renewal, providerEventId: "EV-RENEW-ALIAS", occurredAt: "2027-09-11T00:00:00.000Z" })).state).toBe("duplicate")
    expect(repo.subscriptionPayments).toHaveLength(1)
    expect(repo.subscriptions[0].lastProviderEventAt).toBe("2027-09-10T00:00:00.000Z")
  })

  it("handles cancellation, failed renewal, recovery and stale state events", async () => {
    const repo = new MemoryRepository(), provider = new StubProvider()
    const created = await createPlanSubscription(repo, provider, { userId: buyer }, { planKey: "studio_monthly", idempotencyKey: "monthly" }, { ...options, planIds: { studio_monthly: "P-MONTHLY" } })
    const id = created.providerSubscriptionId
    await applySubscriptionEvent(repo, { kind: "activated", providerEventId: "1", providerSubscriptionId: id, occurredAt: "2026-09-01T00:00:00.000Z" })
    await applySubscriptionEvent(repo, { kind: "payment_failed", providerEventId: "2", providerSubscriptionId: id, occurredAt: "2026-09-15T00:00:00.000Z" })
    expect(repo.subscriptions[0].status).toBe("past_due")
    await applySubscriptionEvent(repo, { kind: "recovered", providerEventId: "3", providerSubscriptionId: id, occurredAt: "2026-09-16T00:00:00.000Z" })
    expect(repo.subscriptions[0].status).toBe("active")
    const stale = await applySubscriptionEvent(repo, { kind: "cancelled", providerEventId: "4", providerSubscriptionId: id, occurredAt: "2026-09-02T00:00:00.000Z" })
    expect(stale.state).toBe("stale")
    await applySubscriptionEvent(repo, { kind: "cancelled", providerEventId: "5", providerSubscriptionId: id, occurredAt: "2026-09-20T00:00:00.000Z" })
    expect(repo.subscriptions[0].status).toBe("cancelled")
  })

  it("never lets stale or fresh activation events reactivate a terminal subscription", async () => {
    const repo = new MemoryRepository(), provider = new StubProvider()
    const created = await createPlanSubscription(repo, provider, { userId: buyer }, { planKey: "studio_monthly", idempotencyKey: "terminal" }, { ...options, planIds: { studio_monthly: "P-MONTHLY" } })
    const base = { providerSubscriptionId: created.providerSubscriptionId, grossMinor: 2900, currency: "USD", currentPeriodEnd: "2026-11-01T00:00:00.000Z" }
    await applySubscriptionEvent(repo, { ...base, kind: "activated", providerEventId: "T1", occurredAt: "2026-09-01T00:00:00.000Z" })
    await applySubscriptionEvent(repo, { ...base, kind: "expired", providerEventId: "T3", occurredAt: "2026-10-01T00:00:00.000Z" })
    const stale = await applySubscriptionEvent(repo, { ...base, kind: "renewed", providerEventId: "T2", providerPaymentId: "SALE-STALE", occurredAt: "2026-09-15T00:00:00.000Z" })
    expect(stale.state).toBe("stale")
    expect(repo.subscriptions[0]).toMatchObject({ status: "expired", lastProviderEventAt: "2026-10-01T00:00:00.000Z" })
    expect(repo.subscriptionPayments).toHaveLength(0)
    const failed = await applySubscriptionEvent(repo, { ...base, kind: "payment_failed", providerEventId: "T5", occurredAt: "2026-10-03T00:00:00.000Z" })
    expect(failed.state).toBe("terminal")
    expect(repo.subscriptions[0].status).toBe("expired")
    const laundered = await applySubscriptionEvent(repo, { ...base, kind: "activated", providerEventId: "T6", occurredAt: "2026-10-04T00:00:00.000Z" })
    expect(laundered.state).toBe("reconciliation_required")
    expect(repo.subscriptions[0].status).toBe("expired")
    const fresh = await applySubscriptionEvent(repo, { ...base, kind: "renewed", providerEventId: "T4", providerPaymentId: "SALE-FRESH", occurredAt: "2026-10-02T00:00:00.000Z" })
    expect(fresh.state).toBe("reconciliation_required")
    expect(repo.subscriptions[0].status).toBe("expired")
    expect(repo.subscriptionPayments).toHaveLength(0)
  })
})

describe("purchased AI Action packs", () => {
  it("verifies a new order before approval and quarantines a missing provider order without another POST", async () => {
    const repo = new MemoryRepository(), provider = new StubProvider()
    provider.getOrder = async () => { const error = new PaymentError(409, "paypal_request_failed", "Not found"); error.providerHttpStatus = 404; throw error }
    const input = { packKey: "actions_100", idempotencyKey: "pack-missing" }
    await expect(createAiPackOrder(repo, provider, { userId: buyer }, input, options)).rejects.toMatchObject({ code: "ai_pack_reconciliation_required" })
    expect(repo.aiPackOrders[0]).toMatchObject({ grossMinor: 500, currency: "USD", status: "reconciliation_required", approvalUrl: null })
    expect(provider.createCalls).toBe(1)
    expect((await createAiPackOrder(repo, provider, { userId: buyer }, input, options)).approvalUrl).toBeUndefined()
    expect(provider.createCalls).toBe(1)
  })

  it("keeps a mismatched completed capture in reconciliation instead of granting credit", async () => {
    const repo = new MemoryRepository(), provider = new StubProvider()
    const order = await createAiPackOrder(repo, provider, { userId: buyer }, { packKey: "actions_100", idempotencyKey: "pack-mismatch" }, options)
    const capture = provider.captureOrder.bind(provider)
    provider.captureOrder = (...args) => ({ ...capture(...args), grossMinor: 499 })
    await expect(captureAiPackOrder(repo, provider, { userId: buyer }, { aiPackOrderId: order.aiPackOrderId })).rejects.toMatchObject({ code: "capture_mismatch" })
    expect(repo.aiPackOrders[0].status).toBe("reconciliation_required")
    expect(repo.purchasedCredits).toHaveLength(0)
  })

  it("flags a partial refund without representing it as a full refund", async () => {
    const repo = new MemoryRepository(), provider = new StubProvider()
    const order = await createAiPackOrder(repo, provider, { userId: buyer }, { packKey: "actions_100", idempotencyKey: "pack-partial" }, options)
    await captureAiPackOrder(repo, provider, { userId: buyer }, { aiPackOrderId: order.aiPackOrderId })
    const result = await processPayPalEvent(repo, { id: "WH-PARTIAL", event_type: "PAYMENT.CAPTURE.REFUNDED", create_time: "2026-09-20T00:00:00.000Z", resource: { id: "REF-PARTIAL", amount: { value: "1.00", currency_code: "USD" }, supplementary_data: { related_ids: { capture_id: repo.aiPackOrders[0].providerCaptureId } } } })
    expect(result.state).toBe("reconciliation_required")
    expect(repo.aiPackOrders[0].status).toBe("reconciliation_required")
    expect(repo.purchasedCredits[0].revocationReason).toBe("partial_refund")
    expect(repo.reconciliation).toHaveLength(1)
  })

  it("selects pack price on the server, grants once, never adds creator earnings and has no expiry", async () => {
    const repo = new MemoryRepository(), provider = new StubProvider()
    await expect(createAiPackOrder(repo, provider, { userId: buyer }, { packKey: "actions_100", idempotencyKey: "pack", grossMinor: 1 }, options)).rejects.toMatchObject({ code: "invalid_request" })
    const order = await createAiPackOrder(repo, provider, { userId: buyer }, { packKey: "actions_500", idempotencyKey: "pack" }, options)
    expect(order).toMatchObject({ actions: 500, grossMinor: 1500, currency: "USD" })
    await captureAiPackOrder(repo, provider, { userId: buyer }, { aiPackOrderId: order.aiPackOrderId })
    await captureAiPackOrder(repo, provider, { userId: buyer }, { aiPackOrderId: order.aiPackOrderId })
    expect(repo.purchasedCredits).toHaveLength(1)
    expect(repo.purchasedCredits[0]).not.toHaveProperty("expiresAt")
    expect(repo.ledger).toHaveLength(0)
  })

  it("captures an AI pack return by provider token and refuses the wrong user", async () => {
    const repo = new MemoryRepository(), provider = new StubProvider()
    const order = await createAiPackOrder(repo, provider, { userId: buyer }, { packKey: "actions_100", idempotencyKey: "pack-token" }, options)
    const providerOrderId = `PP-${order.aiPackOrderId}`
    await expect(captureAiPackOrder(repo, provider, { userId: otherBuyer }, { providerOrderId })).rejects.toMatchObject({ code: "ai_pack_order_not_found" })
    await captureAiPackOrder(repo, provider, { userId: buyer }, { providerOrderId })
    expect(repo.purchasedCredits[0]).toMatchObject({ purchasedActions: 100 })
  })

  it.each([
    ["refund", "PAYMENT.CAPTURE.REFUNDED", "refund"],
    ["dispute", "CUSTOMER.DISPUTE.CREATED", "dispute"],
  ])("revokes purchased credits replay-safely after a %s", async (_label, eventType, reason) => {
    const repo = new MemoryRepository(), provider = new StubProvider()
    const order = await createAiPackOrder(repo, provider, { userId: buyer }, { packKey: "actions_500", idempotencyKey: `pack-${reason}` }, options)
    await captureAiPackOrder(repo, provider, { userId: buyer }, { aiPackOrderId: order.aiPackOrderId })
    const captureId = repo.aiPackOrders[0].providerCaptureId
    const event = eventType === "PAYMENT.CAPTURE.REFUNDED"
      ? { id: "WH-PACK-REFUND", event_type: eventType, create_time: "2026-09-20T00:00:00.000Z", resource: { id: "REF-PACK-1", amount: { value: "15.00", currency_code: "USD" }, supplementary_data: { related_ids: { capture_id: captureId } } } }
      : { id: "WH-PACK-DISPUTE", event_type: eventType, create_time: "2026-09-20T00:00:00.000Z", resource: { id: "DSP-PACK-1", disputed_transactions: [{ seller_transaction_id: captureId }] } }
    expect((await processPayPalEvent(repo, event)).state).toBe("applied")
    expect((await processPayPalEvent(repo, event)).state).toBe("duplicate")
    expect(repo.purchasedCredits).toHaveLength(1)
    expect(repo.purchasedCredits[0]).toMatchObject({ revocationReason: reason, revokedAt: event.create_time })
  })

  it("applies a refund that arrives before the matching pack capture", async () => {
    const repo = new MemoryRepository(), provider = new StubProvider()
    const order = await createAiPackOrder(repo, provider, { userId: buyer }, { packKey: "actions_500", idempotencyKey: "pack-out-of-order" }, options)
    const captureId = `CAP-${order.aiPackOrderId}`
    const refund = { id: "WH-EARLY-REFUND", event_type: "PAYMENT.CAPTURE.REFUNDED", create_time: "2026-09-20T00:00:00.000Z", resource: { id: "REF-EARLY", amount: { value: "15.00", currency_code: "USD" }, supplementary_data: { related_ids: { capture_id: captureId } } } }
    expect((await processPayPalEvent(repo, refund)).state).toBe("reconciliation_required")
    await captureAiPackOrder(repo, provider, { userId: buyer }, { aiPackOrderId: order.aiPackOrderId })
    expect(repo.aiPackOrders[0].status).toBe("refunded")
    expect(repo.purchasedCredits[0]).toMatchObject({ revocationReason: "refund", revokedAt: refund.create_time })
  })

  it("serializes an overlapping capture and refund on the provider capture ID", async () => {
    class InterleavingRepository extends MemoryRepository {
      constructor() {
        super()
        this.captureLocks = new Map()
        this.captureAtPending = new Promise(resolve => { this.markCaptureAtPending = resolve })
        this.continueCapture = new Promise(resolve => { this.releaseCapture = resolve })
        this.pausePendingOnce = true
      }
      async atomic(action) {
        const tx = Object.create(this); tx.lockReleases = []
        try { return await action(tx) }
        finally { for (const release of tx.lockReleases.reverse()) release() }
      }
      async lockPaymentCapture(id) {
        const previous = this.captureLocks.get(id) || Promise.resolve()
        let release
        const current = previous.then(() => new Promise(resolve => { release = resolve }))
        this.captureLocks.set(id, current)
        await previous
        this.lockReleases.push(() => release())
      }
      async paymentReversalForCaptureForUpdate(providerCaptureId, currency) {
        if (this.pausePendingOnce) {
          this.pausePendingOnce = false
          this.markCaptureAtPending()
          await this.continueCapture
        }
        return super.paymentReversalForCaptureForUpdate(providerCaptureId, currency)
      }
    }
    const repo = new InterleavingRepository(), provider = new StubProvider()
    const order = await createAiPackOrder(repo, provider, { userId: buyer }, { packKey: "actions_500", idempotencyKey: "pack-overlap" }, options)
    const capture = captureAiPackOrder(repo, provider, { userId: buyer }, { aiPackOrderId: order.aiPackOrderId })
    await repo.captureAtPending
    const captureId = `CAP-${order.aiPackOrderId}`
    const refundEvent = { id: "WH-OVERLAP", event_type: "PAYMENT.CAPTURE.REFUNDED", create_time: "2026-09-20T00:00:00.000Z", resource: { id: "REF-OVERLAP", amount: { value: "15.00", currency_code: "USD" }, supplementary_data: { related_ids: { capture_id: captureId } } } }
    const refund = processPayPalEvent(repo, refundEvent)
    await Promise.resolve()
    expect(repo.reversals).toHaveLength(0)
    repo.releaseCapture()
    await capture
    expect((await refund).state).toBe("applied")
    expect(repo.aiPackOrders[0].status).toBe("refunded")
    expect(repo.purchasedCredits[0]).toMatchObject({ revocationReason: "refund", revokedAt: refundEvent.create_time })
  })
})

describe("refund, dispute and creator payout accounting", () => {
  it("supports partial/full refund before payout with duplicate protection", async () => {
    const { repo, order } = await completedSale()
    await applyRefund(repo, { orderId: order.orderId, providerRefundId: "REF-1", refundMinor: 400, occurredAt: "2026-09-10T00:00:00.000Z" })
    await applyRefund(repo, { orderId: order.orderId, providerRefundId: "REF-1", refundMinor: 400, occurredAt: "2026-09-10T00:00:00.000Z" })
    expect(repo.refunds).toHaveLength(1)
    expect(repo.entitlements[0].status).toBe("active")
    await applyRefund(repo, { orderId: order.orderId, providerRefundId: "REF-2", refundMinor: 500, occurredAt: "2026-09-11T00:00:00.000Z" })
    expect(repo.entitlements[0].status).toBe("revoked")
    expect(repo.ledger.reduce((sum, row) => sum + row.creatorAmountMinor, 0)).toBe(0)
  })

  it("records a negative creator balance when a dispute arrives after payout", async () => {
    const { repo, order } = await completedSale(3000)
    const batch = await buildPayoutBatch(repo, "2026-10-01T00:00:00.000Z")
    await reconcileManualPayout(repo, { batchId: batch.batchId, providerReference: "MANUAL-TRANSFER-1", confirmedPaidAt: "2026-10-01T02:00:00.000Z" })
    expect(repo.batches[0].status).toBe("paid")
    await applyDispute(repo, { providerDisputeId: "DSP-1", providerCaptureId: order.providerCaptureId, occurredAt: "2026-10-02T00:00:00.000Z" })
    const unpaidBalance = repo.ledger.filter(row => !row.payoutBatchId).reduce((sum, row) => sum + row.creatorAmountMinor, 0)
    expect(unpaidBalance).toBeLessThan(0)
    expect(repo.entitlements[0].status).toBe("revoked")
  })

  it("does not reverse creator or platform earnings twice when a refund follows a dispute", async () => {
    const { repo, order } = await completedSale()
    await applyDispute(repo, { providerDisputeId: "DSP-THEN-REFUND", providerCaptureId: order.providerCaptureId, occurredAt: "2026-09-10T00:00:00.000Z" })
    await applyRefund(repo, { orderId: order.orderId, providerRefundId: "REF-AFTER-DISPUTE", refundMinor: 900, currency: "USD", occurredAt: "2026-09-11T00:00:00.000Z" })
    await applyRefund(repo, { orderId: order.orderId, providerRefundId: "REF-AFTER-DISPUTE", refundMinor: 900, currency: "USD", occurredAt: "2026-09-11T00:00:00.000Z" })
    expect(repo.refunds).toHaveLength(1)
    expect(repo.ledger.reduce((sum, row) => sum + row.creatorAmountMinor, 0)).toBe(0)
    expect(repo.ledger.reduce((sum, row) => sum + row.platformFeeMinor, 0)).toBe(0)
    expect(repo.entitlements[0]).toMatchObject({ status: "revoked", reason: "dispute" })
    expect(repo.orders[0].status).toBe("disputed")
  })

  it("builds deterministic idempotent batches and requires provider reconciliation to mark paid", async () => {
    const { repo } = await completedSale(3000)
    const first = await buildPayoutBatch(repo, "2026-10-01T00:00:00.000Z")
    const replay = await buildPayoutBatch(repo, "2026-10-01T12:00:00.000Z")
    expect(replay.batchId).toBe(first.batchId)
    expect(first.members).toHaveLength(1)
    await expect(reconcileManualPayout(repo, { batchId: first.batchId, providerReference: "", confirmedPaidAt: "2026-10-01T01:00:00.000Z" })).rejects.toMatchObject({ code: "payout_evidence_invalid" })
    await reconcileManualPayout(repo, { batchId: first.batchId, providerReference: "BANK-REF-9", confirmedPaidAt: "2026-10-01T01:00:00.000Z" })
    expect(repo.batches[0]).toMatchObject({ status: "paid", providerReference: "BANK-REF-9" })
  })
})
