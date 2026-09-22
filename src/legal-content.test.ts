import fs from "node:fs"
import { describe, expect, it } from "vitest"
import legalReview from "./public/content/legal-review-3.json"

const routes = [
  "/legal", "/legal/terms", "/legal/privacy", "/legal/buyer-license",
  "/legal/creator-distribution", "/legal/refunds", "/legal/acceptable-use",
  "/legal/licenses", "/legal/privacy-requests",
] as const

describe("reviewed legal package", () => {
  it("implements every supplied document as structured route content", () => {
    expect(Object.keys(legalReview).sort()).toEqual([...routes].sort())
    for (const route of routes) {
      const page = legalReview[route]
      expect(page.version).toBe("2026-09-23-review-3")
      expect(page.sections.length).toBeGreaterThan(2)
      expect(page.sections.flatMap(section => section.paragraphs).join(" ").length).toBeGreaterThan(500)
    }
  })

  it("never places unresolved source placeholders in customer-visible paragraphs", () => {
    const visible = Object.values(legalReview).flatMap(page => page.sections.flatMap(section => section.paragraphs)).join("\n")
    expect(visible).not.toMatch(/\[\[[A-Z0-9_\s]+\]\]/)
    expect(Object.values(legalReview).every(page => page.publicationBlocked && page.unresolvedFields.length > 0)).toBe(true)
  })

  it("wires legal documents into the relevant account, checkout, creator, and privacy surfaces", () => {
    const app = fs.readFileSync("src/App.tsx", "utf8")
    const creator = fs.readFileSync("src/creator-shell.tsx", "utf8")
    const footer = fs.readFileSync("src/public/footer-data.json", "utf8")
    for (const route of ["/legal/terms", "/legal/privacy", "/legal/refunds", "/legal/buyer-license"]) expect(app).toContain(route)
    expect(creator).toContain("/legal/creator-distribution")
    expect(footer).toContain("/legal/privacy")
    expect(footer).toContain("/legal/privacy-requests")
  })
})
