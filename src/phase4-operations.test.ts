import { describe, expect, it } from "vitest"
import fs from "node:fs"

describe("Phase 4 authenticated operations surfaces", () => {
  const app = fs.readFileSync("src/App.tsx", "utf8")
  const client = fs.readFileSync("src/hostedProductClient.ts", "utf8")
  const main = fs.readFileSync("src/main.tsx", "utf8")

  it("uses the real hosted sign-in start boundary instead of a fake successful login", () => {
    expect(client).toContain('this.request("/__webcanbe/auth/start"')
    expect(app).toContain("signInWithEmailFirebase(email.trim(),password)")
    expect(app).toContain("await establishFirebaseSession(credential)")
    expect(app).toContain("Continue with Google")
    expect(app).toContain("Continue with GitHub")
  })

  it("connects Creator Studio to seller-scoped application, studio, listing and submission APIs", () => {
    for (const token of ["sellerApplication()", "applySeller()", "creatorStudio()", "updateCreatorListing(", "createSellerSubmission("]) expect(client).toContain(token)
    expect(app).toContain("Creator Studio")
    expect(app).toContain("Submit for review")
    expect(app).toContain("Release binding stays immutable")
    expect(app).not.toContain("UI-only preview")
  })

  it("adds an operator-only read surface without inventing client-side authority", () => {
    expect(client).toContain('"/__webcanbe/api/ops/control/read"')
    expect(app).toContain('basePath===BIGPERSON_CONTROL_PATH)page=<Protected><Control/></Protected>')
    expect(client).toContain("this.privilegedMutation<{ control: ControlData }>(password,")
    expect(app).toContain("The route and ordinary login session are never sufficient.")
  })

  it("loads current shell and editor styles after the consolidated product styles", () => {
    const base=main.indexOf('import "./phase4-final-ui.css"'), shell=main.indexOf('import "./app-shell.css"'), editor=main.indexOf('import "./editor-shell.css"')
    expect(base).toBeGreaterThan(-1)
    expect(shell).toBeGreaterThan(base)
    expect(editor).toBeGreaterThan(shell)
  })
})
