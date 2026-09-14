import ts from "typescript"
type Read = (file: string) => string | undefined
type Parse = (file: string, code: string) => ts.SourceFile
/** Finite, non-evaluating trace of immutable primitive exports. Objects, getters,
 * calls, spreads, mutable bindings, packages and ambiguous resolution stay Code. */
export function importedDeclaration(expression: ts.Expression, read: Read, parse: Parse): ts.Node | undefined {
  const resolving = new Set<string>()
  function module(from: string, request: string) {
    if (!request.startsWith(".")) return undefined
    const parts = from.split("/").slice(0,-1)
    for (const part of request.split("/")) { if (part === "..") { if (!parts.length) return undefined; parts.pop() } else if (part && part !== ".") parts.push(part) }
    const base = parts.join("/")
    const exact = read(base)
    if (exact !== undefined && /\.(?:[cm]?[jt]s|[jt]sx)$/.test(base)) return base
    const stems = /\.[cm]?js$/.test(base) ? [base.replace(/\.js$/, ".ts").replace(/\.mjs$/, ".mts").replace(/\.cjs$/, ".cts")] : [".ts",".tsx",".js",".jsx",".mts",".mjs",".cts",".cjs","/index.ts","/index.tsx","/index.js","/index.jsx"].map(ext => base + ext)
    const matches = stems.filter(file => read(file) !== undefined)
    return matches.length === 1 ? matches[0] : undefined
  }
  function source(file: string) { const code=read(file); if(code===undefined)return undefined;const ast=parse(file,code);return (ast as ts.SourceFile & {parseDiagnostics?:unknown[]}).parseDiagnostics?.length ? undefined : ast }
  function imported(ast: ts.SourceFile, name: string, member?: string): ts.Node | undefined {
    const matches: Array<{request:string;name:string}>=[]
    for(const statement of ast.statements)if(ts.isImportDeclaration(statement)&&ts.isStringLiteral(statement.moduleSpecifier)&&statement.importClause&&!statement.importClause.isTypeOnly){
      const clause=statement.importClause,bindings=clause.namedBindings
      if(clause.name?.text===name&&!member)matches.push({request:statement.moduleSpecifier.text,name:"default"})
      if(bindings&&ts.isNamedImports(bindings)&&!member)for(const binding of bindings.elements)if(binding.name.text===name&&!binding.isTypeOnly)matches.push({request:statement.moduleSpecifier.text,name:binding.propertyName?.text??binding.name.text})
      if(bindings&&ts.isNamespaceImport(bindings)&&bindings.name.text===name&&member)matches.push({request:statement.moduleSpecifier.text,name:member})
    }
    if(matches.length!==1)return undefined
    const file=module(ast.fileName,matches[0].request);return file?exported(file,matches[0].name):undefined
  }
  function resolve(ast:ts.SourceFile,node:ts.Expression):ts.Node|undefined {
    while(ts.isParenthesizedExpression(node)||ts.isAsExpression(node)||ts.isTypeAssertionExpression(node)||ts.isSatisfiesExpression(node))node=node.expression
    if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)||ts.isArrowFunction(node)||ts.isFunctionExpression(node))return node
    if(ts.isIdentifier(node))return local(ast,node.text)
    if(ts.isPropertyAccessExpression(node)&&ts.isIdentifier(node.expression))return imported(ast,node.expression.text,node.name.text)
    return undefined
  }
  function guard(key:string,action:()=>ts.Node|undefined){if(resolving.has(key)||resolving.size>=16)return undefined;resolving.add(key);try{return action()}finally{resolving.delete(key)}}
  function local(ast:ts.SourceFile,name:string):ts.Node|undefined {
    return guard(ast.fileName+":local:"+name,()=>{
      const declarations=ast.statements.filter(ts.isVariableStatement).flatMap(statement=>statement.declarationList.declarations.map(declaration=>({statement,declaration}))).filter(({declaration})=>ts.isIdentifier(declaration.name)&&declaration.name.text===name)
      const functions=ast.statements.filter(ts.isFunctionDeclaration).filter(fn=>fn.name?.text===name)
      if(functions.length)return functions.length===1&&!declarations.length?functions[0]:undefined
      if(!declarations.length)return imported(ast,name)
      if(declarations.length!==1||!(declarations[0].statement.declarationList.flags&ts.NodeFlags.Const)||!declarations[0].declaration.initializer)return undefined
      return resolve(ast,declarations[0].declaration.initializer)
    })
  }
  function exported(file:string,name:string):ts.Node|undefined {
    return guard(file+":export:"+name,()=>{
      const ast=source(file);if(!ast)return undefined
      const candidates:Array<()=>ts.Node|undefined>=[]
      for(const statement of ast.statements){
        if(ts.isFunctionDeclaration(statement)&&statement.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)&&((statement.modifiers.some(m=>m.kind===ts.SyntaxKind.DefaultKeyword)?"default":statement.name?.text)===name))candidates.push(()=>statement)
        if(ts.isExportAssignment(statement)&&!statement.isExportEquals&&name==="default")candidates.push(()=>resolve(ast,statement.expression))
        if(ts.isVariableStatement(statement)&&statement.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)&&statement.declarationList.declarations.some(d=>ts.isIdentifier(d.name)&&d.name.text===name))candidates.push(()=>local(ast,name))
        if(ts.isExportDeclaration(statement)&&!statement.isTypeOnly){
          const other=statement.moduleSpecifier&&ts.isStringLiteral(statement.moduleSpecifier)?module(file,statement.moduleSpecifier.text):undefined
          if(statement.exportClause&&ts.isNamedExports(statement.exportClause)){for(const item of statement.exportClause.elements)if(!item.isTypeOnly&&item.name.text===name)candidates.push(()=>other?exported(other,item.propertyName?.text??item.name.text):!statement.moduleSpecifier?local(ast,item.propertyName?.text??item.name.text):undefined)}
          else if(!statement.exportClause&&other&&name!=="default")candidates.push(()=>exported(other,name))
        }
      }
      // Explicit duplicate/star ambiguity is refused, even if values are equal.
      return candidates.length===1?candidates[0]():undefined
    })
  }
  const ast=expression.getSourceFile(),name=ts.isIdentifier(expression)?expression.text:ts.isPropertyAccessExpression(expression)&&ts.isIdentifier(expression.expression)?expression.expression.text:undefined
  if(!name)return undefined
  const binds=(binding:ts.BindingName):boolean=>ts.isIdentifier(binding)?binding.text===name:binding.elements.some(e=>ts.isBindingElement(e)&&binds(e.name))
  let shadowed=false
  const inspect=(node:ts.Node)=>{if(ts.isParameter(node)&&binds(node.name)||ts.isVariableDeclaration(node)&&binds(node.name)&&node.parent.parent.parent!==ast||ts.isFunctionDeclaration(node)&&node.name?.text===name&&node.parent!==ast)shadowed=true;ts.forEachChild(node,inspect)}
  inspect(ast);if(shadowed)return undefined
  if(ts.isIdentifier(expression))return local(ast,expression.text)
  if(ts.isPropertyAccessExpression(expression)&&ts.isIdentifier(expression.expression))return imported(ast,expression.expression.text,expression.name.text)
  return undefined
}

export function importedLiteral(expression:ts.Expression,read:Read,parse:Parse):ts.StringLiteralLike|undefined {
  const node=importedDeclaration(expression,read,parse)
  return node&&(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))?node:undefined
}
