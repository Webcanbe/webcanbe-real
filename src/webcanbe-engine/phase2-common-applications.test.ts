import { samePointerFrame } from "./visual-editor/rasterFrame"
import { literalColor, validateStylesheetConfiguration } from "./runtime/configuration"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import yazl from "yazl"
import { afterEach, expect, it } from "vitest"
import { extractSafeZip, detectProject, safeArchivePath } from "./runtime/projectRegistry"
import { inspectRuntime } from "./runtime/runtimeCompatibility"
import { buildIsolatedHttpPreview } from "./runtime/isolatedPreview"
import { MutationHistory } from "./mutations/sourceMutations"
const directories: string[] = []
function temp() { const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wcb-common-test-")); directories.push(dir); return dir }
afterEach(() => { for (const dir of directories.splice(0)) fs.rmSync(dir, { recursive: true, force: true }) })
async function archive(files: Record<string, string | Buffer>) { const zip = new yazl.ZipFile(); for (const [name, value] of Object.entries(files)) zip.addBuffer(Buffer.from(value), name); zip.end(); const chunks: Buffer[] = []; for await (const c of zip.outputStream) chunks.push(Buffer.from(c)); return Buffer.concat(chunks) }
function project() { const root = fs.realpathSync(temp()); fs.cpSync("fixtures/independent/vite-react18-ts", root, { recursive: true }); return { id: randomUUID(), name: "synthetic compatibility", root, sourceRoot: path.join(root, "src"), imported: true, detection: detectProject(root, process.cwd()), history: new MutationHistory() } }
it("preserves admitted metadata bytes and refuses unknown package-manager controls", async () => {
  const files = { ".editorconfig": "[*]\nindent_style = space\nindent_size = 2", ".npmrc": "strict-peer-dependencies=false\nshell-emulator=true", ".env.example-e2e": "VITE_API_URL=http://localhost:8080/api\nVITE_ENABLE_MOCKING=false" }
  const destination = path.join(temp(), "out"); await extractSafeZip(await archive(files), destination)
  for (const [name, text] of Object.entries(files)) expect(fs.readFileSync(path.join(destination, name), "utf8")).toBe(text)
  for (const text of ["//registry.npmjs.org/:_authToken=synthetic-secret", "registry=https://untrusted.invalid", "script-shell=/bin/sh", "shell-emulator=true\nshell-emulator=false", "strict-peer-dependencies=maybe"]) await expect(extractSafeZip(await archive({ ".npmrc": text }), path.join(temp(), "out"))).rejects.toThrow()
})
it("validates example environment contents, names, encoding and finite metadata limits", async () => {
  for (const text of ["VITE_API_KEY=synthetic-secret", "VITE_URL=https://user:pass@example.invalid", "VITE_URL=https://example.invalid/?token=private", "VITE_VALUE=opaque-secret", "VITE_VALUE=$(touch sentinel)", "DATABASE_PASSWORD=private", "VITE_PORT=42\nVITE_PORT=43", "#".repeat(16385)]) await expect(extractSafeZip(await archive({ ".env.example-test": text }), path.join(temp(), "out"))).rejects.toThrow()
  for (const name of [".env.example.local", ".env.example-", ".env.production", ".env.example-../../secret"]) expect(safeArchivePath(name)).toBeUndefined()
  for (const value of [Buffer.from([0xff]), Buffer.from([0])]) await expect(extractSafeZip(await archive({ ".editorconfig": value }), path.join(temp(), "out"))).rejects.toThrow()
})
it("does not admit binary locks, arbitrary dotfiles or oversized Yarn releases", async () => {
  for (const [name, bytes] of [["bun.lockb", Buffer.from([0,1,2])], [".credentials", Buffer.from("private")], [".yarn/releases/yarn.cjs", Buffer.alloc(2*1024*1024+1)] ] as const) await expect(extractSafeZip(await archive({ [name]: bytes }), path.join(temp(), "out"))).rejects.toThrow()
})
it.each(["path.resolve('./src')", "path.resolve(__dirname, './src')", "resolve('./src')"])("statically interprets %s without changing configuration", expression => {
  const p = project(), file = path.join(p.root, "vite.config.ts"), source = `import path, {resolve} from 'node:path'; import {defineConfig} from 'vite'; import react from '@vitejs/plugin-react'; export default defineConfig(() => ({plugins:[react()],resolve:{alias:[{find:'@',replacement:${expression}}]},server:{open:true,port:3000}}))`
  fs.writeFileSync(file, source)
  const report = inspectRuntime(p, process.cwd()); expect(report.issues).toEqual([]); expect(report.aliases).toEqual({ "@": "src" }); expect(report.configuration.some(c => c.classification === "preserved-not-applied")).toBe(true); expect(fs.readFileSync(file,"utf8")).toBe(source)
})
it("refuses executable, escaping, duplicate and server-proxy configuration", () => {
  const p = project(), file = path.join(p.root, "vite.config.ts")
  for (const value of ["path.resolve('../outside')", "path.resolve(process.cwd(), 'src')", "path.resolve('/etc')", "path.resolve('./src')", "path.resolve('./src')"]) {
    const index = ["path.resolve('../outside')", "path.resolve(process.cwd(), 'src')", "path.resolve('/etc')"].indexOf(value)
    const base = `import path from 'path';export default {resolve:{alias:[{find:'@',replacement:${value}}${index < 0 ? ",{find:'@',replacement:path.resolve('./src')}" : ""}]}}`
    fs.writeFileSync(file,base); expect(inspectRuntime(p,process.cwd()).supported).toBe(false)
  }
  fs.writeFileSync(file,"export default {server:{proxy:{'/api':'https://external.invalid'}}}");expect(inspectRuntime(p,process.cwd()).supported).toBe(false)
})
it("selects a complete versioned profile and compiles declared Lucide in confinement", async () => {
  const p = project(), file = path.join(p.root,"package.json"), manifest = JSON.parse(fs.readFileSync(file,"utf8"));manifest.devDependencies.vite = "^6.0.5";manifest.dependencies["lucide-react"]="^0.469.0";fs.writeFileSync(file,JSON.stringify(manifest))
  fs.writeFileSync(path.join(p.root,"src/App.tsx"),"import {Plus} from 'lucide-react';export default function App(){return <main><Plus/><h1>Ordinary application</h1></main>}")
  const report=inspectRuntime(p,process.cwd());expect(report.profile).toBe("react18-vite6-common-v1");expect(report.issues).toEqual([]);expect((await buildIsolatedHttpPreview(p,process.cwd())).files.has("/_wcb/app.js")).toBe(true)
  fs.writeFileSync(path.join(p.root,"src/App.tsx"),"import x from 'not-in-profile';export default function App(){return <main>{x}</main>}");await expect(buildIsolatedHttpPreview(p,process.cwd())).rejects.toThrow("Unknown or undeclared")
})
it("keeps unsupported lock diagnostics truthful", () => {
  const p=project();fs.writeFileSync(path.join(p.root,"yarn.lock"),"# upstream data");const report=inspectRuntime(p,process.cwd());expect(report.supported).toBe(false);expect(report.notes.some(n=>n.startsWith("No lockfile"))).toBe(false)
  expect(report.issues.some(i=>i.code==="unsupported-lockfile")).toBe(true)
})

it("accepts only finite numeric color functions in literal themes", () => {
  for (const value of ["hsl(24 10% 16%)", "hsla(0 0% 0% / 0.5)\n", "rgb(1, 2, 3)", "oklch(50% 0.2 30)"]) { expect(literalColor(value)).toBe(true);expect(()=>validateStylesheetConfiguration('@import "tailwindcss";@theme{--color-brand:'+value+'}',true)).not.toThrow() }
  for (const value of ["hsl(var(--secret) 0% 0%)", "url(https://private.invalid)", "calc(1+2)", "rgb(1 2 3);background:red", "hsl(1e400 0% 0%)"])expect(literalColor(value)).toBe(false)
})

it("admits only lock-verified client transitives and rejects tampered transitive locks", async () => {
  const p = project(), profile = JSON.parse(fs.readFileSync('runtime-profiles/react19-vite7-common-v1/package.json','utf8'))
  const names = ['react','react-dom','vite','@vitejs/plugin-react','@tippyjs/react','tailwindcss']
  fs.writeFileSync(path.join(p.root,'package.json'),JSON.stringify({type:'module',dependencies:Object.fromEntries(names.map(name=>[name,profile.dependencies[name]]))}))
  const lock=JSON.parse(fs.readFileSync('runtime-profiles/react19-vite7-common-v1/package-lock.json','utf8'));fs.writeFileSync(path.join(p.root,'package-lock.json'),JSON.stringify(lock))
  fs.writeFileSync(path.join(p.root,'src/App.tsx'),"import 'tippy.js/dist/tippy.css'; export default function App(){return <main>Verified client closure</main>}")
  const report=inspectRuntime(p,process.cwd());expect(report.profile).toBe('react19-vite7-common-v1');expect(report.issues).toEqual([]);expect(report.clientDependencies).toContain('tippy.js');expect(report.clientDependencies).not.toContain('eslint');expect((await buildIsolatedHttpPreview(p,process.cwd())).files.has('/_wcb/app.css')).toBe(true)
  lock.packages['node_modules/tippy.js'].integrity='sha512-untrusted';fs.writeFileSync(path.join(p.root,'package-lock.json'),JSON.stringify(lock));expect(inspectRuntime(p,process.cwd()).supported).toBe(false)
})


it("preserves CSS resource URLs without fetching or admitting remote JavaScript", async () => {
  const p=project();fs.writeFileSync(path.join(p.root,'src/App.tsx'),"import './resource.css';export default function App(){return <main>Resources</main>}")
  fs.writeFileSync(path.join(p.root,'src/resource.css'),"@import url('https://example.invalid/font.css'); main{background-image:url(data:image/svg+xml,%3Csvg%3E%3C/svg%3E)}")
  const artifact=await buildIsolatedHttpPreview(p,process.cwd()),css=artifact.files.get('/_wcb/app.css')!.body.toString();expect(css).toContain('https://example.invalid/font.css');expect(css).toContain('data:image/svg+xml')
  fs.writeFileSync(path.join(p.root,'src/App.tsx'),"import 'https://example.invalid/project.js';export default function App(){return <main/>}");await expect(buildIsolatedHttpPreview(p,process.cwd())).rejects.toThrow('Unknown or undeclared')
})


it("rejects credentials hidden in metadata comments and nonliteral formatter values", async () => {
  for(const [name,text] of [['.npmrc','# password=synthetic-private'],['.env.example-e2e','# api_key=synthetic-private'],['.env.example','VITE_URL=https://real-service.com/opaque-credential'],['.prettierrc','{"singleQuote":"opaque-credential"}'],['.prettierrc','{"tabWidth":1e200}']]) await expect(extractSafeZip(await archive({[name]:text}),path.join(temp(),'out'))).rejects.toThrow()
})


it("rebinds queued pointers only across pixel-identical captures of the same authority and geometry", () => {
  const frame={png:'exact-pixels',generation:'generation-a',revision:'revision-a',observation:{route:'/',viewport:{width:1280,height:900}}}
  expect(samePointerFrame(frame,structuredClone(frame))).toBe(true)
  for(const changed of [{...frame,png:'changed-pixels'},{...frame,generation:'generation-b'},{...frame,revision:'revision-b'},{...frame,observation:{...frame.observation,route:'/changed'}},{...frame,observation:{...frame.observation,viewport:{width:390,height:900}}},{...frame,observation:{...frame.observation,viewport:{width:1280,height:844}}}])expect(samePointerFrame(frame,changed)).toBe(false)
  expect(samePointerFrame(undefined,frame)).toBe(false);expect(samePointerFrame({...frame,png:''},frame)).toBe(false)
})
