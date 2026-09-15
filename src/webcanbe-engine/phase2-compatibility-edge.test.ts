import {afterEach,expect,it} from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {randomUUID} from 'node:crypto'
import {parseYarnClassic,normalizeAlternateLock,npmDescriptor} from './runtime/alternateLockfiles'
import {cssData,cssCompiler} from './runtime/staticCss'
import {staticViteConfig,inspectRuntime} from './runtime/runtimeCompatibility'
import {buildFiniteExportGraph,finiteBuildPlan} from './runtime/finiteBuild'
import {buildIsolatedHttpPreview} from './runtime/isolatedPreview'
import {extractSafeZip,detectProject} from './runtime/projectRegistry'
import {exportProjectZip} from './runtime/projectExport'
import {MutationHistory} from './mutations/sourceMutations'
const dirs:string[]=[]
afterEach(()=>dirs.splice(0).forEach(d=>fs.rmSync(d,{recursive:true,force:true})))
function fixture(profile='react19-vite6-uno65-v1'){
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'wcb-edge-')));dirs.push(root)
 const manifest=JSON.parse(fs.readFileSync('runtime-profiles/'+profile+'/package.json','utf8'))
 const write=(file:string,code:string)=>{fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),code)}
 write('package.json',JSON.stringify({dependencies:manifest.dependencies}));write('index.html','<div id="root"></div><script type="module" src="/src/main.jsx"></script>');write('src/main.jsx','import {createRoot} from "react-dom/client";createRoot(document.getElementById("root")).render(<h1>Edge</h1>)')
 const project=()=>({id:randomUUID(),name:'Edge fixture',root,sourceRoot:path.join(root,'src'),imported:true,detection:detectProject(root,process.cwd()),history:new MutationHistory()})
 return {root,write,manifest,project,profileRoot:path.resolve('runtime-profiles/'+profile)}
}
const uno=`import {defineConfig,presetUno,presetAttributify,transformerDirectives,transformerVariantGroup} from 'unocss';import {presetForms} from '@julr/unocss-preset-forms';export default defineConfig({presets:[presetUno({dark:'media'}),presetAttributify(),presetForms()],transformers:[transformerDirectives(),transformerVariantGroup()]})`
it('compiles forms, directives, variant groups and responsive media dark with canonical export preservation',async()=>{
 const f=fixture();f.write('uno.config.ts',uno)
 const original=`import {createRoot} from 'react-dom/client';import 'virtual:uno.css';import './style.css';createRoot(document.getElementById('root')).render(<main><input type="text"/><h1 className="dark:(text-red-500 bg-black) md:(p-4 text-xl)">Finite Uno</h1></main>)`
 f.write('src/main.jsx',original);f.write('src/style.css','.card { @apply p-4 text-red-500; } .group { @apply md:(p-4 m-2); } @screen md { .wide { @apply p-8; } }')
 const p=f.project(),report=inspectRuntime(p,process.cwd());expect(report.issues).toEqual([])
 const built=await buildIsolatedHttpPreview(p,process.cwd()),css=built.files.get('/_wcb/app.css')!.body.toString(),js=built.files.get('/_wcb/app.js')!.body.toString()
 expect(css).toContain('prefers-color-scheme:dark');expect(css).toMatch(/min-width:768px/);expect(css).toContain('appearance:none');expect(css).toMatch(/\.card\{[^}]*padding:1rem/);expect(css).not.toContain('@apply');expect(css).not.toContain('@screen');expect(js).toContain('dark:text-red-500 dark:bg-black');expect(js).toContain('md:p-4 md:text-xl');expect(js).not.toContain('dark:(text')
 expect(fs.readFileSync(path.join(f.root,'src/main.jsx'),'utf8')).toBe(original)
 const destination=path.join(f.root,'export-copy');await extractSafeZip(await exportProjectZip(p),destination)
 expect(fs.readFileSync(path.join(destination,'uno.config.ts'),'utf8')).toBe(uno);expect(fs.readFileSync(path.join(destination,'src/main.jsx'),'utf8')).toBe(original)
})
it('supports the same finite transformers on the retained pinned Uno66 graph',async()=>{
 const f=fixture('react19-vite6-uno-v1'),config=cssData(`import {defineConfig,presetUno,transformerDirectives,transformerVariantGroup} from 'unocss';export default defineConfig({presets:[presetUno({dark:'media'})],transformers:[transformerDirectives(),transformerVariantGroup()]})`,'unocss')
 f.write('src/main.jsx','const x="sm:(p-2 m-2) dark:bg-black"');f.write('src/style.css','.x{@apply p-4;}')
 const compile=await cssCompiler(f.root,f.profileRoot,{kind:'unocss',files:[],config});expect(await compile.source('src/main.jsx','const x="sm:(p-2 m-2) dark:bg-black"')).toContain('sm:p-2 sm:m-2');expect(await compile('.x{@apply p-4;}','src/style.css')).toContain('padding:1rem');expect(await compile('/* webcanbe uno entry */')).toContain('prefers-color-scheme: dark')
})
it.each([
 `presets:[{adapter:'presetForms',options:{}}]`,
 `transformers:[{adapter:'transformerVariantGroup',options:{}}]`,
 `transformers:[()=>process.env]`,
 `transformers:[transformerDirectives({applyVariable:()=>process.env})]`,
 `transformers:[transformerVariantGroup({separators:[]})]`,
 `presets:[presetUno({dark:'unknown'})]`,
 `presets:[presetAttributify({dark:'media'})]`,
 `presets:[presetUno({dark:import('node:fs')})]`,
 `transformers:[transformerDirectives(),transformerDirectives()]`,
])('refuses malformed/dynamic Uno edge configuration: %s',field=>expect(()=>cssData(`import {defineConfig,presetUno,presetAttributify,transformerDirectives,transformerVariantGroup} from 'unocss';export default defineConfig({${field}})`,'unocss')).toThrow())
it('does not admit forms1 against its incompatible Uno66 peer graph',()=>{const f=fixture('react19-vite6-uno-v1');f.write('uno.config.ts',uno);expect(inspectRuntime(f.project(),process.cwd()).issues.some(i=>i.code==='css-config')).toBe(true)})
it('fails on changed Uno source snapshots instead of returning stale transformed code',async()=>{const f=fixture();const compile=await cssCompiler(f.root,f.profileRoot,{kind:'unocss',files:[],config:{}});await expect(compile.source('src/main.jsx','different')).rejects.toThrow('snapshot')})
const integrity='sha512-'+Buffer.alloc(64,7).toString('base64')
it.each(['alias@npm:real@^1.0.0','@scope/alias@npm:@scope/real@^1.0.0','real@npm:^1.0.0'])('normalizes exact Yarn npm identities without executing a manager: %s',descriptor=>{
 const at=descriptor.indexOf('@',descriptor.startsWith('@')?1:0),name=descriptor.slice(0,at),requested=descriptor.slice(at+1),identity=npmDescriptor(name,requested).name
 const source=`# yarn lockfile v1\n${JSON.stringify(descriptor)}:\n  version "1.0.0"\n  resolved "https://registry.npmjs.org/real/-/real-1.0.0.tgz"\n  integrity ${integrity}\n`
 const lock=parseYarnClassic(source),profile={packages:{['node_modules/'+name]:{name:identity,version:'1.0.0',integrity}}}
 expect(normalizeAlternateLock(lock,{dependencies:{[name]:requested}},profile).packages['node_modules/'+name].name).toBe(identity)
 expect(()=>lock.resolve(name,requested.replace('^','~'))).toThrow('Exact')
 expect(()=>normalizeAlternateLock(lock,{dependencies:{[name]:requested}},{packages:{['node_modules/'+name]:{name:'wrong',version:'1.0.0',integrity}}})).toThrow('identity')
})
it.each(['npm:../private@1','npm:@scope/../../private@1','workspace:../private','file:../private','patch:real@1','npm:real@https://evil.test/x'])('refuses unproved or escaping package descriptors: %s',descriptor=>expect(()=>npmDescriptor('alias',descriptor)).toThrow())
it('checks Yarn alias transitive and required peer edges at the aliased location',()=>{
 const lock=parseYarnClassic(`# yarn lockfile v1\n"alias@npm:real@1.0.0":\n  version "1.0.0"\n  resolved "https://registry.npmjs.org/real/-/real.tgz"\n  integrity ${integrity}\n`)
 expect(()=>normalizeAlternateLock(lock,{dependencies:{alias:'npm:real@1.0.0'}},{packages:{'node_modules/alias':{name:'real',version:'1.0.0',integrity,peerDependencies:{peer:'1.0.0'}}}})).toThrow()
})
it('derives a non-root Vite HTML entry and public directory while keeping aliases config-relative',async()=>{
 const f=fixture('react19-vite6');f.write('src/index.html','<div id="root"></div><script type="module" src="/main.jsx"></script>');f.write('src/public/icon.svg','<svg xmlns="http://www.w3.org/2000/svg"/>');f.write('src/heading.jsx','export default ()=><h1>Nested Vite root</h1>');f.write('src/main.jsx','import {createRoot} from "react-dom/client";import Heading from "@/heading";createRoot(document.getElementById("root")).render(<Heading/>)');f.write('vite.config.ts',`import {defineConfig} from 'vite';import path from 'node:path';export default defineConfig({root:'src',resolve:{alias:{'@':path.resolve(__dirname,'src')}}})`)
 const report=inspectRuntime(f.project(),process.cwd());expect(report.issues).toEqual([]);expect(report.entry).toBe('src/main.jsx');expect(report.aliases['@']).toBe('src');expect(report.publicDir).toBe('src/public')
 const built=await buildIsolatedHttpPreview(f.project(),process.cwd());expect(built.files.has('/icon.svg')).toBe(true);expect(built.files.get('/_wcb/app.js')!.body.toString()).toContain('Nested Vite root')
})
it.each(['../private','/tmp','src/../../private'])('refuses Vite root escapes: %s',root=>{const f=fixture();f.write('vite.config.ts',`export default {root:${JSON.stringify(root)}}`);expect(()=>staticViteConfig(f.root,f.manifest.dependencies)).toThrow()})
it('refuses a symlinked Vite root even when its target stays inside the canonical project',()=>{const f=fixture();fs.symlinkSync(path.join(f.root,'src'),path.join(f.root,'linked'));f.write('vite.config.ts',`export default {root:'linked'}`);expect(()=>staticViteConfig(f.root,f.manifest.dependencies)).toThrow('symlink')})
it('does not fall back to canonical index.html when a declared nested root lacks its index',()=>{const f=fixture();f.write('vite.config.ts',`export default {root:'src'}`);expect(inspectRuntime(f.project(),process.cwd()).issues.some(i=>i.code==='html-entry')).toBe(true)})
it('retains upstream TS alias incompatibility when no runtime relationship exists',()=>{const f=fixture();f.write('tsconfig.json',JSON.stringify({compilerOptions:{paths:{'@/*':['./src/*']}}}));expect(inspectRuntime(f.project(),process.cwd()).issues.some(i=>i.code==='tsconfig')).toBe(true)})
it('represents finite build options independently and applies them in the pinned Rollup worker',async()=>{
 const f=fixture();f.write('vite.config.ts',`export default {build:{rollupOptions:{external:['fs/promises'],output:{experimentalMinChunkSize:3500}}}}`)
 const report=inspectRuntime(f.project(),process.cwd());expect(report.issues).toEqual([]);expect(report.exportBuild).toEqual({external:['fs/promises'],output:{experimentalMinChunkSize:3500}})
 const output=await buildFiniteExportGraph(f.profileRoot,'src/entry.js',{'src/entry.js':`import {readFile} from 'fs/promises';export const read=readFile;export const lazy=()=>import('./lazy.js');`,'src/lazy.js':`export const value=42;`},report.exportBuild!)
 expect(output.map(o=>o.code).join('\n')).toContain("from 'fs/promises'");expect(output.map(o=>o.code).join('\n')).toContain('42')
 f.write('src/main.jsx',`import {readFile} from 'fs/promises';console.log(readFile);`);await expect(buildIsolatedHttpPreview(f.project(),process.cwd())).rejects.toThrow()
})
it.each([{rollupOptions:{external:['node:fs']}},{rollupOptions:{external:['fs/promises','fs/promises']}},{rollupOptions:{output:{experimentalMinChunkSize:-1}}},{rollupOptions:{output:{experimentalMinChunkSize:1.5}}},{rollupOptions:{output:{manualChunks:{x:['react']}}}},{minify:true}])('refuses unsupported build effects: %j',value=>expect(()=>finiteBuildPlan(value)).toThrow())
it('refuses export graph imports outside immutable inputs and leaves module side effects unexecuted',async()=>{
 const f=fixture(),plan={external:[],output:{experimentalMinChunkSize:3500}}
 await expect(buildFiniteExportGraph(f.profileRoot,'src/main.js',{'src/main.js':`import '/tmp/private.js';`},plan)).rejects.toThrow()
 const output=await buildFiniteExportGraph(f.profileRoot,'src/main.js',{'src/main.js':`throw Error('must never execute in compiler');`},plan);expect(output[0].code).toContain('must never execute')
})
it.each([`root:()=> 'src'`,`root:async()=> 'src'`,`build:{rollupOptions:{output:{experimentalMinChunkSize:()=>3500}}}`,`root:{toString:()=> 'src'}`])('refuses executable values inside otherwise finite Vite objects: %s',field=>{const f=fixture();f.write('vite.config.ts',`export default {${field}}`);expect(()=>staticViteConfig(f.root,f.manifest.dependencies)).toThrow()})
it('does not reinterpret shadowed __dirname as the operator project directory',()=>{const f=fixture();f.write('vite.config.ts',`import path from 'node:path';const __dirname='../private';export default {root:path.resolve(__dirname,'src')}`);expect(()=>staticViteConfig(f.root,f.manifest.dependencies)).toThrow()})
it('applies Rollup minimum chunk size to an eligible independent export graph',async()=>{
 const f=fixture(),modules={'src/entry.js':`export const a=()=>import('./a.js');export const b=()=>import('./b.js');`,'src/a.js':`import {value} from './common.js';export const a=value+'a';`,'src/b.js':`import {value} from './common.js';export const b=value+'b';`,'src/common.js':`export const value='shared';`}
 const before=await buildFiniteExportGraph(f.profileRoot,'src/entry.js',modules,{external:[],output:{experimentalMinChunkSize:0}}),after=await buildFiniteExportGraph(f.profileRoot,'src/entry.js',modules,{external:[],output:{experimentalMinChunkSize:3500}})
 expect(after.length).toBeLessThan(before.length)
})
it('rebuilds Uno snapshots after source edits and applies HTML groups and admitted module extensions',async()=>{
 const {IncrementalPreviewCompiler}=await import('./runtime/incrementalPreview'),f=fixture(),compiler=new IncrementalPreviewCompiler()
 f.write('uno.config.ts',uno);f.write('index.html','<body class="md:(p-4 m-2)"><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>')
 f.write('shared/helper.mjs',`export const classes='lg:(p-2 m-2)'`);f.write('src/value.mts',`export const value:string='edge';`)
 const app=(padding:string)=>`import {createRoot} from 'react-dom/client';import 'virtual:uno.css';import {classes} from '../shared/helper.mjs';import {value} from './value.mts';createRoot(document.getElementById('root')).render(<main className={classes}><h1 className="dark:(${padding} bg-black)">{value}</h1></main>)`
 const p=f.project();try{
  f.write('src/main.jsx',app('p-2'));const first=await buildIsolatedHttpPreview(p,process.cwd(),compiler)
  expect(first.html).toContain('class="md:p-4 md:m-2"');expect(first.files.get('/_wcb/app.js')!.body.toString()).toContain('lg:p-2 lg:m-2')
  f.write('src/main.jsx',app('p-8'));const next=await buildIsolatedHttpPreview(p,process.cwd(),compiler)
  expect(next.files.get('/_wcb/app.js')!.body.toString()).toContain('dark:p-8 dark:bg-black');expect(next.files.get('/_wcb/app.css')!.body.toString()).toContain('padding:2rem');expect(compiler.configurationChanged).toBe(true)
 }finally{await compiler.close()}
})
