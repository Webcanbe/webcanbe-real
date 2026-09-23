import fs from "node:fs"
import { describe, expect, it } from "vitest"
import {
  CONTENT_SECURITY_POLICY,
  isKnownAppPath,
  shouldNoIndexPath,
} from "../worker/security-headers.js"
import { PREVIEW_RUNTIME_SECURITY_HEADERS } from "../worker/preview-runtime-headers.js"

describe("Phase 5 preview runtime security boundary", () => {
  it("keeps unsafe-eval out of the ordinary Webcanbe CSP", () => {
    expect(CONTENT_SECURITY_POLICY).not.toContain("'unsafe-eval'")
    expect(CONTENT_SECURITY_POLICY).not.toContain("default-src 'none'")
  })

  it("allows in-memory project modules only on the isolated preview runtime document", () => {
    const csp = PREVIEW_RUNTIME_SECURITY_HEADERS["Content-Security-Policy"]
    expect(csp).toContain("default-src 'none'")
    expect(csp).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'")
    expect(csp).toContain("connect-src 'none'")
    expect(csp).toContain("form-action 'none'")
    expect(PREVIEW_RUNTIME_SECURITY_HEADERS["X-Robots-Tag"]).toBe("noindex, nofollow")
    expect(PREVIEW_RUNTIME_SECURITY_HEADERS["Cache-Control"]).toBe("no-store")
  })

  it("treats the preview runtime as an intentional noindex asset, not an unknown SPA path", () => {
    expect(isKnownAppPath("/__wcb_preview_runtime")).toBe(true)
    expect(shouldNoIndexPath("/__wcb_preview_runtime")).toBe(true)
  })

  it("routes only the preview document through the special response headers", () => {
    const worker = fs.readFileSync("worker/index.js", "utf8")
    expect(worker).toContain('if (path === "/__wcb_preview_runtime")')
    expect(worker).toContain('else if (isKnownAppPath(path)) assetUrl.pathname = "/app-shell.html"')
    expect(worker).toContain("applyPreviewRuntimeHeaders(asset)")
    expect(worker).toContain("applySecurityHeaders(asset")
  })
})
