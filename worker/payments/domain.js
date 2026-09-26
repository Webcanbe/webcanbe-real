import { randomUUID } from "node:crypto"
import {
  CREATOR_EARNING_HOLD_DAYS,
  MINIMUM_PAID_LISTING_MINOR,
  MINIMUM_PAYOUT_MINOR,
  PAYMENT_CURRENCY,
  WEB_CAN_BE_PLANS,
  PaymentError,
  addDays,
  creatorAmounts,
  creatorFeeRate,
  domainId,
  exactObject,
  grantMonth,
  moneyMinor,
  paymentKey,
  providerId,
  payoutDateKey,
} from "./contracts.js"

const nowIso = clock => new Date(clock()).toISOString()
const uuid = factory => (factory || randomUUID)()

function publicOrder(order) {
  return Object.freeze({
    orderId: order.orderId,
    listingId: order.listingId,
    releaseId: order.releaseId,
    status: order.status,
    grossMinor: order.grossMinor,
    currency: order.currency,
    ...(order.approvalUrl ? { approvalUrl: order.approvalUrl } : {}),
    createdAt: order.createdAt,
  })
}

function validateListing(listing) {
  if (!listing || listing.status !== "published" || listing.availability !== "available" || listing.releaseStatus !== "published") {
    throw new PaymentError(409, "listing_unavailable", "This listing is not available for purchase.")
  }
  moneyMinor(listing.priceMinor, "listing price")
  if (listing.currency !== PAYMENT_CURRENCY) throw new PaymentError(409, "listing_currency_invalid", "This listing has an unsupported currency.")
  if (listing.priceMinor > 0 && listing.priceMinor < MINIMUM_PAID_LISTING_MINOR) throw new PaymentError(409, "listing_price_invalid", "Paid listings must cost at least $9.00.")
}

async function completeFreeOrder(repo, order, at) {
  return repo.atomic(async tx => {
    const current = await tx.orderForUpdate(order.orderId)
    if (current.status === "completed") return current
    const completed = await tx.updateOrder(order.orderId, { status: "completed", completedAt: at })
    await tx.ensureEntitlement({ entitlementId: uuid(repo.uuid), orderId: order.orderId, userId: order.buyerUserId, releaseId: order.releaseId, provider: "webcanbe-free", providerReference: `free:${order.orderId}`, status: "active", grantedAt: at })
    return completed
  })
}

export async function createMarketplaceOrder(repo, provider, session, input, options = {}) {
  exactObject(input, ["listingId", "expectedReleaseId", "expectedPriceMinor", "idempotencyKey"], "Only the selected listing, release, price, and idempotency key are accepted.")
  const listingId = domainId(input.listingId, "checkout")
  const expectedReleaseId = domainId(input.expectedReleaseId, "selected release")
  const expectedPriceMinor = moneyMinor(input.expectedPriceMinor, "selected price")
  const idempotencyKey = paymentKey(input.idempotencyKey)
  const existing = await repo.orderByBuyerKey(session.userId, idempotencyKey)
  if (existing) {
    if (existing.listingId !== listingId) throw new PaymentError(409, "idempotency_conflict", "This checkout key belongs to another order.")
    if (existing.releaseId !== expectedReleaseId || existing.grossMinor !== expectedPriceMinor) throw new PaymentError(409, "selection_changed", "The selected release or price does not match this checkout. Review the listing again.")
    if (existing.status === "processing" && existing.grossMinor === 0) return publicOrder(await completeFreeOrder(repo, existing, nowIso(options.clock || Date.now)))
    if (existing.status === "creating") {
      const resumed = await provider.createOrder({ ...existing, returnUrl: options.returnUrl, cancelUrl: options.cancelUrl })
      return publicOrder(await repo.updateOrder(existing.orderId, { providerOrderId: resumed.providerOrderId, approvalUrl: resumed.approvalUrl, status: "approval_pending" }))
    }
    return publicOrder(existing)
  }
  const listing = await repo.checkoutListing(listingId)
  validateListing(listing)
  if (listing.releaseId !== expectedReleaseId || listing.priceMinor !== expectedPriceMinor) throw new PaymentError(409, "selection_changed", "The selected release or price changed. Review the listing again.")
  if (listing.sellerUserId === session.userId) throw new PaymentError(409, "self_purchase", "Creators cannot purchase their own listing.")
  const at = nowIso(options.clock || Date.now)
  const orderId = uuid(repo.uuid)
  const cumulativeSalesMinor = await repo.creatorPaidSalesMinor(listing.sellerUserId, at)
  const feeRateBasisPoints = creatorFeeRate({ ...listing.creatorTerms, cumulativeSalesMinor, soldAt: at, publicPaidLaunchAt: options.publicPaidLaunchAt })
  const amounts = creatorAmounts(listing.priceMinor, feeRateBasisPoints)
  let order = await repo.insertOrder({
    orderId, buyerUserId: session.userId, sellerUserId: listing.sellerUserId, listingId, releaseId: listing.releaseId,
    title: listing.title, ...amounts, feeRateBasisPoints, currency: PAYMENT_CURRENCY, provider: listing.priceMinor === 0 ? "webcanbe-free" : "paypal",
    providerRequestId: `order-create:${orderId}`, idempotencyKey, status: listing.priceMinor === 0 ? "processing" : "creating", createdAt: at,
  })
  if (order.grossMinor === 0) return publicOrder(await completeFreeOrder(repo, order, at))
  const created = await provider.createOrder({ ...order, returnUrl: options.returnUrl, cancelUrl: options.cancelUrl })
  order = await repo.atomic(async tx => {
    const current = await tx.orderForUpdate(orderId)
    if (current.providerOrderId && current.providerOrderId !== created.providerOrderId) throw new PaymentError(409, "provider_order_conflict", "Checkout reconciliation is required.")
    return tx.updateOrder(orderId, { providerOrderId: created.providerOrderId, approvalUrl: created.approvalUrl, status: "approval_pending" })
  })
  return publicOrder(order)
}

function assertCapture(order, capture) {
  if (capture.status !== "COMPLETED" || capture.providerOrderId !== order.providerOrderId || capture.customId !== order.orderId || capture.grossMinor !== order.grossMinor || capture.currency !== order.currency) {
    throw new PaymentError(409, "capture_mismatch", "Captured payment does not match the Webcanbe order.")
  }
}

async function finalizeCapture(repo, orderId, capture) {
  return repo.atomic(async tx => {
    const order = await tx.orderForUpdate(orderId)
    if (order.status === "completed") return order
    try { assertCapture(order, capture) }
    catch (error) {
      await tx.updateOrder(orderId, { status: "reconciliation_required" })
      throw error
    }
    const first = await tx.insertPaymentIdentity({ provider: "paypal", kind: "capture", providerId: capture.providerCaptureId, orderId, occurredAt: capture.capturedAt })
    if (!first) return tx.orderForUpdate(orderId)
    const completed = await tx.updateOrder(orderId, { status: "completed", providerCaptureId: capture.providerCaptureId, completedAt: capture.capturedAt })
    await tx.ensureEntitlement({ entitlementId: uuid(repo.uuid), orderId, userId: order.buyerUserId, releaseId: order.releaseId, provider: "paypal", providerReference: capture.providerCaptureId, status: "active", grantedAt: capture.capturedAt })
    await tx.insertLedgerEntry({
      entryId: uuid(repo.uuid), idempotencyKey: `sale:${orderId}`, orderId, sellerUserId: order.sellerUserId, kind: "sale",
      grossMinor: order.grossMinor, platformFeeMinor: order.platformFeeMinor, creatorAmountMinor: order.creatorEarningMinor,
      currency: order.currency, provider: "paypal", providerReference: capture.providerCaptureId,
      holdUntil: addDays(capture.capturedAt, CREATOR_EARNING_HOLD_DAYS), state: "held", occurredAt: capture.capturedAt,
    })
    await tx.markCreatorFirstPaidListing(order.sellerUserId, capture.capturedAt)
    return completed
  })
}

export async function captureMarketplaceOrder(repo, provider, session, input) {
  exactObject(input, ["orderId", "providerOrderId"])
  if (Boolean(input.orderId) === Boolean(input.providerOrderId)) throw new PaymentError(422, "invalid_request", "Provide exactly one capture identifier.")
  const order = input.orderId
    ? await repo.orderById(domainId(input.orderId, "capture"))
    : await repo.orderByProviderOrder(providerId(input.providerOrderId, "capture"))
  if (!order || order.buyerUserId !== session.userId) throw new PaymentError(404, "order_not_found", "Order not found.")
  const orderId = order.orderId
  if (order.status === "completed") return publicOrder(order)
  if (order.status !== "approval_pending" || !order.providerOrderId) throw new PaymentError(409, "order_not_capturable", "Order is not ready to capture.")
  const capture = await provider.captureOrder(order.providerOrderId, `order-capture:${order.orderId}`)
  return publicOrder(await finalizeCapture(repo, orderId, capture))
}

export async function applyCaptureWebhook(repo, capture) {
  const order = await repo.orderByProviderOrder(capture.providerOrderId)
  if (!order) {
    await repo.flagReconciliation({ kind: "capture_without_order", providerId: capture.providerCaptureId, payload: capture })
    return { state: "reconciliation_required" }
  }
  return { state: "applied", order: publicOrder(await finalizeCapture(repo, order.orderId, capture)) }
}

export async function refundMarketplaceOrder(repo, provider, actor, input, clock = Date.now) {
  exactObject(input, ["orderId", "amountMinor", "idempotencyKey"])
  if (actor.authority !== "product_operator") throw new PaymentError(403, "refund_forbidden", "Refund operation refused.")
  const orderId = domainId(input.orderId, "refund")
  const refundMinor = moneyMinor(input.amountMinor, "refund amount")
  const key = paymentKey(input.idempotencyKey)
  const prior = await repo.refundByKey(key)
  if (prior) {
    if (prior.orderId !== orderId || prior.refundMinor !== refundMinor) throw new PaymentError(409, "idempotency_conflict", "This refund key belongs to another refund.")
    return prior
  }
  const order = await repo.orderById(orderId)
  if (!order || !["completed", "partially_refunded"].includes(order.status) || !order.providerCaptureId) throw new PaymentError(409, "order_not_refundable", "Order is not refundable.")
  const already = await repo.refundedMinor(orderId)
  if (refundMinor <= 0 || already + refundMinor > order.grossMinor) throw new PaymentError(422, "refund_amount_invalid", "Refund exceeds the captured amount.")
  const providerRefund = await provider.refundCapture(order.providerCaptureId, refundMinor, order.currency, `refund:${key}`)
  if (providerRefund.status !== "COMPLETED" || providerRefund.refundMinor !== refundMinor || providerRefund.currency !== order.currency) throw new PaymentError(409, "refund_mismatch", "Refund does not match the Webcanbe order.")
  return applyRefund(repo, { ...providerRefund, orderId, idempotencyKey: key, occurredAt: providerRefund.refundedAt || nowIso(clock) })
}

export async function applyRefund(repo, refund) {
  return repo.atomic(async tx => {
    const order = await tx.orderForUpdate(refund.orderId)
    moneyMinor(refund.refundMinor, "refund amount")
    if (refund.refundMinor <= 0 || refund.currency && refund.currency !== order.currency) throw new PaymentError(409, "refund_mismatch", "Refund does not match the Webcanbe order.")
    const existing = await tx.refundByProviderId(refund.providerRefundId)
    if (existing) return existing
    const previousMinor = await tx.refundedMinor(order.orderId)
    const cumulative = previousMinor + refund.refundMinor
    if (cumulative > order.grossMinor) throw new PaymentError(409, "refund_total_mismatch", "Refund total exceeds the captured payment.")
    const targetFee = Math.floor(order.platformFeeMinor * cumulative / order.grossMinor)
    const targetCreator = cumulative - targetFee
    const feeReversal = Math.max(0, targetFee - await tx.platformReversedMinor(order.orderId))
    const creatorReversal = Math.max(0, targetCreator - await tx.creatorReversedMinor(order.orderId))
    const row = await tx.insertRefund({ refundId: uuid(repo.uuid), orderId: order.orderId, providerRefundId: refund.providerRefundId, refundMinor: refund.refundMinor, currency: order.currency, idempotencyKey: refund.idempotencyKey || `webhook:${refund.providerRefundId}`, status: "completed", occurredAt: refund.occurredAt })
    const ledgerReversal = feeReversal + creatorReversal
    if (ledgerReversal > 0) await tx.insertLedgerEntry({ entryId: uuid(repo.uuid), idempotencyKey: `refund:${refund.providerRefundId}`, orderId: order.orderId, sellerUserId: order.sellerUserId, kind: "refund", grossMinor: -ledgerReversal, platformFeeMinor: -feeReversal, creatorAmountMinor: -creatorReversal, currency: order.currency, provider: "paypal", providerReference: refund.providerRefundId, holdUntil: refund.occurredAt, state: "available", occurredAt: refund.occurredAt })
    if (cumulative === order.grossMinor && order.status !== "disputed") {
      await tx.updateOrder(order.orderId, { status: "refunded", refundedAt: refund.occurredAt })
      await tx.revokeEntitlementForOrder(order.orderId, refund.occurredAt, "refund")
    } else if (order.status !== "disputed") await tx.updateOrder(order.orderId, { status: "partially_refunded" })
    return row
  })
}

export async function applyDispute(repo, dispute) {
  return repo.atomic(async tx => {
    const order = await tx.orderByCaptureForUpdate(dispute.providerCaptureId)
    if (!order) { await tx.flagReconciliation({ kind: "dispute_without_order", providerId: dispute.providerDisputeId, payload: dispute }); return { state: "reconciliation_required" } }
    const first = await tx.insertPaymentIdentity({ provider: "paypal", kind: "dispute", providerId: dispute.providerDisputeId, orderId: order.orderId, occurredAt: dispute.occurredAt })
    if (!first) return { state: "duplicate" }
    const creatorReversal = Math.max(0, order.creatorEarningMinor - await tx.creatorReversedMinor(order.orderId))
    const feeReversal = Math.max(0, order.platformFeeMinor - await tx.platformReversedMinor(order.orderId))
    const grossReversal = creatorReversal + feeReversal
    if (grossReversal > 0) await tx.insertLedgerEntry({ entryId: uuid(repo.uuid), idempotencyKey: `dispute:${dispute.providerDisputeId}`, orderId: order.orderId, sellerUserId: order.sellerUserId, kind: "dispute", grossMinor: -grossReversal, platformFeeMinor: -feeReversal, creatorAmountMinor: -creatorReversal, currency: order.currency, provider: "paypal", providerReference: dispute.providerDisputeId, holdUntil: dispute.occurredAt, state: "available", occurredAt: dispute.occurredAt })
    await tx.updateOrder(order.orderId, { status: "disputed" })
    await tx.revokeEntitlementForOrder(order.orderId, dispute.occurredAt, "dispute")
    return { state: "applied" }
  })
}

export function paypalSubscriptionNeedsReview(error) {
  return error?.providerHttpStatus === 404 && error?.providerName === "RESOURCE_NOT_FOUND" && error?.providerIssue === "INVALID_RESOURCE_ID"
}

async function verifiedPendingApproval(provider, subscription) {
  if (!subscription.providerSubscriptionId || !subscription.approvalUrl) throw new PaymentError(409, "subscription_reconciliation_required", "PayPal approval cannot be verified. Billing review is needed before another checkout.")
  let details
  try { details = await provider.getSubscription(subscription.providerSubscriptionId) }
  catch (error) {
    if (paypalSubscriptionNeedsReview(error)) throw new PaymentError(409, "subscription_reconciliation_required", "PayPal cannot verify this subscription. Billing review is needed before another checkout.")
    throw error
  }
  if (details?.id !== subscription.providerSubscriptionId || details?.custom_id !== subscription.subscriptionId || details?.plan_id !== subscription.providerPlanId) throw new PaymentError(409, "subscription_reconciliation_required", "PayPal subscription details do not match. Billing review is needed before another checkout.")
  if (details.status !== "APPROVAL_PENDING") throw new PaymentError(409, "subscription_verification_pending", "PayPal approval is no longer pending. Wait for verified billing status before another checkout.")
  return subscription
}

async function verifyAndStoreSubscription(repo, provider, subscription, options) {
  if (!subscription.providerSubscriptionId) {
    const created = await provider.createSubscription({ planId: subscription.providerPlanId, subscriptionId: subscription.subscriptionId, returnUrl: options.returnUrl, cancelUrl: options.cancelUrl, requestId: `subscription-create:${subscription.subscriptionId}` })
    subscription = await repo.updateSubscription(subscription.subscriptionId, { providerSubscriptionId: created.providerSubscriptionId, approvalUrl: created.approvalUrl })
  }
  try { await verifiedPendingApproval(provider, subscription) }
  catch (error) {
    if (paypalSubscriptionNeedsReview(error) || error?.code === "subscription_reconciliation_required") {
      await repo.markSubscriptionForReconciliation(subscription.subscriptionId, subscription.providerSubscriptionId)
    }
    throw error
  }
  return await repo.markSubscriptionApprovalPending(subscription.subscriptionId, subscription.providerSubscriptionId) || repo.subscriptionForUpdate(subscription.subscriptionId)
}

export async function verifyLivePlan(provider, providerPlanId, plan) {
  const remote = await provider.getPlan(providerPlanId, plan)
  const regular = Array.isArray(remote?.billing_cycles) ? remote.billing_cycles.find(cycle => cycle?.tenure_type === "REGULAR") : undefined
  const price = regular?.pricing_scheme?.fixed_price
  if (remote?.id !== providerPlanId || remote?.status !== "ACTIVE" || regular?.frequency?.interval_unit !== (plan.cadence === "month" ? "MONTH" : "YEAR") || Number(regular?.frequency?.interval_count) !== 1 || price?.currency_code !== PAYMENT_CURRENCY || Number(price?.value) !== plan.priceMinor / 100) {
    throw new PaymentError(409, "paypal_plan_unverified", "PayPal could not verify the selected plan and price. Billing review is needed before checkout.")
  }
}

export async function auditConfiguredPlans(provider, planIds) {
  const plans = await Promise.all(Object.entries(planIds).map(async ([key, providerPlanId]) => {
    const contract = WEB_CAN_BE_PLANS[key]
    if (!contract || !providerPlanId) throw new PaymentError(503, "plan_not_configured", "Subscription plan is not configured.")
    await verifyLivePlan(provider, providerPlanId, contract)
    return { key, providerPlanId, status: "ACTIVE", currency: PAYMENT_CURRENCY, priceMinor: contract.priceMinor, cadence: contract.cadence, contractMatches: true }
  }))
  return plans
}

export async function createPlanSubscription(repo, provider, session, input, options) {
  exactObject(input, ["planKey", "idempotencyKey"])
  const plan = WEB_CAN_BE_PLANS[input.planKey]
  if (!plan || plan.key === "free") throw new PaymentError(422, "plan_invalid", "Invalid subscription plan.")
  const key = paymentKey(input.idempotencyKey)
  const existing = await repo.subscriptionByUserKey(session.userId, key)
  if (existing) {
    if (existing.planKey !== plan.key) throw new PaymentError(409, "idempotency_conflict", "This subscription key belongs to another plan.")
    if (existing.status === "reconciliation_required") throw new PaymentError(409, "subscription_reconciliation_required", "Billing review is needed before another checkout.")
    if (existing.status === "creating") return verifyAndStoreSubscription(repo, provider, existing, options)
    if (existing.status === "approval_pending") return verifyAndStoreSubscription(repo, provider, existing, options)
    return existing
  }
  const current = await repo.currentSubscriptionForUser(session.userId)
  if (current) {
    if (current.status === "reconciliation_required") throw new PaymentError(409, "subscription_reconciliation_required", "Billing review is needed before another checkout.")
    const paidThrough = current.status === "cancelled" && current.currentPeriodEnd && new Date(current.currentPeriodEnd).getTime() > Number((options.clock || Date.now)())
    if (!["cancelled", "expired"].includes(current.status) || paidThrough) {
      if (current.planKey !== plan.key) throw new PaymentError(409, "plan_change_undefined", "Plan changes are not available yet.")
      return current.status === "approval_pending" ? verifyAndStoreSubscription(repo, provider, current, options) : current
    }
  }
  const subscriptionId = uuid(repo.uuid), at = nowIso(options.clock || Date.now), providerPlanId = options.planIds[plan.key]
  if (!providerPlanId) throw new PaymentError(503, "plan_not_configured", "Subscription plan is not configured.")
  await verifyLivePlan(provider, providerPlanId, plan)
  const subscription = await repo.insertSubscription({ subscriptionId, userId: session.userId, planKey: plan.key, provider: "paypal", providerPlanId, idempotencyKey: key, status: "creating", createdAt: at })
  return verifyAndStoreSubscription(repo, provider, subscription, options)
}

export async function applySubscriptionEvent(repo, event, clock = Date.now) {
  return repo.atomic(async tx => {
    const subscription = await tx.subscriptionByProviderIdForUpdate(event.providerSubscriptionId)
    if (!subscription) { await tx.flagReconciliation({ kind: "subscription_without_record", providerId: event.providerSubscriptionId, payload: event }); return { state: "reconciliation_required" } }
    const first = await tx.insertPaymentIdentity({ provider: "paypal", kind: event.kind, providerId: event.providerEventId, subscriptionId: subscription.subscriptionId, occurredAt: event.occurredAt })
    if (!first) return { state: "duplicate", subscription }
    if (subscription.lastProviderEventAt && new Date(event.occurredAt) < new Date(subscription.lastProviderEventAt)) return { state: "stale", subscription }
    if (["cancelled", "expired"].includes(subscription.status) && !["cancelled", "expired"].includes(event.kind)) {
      if (["activated", "recovered", "renewed"].includes(event.kind)) {
        await tx.flagReconciliation({ kind: "subscription_activation_after_terminal", providerId: event.providerPaymentId || event.providerEventId, payload: event })
        return { state: "reconciliation_required", subscription }
      }
      return { state: "terminal", subscription }
    }
    const patch = { lastProviderEventAt: event.occurredAt }
    if (event.kind === "activated" || event.kind === "recovered") Object.assign(patch, { status: "active", activeAt: subscription.activeAt || event.occurredAt, currentPeriodEnd: event.currentPeriodEnd || subscription.currentPeriodEnd })
    else if (event.kind === "renewed") {
      const plan = WEB_CAN_BE_PLANS[subscription.planKey]
      if (event.grossMinor !== plan.priceMinor || event.currency !== PAYMENT_CURRENCY) throw new PaymentError(409, "subscription_payment_mismatch", "Subscription payment does not match the Webcanbe plan.")
      const inserted = await tx.insertSubscriptionPayment({ subscriptionId: subscription.subscriptionId, providerPaymentId: event.providerPaymentId, grossMinor: event.grossMinor, currency: event.currency, occurredAt: event.occurredAt })
      if (!inserted) return { state: "duplicate", subscription }
      Object.assign(patch, { status: "active", currentPeriodEnd: event.currentPeriodEnd || subscription.currentPeriodEnd })
    } else if (event.kind === "cancelled") Object.assign(patch, { status: "cancelled", cancelledAt: event.occurredAt })
    else if (event.kind === "expired") Object.assign(patch, { status: "expired", expiredAt: event.occurredAt })
    else if (event.kind === "payment_failed" || event.kind === "suspended") Object.assign(patch, { status: "past_due", failedAt: event.occurredAt })
    else throw new PaymentError(422, "subscription_event_invalid", "Unsupported subscription event.")
    const updated = await tx.updateSubscription(subscription.subscriptionId, patch)
    if (updated.status === "active") await ensureMonthlyGrant(tx, updated, event.occurredAt || nowIso(clock))
    return { state: "applied", subscription: updated }
  })
}

export async function reconcileMonthlySubscriptionGrant(repo, subscriptionId, instant) {
  return repo.atomic(async tx => {
    const subscription = await tx.subscriptionForUpdate(subscriptionId)
    if (!subscription || !["active", "cancelled"].includes(subscription.status)) return undefined
    if (subscription.status === "cancelled" && !subscription.currentPeriodEnd) return undefined
    if (subscription.currentPeriodEnd && new Date(instant) >= new Date(subscription.currentPeriodEnd)) return undefined
    return ensureMonthlyGrant(tx, subscription, instant)
  })
}

async function ensureMonthlyGrant(repo, subscription, instant) {
  const plan = WEB_CAN_BE_PLANS[subscription.planKey]
  const month = grantMonth(instant)
  const expires = new Date(`${month}-01T00:00:00.000Z`)
  expires.setUTCMonth(expires.getUTCMonth() + 1)
  return repo.ensureAiGrant({ grantId: uuid(repo.uuid), userId: subscription.userId, subscriptionId: subscription.subscriptionId, grantMonth: month, includedActions: plan.monthlyAiActions, expiresAt: expires.toISOString(), idempotencyKey: `subscription:${subscription.subscriptionId}:${month}`, createdAt: instant })
}

export async function buildPayoutBatch(repo, instant, offsetMinutes = 540) {
  const dateKey = payoutDateKey(instant, offsetMinutes)
  const batchKey = `creator-payout:${dateKey}`
  const existing = await repo.payoutBatchByKey(batchKey)
  if (existing) return existing
  return repo.atomic(async tx => {
    const lockedExisting = await tx.payoutBatchByKey(batchKey)
    if (lockedExisting) return lockedExisting
    const entries = await tx.availableLedgerEntries(instant)
    const bySeller = new Map()
    for (const entry of entries) {
      const group = bySeller.get(entry.sellerUserId) || []
      group.push(entry); bySeller.set(entry.sellerUserId, group)
    }
    const members = []
    for (const [sellerUserId, rows] of [...bySeller].sort(([a], [b]) => a.localeCompare(b))) {
      const amountMinor = rows.reduce((sum, row) => sum + row.creatorAmountMinor, 0)
      if (amountMinor >= MINIMUM_PAYOUT_MINOR) members.push({ sellerUserId, amountMinor, currency: PAYMENT_CURRENCY, ledgerEntryIds: rows.map(row => row.entryId).sort() })
    }
    return tx.insertPayoutBatch({ batchId: uuid(repo.uuid), batchKey, scheduledFor: dateKey, status: "pending_manual_execution", members, createdAt: instant })
  })
}

export async function reconcileManualPayout(repo, input) {
  exactObject(input, ["batchId", "providerReference", "confirmedPaidAt"])
  const batchId = domainId(input.batchId, "payout")
  if (typeof input.providerReference !== "string" || !input.providerReference.trim() || typeof input.confirmedPaidAt !== "string" || !Number.isFinite(new Date(input.confirmedPaidAt).getTime())) throw new PaymentError(422, "payout_evidence_invalid", "Actual provider payout evidence is required.")
  return repo.atomic(async tx => {
    const batch = await tx.payoutBatchForUpdate(batchId)
    if (!batch) throw new PaymentError(404, "payout_not_found", "Payout batch not found.")
    if (batch.status === "paid") {
      if (batch.providerReference !== input.providerReference) throw new PaymentError(409, "payout_reference_conflict", "Payout batch was reconciled to another provider reference.")
      return batch
    }
    await tx.markPayoutEntriesPaid(batch, input.confirmedPaidAt)
    return tx.updatePayoutBatch(batchId, { status: "paid", providerReference: input.providerReference.trim(), paidAt: input.confirmedPaidAt })
  })
}

export async function recordVerifiedWebhook(repo, event, apply) {
  if (!event || typeof event.id !== "string" || typeof event.event_type !== "string") throw new PaymentError(400, "webhook_invalid", "Invalid PayPal webhook.")
  const inserted = await repo.insertProviderEvent({ provider: "paypal", providerEventId: event.id, eventType: event.event_type, occurredAt: event.create_time || new Date().toISOString(), payload: event })
  if (!inserted) return { state: "duplicate" }
  try {
    const result = await apply(event)
    await repo.markProviderEventProcessed(event.id)
    return result
  } catch (error) {
    await repo.markProviderEventFailed(event.id, error instanceof Error ? error.message : "Webhook processing failed.")
    throw error
  }
}
