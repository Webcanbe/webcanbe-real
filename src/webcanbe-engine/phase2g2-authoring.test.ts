import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { afterEach, expect, it } from "vitest"
import { validPreviewInput } from "./runtime/previewInputs"
import { LocalDraftStore, validatedDrafts } from "./runtime/draftStore"
import { contentHash, SourceConflict } from "./mutations/durableSource"
import { patchResponsiveConstruct, applyPatches } from "./mutations/sourceMutations"
import { instrumentReactSource, analyzeReactSource } from "./adapters/react/reactSourceAdapter"
import { analyzeProjectStyles } from "./adapters/react/projectStyles"
import type { SourceStore } from "./mutations/sourceMutations"

const dirs: string[] = []
afterEach(() => { for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }) })
it("acknowledged local drafts survive restart, isolate users/projects and reject conflicting backups", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wcb-drafts-")); dirs.push(dir)
  const store = new LocalDraftStore(dir), draft = { file: "src/App.tsx", baseline: "export {}", text: "export const proposal = 1", hash: contentHash("export {}"), baseRevision: "rev_" + randomUUID() }
  const first = store.write("project", "user-a", 0, [draft])
  expect(new LocalDraftStore(dir).read("project", "user-a")).toEqual(first)
  expect(store.read("project", "user-b").drafts).toEqual([])
  expect(store.read("other-project", "user-a").drafts).toEqual([])
  expect(store.write("project", "user-a", 0, [draft])).toEqual(first)
  expect(() => store.write("project", "user-a", 0, [])).toThrow(SourceConflict)
  expect(store.write("project", "user-a", first.version, []).drafts).toEqual([])
})
it("drafts reject secret paths, duplicate references, fabricated baselines and oversized or malformed text", () => {
  const draft = { file: "src/App.tsx", baseline: "export {}", text: "export {}", hash: contentHash("export {}"), baseRevision: "rev_" + randomUUID() }
  for (const bad of [{...draft,file:"../src/App.tsx"},{...draft,file:".env"},{...draft,hash:"fake"},{...draft,text:"\0"},{...draft,text:"x".repeat(2*1024*1024+1)},{...draft,baseRevision:"other"},{...draft,token:"no"}]) expect(() => validatedDrafts([bad])).toThrow()
  expect(() => validatedDrafts([draft,draft])).toThrow()
})
function source(tailwind = false, jsx = '<h1 className="title">Heading</h1>', css = '.title { font-size: 30px; }') {
  const files = new Map([["src/App.tsx", `import './App.css'; export default function App(){return ${jsx}}`],["src/App.css",css]])
  const store: SourceStore = {tailwind,read:file=>files.get(file),write:(file,text,expected)=>{if(files.get(file)!==expected)throw new SourceConflict("changed");files.set(file,text)}}
  const identity = analyzeProjectStyles(files, tailwind).targets.find(t=>t.elementName==="h1")!.identity
  return { files, store, identity }
}
it("constructs a missing responsive CSS declaration in canonical source with an exact inverse", () => {
  const {files,store,identity}=source(),before=new Map(files)
  const result=patchResponsiveConstruct(store,files,identity,"fontSize","18px","new:mobile","source")
  expect(result.success,result.error).toBe(true);expect(files.get("src/App.css")).toContain("@media (max-width: 767px)")
  const analysis=analyzeProjectStyles(files,false,390),heading=analysis.targets.find(t=>t.elementName==="h1")!
  expect(heading.styleOrigins.some(o=>o.media==="(max-width: 767px)"&&o.value==="18px")).toBe(true)
  expect(patchResponsiveConstruct(store,files,identity,"fontSize","20px","new:mobile","source").success).toBe(false)
  applyPatches(store,result.patches!,"reverse");expect(files).toEqual(before)
})
it("constructs only safe known missing Tailwind variants without rebuilding unrelated classes", () => {
  const {files,store,identity}=source(true,'<h1 className="text-3xl font-bold hover:opacity-50">Heading</h1>','@import "tailwindcss";'),before=new Map(files)
  const result=patchResponsiveConstruct(store,files,identity,"fontSize","text-lg","tw:md","source")
  expect(result.success,result.error).toBe(true);expect(files.get("src/App.tsx")).toContain('text-3xl md:text-lg font-bold hover:opacity-50')
  expect(patchResponsiveConstruct(store,files,identity,"fontSize","text-xl","tw:md","source").success).toBe(false)
  applyPatches(store,result.patches!,"reverse");expect(files).toEqual(before)
})
it("responsive construction fails closed for ambiguous source, unsafe media/value and unchosen shared scope", () => {
  for (const [scope,breakpoint,value] of [[undefined,"new:mobile","18px"],["source","new:evil","18px"],["source","new:mobile","red; } body { display:none"],["source","tw:hover","18px"]]) {
    const {files,store,identity}=source(),before=new Map(files)
    expect(patchResponsiveConstruct(store,files,identity,"fontSize",value!,breakpoint!,scope).success).toBe(false);expect(files).toEqual(before)
  }
  const {files,store,identity}=source(false,'<h1 className="title" {...props}>Heading</h1>')
  expect(patchResponsiveConstruct(store,files,identity,"fontSize","18px","new:mobile","source").success).toBe(false)
})

it("DOM instrumentation leaves custom renderer intrinsics untouched while mapping DOM and SVG", () => {
  const code = 'export default function App(){return <><mesh><boxGeometry/><meshBasicMaterial/></mesh><line/><div>DOM</div><svg><line/><path/></svg></>}'
  const output = instrumentReactSource("src/App.tsx",code)
  expect(output).toContain("<mesh>");expect(output).toContain("<boxGeometry/>");expect(output).toContain("<meshBasicMaterial/>")
  expect(output.match(/data-wcb-id=/g)).toHaveLength(4)
  const targets=analyzeReactSource("src/App.tsx",code,()=>undefined)
  expect(targets.find(t=>t.elementName==="mesh")?.capabilities.visualEdit).toBe(false)
  expect(targets.find(t=>t.elementName==="div")?.capabilities.text).toBe(true)
})

it("bounded text/navigation keys permit form input but no browser shortcuts, script, controls or extra authority", () => {
  for(const text of ["hello","한글 字 😀","a\nb"])expect(validPreviewInput({type:"text",text})).toBe(true)
  for(const key of ["Tab","Enter","SelectAll","ArrowLeft"])expect(validPreviewInput({type:"key",key,shift:false})).toBe(true)
  for(const input of [{type:"key",key:"Control+Shift+I",shift:false},{type:"key",key:"F12",shift:false},{type:"key",key:"Tab",shift:false,script:"x"},{type:"text",text:"\0"},{type:"text",text:"x".repeat(4097)},{type:"text",text:"\ud800"},{type:"text",text:"ok",accountId:"a"}])expect(validPreviewInput(input)).toBe(false)
})


it("async hosted expiry cannot admit concurrent compiler work before reserving capacity", async () => {
  const { ControlledPreviewTransport } = await import("./runtime/controlledPreview")
  let expiryCalls=0,materializations=0,releaseExpiry!:()=>void,releaseCompile!:()=>void
  const expiry=new Promise<void>(resolve=>{releaseExpiry=resolve}),compile=new Promise<void>(resolve=>{releaseCompile=resolve})
  const registry={authorize:async()=>true,sessionActive:async()=>true,revision:async()=>"revision",sessionBinding:async()=>undefined,sessionOwner:async()=>{throw new Error("No runner should start")},sessionExpiry:async()=>{expiryCalls++;await expiry;return Date.now()+60000},withPreviewSource:async()=>{materializations++;await compile;throw new Error("Stop before compilation")}}
  const transport=new ControlledPreviewTransport(registry,process.cwd(),{open:async()=>{throw new Error("No runner should start")}})
  const operations=Promise.allSettled(Array.from({length:8},()=>transport.start("project",{previewId:"session",capability:"capability",operation:"preview"},{revision:"revision",route:"/"})))
  try {
    for(let i=0;i<100&&expiryCalls<8;i++)await new Promise<void>(resolve=>setImmediate(resolve))
    expect(expiryCalls).toBe(8);releaseExpiry()
    for(let i=0;i<100&&materializations<1;i++)await new Promise<void>(resolve=>setImmediate(resolve))
    expect(materializations).toBe(1);releaseCompile()
    const results=await operations
    expect(results.filter(result=>result.status==="rejected"&&String(result.reason).includes("capacity"))).toHaveLength(7)
  } finally {releaseExpiry();releaseCompile();await operations;await transport.close()}
})
