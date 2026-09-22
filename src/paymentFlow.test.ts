import { describe, expect, it, vi } from "vitest"
import { clearPaymentIdempotencyKey, paymentIdempotencyKey, paymentReturn } from "./paymentFlow"

class MemoryStorage {
  values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

describe("browser payment flow primitives", () => {
  it("reuses one idempotency key across double-click, refresh, and back navigation", () => {
    const storage = new MemoryStorage()
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "11111111-1111-4111-8111-111111111111") })
    const first = paymentIdempotencyKey("marketplace", "listing-1", storage)
    const replay = paymentIdempotencyKey("marketplace", "listing-1", storage)
    expect(replay).toBe(first)
    expect(crypto.randomUUID).toHaveBeenCalledOnce()
    clearPaymentIdempotencyKey("marketplace", "listing-1", storage)
    expect(storage.getItem("wcb-payment:marketplace:listing-1")).toBeNull()
    vi.unstubAllGlobals()
  })

  it("recognizes provider return and cancellation without trusting arbitrary tokens", () => {
    expect(paymentReturn("?payment=return&token=5O190127TN364715T", "payment")).toEqual({ kind: "return", providerOrderId: "5O190127TN364715T" })
    expect(paymentReturn("?payment=return&token=%3Cscript%3E", "payment")).toEqual({ kind: "return" })
    expect(paymentReturn("?subscription=cancelled", "subscription")).toEqual({ kind: "cancelled" })
    expect(paymentReturn("", "ai-pack")).toEqual({ kind: "none" })
  })
})
