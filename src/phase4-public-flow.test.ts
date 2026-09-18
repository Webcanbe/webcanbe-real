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
  it("keeps real payment explicitly deferred instead of claiming success", () => {
    expect(app).toContain("The real card-first provider connection belongs to Phase 5")
    expect(app).toContain("Successful payment → entitlement → Dashboard")
  })
})
