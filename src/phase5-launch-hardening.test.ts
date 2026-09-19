import fs from "node:fs"
import { describe, expect, it } from "vitest"
import { SECURITY_HEADERS, applySecurityHeaders } from "../worker/security-headers.js"

const worker = fs.readFileSync("worker/index.js", "utf8")
const robots = fs.readFileSync("public/robots.txt", "utf8")
const sitemap = fs.readFileSync("public/sitemap.xml", "utf8")

describe("Phase 5 launch hardening", () => {
  it("adds conservative security headers compatible with popup authentication", async () => {
    expect(SECURITY_HEADERS["Strict-Transport-Security"]).toBe("max-age=31536000")
    expect(SECURITY_HEADERS["X-Frame-Options"]).toBe("DENY")
    expect(SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff")
    expect(SECURITY_HEADERS["Cross-Origin-Opener-Policy"]).toBe("same-origin-allow-popups")
    expect(SECURITY_HEADERS["Permissions-Policy"]).toContain("camera=()")
    expect(SECURITY_HEADERS).not.toHaveProperty("Content-Security-Policy")

    const response = applySecurityHeaders(new Response("ok", { status: 201, headers: { "Cache-Control": "public,max-age=60" } }))
    expect(response.status).toBe(201)
    expect(response.headers.get("Cache-Control")).toBe("public,max-age=60")
    expect(response.headers.get("X-Frame-Options")).toBe("DENY")
  })

  it("applies security headers to static asset responses as well as dynamic responses", () => {
    expect(worker).toContain("...SECURITY_HEADERS")
    expect(worker).toContain("applySecurityHeaders(await env.ASSETS.fetch(request))")
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
