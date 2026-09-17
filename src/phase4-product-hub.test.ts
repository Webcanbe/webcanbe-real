import { describe, expect, it } from "vitest"
import fs from "node:fs"

describe("Phase 4 product-library information architecture", () => {
  const app = fs.readFileSync("src/App.tsx", "utf8")
  it("keeps My Projects and Purchases as separate product destinations with explicit states", () => {
    expect(app).toContain('["My projects", "/projects"]')
    expect(app).toContain('["Purchases", "/purchases"]')
    expect(app).toContain('if (path === "/purchases") return <Protected><Purchases/></Protected>')
    expect(app).toContain('Purchases stay separate until you create a copy.')
    expect(app).toContain('Nothing here yet')
    expect(app).toContain('Something needs attention')
  })
  it("derives dashboard attention from real purchase/copy state rather than fake analytics", () => {
    expect(app).toContain('Ready to open')
    expect(app).toContain('Recent product activity')
    expect(app).toContain('Only project and purchase state — no invented analytics.')
    expect(app).not.toContain('Good afternoon, Oliver.')
  })
})

describe("Phase 4 real workspace modes", () => {
  const workspace = fs.readFileSync("src/webcanbe-engine/visual-editor/CompatibleWorkspace.tsx", "utf8")
  const code = fs.readFileSync("src/webcanbe-engine/visual-editor/CodeWorkspace.tsx", "utf8")
  const css = fs.readFileSync("src/phase4-product-hub.css", "utf8")
  it("exposes Visual, Code, Split and Changes while preserving the actual source workspace", () => {
    expect(workspace).toContain('>Visual</button>')
    expect(workspace).toContain('>Code</button>')
    expect(workspace).toContain('>Split</button>')
    expect(workspace).toContain('>Changes</button>')
    expect(workspace).toContain('surface === "split"')
    expect(code).toContain('visible: "canvas" | "code" | "split" | "history"')
    expect(code).toContain('visible === "code" || visible === "split"')
  })
  it("uses a true-white production workspace and a two-surface split layout", () => {
    expect(css).toContain('.compatible-workspace { min-height:100vh; background:#fff;')
    expect(css).toContain('.compatible-preview-shell.split-mode { display:grid;')
    expect(css).toContain('grid-template-columns:minmax(0,1fr) minmax(360px,.92fr)')
  })
})
