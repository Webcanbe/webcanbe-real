import { describe, expect, it } from "vitest"
import { PayPalProvider } from "./paypal-provider.js"

const env = { PAYPAL_CLIENT_ID: "sandbox-client", PAYPAL_CLIENT_SECRET: "sandbox-secret", PAYPAL_WEBHOOK_ID: "WH-CONFIGURED", PAYPAL_ENVIRONMENT: "sandbox" }
const response = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } })

describe("PayPal provider boundary", () => {
  it("creates server-priced orders with provider idempotency and no browser amount", async () => {
    const calls = []
    const provider = new PayPalProvider(env, async (url, init) => {
      calls.push({ url, init })
      if (url.endsWith("/v1/oauth2/token")) return response({ access_token: "token", expires_in: 300 })
      return response({ id: "ORDER-1", status: "CREATED", links: [{ rel: "approve", href: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-1" }] }, 201)
    })
    const result = await provider.createOrder({ orderId: "wcb-order", providerRequestId: "order-create:wcb-order", title: "Launch kit", grossMinor: 1200, currency: "USD", returnUrl: "https://webcanbe.com/purchases", cancelUrl: "https://webcanbe.com/marketplace" })
    expect(result.providerOrderId).toBe("ORDER-1")
    const request = calls[1]
    expect(request.init.headers["PayPal-Request-Id"]).toBe("order-create:wcb-order")
    expect(JSON.parse(request.init.body).purchase_units[0]).toMatchObject({ custom_id: "wcb-order", amount: { currency_code: "USD", value: "12.00" } })
  })

  it("normalizes a completed capture for domain-side exact matching", async () => {
    const provider = new PayPalProvider(env, async url => url.endsWith("/v1/oauth2/token")
      ? response({ access_token: "token", expires_in: 300 })
      : response({ id: "ORDER-1", status: "COMPLETED", purchase_units: [{ custom_id: "wcb-order", payments: { captures: [{ id: "CAPTURE-1", status: "COMPLETED", amount: { value: "9.00", currency_code: "USD" }, update_time: "2026-09-21T00:00:00.000Z" }] } }] }))
    await expect(provider.captureOrder("ORDER-1", "capture-key")).resolves.toEqual({ providerOrderId: "ORDER-1", providerCaptureId: "CAPTURE-1", status: "COMPLETED", grossMinor: 900, currency: "USD", customId: "wcb-order", capturedAt: "2026-09-21T00:00:00.000Z" })
  })

  it("posts the configured webhook ID and delivery headers to PayPal verification", async () => {
    const calls = []
    const provider = new PayPalProvider(env, async (url, init) => {
      calls.push({ url, init })
      if (url.endsWith("/v1/oauth2/token")) return response({ access_token: "token", expires_in: 300 })
      return response({ verification_status: "SUCCESS" })
    })
    const event = { id: "WH-EVENT", event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { id: "CAPTURE-1" } }
    const headers = new Headers({ "paypal-auth-algo": "SHA256withRSA", "paypal-cert-url": "https://api.paypal.com/cert", "paypal-transmission-id": "transmission", "paypal-transmission-sig": "signature", "paypal-transmission-time": "2026-09-21T00:00:00Z" })
    await expect(provider.verifyWebhook(JSON.stringify(event), headers)).resolves.toEqual(event)
    expect(JSON.parse(calls[1].init.body)).toMatchObject({ webhook_id: "WH-CONFIGURED", transmission_id: "transmission", webhook_event: event })
  })
})
