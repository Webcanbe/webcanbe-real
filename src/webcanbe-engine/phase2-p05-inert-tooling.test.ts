import {afterEach,expect,it} from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {randomBytes} from 'node:crypto'
import {ZipFile} from 'yazl'
import {archiveMemberLimit,isInertToolingPath} from './runtime/intakeMetadata'
import {extractSafeZip,detectProject,type ProjectRecord} from './runtime/projectRegistry'
import {exportProjectZip} from './runtime/projectExport'
import {buildIsolatedHttpPreview} from './runtime/isolatedPreview'
import {MutationHistory} from './mutations/sourceMutations'

const dirs:string[]=[]
afterEach(()=>dirs.splice(0).forEach(d=>fs.rmSync(d,{recursive:true,force:true})))
const zipOf=(entries:Record<string,Buffer|string>)=>new Promise<Buffer>((resolve,reject)=>{const zip=new ZipFile(),chunks:Buffer[]=[];for(const [name,value] of Object.entries(entries))zip.addBuffer(Buffer.isBuffer(value)?value:Buffer.from(value),name);zip.outputStream.on('data',c=>chunks.push(Buffer.from(c)));zip.outputStream.on('end',()=>resolve(Buffer.concat(chunks)));zip.outputStream.on('error',reject);zip.end()})

it('gives only exact bundled Yarn release paths a larger inert preservation bound',()=>{
  expect(isInertToolingPath('.yarn/releases/yarn-4.2.2.cjs')).toBe(true)
  expect(archiveMemberLimit('.yarn/releases/yarn-4.2.2.cjs')).toBe(4*1024*1024)
  for(const name of ['src/yarn-4.2.2.cjs','.yarn/releases/evil.cjs','.yarn/releases/yarn-4.2.cjs','.yarn/releases/yarn-4.2.2.js','.yarn/../releases/yarn-4.2.2.cjs'])expect(isInertToolingPath(name)).toBe(false)
  expect(archiveMemberLimit('src/large.cjs')).toBe(2*1024*1024)
})

it('round-trips an oversized inert Yarn release while the ordinary 2 MiB member boundary remains',async()=>{
  const parent=fs.mkdtempSync(path.join(os.tmpdir(),'wcb-inert-'));dirs.push(parent);const root=path.join(parent,'project')
  const inert=randomBytes(2_742_928)
  const archive=await zipOf({'.yarn/releases/yarn-4.2.2.cjs':inert,'package.json':'{}'})
  await extractSafeZip(archive,root)
  expect(fs.readFileSync(path.join(root,'.yarn/releases/yarn-4.2.2.cjs')).equals(inert)).toBe(true)
  const project={id:'p',name:'p',root,sourceRoot:path.join(root,'src'),imported:true,detection:{supported:false,framework:'unknown',tailwind:false,dependencies:[]},history:new MutationHistory()} as ProjectRecord
  const out=await exportProjectZip(project),copyParent=fs.mkdtempSync(path.join(os.tmpdir(),'wcb-inert-copy-'));dirs.push(copyParent);const copy=path.join(copyParent,'project')
  await extractSafeZip(out,copy)
  expect(fs.readFileSync(path.join(copy,'.yarn/releases/yarn-4.2.2.cjs')).equals(inert)).toBe(true)
  const largeParent=fs.mkdtempSync(path.join(os.tmpdir(),'wcb-large-'));dirs.push(largeParent)
  await expect(extractSafeZip(await zipOf({'src/large.cjs':randomBytes(2*1024*1024+1)}),path.join(largeParent,'project'))).rejects.toThrow('Unsafe ZIP')
})

it('preserves inert tooling as source-owned bytes but refuses importing it into the controlled browser graph',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'wcb-inert-preview-'));dirs.push(root)
  const profile=JSON.parse(fs.readFileSync('runtime-profiles/react19-vite6/package.json','utf8'))
  fs.mkdirSync(path.join(root,'src'),{recursive:true});fs.mkdirSync(path.join(root,'.yarn/releases'),{recursive:true})
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({dependencies:profile.dependencies}))
  fs.writeFileSync(path.join(root,'index.html'),'<div id="root"></div><script type="module" src="/src/main.jsx"></script>')
  fs.writeFileSync(path.join(root,'src/main.jsx'),`import '../.yarn/releases/yarn-4.2.2.cjs';import {createRoot} from 'react-dom/client';createRoot(document.getElementById('root')).render(<h1>blocked</h1>)`)
  fs.writeFileSync(path.join(root,'.yarn/releases/yarn-4.2.2.cjs'),'throw new Error("must never execute")')
  const detection=detectProject(root,process.cwd()),project={id:'p',name:'p',root,sourceRoot:path.join(root,'src'),imported:true,detection,history:new MutationHistory()} as ProjectRecord
  await expect(buildIsolatedHttpPreview(project,process.cwd())).rejects.toThrow('Inert package-manager tooling cannot be imported or executed')
})
