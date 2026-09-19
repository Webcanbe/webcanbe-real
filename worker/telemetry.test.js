import { describe, expect, it, vi } from "vitest"
import { safeFailureLog, withRequestId } from "./telemetry.js"

describe("privacy-safe Worker telemetry", () => {
  it("adds a request ID without changing response status/body", async () => {
    const response = withRequestId(new Response("ok", { status: 201, headers: { "X-Test": "yes" } }), "req-123")
    expect(response.status).toBe(201)
    expect(response.headers.get("X-Request-ID")).toBe("req-123")
    expect(response.headers.get("X-Test")).toBe("yes")
    await expect(response.text()).resolves.toBe("ok")
  })

  it("logs only bounded operational fields", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    safeFailureLog({
      event: "private_product_database",
      requestId: "req-123",
      path: "/__webcanbe/api/product/purchases",
      status: 503,
      token: "must-not-log",
      email: "must-not-log@example.com",
    })
    expect(spy).toHaveBeenCalledTimes(1)
    const entry = JSON.parse(String(spy.mock.calls[0][0]))
    expect(entry).toEqual({
      level: "error",
      event: "private_product_database",
      requestId: "req-123",
      path: "/__webcanbe/api/product/purchases",
      status: 503,
    })
    expect(JSON.stringify(entry)).not.toContain("must-not-log")
    spy.mockRestore()
  })
})
