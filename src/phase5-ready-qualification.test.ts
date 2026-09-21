import { createHash, randomUUID } from "node:crypto"
import { Buffer } from "node:buffer"
import { describe, expect, it } from "vitest"
import { deriveReleaseReadiness } from "../worker/ready-qualification.js"
import { analyzeReactSource } from "./webcanbe-engine/adapters/react/reactSourceAdapter"
import { summarizeCompatibility } from "./webcanbe-engine/core/compatibility"
import { releaseSnapshotHash } from "./webcanbe-engine/runtime/snapshotIntegrity"

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex")

function releaseRow(filesInput: Record<string, string>) {
  const projectId = randomUUID()
  const revisionId = `rev_${randomUUID()}`
  const files = Object.entries(filesInput).sort(([a], [b]) => a.localeCompare(b))
  const editable = files.filter(([file]) => /\.(?:tsx?|jsx?|mts|cts|mjs|cjs|css|json)$/.test(file)).map(([file, text]) => [file, text])
  const contentHash = sha256(JSON.stringify(editable))
  const history = {
    schema: 1,
    sourceScope: 2,
    projectId,
    revisions: [{ revisionId, projectId, parentRevisionId: null, createdAt: new Date(0).toISOString(), actor: randomUUID(), producer: "system", contentHash }],
    transactions: [],
    past: [],
    future: [],
  }
  const encodedFiles = files.map(([file, text]) => [file, Buffer.from(text).toString("base64")] as const)
  const snapshotHash = releaseSnapshotHash({ projectId, revisionId, contentHash, files: encodedFiles, history })
  return {
    source_project_id: projectId,
    source_revision_id: revisionId,
    source_content_hash: contentHash,
    snapshot_hash: snapshotHash,
    files: encodedFiles,
    history,
  }
}

describe("Phase 5 source-derived Ready qualification", () => {
  it("matches the canonical React compatibility analyzer on the immutable release bytes", () => {
    const code = `export default function App(){return <main><h1 style={{color:"red",fontSize:"24px"}}>Hello</h1><p>World</p></main>}`
    const row = releaseRow({ "src/App.tsx": code })
    const expected = summarizeCompatibility(analyzeReactSource("src/App.tsx", code, () => undefined))
    const actual = deriveReleaseReadiness(row)
    expect(actual.compatibility).toEqual(expected)
    expect(["ready", "partial", "code_only"]).toContain(actual.status)
  })

  it("derives code_only when no statically inspectable React target exists", () => {
    const row = releaseRow({ "src/data.json": "{\"ok\":true}" })
    const actual = deriveReleaseReadiness(row)
    expect(actual).toMatchObject({ status: "code_only", compatibility: { total: 0, full: 0, partial: 0, codeOnly: 0, score: 0 } })
  })

  it("refuses tampered release bytes before compatibility analysis", () => {
    const row = releaseRow({ "src/App.tsx": "export default function App(){return <div>Hello</div>}" })
    const tampered = { ...row, files: [["src/App.tsx", Buffer.from("export default function App(){return <div>TAMPERED</div>}").toString("base64")]] }
    expect(() => deriveReleaseReadiness(tampered)).toThrow("Release source integrity check failed.")
  })
})
