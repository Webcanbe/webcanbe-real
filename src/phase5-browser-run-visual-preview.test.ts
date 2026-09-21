import fs from "node:fs"
import { describe, expect, it } from "vitest"

describe("Phase 5 free managed Browser Run Visual preview", () => {
  it("builds the preview runtime separately from the main application", () => {
    const pkg = JSON.parse(fs.readFileSync("package.json","utf8"))
    const previewConfig = fs.readFileSync("vite.preview.config.ts","utf8")
    expect(pkg.scripts.build).toContain("vite build --config vite.preview.config.ts")
    expect(previewConfig).toContain('emptyOutDir: false')
    expect(previewConfig).toContain('"preview-assets/')
    expect(fs.readFileSync("vite.config.ts","utf8")).not.toContain("preview-runtime.html")
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
    expect(worker).toContain("releaseOrigin")
  })

  it("renders snapshot pixels in the editor and maps clicks back to source observations", () => {
    const workspace = fs.readFileSync("src/webcanbe-engine/visual-editor/CompatibleWorkspace.tsx","utf8")
    expect(workspace).toContain('transport?: "blob" | "http" | "raster" | "snapshot"')
    expect(workspace).toContain("function selectSnapshot")
    expect(workspace).toContain('preview?.transport === "snapshot" ? <img')
    expect(workspace).toContain('Managed Browser Run preview is ready')
  })
})
