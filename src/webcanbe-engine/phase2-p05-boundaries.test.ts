import {afterEach,expect,it} from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {randomBytes} from 'node:crypto'
import {ZipFile} from 'yazl'
import {extractSafeZip,detectProject,ZIP_LIMITS,type ProjectRecord} from './runtime/projectRegistry'
import {exportProjectZip} from './runtime/projectExport'
import {buildIsolatedPreview,buildIsolatedHttpPreview} from './runtime/isolatedPreview'
import {staticViteConfig} from './runtime/runtimeCompatibility'
import {MutationHistory} from './mutations/sourceMutations'
const dirs:string[]=[]
const temp=()=>{const p=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'wcb-p05-boundary-')));dirs.push(p);return p}
afterEach(()=>dirs.splice(0).forEach(p=>fs.rmSync(p,{recursive:true,force:true})))
const zipOf=(entries:Record<string,Buffer>)=>new Promise<Buffer>((resolve,reject)=>{const zip=new ZipFile(),chunks:Buffer[]=[];for(const [name,bytes] of Object.entries(entries))zip.addBuffer(bytes,name);zip.outputStream.on('data',c=>chunks.push(c));zip.outputStream.on('end',()=>resolve(Buffer.concat(chunks)));zip.outputStream.on('error',reject);zip.end()})
const inert='.yarn/releases/yarn-4.2.2.cjs'
function fixture(file:string){
  const root=temp(),manifest=JSON.parse(fs.readFileSync('runtime-profiles/react19-vite6/package.json','utf8'))
  fs.mkdirSync(path.join(root,'src'));fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true})
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({dependencies:manifest.dependencies,scripts:{preinstall:'throw unexecuted',build:'throw unexecuted'}}))
  fs.writeFileSync(path.join(root,'index.html'),'<div id="root"></div><script type="module" src="/src/main.jsx"></script>')
  fs.writeFileSync(path.join(root,file),'globalThis.__uploadedToolExecuted=true;throw new Error("UPLOADED TOOL EXECUTED")')
  fs.writeFileSync(path.join(root,'src/main.jsx'),`import ${JSON.stringify('../'+file)};import {createRoot} from 'react-dom/client';createRoot(document.getElementById('root')).render(<h1>blocked</h1>)`)
  const project={id:'p',name:'p',root,sourceRoot:path.join(root,'src'),imported:true,detection:detectProject(root,process.cwd()),history:new MutationHistory()} as ProjectRecord
  return {root,project,manifest}
}
it.each([inert,'.yarn/plugins/uploaded.cjs','.pnp.cjs','.pnp.loader.mjs','src/.yarn/plugins/uploaded.cjs'])('refuses uploaded tooling %s in Blob, HTTP and independent export compilation',async file=>{
  const {project}=fixture(file)
  for(const build of [()=>buildIsolatedPreview(project,process.cwd()),()=>buildIsolatedHttpPreview(project,process.cwd()),()=>buildIsolatedHttpPreview(project,process.cwd(),undefined,{},true)])await expect(build()).rejects.toThrow('Inert package-manager tooling cannot be imported or executed')
  expect((globalThis as any).__uploadedToolExecuted).toBeUndefined()
})
it('refuses tooling as a static Vite plugin and through a source symlink',async()=>{
  const {root,project,manifest}=fixture(inert)
  fs.writeFileSync(path.join(root,'vite.config.js'),`import plugin from './${inert}';export default {plugins:[plugin()]}`)
  expect(()=>staticViteConfig(root,manifest.dependencies)).toThrow()
  fs.unlinkSync(path.join(root,'vite.config.js'))
  fs.symlinkSync(path.join(root,inert),path.join(root,'src/link.cjs'))
  fs.writeFileSync(path.join(root,'src/main.jsx'),"import './link.cjs'")
  await expect(buildIsolatedHttpPreview(project,process.cwd())).rejects.toThrow('Inert package-manager tooling')
  await expect(exportProjectZip(project)).rejects.toThrow()
})
it('keeps the 4 MiB inert limit and 100:1 compression-ratio protection',async()=>{
  await expect(extractSafeZip(await zipOf({[inert]:randomBytes(4*1024*1024+1)}),path.join(temp(),'out'))).rejects.toThrow('Unsafe ZIP')
  await expect(extractSafeZip(await zipOf({[inert]:Buffer.alloc(3*1024*1024,65)}),path.join(temp(),'out'))).rejects.toThrow('Unsafe ZIP')
})
it('keeps aggregate inflated, upload and entry-count limits for inert tooling',async()=>{
  const bytes=Buffer.concat([randomBytes(2*1024*1024),Buffer.alloc(2*1024*1024)]),entries:Record<string,Buffer>={}
  for(let i=0;i<11;i++)entries[`.yarn/releases/yarn-4.2.${i}.cjs`]=bytes
  const zip=await zipOf(entries);expect(zip.length).toBeLessThan(ZIP_LIMITS.archiveBytes)
  await expect(extractSafeZip(zip,path.join(temp(),'out'))).rejects.toThrow('Unsafe ZIP')
  await expect(extractSafeZip(Buffer.alloc(ZIP_LIMITS.archiveBytes+1),path.join(temp(),'out'))).rejects.toThrow('25 MiB')
  const many=Object.fromEntries(Array.from({length:2001},(_,i)=>['src/file'+i+'.js',Buffer.alloc(0)]))
  await expect(extractSafeZip(await zipOf(many),path.join(temp(),'out'))).rejects.toThrow('Unsafe ZIP')
},15000)
it('keeps archive path and Unix symlink confinement for the larger inert role',async()=>{
  const original=await zipOf({[inert]:Buffer.from('unexecuted')})
  const central=original.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));expect(central).toBeGreaterThan(0)
  const link=Buffer.from(original);link.writeUInt32LE((0o120777*65536)>>>0,central+38)
  await expect(extractSafeZip(link,path.join(temp(),'out'))).rejects.toThrow('Unsafe ZIP')
  const escaped=Buffer.from(original),name=Buffer.from(inert),bad=Buffer.from('../xx/releases/yarn-4.2.2.cjs');expect(bad.length).toBe(name.length)
  let at=escaped.indexOf(name);while(at>=0){bad.copy(escaped,at);at=escaped.indexOf(name,at+name.length)}
  await expect(extractSafeZip(escaped,path.join(temp(),'out'))).rejects.toThrow()
})
