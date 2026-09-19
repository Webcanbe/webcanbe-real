import fs from "node:fs"
import { describe, expect, it } from "vitest"

const registry = fs.readFileSync("src/webcanbe-engine/runtime/projectRegistry.ts", "utf8")
const authority = fs.readFileSync("src/webcanbe-engine/runtime/hostedAuthority.ts", "utf8")
const sourceApi = fs.readFileSync("src/webcanbe-engine/runtime/sourceApi.ts", "utf8")
const code = fs.readFileSync("src/webcanbe-engine/visual-editor/CodeWorkspace.tsx", "utf8")
const workspace = fs.readFileSync("src/webcanbe-engine/visual-editor/CompatibleWorkspace.tsx", "utf8")
const styles = fs.readFileSync("src/webcanbe-engine/visual-editor/compatibleWorkspace.css", "utf8")

describe("Phase 5 bounded project source search", () => {
  it("adds search as a read-only session capability", () => {
    expect(registry).toContain('"search"')
    const reads = authority.slice(authority.indexOf("export const readOperations"), authority.indexOf("export const writeOperations"))
    const writes = authority.slice(authority.indexOf("export const writeOperations"), authority.indexOf("export const roleOperations"))
    expect(reads).toContain('"search"')
    expect(writes).not.toContain('"search"')
  })

  it("bounds literal server-side search and rechecks accepted source authority", () => {
    expect(sourceApi).toContain("SOURCE_SEARCH_LIMITS")
    expect(sourceApi).toContain("queryChars: 160")
    expect(sourceApi).toContain("results: 100")
    expect(sourceApi).toContain("perFile: 20")
    expect(sourceApi).toContain("fileBytes: 512 * 1024")
    expect(sourceApi).toContain("scannedBytes: 8 * 1024 * 1024")
    expect(sourceApi).toContain('action === "search"')
    expect(sourceApi).toContain("sourceSearch(durable.files()")
    expect(sourceApi).toContain("await assertAccess(); durable.assertBase(revision)")
    expect(sourceApi).toContain("searchResults: search.results")
    expect(sourceApi).toContain("truncated: search.truncated")
    expect(sourceApi).toContain("String.fromCharCode(92)")
  })

  it("uses standard current-file and project-search shortcuts", () => {
    expect(code).toContain('mod && !event.shiftKey && !event.altKey && key === "f"')
    expect(code).toContain('mod && event.shiftKey && !event.altKey && key === "f"')
    expect(workspace).toContain("Find / replace current file")
    expect(workspace).toContain("Search accepted project source")
    expect(workspace).toContain("⌘/Ctrl F")
    expect(workspace).toContain("⇧⌘/Ctrl F")
  })

  it("searches accepted source through the server and exposes bounded metadata", () => {
    expect(code).toContain('requests.current("search"')
    expect(code).toContain("expectedRevision: head")
    expect(code).toContain("caseSensitive: projectCaseSensitive")
    expect(code).toContain("limit: 100")
    expect(code).toContain("projectSearchMeta.scannedFiles")
    expect(code).toContain("bounded/truncated")
    expect(code).toContain("Accepted source only")
  })

  it("refuses to claim exact accepted-source offsets inside dirty drafts", () => {
    expect(code).toContain("hasUnsavedDraft")
    expect(code).toContain("Search result is anchored to accepted source")
    expect(code).toContain("This exact source location belongs to accepted source")
    expect(code).toContain("Save or discard")
  })

  it("ships responsive project-search result UI", () => {
    expect(styles).toContain(".source-project-search-backdrop")
    expect(styles).toContain(".source-project-search-results")
    expect(styles).toContain(".source-project-search-meta")
  })
})
