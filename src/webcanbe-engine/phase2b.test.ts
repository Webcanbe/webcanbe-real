import { afterEach, describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { ZipFile } from "yazl"
import { ProjectRegistry, extractSafeZip } from "./runtime/projectRegistry"
import { inspectRuntime } from "./runtime/runtimeCompatibility"
import { buildIsolatedPreview } from "./runtime/isolatedPreview"
import { exportProjectZip } from "./runtime/projectExport"
import { analyzeReactSource } from "./adapters/react/reactSourceAdapter"
import { patchText, formatTransactionDiff } from "./mutations/sourceMutations"

const temporary: string[] = []
afterEach(() => { for (const dir of temporary.splice(0)) fs.rmSync(dir, { recursive: true, force: true }) })
function temp() { const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wcb-2b-")); temporary.push(dir); return dir }
function filesFor(name = "trail-atlas") {
  const root = path.join(process.cwd(), "fixtures", name)
  return Object.fromEntries(fs.readdirSync(root, { recursive: true }).filter((file): file is string => typeof file === "string" && fs.statSync(path.join(root, file)).isFile()).map(file => [file, fs.readFileSync(path.join(root, file))]))
}
async function zip(files: Record<string, Buffer>) {
  const archive = new ZipFile()
  for (const [file, content] of Object.entries(files)) archive.addBuffer(content, file)
  const chunks: Buffer[] = [], done = new Promise<Buffer>((resolve, reject) => { archive.outputStream.on("data", chunk => chunks.push(chunk)); archive.outputStream.on("end", () => resolve(Buffer.concat(chunks))); archive.outputStream.on("error", reject) })
  archive.end(); return done
}
async function imported(files = filesFor()) {
  const root = temp()
  fs.cpSync(path.join(process.cwd(), "fixtures/compatible-react-vite"), path.join(root, "fixtures/compatible-react-vite"), { recursive: true })
  const registry = new ProjectRegistry(root), project = await registry.importZip("fixture.zip", await zip(files))
  return { registry, project }
}
function manifestChange(files: Record<string, Buffer>, change: (manifest: any) => void) {
  const manifest = JSON.parse(files["package.json"].toString()); change(manifest); files["package.json"] = Buffer.from(JSON.stringify(manifest)); return files
}

describe("explicit runtime profiles", () => {
  it.each(["trail-atlas", "studio-ledger"])("imports, resolves, maps, edits and exports %s without changing dependency declarations", async name => {
    const original = filesFor(name), { registry, project } = await imported(original)
    const runtime = inspectRuntime(project, process.cwd())
    expect(runtime.issues).toEqual([]); expect(runtime.supported).toBe(true)
    expect(runtime.dependencies.find(item => item.name === "react")?.selected).toBe("19.3.0")
    const html = await buildIsolatedPreview(project, process.cwd())
    expect(html).toContain("data-wcb-id"); expect(html).toContain("data:image/svg+xml")
    const file = name === "trail-atlas" ? "src/pages/Home.jsx" : "src/pages/Dashboard.tsx"
    const session = registry.createSession(project.id)!, store = registry.store(project.id, { ...session, operation: "mutate" })!
    const target = analyzeReactSource(file, store.read(file)!, store.read, { tailwind: project.detection.tailwind }).find(item => item.elementName === "h1")!
    const transaction = patchText(store, target.identity, "A source-backed project update.")
    expect(transaction.success).toBe(true); expect(formatTransactionDiff(transaction)).toContain("+A source-backed")
    project.history.record(transaction)
    expect(project.history.undo(store)).toBeDefined(); expect(project.history.redo(store)).toBeDefined()
    const destination = path.join(temp(), "export")
    await extractSafeZip(await exportProjectZip(project), destination)
    expect(fs.readFileSync(path.join(destination, "package.json"))).toEqual(original["package.json"])
    expect(fs.readFileSync(path.join(destination, "package-lock.json"))).toEqual(original["package-lock.json"])
    expect(fs.readFileSync(path.join(destination, file), "utf8")).toContain("A source-backed project update.")
    const exportedSource = fs.readdirSync(destination, { recursive: true }).filter((item): item is string => typeof item === "string" && /\.[jt]sx?$/.test(item)).map(item => fs.readFileSync(path.join(destination, item), "utf8")).join("\n")
    expect(exportedSource).not.toMatch(/data-wcb-id|__webcanbe|capability|WebCanBe-recovery/)
  })
  it.each(["unsupported", "missing", "conflicting", "lock-mismatch", "lock-integrity", "unsupported-lock"])("rejects %s dependency data explicitly", async kind => {
    const files = filesFor()
    if (kind === "unsupported") manifestChange(files, data => { data.dependencies.react = "18.3.1" })
    if (kind === "missing") manifestChange(files, data => { data.dependencies.clsx = "2.1.1" }) // missing from uploaded lock
    if (kind === "conflicting") manifestChange(files, data => { data.devDependencies.react = "18.3.1" })
    if (kind === "lock-mismatch") { const lock = JSON.parse(files["package-lock.json"].toString()); lock.packages["node_modules/react"].version = "19.2.0"; files["package-lock.json"] = Buffer.from(JSON.stringify(lock)) }
    if (kind === "lock-integrity") { const lock = JSON.parse(files["package-lock.json"].toString()); lock.packages["node_modules/react"].integrity = "sha512-forged"; files["package-lock.json"] = Buffer.from(JSON.stringify(lock)) }
    if (kind === "unsupported-lock") files["yarn.lock"] = Buffer.from("# lock data")
    const { project } = await imported(files)
    const runtime = inspectRuntime(project, process.cwd())
    expect(runtime.supported).toBe(false); expect(runtime.issues.length).toBeGreaterThan(0)
    await expect(buildIsolatedPreview(project, process.cwd())).rejects.toThrow()
  })
  it.each(["../outside", "/tmp", "./src/../../outside"])("rejects alias escape %s", async escape => {
    const files = filesFor("studio-ledger")
    files["vite.config.ts"] = Buffer.from(files["vite.config.ts"].toString().replace("'./src'", JSON.stringify(escape)))
    const { project } = await imported(files)
    expect(inspectRuntime(project, process.cwd()).issues.some(issue => issue.code === "executable-config")).toBe(true)
  })
  it("rejects missing locked transitive runtime packages and forged plugin data", async () => {
    const files = filesFor()
    const lock = JSON.parse(files["package-lock.json"].toString())
    delete lock.packages["node_modules/scheduler"]
    files["package-lock.json"] = Buffer.from(JSON.stringify(lock))
    const { project } = await imported(files)
    expect(inspectRuntime(project, process.cwd()).issues.some(issue => issue.code === "lock-conflict")).toBe(true)
    fs.writeFileSync(path.join(project.root, "vite.config.js"), `export default {plugins:[{plugin:'@vitejs/plugin-react'}]}`)
    expect(inspectRuntime(project, process.cwd()).issues.some(issue => issue.code === "executable-config")).toBe(true)
  })
  it("reports a missing dedicated runtime without falling back to editor packages", async () => {
    const { project } = await imported()
    expect(inspectRuntime(project, temp()).supported).toBe(false)
  })
  it("refuses custom Tailwind directives instead of ignoring their semantics", async () => {
    const files = filesFor("studio-ledger")
    files["src/styles.css"] = Buffer.from('@import "tailwindcss"; @theme { --color-brand: red; }')
    const { project } = await imported(files)
    await expect(buildIsolatedPreview(project, process.cwd())).rejects.toThrow()
  })
  it("never executes uploaded hooks or arbitrary config; reports the required runner", async () => {
    const files = filesFor()
    manifestChange(files, data => { data.scripts.preinstall = "touch DO_NOT_RUN"; data.scripts.build = "touch DO_NOT_RUN" })
    files["vite.config.js"] = Buffer.from("import fs from 'node:fs'; fs.writeFileSync('DO_NOT_RUN','bad'); throw new Error('executed');")
    const { project } = await imported(files), runtime = inspectRuntime(project, process.cwd())
    expect(runtime.issues.some(issue => issue.code === "executable-config" && issue.requiredCapability.includes("isolated"))).toBe(true)
    await expect(buildIsolatedPreview(project, process.cwd())).rejects.toThrow()
    expect(fs.existsSync(path.join(project.root, "DO_NOT_RUN"))).toBe(false)
  })
  it.each(["unknown-package", "node:fs", "/etc/passwd", "../../../../package.json"])("rejects unknown or escaped imports: %s", async request => {
    const files = filesFor()
    files["src/client.jsx"] = Buffer.from(`import value from ${JSON.stringify(request)}; console.log(value)`)
    const { project } = await imported(files)
    await expect(buildIsolatedPreview(project, process.cwd())).rejects.toThrow()
  })
  it("does not silently substitute BrowserRouter or custom Tailwind configuration", async () => {
    const files = filesFor(); files["src/client.jsx"] = Buffer.from(files["src/client.jsx"].toString().replace(/HashRouter/g, "BrowserRouter"))
    const { project } = await imported(files)
    await expect(buildIsolatedPreview(project, process.cwd())).rejects.toThrow("HTTP preview runner")
    fs.writeFileSync(path.join(project.root, "tailwind.config.js"), "throw new Error('not executed')")
    expect(inspectRuntime(project, process.cwd()).issues.some(issue => issue.code === "css-config")).toBe(true)
  })
})
