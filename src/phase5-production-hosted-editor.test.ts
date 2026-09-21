import fs from "node:fs"
import { describe, expect, it } from "vitest"
import { shouldUseHostedEditor } from "./webcanbe-engine/visual-editor/editorMode"

describe("Phase 5 production hosted editor boundary", () => {
  it("uses hosted editor APIs for production working copies without globally enabling hosted product mode", () => {
    expect(shouldUseHostedEditor("https://webcanbe.com", undefined, "hosted")).toBe(true)
    expect(shouldUseHostedEditor("https://webcanbe.com", null, "hosted")).toBe(true)
    expect(shouldUseHostedEditor("https://preview.example", "hosted", undefined)).toBe(true)
    expect(shouldUseHostedEditor("http://localhost:5173", undefined, "hosted")).toBe(false)
    expect(shouldUseHostedEditor("https://webcanbe.com", undefined, undefined)).toBe(false)
  })

  it("keeps the production page free of the global wcb-editor-mode switch", () => {
    const index = fs.readFileSync("index.html", "utf8")
    expect(index).toContain('<meta name="wcb-product-read-mode" content="hosted" />')
    expect(index).not.toContain('name="wcb-editor-mode"')
  })

  it("connects CompatibleWorkspace through the hosted session/project boundary", () => {
    const source = fs.readFileSync("src/webcanbe-engine/visual-editor/CompatibleWorkspace.tsx", "utf8")
    expect(source).toContain("const hostedMode = hostedEditorMode()")
    expect(source).toContain('fetch("/__webcanbe/auth/session"')
    expect(source).toContain('fetch("/__webcanbe/api/projects"')
    expect(source).toContain('fetch(\`/__webcanbe/api/projects/\${projectId}/session\`')
    expect(source).toContain('"X-WCB-CSRF"')
  })
})
