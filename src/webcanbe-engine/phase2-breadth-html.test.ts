import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {randomUUID} from 'node:crypto'
import {afterEach,expect,it} from 'vitest'
import {staticHtml} from './runtime/htmlConfiguration'
import {inspectRuntime} from './runtime/runtimeCompatibility'
import {buildIsolatedHttpPreview,buildIsolatedPreview} from './runtime/isolatedPreview'
import {detectProject} from './runtime/projectRegistry'
import {MutationHistory} from './mutations/sourceMutations'
const dirs:string[]=[]
afterEach(()=>{for(const d of dirs.splice(0))fs.rmSync(d,{recursive:true,force:true})})
function project(){const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'wcb-breadth-html-')));dirs.push(root);fs.cpSync('fixtures/independent/vite-react18-ts',root,{recursive:true});return{id:randomUUID(),name:'static shell',root,sourceRoot:path.join(root,'src'),imported:true,detection:detectProject(root,process.cwd()),history:new MutationHistory()}}
const shell=(head='',body='<div id="app"></div>')=>`<!doctype html><html lang="en"><head><title>Independent shell</title>${head}</head><body class="app-shell">${body}<script type="module" src="./src/main.tsx" defer></script></body></html>`
it('preserves alternate mount, body attributes, local stylesheet and canonical HTML in HTTP and Blob compilation',async()=>{
 const p=project(),original=shell('<link rel="stylesheet" href="./src/shell.css">')
 fs.writeFileSync(path.join(p.root,'index.html'),original);fs.writeFileSync(path.join(p.root,'src/shell.css'),'.app-shell{background:rgb(12,34,56)}')
 fs.writeFileSync(path.join(p.root,'src/App.tsx'),'export default function App(){return <main>Static mount works</main>}')
 const entry=path.join(p.root,'src/main.tsx');fs.writeFileSync(entry,fs.readFileSync(entry,'utf8').replace(/root/g,'app'))
 expect(inspectRuntime(p,process.cwd()).issues).toEqual([])
 const result=await buildIsolatedHttpPreview(p,process.cwd())
 expect(result.html).toContain('<div id="app"></div>');expect(result.html).toContain('class="app-shell"');expect(result.html).toContain('Independent shell');expect(result.html).not.toContain('src/main.tsx');expect(result.files.get('/_wcb/app.css')?.body.toString()).toMatch(/app-shell.*background/)
 expect(await buildIsolatedPreview(p,process.cwd())).toContain('<div id="app"></div>')
 expect(fs.readFileSync(path.join(p.root,'index.html'),'utf8')).toBe(original)
})
it('retains a declared HTTPS stylesheet as a required resource without fetching during HTML interpretation',()=>{
 const p=project();fs.writeFileSync(path.join(p.root,'index.html'),shell('<link rel="stylesheet" href="https://fonts.example.org/font.css">'));expect(staticHtml(p.root)?.head).toContain('https://fonts.example.org/font.css')
})
it('admits only a confined inert local manifest and strips it from controlled preview HTML without changing canonical source',async()=>{
 const p=project(),original=shell('<link rel="manifest" href="/manifest.webmanifest">')
 fs.mkdirSync(path.join(p.root,'public'),{recursive:true});fs.writeFileSync(path.join(p.root,'public/manifest.webmanifest'),'{"name":"Static shell"}')
 fs.writeFileSync(path.join(p.root,'index.html'),original)
 expect(staticHtml(p.root)?.head).not.toContain('manifest')
 expect((await buildIsolatedHttpPreview(p,process.cwd())).html).not.toContain('manifest')
 expect(fs.readFileSync(path.join(p.root,'index.html'),'utf8')).toBe(original)
})
it.each([
 '<link rel="manifest" href="/missing.json">',
 '<link rel="manifest" href="../manifest.json">',
 '<link rel="manifest" href="https://external.invalid/manifest.json">',
 '<link rel="manifest" href="//external.invalid/manifest.json">',
 '<link rel="manifest" href="data:application/manifest+json,{}">',
 '<link rel="manifest" href="/manifest.txt">',
 '<link rel="manifest" href="/manifest.json" crossorigin>',
 '<link rel="manifest" href="/manifest.json" media="screen">',
 '<link rel="manifest" href="/manifest.json" sizes="any">'
])('refuses missing, escaping, remote, protocol and variant manifests: %s',fragment=>{
 const p=project();fs.mkdirSync(path.join(p.root,'public'),{recursive:true});fs.writeFileSync(path.join(p.root,'public/manifest.json'),'{}');fs.writeFileSync(path.join(p.root,'index.html'),shell(fragment));expect(()=>staticHtml(p.root)).toThrow();expect(inspectRuntime(p,process.cwd()).supported).toBe(false)
})
it.each([
 '<script>globalThis.sideEffect=1</script>',
 '<script type="module" src="https://external.invalid/a.js"></script>',
 '<iframe src="https://external.invalid"></iframe>',
 '<div onclick="alert(1)"></div>',
 '<meta http-equiv="refresh" content="0;url=https://external.invalid">',
 '<base href="https://external.invalid">',
 '<svg><script>alert(1)</script></svg>',
 '<a href="javascript:alert(1)">run</a>',
 '<a href="java&#x09;script:alert(1)">run</a>',
 '<a href="java&#x0a;script:alert(1)">run</a>',
 '<a href="java&#x0d;script:alert(1)">run</a>',
 '<img src=" https://assets.example.org/a.png">',
 '<template><script>alert(1)</script></template>',
 '<div id="app"></div>',
 '<link rel="stylesheet" href="../outside.css">'
])('rejects extra execution, redirects, foreign markup and ambiguous resources: %s',fragment=>{
 const p=project();fs.writeFileSync(path.join(p.root,'index.html'),shell(fragment));expect(()=>staticHtml(p.root)).toThrow();expect(inspectRuntime(p,process.cwd()).supported).toBe(false)
})
