import { describe, expect, it } from "vitest"
import fs from "node:fs"

const app = fs.readFileSync(new URL("./App.tsx", import.meta.url), "utf8")
const home = fs.readFileSync(new URL("./Home.tsx", import.meta.url), "utf8")
const client = fs.readFileSync(new URL("./hostedProductClient.ts", import.meta.url), "utf8")

describe("Phase 4 public/auth/purchase flow", () => {
  it("keeps the live Launch UI homepage unchanged at the public root", () => {
      expect(home).toContain('src="https://www.launchuicomponents.com/"')
      expect(home).not.toContain("WebCanBe")
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
