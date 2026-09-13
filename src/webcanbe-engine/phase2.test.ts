import fs from "node:fs"
import os from "node:os"
import { randomBytes } from "node:crypto"
import path from "node:path"
import { crc32, deflateRawSync } from "node:zlib"
import { afterEach, describe, expect, it } from "vitest"
import { createServer, type ViteDevServer } from "vite"
import { analyzeReactSource } from "./adapters/react/reactSourceAdapter"
import { applyPatches, MutationHistory, patchResponsiveStyle, patchSemanticLayout, patchStyle, patchText, type SourceStore } from "./mutations/sourceMutations"
import { buildIsolatedPreview } from "./runtime/isolatedPreview"
import { exportProjectZip } from "./runtime/projectExport"
import { extractSafeZip, ProjectRegistry, safeArchivePath, ZIP_LIMITS } from "./runtime/projectRegistry"
import { webCanBeFixturePlugin } from "./runtime/viteFixturePlugin"

const temporary: string[] = []
const servers: ViteDevServer[] = []
afterEach(async () => { for (const server of servers.splice(0)) await server.close(); for (const dir of temporary.splice(0)) fs.rmSync(dir, { recursive: true, force: true }) })
function temp() { const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wcb-phase2-")); temporary.push(dir); return dir }
// Raw headers permit malicious paths that ordinary ZIP writers refuse to create.
function zip(entries: Array<{ name: string; data?: Buffer | string; mode?: number; compressed?: boolean; declared?: number }>) {
  const locals: Buffer[] = [], central: Buffer[] = []; let offset = 0
  for (const entry of entries) {
    const name = Buffer.from(entry.name), data = Buffer.from(entry.data ?? ""), encoded = entry.compressed ? deflateRawSync(data) : data
    const header = Buffer.alloc(30), directory = Buffer.alloc(46)
    header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(entry.compressed ? 8 : 0, 8); header.writeUInt32LE(crc32(data), 14); header.writeUInt32LE(encoded.length, 18); header.writeUInt32LE(entry.declared ?? data.length, 22); header.writeUInt16LE(name.length, 26)
    directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(3 * 256 + 20, 4); directory.writeUInt16LE(20, 6); directory.writeUInt16LE(entry.compressed ? 8 : 0, 10); directory.writeUInt32LE(crc32(data), 16); directory.writeUInt32LE(encoded.length, 20); directory.writeUInt32LE(entry.declared ?? data.length, 24); directory.writeUInt16LE(name.length, 28); directory.writeUInt32LE(((entry.mode ?? 0o100600) << 16) >>> 0, 38); directory.writeUInt32LE(offset, 42)
    locals.push(header, name, encoded); central.push(directory, name); offset += header.length + name.length + encoded.length
  }
  const end = Buffer.alloc(22), directory = Buffer.concat(central)
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, directory, end])
}
const projectFiles = {
  "package.json": JSON.stringify({ name: "field-notes", dependencies: { react: "^19", "react-dom": "^19" }, devDependencies: { vite: "^6" }, scripts: { preinstall: "touch SHOULD_NOT_RUN", prepare: "touch SHOULD_NOT_RUN" } }),
  "src/main.tsx": `import {createRoot} from 'react-dom/client'; import {App} from './App'; createRoot(document.getElementById('root')!).render(<App/>);`,
  "src/App.tsx": `import './App.css'; import styles from './Note.module.css'; export function App(){return <main className="page"><header><h1>Field notes for a slower week</h1><p>Ideas, places, and things worth keeping.</p></header><section className="cards"><article className={styles.note}><h2>A walk by the water</h2><p>Take the longer way home.</p></article><aside style={{padding: 24, color: "#111827"}}>Sunday reading</aside></section></main>}`,
  "src/App.css": `.page { padding: 24px; max-width: 1100px; }\n.cards { display: grid; gap: 16px; grid-template-columns: 1fr 1fr; }\n@media (max-width: 767px) { .page { padding: 12px; } }`,
  "src/Note.module.css": `.note { padding: 16px; border-radius: 8px; background-color: #fff; }`,
  "vite.config.ts": `throw new Error('UPLOADED CONFIG MUST NOT EXECUTE');`,
}
function archive(files = projectFiles) { return zip(Object.entries(files).map(([name, data]) => ({ name, data }))) }
function registry(now?: () => number) {
  const root = temp(); fs.mkdirSync(path.join(root, "fixtures/compatible-react-vite/src"), { recursive: true })
  for (const [file, code] of Object.entries(projectFiles)) { const target = path.join(root, "fixtures/compatible-react-vite", file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, code) }
  return new ProjectRegistry(root, now)
}
function memory(files: Record<string, string>) { const store: SourceStore = { read: file => files[file], write: (file, code) => { files[file] = code } }; return store }

describe("bounded ZIP intake", () => {
  it.each(["../bad.ts", "/bad.ts", "C:/bad.ts", "C:\\bad.ts", "folder/../bad.ts", "\\\\server\\x.ts", "a//b.ts", "./x.ts", "a/CON.txt", "node_modules/x.js", ".env", "a/.git/config", "a/file.ts "])("rejects %s", async name => {
    expect(safeArchivePath(name)).toBeUndefined()
    await expect(extractSafeZip(zip([{ name, data: "x" }]), path.join(temp(), "out"))).rejects.toThrow()
  })
  it.each([["a.ts", "a.ts"], ["a.ts", "A.ts"], ["a.ts", "a.ts/b.ts"], ["a.ts/b.ts", "a.ts"]])("rejects duplicate/conflicting paths %s / %s", async (one, two) => {
    await expect(extractSafeZip(zip([{ name: one }, { name: two }]), path.join(temp(), "out"))).rejects.toThrow()
  })
  it("rejects symlinks and an existing destination", async () => {
    await expect(extractSafeZip(zip([{ name: "link.ts", data: "/tmp", mode: 0o120777 }]), path.join(temp(), "out"))).rejects.toThrow()
    const destination = temp(); fs.writeFileSync(path.join(destination, "keep.txt"), "keep")
    await expect(extractSafeZip(archive(), destination)).rejects.toThrow()
    expect(fs.readFileSync(path.join(destination, "keep.txt"), "utf8")).toBe("keep")
  })
  it("enforces upload, entry, file and ratio limits before writing", async () => {
    for (const data of [Buffer.alloc(ZIP_LIMITS.archiveBytes + 1), zip(Array.from({ length: ZIP_LIMITS.entries + 1 }, (_, i) => ({ name: `f${i}.ts` }))), zip([{ name: "huge.ts", declared: ZIP_LIMITS.fileBytes + 1 }]), zip([{ name: "bomb.ts", data: "a".repeat(100_000), compressed: true }])]) {
      const destination = path.join(temp(), "out")
      await expect(extractSafeZip(data, destination)).rejects.toThrow(); expect(fs.existsSync(destination)).toBe(false)
    }
  })
  it("bounds cumulative inflation and rejects corrupt text/checksums", async () => {
    const seed = randomBytes(32_768), image = Buffer.concat(Array.from({length: 64}, () => seed))
    await expect(extractSafeZip(zip(Array.from({length: 21}, (_, i) => ({ name: `image${i}.png`, data: image, compressed: true }))), path.join(temp(), "out"))).rejects.toThrow()
    await expect(extractSafeZip(zip([{ name: "binary.ts", data: Buffer.from([0, 1, 2]) }]), path.join(temp(), "out"))).rejects.toThrow()
    const corrupt = zip([{ name: "x.ts", data: "content" }]); corrupt[34] ^= 1
    await expect(extractSafeZip(corrupt, path.join(temp(), "out"))).rejects.toThrow()
  })
  it("imports normal source without running config or lifecycle scripts", async () => {
    const reg = registry(), project = await reg.importZip("field-notes.zip", archive())
    expect(project.detection.supported).toBe(true)
    expect(fs.existsSync(path.join(project.root, "SHOULD_NOT_RUN"))).toBe(false)
    expect(reg.store(project.id)!.read("src/App.tsx")).toContain("Field notes")
    const exported = await exportProjectZip(project), destination = path.join(temp(), "exported")
    await extractSafeZip(exported, destination)
    expect(fs.readFileSync(path.join(destination, "src/App.tsx"), "utf8")).toBe(projectFiles["src/App.tsx"])
  })
})

describe("project capability boundary", () => {
  it("binds opaque authority to project, session, operation and expiry", async () => {
    let now = 1000
    const reg = registry(() => now), a = await reg.importZip("a", archive()), b = await reg.importZip("b", archive())
    const session = reg.createSession(a.id)!, other = reg.createSession(a.id)!, readOnly = reg.createSession(a.id, ["inspect"])!
    expect(reg.authorize(a.id, session.previewId, session.capability, "mutate")).toBe(true)
    for (const [projectId, previewId, capability] of [[b.id, session.previewId, session.capability], ["forged-project", session.previewId, session.capability], [a.id, "forged-preview", session.capability], [a.id, other.previewId, session.capability], [a.id, session.previewId, "wrong-capability"]]) expect(reg.authorize(projectId, previewId, capability, "mutate")).toBe(false)
    const crossProject = reg.store(b.id, { ...session, operation: "mutate" })!
    const before = crossProject.read("src/App.tsx")!
    expect(() => crossProject.write("src/App.tsx", "forged cross-project edit", before)).toThrow("authorized")
    expect(crossProject.read("src/App.tsx")).toBe(before)
    expect(reg.authorize(a.id, readOnly.previewId, readOnly.capability, "mutate")).toBe(false)
    const store = reg.store(a.id, { ...session, operation: "mutate" })!
    now += 600_000
    expect(reg.authorize(a.id, session.previewId, session.capability, "mutate")).toBe(false)
    expect(() => store.write("src/App.tsx", "bad")).toThrow("authorized")
  })
  it("denies unauthorized writes, paths, symlinks, hardlinks and unknown identities", async () => {
    const reg = registry(), project = await reg.importZip("a", archive()), session = reg.createSession(project.id)!
    const store = reg.store(project.id, { ...session, operation: "mutate" })!
    expect(() => reg.store(project.id)!.write("src/App.tsx", "bad")).toThrow()
    for (const file of ["../App.tsx", "/tmp/App.tsx", "src/../../App.tsx", "src\\App.tsx", "src/../App.tsx"]) { expect(store.read(file)).toBeUndefined(); expect(() => store.write(file, "bad")).toThrow() }
    const outside = path.join(temp(), "outside.tsx"); fs.writeFileSync(outside, "outside")
    fs.symlinkSync(outside, path.join(project.sourceRoot, "link.tsx")); expect(() => store.write("src/link.tsx", "bad")).toThrow()
    fs.linkSync(outside, path.join(project.sourceRoot, "hard.tsx")); expect(() => store.write("src/hard.tsx", "bad")).toThrow()
    expect(patchText(store, { file: "src/App.tsx", elementStart: 99999 }, "bad").success).toBe(false)
    expect(fs.readFileSync(outside, "utf8")).toBe("outside")
  })
  it("rejects a source-root symlink into another project", async () => {
    const reg = registry(), first = await reg.importZip("a", archive()), second = await reg.importZip("b", archive())
    fs.renameSync(first.sourceRoot, first.sourceRoot + ".saved")
    fs.symlinkSync(second.sourceRoot, first.sourceRoot)
    expect(reg.store(first.id)).toBeUndefined()
    expect(reg.createSession(first.id)).toBeUndefined()
  })
  it("enforces auth and stale revisions at the HTTP mutation boundary, including history", async () => {
    const reg = registry(), project = await reg.importZip("a", archive())
    const server = await createServer({ configFile: false, cacheDir: path.join(temp(), "vite-cache"), root: process.cwd(), plugins: [webCanBeFixturePlugin(process.cwd(), { registry: reg, editorKey: "test-operator-key" })], server: { host: "127.0.0.1", port: 0 }, logLevel: "silent" }); servers.push(server); await server.listen()
    const port = (server.httpServer!.address() as { port: number }).port, origin = `http://127.0.0.1:${port}`
    const request = async (action: string, body: object = {}, key = "test-operator-key", requestOrigin = origin) => {
      const response = await fetch(`${origin}/__webcanbe/api/projects/${project.id}/${action}`, { method: "POST", headers: { Origin: requestOrigin, "Content-Type": "application/json", "X-WCB-Editor-Key": key }, body: JSON.stringify(body) }); return { status: response.status, data: await response.json() }
    }
    expect((await request("session", {}, "")).status).toBe(403)
    expect((await request("session", {}, "test-operator-key", "http://preview.localhost")).status).toBe(403)
    const session = (await request("session")).data.session
    const target = analyzeReactSource("src/App.tsx", projectFiles["src/App.tsx"], () => undefined).find(item => item.elementName === "h1")!
    const inspected = await request("inspect", { ...session, identity: target.identity })
    const body = { ...session, identity: target.identity, expectedRevision: inspected.data.revision, edit: { type: "text", value: "A new week of field notes" } }
    expect((await request("mutate", { ...body, expectedRevision: "stale" })).status).toBe(409)
    expect((await request("mutate", body, "test-operator-key", "null")).status).toBe(403)
    expect((await request("mutate", { ...body, capability: "bad" })).status).toBe(403)
    const changed = await request("mutate", body); expect(changed.status).toBe(200); expect(changed.data.diff).toContain("A new week")
    const undone = await request("undo", { ...session, expectedRevision: changed.data.revision }); expect(undone.status).toBe(200)
    expect(reg.store(project.id)!.read("src/App.tsx")).toBe(projectFiles["src/App.tsx"])
    expect((await request("redo", { ...session, expectedRevision: undone.data.revision })).status).toBe(200)
    expect((await fetch(`${origin}/.webcanbe/projects/${project.id}/src/App.tsx`)).status).toBe(403)
  })
})

describe("controlled preview compiler", () => {
  it("bundles React/CSS Modules without evaluating uploaded configuration", async () => {
    const reg = registry(), project = await reg.importZip("a", archive())
    const html = await buildIsolatedPreview(project, process.cwd())
    expect(html).toContain("Field notes"); expect(html).toContain("connect-src 'none'"); expect(html).toContain("data-wcb-id")
    expect(html).not.toContain("UPLOADED CONFIG"); expect(html).not.toContain("capability")
    expect(reg.store(project.id)!.read("src/App.tsx")).not.toContain("data-wcb-id")
  })
  it("refuses Node builtins and application-root imports without executing them", async () => {
    for (const request of ["node:fs", "/etc/passwd", "../../../../src/App.tsx", "https://example.com/x.js"]) {
      const reg = registry(), project = await reg.importZip("a", archive({ ...projectFiles, "src/main.tsx": `import x from ${JSON.stringify(request)}; console.log(x);` }))
      await expect(buildIsolatedPreview(project, process.cwd())).rejects.toThrow()
    }
  })
  it("compiles the existing realistic Tailwind fixture with only installed defaults", async () => {
    const reg = new ProjectRegistry(process.cwd())
    const html = await buildIsolatedPreview(reg.get("phase1-fixture")!, process.cwd())
    expect(html).toContain("data-wcb-id"); expect(html).toContain("padding")
  })
})

describe("safe mapping and real transaction history", () => {
  it("keeps native children independent of custom and dynamic boundaries", () => {
    const targets = analyzeReactSource("src/a.tsx", `const cn = () => 'other'; export const A=()=> <><Widget/><h1>Hello</h1><p>{runtime}</p><div className={cn('p-6')}>Safe text</div></>`, () => undefined)
    expect(targets.map(item => item.compatibility)).toEqual(["code-only", "full", "code-only", "partial"])
    expect(targets[3].styleOrigins).toHaveLength(0)
  })
  it("supports proven clsx imports including cn aliases while rejecting dynamic branches", () => {
    const source = `import {clsx as cn} from 'clsx'; export const A=()=> <><div className={cn('p-6', ['gap-4'])}>Static</div><div className={cn(active && 'p-6')}>Dynamic</div></>`
    const files = { "src/a.tsx": source }, store = memory(files), targets = analyzeReactSource("src/a.tsx", source, store.read)
    expect(targets[0].styleOrigins).toHaveLength(2); expect(targets[1].styleOrigins).toHaveLength(0)
    expect(patchStyle(store, targets[0].identity, "padding", "40px").success).toBe(true)
    expect(files["src/a.tsx"]).toContain("cn('p-10', ['gap-4'])")
  })
  it("rejects destructured helper and CSS-module binding shadows", () => {
    const helper = `import {clsx as cn} from 'clsx'; export function A({cn}) { return <div className={cn('p-6')}>Hello</div> }`
    const module = `import styles from './a.module.css'; export function A({styles}) { return <div className={styles.card}>Hello</div> }`
    for (const source of [helper, module]) {
      const target = analyzeReactSource("src/a.tsx", source, () => '.card {padding: 24px}')[0]
      expect(target.styleOrigins).toHaveLength(0)
      expect(target.compatibility).toBe("partial")
      expect(target.reasonCodes).toContain("dynamic-class-expression")
    }
  })
  it("edits static string expressions without changing JSX structure", () => {
    const files = { "src/a.tsx": `export const A=()=> <h1>{'Keep this simple'}</h1>` }, store = memory(files)
    const target = analyzeReactSource("src/a.tsx", files["src/a.tsx"], store.read)[0]
    expect(target.capabilities.text).toBe(true)
    expect(patchText(store, target.identity, 'A "quoted" idea').success).toBe(true)
    expect(analyzeReactSource("src/a.tsx", files["src/a.tsx"], store.read)[0].text).toBe('A "quoted" idea')
  })
  it("updates an existing Tailwind breakpoint without duplicating utilities", () => {
    const files = { "src/a.tsx": `export const A=()=> <div className="p-6 md:p-8 lg:p-10"/>` }, store = memory(files)
    const target = analyzeReactSource("src/a.tsx", files["src/a.tsx"], store.read)[0]
    expect(patchResponsiveStyle(store, target.identity, "padding", "64px", "tablet").success).toBe(true)
    expect(files["src/a.tsx"]).toContain('p-6 md:p-16 lg:p-10')
  })
  it("keeps directional gaps separate and writes valid static layout utilities", () => {
    const files = { "src/a.tsx": `export const A=()=> <div className="gap-x-4 gap-y-8 basis-6 order-1 rounded-lg"/>` }, store = memory(files)
    const target = analyzeReactSource("src/a.tsx", files["src/a.tsx"], store.read)[0]
    expect(patchStyle(store, target.identity, "gap", "24px").success).toBe(false)
    expect(patchSemanticLayout(store, target.identity, "flexBasis", "32px").success).toBe(true)
    expect(patchSemanticLayout(store, target.identity, "order", "-2").success).toBe(true)
    expect(patchStyle(store, target.identity, "borderRadius", "4px").success).toBe(true)
    expect(files["src/a.tsx"]).toContain('gap-x-4 gap-y-8 basis-8 -order-2 rounded-sm')
  })
  it("preserves declaration comments and ignores commented-out imports", () => {
    const files = { "src/a.tsx": `import './a.css'; export const A=()=> <div className="card"/>`, "src/a.css": `.card { padding: /* keep this */ 24px; }` }, store = memory(files)
    const target = analyzeReactSource("src/a.tsx", files["src/a.tsx"], store.read)[0]
    expect(patchStyle(store, target.identity, "padding", "40px").success).toBe(true)
    expect(files["src/a.css"]).toBe(`.card { padding: /* keep this */ 40px; }`)
    expect(analyzeReactSource("src/a.tsx", `// import './a.css'\nexport const A=()=> <div className="card"/>`, store.read)[0].styleOrigins).toHaveLength(0)
  })
  it("rejects ambiguous CSS and inline spread overrides", () => {
    for (const css of [`.card-other {padding: 1px}`, `.card:hover {padding: 1px}`, `.card {padding: 1px} .card {padding: 2px}`]) {
      const store = memory({ "src/a.tsx": `import './a.css'; export const A=()=> <div className="card"/>`, "src/a.css": css })
      expect(patchStyle(store, analyzeReactSource("src/a.tsx", store.read("src/a.tsx")!, store.read)[0].identity, "padding", "40px").success).toBe(false)
    }
    expect(analyzeReactSource("src/a.tsx", `export const A=()=> <div style={{padding: 20, ...other}}/>`, () => undefined)[0].styleOrigins).toHaveLength(0)
  })
  it("undoes and redoes actual CSS responsive patches and refuses changed source", () => {
    const files = { ...projectFiles }, store = memory(files), history = new MutationHistory()
    const target = analyzeReactSource("src/App.tsx", files["src/App.tsx"], store.read)[0]
    const transaction = patchResponsiveStyle(store, target.identity, "padding", "20px", "mobile")
    expect(transaction.success).toBe(true); history.record(transaction)
    expect(files["src/App.css"]).toContain(".page { padding: 20px; }")
    expect(history.undo(store)).toBeDefined(); expect(files["src/App.css"]).toBe(projectFiles["src/App.css"])
    expect(history.redo(store)).toBeDefined(); files["src/App.css"] += "/* external edit */"
    expect(history.undo(store)).toBeUndefined()
    expect(patchResponsiveStyle(store, target.identity, "padding", "12px", "tablet").success).toBe(false)
  })
  it("changes explicit layout declarations without guessing new placement", () => {
    const store = memory({ "src/a.tsx": `export const A=()=> <div style={{gap: 16, gridTemplateColumns: '1fr 1fr'}}/>` })
    const identity = analyzeReactSource("src/a.tsx", store.read("src/a.tsx")!, store.read)[0].identity
    expect(patchSemanticLayout(store, identity, "gap", "24px").success).toBe(true)
    expect(store.read("src/a.tsx")).toContain('gap: "24px"')
    expect(patchSemanticLayout(store, identity, "order", "2").success).toBe(false)
    expect(patchStyle(store, identity, "gap", "0);evil();//").success).toBe(false)
  })
  it("reverses unequal-length patches and fails closed for multi-file transactions", () => {
    const files = { "src/a.ts": "aa bb" }, store = memory(files)
    const patches = [{ file: "src/a.ts", range: { start: 0, end: 2 }, before: "aa", after: "longer" }, { file: "src/a.ts", range: { start: 3, end: 5 }, before: "bb", after: "x" }]
    applyPatches(store, patches, "forward"); expect(files["src/a.ts"]).toBe("longer x")
    applyPatches(store, patches, "reverse"); expect(files["src/a.ts"]).toBe("aa bb")
    expect(() => applyPatches(store, [...patches, { ...patches[0], file: "src/b.ts" }], "forward")).toThrow("atomic")
    expect(files["src/a.ts"]).toBe("aa bb")
  })
})
