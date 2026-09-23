import { PaymentError, parseMoney } from "./contracts.js"
import { applyCaptureWebhook, applyDispute, applyRefund, applySubscriptionEvent, recordVerifiedWebhook } from "./domain.js"
import { applyAiPackCaptureWebhook, applyAiPackDispute, applyAiPackRefund } from "./ai-packs.js"

const time = event => String(event.create_time || event.resource?.update_time || event.resource?.create_time || new Date().toISOString())

function related(resource, key) {
  return resource?.supplementary_data?.related_ids?.[key] || resource?.links?.find(link => link?.rel === "up")?.href?.split("/").pop()
}

function captureEvent(event) {
  const resource = event.resource || {}
  return {
    providerOrderId: String(related(resource, "order_id") || ""),
    providerCaptureId: String(resource.id || ""),
    status: String(resource.status || ""),
    grossMinor: parseMoney(resource.amount?.value),
    currency: String(resource.amount?.currency_code || ""),
    customId: String(resource.custom_id || resource.invoice_id || ""),
    capturedAt: time(event),
  }
}

function subscriptionEvent(event, kind) {
  const resource = event.resource || {}
  const billing = resource.billing_info || {}
  return {
    kind,
    providerEventId: event.id,
    providerSubscriptionId: String(resource.billing_agreement_id || resource.id || ""),
    ...(resource.id && event.event_type === "PAYMENT.SALE.COMPLETED" ? { providerPaymentId: String(resource.id) } : {}),
    ...(resource.amount?.total ? { grossMinor: parseMoney(resource.amount.total), currency: String(resource.amount.currency || "") } : {}),
    ...(billing.next_billing_time ? { currentPeriodEnd: String(billing.next_billing_time) } : {}),
    occurredAt: time(event),
  }
}

export async function processPayPalEvent(repo, event) {
  switch (event.event_type) {
    case "PAYMENT.CAPTURE.COMPLETED": {
      const capture = captureEvent(event)
      const pack = await applyAiPackCaptureWebhook(repo, capture)
      return pack || applyCaptureWebhook(repo, capture)
    }
    case "PAYMENT.CAPTURE.REFUNDED": {
      const resource = event.resource || {}
      const providerCaptureId = String(related(resource, "capture_id") || "")
      const pack = await applyAiPackRefund(repo, { providerCaptureId, providerRefundId: String(resource.id || ""), refundMinor: parseMoney(resource.amount?.value), currency: String(resource.amount?.currency_code || ""), occurredAt: time(event) })
      if (pack) return pack
      const order = await repo.orderByCapture(providerCaptureId)
      if (!order) { await repo.flagReconciliation({ kind: "refund_without_order", providerId: String(resource.id || ""), payload: event }); return { state: "reconciliation_required" } }
      return { state: "applied", refund: await applyRefund(repo, { orderId: order.orderId, providerRefundId: String(resource.id), refundMinor: parseMoney(resource.amount?.value), currency: String(resource.amount?.currency_code || ""), occurredAt: time(event) }) }
    }
    case "PAYMENT.CAPTURE.REVERSED":
    case "CUSTOMER.DISPUTE.CREATED": {
      const resource = event.resource || {}
      const dispute = { providerDisputeId: String(resource.dispute_id || resource.id || event.id), providerCaptureId: String(related(resource, "capture_id") || resource.disputed_transactions?.[0]?.seller_transaction_id || ""), occurredAt: time(event) }
      const pack = await applyAiPackDispute(repo, dispute)
      return pack || applyDispute(repo, dispute)
    }
    case "BILLING.SUBSCRIPTION.ACTIVATED": return applySubscriptionEvent(repo, subscriptionEvent(event, "activated"))
    case "BILLING.SUBSCRIPTION.CANCELLED": return applySubscriptionEvent(repo, subscriptionEvent(event, "cancelled"))
    case "BILLING.SUBSCRIPTION.EXPIRED": return applySubscriptionEvent(repo, subscriptionEvent(event, "expired"))
    case "BILLING.SUBSCRIPTION.PAYMENT.FAILED": return applySubscriptionEvent(repo, subscriptionEvent(event, "payment_failed"))
    case "BILLING.SUBSCRIPTION.SUSPENDED": return applySubscriptionEvent(repo, subscriptionEvent(event, "suspended"))
    case "PAYMENT.SALE.COMPLETED": return applySubscriptionEvent(repo, subscriptionEvent(event, "renewed"))
    case "PAYMENT.SALE.REFUNDED":
    case "PAYMENT.SALE.REVERSED":
    case "CUSTOMER.DISPUTE.RESOLVED":
    case "CHECKOUT.ORDER.APPROVED":
    case "PAYMENT.CAPTURE.DENIED":
      await repo.flagReconciliation({ kind: "provider_event_requires_reconciliation", providerId: event.id, payload: event })
      return { state: "reconciliation_required" }
    default:
      return { state: "ignored" }
  }
}

export async function handlePayPalWebhook(request, repo, provider) {
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } })
  const rawBody = await request.text()
  let event
  try { event = await provider.verifyWebhook(rawBody, request.headers) }
  catch (error) {
    const status = error instanceof PaymentError ? error.status : 403
    return new Response(JSON.stringify({ error: "PayPal webhook verification failed." }), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } })
  }
  try {
    const result = await recordVerifiedWebhook(repo, event, verified => processPayPalEvent(repo, verified))
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } })
  } catch {
    return new Response(JSON.stringify({ error: "PayPal webhook processing is temporarily unavailable." }), { status: 503, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "60" } })
  }
}
