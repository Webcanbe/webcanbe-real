import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { afterEach, describe, expect, it } from "vitest"
import { MutationHistory } from "./webcanbe-engine/mutations/sourceMutations"
import { DurableSource, contentHash, transactionEntry } from "./webcanbe-engine/mutations/durableSource"
import { buildIndependentExport } from "./webcanbe-engine/runtime/independentExport"
import { detectProject, extractSafeZip, type ProjectRecord } from "./webcanbe-engine/runtime/projectRegistry"
import { exportProjectZip } from "./webcanbe-engine/runtime/projectExport"
import { acceptsRevisionTransition, type RevisionState } from "./webcanbe-engine/visual-editor/revisionTransition"

const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }) })

function fixture() {
  const parent = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "wcb-phase5-durable-export-")))
  roots.push(parent)
  const root = path.join(parent, "project")
  fs.cpSync("fixtures/compatible-react-vite", root, { recursive: true })
  const detection = detectProject(root, process.cwd())
  if (!detection.supported || !detection.sourceDirectory) throw new Error(detection.reason ?? "Fixture is unsupported.")
  const project: ProjectRecord = {
    id: randomUUID(),
    name: "Phase 5 durable export proof",
    root,
    archiveRoot: root,
    sourceRoot: path.join(root, detection.sourceDirectory),
    imported: true,
    detection,
    history: new MutationHistory(),
  }
  const historyRoot = path.join(parent, "history")
  return { parent, root, project, historyRoot, source: new DurableSource(project, historyRoot) }
}

describe("Phase 5 durable save, canonical revision and standalone export", () => {
  it("persists an accepted Code save as one durable source revision plus history transaction", () => {
    const d = fixture()
    const file = "src/App.tsx", beforeRevision = d.source.revision(), before = d.source.files().get(file)!
    const content = before + "\n// phase5 durable accepted source"
    const key = randomUUID(), requestHash = contentHash(JSON.stringify({ key, beforeRevision, file }))
    const validation = { level: "compile" as const, passed: true, diagnostics: [] }
    const entry = transactionEntry(d.project.id, beforeRevision, "code", key, requestHash, "Phase 5 durable Code save", validation)
    entry.actor = "phase5-test"
    entry.editType = "code"
    entry.file = file
    entry.operations = [{ kind: "update", file, expectedHash: contentHash(before), content }]

    const accepted = d.source.commit({ expectedRevision: beforeRevision, operations: entry.operations, entry, authorize: () => {} })
    expect(accepted.success).toBe(true)
    expect(accepted.newRevisionId).toBeTruthy()
    expect(accepted.newRevisionId).not.toBe(beforeRevision)

    const reopened = new DurableSource(d.project, d.historyRoot)
    expect(reopened.revision()).toBe(accepted.newRevisionId)
    expect(reopened.files().get(file)).toBe(content)
    expect(reopened.history().transactions.at(-1)?.id).toBe(accepted.id)
    expect(reopened.history().transactions.at(-1)?.producer).toBe("code")
    expect(reopened.history().revisions.at(-1)?.revisionId).toBe(accepted.newRevisionId)
    expect(reopened.history().revisions.at(-1)?.parentRevisionId).toBe(beforeRevision)
  })

  it("exports the accepted bytes and builds them in a fresh checkout without Webcanbe runtime state", async () => {
    const d = fixture()
    const file = "src/App.tsx", before = d.source.files().get(file)!, beforeRevision = d.source.revision()
    const marker = "// phase5 standalone export marker", content = before + "\n" + marker
    const key = randomUUID()
    const entry = transactionEntry(d.project.id, beforeRevision, "code", key, contentHash(key), "Accepted source for standalone export", { level: "compile", passed: true, diagnostics: [] })
    entry.editType = "code"; entry.file = file
    const operation = { kind: "update" as const, file, expectedHash: contentHash(before), content }
    entry.operations = [operation]
    const accepted = d.source.commit({ expectedRevision: beforeRevision, operations: [operation], entry, authorize: () => {} })
    expect(accepted.success).toBe(true)

    const archive = await exportProjectZip(d.project)
    const independent = await buildIndependentExport(archive, process.cwd())
    expect(independent.sourceUnchanged).toBe(true)
    expect(independent.profile).toBeTruthy()

    const extracted = path.join(d.parent, "exported")
    await extractSafeZip(archive, extracted)
    expect(fs.readFileSync(path.join(extracted, file), "utf8")).toContain(marker)
    expect(fs.existsSync(path.join(extracted, ".webcanbe"))).toBe(false)
    const manifest = JSON.parse(fs.readFileSync(path.join(extracted, "package.json"), "utf8"))
    const declared = { ...(manifest.dependencies ?? {}), ...(manifest.devDependencies ?? {}) }
    expect(Object.keys(declared).some(name => /webcanbe/i.test(name))).toBe(false)
  })

  it("keeps Visual, Code, Split and AI on guarded canonical acceptance and export", () => {
    const workspace = fs.readFileSync("src/webcanbe-engine/visual-editor/CompatibleWorkspace.tsx", "utf8")
    const code = fs.readFileSync("src/webcanbe-engine/visual-editor/CodeWorkspace.tsx", "utf8")
    const sourceApi = fs.readFileSync("src/webcanbe-engine/runtime/sourceApi.ts", "utf8")

    expect(workspace).toContain('const [surface, setSurface] = useState<"canvas" | "code" | "split" | "history">')
    expect(workspace).toContain("<CodeWorkspace")
    expect(workspace).toContain("request={request}")
    expect(workspace).toContain("onAccepted={sourceAccepted}")
    expect(workspace).toContain("onApplied={sourceAccepted}")
    expect(workspace).toContain("if (!updateRevision(data.revision, data)) return")
    expect(workspace).toContain("acceptsRevisionTransition(")
    expect(workspace).toContain('expectedRevision: revision.current')
    expect(workspace).toContain('request("mutate"')
    expect(code).toContain('requests.current("code"')
    expect(sourceApi).toContain('action === "code"')
    expect(sourceApi).toContain('transactionEntry(project.id, revision, "visual"')
    expect(sourceApi.match(/durable\.commit\(/g)?.length).toBeGreaterThanOrEqual(2)

    // Revision identities are opaque. The same CAS contract serves every producer,
    // including inverse operations; neither lexical ordering nor producer wins.
    let canonical: RevisionState = { revision: "z-base", connection: 1 }
    const accept = (origin: RevisionState, revision: string) => {
      if (acceptsRevisionTransition(canonical, origin)) canonical = { ...canonical, revision }
    }
    for (const producer of ["Visual", "Code", "Split", "AI", "undo", "redo", "restore"]) {
      const origin = { ...canonical }
      accept(origin, `${producer}-accepted`)
      expect(canonical.revision).toBe(`${producer}-accepted`)
      accept(origin, "delayed-older-result")
      expect(canonical.revision).toBe(`${producer}-accepted`)
    }
    const disconnected = { ...canonical }
    canonical = { ...canonical, connection: 2 }
    accept(disconnected, "old-connection-result")
    expect(acceptsRevisionTransition(canonical, undefined)).toBe(false)
    const exportRequest = { expectedRevision: canonical.revision }
    expect(exportRequest.expectedRevision).toBe("restore-accepted")
  })

  it("keeps export behind independent-build validation and fresh authority", () => {
    const sourceApi = fs.readFileSync("src/webcanbe-engine/runtime/sourceApi.ts", "utf8")
    const validation = fs.readFileSync("src/webcanbe-engine/mutations/sourceValidation.ts", "utf8")
    expect(sourceApi).toContain('if (action === "export")')
    expect(sourceApi).toContain('validateStagedProject(project, projectRoot, durable.files(), "checkpoint", archive)')
    expect(sourceApi).toContain("await assertAccess(); durable.assertBase(revision)")
    expect(sourceApi).toContain('independentBuild: "PASS"')
    expect(validation).toContain("buildIndependentExport(exportArchive, applicationRoot)")
  })
})
