import { describe, expect, it } from "vitest"
import fs from "node:fs"

const app = fs.readFileSync(new URL("./App.tsx", import.meta.url), "utf8")
const home = fs.readFileSync(new URL("./Home.tsx", import.meta.url), "utf8")
const client = fs.readFileSync(new URL("./hostedProductClient.ts", import.meta.url), "utf8")

describe("Phase 4 public/auth/purchase flow", () => {
  it("keeps the exact pinned Launch UI homepage at the public root", () => {
      const page = fs.readFileSync(new URL("./launch-ui/app/page.tsx", import.meta.url), "utf8")
      for (const marker of ["<Navbar />", "<Hero />", "<Logos />", "<Items />", "<Stats />", "<Pricing />", "<FAQ />", "<CTA />", "<Footer />"]) expect(page).toContain(marker)
      expect(home).toContain('LaunchUIHome')
      expect(home).toContain('launch-ui-page dark')
    })
  it("removes app navigation from the public top bar and moves authenticated navigation to a sidebar", () => {
    expect(app).toContain('const publicNav: string[][] = []')
    expect(app).toContain('className={`app-sidebar ${menu ? "open" : ""}`}')
    expect(app).toContain('["Marketplace", "/browse"]')
  })
  it("routes buying through authentication and checkout rather than a TEST entitlement", () => {
    expect(app).toContain('go(signedIn ? checkoutTarget : `/login?next=${encodeURIComponent(checkoutTarget)}`)')
    expect(app).toContain('function Checkout()')
    expect(app).not.toContain('hostedProductClient.purchaseAndMaterialize(project.releaseId')
  })
  it("protects app routes with the real hosted session boundary", () => {
    expect(app).toContain('return <Protected><Dashboard/></Protected>')
    expect(app).toContain('return <Protected><Checkout/></Protected>')
    expect(client).toContain('async authenticated()')
  })
  it("keeps real payment explicitly deferred instead of claiming success", () => {
    expect(app).toContain('The real card-first provider connection belongs to Phase 5')
    expect(app).toContain('Successful payment → entitlement → Dashboard')
  })
})
