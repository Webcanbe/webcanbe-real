import fs from 'node:fs'
import {createHash} from 'node:crypto'
import path from 'node:path'
import ts from 'typescript'
import postcss from 'postcss'
import { Worker } from 'node:worker_threads'
import { CSS_WORKER_SOURCE } from './cssWorkerSource'
import { isWithin, safeArchivePath } from './projectRegistry'

export type CssPlan = { kind: 'tailwind3' | 'unocss'; files: string[]; config: Record<string, any>; autoprefixer?: Record<string, any> }
export const UNO_FORMS_V1_MARKER = Object.freeze({
  name: '@julr/unocss-preset-forms',
  version: '1.0.0',
  integrity: 'sha512-A0Q40kazPG7CblrXyMNMBYpOPyUncmNTS+65XzaCCEZ8r5v+W5qEp+cI0SKG/XwCsw0aE8zeaB3IvETJLGkWgw==',
})
export const UNO_V66_MARKER = Object.freeze({
  name: 'unocss',
  version: '66.0.0',
  integrity: 'sha512-SHstiv1s7zGPSjzOsADzlwRhQM+6817+OqQE3Fv+N/nn2QLNx1bi3WXybFfz5tWkzBtyTZlwdPmeecsIs1yOCA==',
})
export const UNO_V65_MARKER = Object.freeze({
  name: 'unocss',
  version: '65.5.0',
  integrity: 'sha512-dLTW89YK+5KCcB3vG/wxiwdpejkLLmZlK9hjWmP52sdeUFcmywc+/khD2/nid7or8dL3YCv1gwoyvnA7JRCwjA==',
})
const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)
const object = (v: any) => v && typeof v === 'object' && !Array.isArray(v)
const fail = (message: string): never => { throw Error(message) }
const sans = ['ui-sans-serif','system-ui','sans-serif','"Apple Color Emoji"','"Segoe UI Emoji"','"Segoe UI Symbol"','"Noto Color Emoji"']

/** Interpret a finite module grammar. No imported module, require call or user function is executed. */
export function cssData(code: string, kind: 'tailwind3' | 'unocss' | 'postcss') {
  if (Buffer.byteLength(code) > 256 * 1024) fail('CSS configuration exceeds its data limit.')
  const source = ts.createSourceFile('config.ts', code, ts.ScriptTarget.Latest, true)
  if ((source as any).parseDiagnostics.length) fail('Invalid CSS configuration syntax.')
  const bindings = new Map<string,string>(), constants = new Map<string,ts.Expression>(), active = new Set<string>(), tokens = new WeakSet<object>()
  const bind = (name:string,value:string) => { if(bindings.has(name)||constants.has(name))fail('Duplicate CSS binding.');bindings.set(name,value) }
  for(const statement of source.statements) {
    if(ts.isImportDeclaration(statement)) {
      if(!ts.isStringLiteral(statement.moduleSpecifier)||statement.importClause?.isTypeOnly)fail('Unsupported CSS import.')
      const module=(statement.moduleSpecifier as ts.StringLiteral).text, clause=statement.importClause
      if(!['unocss','@julr/unocss-preset-forms','tailwindcss/defaultTheme'].includes(module)||!clause||statement.attributes)fail('Unknown CSS configuration import; preserved but not applied.')
      if(clause?.name)bind(clause.name.text,module+':default')
      if(clause?.namedBindings) { if(!ts.isNamedImports(clause.namedBindings))fail('Unsupported CSS namespace import.');for(const item of (clause.namedBindings as ts.NamedImports).elements)bind(item.name.text,module+':'+(item.propertyName?.text??item.name.text)) }
    } else if(ts.isVariableStatement(statement)) {
      if(!(statement.declarationList.flags&ts.NodeFlags.Const)||statement.modifiers?.length)fail('Only finite const CSS bindings are supported.')
      for(const d of statement.declarationList.declarations) { if(!ts.isIdentifier(d.name)||!d.initializer||constants.has(d.name.getText())||bindings.has(d.name.getText())||constants.size>=64)fail('Unsupported CSS binding.'); constants.set(d.name.getText(),d.initializer!) }
    }
  }
  let visits=0
  const token=(name:string,options:any={})=>{const result={adapter:name,options};tokens.add(result);return result}
  const value=(node:ts.Expression):any=>{
    if(++visits>4000||active.size>32)fail('CSS configuration complexity exceeded.')
    if(ts.isParenthesizedExpression(node)||ts.isAsExpression(node)||ts.isSatisfiesExpression(node))return value(node.expression)
    if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))return node.text.length<=1024?node.text:fail('CSS string too long.')
    if(ts.isNumericLiteral(node))return Number(node.text)
    if(node.kind===ts.SyntaxKind.TrueKeyword)return true
    if(node.kind===ts.SyntaxKind.FalseKeyword)return false
    if(ts.isIdentifier(node)&&constants.has(node.text)) {if(active.has(node.text))fail('Cyclic CSS constants.');active.add(node.text);try{return value(constants.get(node.text)!)}finally{active.delete(node.text)}}
    if(ts.isArrayLiteralExpression(node))return node.elements.flatMap(n=>ts.isSpreadElement(n)?(Array.isArray(value(n.expression))?value(n.expression):fail('Only literal array spreads are supported.')):[value(n as ts.Expression)])
    if(ts.isObjectLiteralExpression(node)) {
      const result:Record<string,any>=Object.create(null)
      for(const p of node.properties) {if(!ts.isPropertyAssignment(p)||!ts.isIdentifier(p.name)&&!ts.isStringLiteral(p.name))fail('Computed/spread/function CSS configuration is unsupported.');const property=p as ts.PropertyAssignment,key=(property.name as ts.Identifier).text;if(own(result,key)||['__proto__','constructor','prototype'].includes(key))fail('Unsafe/duplicate CSS key.');result[key]=value(property.initializer)}return result
    }
    if(ts.isPropertyAccessExpression(node)&&node.name.text==='sans'&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='fontFamily') {
      const base=value(node.expression.expression)
      if(tokens.has(base)&&base.adapter==='tailwindcss/defaultTheme')return [...sans]
    }
    if(ts.isIdentifier(node)&&bindings.get(node.text)==='tailwindcss/defaultTheme:default')return token('tailwindcss/defaultTheme')
    if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)) {
      const name=node.expression.text,binding=bindings.get(name)
      if(name==='require'&&!bindings.has(name)&&!constants.has(name)&&node.arguments.length===1&&ts.isStringLiteral(node.arguments[0])&&kind==='tailwind3') {
        const module=node.arguments[0].text
        if(['tailwindcss/defaultTheme','@tailwindcss/typography','tailwindcss-animate'].includes(module))return token(module)
      }
      if(binding==='unocss:defineConfig'&&kind==='unocss'&&node.arguments.length===1)return value(node.arguments[0])
      if(kind==='unocss'&&['unocss:presetUno','unocss:presetAttributify','@julr/unocss-preset-forms:presetForms','unocss:transformerDirectives','unocss:transformerVariantGroup'].includes(binding??'')&&node.arguments.length<=1) {
        if(binding==='@julr/unocss-preset-forms:presetForms'&&node.arguments.length)fail('Only zero-argument presetForms() is supported by the fixed adapter.')
        const options=node.arguments.length?value(node.arguments[0]):{}
        if(!object(options)||Object.keys(options).some(k=>binding!=='unocss:presetUno'||k!=='dark')||options.dark!==undefined&&!['class','media'].includes(options.dark))fail('Unsupported Uno preset/transformer options.')
        return token(binding!.split(':')[1],options)
      }
    }
    return fail('Executable CSS configuration is preserved but not applied.')
  }
  const exports:ts.Expression[]=[]
  for(const statement of source.statements) {
    if(ts.isExportAssignment(statement)&&!statement.isExportEquals)exports.push(statement.expression)
    else if(ts.isExpressionStatement(statement)&&ts.isBinaryExpression(statement.expression)&&statement.expression.operatorToken.kind===ts.SyntaxKind.EqualsToken&&statement.expression.left.getText(source)==='module.exports'&&!bindings.has('module')&&!constants.has('module'))exports.push(statement.expression.right)
    else if(!ts.isImportDeclaration(statement)&&!ts.isVariableStatement(statement))fail('Executable CSS statements are unsupported.')
  }
  if(exports.length!==1)fail('A single static CSS configuration export is required.')
  const config=value(exports[0]);for(const [name]of constants)value(ts.factory.createIdentifier(name))
  if(!object(config))fail('CSS configuration must be an object.')
  if(kind==='tailwind3') {
    if(Object.keys(config).some(k=>!['content','theme','plugins','darkMode','prefix','important','safelist'].includes(k)))fail('Unsupported Tailwind configuration field.')
    if(config.content!==undefined&&(!Array.isArray(config.content)||config.content.length>64||config.content.some((v:any)=>typeof v!=='string'||!contentPattern(v))))fail('Only bounded local Tailwind content paths are supported.')
    if(config.theme!==undefined&&(!object(config.theme)||Object.keys(config.theme).some(k=>!['extend','screens','container','colors','spacing','fontFamily','fontSize','borderRadius'].includes(k))))fail('Unsupported static Tailwind theme.')
    if(config.darkMode!==undefined&&!['class','media'].includes(config.darkMode)||config.prefix!==undefined&&!/^[a-z][a-z0-9-]{0,31}-$/.test(config.prefix)||config.important!==undefined&&typeof config.important!=='boolean')fail('Unsupported Tailwind mode/prefix.')
    if(config.safelist!==undefined&&(!Array.isArray(config.safelist)||config.safelist.length>512||config.safelist.some((v:any)=>typeof v!=='string'||v.length>128)))fail('Only bounded literal Tailwind safelist entries are supported.')
    if(config.plugins!==undefined&&(!Array.isArray(config.plugins)||config.plugins.length>2||config.plugins.some((p:any)=>!object(p)||!tokens.has(p)||!['@tailwindcss/typography','tailwindcss-animate'].includes(p.adapter))))fail('Unknown Tailwind plugins are preserved but not applied.')
    config.plugins=(config.plugins??[]).map((p:any)=>p.adapter)
  } else if(kind==='unocss') {
    if(Object.keys(config).some(k=>!['presets','transformers','rules','shortcuts','safelist','theme'].includes(k)))fail('Unsupported UnoCSS configuration; transforms/functions require a separately implemented adapter.')
    if(config.presets!==undefined&&(!Array.isArray(config.presets)||config.presets.length>3||config.presets.some((p:any)=>!object(p)||!tokens.has(p)||!['presetUno','presetAttributify','presetForms'].includes(p.adapter))))fail('Only trusted Uno/Attributify/Forms presets are supported.')
    if(config.transformers!==undefined&&(!Array.isArray(config.transformers)||config.transformers.length>2||config.transformers.some((p:any)=>!object(p)||!tokens.has(p)||!['transformerDirectives','transformerVariantGroup'].includes(p.adapter))))fail('Only trusted Uno transformers are supported.')
    for(const group of ['presets','transformers'])if(new Set((config[group]??[]).map((p:any)=>p.adapter)).size!==(config[group]??[]).length)fail('Duplicate Uno adapter.')
    if(config.rules!==undefined&&(!Array.isArray(config.rules)||config.rules.length>256||config.rules.some((r:any)=>!Array.isArray(r)||r.length!==2||typeof r[0]!=='string'||!object(r[1])||Object.entries(r[1]).some(([k,v])=>!/^--?[a-z-]+$|^[a-z][a-z-]*$/.test(k)||typeof v!=='string'))))fail('Only literal Uno rule declarations are supported.')
    if(config.shortcuts!==undefined&&(!object(config.shortcuts)||Object.entries(config.shortcuts).some(([k,v])=>k.length>128||typeof v!=='string'||v.length>512)))fail('Only literal Uno shortcuts are supported.')
    if(config.safelist!==undefined&&(!Array.isArray(config.safelist)||config.safelist.length>512||config.safelist.some((v:any)=>typeof v!=='string'||v.length>128)))fail('Invalid Uno safelist.')
    if(config.theme!==undefined&&!object(config.theme))fail('Invalid Uno theme.')
  } else {
    if(Object.keys(config).some(k=>k!=='plugins')||!object(config.plugins)||Object.keys(config.plugins).some(k=>!['tailwindcss','autoprefixer'].includes(k)))fail('Unknown PostCSS plugins are preserved but not applied.')
    for(const [name,options]of Object.entries(config.plugins) as Array<[string,any]>) {
      if(!object(options)||name==='tailwindcss'&&Object.keys(options).length)fail('Unsupported PostCSS options.')
      if(name==='autoprefixer'&&(Object.keys(options).some(k=>!['grid','flexbox','remove','add','cascade','overrideBrowserslist'].includes(k))||Object.entries(options).some(([k,v])=>k==='overrideBrowserslist'?!Array.isArray(v)||v.length>16||v.some(x=>typeof x!=='string'||x.length>80||!/^(?:[><=]{1,2} ?[0-9.]+%|last [1-9][0-9]? (?:[a-zA-Z]+ )?versions?|not dead|Firefox ESR|(?:Chrome|Firefox|Safari|Edge|iOS|Android|Opera|IE) [0-9.]+)$/i.test(x)):k==='grid'?![false,'autoplace','no-autoplace'].includes(v as any):k==='flexbox'?![true,false,'no-2009'].includes(v as any):typeof v!=='boolean')))fail('Unsupported Autoprefixer options.')
    }
  }
  return config
}
function contentPattern(pattern:string):RegExp|undefined {
  pattern=pattern.replace(/^\.\//,'')
  if(pattern==='index.html')return /^index\.html$/
  if(/^src\/(?:[a-zA-Z0-9_-]+\/)*(?:\*\*\/)?\*\.(?:[jt]sx?|html|\{[a-z,]+\})$/.test(pattern)) {
    const ext=pattern.slice(pattern.lastIndexOf('.')+1), extensions=ext.startsWith('{')?ext.slice(1,-1).split(','):[ext]
    if(extensions.some(e=>!['js','jsx','ts','tsx','html'].includes(e)))return
    const prefix=pattern.slice(0,pattern.indexOf('*')).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
    return new RegExp('^'+prefix+(pattern.includes('**/')?'(?:[^/]+/)*':'')+'[^/]+\\.(?:'+extensions.join('|')+')$')
  }
}
export function inspectCssPlan(root:string,declared:Record<string,any>,profile:string):CssPlan|undefined {
  const names=fs.readdirSync(root), pick=(prefix:string)=>{const all=names.filter(n=>new RegExp('^'+prefix+'\\.config\\.[cm]?[jt]s$').test(n));if(all.length>1)fail('Ambiguous CSS configuration.');return all[0]}
  const tailwind=pick('tailwind'),post=pick('postcss'),uno=pick('uno'),kind=declared.unocss?'unocss':declared.tailwindcss&&['react18-vite5-css-v1','react18-vite5-tailwind3-query-radix-v1'].includes(profile)?'tailwind3':undefined
  if(!kind)return
  if(kind==='unocss'&&!['react19-vite6-uno-v1','react19-vite6-uno65-v1','react19-vite6-uno66-forms-v1'].includes(profile))fail('A pinned UnoCSS operator profile is required.')
  if(kind==='unocss'&&(tailwind||post))fail('Combined UnoCSS/PostCSS configurations are unsupported.')
  const read=(name:string,k:'tailwind3'|'unocss'|'postcss')=>{const file=fs.realpathSync(path.join(root,name));if(!isWithin(root,file))fail('CSS configuration escaped its project.');return cssData(fs.readFileSync(file,'utf8'),k)}
  const config=(kind==='tailwind3'?tailwind:uno)?read((kind==='tailwind3'?tailwind:uno)!,kind):{}
  if(config.presets?.some((p:any)=>p.adapter==='presetForms')&&(!declared[UNO_FORMS_V1_MARKER.name]||!['react19-vite6-uno-v1','react19-vite6-uno65-v1','react19-vite6-uno66-forms-v1'].includes(profile)))fail('Forms requires the declared forms1 marker and a supported pinned Uno compiler profile.')
  const postConfig=post?read(post,'postcss'):undefined
  if(kind==='tailwind3'&&postConfig&&!own(postConfig.plugins,'tailwindcss'))fail('Tailwind requires its declared PostCSS transformation.')
  for(const name of [...(config.plugins??[]).filter((p:any)=>typeof p==='string'),...(postConfig?Object.keys(postConfig.plugins):[])])if(!declared[name])fail('CSS adapter dependency must be declared: '+name)
  return {kind,files:[tailwind,post,uno].filter((f):f is string=>!!f),config,autoprefixer:postConfig?.plugins.autoprefixer}
}
export function validateFiniteCss(code:string,plan:CssPlan) {
  const root=postcss.parse(code)
  if(plan.kind==='unocss'&&!plan.config.transformers?.some((p:any)=>p.adapter==='transformerDirectives'))root.walkDecls(decl=>{if(['--at-apply','--uno-apply','--uno'].includes(decl.prop)||/\btheme\(/.test(decl.value))fail('Uno directive syntax requires its declared transformer.')})
  root.walkAtRules(rule=>{
    if(['config','plugin','source','theme','reference','utility','variant','custom-variant'].includes(rule.name)||plan.kind==='unocss'&&(['tailwind','unocss'].includes(rule.name)||['apply','screen'].includes(rule.name)&&!plan.config.transformers?.some((p:any)=>p.adapter==='transformerDirectives')))fail('Unsupported CSS scanning/plugin directive.')
    if(rule.name==='tailwind'&&!['base','components','utilities'].includes(rule.params.trim()))fail('Unknown Tailwind layer.')
  })
}
export async function cssCompiler(root:string,profileRoot:string,plan:CssPlan,prepareSource=(_file:string,code:string)=>code,runtimeRoot=".",sourceDirectory?:string) {
  const sources:Array<{raw:string;extension:string;file:string}>=[];let bytes=0
  for(const file of [path.posix.join(runtimeRoot,'index.html'),...fs.readdirSync(root,{recursive:true}).filter((f):f is string=>typeof f==='string'&&(!sourceDirectory||f.startsWith(sourceDirectory+'/'))&&/\.(?:[cm]?[jt]sx?|css)$/.test(f)&&!f.split('/').some(p=>['node_modules','.git','.webcanbe'].includes(p)))]) {
    if(!safeArchivePath(file))fail('Invalid CSS candidate path.')
    const absolute=fs.realpathSync(path.join(root,file));if(!isWithin(root,absolute))fail('CSS candidates escaped project.')
    if(!fs.statSync(absolute).isFile()||fs.statSync(absolute).size>2*1024*1024)fail('CSS candidate member limit exceeded.')
    const raw=fs.readFileSync(absolute,'utf8');bytes+=Buffer.byteLength(raw);if(bytes>40*1024*1024||sources.length>=2000)fail('CSS candidate limit exceeded.')
    if(file.endsWith('.css'))validateFiniteCss(raw,plan)
    sources.push({raw:prepareSource(file,raw),extension:path.extname(file).slice(1),file})
  }
  const patterns=(plan.config.content??['./index.html','./src/**/*.{js,ts,jsx,tsx}']).map(contentPattern)
  const candidates=plan.kind==='tailwind3'?sources.filter(s=>patterns.some((p:RegExp)=>p.test(s.file))):sources
  let uno:Promise<CssWorkerResult>|undefined
  const compiled=()=>uno??=runCssWorker({profileRoot,kind:plan.kind,config:plan.config,sources:candidates,code:'/* webcanbe uno entry */'})
  const compile=async(code:string,file?:string)=>{
    validateFiniteCss(code,plan)
    if(plan.kind==='unocss'){
      const result=await compiled()
      if(code==='/* webcanbe uno entry */')return result.css
      const original=sources.find(s=>s.file===file)
      if(original?.raw===code&&result.sources?.[file!])return result.sources[file!]
      return (await runCssWorker({profileRoot,kind:plan.kind,config:plan.config,sources:[{file:'style.css',raw:code}],code})).sources!['style.css']
    }
    return (await runCssWorker({profileRoot,kind:plan.kind,config:plan.config,autoprefixer:plan.autoprefixer,sources:candidates,code})).css
  }
  compile.source=async(file:string,code:string)=>{
    if(plan.kind!=='unocss')return code
    const original=sources.find(s=>s.file===file)
    if(!original||original.raw!==code)fail('Uno source snapshot changed during compilation.')
    return (await compiled()).sources![file]
  }
  const hash=createHash('sha256');for(const source of sources){hash.update(JSON.stringify([source.file,source.raw]))}
  compile.fingerprint=hash.digest('hex')
  return compile
}
type CssWorkerResult={css:string;sources?:Record<string,string>}
let activeWorkers=0
function runCssWorker(data:Record<string,any>):Promise<CssWorkerResult> {
  if(activeWorkers>=2)return Promise.reject(Error('CSS compiler capacity reached.'))
  activeWorkers++
  return new Promise((resolve,reject)=>{
    let done=false
    const worker=new Worker(CSS_WORKER_SOURCE,{eval:true,workerData:data,execArgv:[],env:{NODE_ENV:'production',BROWSERSLIST_IGNORE_OLD_DATA:'true'},resourceLimits:{maxOldGenerationSizeMb:128,maxYoungGenerationSizeMb:16,stackSizeMb:4}})
    const finish=(error?:Error,result?:CssWorkerResult)=>{if(done)return;done=true;clearTimeout(timer);void worker.terminate().finally(()=>{activeWorkers--;error?reject(error):resolve(result!)})}
    const timer=setTimeout(()=>finish(Error('CSS compiler deadline exceeded.')),8000)
    worker.on('message',message=>typeof message.css==='string'?finish(undefined,message):finish(Error('Bounded CSS compilation failed.')))
    worker.on('error',()=>finish(Error('CSS worker resource/error boundary.')))
    worker.on('exit',()=>{if(!done)finish(Error('CSS worker exited without output.'))})
  })
}
