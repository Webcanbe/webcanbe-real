import fs from "node:fs"
import { describe, expect, it } from "vitest"

const code = fs.readFileSync("src/webcanbe-engine/visual-editor/CodeWorkspace.tsx", "utf8")
const workspace = fs.readFileSync("src/webcanbe-engine/visual-editor/CompatibleWorkspace.tsx", "utf8")
const styles = fs.readFileSync("src/webcanbe-engine/visual-editor/compatibleWorkspace.css", "utf8")

describe("Phase 5 explicit save and stale-draft policy", () => {
  it("makes the explicit-save authority visible", () => {
    expect(code).toContain('className="source-save-policy"')
    expect(code).toContain("Explicit save")
    expect(code).toContain("Drafts are backed up automatically for recovery only")
    expect(code).toContain("Preview, Changes/history, project search, and Export continue to use the accepted source")
    expect(code).toContain("HEAD <code>")
  })

  it("distinguishes recovery backup from accepted source", () => {
    expect(code).toContain("Backing up drafts for recovery")
    expect(code).toContain("Draft recovery backup saved. Accepted source, preview and history are unchanged.")
    expect(code).toContain("Automatic draft backup is recovery-only and never counts as source acceptance.")
  })

  it("detects stale drafts before a save request is sent", () => {
    expect(code).toContain("const conflictedDrafts = dirtyDrafts.filter")
    expect(code).toContain("const stale = proposals.filter")
    expect(code).toContain("Accepted source advanced after")
    expect(code.indexOf("const stale = proposals.filter")).toBeLessThan(code.indexOf('requests.current("code"'))
    expect(code).toContain("disabled={!dirty || busy || !connected || conflict}")
    expect(code).toContain("conflictedDrafts.length > 0")
  })

  it("surfaces reconciliation rather than overwriting newer accepted source", () => {
    expect(code).toContain("Stale drafts cannot be saved over newer accepted source")
    expect(code).toContain("Rebase current file if unchanged")
    expect(code).toContain("This file changed in accepted source")
  })

  it("makes export semantics explicit", () => {
    expect(workspace).toContain("Export accepted source only; unsaved Code drafts are excluded")
    expect(workspace).toContain("Export accepted source")
    expect(workspace).toContain("Draft backup is recovery-only")
  })

  it("ships responsive accepted/draft/conflict states", () => {
    expect(styles).toContain(".source-save-policy")
    expect(styles).toContain('[data-state="accepted"]')
    expect(styles).toContain('[data-state="draft"]')
    expect(styles).toContain('[data-state="conflict"]')
    expect(styles).toContain(".source-stale-drafts")
  })
})
