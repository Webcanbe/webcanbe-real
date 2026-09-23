import fs from "node:fs"
import { describe, expect, it } from "vitest"

const worker = fs.readFileSync("worker/index.js", "utf8")
const security = fs.readFileSync("worker/security-headers.js", "utf8")
const robots = fs.readFileSync("public/robots.txt", "utf8")
const sitemap = fs.readFileSync("public/sitemap-public.xml", "utf8")
const wrangler = JSON.parse(fs.readFileSync("wrangler.jsonc", "utf8")) as { assets?: { run_worker_first?: boolean | string[] } }

describe("Phase 5 launch hardening", () => {
  it("defines conservative security headers compatible with popup authentication", () => {
    expect(security).toContain('"Strict-Transport-Security": "max-age=31536000"')
    expect(security).toContain('"X-Frame-Options": "DENY"')
    expect(security).toContain('"X-Content-Type-Options": "nosniff"')
    expect(security).toContain('"Cross-Origin-Opener-Policy": "same-origin-allow-popups"')
    expect(security).toContain('"Permissions-Policy": "camera=(), microphone=(), geolocation=()"')
    expect(security).toContain('"Content-Security-Policy": CONTENT_SECURITY_POLICY')
    expect(security).toContain('"script-src \'self\' https://apis.google.com https://www.gstatic.com"')
    expect(security).toContain('"script-src-attr \'none\'"')
    expect(security).not.toContain('"script-src \'self\' \'unsafe-inline\'"')
    expect(security).not.toContain("'unsafe-eval'")
    expect(security).toContain('"style-src \'self\' \'unsafe-inline\'"')
  })

  it("routes SPA/static requests through Worker middleware before applying shared security policy", () => {
    expect(wrangler.assets?.run_worker_first).toBe(true)
    expect(worker).toContain("...SECURITY_HEADERS")
    expect(worker).toContain("const fetched = await env.ASSETS.fetch(new Request(assetUrl, request))")
    expect(worker).toContain("applySecurityHeaders(asset,")
    expect(worker).toContain("shouldNoIndexPath(path)")
    expect(worker).toContain("isKnownAppPath(path)")
    expect(worker).toContain('import { SECURITY_HEADERS, applySecurityHeaders, applySourceDemoHeaders, isKnownAppPath, shouldNoIndexPath } from "./security-headers.js"')
    expect(worker).toContain("status: 404")
  })

  it("keeps private and authenticated routes out of crawler discovery", () => {
    for (const path of ["/__webcanbe/","/dashboard","/dashboard-preview","/workspace","/marketplace","/editor/","/app/","/profile","/account","/billing","/notifications","/help","/settings","/checkout/","/seller","/_ops/","/login","/signup"]) {
      expect(robots).toContain("Disallow: " + path)
    }
    expect(robots).toContain("Sitemap: https://webcanbe.com/sitemap.xml")
  })

  it("publishes only public routes in the sitemap", () => {
    expect(sitemap).toContain("<loc>https://webcanbe.com/</loc>")
    expect(sitemap).toContain("<loc>https://webcanbe.com/browse</loc>")
    expect(sitemap).toContain("<loc>https://webcanbe.com/docs/security</loc>")
    expect(sitemap).toContain("<loc>https://webcanbe.com/legal/terms</loc>")
    expect(sitemap).not.toContain("<loc>https://webcanbe.com/dashboard")
    expect(sitemap).not.toContain("<loc>https://webcanbe.com/settings")
    expect(sitemap).not.toContain("<loc>https://webcanbe.com/checkout/")
  })
})
