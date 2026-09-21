import fs from "node:fs"
import { describe, expect, it } from "vitest"

const workspace = fs.readFileSync("src/webcanbe-engine/visual-editor/CompatibleWorkspace.tsx", "utf8")
const code = fs.readFileSync("src/webcanbe-engine/visual-editor/CodeWorkspace.tsx", "utf8")
const styles = fs.readFileSync("src/webcanbe-engine/visual-editor/compatibleWorkspace.css", "utf8")

describe("Phase 5 editor keyboard shortcuts", () => {
  it("keeps text/code editing undo separate from project transaction undo", () => {
    expect(workspace).toContain("function isTextEditingTarget")
    expect(workspace).toContain('[contenteditable="true"]')
    expect(workspace).toContain(".cm-editor")
    expect(workspace).toContain("if (editing) return")
    expect(workspace.indexOf("if (editing) return")).toBeLessThan(workspace.indexOf('void history(event.shiftKey ? "redo" : "undo")'))
  })

  it("wires source transaction undo and redo shortcuts", () => {
    expect(workspace).toContain('key === "z"')
    expect(workspace).toContain('history(event.shiftKey ? "redo" : "undo")')
    expect(workspace).toContain('key === "y"')
    expect(workspace).toContain('history("redo")')
    expect(workspace).toContain('aria-keyshortcuts="Meta+Z Control+Z"')
  })

  it("adds source surface, preview-mode, viewport, export, and help shortcuts", () => {
    expect(workspace).toContain('openSurface("canvas")')
    expect(workspace).toContain('openSurface("code")')
    expect(workspace).toContain('openSurface("split")')
    expect(workspace).toContain('openSurface("history")')
    expect(workspace).toContain('setSelectMode(true)')
    expect(workspace).toContain('setSelectMode(false)')
    expect(workspace).toContain('setViewport("mobile")')
    expect(workspace).toContain('setViewport("tablet")')
    expect(workspace).toContain('setViewport("desktop")')
    expect(workspace).toContain('key === "e"')
    expect(workspace).toContain('event.key === "?"')
    expect(workspace).toContain("compatible-shortcuts")
  })

  it("keeps code save shortcuts inside CodeMirror and adds save all", () => {
    expect(code).toContain('{ key: "Mod-s"')
    expect(code).toContain('{ key: "Mod-Shift-s"')
    expect(code).toContain("onSaveAll")
    expect(code).toContain("save(true)")
    expect(code).toContain("Ctrl+Shift+S")
  })

  it("ships a responsive shortcut guide", () => {
    expect(styles).toContain(".compatible-shortcuts-backdrop")
    expect(styles).toContain(".compatible-shortcut-grid")
    expect(styles).toContain("@media(max-width:680px)")
  })

  it("keeps project actions and source files reachable on mobile", () => {
    expect(styles).toContain(".compatible-top-actions button:last-child{display:inline-flex")
    expect(styles).toContain(".compatible-files{display:flex;max-height:38vh")
  })
})
