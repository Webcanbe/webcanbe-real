import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { randomUUID } from "node:crypto"
import { afterEach, describe, expect, it } from "vitest"
import { semanticResult, semanticSnapshot } from "./runtime/semanticTypecheck"
import { LocalLimaRunnerProvider } from "./runtime/localLimaRunner"
import { detectProject } from "./runtime/projectRegistry"
import { MutationHistory } from "./mutations/sourceMutations"
import { validateSource } from "./mutations/sourceValidation"
const roots:string[]=[]
afterEach(()=>{for(const dir of roots.splice(0))fs.rmSync(dir,{recursive:true,force:true})})
function project(react="18"){
  const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"wcb-semantic-")));roots.push(root);fs.cpSync('fixtures/independent/vite-react'+react+'-ts',root,{recursive:true})
  const files=new Map<string,string>();for(const entry of fs.readdirSync(path.join(root,'src'),{recursive:true,withFileTypes:true}))if(entry.isFile()&&/\.(?:tsx?|jsx?|json|css)$/.test(entry.name)){const file=path.join(entry.parentPath,entry.name);files.set(path.relative(root,file),fs.readFileSync(file,'utf8'))}
  return {p:{id:randomUUID(),name:'AUTHORED semantic validation',root,sourceRoot:path.join(root,'src'),imported:true,detection:detectProject(root,process.cwd()),history:new MutationHistory()},files}
}
it("keeps transpilation distinct from semantics and never runs config or changes source",async()=>{
  const {p,files}=project(),before=new Map(files);files.set('src/Error.ts','export const count: number = "not a number"')
  expect((await validateSource(files)).passed).toBe(true)
  const snapshot=semanticSnapshot(p,process.cwd(),files),input=JSON.parse(Buffer.from(snapshot.files[0].base64,'base64').toString())
  expect(input.files.find((x:any)=>x.path==='src/Error.ts').text).toContain('"not a number"');expect(input.options.moduleDetection).toBe('force')
  expect(input.files.some((x:any)=>x.path==='node_modules/@types/react/index.d.ts')).toBe(true)
  for(const[file,text]of before)expect(fs.readFileSync(path.join(p.root,file),'utf8')).toBe(text)
  fs.writeFileSync(path.join(p.root,'tsconfig.app.json'),'{"compilerOptions":{"plugins":[{"name":"./must-not-run.js"}]},"include":["src"]}')
  fs.writeFileSync(path.join(p.root,'must-not-run.js'),'throw new Error("EXECUTED")')
  expect(()=>semanticSnapshot(p,process.cwd(),files)).toThrow('admitted deterministic')
})
it("does not silently claim support for unknown semantic options or a missing dedicated profile",()=>{
  const {p,files}=project();fs.writeFileSync(path.join(p.root,'tsconfig.app.json'),'{"compilerOptions":{"unknownCheckerPlugin":true},"include":["src"]}')
  expect(()=>semanticSnapshot(p,process.cwd(),files)).toThrow('Unsupported semantic compiler option')
  expect(()=>semanticSnapshot(p,p.root,files)).toThrow()
})
it("projects and bounds semantic diagnostics, rejects contradictory and forged success",()=>{
  expect(semanticResult({level:'semantic',toolchain:'typescript@5.9.3',passed:false,diagnostics:[{file:'src/A.ts',message:'Not assignable',line:2,column:3,secret:'not forwarded'}]})).toEqual({level:'semantic',passed:false,diagnostics:[{file:'src/A.ts',message:'Not assignable',line:2,column:3}]})
  for(const value of [{level:'compile',passed:true,diagnostics:[]},{level:'semantic',toolchain:'other',passed:true,diagnostics:[]},{level:'semantic',toolchain:'typescript@5.9.3',passed:true,diagnostics:[{file:'A.ts',message:'Error'}]},{level:'semantic',toolchain:'typescript@5.9.3',passed:false,diagnostics:[{file:'A.ts',message:'x'.repeat(1001)}]}])expect(()=>semanticResult(value)).toThrow()
})
;(process.env.WCB_SEMANTIC_TEST==='1'?describe:describe.skip)('isolated pinned semantic compiler',()=>{
  it.each(['18','19'])('checks real React%s cross-file types and diagnoses a transpiling type error',async react=>{
    const {p,files}=project(react),runner=new LocalLimaRunnerProvider(process.cwd())
    const run=async()=>{const snapshot=semanticSnapshot(p,process.cwd(),files),generation=randomUUID(),e=await runner.open({purpose:'semantic-typescript-v1',generation,origin:'http://wcb-'+generation+'.preview.invalid',revision:'rev_'+randomUUID(),expiresAt:Date.now()+60000,route:'/',network:{external:'deny'},snapshot},new AbortController().signal);try{return semanticResult(await e.check!())}finally{await e.close()}}
    const initial=await run();expect(initial.passed,JSON.stringify(initial.diagnostics)).toBe(true)
    files.set('src/value.ts','export const value: number = "wrong"')
    expect((await validateSource(files)).passed).toBe(true)
    const error=await run();expect(error.passed).toBe(false);expect(error.diagnostics.some(d=>d.file==='src/value.ts'&&d.message.includes('not assignable'))).toBe(true)
  },20000)
})
