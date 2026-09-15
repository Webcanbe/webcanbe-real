import {expect,it,afterEach} from 'vitest'
import {parseYarnClassic,parseBunText,normalizeAlternateLock} from './runtime/alternateLockfiles'
import {inspectRuntime} from './runtime/runtimeCompatibility'
import {buildIsolatedHttpPreview} from './runtime/isolatedPreview'
import {detectProject} from './runtime/projectRegistry'
import {MutationHistory} from './mutations/sourceMutations'
import {randomUUID} from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
const dirs:string[]=[]
afterEach(()=>{for(const d of dirs.splice(0))fs.rmSync(d,{recursive:true,force:true})})
const integrity=(n:number)=>'sha512-'+Buffer.alloc(64,n).toString('base64')
const manifest={dependencies:{react:'^19.0.0','react-dom':'^19.0.0'}}
const profile=()=>({packages:{'node_modules/react':{version:'19.0.0',integrity:integrity(1)},'node_modules/react-dom':{version:'19.0.0',integrity:integrity(2),dependencies:{scheduler:'0.25.0'},peerDependencies:{react:'^19.0.0'}},'node_modules/scheduler':{version:'0.25.0',integrity:integrity(3)}}} as any)
function yarn(p:any){return '# yarn lockfile v1\n'+Object.entries(p.packages).filter(([k])=>k).map(([location,v]:[string,any])=>{const name=location.split('node_modules/').at(-1)!;return JSON.stringify(name+'@'+v.version)+':\n  version '+JSON.stringify(v.version)+'\n  resolved '+JSON.stringify(v.resolved??'https://registry.npmjs.org/'+name+'/-/x.tgz')+'\n  integrity '+v.integrity+'\n'+['dependencies','optionalDependencies'].filter(g=>Object.keys(v[g]??{}).length).map(g=>'  '+g+':\n'+Object.entries(v[g]).map(([n,r])=>'    '+JSON.stringify(n)+' '+JSON.stringify(r)+'\n').join('')).join('')}).join('\n')}
function bun(p:any,m:any){return JSON.stringify({lockfileVersion:1,workspaces:{'':m},packages:Object.fromEntries(Object.entries(p.packages).filter(([k])=>k).map(([location,v]:[string,any])=>{const name=location.split('node_modules/').at(-1)!;return [location.replace(/^node_modules\//,'').replace(/\/node_modules\//g,'/'),[name+'@'+v.version,'',{...Object.fromEntries(['dependencies','optionalDependencies','peerDependencies'].filter(g=>v[g]).map(g=>[g,v[g]])),optionalPeers:Object.keys(v.peerDependenciesMeta??{}).filter(n=>v.peerDependenciesMeta[n]?.optional)},v.integrity]]}))})}
it.each(['yarn','bun'])('proves a complete pinned dependency and required-peer graph for %s data',format=>{
 const p=profile(),lock=format==='yarn'?parseYarnClassic(yarn(p)):parseBunText(bun(p,manifest)),normalized=normalizeAlternateLock(lock,manifest,p)
 expect(normalized.packages['node_modules/scheduler'].integrity).toBe(integrity(3));expect(normalized.packages['node_modules/react'].version).toBe('19.0.0')
})
it.each(['integrity','version','missing-peer','edge'])('refuses %s mismatches without substituting a host package',kind=>{
 const p=profile(),other=profile();if(kind==='integrity')other.packages['node_modules/react'].integrity=integrity(9);if(kind==='version')other.packages['node_modules/react'].version='19.1.0';if(kind==='missing-peer')delete other.packages['node_modules/react'];if(kind==='edge')other.packages['node_modules/react-dom'].dependencies.scheduler='^0.25.0'
 for(const lock of [parseYarnClassic(yarn(other)),parseBunText(bun(other,manifest))])expect(()=>normalizeAlternateLock(lock,manifest,p)).toThrow()
})
it('requires optional-peer declarations to agree and never drops required peers',()=>{
 const p=profile();p.packages['node_modules/react-dom'].peerDependencies.optional='^1.0.0';p.packages['node_modules/react-dom'].peerDependenciesMeta={optional:{optional:true}}
 expect(()=>normalizeAlternateLock(parseBunText(bun(p,manifest)),manifest,p)).not.toThrow()
 const data=JSON.parse(bun(p,manifest));data.packages['react-dom'][2].optionalPeers=[];expect(()=>normalizeAlternateLock(parseBunText(JSON.stringify(data)),manifest,p)).toThrow('optional-peer')
 delete p.packages['node_modules/react-dom'].peerDependenciesMeta;expect(()=>normalizeAlternateLock(parseYarnClassic(yarn(p)),manifest,p)).toThrow()
})
it.each(['# upstream data','__metadata:\n  version: 8\n','# yarn lockfile v1\n"a@file:../private":\n  version "1.0.0"','# yarn lockfile v1\n"a@1":\n  version "1.0.0"\n  version "1.0.0"'])('refuses unknown/Berry/protocol/duplicate Yarn semantics: %s',value=>{expect(()=>parseYarnClassic(value)).toThrow()})
it('rejects duplicate JSONC keys, extra workspaces, non-npm tuples and credential registries',()=>{
 const good=JSON.parse(bun(profile(),manifest))
 expect(()=>parseBunText(bun(profile(),manifest).replace('"lockfileVersion":1','"lockfileVersion":1,"lockfileVersion":1'))).toThrow()
 for(const change of [(d:any)=>d.workspaces.other={},(d:any)=>d.packages.react[0]='react@file:../private',(d:any)=>d.packages.react[1]='https://user:pass@registry.npmjs.org',(d:any)=>d.packages.react[3]='sha512-forged']){const d=structuredClone(good);change(d);expect(()=>parseBunText(JSON.stringify(d))).toThrow()}
})
it.each(['yarn','bun'])('selects the existing dedicated profile and compiles an authored project from a complete %s graph',async format=>{
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'wcb-breadth-lock-')));dirs.push(root)
 const m=JSON.parse(fs.readFileSync('runtime-profiles/react19-vite6/package.json','utf8')),p=JSON.parse(fs.readFileSync('runtime-profiles/react19-vite6/package-lock.json','utf8'))
 const declared={dependencies:m.dependencies};fs.mkdirSync(path.join(root,'src'));fs.writeFileSync(path.join(root,'package.json'),JSON.stringify(declared));fs.writeFileSync(path.join(root,format==='yarn'?'yarn.lock':'bun.lock'),format==='yarn'?yarn(p):bun(p,declared));fs.writeFileSync(path.join(root,'index.html'),'<div id="root"></div><script type="module" src="/src/main.jsx"></script>');fs.writeFileSync(path.join(root,'src/main.jsx'),'import {createRoot} from "react-dom/client";createRoot(document.getElementById("root")).render(<h1>Locked graph</h1>)')
 const project={id:randomUUID(),name:'lock fixture',root,sourceRoot:path.join(root,'src'),imported:true,detection:detectProject(root,process.cwd()),history:new MutationHistory()};const report=inspectRuntime(project,process.cwd())
 expect(report.issues).toEqual([]);expect(report.notes.some(n=>n.includes(format==='yarn'?'yarn-classic-v1':'bun-text-v1'))).toBe(true);expect((await buildIsolatedHttpPreview(project,process.cwd())).files.has('/_wcb/app.js')).toBe(true)
})
