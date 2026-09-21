import fs from "node:fs"
import { describe, expect, it } from "vitest"

describe("Phase 5 free managed Browser Run Visual preview", () => {
  it("lazy-loads the preview runtime through the primary SPA build", () => {
    const pkg = JSON.parse(fs.readFileSync("package.json","utf8"))
    const app = fs.readFileSync("src/App.tsx","utf8")
    const host = fs.readFileSync("src/PreviewRuntimeHost.tsx","utf8")
    expect(pkg.scripts.build).toBe("tsc -b && vite build")
    expect(app).toContain('lazy(() => import("./PreviewRuntimeHost"))')
    expect(app).toContain('basePath==="/__wcb_preview_runtime"')
    expect(host).toContain('import("./preview-runtime")')
    expect(host).toContain('hostRoot.id = "wcb-preview-host-root"')
    expect(fs.existsSync("vite.preview.config.ts")).toBe(false)
    expect(fs.existsSync("preview-runtime.html")).toBe(false)
  })

  it("binds Browser Run without adding a provider API secret", () => {
    const wrangler = JSON.parse(fs.readFileSync("wrangler.jsonc","utf8"))
    expect(wrangler.browser).toEqual({ binding: "BROWSER" })
    expect(JSON.stringify(wrangler.secrets ?? {})).not.toMatch(/BROWSER|CLOUDFLARE_API_TOKEN/)
  })

  it("keeps imported project networking closed inside the managed preview runtime", () => {
    const runtime = fs.readFileSync("src/preview-runtime.ts","utf8")
    expect(runtime).toContain('Object.defineProperty(globalThis, "fetch"')
    expect(runtime).toContain('Object.defineProperty(globalThis, "WebSocket"')
    expect(runtime).toContain('Object.defineProperty(globalThis, "EventSource"')
    expect(runtime).toContain('Object.defineProperty(globalThis, "RTCPeerConnection"')
    expect(runtime).toContain("data-wcb-id")
    expect(runtime).toContain("__WCB_PROJECT_PAYLOAD__")
    expect(runtime).not.toContain("__Host-wcb-session")
    expect(runtime).not.toContain("X-WCB-CSRF")
  })

  it("keeps Visual production edits source-first and explicitly limited to safe static text", () => {
    const worker = fs.readFileSync("worker/editor-projects.js","utf8")
    expect(worker).toContain('body.edit.type!=="text"')
    expect(worker).toContain('producer:"visual"')
    expect(worker).toContain('editType:"text"')
    expect(worker).toContain('UPDATE wcb_projects SET revision=$2,files=$3,history=$4,source_epoch=source_epoch+1')
    expect(worker).toContain("const history=structuredClone(state.history)")
    expect(worker).toContain("history.transactions.push(tx)")
  })

  it("renders snapshot pixels in the editor and maps clicks back to source observations", () => {
    const workspace = fs.readFileSync("src/webcanbe-engine/visual-editor/CompatibleWorkspace.tsx","utf8")
    const worker = fs.readFileSync("worker/editor-projects.js","utf8")
    expect(workspace).toContain('transport?: "blob" | "http" | "raster" | "snapshot"')
    expect(workspace).toContain("function selectSnapshot")
    expect(workspace).toContain('preview?.transport === "snapshot" ? <img')
    expect(workspace).toContain('Managed Browser Run preview is ready')
    expect(worker).toContain('waitForSelector:{selector:"html[data-wcb-ready=\'1\']",timeout:12000}')
    expect(worker).not.toContain("visible:false")
  })
})
