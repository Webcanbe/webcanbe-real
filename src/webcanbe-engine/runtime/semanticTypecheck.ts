import fs from "node:fs"
import path from "node:path"
import { parse, type ParseError } from "jsonc-parser"
import type { SourceValidation } from "../core/types"
import type { ProjectRecord } from "./projectRegistry"
import { inspectRuntime } from "./runtimeCompatibility"
import { snapshotPreview, type PreviewSnapshot } from "./controlledPreview"
const allowed = new Set("moduleDetection erasableSyntaxOnly noUncheckedSideEffectImports resolvePackageJsonExports resolvePackageJsonImports allowArbitraryExtensions target lib jsx strict skipLibCheck esModuleInterop allowSyntheticDefaultImports forceConsistentCasingInFileNames module moduleResolution resolveJsonModule isolatedModules verbatimModuleSyntax allowImportingTsExtensions noUnusedLocals noUnusedParameters noFallthroughCasesInSwitch noUncheckedIndexedAccess exactOptionalPropertyTypes useDefineForClassFields baseUrl paths types allowJs checkJs strictNullChecks noImplicitAny noImplicitReturns noPropertyAccessFromIndexSignature useUnknownInCatchVariables".split(" "))
const noEmitOptions = new Set("noEmit noEmitOnError tsBuildInfoFile outDir declaration declarationMap sourceMap composite incremental".split(" "))
/** Static data preparation only; actual semantic work runs in the isolated job. */
export function semanticSnapshot(project: ProjectRecord, applicationRoot: string, source: Map<string,string>): PreviewSnapshot {
  const report = inspectRuntime(project, applicationRoot)
  if (!report.supported) throw new Error("Semantic checking requires an admitted deterministic runtime profile.")
  const options: Record<string,unknown> = {}, notices: string[] = []
  for (const item of report.configuration.filter(item => item.classification === "statically-supported" && /(?:ts|js)config.*\.json$/.test(item.file))) {
    const errors: ParseError[] = [], config = parse(fs.readFileSync(path.join(project.root,item.file),"utf8"),errors)
    if (errors.length || !config || typeof config !== "object" || config.extends) throw new Error("Unsupported semantic configuration.")
    if (config.references && !config.include) continue
    if (Array.isArray(config.include) && !config.include.some((s:unknown)=>typeof s==="string" && /^src(?:[/*]|$)/.test(s))) { notices.push(item.file+": outside src checking scope"); continue }
    for (const [key,value] of Object.entries(config.compilerOptions ?? {})) {
      if (noEmitOptions.has(key)) { notices.push(key+": no-emit checker does not produce files"); continue }
      if (!allowed.has(key)) throw new Error("Unsupported semantic compiler option: "+key)
      if (key in options && JSON.stringify(options[key]) !== JSON.stringify(value)) throw new Error("Conflicting semantic compiler option: "+key)
      options[key]=value
    }
  }
  const files=Array.from(source,([name,text])=>({path:name,text}));let size=files.reduce((n,f)=>n+Buffer.byteLength(f.text),0)
  const profile=fs.realpathSync(path.join(applicationRoot,"runtime-profiles",report.profile,"node_modules"))
  const add=(name:string,file:string)=>{
    const stat=fs.lstatSync(file),real=fs.realpathSync(file)
    if (!stat.isFile()||stat.isSymbolicLink()||!real.startsWith(profile+path.sep)||stat.size>2*1024*1024) throw new Error("Invalid dedicated type declaration.")
    const text=fs.readFileSync(file,"utf8");size+=Buffer.byteLength(text)
    if(size>28*1024*1024||files.length>=8192)throw new Error("Semantic declaration resource bound exceeded.")
    files.push({path:"node_modules/"+name,text})
  }
  // Only data from the selected operator-owned profile. No editor dependency
  // resolution fallback or uploaded declaration/config execution is possible.
  for(const entry of fs.readdirSync(profile,{recursive:true,withFileTypes:true})) {
    if(!entry.isFile()||!(entry.name==="package.json"||/\.d\.[cm]?ts$/.test(entry.name)))continue
    const file=path.join(entry.parentPath,entry.name),name=path.relative(profile,file).split(path.sep).join("/")
    // Standard libraries come only from the pinned checker installation.
    if(/^typescript\/lib\/lib\..*\.d\.ts$/.test(name))continue
    add(name,file)
  }
  const body=Buffer.from(JSON.stringify({schema:1,files,options,scope:"src",notices}))
  return snapshotPreview({html:"",files:new Map([["/_wcb/typecheck.json",{contentType:"application/json",body}]])})
}
export function semanticResult(value: unknown): SourceValidation {
  const v=value as {level?:unknown;passed?:unknown;diagnostics?:unknown;toolchain?:unknown}
  if(!v||v.level!=="semantic"||typeof v.passed!=="boolean"||v.toolchain!=="typescript@5.9.3"||!Array.isArray(v.diagnostics)||v.diagnostics.length>101)throw new Error("Invalid semantic checker result.")
  const diagnostics=v.diagnostics.map((d:unknown)=>{
    const item=d as {file?:unknown;message?:unknown;line?:unknown;column?:unknown}
    if(!item||typeof item.file!=="string"||item.file.length>600||typeof item.message!=="string"||item.message.length>1000)throw new Error("Invalid semantic diagnostic.")
    return {file:item.file,message:item.message,...(Number.isSafeInteger(item.line)&&Number(item.line)>0?{line:Number(item.line)}:{}),...(Number.isSafeInteger(item.column)&&Number(item.column)>0?{column:Number(item.column)}:{})}
  })
  if(v.passed&&diagnostics.length)throw new Error("Contradictory semantic result.")
  return {level:"semantic",passed:v.passed,diagnostics}
}
