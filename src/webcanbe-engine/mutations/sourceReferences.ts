import path from "node:path"
import ts from "typescript"
import postcss from "postcss"
import type { FileOperation } from "../core/types"
import { contentHash, SourceConflict } from "./durableSource"
const extensions=[".tsx",".jsx",".ts",".js",".mts",".cts",".mjs",".cjs",".css",".json"]
type Reference={start:number;end:number;value:string;quote:string}
/** Finite source-aware move transform. Never rewrites a package specifier. */
export function resolveSourceReference(from:string,specifier:string,files:ReadonlySet<string>,aliases:Record<string,string>={}):string|undefined {
  const name=specifier.split(/[?#]/,1)[0]
  const alias=Object.keys(aliases).sort((a,b)=>b.length-a.length).find(a=>name===a||name.startsWith(a+"/"))
  const candidate=name.startsWith(".")?path.posix.normalize(path.posix.join(path.posix.dirname(from),name)):alias?path.posix.normalize(aliases[alias]+name.slice(alias.length)):undefined
  if(!candidate)return
  if(candidate.startsWith("../")||candidate.startsWith("/"))throw new SourceConflict("Source reference escapes the project.")
  if(files.has(candidate))return candidate
  const possible=[...extensions.map(ext=>candidate+ext),...extensions.map(ext=>candidate+"/index"+ext)].filter(p=>files.has(p))
  if(possible.length>1)throw new SourceConflict("Ambiguous source reference: "+specifier)
  return possible[0]
}
function scriptReferences(file:string,source:string):Reference[]{
  const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true),result:Reference[]=[]
  if((ast as ts.SourceFile&{parseDiagnostics:readonly unknown[]}).parseDiagnostics.length)throw new SourceConflict("Cannot rewrite syntactically invalid source.")
  const add=(node:ts.Node|undefined)=>{
    if(!node||!ts.isStringLiteralLike(node))return
    const start=node.getStart(ast),raw=source.slice(start,node.end)
    if(raw.includes("\\"))throw new SourceConflict("Escaped source reference requires an explicit Code edit.")
    result.push({start:start+1,end:node.end-1,value:node.text,quote:raw[0]})
  }
  let urlShadowed=false,requireShadowed=false
  const mark=(name:ts.BindingName|ts.DeclarationName|undefined)=>{
    if(!name)return
    if(ts.isIdentifier(name)){if(name.text==='URL')urlShadowed=true;if(name.text==='require')requireShadowed=true}
    else if(ts.isObjectBindingPattern(name)||ts.isArrayBindingPattern(name))for(const element of name.elements)if(ts.isBindingElement(element))mark(element.name)
  }
  const bindings=(node:ts.Node)=>{
    if(ts.isVariableDeclaration(node)||ts.isParameter(node)||ts.isFunctionDeclaration(node)||ts.isFunctionExpression(node)||ts.isClassDeclaration(node)||ts.isClassExpression(node)||ts.isImportClause(node)||ts.isImportSpecifier(node)||ts.isNamespaceImport(node)||ts.isImportEqualsDeclaration(node)||ts.isEnumDeclaration(node)||ts.isModuleDeclaration(node))mark(node.name)
    ts.forEachChild(node,bindings)
  };bindings(ast)
  const visit=(node:ts.Node)=>{
    if(ts.isImportDeclaration(node)||ts.isExportDeclaration(node))add(node.moduleSpecifier)
    else if(ts.isImportEqualsDeclaration(node)&&ts.isExternalModuleReference(node.moduleReference))add(node.moduleReference.expression)
    else if(ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||!requireShadowed&&ts.isIdentifier(node.expression)&&node.expression.text==='require')){
      if(node.arguments.length===1&&ts.isStringLiteralLike(node.arguments[0]))add(node.arguments[0])
      else throw new SourceConflict("Dynamic module references require explicit Code reconciliation before a move.")
    }else if(!urlShadowed&&ts.isNewExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='URL'&&node.arguments?.length===2&&node.arguments[1].getText(ast)==='import.meta.url'){
      if(ts.isStringLiteralLike(node.arguments[0]))add(node.arguments[0]);else throw new SourceConflict("Dynamic asset references require explicit Code reconciliation before a move.")
    }
    ts.forEachChild(node,visit)
  };visit(ast);return result
}
// CSS is parsed into declarations/import rules first; the value scanner handles
// only literal url() and quoted @import tokens, retaining exact raw source spans.
function cssReferences(source:string):Reference[]{
  const root=postcss.parse(source),refs:Reference[]=[]
  const scan=(value:string,offset:number,importRule=false)=>{
    let i=0
    const whitespace=()=>{while(i<value.length&&/\s/.test(value[i]))i++}
    const literal=()=>{const quote=value[i],start=++i;while(i<value.length&&value[i]!==quote){if(value[i]==='\\')throw new SourceConflict("Escaped CSS URL requires explicit Code reconciliation.");i++}if(i===value.length)throw new SourceConflict("Unterminated CSS reference.");refs.push({start:offset+start,end:offset+i,value:value.slice(start,i),quote});i++}
    whitespace();if(importRule&&(value[i]==='"'||value[i]==="'")){literal();return}
    while(i<value.length){
      if(value[i]==='/'&&value[i+1]==='*'){const end=value.indexOf('*/',i+2);if(end<0)throw new SourceConflict("Unterminated CSS comment.");i=end+2;continue}
      if(value[i]==='"'||value[i]==="'"){const quote=value[i++];while(i<value.length&&value[i]!==quote){if(value[i]==='\\')i++;i++}i++;continue}
      if(value.slice(i,i+4).toLowerCase()==='url('&&(i===0||!/[\w-]/.test(value[i-1]))){i+=4;whitespace();if(value[i]==='"'||value[i]==="'"){literal();whitespace();if(value[i]!==')')throw new SourceConflict("Dynamic CSS URL requires Code reconciliation.");i++;continue}
        const start=i;while(i<value.length&&value[i]!==')'){if(value[i]==='\\'||value[i]==='(')throw new SourceConflict("Dynamic CSS URL requires Code reconciliation.");i++}
        if(i===value.length)throw new SourceConflict("Unterminated CSS URL.");const raw=value.slice(start,i),trimmed=raw.trim();refs.push({start:offset+start,end:offset+start+trimmed.length,value:trimmed,quote:''});i++;continue
      }i++
    }
  }
  root.walkDecls(node=>{const offset=node.source?.start?.offset;if(offset===undefined)throw new SourceConflict("Missing CSS source range.");const raw=node.raws.value?.raw??node.value;scan(raw,offset+node.prop.length+(node.raws.between??':').length)})
  root.walkAtRules('import',node=>{const offset=node.source?.start?.offset;if(offset===undefined)throw new SourceConflict("Missing CSS import range.");scan(node.params,offset+1+node.name.length+(node.raws.afterName??' ').length,true)})
  return refs
}
export function rewriteRenameImports(before:Map<string,string>,operations:FileOperation[],aliases:Record<string,string>,allPaths:ReadonlySet<string>=new Set(before.keys())):FileOperation[]{
  if(!operations.length||operations.some(op=>op.kind!=='rename'||op.content!==undefined))throw new SourceConflict("Automatic references require rename-only operations; review other changes in Code.")
  const moves=new Map(operations.map(op=>[op.file,(op as Extract<FileOperation,{kind:'rename'}>).to])),result=operations.map(op=>({...op})),known=new Set([...allPaths,...before.keys()])
  if(moves.size!==operations.length||new Set(moves.values()).size!==moves.size)throw new SourceConflict("Ambiguous source moves.")
  for(const[oldFile,source]of before){
    if(!/\.(?:[cm]?[jt]sx?|css)$/.test(oldFile))continue
    const finalFile=moves.get(oldFile)??oldFile,refs=oldFile.endsWith('.css')?cssReferences(source):scriptReferences(oldFile,source),patches:Array<{start:number;end:number;text:string}>=[]
    for(const ref of refs){
      if(/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(ref.value))continue
      const resolved=resolveSourceReference(oldFile,ref.value,known,aliases)
      if(!resolved){if(ref.value.startsWith('.')&&finalFile!==oldFile)throw new SourceConflict("Unresolved reference in moved source: "+ref.value);continue}
      const target=moves.get(resolved)??resolved
      if(target===resolved&&finalFile===oldFile)continue
      const suffix=ref.value.slice(ref.value.split(/[?#]/,1)[0].length)
      let value=path.posix.relative(path.posix.dirname(finalFile),target);if(!value.startsWith('.'))value='./'+value
      value+=suffix
      if(/["'`\\\s]/.test(value))throw new SourceConflict("Move target requires explicit escaped-source reconciliation.")
      if(source.slice(ref.start,ref.end)!==ref.value)throw new SourceConflict("Reference source range changed.")
      patches.push({start:ref.start,end:ref.end,text:value})
    }
    if(!patches.length)continue
    let content=source;for(const patch of patches.sort((a,b)=>b.start-a.start))content=content.slice(0,patch.start)+patch.text+content.slice(patch.end)
    if(finalFile!==oldFile){const op=result.find(op=>op.file===oldFile)!;if(op.kind!=='rename')throw new SourceConflict('Missing move');op.content=content}
    else result.push({kind:'update',file:oldFile,expectedHash:contentHash(source),content})
  }
  if(result.length>100)throw new SourceConflict("Move exceeds the atomic source-operation limit.")
  return result
}
