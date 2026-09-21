import { AI_ACTION_COST, AI_ACTION_PACKS, PAYMENT_CURRENCY, PAYPAL_WEBHOOK_EVENTS, WEB_CAN_BE_PLANS, PaymentError, domainId, paypalPlanMapping } from "./contracts.js"
import { captureMarketplaceOrder, createMarketplaceOrder, createPlanSubscription } from "./domain.js"
import { captureAiPackOrder, createAiPackOrder } from "./ai-packs.js"

const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers })

async function body(request) {
  const type = request.headers.get("Content-Type") || ""
  if (!type.toLowerCase().startsWith("application/json")) throw new PaymentError(415, "content_type_invalid", "Payment requests must use JSON.")
  const length = Number(request.headers.get("Content-Length") || 0)
  if (length > 16 * 1024) throw new PaymentError(413, "payment_request_too_large", "Payment request is too large.")
  try { return await request.json() } catch { throw new PaymentError(400, "json_invalid", "Invalid payment request.") }
}

export function publicPaymentConfiguration() {
  return Object.freeze({
    currency: PAYMENT_CURRENCY,
    plans: Object.values(WEB_CAN_BE_PLANS),
    aiActionPacks: Object.values(AI_ACTION_PACKS),
    aiActionCost: AI_ACTION_COST,
  })
}

export async function handlePrivatePaymentRequest(request, path, { repo, provider, session, env, clock = Date.now }) {
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } })
  try {
    if (path === "/__webcanbe/api/payments/orders/create") {
      const order = await createMarketplaceOrder(repo, provider, session, await body(request), {
        clock,
        publicPaidLaunchAt: env.WEBCANBE_PAID_MARKET_LAUNCH_AT,
        returnUrl: "https://webcanbe.com/purchases?payment=return",
        cancelUrl: "https://webcanbe.com/marketplace?payment=cancelled",
      })
      return json({ order }, 201)
    }
    if (path === "/__webcanbe/api/payments/orders/capture") {
      return json({ order: await captureMarketplaceOrder(repo, provider, session, await body(request)) })
    }
    if (path === "/__webcanbe/api/payments/subscriptions/create") {
      const subscription = await createPlanSubscription(repo, provider, session, await body(request), {
        clock,
        planIds: paypalPlanMapping(env),
        returnUrl: "https://webcanbe.com/dashboard/billing?subscription=return",
        cancelUrl: "https://webcanbe.com/plans?subscription=cancelled",
      })
      return json({ subscription }, 201)
    }
    if (path === "/__webcanbe/api/payments/ai-packs/create") {
      return json({ order: await createAiPackOrder(repo, provider, session, await body(request), { clock, returnUrl: "https://webcanbe.com/dashboard/billing?ai-pack=return", cancelUrl: "https://webcanbe.com/dashboard/billing?ai-pack=cancelled" }) }, 201)
    }
    if (path === "/__webcanbe/api/payments/ai-packs/capture") {
      return json({ order: await captureAiPackOrder(repo, provider, session, await body(request)) })
    }
    if (path === "/__webcanbe/api/payments/subscriptions/cancel") {
      const input = await body(request)
      const subscriptionId = domainId(input?.subscriptionId, "subscription")
      if (Object.keys(input || {}).some(key => key !== "subscriptionId")) throw new PaymentError(422, "invalid_request", "Invalid subscription request.")
      const subscription = await repo.subscriptionForUpdate(subscriptionId)
      if (!subscription || subscription.userId !== session.userId) throw new PaymentError(404, "subscription_not_found", "Subscription not found.")
      if (subscription.status === "cancelled" || subscription.status === "expired") return json({ subscription })
      await provider.cancelSubscription(subscription.providerSubscriptionId)
      return json({ subscription: await repo.updateSubscription(subscriptionId, { status: "cancelled", cancelledAt: new Date(clock()).toISOString() }) })
    }
    return json({ error: "Payment operation is unavailable." }, 404)
  } catch (error) {
    if (error instanceof PaymentError) return json({ error: error.message, code: error.code }, error.status)
    return json({ error: "Payment operation is temporarily unavailable." }, 503)
  }
}

export const PAYPAL_DASHBOARD_WEBHOOK = Object.freeze({
  url: "https://webcanbe.com/__webcanbe/api/payments/webhooks/paypal",
  events: PAYPAL_WEBHOOK_EVENTS,
})
