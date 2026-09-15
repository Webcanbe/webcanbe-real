import {afterEach,expect,it} from 'vitest'
import {cssData} from './runtime/staticCss'
import {inspectRuntime} from './runtime/runtimeCompatibility'
import {buildIsolatedHttpPreview} from './runtime/isolatedPreview'
import {detectProject} from './runtime/projectRegistry'
import {MutationHistory} from './mutations/sourceMutations'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {randomUUID} from 'node:crypto'
const dirs:string[]=[]
afterEach(()=>dirs.splice(0).forEach(d=>fs.rmSync(d,{recursive:true,force:true})))
it.each(['tailwind3','unocss'] as const)('compiles unchanged finite %s configuration through a dedicated profile',async kind=>{
 const profile=kind==='tailwind3'?'react18-vite5-css-v1':'react19-vite6-uno-v1',root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'wcb-css-')));dirs.push(root)
 const m=JSON.parse(fs.readFileSync('runtime-profiles/'+profile+'/package.json','utf8'));fs.mkdirSync(path.join(root,'src'));fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({dependencies:m.dependencies}));fs.writeFileSync(path.join(root,'index.html'),'<div id="root"></div><script type="module" src="/src/main.jsx"></script>')
 fs.writeFileSync(path.join(root,'src/main.jsx'),'import {createRoot} from "react-dom/client";import '+JSON.stringify(kind==='tailwind3'?'./style.css':'virtual:uno.css')+';createRoot(document.getElementById("root")).render(<h1 className="text-brand p-4 special">Finite CSS</h1>)')
 const file=kind==='tailwind3'?'tailwind.config.cjs':'uno.config.ts',code=kind==='tailwind3'?`const defaultTheme = require('tailwindcss/defaultTheme');module.exports={content:['./index.html','./src/**/*.{js,ts,jsx,tsx}'],theme:{extend:{colors:{brand:'#123456'},fontFamily:{sans:['Inter',...defaultTheme.fontFamily.sans]}}},plugins:[require('@tailwindcss/typography'),require('tailwindcss-animate')]}`:`import {defineConfig,presetUno} from 'unocss';export default defineConfig({presets:[presetUno()],theme:{colors:{brand:'#123456'}},rules:[['special',{'letter-spacing':'2px'}]]})`
 fs.writeFileSync(path.join(root,file),code)
 if(kind==='tailwind3'){fs.writeFileSync(path.join(root,'src/style.css'),'@tailwind base;@tailwind components;@tailwind utilities;.card{@apply p-4;}');fs.writeFileSync(path.join(root,'postcss.config.cjs'),`module.exports={plugins:{tailwindcss:{},autoprefixer:{overrideBrowserslist:['Safari 12']}}}`)}
 const p={id:randomUUID(),name:'CSS fixture',root,sourceRoot:path.join(root,'src'),imported:true,detection:detectProject(root,process.cwd()),history:new MutationHistory()}
 expect(inspectRuntime(p,process.cwd()).issues).toEqual([]);const preview=await buildIsolatedHttpPreview(p,process.cwd()),css=preview.files.get('/_wcb/app.css')!.body.toString();expect(css).toContain('.text-brand');expect(css).toContain('.p-4');if(kind==='tailwind3')expect(css).toContain('.card');else expect(css).toContain('letter-spacing:2px');expect(fs.readFileSync(path.join(root,file),'utf8')).toBe(code)
})
it.each([
 `module.exports={plugins:[()=>require('node:fs').writeFileSync('/tmp/bad','bad')]}`,
 `const x = fetch('https://evil.example');module.exports={}`,
 `module.exports={content:['../private/**/*']}`,
 `module.exports={plugins:[{adapter:'@tailwindcss/typography',options:{}}]}`,
 `module.exports={theme:{extend:{colors:()=>process.env}}}`,
 `module.exports={content:['./src/**/*.{js,ts,secret}']}`,
 `module.exports={plugins:[require('arbitrary-plugin')]}`,
 `module.exports={__proto__:{polluted:true}}`,
])('refuses arbitrary Tailwind/config execution: %s',code=>expect(()=>cssData(code,'tailwind3')).toThrow())
it('refuses arbitrary PostCSS and Uno plugin/transformer functions',()=>{
 expect(()=>cssData(`module.exports={plugins:{'postcss-import':{}}}`,'postcss')).toThrow('preserved but not applied')
 expect(()=>cssData(`import {defineConfig} from 'unocss';export default defineConfig({rules:[[/x/,()=>({color:'red'})]]})`,'unocss')).toThrow()
 expect(()=>cssData(`import {defineConfig,transformerDirectives} from 'unocss';export default defineConfig({transformers:[transformerDirectives({applyVariable:()=>process.env})]})`,'unocss')).toThrow()
})
it('refuses transitive compiler substitution outside the dedicated toolchain',async()=>{
 const {cssCompiler}=await import('./runtime/staticCss'),root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'wcb-css-confine-')));dirs.push(root);fs.mkdirSync(path.join(root,'src'));fs.writeFileSync(path.join(root,'index.html'),'<div/>');const profile=path.join(root,'profile'),module=path.join(profile,'node_modules/tailwindcss');fs.mkdirSync(module,{recursive:true});fs.writeFileSync(path.join(profile,'package.json'),'{}');fs.writeFileSync(path.join(module,'package.json'),'{"main":"index.cjs"}');fs.writeFileSync(path.join(root,'outside.cjs'),'module.exports=()=>{}');fs.writeFileSync(path.join(module,'index.cjs'),'module.exports=require('+JSON.stringify(path.join(root,'outside.cjs'))+')');const compile=await cssCompiler(root,profile,{kind:'tailwind3',files:[],config:{}});await expect(compile('@tailwind utilities;')).rejects.toThrow('Bounded CSS compilation failed')
})
