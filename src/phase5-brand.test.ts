import fs from "node:fs"
import { describe, expect, it } from "vitest"

const app = fs.readFileSync("src/App.tsx", "utf8")
const landing = fs.readFileSync("public/wcb-landing/index.html", "utf8")
const icon = fs.readFileSync("public/webcanbe-icon.svg", "utf8")

describe("Phase 5 brand pass", () => {
  it("uses the shared Webcanbe primary logo asset in app chrome", () => {
    expect(app).toContain('/brand/webcanbe-logo.svg')
    expect(app).toContain('/brand/webcanbe-mark.svg')
    expect(app).toContain('rd-team-brand-copy')
    expect(app).not.toContain('className="mark" aria-label="Webcanbe"')
  })

  it("uses the primary logo in the retained landing header/footer brand anchors", () => {
    expect(landing.split("/brand/webcanbe-logo.svg").length - 1).toBeGreaterThanOrEqual(3)
  })

  it("keeps the favicon aligned with the new three-stroke mark", () => {
    expect(icon).toContain("#514BFF")
    expect(icon).toContain("#4B65FF")
    expect(icon).toContain("#347CFF")
  })

  it("renders a real account popover from the top-right avatar", () => {
    expect(app).toContain("top-account-popover")
    expect(app).toContain("setTopAccount")
    expect(app).toContain("Sign out")
  })
})
