import fs from "node:fs"
import { describe, expect, it } from "vitest"

const code = fs.readFileSync("src/webcanbe-engine/visual-editor/CodeWorkspace.tsx", "utf8")

describe("Phase 5 accepted-source refresh and reload recovery", () => {
  it("reads accepted files and history as one coherent revision snapshot", () => {
    expect(code).toContain("async function readAcceptedSnapshot()")
    expect(code).toContain('Promise.all([requests.current("files"), requests.current("history")])')
    expect(code).toContain("history.data.revision !== revision")
    expect(code).toContain("Accepted source changed while reading its history.")
  })

  it("uses the same coherent snapshot on initial reconnect/load", () => {
    const load = code.slice(code.indexOf("useEffect(() => {\n    if (!connected) return"), code.indexOf("useEffect(() => {\n    if (!connected || draftsLoaded) return"))
    expect(load).toContain("const snapshot = await readAcceptedSnapshot()")
    expect(load).toContain("setFiles(snapshot.files)")
    expect(load).toContain("setHead(snapshot.revision)")
    expect(load).toContain("setLedger(snapshot.history)")
  })

  it("refreshes accepted authority without discarding dirty drafts", () => {
    expect(code).toContain("async function refreshAcceptedSource()")
    expect(code).toContain("Refresh accepted")
    expect(code).toContain("existing && existing.text !== existing.baseline")
    expect(code).toContain("return all")
    expect(code).toContain("Local drafts were retained")
  })

  it("refreshes a clean active file to the same accepted revision", () => {
    expect(code).toContain('requests.current("files", { file: active })')
    expect(code).toContain("currentFile.data.revision !== revision")
    expect(code).toContain("text: source, baseline: source, hash, baseRevision: revision")
  })

  it("invalidates stale derived state after authority refresh", () => {
    expect(code).toContain("pendingSave.current = undefined")
    expect(code).toContain("setValidation(undefined)")
    expect(code).toContain("setProjectResults([])")
    expect(code).toContain("setProjectSearchMeta(undefined)")
    expect(code).toContain('setProjectSearchError("")')
  })

  it("documents refresh as accepted-source synchronization, not draft reload", () => {
    expect(code).toContain("Refresh accepted re-reads server source/history without discarding local drafts.")
    expect(code).toContain("Refreshing accepted source and history")
    expect(code).toContain("stale drafts are now marked against the new HEAD")
  })
})
