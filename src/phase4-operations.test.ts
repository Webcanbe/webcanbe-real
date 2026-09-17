import { describe, expect, it } from "vitest"
import fs from "node:fs"

describe("Phase 4 authenticated operations surfaces", () => {
  const app = fs.readFileSync("src/App.tsx", "utf8")
  const client = fs.readFileSync("src/hostedProductClient.ts", "utf8")
  const main = fs.readFileSync("src/main.tsx", "utf8")

  it("uses the real hosted sign-in start boundary instead of a fake successful login", () => {
    expect(app).toContain("hostedProductClient.authStart()")
    expect(client).toContain('this.request("/__webcanbe/auth/start"')
    expect(app).toContain("Email/password is not enabled")
    expect(app).not.toContain("Continue with Google</button>")
  })

  it("connects Creator Studio to seller-scoped application, studio, listing and submission APIs", () => {
    for (const token of ["sellerApplication()", "applySeller()", "creatorStudio()", "updateCreatorListing(", "createSellerSubmission("]) expect(client).toContain(token)
    expect(app).toContain("Creator Studio")
    expect(app).toContain("Submit for review")
    expect(app).toContain("Release binding stays immutable")
    expect(app).not.toContain("UI-only preview")
  })

  it("adds an operator-only read surface without inventing client-side authority", () => {
    expect(client).toContain('"/__webcanbe/api/product/control/read"')
    expect(app).toContain('if (path === "/control") return <Protected><Control/></Protected>')
    expect(app).toContain("High-risk changes require fresh step-up")
    expect(app).toContain("does not fake a passkey ceremony")
  })

  it("loads the Phase 4 operations style layer after the product hub styles", () => {
    expect(main.indexOf('import "./phase4-product-hub.css"')).toBeLessThan(main.indexOf('import "./phase4-operations.css"'))
  })
})
