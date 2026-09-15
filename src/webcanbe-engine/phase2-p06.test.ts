import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { afterEach, expect, it } from 'vitest'
import { ProjectRegistry, detectProject, extractSafeZip, type ProjectRecord } from './runtime/projectRegistry'
import { MutationHistory } from './mutations/sourceMutations'
import { DurableSource, contentHash, transactionEntry } from './mutations/durableSource'
import { exportProjectZip } from './runtime/projectExport'
import { buildIndependentExport } from './runtime/independentExport'
import { buildIsolatedHttpPreview } from './runtime/isolatedPreview'
import { inspectRuntime } from './runtime/runtimeCompatibility'
import { analyzeProjectStyles } from './adapters/react/projectStyles'
import { executeSourceOperation } from './runtime/sourceApi'
import { verifyHistory } from './runtime/postgresStores'
import { validateStagedProject } from './mutations/sourceValidation'
import { withHostedSource } from './runtime/postgresSourceCheckout'

const dirs:string[]=[]
const temp=()=>{const d=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'wcb-p06-')));dirs.push(d);return d}
afterEach(()=>{for(const d of dirs.splice(0))fs.rmSync(d,{recursive:true,force:true})})
function fixture(runtimeRoot='.',directory='src') {
  const root=temp(),write=(file:string,source:string)=>{fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),source)}
  fs.cpSync('fixtures/compatible-react-vite',root,{recursive:true})
  if(directory!=='src'){fs.mkdirSync(path.dirname(path.join(root,directory)),{recursive:true});fs.renameSync(path.join(root,'src'),path.join(root,directory))}
  write('vite.config.ts',`export default {root:${JSON.stringify(runtimeRoot)}}`)
  write(path.posix.join(runtimeRoot,'index.html'),`<div id="root"></div><script type="module" src="/${path.posix.relative(runtimeRoot,directory)}/main.tsx"></script>`)
  write(directory+'/main.tsx',`import {createRoot} from 'react-dom/client';import App from './App';import './App.css';createRoot(document.getElementById('root')!).render(<App/>);`)
  write(directory+'/App.tsx',`export default function App(){return <h1 style={{color:'red'}}>Nested source</h1>}`)
  write(directory+'/App.css',`h1 { margin: 0; }`)
  const project=():ProjectRecord=>{const detection=detectProject(root,process.cwd());return{id:randomUUID(),name:'AUTHORED P06 regression',root,sourceRoot:path.join(root,detection.sourceDirectory??'src'),imported:true,detection,history:new MutationHistory()}}
  return{root,write,project,directory}
}
function commit(d:DurableSource,file:string,content:string){const revision=d.revision(),key=randomUUID();return d.commit({expectedRevision:revision,operations:[{kind:'update',file,content,expectedHash:contentHash(d.files().get(file)!)}],entry:transactionEntry(d.history().projectId,revision,'code',key,contentHash(key),'P06 source edit',{level:'compile',passed:true,diagnostics:[]}),authorize:()=>{}})}
it.each([['.','src'],['client','client/src'],['apps/web','apps/web/src'],['frontend','frontend/source']])('P06 derives canonical source and mapping for %s / %s',async(runtimeRoot,directory)=>{
  const f=fixture(runtimeRoot,directory),p=f.project();expect(p.detection.sourceDirectory).toBe(directory);expect(inspectRuntime(p,process.cwd()).issues).toEqual([])
  const storage=temp(),d=new DurableSource(p,storage),file=directory+'/App.tsx',before=d.files().get(file)!,revision=d.revision()
  expect(analyzeProjectStyles(d.files(),false).targets.some(t=>t.identity.file===file&&t.capabilities.text)).toBe(true)
  const preview=(await buildIsolatedHttpPreview(p,process.cwd())).files.get('/_wcb/app.js')!.body.toString();expect([...preview.matchAll(/data-wcb-id[\"']?:[\"']([^\"']+)/g)].some(m=>JSON.parse(Buffer.from(m[1],'base64').toString()).file===file)).toBe(true)
  const next=before.replace('Nested source','Accepted edit');expect((await validateStagedProject(p,process.cwd(),new Map([...d.files(),[file,next]]),'compile')).passed).toBe(true)
  commit(d,file,next);expect(d.revision()).not.toBe(revision)
  const reopened=new DurableSource(p,storage);expect(reopened.files().get(file)).toBe(next);expect(reopened.restoreOperations(revision)[0].file).toBe(file)
  const zip=await exportProjectZip(p),unpacked=path.join(temp(),'export');await extractSafeZip(zip,unpacked);expect(fs.readFileSync(path.join(unpacked,file),'utf8')).toBe(next);expect(fs.readFileSync(path.join(unpacked,'vite.config.ts'),'utf8')).toBe(fs.readFileSync(path.join(p.root,'vite.config.ts'),'utf8'))
  const built=await buildIndependentExport(zip,process.cwd());expect(built.sourceUnchanged).toBe(true);expect(built.files.get('/assets/app.js')!.body.toString()).toContain('Accepted edit');expect([...built.files.values()].map(f=>f.body.toString()).join('')).not.toMatch(/data-wcb-id|__webcanbe|previewBridge/)
},20000)
it('P06 imports and reopens a nested registry with exact authorized file paths',async()=>{
 const f=fixture('client','client/src'),app=temp();fs.mkdirSync(path.join(app,'fixtures'));fs.cpSync('fixtures/compatible-react-vite',path.join(app,'fixtures/compatible-react-vite'),{recursive:true})
 const registry=new ProjectRegistry(app),p=await registry.importZip('nested.zip',await exportProjectZip(f.project())),session=registry.createSession(p.id)!
 expect(registry.sourceFiles(p.id)).toContain('client/src/App.tsx');const store=registry.store(p.id,{...session,operation:'mutate'})!;expect(store.read('src/App.tsx')).toBeUndefined();expect(store.read('client/src/App.tsx')).toContain('Nested source')
 expect(new ProjectRegistry(app).get(p.id)!.sourceRoot.endsWith('/client/src')).toBe(true)
})
it.each(['../private','apps/../../private','/tmp','missing'])('P06 refuses unproven nested roots %s',root=>{const f=fixture('client','client/src');f.write('vite.config.ts',`export default {root:${JSON.stringify(root)}}`);expect(f.project().detection.supported).toBe(false)})
it.each([`export default {root:()=> 'client'}`,`export default {root:process.env.ROOT}`,`export default {root:'client',plugins:[(()=>{throw Error('executed')})()]}`])('P06 refuses dynamic nested root/config %s',code=>{const f=fixture('client','client/src');f.write('vite.config.ts',code);expect(f.project().detection.supported).toBe(false)})
it('P06 refuses missing or ambiguous nested HTML/config roots',()=>{const f=fixture('client','client/src');fs.unlinkSync(path.join(f.root,'client/index.html'));expect(f.project().detection.supported).toBe(false);f.write('client/index.html','<div id="root"></div><script type="module" src="/src/main.tsx"></script><script type="module" src="/src/App.tsx"></script>');expect(f.project().detection.supported).toBe(false);f.write('vite.config.js',`export default {root:'client'}`);expect(f.project().detection.supported).toBe(false)})
it.each(['client','client/src'])('P06 refuses symlink source root segments %s',segment=>{const f=fixture('client','client/src');fs.renameSync(path.join(f.root,segment),path.join(f.root,'moved'));fs.symlinkSync(path.join(f.root,'moved'),path.join(f.root,segment));expect(f.project().detection.supported).toBe(false)})
it('P06 refuses changed root identity, traversal writes and a hidden second source tree',async()=>{
 const f=fixture('client','client/src'),p=f.project(),d=new DurableSource(p,temp());expect(()=>d.prepare([{kind:'create',expectedHash:null,file:'client/src/../../escape.ts',content:'export {}'}])).toThrow();expect(()=>d.prepare([{kind:'create',expectedHash:null,file:'src/other.ts',content:'export {}'}])).toThrow()
 f.write('other/src/value.ts',`export const value='hidden'`);f.write('client/src/App.tsx',`import {value} from '../../other/src/value';export default ()=> <h1>{value}</h1>`);await expect(buildIsolatedHttpPreview(p,process.cwd())).rejects.toThrow('canonical source tree')
 fs.renameSync(p.sourceRoot,p.sourceRoot+'-saved');fs.symlinkSync(p.sourceRoot+'-saved',p.sourceRoot);expect(()=>d.files()).toThrow('identity')
})
it('P06 verifies hosted history hashes over actual nested source paths and rejects forged scope',async()=>{
 const f=fixture('apps/web','apps/web/src'),p=f.project(),d=new DurableSource(p,temp()),files=new Map(fs.readdirSync(p.root,{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>{const name=path.relative(p.root,path.join(e.parentPath,e.name));return[name,fs.readFileSync(path.join(p.root,name))]})),history=d.history();expect(verifyHistory(p.id,files,history)).toBe(d.revision());expect(()=>verifyHistory(p.id,files,{...history,sourceDirectory:'other'})).toThrow('digest')
 let state={files,history,revision:d.revision(),epoch:'1'};const backend={read:async()=>state,accept:async(_g:any,_e:any,files:any,history:any)=>{state={files,history,revision:history.revisions.at(-1).revisionId,epoch:'2'};return{epoch:'2'}}}
 await withHostedSource(backend as any,{projectId:p.id,userId:'test'} as any,process.cwd(),async(project,source)=>{expect(project.sourceRoot.endsWith('/apps/web/src')).toBe(true);commit(source,'apps/web/src/App.tsx',source.files().get('apps/web/src/App.tsx')!.replace('Nested source','Hosted edit'))},true)
 expect(state.files.get('apps/web/src/App.tsx')!.toString()).toContain('Hosted edit');expect(verifyHistory(p.id,state.files,state.history)).toBe(state.revision)
})
it('P06 actual independent application exports preserve external imports and apply chunk merging',async()=>{
 const f=fixture('client','client/src'),p=f.project();f.write('client/src/main.tsx',`import {createRoot} from 'react-dom/client';import {readFile} from 'fs/promises';createRoot(document.getElementById('root')!).render(<button onClick={()=>readFile('file')}>App</button>);window.a=()=>import('./a');window.b=()=>import('./b');`)
 f.write('client/src/a.ts',`import {value} from './common';export const a=value+'a'`);f.write('client/src/b.ts',`import {value} from './common';export const b=value+'b'`);f.write('client/src/common.ts',`export const value='shared'`)
 const build=async(size:number)=>{f.write('vite.config.ts',`export default {root:'client',build:{rollupOptions:{external:['fs/promises'],output:{experimentalMinChunkSize:${size}}}}}`);return buildIndependentExport(await exportProjectZip(p),process.cwd())}
 const small=await build(0),merged=await build(3500);expect(merged.plan.output.experimentalMinChunkSize).toBe(3500);expect(merged.files.size).toBeLessThan(small.files.size);expect([...merged.files.values()].map(v=>v.body.toString()).join('')).toContain("from 'fs/promises'")
 await expect(buildIsolatedHttpPreview(p,process.cwd())).rejects.toThrow();expect(merged.html).toContain('type="module"');expect(merged.html).not.toContain('bridge')
},20000)
it('P06 real export API returns exact ZIP only after the independent production gate passes',async()=>{
 const f=fixture('client','client/src'),p=f.project(),d=new DurableSource(p,temp()),file='client/src/App.tsx',before=d.files().get(file)!
 f.write('vite.config.ts',`export default {root:'client',build:{rollupOptions:{external:['fs/promises'],output:{experimentalMinChunkSize:3500}}}}`)
 const context={project:p,projectRoot:process.cwd(),durable:d,store:{read:(file:string)=>d.files().get(file),write:()=>{}},action:'export' as const,body:{expectedRevision:d.revision()},actor:'test',assertAccess:()=>{},authorize:()=>{},beforeCommit:()=>{}}
 const result=await executeSourceOperation(context);expect(result.status).toBe(200);expect(result.value.independentBuild).toBe('PASS');const out=path.join(temp(),'out');await extractSafeZip(Buffer.from(result.value.archive as string,'base64'),out);expect(fs.readFileSync(path.join(out,file),'utf8')).toBe(before)
 f.write('vite.config.ts',`throw Error('must not execute');export default {root:'client'}`);expect((await executeSourceOperation(context)).status).toBe(422)
},20000)
it('P06 Visual, Code, undo and redo share one nested canonical history before exact export',async()=>{
 const f=fixture('apps/web','apps/web/src'),p=f.project(),storage=temp(),d=new DurableSource(p,storage),file='apps/web/src/App.tsx',original=d.files().get(file)!
 const context={project:p,projectRoot:process.cwd(),durable:d,store:{read:(file:string)=>d.files().get(file),write:()=>{}},actor:'test',assertAccess:()=>{},authorize:()=>{},beforeCommit:()=>{}}
 const invoke=(action:any,body:Record<string,unknown>)=>executeSourceOperation({...context,action,body:{expectedRevision:d.revision(),idempotencyKey:randomUUID(),...body}})
 const target=analyzeProjectStyles(d.files(),false).targets.find(t=>t.identity.file===file)!
 expect((await invoke('mutate',{identity:target.identity,edit:{type:'text',value:'Visual edit',scope:'source'}})).status).toBe(200)
 const visual=d.files().get(file)!;expect(visual).toContain('Visual edit')
 expect((await invoke('code',{operations:[{kind:'update',file,content:visual.replace('Visual edit','Code edit'),expectedHash:contentHash(visual)}]})).status).toBe(200)
 expect((await invoke('undo',{})).status).toBe(200);expect(d.files().get(file)).toBe(visual)
 expect((await invoke('redo',{})).status).toBe(200);expect(d.files().get(file)).toContain('Code edit')
 const reopened=new DurableSource(p,storage);expect(reopened.history().transactions.filter(t=>t.status==='accepted').every(t=>t.fileStates?.every(s=>s.file.startsWith('apps/web/src/')))).toBe(true)
 expect(reopened.files().get(file)).not.toBe(original);expect((await invoke('export',{})).status).toBe(200)
},20000)
it('P06 uses matching static Vite and referenced TS aliases in a nested source tree',async()=>{
 const f=fixture('apps/web','apps/web/src');f.write('vite.config.ts',`import path from 'node:path';export default {root:'apps/web',resolve:{alias:{'@':path.resolve(__dirname,'apps/web/src')}}}`);f.write('tsconfig.json',JSON.stringify({references:[{path:'./apps/web/tsconfig.json'}]}));f.write('apps/web/tsconfig.json',JSON.stringify({include:['src'],compilerOptions:{baseUrl:'.',paths:{'@/*':['./src/*']},verbatimModuleSyntax:true}}));f.write('apps/web/src/main.tsx',`import {createRoot} from 'react-dom/client';import App from '@/App';createRoot(document.getElementById('root')!).render(<App/>);`)
 const p=f.project(),report=inspectRuntime(p,process.cwd());expect(report.issues).toEqual([]);expect(report.aliases['@']).toBe('apps/web/src');expect(report.compilerOptions.verbatimModuleSyntax).toBe(true);expect((await buildIndependentExport(await exportProjectZip(p),process.cwd())).sourceUnchanged).toBe(true)
})
it.each(['./','/nested/'])('P06 builds lazy application exports with base %s and inert scripts',async(base)=>{
 const f=fixture();f.write('vite.config.ts',`export default {base:${JSON.stringify(base)}}`);const m=JSON.parse(fs.readFileSync(path.join(f.root,'package.json'),'utf8'));m.scripts={build:'touch DO_NOT_RUN',preinstall:'touch DO_NOT_RUN'};f.write('package.json',JSON.stringify(m));f.write('src/lazy.ts',`export const value=42`);f.write('src/main.tsx',`window.load=()=>import('./lazy');`)
 const result=await buildIndependentExport(await exportProjectZip(f.project()),process.cwd());expect(result.html.includes(base+'assets/app.js')).toBe(true);expect(result.files.has('/assets/app.js')).toBe(true);expect(fs.existsSync(path.join(f.root,'DO_NOT_RUN'))).toBe(false)
})
it('P06 rejects symlink escape imports and independent executable configuration without executing a canary',async()=>{
 const f=fixture('client','client/src'),outside=temp();fs.writeFileSync(path.join(outside,'private.ts'),`export const value='private'`);fs.symlinkSync(path.join(outside,'private.ts'),path.join(f.root,'client/src/value.ts'));f.write('client/src/main.tsx',`import {value} from './value';console.log(value)`);await expect(buildIsolatedHttpPreview(f.project(),process.cwd())).rejects.toThrow();fs.unlinkSync(path.join(f.root,'client/src/value.ts'));f.write('client/src/value.ts','export const value=1');f.write('vite.config.ts',`import fs from 'node:fs';fs.writeFileSync(${JSON.stringify(path.join(outside,'canary'))},'bad');export default {root:'client'}`);await expect(buildIndependentExport(await exportProjectZip(f.project()),process.cwd())).rejects.toThrow();expect(fs.existsSync(path.join(outside,'canary'))).toBe(false)
})
it.skipIf(process.env.WCB_SEMANTIC_TEST!=='1')('P06 native semantic worker checks the real nested source directory',async()=>{
 const {semanticSnapshot,semanticResult}=await import('./runtime/semanticTypecheck'),{LocalLimaRunnerProvider}=await import('./runtime/localLimaRunner'),f=fixture('client','client/src'),p=f.project(),source=new DurableSource(p,temp()).files(),runner=new LocalLimaRunnerProvider(process.cwd())
 source.set('client/src/error.ts',`export const value:number='wrong'`)
 const snapshot=semanticSnapshot(p,process.cwd(),source),generation=randomUUID(),execution=await runner.open({purpose:'semantic-typescript-v1',generation,origin:'http://wcb-'+generation+'.preview.invalid',revision:'rev_'+randomUUID(),expiresAt:Date.now()+60000,route:'/',network:{external:'deny'},snapshot},new AbortController().signal)
 try{const result=semanticResult(await execution.check!());expect(result.passed).toBe(false);expect(result.diagnostics.some(d=>d.file==='client/src/error.ts'&&d.message.includes('not assignable'))).toBe(true)}finally{await execution.close()}
},20000)
it.skipIf(process.env.WCB_PG_TEST!=='1')('P06 real PostgreSQL preserves nested source authority across edits and refuses root rebinding',async()=>{
 const {Pool}=await import('pg'),{PostgresAccess,PostgresProjectStore}=await import('./runtime/postgresStores'),f=fixture('apps/web','apps/web/src'),p=f.project(),d=new DurableSource(p,temp()),files=new Map(fs.readdirSync(p.root,{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>{const file=path.relative(p.root,path.join(e.parentPath,e.name));return[file,fs.readFileSync(path.join(p.root,file))]})),config=JSON.parse(fs.readFileSync('.webcanbe/runner/qa-phase2g2/postgres.json','utf8')),schema='test_'+randomUUID().replace(/-/g,''),admin=new Pool(config)
 await admin.query(`CREATE SCHEMA ${schema}`);const pool=new Pool({...config,options:`-c search_path=${schema}`})
 try{
  await pool.query(fs.readFileSync('deployment/hosted/postgres.sql','utf8'));const access=new PostgresAccess(pool),backend=new PostgresProjectStore(access),session={sessionId:randomUUID(),userId:randomUUID(),expiresAt:Date.now()+600000},workspace=randomUUID();await access.registerSession(session);await access.workspace(workspace,session.userId,'owner');await backend.create(session,workspace,p.id,'P06 nested',files,d.history());const grant=await access.grant(session,p.id,'code')
  await withHostedSource(backend,grant,process.cwd(),async(_p,source)=>{commit(source,'apps/web/src/App.tsx',source.files().get('apps/web/src/App.tsx')!.replace('Nested source','PG accepted'))},true)
  const state=await backend.read(grant);expect(state.history.sourceDirectory).toBe('apps/web/src');expect(state.files.get('apps/web/src/App.tsx')!.toString()).toContain('PG accepted')
  const forged=structuredClone(state.history);forged.sourceDirectory='apps';await expect(backend.accept(grant,{revision:state.revision,epoch:state.epoch},state.files,forged)).rejects.toThrow('cannot change');expect((await backend.read(grant)).history).toEqual(state.history)
  await withHostedSource(backend,grant,process.cwd(),async(project,source)=>{expect(source.files().has('apps/web/src/App.tsx')).toBe(true);expect((await buildIndependentExport(await exportProjectZip(project),process.cwd())).sourceUnchanged).toBe(true)})
 }finally{await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end()}
},20000)
