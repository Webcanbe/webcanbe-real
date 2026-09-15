import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {randomUUID} from 'node:crypto'
import {afterEach,expect,it} from 'vitest'
import {inspectRuntime,staticViteConfig} from './runtime/runtimeCompatibility'
import {buildIsolatedHttpPreview} from './runtime/isolatedPreview'
import {detectProject} from './runtime/projectRegistry'
import {MutationHistory} from './mutations/sourceMutations'
const dirs:string[]=[]
afterEach(()=>{for(const d of dirs.splice(0))fs.rmSync(d,{recursive:true,force:true})})
function project(){const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'wcb-breadth-config-')));dirs.push(root);fs.cpSync('fixtures/independent/vite-react18-ts',root,{recursive:true});return{id:randomUUID(),name:'static config',root,sourceRoot:path.join(root,'src'),imported:true,detection:detectProject(root,process.cwd()),history:new MutationHistory()}}
it('compiles constant nested aliases, same-directory config inheritance and a confined custom publicDir without altering source',async()=>{
 const p=project();fs.cpSync(path.join(p.root,'public'),path.join(p.root,'static'),{recursive:true})
 fs.writeFileSync(path.join(p.root,'tsconfig.json'),JSON.stringify({extends:'./tsconfig.base.json',include:['src']}))
 fs.writeFileSync(path.join(p.root,'tsconfig.base.json'),JSON.stringify({compilerOptions:{baseUrl:'.',paths:{'@/*':['./src/*']}}}))
 const config=`import path from 'node:path';const source=path.resolve('./','src');const aliases={'@':source};export default {root:'.',publicDir:'./static',base:'/nested/',resolve:{alias:aliases},test:{environment:'jsdom',globals:true,setupFiles:'./src/unused-test.ts'},optimizeDeps:{exclude:['fsevents']}}`
 fs.writeFileSync(path.join(p.root,'vite.config.ts'),config)
 const r=inspectRuntime(p,process.cwd());expect(r.issues).toEqual([]);expect(r.aliases).toEqual({'@':'src'});expect(r.publicDir).toBe('static');expect(r.configuration.filter(x=>x.classification==='preserved-not-applied')).toHaveLength(2)
 const build=await buildIsolatedHttpPreview(p,process.cwd());expect(build.files.has('/vite.svg')).toBe(true);expect(build.files.has('/nested/vite.svg')).toBe(true);expect(fs.readFileSync(path.join(p.root,'vite.config.ts'),'utf8')).toBe(config)
})
it('recognizes only the known declarative tsconfig-paths plugin binding',()=>{
 const p=project();fs.writeFileSync(path.join(p.root,'vite.config.ts'),`import paths from 'vite-tsconfig-paths';export default {plugins:[paths()]}`)
 expect(staticViteConfig(p.root,{'vite-tsconfig-paths':'4.3.2'}).tsconfigPaths).toBe(true)
 fs.writeFileSync(path.join(p.root,'vite.config.ts'),`export default {plugins:[{plugin:'vite-tsconfig-paths'}]}`)
 expect(()=>staticViteConfig(p.root,{'vite-tsconfig-paths':'4.3.2'})).toThrow()
})
it.each([
 `const ignored=globalThis.sideEffect();export default {}`,
 `const x=y;const y=x;export default {base:x}`,
 `let x='/';export default {base:x}`,
 `const x={get base(){return '/'}};export default x`,
 `import path from 'node:path';import path from 'node:path';export default {}`,
 `export default {publicDir:'../outside'}`,
 `export default {publicDir:'src'}`,
 `export default {root:'./nested'}`,
 `export default {test:{setupFiles:()=>console.log('run')}}`,
 `export default {build:{rollupOptions:{plugins:[arbitrary()]}}}`
])('refuses unimplemented executable or escaping config semantics: %s',source=>{
 const p=project();fs.writeFileSync(path.join(p.root,'vite.config.ts'),source);expect(inspectRuntime(p,process.cwd()).issues.some(x=>x.code==='executable-config')).toBe(true)
})
it('refuses cyclic/escaping inherited TypeScript options and mismatched aliases',()=>{
 const p=project();const file=path.join(p.root,'tsconfig.json')
 for(const config of [{extends:'../outside.json'},{extends:'./tsconfig.json'},{compilerOptions:{paths:{'@/*':['src/*']},baseUrl:'.'}}]){fs.writeFileSync(file,JSON.stringify(config));expect(inspectRuntime(p,process.cwd()).issues.some(x=>x.code==='tsconfig')).toBe(true)}
})
