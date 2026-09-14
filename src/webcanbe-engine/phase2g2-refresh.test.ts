import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { randomUUID } from "node:crypto"
import { afterEach, describe, it, expect } from "vitest"
import { detectProject, type ProjectRecord } from "./runtime/projectRegistry"
import { MutationHistory } from "./mutations/sourceMutations"
import { buildIsolatedHttpPreview } from "./runtime/isolatedPreview"
import { IncrementalPreviewCompiler, classifyPreviewUpdate } from "./runtime/incrementalPreview"
import { LocalLimaRunnerProvider } from "./runtime/localLimaRunner"
import { snapshotPreview } from "./runtime/controlledPreview"
import { refreshManifest } from "./runtime/refreshPolicy"
const clean: Array<() => unknown> = []
afterEach(async () => { for (const close of clean.splice(0).reverse()) await close() })
function project(react = "18"): ProjectRecord {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "wcb-refresh-"))); clean.push(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.cpSync("fixtures/independent/vite-react" + react + "-ts", root, { recursive: true })
  fs.writeFileSync(path.join(root,"src/main.tsx"), `import React from 'react';import ReactDOM from 'react-dom/client';import App from './App';import './App.css';ReactDOM.createRoot(document.getElementById('root')!).render(<App/>);`)
  fs.writeFileSync(path.join(root,"src/App.tsx"), `import {useState,useEffect} from 'react'; export default function App(){const [count,setCount]=useState(0);useEffect(()=>console.log('refresh-original='+count));return <button style={{width:300,height:80}} onClick={()=>setCount(count+1)}>Original {count}</button>}`)
  fs.writeFileSync(path.join(root,"src/App.css"), `body{margin:0}button{color:red}`)
  return { id: "authored-refresh", name: "AUTHORED refresh fixture", root, sourceRoot: path.join(root,"src"), imported:true, history: new MutationHistory(), detection: detectProject(root, process.cwd()) }
}
async function setup(react = "18") { const p = project(react), compiler = new IncrementalPreviewCompiler(true); clean.push(() => compiler.close()); const before = snapshotPreview(await buildIsolatedHttpPreview(p, process.cwd(), compiler)); return {p,compiler,before} }
describe("confined React refresh compiler", () => {
  it("classifies an existing component boundary, CSS and a non-component entry accurately", async () => {
    const {p,compiler,before}=await setup(); expect(compiler.refreshFallback).toBeUndefined(); expect(refreshManifest(before)).toBeDefined()
    const app=path.join(p.root,"src/App.tsx"); fs.writeFileSync(app,fs.readFileSync(app,"utf8").replace(/original/g,"changed").replace("Original","Changed"))
    const next=snapshotPreview(await buildIsolatedHttpPreview(p,process.cwd(),compiler)); expect(classifyPreviewUpdate(before,next)).toBe("react-fast-refresh")
    fs.appendFileSync(path.join(p.root,"src/App.css"),"button{color:blue}"); const css=snapshotPreview(await buildIsolatedHttpPreview(p,process.cwd(),compiler)); expect(classifyPreviewUpdate(next,css)).toBe("css-hot-update")
    fs.appendFileSync(path.join(p.root,"src/main.tsx"),"console.log('entry changed')"); const entry=snapshotPreview(await buildIsolatedHttpPreview(p,process.cwd(),compiler)); expect(classifyPreviewUpdate(css,entry)).toBe("incremental-rebuild-reload")
  },20000)
})
;(process.env.WCB_REFRESH_TEST === "1" ? describe : describe.skip)("real native-sandbox React Fast Refresh", () => {
  it.each(["18", "19"])("preserves React%s counter state through a changed component and CSS without document reload", async react => {
    const {p,compiler,before}=await setup(react), generation=randomUUID(), runner=new LocalLimaRunnerProvider(process.cwd()), revision="rev_"+randomUUID(), started=performance.now()
    expect(compiler.refreshFallback).toBeUndefined()
    const execution=await runner.open({generation,origin:`http://wcb-${generation}.preview.invalid`,expiresAt:Date.now()+60000,revision,route:"/",network:{external:"deny"},snapshot:before},new AbortController().signal);clean.push(()=>execution.close())
    const startupMs=Math.round(performance.now()-started)
    await execution.input({type:"pointer",action:"click",x:80,y:40}); expect((await execution.sample!()).observation).toMatchObject({logs:expect.arrayContaining(["log: refresh-original=1"])})
    const app=path.join(p.root,"src/App.tsx"), editStart=performance.now();fs.writeFileSync(app,fs.readFileSync(app,"utf8").replace(/original/g,"changed").replace("Original","Changed"))
    const next=snapshotPreview(await buildIsolatedHttpPreview(p,process.cwd(),compiler)), nextRevision="rev_"+randomUUID();expect(classifyPreviewUpdate(before,next)).toBe("react-fast-refresh")
    await execution.update!({kind:"react-fast-refresh",expectedRevision:revision,expectedDigest:before.digest,revision:nextRevision,snapshot:next});expect((await execution.sample!()).observation).toMatchObject({logs:expect.arrayContaining(["log: refresh-changed=1"])})
    const refreshMs=Math.round(performance.now()-editStart)
    await execution.input({type:"pointer",action:"click",x:80,y:40});expect((await execution.sample!()).observation).toMatchObject({logs:expect.arrayContaining(["log: refresh-changed=2"])})
    const cssStart=performance.now();fs.appendFileSync(path.join(p.root,"src/App.css"),"button{color:blue}");const css=snapshotPreview(await buildIsolatedHttpPreview(p,process.cwd(),compiler)), cssRevision="rev_"+randomUUID()
    await execution.update!({kind:"css-hot-update",expectedRevision:nextRevision,expectedDigest:next.digest,revision:cssRevision,snapshot:css});await execution.input({type:"pointer",action:"click",x:80,y:40});expect((await execution.sample!()).observation).toMatchObject({logs:expect.arrayContaining(["log: refresh-changed=3"])})
    fs.mkdirSync(".webcanbe/runner/qa-phase2g2",{recursive:true});fs.writeFileSync(".webcanbe/runner/qa-phase2g2/refresh-react"+react+"-metrics.json",JSON.stringify({boundary:"AUTHORED React"+react+" fixture, local native-sandbox Lima",startupMs,refreshMs,cssMs:Math.round(performance.now()-cssStart),stateSequence:[1,1,2,3]}))
  },30000)
})
