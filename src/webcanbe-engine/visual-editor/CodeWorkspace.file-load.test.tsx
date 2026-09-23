// @vitest-environment jsdom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, expect, it, vi } from "vitest"
import CodeWorkspace from "./CodeWorkspace"

afterEach(() => vi.unstubAllGlobals())

it("explains a failed stylesheet read and restores its editable source on retry", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} })
  const rect = () => ({ left: 0, top: 0, right: 300, bottom: 30, width: 300, height: 30, x: 0, y: 0, toJSON() {} })
  Range.prototype.getBoundingClientRect = rect
  Range.prototype.getClientRects = (() => []) as unknown as typeof Range.prototype.getClientRects
  const revision = "rev_4431269b-6660-4090-9000-000000000001"
  const files = [{ file: "src/main.tsx", hash: "main-hash" }, { file: "src/style.css", hash: "css-hash" }]
  let stylesheetReads = 0
  const request = vi.fn(async (action: string, body?: Record<string, unknown>) => {
    if (action === "files") {
      if (body?.file === "src/style.css" && ++stylesheetReads === 1) return { ok: false, data: { error: "files returned 503 without a JSON response. Retry the action." } }
      return { ok: true, data: { revision, files, ...(body?.file ? { source: body.file === "src/style.css" ? "body { color: red; }" : "export default 1" } : {}) } }
    }
    if (action === "history") return { ok: true, data: { revision, history: { schema: 1 as const, projectId: "project", revisions: [], transactions: [], past: [], future: [] } } }
    if (action === "drafts") return { ok: true, data: { draftState: { version: 0, drafts: [] } } }
    throw new Error(`Unexpected ${action} request`)
  })
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  const waitFor = async (assertion: () => void) => vi.waitFor(async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)) }); assertion() })
  try {
    await act(async () => root.render(<CodeWorkspace projectId="project" request={request} epoch={0} connected visible="code" onAccepted={async () => {}} />))
    await waitFor(() => expect(host.querySelector(".cm-content")?.textContent).toContain("export default 1"))
    await act(async () => (host.querySelectorAll(".source-all-files button")[1] as HTMLButtonElement).click())
    await waitFor(() => expect(host.querySelector(".source-file-load-error")?.textContent).toContain("503"))
    expect(host.querySelector(".cm-content")).toBeNull()
    expect(host.querySelector(".source-file-load-error [role=alert]")).toBeNull()
    expect(host.querySelector(".source-file-load-error button")?.textContent).toBe("Retry loading file")
    await act(async () => (host.querySelector(".source-file-load-error button") as HTMLButtonElement).click())
    await waitFor(() => expect(host.querySelector(".cm-content")?.textContent).toContain("body { color: red; }"))
    expect(host.querySelector(".source-file-load-error")).toBeNull()
    expect(stylesheetReads).toBe(2)
    expect(request.mock.calls.some(([action]) => action === "code")).toBe(false)
  } finally {
    await act(async () => root.unmount())
    host.remove()
  }
})
