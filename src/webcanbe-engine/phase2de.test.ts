import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { build } from "esbuild"
import { afterEach, describe, expect, it } from "vitest"
import { createServer, type ViteDevServer } from "vite"
import { ProjectRegistry } from "./runtime/projectRegistry"
import { webCanBeFixturePlugin } from "./runtime/viteFixturePlugin"
import { contentHash, transactionEntry } from "./mutations/durableSource"
import { validateSource } from "./mutations/sourceValidation"
import type { FileOperation, SourceValidation } from "./core/types"

const temporary: string[] = [], servers: ViteDevServer[] = []
afterEach(async () => { for (const server of servers.splice(0)) await server.close(); for (const dir of temporary.splice(0)) fs.rmSync(dir, { recursive: true, force: true }) })
const valid: SourceValidation = { level: "parse", passed: true, diagnostics: [] }
function setup() {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "wcb-phase2de-"))); temporary.push(directory)
  fs.cpSync(path.join(process.cwd(), "fixtures/compatible-react-vite"), path.join(directory, "fixtures/compatible-react-vite"), { recursive: true })
  const registry = new ProjectRegistry(directory), id = "phase1-fixture", durable = registry.durable(id)
  return { directory, registry, id, durable }
}
function update(durable: ReturnType<ProjectRegistry["durable"]>, file: string, content: string): FileOperation { return { kind: "update", file, content, expectedHash: contentHash(durable.files().get(file)!) } }
function commit(durable: ReturnType<ProjectRegistry["durable"]>, operations: FileOperation[], extra: Record<string, unknown> = {}) {
  const revision = durable.revision(), key = randomUUID()
  return durable.commit({ expectedRevision: revision, operations, entry: transactionEntry("phase1-fixture", revision, "code", key, contentHash(key), "Synthetic test change", valid), authorize: () => {}, ...extra })
}
async function apiSetup() {
  const data = setup(), server = await createServer({ configFile: false, root: process.cwd(), cacheDir: path.join(data.directory, "cache"), plugins: [webCanBeFixturePlugin(process.cwd(), { registry: data.registry, editorKey: "synthetic-source-key" })], server: { host: "127.0.0.1", port: 0 }, logLevel: "silent" })
  servers.push(server); await server.listen()
  const origin = `http://127.0.0.1:${(server.httpServer!.address() as { port: number }).port}`
  const session = data.registry.createSession(data.id)!
  const request = async (action: string, body: Record<string, unknown> = {}, authority = session, id = data.id) => {
    const response = await fetch(`${origin}/__webcanbe/api/projects/${id}/${action}`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "X-WCB-Editor-Key": "synthetic-source-key" }, body: JSON.stringify({ ...authority, ...body }) })
    return { status: response.status, data: await response.json() }
  }
  return { ...data, request, session }
}

describe("durable source revisions", () => {
  it("hydrates A/B, head and undo/redo across registry restarts without replacing unrelated files", () => {
    const { directory, durable } = setup(), original = durable.files()
    const a = commit(durable, [update(durable, "src/App.css", original.get("src/App.css")! + "\n/* A */")])
    const b = commit(durable, [update(durable, "src/App.tsx", original.get("src/App.tsx")! + "\n// B")])
    const reopened = new ProjectRegistry(directory).durable("phase1-fixture")
    expect(reopened.history().transactions.map(entry => entry.id)).toEqual([a.id, b.id])
    expect(reopened.revision()).toBe(b.newRevisionId)
    const inverse = reopened.revertOperations(a.id)
    const reverted = commit(reopened, inverse.operations, { reverts: a.id })
    expect(reopened.files().get("src/App.css")).toBe(original.get("src/App.css"))
    expect(reopened.files().get("src/App.tsx")).toContain("// B")
    expect(reverted.baseRevisionId).toBe(b.newRevisionId)
    const restarted = new ProjectRegistry(directory).durable("phase1-fixture")
    const redo = restarted.revertOperations(undefined, true)
    commit(restarted, redo.operations, { reverts: redo.transactionId, redo: true })
    expect(restarted.files().get("src/App.css")).toContain("/* A */")
    expect(restarted.files().get("src/App.tsx")).toContain("// B")
  })
  it("rejects selective revert when the same file contains later work", () => {
    const { durable } = setup(), file = "src/App.css"
    const a = commit(durable, [update(durable, file, durable.files().get(file)! + "/* A */")])
    commit(durable, [update(durable, file, durable.files().get(file)! + "/* B */")])
    expect(() => durable.revertOperations(a.id)).toThrow("later work")
    expect(durable.files().get(file)).toContain("/* B */")
  })
  it("commits create/update/rename/delete together and inverses them after restart", () => {
    const { directory, durable } = setup(), before = durable.files()
    const entry = commit(durable, [
      { kind: "create", file: "src/new/Created.ts", expectedHash: null, content: "export const created = 1" },
      update(durable, "src/App.tsx", before.get("src/App.tsx")! + "\n// updated"),
      { kind: "rename", file: "src/App.css", to: "src/Renamed.css", expectedHash: contentHash(before.get("src/App.css")!) },
      { kind: "delete", file: "src/tailwind.css", expectedHash: contentHash(before.get("src/tailwind.css")!) },
    ])
    expect(durable.files().has("src/App.css")).toBe(false)
    expect(durable.files().has("src/Renamed.css")).toBe(true)
    expect(durable.files().has("src/new/Created.ts")).toBe(true)
    const reopened = new ProjectRegistry(directory).durable("phase1-fixture")
    commit(reopened, reopened.revertOperations(entry.id).operations, { reverts: entry.id })
    expect(reopened.files()).toEqual(before)
  })
  it("rolls back an injected partial multi-file write and keeps history/source consistent", () => {
    const { directory, durable } = setup(), before = durable.files(), head = durable.revision()
    expect(() => commit(durable, [update(durable, "src/App.css", "/* new */"), { kind: "create", file: "src/new/deeper/file.ts", expectedHash: null, content: "export {}" }], { fault: (phase: string, index: number) => { if (phase === "write" && index === 0) throw new Error("Synthetic disk failure") } })).toThrow("Synthetic disk failure")
    expect(durable.files()).toEqual(before)
    expect(durable.revision()).toBe(head)
    expect(new ProjectRegistry(directory).durable("phase1-fixture").history().transactions).toHaveLength(0)
  })
  it("rejects all old hashes before the first write", () => {
    const { durable } = setup(), before = durable.files()
    expect(() => commit(durable, [update(durable, "src/App.css", "/* new */"), { kind: "delete", file: "src/App.tsx", expectedHash: "wrong" }])).toThrow("hash")
    expect(durable.files()).toEqual(before)
  })
  it("includes immutable assets and configuration in the total project storage limit", () => {
    const { durable, registry } = setup(), root = registry.get("phase1-fixture")!.root
    fs.mkdirSync(path.join(root, "public"))
    for (let index = 0; index < 19; index++) fs.writeFileSync(path.join(root, "public", `asset-${index}.png`), Buffer.alloc(2 * 1024 * 1024))
    const before = durable.revision()
    expect(() => commit(durable, [{ kind: "create", file: "src/Large.ts", expectedHash: null, content: "/**" + "x".repeat(2 * 1024 * 1024 - 6) + "*/" }])).toThrow("asset limit")
    expect(durable.revision()).toBe(before)
  })
  it.each(["../App.tsx", "src/../../App.tsx", "src/../App.tsx", "package.json", "src/.env", "src/link.tsx"])("rejects unauthorized operation %s", file => {
    const { directory, durable, registry } = setup(), outside = path.join(directory, "outside.tsx")
    fs.writeFileSync(outside, "private canary")
    if (file === "src/link.tsx") fs.symlinkSync(outside, path.join(registry.get("phase1-fixture")!.root, file))
    expect(() => commit(durable, [{ kind: "create", file, expectedHash: null, content: "bad" }])).toThrow()
    expect(fs.readFileSync(outside, "utf8")).toBe("private canary")
  })
  it("rejects symlink directories, hard links, case aliases and oversized source", () => {
    const { directory, durable, registry } = setup(), root = registry.get("phase1-fixture")!.sourceRoot
    expect(() => commit(durable, [{ kind: "create", file: "src/APP.tsx", expectedHash: null, content: "bad" }])).toThrow()
    expect(() => commit(durable, [update(durable, "src/App.tsx", "x".repeat(2 * 1024 * 1024 + 1))])).toThrow("size")
    fs.symlinkSync(directory, path.join(root, "escape"))
    expect(() => commit(durable, [{ kind: "create", file: "src/escape/out.ts", expectedHash: null, content: "bad" }])).toThrow()
    fs.unlinkSync(path.join(root, "escape"))
    fs.linkSync(path.join(root, "App.tsx"), path.join(root, "hard.tsx"))
    expect(() => durable.files()).toThrow("identity")
  })
  it("invalidates source anchors after outside writes and rejects the ABA revision after undo", () => {
    const { durable, registry } = setup(), before = durable.files(), old = durable.revision()
    const a = commit(durable, [update(durable, "src/App.css", "/* A */")])
    commit(durable, durable.revertOperations(a.id).operations, { reverts: a.id })
    expect(durable.files()).toEqual(before); expect(durable.revision()).not.toBe(old)
    expect(() => durable.assertBase(old)).toThrow("Source changed")
    fs.appendFileSync(path.join(registry.get("phase1-fixture")!.sourceRoot, "App.tsx"), "// outside")
    expect(durable.revision()).toMatch(/^external_/)
    expect(() => durable.assertBase(durable.revision())).toThrow("reconciliation")
  })
  it("excludes overlapping local servers with a kernel-released SQLite project lock", () => {
    const { directory, durable } = setup(), other = new ProjectRegistry(directory).durable("phase1-fixture")
    const release = durable.lease()
    try { expect(() => other.lease()).toThrow("Another server") } finally { release() }
    const unlock = other.lease(); unlock()
  })
  it.each(["journal", "write", "committed"])("recovers a real killed child process at %s", async phase => {
    const { directory, durable, registry } = setup(), before = durable.files(), old = durable.revision()
    const runtime = path.join(directory, "crash-runtime.cjs")
    await build({ stdin: { contents: 'export {ProjectRegistry} from "./src/webcanbe-engine/runtime/projectRegistry"; export {contentHash,transactionEntry} from "./src/webcanbe-engine/mutations/durableSource";', resolveDir: process.cwd() }, bundle: true, platform: "node", format: "cjs", packages: "external", outfile: runtime, logLevel: "silent" })
    const child = spawnSync(process.execPath, ["-e", `const {ProjectRegistry,contentHash,transactionEntry}=require(${JSON.stringify(runtime)});const r=new ProjectRegistry(${JSON.stringify(directory)}),d=r.durable('phase1-fixture'),base=d.revision();const operations=['src/App.css','src/App.tsx'].map(file=>({kind:'update',file,expectedHash:contentHash(d.files().get(file)),content:d.files().get(file)+'\\n/* child change */'}));d.commit({expectedRevision:base,operations,entry:transactionEntry('phase1-fixture',base,'code','synthetic-crash-key','request','Crash recovery', {level:'parse',passed:true,diagnostics:[]}),authorize:()=>{},fault:(point,index)=>{if(point===${JSON.stringify(phase)}&&(point!=='write'||index===0))process.kill(process.pid,'SIGKILL')}});`], { env: { ...process.env, NODE_PATH: path.join(process.cwd(), "node_modules") }, encoding: "utf8", timeout: 15000 })
    expect(child.signal, child.stderr).toBe("SIGKILL")
    const release = await registry.lock("phase1-fixture")
    // A surviving server also recovers a crashed peer before it reads source.
    try { expect(durable.files().get("src/App.css")).toBe(phase === "committed" ? before.get("src/App.css")! + "\n/* child change */" : before.get("src/App.css")) } finally { release() }
    const reopened = new ProjectRegistry(directory).durable("phase1-fixture")
    if (phase === "committed") { expect(reopened.history().transactions).toHaveLength(1); expect(reopened.files().get("src/App.css")).toContain("child change"); expect(reopened.files().get("src/App.tsx")).toContain("child change"); expect(reopened.retry("synthetic-crash-key", "request")?.success).toBe(true) }
    else { expect(reopened.revision()).toBe(old); expect(reopened.files()).toEqual(before); expect(reopened.history().transactions).toHaveLength(0) }
    expect(fs.existsSync(path.join(directory, ".webcanbe/history/phase1-fixture/pending.json"))).toBe(false)
  })
  it("quarantines recovery that encounters unrelated changes", async () => {
    const { directory, durable, registry } = setup()
    const history = durable.history(), file = "src/App.css", before = durable.files().get(file)!
    fs.writeFileSync(path.join(directory, ".webcanbe/history/phase1-fixture/pending.json"), JSON.stringify({ schema: 1, projectId: "phase1-fixture", transactionId: "crashed", next: history, changes: [{ file, before, after: "/* crashed */" }] }))
    fs.writeFileSync(path.join(registry.get("phase1-fixture")!.root, file), "/* unrelated work */")
    expect(() => new ProjectRegistry(directory)).toThrow("quarantined")
    expect(fs.readFileSync(path.join(registry.get("phase1-fixture")!.root, file), "utf8")).toBe("/* unrelated work */")
  })
})

describe("shared code/visual HTTP acceptance", () => {
  it("keeps an invalid draft outside canonical source/history and records failed save validation", async () => {
    const { request, durable } = await apiSetup(), file = "src/App.tsx", before = durable.files().get(file)!, revision = durable.revision()
    const draft = await request("validate", { file, content: "export const App = () => <main>" })
    expect(draft.data.validation.passed).toBe(false); expect(durable.revision()).toBe(revision); expect(durable.history().transactions).toHaveLength(0)
    const save = await request("code", { expectedRevision: revision, idempotencyKey: randomUUID(), operations: [update(durable, file, "export const App = () => <main>")] })
    expect(save.status).toBe(422); expect(durable.files().get(file)).toBe(before); expect(durable.revision()).toBe(revision)
    expect(durable.history().transactions.at(-1)?.status).toBe("rejected")
    const repaired = await request("code", { expectedRevision: revision, idempotencyKey: randomUUID(), operations: [update(durable, file, before + "\n// recovered")] })
    expect(repaired.status, JSON.stringify(repaired.data)).toBe(200); expect(durable.files().get(file)).toContain("// recovered")
  })
  it("serializes concurrent requests and replays only identical idempotency keys", async () => {
    const { request, durable } = await apiSetup(), revision = durable.revision(), file = "src/App.css"
    const body = { expectedRevision: revision, idempotencyKey: randomUUID(), operations: [update(durable, file, durable.files().get(file)! + "/* first */")] }
    const [one, two] = await Promise.all([request("code", body), request("code", { ...body, idempotencyKey: randomUUID() })])
    expect([one.status, two.status].sort()).toEqual([200, 409])
    const retry = await request("code", body)
    expect(retry.status).toBe(200); expect(retry.data.replayed).toBe(true); expect(durable.history().transactions).toHaveLength(1)
    expect((await request("code", { ...body, operations: [update(durable, file, "/* different */")] })).status).toBe(409)
  })
  it("shares canonical changes and rejects stale SourceAnchors after structural code edits", async () => {
    const { request, durable } = await apiSetup()
    const compatibility = await request("compatibility"), target = compatibility.data.targets.find((item: { elementName: string; text: string }) => item.elementName === "h1")
    const visual = await request("mutate", { identity: target.identity, expectedRevision: compatibility.data.revision, idempotencyKey: randomUUID(), edit: { type: "text", value: "Visual source acceptance" } })
    expect(visual.status).toBe(200)
    const file = target.identity.file, loaded = await request("files", { file })
    expect(loaded.data.source).toContain("Visual source acceptance")
    const structural = await request("code", { expectedRevision: visual.data.revision, idempotencyKey: randomUUID(), operations: [update(durable, file, loaded.data.source.replace("<h1", "<p>New sibling</p><h1"))] })
    expect(structural.status, JSON.stringify(structural.data)).toBe(200)
    const stale = await request("mutate", { identity: target.identity, expectedRevision: structural.data.revision, edit: { type: "text", value: "Must not apply old offsets" } })
    expect(stale.status).toBe(409)
    const next = await request("compatibility")
    expect(next.data.targets.find((item: { text: string }) => item.text === "New sibling")).toBeDefined()
    expect(durable.history().transactions.map(entry => entry.producer)).toEqual(["visual", "code"])
  })
  it("rejects unresolved structural multi-file proposals without partial files", async () => {
    const { request, durable } = await apiSetup(), before = durable.files()
    const result = await request("code", { expectedRevision: durable.revision(), idempotencyKey: randomUUID(), operations: [{ kind: "delete", file: "src/App.tsx", expectedHash: contentHash(before.get("src/App.tsx")!) }, update(durable, "src/App.css", "/* should roll back */")] })
    expect(result.status).toBe(422); expect(durable.files()).toEqual(before)
  })
  it("validates and commits a rename with its importing code, plus create/delete, as one revision", async () => {
    const { request, durable } = await apiSetup(), before = durable.files()
    const importUpdates = [...before].filter(([file, source]) => /\.[jt]sx?$/.test(file) && source.includes("App.css")).map(([file, source]) => update(durable, file, source.split("App.css").join("Renamed.css")))
    const response = await request("code", { expectedRevision: durable.revision(), idempotencyKey: randomUUID(), operations: [
      { kind: "rename", file: "src/App.css", to: "src/Renamed.css", expectedHash: contentHash(before.get("src/App.css")!) },
      ...importUpdates,
      { kind: "create", file: "src/Unused.ts", expectedHash: null, content: "export const unused = 1" },
    ] })
    expect(response.status, JSON.stringify(response.data)).toBe(200)
    expect(response.data.transaction.fileStates).toHaveLength(3 + importUpdates.length)
    expect(durable.history().revisions).toHaveLength(2)
    const deleted = await request("code", { expectedRevision: durable.revision(), idempotencyKey: randomUUID(), operations: [{ kind: "delete", file: "src/Unused.ts", expectedHash: contentHash("export const unused = 1") }] })
    expect(deleted.status).toBe(200)
    expect(durable.files().has("src/Unused.ts")).toBe(false)
  })
  it("denies cross-project history and source-operation scopes", async () => {
    const { request, registry, session, durable } = await apiSetup()
    const zip = await import("./runtime/projectExport").then(module => module.exportProjectZip(registry.get("phase1-fixture")!)), other = await registry.importZip("Other synthetic project", zip)
    expect((await request("history", {}, session, other.id)).status).toBe(403)
    expect((await request("files", {}, session, other.id)).status).toBe(403)
    const readOnly = registry.createSession("phase1-fixture", ["files", "history", "validate"])!
    expect((await request("code", { expectedRevision: durable.revision(), operations: [update(durable, "src/App.css", "/* denied */")] }, readOnly)).status).toBe(403)
    expect((await request("code", { expectedRevision: durable.revision(), operations: [{ kind: "create", file: "../outside.tsx", content: "bad", expectedHash: null }] })).status).toBe(400)
  })
  it("records a validated checkpoint without changing source or losing redo", async () => {
    const { request, durable } = await apiSetup(), before = durable.files()
    const response = await request("checkpoint", { expectedRevision: durable.revision(), idempotencyKey: randomUUID() })
    expect(response.status, JSON.stringify(response.data)).toBe(200)
    expect(response.data.transaction.editType).toBe("checkpoint"); expect(durable.files()).toEqual(before)
    expect(durable.history().revisions).toHaveLength(2)
  })
  it.each([['src/a.tsx', 'export const A = () => <h1'], ['src/a.css', '.a { color: red'], ['src/a.json', '{"a":']])("diagnoses malformed %s", async (file, content) => {
    expect((await validateSource(new Map([[file, content]]))).passed).toBe(false)
  })
})
