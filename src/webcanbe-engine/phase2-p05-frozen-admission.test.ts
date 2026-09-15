import {afterEach,expect,it} from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {extractSafeZip,detectProject,type ProjectRecord} from './runtime/projectRegistry'
import {exportProjectZip} from './runtime/projectExport'
import {inspectRuntime} from './runtime/runtimeCompatibility'
import {parseYarnBerry,normalizeAlternateLock} from './runtime/alternateLockfiles'
import {isOpaqueBunLock} from './runtime/intakeMetadata'
import {MutationHistory} from './mutations/sourceMutations'
const dirs:string[]=[]
const temp=()=>{const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'wcb-p05-frozen-')));dirs.push(root);return root}
afterEach(()=>dirs.splice(0).forEach(d=>fs.rmSync(d,{recursive:true,force:true})))
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex')
const files=(root:string)=>Object.fromEntries(fs.readdirSync(root,{recursive:true}).filter((f):f is string=>typeof f==='string'&&fs.statSync(path.join(root,f)).isFile()).sort().map(f=>[f,sha(fs.readFileSync(path.join(root,f)))]))
const project=(root:string)=>({id:'p',name:'frozen',root,sourceRoot:path.join(root,'src'),imported:true,detection:detectProject(root,process.cwd()),history:new MutationHistory()} as ProjectRecord)
const archivePath=process.env.WCB_REDUX_ARCHIVE,bunPath=process.env.WCB_TODO_BUN_LOCK
const redux=archivePath?it:it.skip,bun=bunPath?it:it.skip
redux('round-trips every exact frozen Redux file, including its 2742928-byte Yarn release, and retains missing-graph refusal',async()=>{
  const archive=fs.readFileSync(archivePath!)
  expect(sha(archive)).toBe('a09cb0880f7b791dd2ea746c1182978fc2d60962e27d1a9b40b92a50dc90ed7a')
  const root=path.join(temp(),'project');await extractSafeZip(archive,root)
  const original=files(root)
  expect(original['yarn.lock']).toBe('1d757201762d9525bed90f1ce55fed9f38ee99af895876674020d3cf87823abd')
  expect(original['package.json']).toBe('a3bd46f1fb94bdc5cf64855251c423ec90e80b304194026dbee8eaaa655cd9c8')
  expect(original['.yarn/releases/yarn-4.2.2.cjs']).toBe('1aa43a5304405be7a7cb9cb5de7b97de9c4e8ddd3273e4dad00d6ae3eb39f0ef')
  expect(fs.statSync(path.join(root,'.yarn/releases/yarn-4.2.2.cjs')).size).toBe(2742928)
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')),lock=parseYarnBerry(fs.readFileSync(path.join(root,'yarn.lock'),'utf8'))
  for(const [name,range] of Object.entries({...manifest.dependencies,...manifest.devDependencies}))expect(lock.resolve(name,String(range)).berryLocator).toBeTruthy()
  const p=project(root),report=inspectRuntime(p,process.cwd())
  expect(report.supported).toBe(false)
  expect(report.issues.some(i=>i.code==='unsupported-version'&&i.message.includes('@reduxjs/toolkit'))).toBe(true)
  expect(report.issues.some(i=>i.code==='unsupported-version'&&i.message.includes('react-redux'))).toBe(true)
  const trusted=JSON.parse(fs.readFileSync(path.join('runtime-profiles',report.profile,'package-lock.json'),'utf8'))
  expect(()=>normalizeAlternateLock(lock,manifest,trusted)).toThrow('Locked graph does not match pinned identity')
  const copy=path.join(temp(),'project');await extractSafeZip(await exportProjectZip(p),copy)
  expect(files(copy)).toEqual(original);expect(files(root)).toEqual(original)
})
bun('preserves the retained Todo binary Bun lock as opaque bytes and refuses graph admission',async()=>{
  const bytes=fs.readFileSync(bunPath!)
  expect(bytes.length).toBe(262443);expect(sha(bytes)).toBe('4a6802815bb395350e14d4bd5d2162157bc2a21de755ca72c82a09dc8808c143')
  expect(isOpaqueBunLock('bun.lockb',bytes)).toBe(true)
  const root=temp(),manifest=JSON.parse(fs.readFileSync('runtime-profiles/react19-vite6/package.json','utf8'))
  fs.mkdirSync(path.join(root,'src'));fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({dependencies:manifest.dependencies}));fs.writeFileSync(path.join(root,'bun.lockb'),bytes)
  fs.writeFileSync(path.join(root,'src/main.jsx'),'export default 1');fs.writeFileSync(path.join(root,'index.html'),'<div id="root"></div><script type="module" src="/src/main.jsx"></script>')
  const p=project(root),report=inspectRuntime(p,process.cwd())
  expect(report.supported).toBe(false);expect(report.issues.some(i=>i.code==='unsupported-lockfile')).toBe(true)
  const copy=path.join(temp(),'project');await extractSafeZip(await exportProjectZip(p),copy)
  expect(fs.readFileSync(path.join(copy,'bun.lockb')).equals(bytes)).toBe(true)
})
