import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createHash } from "node:crypto"
import { afterEach, describe, expect, it } from "vitest"
import { ProjectRegistry, detectProject } from "./runtime/projectRegistry"
import { MutationHistory } from "./mutations/sourceMutations"
import { buildIsolatedHttpPreview } from "./runtime/isolatedPreview"
import { inspectRuntime, PROFILE } from "./runtime/runtimeCompatibility"
import { IncrementalPreviewCompiler, classifyPreviewUpdate } from "./runtime/incrementalPreview"
import { snapshotPreview } from "./runtime/controlledPreview"
import { validateStylesheetConfiguration } from "./runtime/configuration"
import { exportProjectZip } from "./runtime/projectExport"
const directories: string[] = [], compilers: IncrementalPreviewCompiler[] = []
afterEach(async () => { for (const compiler of compilers.splice(0)) await compiler.close(); for (const dir of directories.splice(0)) fs.rmSync(dir, { recursive: true, force: true }) })
function project(fixture: string) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "wcb-2g-runtime-"))); directories.push(root)
  fs.cpSync(path.join(process.cwd(), "fixtures", fixture), root, { recursive: true })
  return { id: "synthetic-profile", name: fixture, root, sourceRoot: path.join(root, "src"), imported: true, detection: detectProject(root, process.cwd()), history: new MutationHistory() }
}
describe("versioned runtime/configuration profile expansion", () => {
  it.each([["vite-react18-ts", "react18-vite5-v1"], ["vite-react19-ts", "react19-vite8-v1"]])("compiles unchanged independent %s and verifies every upstream file hash", async (name, profile) => {
    const p = project("independent/" + name), report = inspectRuntime(p, process.cwd())
    expect(report.issues).toEqual([]); expect(report.profile).toBe(profile)
    const evidence = JSON.parse(fs.readFileSync(path.join(process.cwd(), "docs/corpus", name + ".json"), "utf8"))
    for (const [file, identity] of Object.entries(evidence.files) as Array<[string, { sha256: string }]>) expect(createHash("sha256").update(fs.readFileSync(path.join(p.root, file))).digest("hex")).toBe(identity.sha256)
    const build = await buildIsolatedHttpPreview(p, process.cwd()); expect(build.files.has("/_wcb/app.js")).toBe(true)
    expect(build.files.get("/_wcb/app.js")!.body.toString()).toContain(name.includes("18") ? "Vite + React" : "Get started")
    const host = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "wcb-2g-intake-"))); directories.push(host)
    fs.cpSync(path.join(process.cwd(), "fixtures/compatible-react-vite"), path.join(host, "fixtures/compatible-react-vite"), { recursive: true })
    const imported = await new ProjectRegistry(host).importZip(name, await exportProjectZip(p))
    expect(inspectRuntime(imported, process.cwd()).profile).toBe(profile)
  })
  it("preserves the original exact profile and rejects unknown or mismatching locks", () => {
    const p = project("coast-paths"); expect(inspectRuntime(p, process.cwd()).profile).toBe(PROFILE)
    const lockFile = path.join(p.root, "package-lock.json"), lock = JSON.parse(fs.readFileSync(lockFile, "utf8")); lock.packages["node_modules/react"].integrity = "sha512-forged"; fs.writeFileSync(lockFile, JSON.stringify(lock))
    expect(inspectRuntime(p, process.cwd()).issues.some(issue => issue.code === "lock-conflict")).toBe(true)
  })
  it("statically translates local base, jsconfig aliases and standard environment constants", async () => {
    const p = project("independent/vite-react19-ts")
    fs.writeFileSync(path.join(p.root, "vite.config.ts"), `import {defineConfig} from 'vite'; import react from '@vitejs/plugin-react'; import {fileURLToPath} from 'node:url'; export default defineConfig({plugins:[react()],base:'/demo/',resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}}})`)
    fs.writeFileSync(path.join(p.root, "jsconfig.json"), JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["src/*"] } } }))
    fs.appendFileSync(path.join(p.root, "src/main.tsx"), `\nconsole.log(import.meta.env.MODE, import.meta.env.BASE_URL, import.meta.env.PROD)`)
    const report = inspectRuntime(p, process.cwd()); expect(report.issues).toEqual([]); expect(report.base).toBe("/demo/")
    expect(report.configuration.some(item => item.file === "jsconfig.json")).toBe(true)
    const build = await buildIsolatedHttpPreview(p, process.cwd()); expect(build.files.get("/_wcb/app.js")!.body.toString()).toContain('"/demo/"')
  })
  it.each(["import.meta.env.VITE_PRIVATE", "import.meta.env[name]", "import.meta['env']", "const environment = import.meta.env"])('does not silently ignore an unknown/dynamic environment reference: %s', expression => {
    const p = project("independent/vite-react19-ts"); fs.appendFileSync(path.join(p.root, "src/main.tsx"), `\n${expression}`)
    const report = inspectRuntime(p, process.cwd()); expect(report.supported).toBe(false); expect(report.issues.some(issue => issue.file === "src/main.tsx" && issue.classification === "unsupported")).toBe(true)
  })
  it.each(["postcss.config.ts", "postcss.config.json", ".postcssrc.json", "tailwind.config.mts"])("reports configuration file %s rather than silently ignoring it", file => {
    const p = project("independent/vite-react19-ts"); fs.writeFileSync(path.join(p.root, file), "{}")
    expect(inspectRuntime(p, process.cwd()).issues.some(issue => issue.file === file && issue.classification === "requires-isolated-execution")).toBe(true)
  })
  it("reports executable and unrecognized configuration without executing it", () => {
    const p = project("independent/vite-react19-ts"), marker = path.join(p.root, "executed.txt")
    fs.writeFileSync(path.join(p.root, "vite.config.ts"), `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(marker)},'bad'); export default {server:{proxy:{'/api':'http://private'}}}`)
    const report = inspectRuntime(p, process.cwd()); expect(report.supported).toBe(false); expect(report.configuration[0].classification).toBe("requires-isolated-execution"); expect(fs.existsSync(marker)).toBe(false)
  })
  it("translates literal CSS theme only in an expanded versioned profile", async () => {
    const p = project("independent/vite-react19-ts"), file = path.join(p.root, "package.json"), manifest = JSON.parse(fs.readFileSync(file, "utf8"))
    manifest.dependencies.tailwindcss = "4.3.3"; fs.writeFileSync(file, JSON.stringify(manifest))
    fs.writeFileSync(path.join(p.root, "src/App.css"), '@import "tailwindcss"; @theme { --color-brand: #123456; --breakpoint-wide: 70rem; }')
    fs.appendFileSync(path.join(p.root, "src/App.tsx"), '\nconst candidates = "bg-brand wide:p-4"; console.log(candidates)')
    expect(inspectRuntime(p, process.cwd()).issues).toEqual([])
    const build = await buildIsolatedHttpPreview(p, process.cwd()), css = build.files.get("/_wcb/app.css")!.body.toString()
    expect(css).toContain("123456"); expect(css).toContain("70rem")
    expect(() => validateStylesheetConfiguration('@import "tailwindcss"; @theme { --color-brand: red; }', false)).toThrow("versioned")
  })
  it.each(['@theme { --color-brand: var(--secret) }', '@theme { --font-body: url(https://external.invalid/x) }', '@theme { @import "private"; }', '@config "./evil.js";', '@plugin "evil";', '@source "../../private";'])('rejects unsupported Tailwind configuration %s', css => {
    expect(() => validateStylesheetConfiguration('@import "tailwindcss"; ' + css, true)).toThrow()
  })
  it("uses incremental contexts without stale transformed modules and distinguishes CSS from module reloads", async () => {
    const p = project("coast-paths"), compiler = new IncrementalPreviewCompiler(); compilers.push(compiler)
    const before = snapshotPreview(await buildIsolatedHttpPreview(p, process.cwd(), compiler))
    fs.appendFileSync(path.join(p.root, "src/App.module.css"), "\n.extra { padding: 13px }")
    const css = snapshotPreview(await buildIsolatedHttpPreview(p, process.cwd(), compiler)); expect(classifyPreviewUpdate(before, css)).toBe("css-hot-update")
    const entry = path.join(p.root, p.detection.entry!); fs.appendFileSync(entry, "\nconsole.log('new-accepted-module')")
    const changed = snapshotPreview(await buildIsolatedHttpPreview(p, process.cwd(), compiler)); expect(classifyPreviewUpdate(css, changed)).toBe("incremental-rebuild-reload")
    expect(changed.files.find(file => file.path === "/_wcb/app.js")?.base64).not.toBe(css.files.find(file => file.path === "/_wcb/app.js")?.base64)
    const clean = snapshotPreview(await buildIsolatedHttpPreview(p, process.cwd())); expect(changed).toEqual(clean)
    expect(compiler.builds).toBe(6)
  })
})
