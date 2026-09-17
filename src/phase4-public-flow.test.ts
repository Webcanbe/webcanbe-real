import { describe, expect, it } from "vitest"
import fs from "node:fs"

const app = fs.readFileSync(new URL("./App.tsx", import.meta.url), "utf8")
const home = fs.readFileSync(new URL("./Home.tsx", import.meta.url), "utf8")
const client = fs.readFileSync(new URL("./hostedProductClient.ts", import.meta.url), "utf8")

describe("Phase 4 public/auth/purchase flow", () => {
  it("keeps the live Launch UI homepage snapshot at the public root", () => {
      expect(home).toContain('src="/launch-ui-live/index.html"')
      const source = fs.readFileSync(new URL("../public/launch-ui-live/live-source.html", import.meta.url), "utf8")
      expect(source).toContain("Give your big idea the design it deserves")
      expect(source).toContain("It's all about design quality")
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
