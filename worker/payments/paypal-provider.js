import { PaymentError, moneyString, parseMoney } from "./contracts.js"

const SANDBOX = "https://api-m.sandbox.paypal.com"
const LIVE = "https://api-m.paypal.com"

function requireText(value, code) {
  if (typeof value !== "string" || !value) throw new PaymentError(503, code, "PayPal is not configured.")
  return value
}

function providerError(status, body, headers) {
  const debug = body && typeof body === "object" && typeof body.debug_id === "string" ? body.debug_id : headers?.get?.("paypal-debug-id")
  const name = body && typeof body === "object" && typeof body.name === "string" && /^[A-Z][A-Z0-9_]{0,63}$/.test(body.name) ? body.name : undefined
  const issues = Array.isArray(body?.details) ? body.details.map(item => item?.issue) : []
  const reference = debug && /^[a-zA-Z0-9-]{1,64}$/.test(debug) ? `; ref ${debug}` : ""
  const detail = name ? `${name} (HTTP ${status}${reference})` : `HTTP ${status}${reference}`
  const selfPayment = name === "CANNOT_PAY_SELF" || issues.includes("CANNOT_PAY_SELF")
  const error = selfPayment
    ? new PaymentError(409, "paypal_cannot_pay_self", "Complete payment with a buyer account or payment method different from the Webcanbe merchant account.")
    : new PaymentError(status >= 500 ? 503 : 409, "paypal_request_failed", `PayPal request failed: ${detail}.`)
  error.providerHttpStatus = status
  error.providerName = name
  error.providerIssue = issues.includes("INVALID_RESOURCE_ID") ? "INVALID_RESOURCE_ID" : selfPayment ? "CANNOT_PAY_SELF" : undefined
  error.providerDebugId = reference ? debug : undefined
  return error
}

async function responseJson(response) {
  let body
  try { body = await response.json() } catch { body = undefined }
  if (!response.ok) throw providerError(response.status, body, response.headers)
  return body
}

export class PayPalProvider {
  constructor(env, fetchImpl = fetch) {
    this.clientId = requireText(env?.PAYPAL_CLIENT_ID, "paypal_client_missing")
    this.clientSecret = requireText(env?.PAYPAL_CLIENT_SECRET, "paypal_secret_missing")
    this.webhookId = requireText(env?.PAYPAL_WEBHOOK_ID, "paypal_webhook_missing")
    this.baseUrl = env?.PAYPAL_ENVIRONMENT === "live" ? LIVE : SANDBOX
    this.fetch = fetchImpl.bind(globalThis)
    this.access = undefined
  }

  async accessToken() {
    if (this.access && this.access.expiresAt > Date.now() + 30_000) return this.access.value
    const encoded = btoa(`${this.clientId}:${this.clientSecret}`)
    const response = await this.fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: { Authorization: `Basic ${encoded}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
    })
    const body = await responseJson(response)
    const value = requireText(body?.access_token, "paypal_token_invalid")
    this.access = { value, expiresAt: Date.now() + Math.max(60, Number(body.expires_in) || 300) * 1000 }
    return value
  }

  async request(path, { method = "GET", body, requestId, withMetadata = false } = {}) {
    const headers = { Authorization: `Bearer ${await this.accessToken()}`, "Content-Type": "application/json", Accept: "application/json" }
    if (requestId) headers["PayPal-Request-Id"] = requestId
    if (body !== undefined) headers.Prefer = "return=representation"
    const response = await this.fetch(`${this.baseUrl}${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    const value = await responseJson(response)
    if (!withMetadata) return value
    const debug = response.headers.get("paypal-debug-id")
    return { body: value, providerHttpStatus: response.status, ...(debug && /^[a-zA-Z0-9-]{1,64}$/.test(debug) ? { providerDebugId: debug } : {}) }
  }

  async createOrder(order) {
    const { body, providerHttpStatus, providerDebugId } = await this.request("/v2/checkout/orders", {
      method: "POST",
      requestId: order.providerRequestId,
      withMetadata: true,
      body: {
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: order.orderId,
          custom_id: order.orderId,
          description: order.title,
          amount: { currency_code: order.currency, value: moneyString(order.grossMinor) },
        }],
        payment_source: { paypal: { experience_context: { landing_page: "GUEST_CHECKOUT", user_action: "PAY_NOW", return_url: order.returnUrl, cancel_url: order.cancelUrl } } },
      },
    })
    const approvalUrl = Array.isArray(body?.links) ? body.links.find(link => link?.rel === "payer-action" || link?.rel === "approve")?.href : undefined
    if (typeof body?.id !== "string" || typeof approvalUrl !== "string") throw new PaymentError(503, "paypal_order_invalid", "PayPal returned an invalid order.")
    return Object.freeze({ providerOrderId: body.id, status: String(body.status || "CREATED"), approvalUrl, providerHttpStatus, ...(providerDebugId ? { providerDebugId } : {}) })
  }

  async getOrder(providerOrderId) {
    return this.request(`/v2/checkout/orders/${encodeURIComponent(providerOrderId)}`)
  }

  async captureOrder(providerOrderId, requestId) {
    const body = await this.request(`/v2/checkout/orders/${encodeURIComponent(providerOrderId)}/capture`, { method: "POST", requestId })
    const capture = body?.purchase_units?.[0]?.payments?.captures?.[0]
    if (!capture || typeof capture.id !== "string") throw new PaymentError(409, "paypal_capture_invalid", "PayPal returned an invalid capture.")
    return Object.freeze({
      providerOrderId: String(body.id),
      providerCaptureId: capture.id,
      status: String(capture.status || body.status),
      grossMinor: parseMoney(capture.amount?.value),
      currency: String(capture.amount?.currency_code || ""),
      customId: String(capture.custom_id || body?.purchase_units?.[0]?.custom_id || ""),
      capturedAt: String(capture.update_time || body.update_time || new Date().toISOString()),
    })
  }

  async refundCapture(providerCaptureId, refundMinor, currency, requestId) {
    const body = await this.request(`/v2/payments/captures/${encodeURIComponent(providerCaptureId)}/refund`, {
      method: "POST", requestId, body: { amount: { value: moneyString(refundMinor), currency_code: currency } },
    })
    return Object.freeze({ providerRefundId: String(body.id), status: String(body.status), refundMinor: parseMoney(body.amount?.value), currency: String(body.amount?.currency_code || ""), refundedAt: String(body.update_time || body.create_time || new Date().toISOString()) })
  }

  async createSubscription({ planId, subscriptionId, returnUrl, cancelUrl, requestId }) {
    const { body, providerHttpStatus, providerDebugId } = await this.request("/v1/billing/subscriptions", {
      method: "POST", requestId, withMetadata: true,
      body: { plan_id: planId, custom_id: subscriptionId, application_context: { user_action: "SUBSCRIBE_NOW", return_url: returnUrl, cancel_url: cancelUrl } },
    })
    const approvalUrl = Array.isArray(body?.links) ? body.links.find(link => link?.rel === "approve")?.href : undefined
    if (typeof body?.id !== "string" || typeof approvalUrl !== "string") throw new PaymentError(503, "paypal_subscription_invalid", "PayPal returned an invalid subscription.")
    return Object.freeze({ providerSubscriptionId: body.id, status: String(body.status || "APPROVAL_PENDING"), approvalUrl, providerHttpStatus, ...(providerDebugId ? { providerDebugId } : {}) })
  }

  async getPlan(planId) {
    return this.request(`/v1/billing/plans/${encodeURIComponent(planId)}`)
  }

  async getSubscription(providerSubscriptionId) {
    return this.request(`/v1/billing/subscriptions/${encodeURIComponent(providerSubscriptionId)}`)
  }

  async cancelSubscription(providerSubscriptionId, reason = "Cancelled by subscriber") {
    await this.request(`/v1/billing/subscriptions/${encodeURIComponent(providerSubscriptionId)}/cancel`, { method: "POST", body: { reason } })
  }

  async verifyWebhook(rawBody, headers) {
    const required = name => {
      const value = headers.get(name)
      if (!value) throw new PaymentError(400, "paypal_webhook_headers_missing", "PayPal webhook verification headers are missing.")
      return value
    }
    let event
    try { event = JSON.parse(rawBody) } catch { throw new PaymentError(400, "paypal_webhook_invalid", "Invalid PayPal webhook.") }
    const body = await this.request("/v1/notifications/verify-webhook-signature", {
      method: "POST",
      body: {
        auth_algo: required("paypal-auth-algo"),
        cert_url: required("paypal-cert-url"),
        transmission_id: required("paypal-transmission-id"),
        transmission_sig: required("paypal-transmission-sig"),
        transmission_time: required("paypal-transmission-time"),
        webhook_id: this.webhookId,
        webhook_event: event,
      },
    })
    if (body?.verification_status !== "SUCCESS") throw new PaymentError(403, "paypal_webhook_unverified", "PayPal webhook verification failed.")
    return event
  }
}
