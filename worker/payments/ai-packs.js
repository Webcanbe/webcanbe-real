import { randomUUID } from "node:crypto"
import { AI_ACTION_PACKS, PAYMENT_CURRENCY, PaymentError, domainId, exactObject, paymentKey, providerId } from "./contracts.js"

const uuid = factory => (factory || randomUUID)()
const output = order => Object.freeze({ aiPackOrderId: order.aiPackOrderId, packKey: order.packKey, actions: order.actions, grossMinor: order.grossMinor, currency: order.currency, status: order.status, ...(order.status === "approval_pending" && order.approvalUrl ? { approvalUrl: order.approvalUrl } : {}) })

async function verifyOrder(repo, provider, order) {
  let details
  try { details = await provider.getOrder(order.providerOrderId) }
  catch (error) {
    if (error?.providerHttpStatus !== 404) throw error
    await repo.updateAiPackOrder(order.aiPackOrderId, { status: "reconciliation_required", approvalUrl: null })
    throw new PaymentError(409, "ai_pack_reconciliation_required", "PayPal could not verify this order. Start a new checkout attempt after billing review.")
  }
  const unit = details?.purchase_units?.[0]
  const valid = details?.id === order.providerOrderId && unit?.reference_id === order.aiPackOrderId && unit?.custom_id === order.aiPackOrderId && unit?.amount?.currency_code === order.currency && unit?.amount?.value === `${Math.floor(order.grossMinor / 100)}.${String(order.grossMinor % 100).padStart(2, "0")}`
  if (!valid || !["CREATED", "PAYER_ACTION_REQUIRED"].includes(details.status)) {
    await repo.updateAiPackOrder(order.aiPackOrderId, { status: "reconciliation_required", approvalUrl: null })
    throw new PaymentError(409, "ai_pack_reconciliation_required", "PayPal order details need billing review before another checkout.")
  }
  return details
}

async function finishOrderCreation(repo, provider, order, options) {
  if (!order.providerOrderId) {
    const created = await provider.createOrder({ orderId: order.aiPackOrderId, providerRequestId: order.providerRequestId, title: `${order.actions} AI Actions`, grossMinor: order.grossMinor, currency: order.currency, returnUrl: options.returnUrl, cancelUrl: options.cancelUrl })
    order = await repo.updateAiPackOrder(order.aiPackOrderId, { providerOrderId: created.providerOrderId, approvalUrl: created.approvalUrl })
  }
  await verifyOrder(repo, provider, order)
  return output(await repo.updateAiPackOrder(order.aiPackOrderId, { status: "approval_pending" }))
}

export async function createAiPackOrder(repo, provider, session, input, options) {
  exactObject(input, ["packKey", "idempotencyKey"], "Only packKey and idempotencyKey are accepted.")
  const pack = AI_ACTION_PACKS[input.packKey]
  if (!pack) throw new PaymentError(422, "ai_pack_invalid", "Invalid AI Action pack.")
  const key = paymentKey(input.idempotencyKey)
  const existing = await repo.aiPackOrderByUserKey(session.userId, key)
  if (existing) {
    if (existing.packKey !== pack.key) throw new PaymentError(409, "idempotency_conflict", "This checkout key belongs to another AI pack.")
    if (existing.status === "creating") return finishOrderCreation(repo, provider, existing, options)
    if (existing.status === "approval_pending") await verifyOrder(repo, provider, existing)
    return output(existing)
  }
  const aiPackOrderId = uuid(repo.uuid), createdAt = new Date((options.clock || Date.now)()).toISOString()
  const order = await repo.insertAiPackOrder({ aiPackOrderId, userId: session.userId, packKey: pack.key, actions: pack.actions, grossMinor: pack.priceMinor, currency: PAYMENT_CURRENCY, provider: "paypal", providerRequestId: `ai-pack-create:${aiPackOrderId}`, idempotencyKey: key, status: "creating", createdAt })
  return finishOrderCreation(repo, provider, order, options)
}

async function finalize(repo, aiPackOrderId, capture) {
  const candidate = await repo.aiPackOrderById(aiPackOrderId)
  const result = await repo.atomic(async tx => {
    await tx.lockPaymentCapture(capture.providerCaptureId)
    await tx.lockAiUsageUser(candidate.userId)
    const order = await tx.aiPackOrderForUpdate(aiPackOrderId)
    if (order.status === "completed") return order
    if (capture.status !== "COMPLETED" || capture.providerOrderId !== order.providerOrderId || capture.customId !== order.aiPackOrderId || capture.grossMinor !== order.grossMinor || capture.currency !== order.currency) {
      await tx.updateAiPackOrder(aiPackOrderId, { status: "reconciliation_required" })
      return { mismatch: true }
    }
    const first = await tx.insertPaymentIdentity({ provider: "paypal", kind: "ai_pack_capture", providerId: capture.providerCaptureId, aiPackOrderId, occurredAt: capture.capturedAt })
    if (!first) return tx.aiPackOrderForUpdate(aiPackOrderId)
    let completed = await tx.updateAiPackOrder(aiPackOrderId, { status: "completed", providerCaptureId: capture.providerCaptureId, completedAt: capture.capturedAt })
    await tx.ensurePurchasedAiCredit({ creditId: uuid(repo.uuid), userId: order.userId, aiPackOrderId, purchasedActions: order.actions, providerReference: capture.providerCaptureId, idempotencyKey: `ai-pack:${aiPackOrderId}`, createdAt: capture.capturedAt })
    const pending = await tx.paymentReversalForCaptureForUpdate(capture.providerCaptureId, order.currency)
    if (pending) {
      await tx.revokePurchasedAiCredit(aiPackOrderId, pending.occurredAt, pending.kind)
      completed = await tx.updateAiPackOrder(aiPackOrderId, { status: pending.kind === "refund" ? "refunded" : "reconciliation_required" })
    }
    return completed
  })
  if (result?.mismatch) throw new PaymentError(409, "capture_mismatch", "Captured payment does not match the Webcanbe AI pack order.")
  return result
}

export async function captureAiPackOrder(repo, provider, session, input) {
  exactObject(input, ["aiPackOrderId", "providerOrderId"])
  if (Boolean(input.aiPackOrderId) === Boolean(input.providerOrderId)) throw new PaymentError(422, "invalid_request", "Provide exactly one AI pack capture identifier.")
  const order = input.aiPackOrderId
    ? await repo.aiPackOrderById(domainId(input.aiPackOrderId, "AI pack capture"))
    : await repo.aiPackOrderByProviderOrder(providerId(input.providerOrderId, "AI pack capture"))
  if (!order || order.userId !== session.userId) throw new PaymentError(404, "ai_pack_order_not_found", "AI pack order not found.")
  const id = order.aiPackOrderId
  if (order.status === "completed") return output(order)
  if (order.status !== "approval_pending") throw new PaymentError(409, "order_not_capturable", "AI pack order is not ready to capture.")
  return output(await finalize(repo, id, await provider.captureOrder(order.providerOrderId, `ai-pack-capture:${id}`)))
}

export async function applyAiPackCaptureWebhook(repo, capture) {
  const order = await repo.aiPackOrderByProviderOrder(capture.providerOrderId)
  if (!order) return undefined
  return { state: "applied", aiPackOrder: output(await finalize(repo, order.aiPackOrderId, capture)) }
}

async function applyAiPackReversal(repo, reversal) {
  return repo.atomic(async tx => {
    await tx.lockPaymentCapture(reversal.providerCaptureId)
    const candidate = await tx.aiPackOrderByCapture(reversal.providerCaptureId)
    if (candidate && reversal.reason === "refund" && reversal.refundMinor !== candidate.grossMinor) {
      await tx.lockAiUsageUser(candidate.userId)
      const first = await tx.insertPaymentIdentity({ provider: "paypal", kind: "ai_pack_partial_refund", providerId: reversal.providerId, aiPackOrderId: candidate.aiPackOrderId, occurredAt: reversal.occurredAt })
      if (!first) return { state: "duplicate", aiPackOrder: output(candidate) }
      await tx.revokePurchasedAiCredit(candidate.aiPackOrderId, reversal.occurredAt, "partial_refund")
      await tx.flagReconciliation({ kind: "ai_pack_partial_refund", providerId: reversal.providerId, payload: { providerCaptureId: reversal.providerCaptureId, refundMinor: reversal.refundMinor, expectedMinor: candidate.grossMinor } })
      return { state: "reconciliation_required", aiPackOrder: output(await tx.updateAiPackOrder(candidate.aiPackOrderId, { status: "reconciliation_required" })) }
    }
    await tx.recordPaymentReversal({ provider: "paypal", kind: reversal.reason, providerId: reversal.providerId, providerCaptureId: reversal.providerCaptureId, currency: reversal.currency, occurredAt: reversal.occurredAt })
    if (!candidate) return undefined
    await tx.lockAiUsageUser(candidate.userId)
    const order = await tx.aiPackOrderByCaptureForUpdate(reversal.providerCaptureId)
    if (!order) return undefined
    if (reversal.currency && reversal.currency !== order.currency) throw new PaymentError(409, "ai_pack_reversal_mismatch", "AI pack reversal does not match the captured order.")
    const kind = reversal.reason === "refund" ? "ai_pack_refund" : "ai_pack_dispute"
    const first = await tx.insertPaymentIdentity({ provider: "paypal", kind, providerId: reversal.providerId, aiPackOrderId: order.aiPackOrderId, occurredAt: reversal.occurredAt })
    if (!first) return { state: "duplicate", aiPackOrder: output(order) }
    await tx.revokePurchasedAiCredit(order.aiPackOrderId, reversal.occurredAt, reversal.reason)
    const status = order.status === "refunded" || reversal.reason === "refund" ? "refunded" : "reconciliation_required"
    return { state: "applied", aiPackOrder: output(await tx.updateAiPackOrder(order.aiPackOrderId, { status })) }
  })
}

export function applyAiPackRefund(repo, refund) {
  return applyAiPackReversal(repo, { ...refund, providerId: refund.providerRefundId, reason: "refund" })
}

export function applyAiPackDispute(repo, dispute) {
  return applyAiPackReversal(repo, { ...dispute, providerId: dispute.providerDisputeId, reason: "dispute" })
}
