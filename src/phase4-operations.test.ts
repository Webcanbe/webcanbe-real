import { describe, expect, it } from "vitest"
import fs from "node:fs"

describe("Phase 4 authenticated operations surfaces", () => {
  const app = fs.readFileSync("src/App.tsx", "utf8")
  const client = fs.readFileSync("src/hostedProductClient.ts", "utf8")
  const main = fs.readFileSync("src/main.tsx", "utf8")
  const creator = fs.readFileSync("src/creator-shell.tsx", "utf8")

  it("uses the real hosted sign-in start boundary instead of a fake successful login", () => {
    expect(client).toContain('this.request("/__webcanbe/auth/start"')
    expect(app).toContain("signInWithEmailFirebase(email.trim(),password)")
    expect(app).toContain("await establishFirebaseSession(credential)")
    expect(app).toContain("Continue with Google")
    expect(app).toContain("Continue with GitHub")
  })

  it("connects Creator Studio to seller-scoped application, studio, listing and submission APIs", () => {
    for (const token of ["sellerApplication()", "applySeller(input:", "creatorStudio()", "updateCreatorListing(", "createSellerSubmission("]) expect(client).toContain(token)
    expect(app).toContain("CreatorEnvironment")
    expect(creator).toContain("Submit for review")
    expect(creator).toContain("immutable binding")
    expect(creator).not.toContain("UI-only preview")
  })

  it("adds an operator-only read surface without inventing client-side authority", () => {
    expect(client).toContain('"/__webcanbe/api/ops/control/read"')
    expect(app).toContain('basePath===BIGPERSON_CONTROL_PATH)page=<Protected><Control/></Protected>')
    expect(client).toContain("this.privilegedMutation<{ control: ControlData }>(password,")
    expect(app).toContain("three-factor")
  })

  it("loads shell styles after product styles and editor styles with the editor route", () => {
    const base=main.indexOf('import "./phase4-final-ui.css"'), shell=main.indexOf('import "./app-shell.css"')
    const editor=fs.readFileSync("src/webcanbe-engine/visual-editor/CompatibleWorkspace.tsx", "utf8")
    expect(base).toBeGreaterThan(-1)
    expect(shell).toBeGreaterThan(base)
    expect(main).not.toContain('import "./editor-shell.css"')
    expect(editor).toContain('import "../../editor-shell.css"')
    expect(editor).toContain('import "../../editor-split-fix.css"')
    expect(editor).toContain('import "../../editor-control-size.css"')
    expect(editor.indexOf('import "../../editor-shell.css"')).toBeLessThan(editor.indexOf('import "./compatibleWorkspace.css"'))
  })
})
