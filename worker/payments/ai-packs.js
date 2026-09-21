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
  return repo.atomic(async tx => {
    const order = await tx.aiPackOrderForUpdate(aiPackOrderId)
    if (order.status === "completed") return order
    if (capture.status !== "COMPLETED" || capture.providerOrderId !== order.providerOrderId || capture.customId !== order.aiPackOrderId || capture.grossMinor !== order.grossMinor || capture.currency !== order.currency) {
      await tx.updateAiPackOrder(aiPackOrderId, { status: "reconciliation_required" })
      throw new PaymentError(409, "capture_mismatch", "Captured payment does not match the Webcanbe AI pack order.")
    }
    const first = await tx.insertPaymentIdentity({ provider: "paypal", kind: "ai_pack_capture", providerId: capture.providerCaptureId, occurredAt: capture.capturedAt })
    if (!first) return tx.aiPackOrderForUpdate(aiPackOrderId)
    const completed = await tx.updateAiPackOrder(aiPackOrderId, { status: "completed", providerCaptureId: capture.providerCaptureId, completedAt: capture.capturedAt })
    await tx.ensurePurchasedAiCredit({ creditId: uuid(repo.uuid), userId: order.userId, aiPackOrderId, purchasedActions: order.actions, providerReference: capture.providerCaptureId, idempotencyKey: `ai-pack:${aiPackOrderId}`, createdAt: capture.capturedAt })
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
