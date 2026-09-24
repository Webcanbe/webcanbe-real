import fs from "node:fs"
import { describe, expect, it } from "vitest"
import {
  CONTENT_SECURITY_POLICY,
  isKnownAppPath,
  shouldNoIndexPath,
} from "../worker/security-headers.js"
import { PREVIEW_RUNTIME_SECURITY_HEADERS } from "../worker/preview-runtime-headers.js"
// @ts-expect-error The production Worker entry is JavaScript without a TypeScript declaration.
import worker from "../worker/index.js"

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
    expect(worker).toContain('path === "/__wcb_preview_runtime") assetUrl.pathname = "/preview-runtime.html"')
    expect(worker).toContain('else if (isKnownAppPath(path)) assetUrl.pathname = "/app-shell.html"')
    expect(worker).toContain("applyPreviewRuntimeHeaders(asset)")
    expect(worker).toContain("applySecurityHeaders(asset")
  })

  it("serves the isolated preview entry at the Browser Run URL", async () => {
    let requestedPath = ""
    const response = await worker.fetch(new Request("https://webcanbe.com/__wcb_preview_runtime"), {
      ASSETS: { fetch: async (request: Request) => {
        requestedPath = new URL(request.url).pathname
        return new Response('<script type="module" src="/assets/preview-runtime-test.js"></script>', { headers: { "Content-Type": "text/html" } })
      } },
    } as never)
    expect(response.status).toBe(200)
    expect(requestedPath).toBe("/preview-runtime.html")
    expect(response.headers.get("Content-Security-Policy")).toBe(PREVIEW_RUNTIME_SECURITY_HEADERS["Content-Security-Policy"])
    expect(response.headers.get("Cache-Control")).toBe("no-store")
  })
})
