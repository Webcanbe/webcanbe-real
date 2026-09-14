import ts from "typescript"
/** Finite no-op legacy configuration. This is parsed data, never imported. */
export function isDefaultTailwindConfig(source:string):boolean {
  if(source.length>16384)return false
  const ast=ts.createSourceFile('tailwind.config.ts',source,ts.ScriptTarget.Latest,true)
  if((ast as ts.SourceFile&{parseDiagnostics:readonly unknown[]}).parseDiagnostics.length||ast.statements.length!==1)return false
  const statement=ast.statements[0]
  if(!ts.isExportAssignment(statement)||statement.isExportEquals)return false
  const literal=(node:ts.Node):unknown=>{
    if(ts.isStringLiteral(node))return node.text
    if(ts.isArrayLiteralExpression(node))return node.elements.map(literal)
    if(ts.isObjectLiteralExpression(node)){
      const result:Record<string,unknown>=Object.create(null)
      for(const prop of node.properties){
        if(!ts.isPropertyAssignment(prop)||!(ts.isIdentifier(prop.name)||ts.isStringLiteral(prop.name)))throw Error('Not literal')
        const key=prop.name.text;if(['__proto__','prototype','constructor'].includes(key)||Object.prototype.hasOwnProperty.call(result,key))throw Error('Ambiguous key')
        result[key]=literal(prop.initializer)
      }return result
    }
    throw Error('Not literal')
  }
  try {
    const value=literal(statement.expression) as Record<string,unknown>
    if(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).some(k=>!['content','theme','plugins'].includes(k)))return false
    const theme=value.theme as Record<string,unknown>|undefined
    if(theme!==undefined&&(!theme||Array.isArray(theme)||typeof theme!=='object'||Object.keys(theme).some(k=>k!=='extend')||theme.extend!==undefined&&(!theme.extend||Array.isArray(theme.extend)||typeof theme.extend!=='object'||Object.keys(theme.extend).length)))return false
    if(value.plugins!==undefined&&(!Array.isArray(value.plugins)||value.plugins.length))return false
    if(value.content!==undefined&&(!Array.isArray(value.content)||value.content.length!==2||new Set(value.content).size!==2||!value.content.includes('./index.html')||!value.content.includes('./src/**/*.{js,ts,jsx,tsx}')))return false
    return true
  }catch{return false}
}
