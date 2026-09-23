import { describe, expect, it } from "vitest"
import { CONTENT_SECURITY_POLICY, SECURITY_HEADERS, applySecurityHeaders, isKnownAppPath, shouldNoIndexPath } from "./security-headers.js"

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
      "/_ops/keystone-7f31",
      "/_ops/gate2-auth-smoke",
      "/login",
      "/signup",
      "/auth/complete",
      "/workspace/project-1",
      "/checkout/release-1",
      "/seller",
      "/seller/projects",
      "/requests",
    ]) expect(shouldNoIndexPath(path)).toBe(true)

    for (const path of ["/", "/browse", "/docs", "/docs/security", "/plans", "/project/example"]) {
      expect(shouldNoIndexPath(path)).toBe(false)
    }

    const response = applySecurityHeaders(new Response("private"), { noIndex: true })
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow")
  })


  it("distinguishes known SPA routes from unknown navigation paths", () => {
    for (const path of ["/","/browse","/docs","/docs/security","/project/example","/dashboard","/login","/seller/projects","/requests","/_ops/gate2-auth-smoke"]) {
      expect(isKnownAppPath(path)).toBe(true)
    }
    for (const path of ["/definitely-not-a-route","/unknown/nested","/control"]) {
      expect(isKnownAppPath(path)).toBe(false)
    }
  })

  it("enforces the inventoried CSP without enabling inline/eval scripts", () => {
    expect(SECURITY_HEADERS["Content-Security-Policy"]).toBe(CONTENT_SECURITY_POLICY)
    expect(CONTENT_SECURITY_POLICY).toContain("script-src 'self' https://apis.google.com https://www.gstatic.com")
    expect(CONTENT_SECURITY_POLICY).toContain("script-src-attr 'none'")
    expect(CONTENT_SECURITY_POLICY).not.toContain("'unsafe-eval'")
    const scriptDirective = CONTENT_SECURITY_POLICY.split("; ").find(value => value.startsWith("script-src ")) ?? ""
    expect(scriptDirective).not.toContain("'unsafe-inline'")
    expect(scriptDirective).not.toContain("'unsafe-eval'")
    expect(CONTENT_SECURITY_POLICY).toContain("style-src 'self' 'unsafe-inline'")
    expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'")
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'")
    expect(CONTENT_SECURITY_POLICY).toContain("https://apis.google.com")
    expect(CONTENT_SECURITY_POLICY).toContain("https://www.gstatic.com")
    expect(CONTENT_SECURITY_POLICY).toContain("https://*.googleapis.com")
    expect(CONTENT_SECURITY_POLICY).toContain("https://*.firebaseapp.com")
  })
})


it("allows the configured PostHog ingestion host", () => {
  expect(CONTENT_SECURITY_POLICY).toMatch(/connect-src[^;]*https:\/\/us\.i\.posthog\.com/)
})
