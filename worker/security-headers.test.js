import { describe, expect, it } from "vitest"
import { SECURITY_HEADERS, applySecurityHeaders, shouldNoIndexPath } from "./security-headers.js"

describe("Worker security header adapter", () => {
  it("preserves response status and existing headers while adding security headers", async () => {
    const response = applySecurityHeaders(new Response("ok", { status: 201, headers: { "Cache-Control": "public,max-age=60" } }))
    expect(response.status).toBe(201)
    expect(response.headers.get("Cache-Control")).toBe("public,max-age=60")
    expect(response.headers.get("X-Frame-Options")).toBe("DENY")
    expect(response.headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin-allow-popups")
    expect(response.headers.get("X-Robots-Tag")).toBeNull()
    expect(await response.text()).toBe("ok")
  })

  it("marks private SPA routes noindex without marking public routes", async () => {
    for (const path of [
      "/dashboard",
      "/dashboard-preview",
      "/projects",
      "/purchases",
      "/settings",
      "/control",
      "/login",
      "/signup",
      "/auth/complete",
      "/workspace/project-1",
      "/checkout/release-1",
      "/seller",
      "/seller/projects",
    ]) expect(shouldNoIndexPath(path)).toBe(true)

    for (const path of ["/", "/browse", "/docs", "/docs/security", "/plans", "/project/example"]) {
      expect(shouldNoIndexPath(path)).toBe(false)
    }

    const response = applySecurityHeaders(new Response("private"), { noIndex: true })
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow")
  })

  it("does not add a CSP before the retained landing has a dedicated compatibility pass", () => {
    expect(SECURITY_HEADERS).not.toHaveProperty("Content-Security-Policy")
  })
})
