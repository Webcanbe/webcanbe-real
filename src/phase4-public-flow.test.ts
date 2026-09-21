import { describe, expect, it } from "vitest"
import fs from "node:fs"

const app = fs.readFileSync(new URL("./App.tsx", import.meta.url), "utf8")
const home = fs.readFileSync(new URL("./Home.tsx", import.meta.url), "utf8")

describe("Phase 4 public/auth/purchase flow", () => {
  it("renders the local WebCanBe landing inside the React route rather than an iframe", () => {
    expect(home).toContain('fetch("/wcb-landing/index.html"')
    expect(home).toContain("DOMParser")
    expect(home).not.toContain("<iframe")
  })
  it("connects checkout to server-created and server-captured orders", () => {
    expect(app).toContain("hostedProductClient.createPaymentOrder")
    expect(app).toContain("hostedProductClient.capturePaymentOrder")
    expect(app).toContain("Refreshing this return page cannot create a second entitlement")
  })
})
