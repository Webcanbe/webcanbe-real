import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {randomUUID} from 'node:crypto'
import {afterEach,describe,expect,it} from 'vitest'
import {pureRefreshModule} from './runtime/fastRefreshCompiler'
import {refreshChanges} from './runtime/refreshPolicy'
import type {RunnerObservation} from './runtime/controlledPreview'
import {snapshotPreview} from './runtime/controlledPreview'
import {detectProject} from './runtime/projectRegistry'
import {MutationHistory} from './mutations/sourceMutations'
import {IncrementalPreviewCompiler,classifyPreviewUpdate} from './runtime/incrementalPreview'
import {buildIsolatedHttpPreview} from './runtime/isolatedPreview'
import {LocalLimaRunnerProvider} from './runtime/localLimaRunner'
const clean:Array<()=>unknown>=[];afterEach(async()=>{for(const f of clean.splice(0).reverse())await f()})
it('admits finite declarations but never treats top-level execution as pure refresh',()=>{
 for(const code of ["export const label='before'",'export const format=(n:number)=>String(n)',"export {label} from './value'",'export const palette={primary:"red",sizes:[1,2]}'])expect(pureRefreshModule('src/value.ts',code)).toBe(true)
 for(const code of ["import './effect';export const value=1",'export const value=run()','export let value=1','export const value={get key(){return 1}}','export const value={[key]:1}','export class Model{static value=run()}','window.calls++;export const value=1','await run();export const value=1'])expect(pureRefreshModule('src/value.ts',code)).toBe(false)
})
it('refuses propagation into entries, side-effect modules, graph changes, removed boundaries and cycles',()=>{
 const module=(code:string,imports:Record<string,string>={},boundary=false,propagate=false)=>({code,imports,boundary,propagate}),manifest={version:1,entry:'entry',modules:{entry:module('mount',{app:'app'}),app:module('component',{helper:'helper'},true),helper:module('old',{},false,true)}}
 const snap=(m:unknown)=>snapshotPreview({html:'same',files:new Map([['/_wcb/refresh.json',{contentType:'application/json',body:Buffer.from(JSON.stringify(m))}],['/_wcb/app.js',{contentType:'text/javascript',body:Buffer.from('bundle')} ]])})
 const before=snap(manifest),next=structuredClone(manifest);next.modules.helper.code='new';expect(new Set(refreshChanges(before,snap(next)))).toEqual(new Set(['helper','app']))
 const scenarios=[(m:any)=>m.modules.entry.imports.helper='helper',(m:any)=>{m.modules.app.boundary=false;m.modules.app.propagate=false},(m:any)=>m.modules.helper.imports.app='app',(m:any)=>m.modules.helper.propagate=false]
 for(const change of scenarios){const previous=structuredClone(manifest);change(previous);const after=structuredClone(previous);after.modules.helper.code='new';expect(refreshChanges(snap(previous),snap(after))).toBeUndefined()}
 const previous:any=structuredClone(manifest);previous.modules.barrel=module('barrel',{helper:'helper'},false,true);previous.modules.helper.imports.barrel='barrel';const after=structuredClone(previous);after.modules.helper.code='new';expect(refreshChanges(snap(previous),snap(after))).toBeUndefined()
})
;(process.env.WCB_REFRESH_TEST==='1'?describe:describe.skip)('native cross-file refresh',()=>{
 it.each(['18','19'])('preserves React%s state through a helper and barrel, and labels graph replacement as reload',async react=>{
  const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'wcb-refresh-graph-')));clean.push(()=>fs.rmSync(root,{recursive:true,force:true}));fs.cpSync('fixtures/independent/vite-react'+react+'-ts',root,{recursive:true});fs.mkdirSync(path.join(root,'src/shared'));
  const write=(file:string,text:string)=>fs.writeFileSync(path.join(root,file),text);
  write('src/main.tsx',"import React from 'react';import ReactDOM from 'react-dom/client';import App from './App';ReactDOM.createRoot(document.getElementById('root')!).render(<App/>);");
  write('src/shared/value.ts',"export const label='before'");write('src/shared/index.ts',"export {label} from './value'");
  write('src/App.tsx',"import {useState,useEffect} from 'react';import {label} from './shared';export default function App(){const [count,setCount]=useState(0);useEffect(()=>console.log(label+'='+count));return <button style={{width:300,height:80}} onClick={()=>setCount(count+1)}>{label} {count}</button>}");
  const project={id:'authored-graph',name:'AUTHORED graph regression',root,sourceRoot:path.join(root,'src'),imported:true,detection:detectProject(root,process.cwd()),history:new MutationHistory()},compiler=new IncrementalPreviewCompiler(true);clean.push(()=>compiler.close());const before=snapshotPreview(await buildIsolatedHttpPreview(project,process.cwd(),compiler)),generation=randomUUID(),revision='rev_'+randomUUID(),runner=new LocalLimaRunnerProvider(process.cwd()),execution=await runner.open({generation,origin:'http://wcb-'+generation+'.preview.invalid',revision,expiresAt:Date.now()+60000,route:'/',network:{external:'deny'},snapshot:before},new AbortController().signal);clean.push(()=>execution.close());
  await execution.input({type:'pointer',action:'click',x:80,y:40});expect(((await execution.sample!()).observation as RunnerObservation)?.logs).toContain('log: before=1');
  write('src/shared/value.ts',"export const label='after'");const next=snapshotPreview(await buildIsolatedHttpPreview(project,process.cwd(),compiler)),nextRevision='rev_'+randomUUID();expect(classifyPreviewUpdate(before,next)).toBe('react-fast-refresh');expect(refreshChanges(before,next)).toHaveLength(3);await execution.update!({kind:'react-fast-refresh',expectedRevision:revision,expectedDigest:before.digest,revision:nextRevision,snapshot:next});expect(((await execution.sample!()).observation as RunnerObservation)?.logs).toContain('log: after=1');await execution.input({type:'pointer',action:'click',x:80,y:40});expect(((await execution.sample!()).observation as RunnerObservation)?.logs).toContain('log: after=2');
  write('src/shared/other.ts',"export const label='replacement'");write('src/shared/index.ts',"export {label} from './other'");const replaced=snapshotPreview(await buildIsolatedHttpPreview(project,process.cwd(),compiler));expect(classifyPreviewUpdate(next,replaced)).toBe('incremental-rebuild-reload');await execution.update!({kind:'incremental-rebuild-reload',expectedRevision:nextRevision,expectedDigest:next.digest,revision:'rev_'+randomUUID(),snapshot:replaced});expect(((await execution.sample!()).observation as RunnerObservation)?.logs).toContain('log: replacement=0');
 },30000)
})
