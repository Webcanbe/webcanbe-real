import fs from "node:fs"
import { describe, expect, it } from "vitest"

const worker = fs.readFileSync("worker/index.js", "utf8")
const security = fs.readFileSync("worker/security-headers.js", "utf8")
const robots = fs.readFileSync("public/robots.txt", "utf8")
const sitemap = fs.readFileSync("public/sitemap.xml", "utf8")

describe("Phase 5 launch hardening", () => {
  it("defines conservative security headers compatible with popup authentication", () => {
    expect(security).toContain('"Strict-Transport-Security": "max-age=31536000"')
    expect(security).toContain('"X-Frame-Options": "DENY"')
    expect(security).toContain('"X-Content-Type-Options": "nosniff"')
    expect(security).toContain('"Cross-Origin-Opener-Policy": "same-origin-allow-popups"')
    expect(security).toContain('"Permissions-Policy": "camera=(), microphone=(), geolocation=()"')
    expect(security).not.toContain("Content-Security-Policy")
  })

  it("applies security headers to static asset responses as well as dynamic responses", () => {
    expect(worker).toContain("...SECURITY_HEADERS")
    expect(worker).toContain("applySecurityHeaders(await env.ASSETS.fetch(request),")
    expect(worker).toContain("shouldNoIndexPath(path)")
  })

  it("keeps private and authenticated routes out of crawler discovery", () => {
    for (const path of ["/__webcanbe/","/dashboard","/dashboard-preview","/workspace/","/settings","/checkout/","/seller","/control","/login","/signup"]) {
      expect(robots).toContain("Disallow: " + path)
    }
    expect(robots).toContain("Sitemap: https://webcanbe.com/sitemap.xml")
  })

  it("publishes only public routes in the sitemap", () => {
    expect(sitemap).toContain("<loc>https://webcanbe.com/</loc>")
    expect(sitemap).toContain("<loc>https://webcanbe.com/browse</loc>")
    expect(sitemap).toContain("<loc>https://webcanbe.com/docs/security</loc>")
    expect(sitemap).toContain("<loc>https://webcanbe.com/terms</loc>")
    expect(sitemap).not.toContain("/dashboard")
    expect(sitemap).not.toContain("/settings")
    expect(sitemap).not.toContain("/checkout/")
  })
})
