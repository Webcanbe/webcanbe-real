import fs from "node:fs"
import { describe, expect, it } from "vitest"

const app = fs.readFileSync("src/App.tsx", "utf8")

describe("Phase 5 route metadata and canonical URLs", () => {
  it("sets canonical production URLs for public routes and canonicalizes aliases", () => {
    expect(app).toContain('const PUBLIC_ORIGIN = "https://webcanbe.com"')
    expect(app).toContain('"/browse": { title: "Marketplace — Webcanbe"')
    expect(app).toContain('"/templates": { title: "Marketplace — Webcanbe"')
    expect(app).toContain('canonical: "/browse"')
    expect(app).toContain('"/pricing": { title: "Plans — Webcanbe"')
    expect(app).toContain('canonical: "/plans"')
    expect(app).toContain('"/privacy": { title: "Privacy Policy — Webcanbe"')
    expect(app).toContain('canonical: "/policy"')
  })

  it("keeps private or unknown routes noindex in client metadata", () => {
    expect(app).toContain('return { title: "Webcanbe", description: "Source-first web projects with visual and code editing.", noIndex: true }')
    expect(app).toContain('meta.noIndex ? "noindex, nofollow" : "index, follow"')
  })

  it("syncs title, description, canonical, OpenGraph, and Twitter metadata on route changes", () => {
    expect(app).toContain("function syncRouteMetadata(path: string)")
    expect(app).toContain("document.title = meta.title")
    expect(app).toContain('link[rel="canonical"]')
    expect(app).toContain('meta[property="og:url"]')
    expect(app).toContain('meta[name="twitter:title"]')
    expect(app).toContain('useEffect(()=>{syncRouteMetadata(path)},[path])')
  })
})
