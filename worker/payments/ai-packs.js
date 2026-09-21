import { randomUUID } from "node:crypto"
import { AI_ACTION_PACKS, PAYMENT_CURRENCY, PaymentError, domainId, exactObject, paymentKey } from "./contracts.js"

const uuid = factory => (factory || randomUUID)()
const output = order => Object.freeze({ aiPackOrderId: order.aiPackOrderId, packKey: order.packKey, actions: order.actions, grossMinor: order.grossMinor, currency: order.currency, status: order.status, ...(order.approvalUrl ? { approvalUrl: order.approvalUrl } : {}) })

export async function createAiPackOrder(repo, provider, session, input, options) {
  exactObject(input, ["packKey", "idempotencyKey"], "Only packKey and idempotencyKey are accepted.")
  const pack = AI_ACTION_PACKS[input.packKey]
  if (!pack) throw new PaymentError(422, "ai_pack_invalid", "Invalid AI Action pack.")
  const key = paymentKey(input.idempotencyKey)
  const existing = await repo.aiPackOrderByUserKey(session.userId, key)
  if (existing) {
    if (existing.packKey !== pack.key) throw new PaymentError(409, "idempotency_conflict", "This checkout key belongs to another AI pack.")
    if (existing.status === "creating") {
      const resumed = await provider.createOrder({ orderId: existing.aiPackOrderId, providerRequestId: existing.providerRequestId, title: `${existing.actions} AI Actions`, grossMinor: existing.grossMinor, currency: existing.currency, returnUrl: options.returnUrl, cancelUrl: options.cancelUrl })
      return output(await repo.updateAiPackOrder(existing.aiPackOrderId, { providerOrderId: resumed.providerOrderId, approvalUrl: resumed.approvalUrl, status: "approval_pending" }))
    }
    return output(existing)
  }
  const aiPackOrderId = uuid(repo.uuid), createdAt = new Date((options.clock || Date.now)()).toISOString()
  let order = await repo.insertAiPackOrder({ aiPackOrderId, userId: session.userId, packKey: pack.key, actions: pack.actions, grossMinor: pack.priceMinor, currency: PAYMENT_CURRENCY, provider: "paypal", providerRequestId: `ai-pack-create:${aiPackOrderId}`, idempotencyKey: key, status: "creating", createdAt })
  const created = await provider.createOrder({ orderId: aiPackOrderId, providerRequestId: order.providerRequestId, title: `${pack.actions} AI Actions`, grossMinor: pack.priceMinor, currency: PAYMENT_CURRENCY, returnUrl: options.returnUrl, cancelUrl: options.cancelUrl })
  order = await repo.updateAiPackOrder(aiPackOrderId, { providerOrderId: created.providerOrderId, approvalUrl: created.approvalUrl, status: "approval_pending" })
  return output(order)
}

async function finalize(repo, aiPackOrderId, capture) {
  const candidate = await repo.aiPackOrderById(aiPackOrderId)
  return repo.atomic(async tx => {
    await tx.lockAiUsageUser(candidate.userId)
    const order = await tx.aiPackOrderForUpdate(aiPackOrderId)
    if (order.status === "completed") return order
    if (capture.status !== "COMPLETED" || capture.providerOrderId !== order.providerOrderId || capture.customId !== order.aiPackOrderId || capture.grossMinor !== order.grossMinor || capture.currency !== order.currency) {
      await tx.updateAiPackOrder(aiPackOrderId, { status: "reconciliation_required" })
      throw new PaymentError(409, "capture_mismatch", "Captured payment does not match the Webcanbe AI pack order.")
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
}

export async function captureAiPackOrder(repo, provider, session, input) {
  exactObject(input, ["aiPackOrderId"])
  const id = domainId(input.aiPackOrderId, "AI pack capture")
  const order = await repo.aiPackOrderById(id)
  if (!order || order.userId !== session.userId) throw new PaymentError(404, "ai_pack_order_not_found", "AI pack order not found.")
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
  await repo.recordPaymentReversal({ provider: "paypal", kind: reversal.reason, providerId: reversal.providerId, providerCaptureId: reversal.providerCaptureId, currency: reversal.currency, occurredAt: reversal.occurredAt })
  const candidate = await repo.aiPackOrderByCapture(reversal.providerCaptureId)
  if (!candidate) return undefined
  return repo.atomic(async tx => {
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
