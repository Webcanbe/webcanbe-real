import { describe, expect, it } from "vitest"
import { SECURITY_HEADERS, applySecurityHeaders } from "./security-headers.js"

describe("Worker security header adapter", () => {
  it("preserves response status and existing headers while adding security headers", async () => {
    const response = applySecurityHeaders(new Response("ok", { status: 201, headers: { "Cache-Control": "public,max-age=60" } }))
    expect(response.status).toBe(201)
    expect(response.headers.get("Cache-Control")).toBe("public,max-age=60")
    expect(response.headers.get("X-Frame-Options")).toBe("DENY")
    expect(response.headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin-allow-popups")
    expect(await response.text()).toBe("ok")
  })

  it("does not add a CSP before the retained landing has a dedicated compatibility pass", () => {
    expect(SECURITY_HEADERS).not.toHaveProperty("Content-Security-Policy")
  })
})
