import { AI_ACTION_COST, AI_ACTION_PACKS, MINIMUM_PAID_LISTING_MINOR, PAYMENT_CURRENCY, PAYPAL_WEBHOOK_EVENTS, WEB_CAN_BE_PLANS, PaymentError, domainId, paypalPlanMapping } from "./contracts.js"
import { captureMarketplaceOrder, createMarketplaceOrder, createPlanSubscription, paypalSubscriptionNeedsReview } from "./domain.js"
import { captureAiPackOrder, createAiPackOrder } from "./ai-packs.js"

const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers })

export const PAYMENT_RETURN_URLS = Object.freeze({
  marketplaceReturn: "https://webcanbe.com/checkout/return?payment=return",
  marketplaceCancel: "https://webcanbe.com/checkout/return?payment=cancelled",
  subscriptionReturn: "https://webcanbe.com/settings?subscription=return",
  subscriptionCancel: "https://webcanbe.com/settings?subscription=cancelled",
  aiPackReturn: "https://webcanbe.com/settings?ai-pack=return",
  aiPackCancel: "https://webcanbe.com/settings?ai-pack=cancelled",
})

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
    marketplace: Object.freeze({ minimumPaidListingMinor: MINIMUM_PAID_LISTING_MINOR, freeListingsAllowed: true }),
  })
}

export async function handlePrivatePaymentRequest(request, path, { repo, provider, session, env, clock = Date.now }) {
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } })
  try {
    if (path === "/__webcanbe/api/payments/status") {
      const [subscription, aiActions] = await Promise.all([
        repo.currentSubscriptionForUser(session.userId),
        repo.aiActionBalanceForUser(session.userId),
      ])
      const paidThroughCancellation = subscription?.status === "cancelled" && subscription.currentPeriodEnd && new Date(subscription.currentPeriodEnd).getTime() > Number(clock())
      return json({ billing: {
        currentPlanKey: subscription?.status === "active" || paidThroughCancellation ? subscription.planKey : "free",
        subscription: subscription ? {
          subscriptionId: subscription.subscriptionId,
          planKey: subscription.planKey,
          status: subscription.status,
          createdAt: subscription.createdAt,
          ...(subscription.currentPeriodEnd ? { currentPeriodEnd: subscription.currentPeriodEnd } : {}),
          ...(subscription.cancelledAt ? { cancelledAt: subscription.cancelledAt } : {}),
          ...(subscription.failedAt ? { failedAt: subscription.failedAt } : {}),
        } : null,
        aiActions,
      } })
    }
    if (path === "/__webcanbe/api/payments/orders/create") {
      const order = await createMarketplaceOrder(repo, provider, session, await body(request), {
        clock,
        publicPaidLaunchAt: env.WEBCANBE_PAID_MARKET_LAUNCH_AT,
        returnUrl: PAYMENT_RETURN_URLS.marketplaceReturn,
        cancelUrl: PAYMENT_RETURN_URLS.marketplaceCancel,
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
        returnUrl: PAYMENT_RETURN_URLS.subscriptionReturn,
        cancelUrl: PAYMENT_RETURN_URLS.subscriptionCancel,
      })
      return json({ subscription }, 201)
    }
    if (path === "/__webcanbe/api/payments/subscriptions/inspect") {
      const input = await body(request)
      const subscriptionId = domainId(input?.subscriptionId, "subscription")
      if (Object.keys(input || {}).some(key => key !== "subscriptionId")) throw new PaymentError(422, "invalid_request", "Invalid subscription request.")
      const subscription = await repo.subscriptionForUpdate(subscriptionId)
      if (!subscription || subscription.userId !== session.userId) throw new PaymentError(404, "subscription_not_found", "Subscription not found.")
      if (!subscription.providerSubscriptionId) return json({ provider: { status: "NOT_CREATED", planMatches: false, referenceMatches: false } })
      let details
      try { details = await provider.getSubscription(subscription.providerSubscriptionId) }
      catch (error) {
        if (paypalSubscriptionNeedsReview(error)) return json({ provider: { status: "RECONCILIATION_REQUIRED", planMatches: false, referenceMatches: false, message: "PayPal cannot verify this subscription. Billing review is needed before another checkout." } })
        throw error
      }
      const reason = details?.billing_info?.last_failed_payment?.reason_code
      return json({ provider: {
        status: typeof details?.status === "string" ? details.status : "UNKNOWN",
        planMatches: details?.plan_id === subscription.providerPlanId,
        referenceMatches: details?.id === subscription.providerSubscriptionId && details?.custom_id === subscription.subscriptionId,
        ...(typeof reason === "string" ? { lastFailedReason: reason } : {}),
      } })
    }
    if (path === "/__webcanbe/api/payments/ai-packs/create") {
      return json({ order: await createAiPackOrder(repo, provider, session, await body(request), { clock, returnUrl: PAYMENT_RETURN_URLS.aiPackReturn, cancelUrl: PAYMENT_RETURN_URLS.aiPackCancel }) }, 201)
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
