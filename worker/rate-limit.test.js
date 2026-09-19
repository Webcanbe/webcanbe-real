import { describe, expect, it, vi } from "vitest"
import { anonymousRateKey, rateLimitAllowed } from "./rate-limit.js"

describe("Cloudflare rate-limit helpers", () => {
  it("derives a stable privacy-preserving anonymous key without exposing raw request metadata", async () => {
    const request = new Request("https://webcanbe.com/__webcanbe/auth/start", {
      headers: {
        "CF-Connecting-IP": "203.0.113.42",
        "User-Agent": "Webcanbe-Test-Agent/1.0",
      },
    })
    const first = await anonymousRateKey(request, "auth:/__webcanbe/auth/start")
    const second = await anonymousRateKey(request, "auth:/__webcanbe/auth/start")
    expect(first).toBe(second)
    expect(first).toMatch(/^auth:\/__webcanbe\/auth\/start:[A-Za-z0-9_-]{32}$/)
    expect(first).not.toContain("203.0.113.42")
    expect(first).not.toContain("Webcanbe-Test-Agent")
  })

  it("separates anonymous counters by scope", async () => {
    const request = new Request("https://webcanbe.com/", {
      headers: { "CF-Connecting-IP": "203.0.113.42", "User-Agent": "same" },
    })
    const auth = await anonymousRateKey(request, "auth")
    const catalog = await anonymousRateKey(request, "catalog")
    expect(auth).not.toBe(catalog)
  })

  it("honors Cloudflare limit decisions", async () => {
    const allowed = { limit: vi.fn(async () => ({ success: true })) }
    const denied = { limit: vi.fn(async () => ({ success: false })) }
    await expect(rateLimitAllowed(allowed, "user:1")).resolves.toBe(true)
    await expect(rateLimitAllowed(denied, "user:1")).resolves.toBe(false)
    expect(allowed.limit).toHaveBeenCalledWith({ key: "user:1" })
  })

  it("fails open when a rate-limit binding is unavailable or errors", async () => {
    await expect(rateLimitAllowed(undefined, "x")).resolves.toBe(true)
    await expect(rateLimitAllowed({ limit: async () => { throw new Error("rate limiter unavailable") } }, "x")).resolves.toBe(true)
  })
})
