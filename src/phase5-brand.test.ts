import fs from "node:fs"
import { describe, expect, it } from "vitest"

const shell = fs.readFileSync("src/app-shell.tsx", "utf8")
const app = fs.readFileSync("src/App.tsx", "utf8")
const landing = fs.readFileSync("public/wcb-landing/index.html", "utf8")
const index = fs.readFileSync("index.html", "utf8")

describe("Phase 5 brand pass", () => {
  it("uses the official transparent three-stroke favicon with Webcanbe casing in app chrome", () => {
    expect(app).toContain('publicBrand?"/brand/webcanbe-mark.svg":"/favicon.png"')
    expect(app).toContain('<span className="wcb-wordmark">Webcanbe</span>')
    expect(index).toContain('href="/favicon.png"')
  })

  it("keeps the landing header and footer on the official brand asset", () => {
    expect(landing.split("/brand/webcanbe-logo.svg").length - 1).toBeGreaterThanOrEqual(2)
  })

  it("keeps the dashboard brand as the official mark plus Webcanbe text", () => {
    expect(shell).toContain('src="/brand/webcanbe-mark.svg"')
    expect(shell).toContain("<span>WebCanBe</span>")
  })

  it("restores Ropean-style dashboard account dropdown structures instead of removing them", () => {
    const dashboard = shell
    expect(dashboard).toContain("rd-account-dropdown")
    expect(dashboard).toContain("rd-profile-dropdown")
    expect(dashboard).toContain("rd-team-dropdown")
    expect(dashboard).toContain("Upgrade to Pro")
    expect(dashboard).toContain("Sign out")
  })
})
