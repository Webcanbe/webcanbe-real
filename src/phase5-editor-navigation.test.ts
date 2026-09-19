import fs from "node:fs"
import { describe, expect, it } from "vitest"

const code = fs.readFileSync("src/webcanbe-engine/visual-editor/CodeWorkspace.tsx", "utf8")
const workspace = fs.readFileSync("src/webcanbe-engine/visual-editor/CompatibleWorkspace.tsx", "utf8")
const styles = fs.readFileSync("src/webcanbe-engine/visual-editor/compatibleWorkspace.css", "utf8")

describe("Phase 5 editor navigation and current-file search", () => {
  it("provides quick open with recent files and Cmd/Ctrl+P", () => {
    expect(code).toContain("quickOpen")
    expect(code).toContain("quickQuery")
    expect(code).toContain("recentFiles")
    expect(code).toContain('key === "p"')
    expect(code).toContain("source-quick-open")
    expect(code).toContain("Quick open source file")
  })

  it("provides draft-only find and replace for the active file", () => {
    expect(code).toContain("findTextMatches")
    expect(code).toContain("findQuery")
    expect(code).toContain("replaceValue")
    expect(code).toContain("replaceCurrentMatch")
    expect(code).toContain("replaceAllMatches")
    expect(code).toContain("Replacements modify the draft only")
    expect(code).toContain('key === "f"')
  })

  it("reveals exact source ranges in CodeMirror", () => {
    expect(code).toContain("export type CodeOpenLocation")
    expect(code).toContain("EditorView.scrollIntoView")
    expect(code).toContain("selection: { anchor: start, head: end }")
    expect(code).toContain("openLocation")
    expect(code).toContain("revealRange")
  })

  it("connects visual selections, components and callers to exact code ranges", () => {
    expect(workspace).toContain("openCodeLocation")
    expect(workspace).toContain("target.sourceRange.start")
    expect(workspace).toContain("target.sourceRange.end")
    expect(workspace).toContain("Open exact code location")
    expect(workspace).toContain("Open component definition")
    expect(workspace).toContain("origin.range.start")
    expect(workspace).toContain("origin.range.end")
    expect(workspace).toContain("openLocation={codeLocation}")
  })

  it("extends the shortcut guide and ships responsive navigation UI", () => {
    expect(workspace).toContain("Quick open source file")
    expect(workspace).toContain("Find / replace current file")
    expect(styles).toContain(".source-quick-open")
    expect(styles).toContain(".source-find-panel")
    expect(styles).toContain(".source-recent-files")
  })
})
