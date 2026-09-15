import { publicRuntimeValues } from "./publicRuntimeValues"
import { finiteBuildPlan, type FiniteBuildPlan } from './finiteBuild'
import { parseYarnClassic, parseBunText, normalizeAlternateLock, npmDescriptor } from "./alternateLockfiles"
import { isDefaultTailwindConfig } from "../adapters/react/defaultTailwindConfig"
import { validateStylesheetConfiguration } from "./configuration"
import fs from "node:fs"
import path from "node:path"
import ts from "typescript"
import semver from "semver"
import { parse as parseJsonc, type ParseError } from "jsonc-parser"
import { inspectCssPlan, validateFiniteCss, type CssPlan } from "./staticCss"
import { staticHtml } from "./htmlConfiguration"
import { isWithin, safeArchivePath, type ProjectRecord } from "./projectRegistry"

export const PROFILE = "react19-vite6"
export const RUNTIME_PROFILES = [PROFILE, "react18-vite5-v1", "react19-vite8-v1", "react18-vite4-three-v1", "react18-vite6-common-v1", "react19-vite7-common-v1", "react19-vite7.1-v1", "react18-vite5-css-v1", "react19-vite6-uno-v1", "react19-vite6-uno65-v1"] as const
export const clientPackages = new Set(["react", "react-dom", "react-router-dom", "react-router", "clsx", "classnames", "zustand", "nanoid", "@react-three/drei", "@react-three/fiber", "@react-three/postprocessing", "three", "postprocessing", "meshline", "prism-react-renderer", "prismjs", "lucide-react", "@tippyjs/react", "immer", "use-immer"])
export type ConfigurationClass = "statically-supported" | "safely-translated" | "requires-isolated-execution" | "unsupported" | "preserved-not-applied"
export type ConfigurationSupport = { file: string; classification: ConfigurationClass; detail: string }
function selectProfile(project: ProjectRecord, applicationRoot: string) {
  const matches=(name:string,requested:unknown,pin:unknown)=>{try{const r=npmDescriptor(name,requested),p=npmDescriptor(name,pin);return r.name===p.name&&!!semver.valid(p.range)&&semver.satisfies(p.range,r.range)}catch{return false}}
  const version=(name:string,pin:unknown)=>npmDescriptor(name,pin).range
  try {
    const manifest = json(project.root, "package.json"), declared = { ...manifest.devDependencies, ...manifest.dependencies }
    const lock = fs.existsSync(path.join(project.root, "package-lock.json")) ? json(project.root, "package-lock.json") : undefined
    const alternate=!lock && fs.existsSync(path.join(project.root,"yarn.lock"))?parseYarnClassic(fs.readFileSync(confinedFile(project.root,"yarn.lock"),"utf8")):!lock&&fs.existsSync(path.join(project.root,"bun.lock"))?parseBunText(fs.readFileSync(confinedFile(project.root,"bun.lock"),"utf8")):undefined
    const lockedVersion=(name:string)=>lock?.packages?.["node_modules/"+name]?.version??alternate?.resolve(name,String(declared[name]))?.version
    const candidates = RUNTIME_PROFILES.map(id => ({ id, profile: JSON.parse(fs.readFileSync(path.join(applicationRoot, "runtime-profiles", id, "package.json"), "utf8")) })).filter(({ profile }) =>
      ["react", "react-dom", "vite"].every(name => { const range = declared[name]; return matches(name,range,profile.dependencies[name]) && (!lock && !alternate || lockedVersion(name) === version(name,profile.dependencies[name])) }))
    return candidates.find(({ profile }) => Object.entries(declared).every(([name, range]) => matches(name,range,profile.dependencies[name]) && (!lock && !alternate || lockedVersion(name) === version(name,profile.dependencies[name]))))?.id ?? candidates[0]?.id ?? PROFILE
  } catch { return PROFILE }
}
export type RuntimeIssue = { file?: string; classification?: ConfigurationClass; code: string; message: string; requiredCapability: string }
export type RuntimeReport = {
  runtimeRoot?:string; exportBuild?:FiniteBuildPlan;
  cssPlan?: CssPlan; compilerOptions: Record<string, any>; publicDir?: string | false; schema: 2; configuration: ConfigurationSupport[]; base: string; environment: Record<string, string | boolean>; profile: string; supported: boolean; entry?: string; aliases: Record<string, string>
  clientDependencies: string[]; dependencies: Array<{ name: string; declared: string; selected?: string; locked?: string }>
  issues: RuntimeIssue[]; notes: string[]
}
export class RuntimeCompatibilityError extends Error {
  constructor(public readonly issues: RuntimeIssue[]) { super(issues.map(issue => issue.message).join(" ")) }
}
const object = (value: unknown): value is Record<string, any> => Boolean(value && typeof value === "object" && !Array.isArray(value))
export function confinedFile(root: string, relative: string) {
  if (!safeArchivePath(relative)) throw new Error(`Invalid project-local path: ${relative}`)
  const file = path.resolve(root, relative)
  if (!isWithin(root, file) || !fs.existsSync(file) || !isWithin(root, fs.realpathSync(file))) throw new Error(`Project-local path is unavailable or escapes its root: ${relative}`)
  return fs.realpathSync(file)
}
function json(root: string, file: string, comments = false): any {
  const code = fs.readFileSync(confinedFile(root, file), "utf8")
  if (!comments) return JSON.parse(code)
  const errors: ParseError[] = [], value = parseJsonc(code, errors, { allowTrailingComma: true })
  if (errors.length) throw new Error(`Invalid JSON data: ${file}`)
  return value
}

/** Compatibility entry inspection shares the same finite shell parser as compilation. */
export function htmlEntry(root: string, publicDir?:string|false,runtimeRoot='.') { return staticHtml(root,publicDir,runtimeRoot)?.entry }

/** Interpret only a fixed AST grammar; never import/eval the Vite module. */
export function staticViteConfig(root: string, declared: Record<string, unknown>): { aliases: Record<string, string>; base: string; runtimeRoot?:string; exportBuild?:FiniteBuildPlan; publicDir?: string | false; tsconfigPaths?: boolean; preserved?: string[] } {
  const files = ["vite.config.ts", "vite.config.js", "vite.config.mts", "vite.config.mjs", "vite.config.cts", "vite.config.cjs"].filter(file => fs.existsSync(path.join(root, file)))
  if (files.length > 1) throw new Error("Multiple Vite configurations are ambiguous.")
  if (!files.length) return { aliases: {}, base: "/" }
  const source = ts.createSourceFile(files[0], fs.readFileSync(confinedFile(root, files[0]), "utf8"), ts.ScriptTarget.Latest, true)
  if ((source as ts.SourceFile & { parseDiagnostics: unknown[] }).parseDiagnostics.length) throw new Error("Invalid Vite configuration syntax.")
  const bindings = new Map<string, string>()
  const bind=(name:string,binding:string)=>{if(bindings.has(name))throw Error("Duplicate configuration import binding.");bindings.set(name,binding)}
  const pluginValues = new Set<any>()
  const constants = new Map<string,ts.Expression>(), resolving = new Set<string>()
  for(const statement of source.statements.filter(ts.isVariableStatement)) {
    if(!(statement.declarationList.flags & ts.NodeFlags.Const)||statement.modifiers?.length)throw Error("Only unexported literal const configuration bindings are supported.")
    for(const declaration of statement.declarationList.declarations) {
      if(!ts.isIdentifier(declaration.name)||!declaration.initializer||constants.has(declaration.name.text)||constants.size>=64)throw Error("Invalid static configuration binding.")
      constants.set(declaration.name.text,declaration.initializer)
    }
  }
  for (const statement of source.statements.filter(ts.isImportDeclaration)) {
    if (!ts.isStringLiteral(statement.moduleSpecifier)) throw new Error("Unknown configuration import.")
    const module = statement.moduleSpecifier.text, clause = statement.importClause
    if (!["node:url", "url", "node:path", "path"].includes(module) && !declared[module.split("/")[0]] && !declared[module]) throw new Error(`Undeclared Vite configuration dependency: ${module}.`)
    if (clause?.isTypeOnly) throw new Error("Type-only configuration imports cannot be runtime bindings.")
    if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) bind(clause.namedBindings.name.text, module + ":namespace")
    if (clause?.name) bind(clause.name.text, module + ":default")
    if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) for (const item of clause.namedBindings.elements) bind(item.name.text, module + ":" + (item.propertyName?.text ?? item.name.text))
    if (!["vite", "@vitejs/plugin-react", "@vitejs/plugin-react-swc", "@tailwindcss/vite", "vite-tsconfig-paths", "unocss/vite", "node:url", "url", "node:path", "path"].includes(module)) throw new Error(`Unsupported Vite configuration import: ${module}.`)
  }
  if([...constants.keys()].some(name=>bindings.has(name)))throw Error("Ambiguous configuration binding.")
  let visits=0
  const value = (node: ts.Expression, allowFactory=false): any => {
    if(++visits>4000)throw Error("Configuration exceeds static complexity bound.")
    if(ts.isIdentifier(node)&&constants.has(node.text)) {
      if(resolving.has(node.text)||resolving.size>=32)throw Error("Cyclic/deep static configuration.")
      resolving.add(node.text);try{return value(constants.get(node.text)!)}finally{resolving.delete(node.text)}
    }
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) return value(node.expression,allowFactory)
    if (allowFactory && ts.isArrowFunction(node) && !node.parameters.length && !node.modifiers?.length) {
      if (ts.isBlock(node.body)) { if (node.body.statements.length === 1 && ts.isReturnStatement(node.body.statements[0]) && node.body.statements[0].expression) return value(node.body.statements[0].expression) }
      else return value(node.body)
      throw new Error("Only a zero-argument literal configuration factory is supported.")
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
    if (ts.isNumericLiteral(node)) return Number(node.text)
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false
    if (ts.isObjectLiteralExpression(node)) {
      const result: Record<string, any> = Object.create(null)
      for (const property of node.properties) {
        if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name) && !ts.isStringLiteral(property.name)) throw new Error("Computed/spread Vite configuration requires execution.")
        const key = property.name.text
        if (Object.prototype.hasOwnProperty.call(result, key)) throw new Error("Duplicate configuration field.")
        result[key] = value(property.initializer)
      }
      return result
    }
    if (ts.isArrayLiteralExpression(node)) return node.elements.map(item => value(item as ts.Expression))
    if (ts.isCallExpression(node)) {
      const expression = node.expression
      const binding = ts.isIdentifier(expression) ? bindings.get(expression.text) : ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression) && ["path:default", "node:path:default", "path:namespace", "node:path:namespace"].includes(bindings.get(expression.expression.text) ?? "") ? "path:" + expression.name.text : undefined
      if (["path:resolve", "node:path:resolve"].includes(binding ?? "")) {
        const args = [...node.arguments]
        if (args.length === 2 && ts.isIdentifier(args[0]) && args[0].text === "__dirname" && !bindings.has("__dirname") && !constants.has("__dirname")) args.shift()
        if (!args.length || args.length>8 || args.some(arg=>!ts.isStringLiteral(arg)||arg.text.startsWith("/")||arg.text.includes("\\"))) throw new Error("Only project-relative literal path.resolve aliases are supported.")
        const relative=path.posix.join(...args.map(arg=>(arg as ts.StringLiteral).text))
        return relative==="."?root:confinedFile(root,relative.replace(/^\.\//,""))
      }
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const binding = bindings.get(node.expression.text)
      if (binding === "vite:defineConfig" && node.arguments.length === 1) return value(node.arguments[0],true)
      if (["@vitejs/plugin-react:default", "@vitejs/plugin-react-swc:default", "@tailwindcss/vite:default", "vite-tsconfig-paths:default", "unocss/vite:default"].includes(binding ?? "") && !node.arguments.length) { const plugin = { plugin: binding!.split(":")[0] }; pluginValues.add(plugin); return plugin }
      if (["node:url:fileURLToPath", "url:fileURLToPath"].includes(binding ?? "") && node.arguments.length === 1) {
        const url = node.arguments[0]
        if (ts.isNewExpression(url) && ts.isIdentifier(url.expression) && url.expression.text === "URL" && !bindings.has("URL") && !constants.has("URL") && url.arguments?.length === 2 && ts.isStringLiteral(url.arguments[0]) && url.arguments[1].getText(source) === "import.meta.url") {
          const relative = url.arguments[0].text
          if (!relative.startsWith("./")) throw new Error("Alias must remain inside the project.")
          return confinedFile(root, relative.slice(2))
        }
      }
    }
    throw new Error("Executable Vite configuration is not supported by the static runtime profile.")
  }
  const exports = source.statements.filter(ts.isExportAssignment)
  if (exports.length !== 1 || source.statements.some(statement => !ts.isImportDeclaration(statement) && !ts.isExportAssignment(statement) && !ts.isVariableStatement(statement))) throw new Error("Vite configuration has executable statements; an isolated configuration runner is required.")
  const config = value(exports[0].expression,true)
  for(const [name] of constants)value(ts.factory.createIdentifier(name))
  if (!object(config) || Object.keys(config).some(key => !["plugins", "resolve", "base", "server", "preview", "root", "publicDir", "test", "optimizeDeps", "build"].includes(key))) throw new Error("Unsupported Vite configuration field; an isolated configuration runner is required.")
  if (config.base !== undefined && (typeof config.base !== "string" || !["/", "./"].includes(config.base) && (!/^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\/$/.test(config.base)))) throw new Error("Only bounded local Vite base paths are supported.")
  if (config.plugins !== undefined && (!Array.isArray(config.plugins) || config.plugins.some((plugin: any) => !pluginValues.has(plugin)))) throw new Error("Unsupported Vite build plugin.")
  const preserved: string[] = []
  const exportBuild=config.build===undefined?undefined:finiteBuildPlan(config.build)
  if(exportBuild)preserved.push('build.rollupOptions: independent production export-build plan; chunk-size tuning has no preview effect. External fs/promises is preserved for export only; any reachable browser Node import still refuses preview.')
  let runtimeRoot='.'
  if(config.root!==undefined&&!['.','./',root].includes(config.root)){
    if(typeof config.root!=='string')throw Error('Vite root must be a static project path.')
    runtimeRoot=path.isAbsolute(config.root)?path.relative(root,config.root):config.root.replace(/^\.\//,'').replace(/\/$/,'')
    if(!safeArchivePath(runtimeRoot)||runtimeRoot.split('/').some(p=>p.startsWith('.'))||!fs.statSync(confinedFile(root,runtimeRoot)).isDirectory())throw Error('Vite root must remain inside the canonical project.')
    let current=root;for(const segment of runtimeRoot.split('/')){current=path.join(current,segment);if(fs.lstatSync(current).isSymbolicLink())throw Error('Vite root symlinks are forbidden.')}
  }
  let publicDir:string|false=path.posix.join(runtimeRoot,'public')
  if(config.publicDir!==undefined) {
    if(config.publicDir===false)publicDir=false
    else if(typeof config.publicDir==="string") {
      const relative=path.isAbsolute(config.publicDir)?path.relative(root,config.publicDir).split(path.sep).join("/"):path.posix.join(runtimeRoot,config.publicDir.replace(/^\.\//,""))
      if(!safeArchivePath(relative)||relative.split("/").some(p=>p.startsWith(".")||["node_modules","_wcb","api"].includes(p))||path.posix.relative(runtimeRoot,relative).split("/").includes("src")||!fs.statSync(confinedFile(root,relative)).isDirectory())throw Error("Unsupported publicDir; only a confined inert asset directory is supported.")
      publicDir=relative
    } else throw Error("Invalid publicDir.")
  }
  if(config.test!==undefined) {
    const t=config.test
    if(!object(t)||Object.keys(t).some(k=>!["globals","environment","setupFiles","exclude","include","coverage"].includes(k))||t.globals!==undefined&&typeof t.globals!=="boolean"||t.environment!==undefined&&!["jsdom","happy-dom","node"].includes(t.environment)||t.setupFiles!==undefined&&typeof t.setupFiles!=="string"||["exclude","include"].some(k=>t[k]!==undefined&&(!Array.isArray(t[k])||t[k].some((v:any)=>typeof v!=="string"||v.length>256)))||t.coverage!==undefined&&(!object(t.coverage)||Object.keys(t.coverage).some(k=>!["include","exclude"].includes(k))||Object.values(t.coverage).some(v=>!Array.isArray(v)||v.some(x=>typeof x!=="string"||x.length>256))))throw Error("Unsupported test-only configuration metadata.")
    preserved.push("test: finite test-only preferences preserved; no uploaded test/setup code is executed.")
  }
  if(config.optimizeDeps!==undefined) {
    if(!object(config.optimizeDeps)||Object.keys(config.optimizeDeps).some(k=>!["include","exclude"].includes(k))||Object.values(config.optimizeDeps).some(v=>!Array.isArray(v)||v.some(x=>typeof x!=="string"||!/^[@a-zA-Z0-9_./-]{1,128}$/.test(x))))throw Error("Unsupported dependency-optimization configuration.")
    preserved.push("optimizeDeps: finite development prebundle preferences preserved; fixed production compiler still verifies every executed import.")
  }
  for (const field of ["server", "preview"]) if (config[field] !== undefined) {
    const settings = config[field]
    if (!object(settings) || Object.entries(settings).some(([key, item]) => key === "port" ? !Number.isInteger(item) || item < 1 || item > 65535 : key === "open" ? typeof item !== "boolean" : true)) throw new Error("Only inert local dev-server open/port preferences can be preserved.")
    preserved.push(field + ": local open/port preferences preserved but not applied; the controlled snapshot does not run an uploaded dev server.")
  }
  const aliases: Record<string, string> = Object.create(null)
  if (config.resolve !== undefined) {
    if (!object(config.resolve) || Object.keys(config.resolve).some(key => key !== "alias") || !object(config.resolve.alias) && !Array.isArray(config.resolve.alias)) throw new Error("Only static project-local resolve.alias objects are supported.")
    const entries: Array<[string, unknown]> = Array.isArray(config.resolve.alias) ? config.resolve.alias.map((entry: any) => {
      if (!object(entry) || Object.keys(entry).length !== 2 || !Object.prototype.hasOwnProperty.call(entry, "find") || !Object.prototype.hasOwnProperty.call(entry, "replacement")) throw new Error("Only literal find/replacement alias entries are supported.")
      return [entry.find, entry.replacement]
    }) : Object.entries(config.resolve.alias)
    for (const [key, replacement] of entries) {
      if (typeof key !== "string" || Object.prototype.hasOwnProperty.call(aliases, key)) throw new Error("Invalid or duplicate alias.")
      if (!/^[@~][\w/-]*$/.test(key) || typeof replacement !== "string") throw new Error("Only explicit @/~ project-local aliases are supported.")
      // Vite string aliases must be absolute; relative replacements have different resolution semantics.
      if (!path.isAbsolute(replacement) || !isWithin(root, replacement)) throw new Error("Alias escapes the project or requires executable path resolution.")
      aliases[key] = path.relative(root, confinedFile(root, path.relative(root, replacement))).split(path.sep).join("/")
    }
  }
  return { aliases, base: config.base ?? "/", runtimeRoot, exportBuild, publicDir, tsconfigPaths:(config.plugins??[]).some((p:any)=>p.plugin==="vite-tsconfig-paths"), preserved }
}

export function inspectRuntime(project: ProjectRecord, applicationRoot: string, runtimeValues: Record<string,string> = {}): RuntimeReport {
  const selectedProfile = selectProfile(project, applicationRoot)
  const report: RuntimeReport = { compilerOptions: {}, schema: 2, configuration: [], base: "/", environment: {}, profile: selectedProfile, supported: false, aliases: {}, clientDependencies: [], dependencies: [], issues: [], notes: [] }
  const issue = (code: string, message: string, requiredCapability = "A separately approved dependency/runtime profile or isolated build runner") => report.issues.push({ code, message, requiredCapability })
  const root = project.root
  const profileRoot = path.join(applicationRoot, "runtime-profiles", selectedProfile)
  try {
    if (fs.realpathSync(root) !== root) throw new Error("Registered project root changed.")
    const manifest = json(root, "package.json"), profile = JSON.parse(fs.readFileSync(path.join(profileRoot, "package.json"), "utf8"))
    const profileLock = JSON.parse(fs.readFileSync(path.join(profileRoot, "package-lock.json"), "utf8"))
    if (!object(manifest) || !object(manifest.dependencies ?? {}) || !object(manifest.devDependencies ?? {})) throw new Error("Invalid package manifest.")
    for (const field of ["overrides", "resolutions", "workspaces", "imports"]) if (manifest[field]) issue("package-configuration", `package.json ${field} requires a different resolver.`)
    const declared = { ...manifest.devDependencies, ...manifest.dependencies }
    for (const name of ["react", "react-dom", "vite"]) if (!declared[name]) issue("missing-dependency", `Missing required declared dependency: ${name}.`)
    for (const name of Object.keys(manifest.dependencies ?? {})) if (manifest.devDependencies?.[name] && manifest.devDependencies[name] !== manifest.dependencies[name]) issue("dependency-conflict", `Conflicting declarations for ${name}.`)
    const lockNames = ["package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml", "bun.lock", "bun.lockb"].filter(file => fs.existsSync(path.join(root, file)))
    let lock: any, lockDescription="npm lockfile"
    if (lockNames.length > 1 || lockNames.length === 1 && !["package-lock.json","yarn.lock","bun.lock"].includes(lockNames[0])) issue("unsupported-lockfile", "Only one supported npm, Yarn classic or Bun text lock is permitted; Berry, binary Bun and other unimplemented formats are preserved and refused.")
    if (lockNames.includes("package-lock.json")) {
      lock = json(root, "package-lock.json")
      if (![2, 3].includes(lock.lockfileVersion) || !object(lock.packages) || !object(lock.packages[""])) { issue("unsupported-lockfile", "npm package-lock v2/v3 with package records is required."); lock = undefined }
    }
    if(lockNames.length===1 && ["yarn.lock","bun.lock"].includes(lockNames[0])) {
      let alternate
      try { const text=fs.readFileSync(confinedFile(root,lockNames[0]),"utf8");alternate=lockNames[0]==="yarn.lock"?parseYarnClassic(text):parseBunText(text);lockDescription=alternate.format }
      catch(error){issue("unsupported-lockfile",(error as Error).message)}
      if(alternate)try{lock=normalizeAlternateLock(alternate,manifest,profileLock)}catch(error){issue("lock-conflict",(error as Error).message)}
    }
    for (const [name, range] of Object.entries(declared)) {
      const pin = profile.dependencies[name] as string | undefined
      let selected:string|undefined, requested:ReturnType<typeof npmDescriptor>|undefined
      try {requested=npmDescriptor(name,range);const target=npmDescriptor(name,pin);if(target.name===requested.name&&semver.valid(target.range))selected=target.range}catch { /* Unsupported descriptor remains an admission issue below. */ }
      const locked = lock?.packages[`node_modules/${name}`]?.version as string | undefined
      report.dependencies.push({ name, declared: String(range), selected, locked })
      if (!requested || !selected || !semver.satisfies(selected, requested.range)) issue("unsupported-version", `${name}@${String(range)} cannot use this profile${selected ? ` (${selected})` : " (package not provided)"}.`)
      if (lock && (!locked || locked !== selected || (lock.packages[`node_modules/${name}`]?.name??name)!==requested?.name || lock.packages[`node_modules/${name}`]?.integrity !== profileLock.packages[`node_modules/${name}`]?.integrity || (lock.packages[""].dependencies?.[name] ?? lock.packages[""].devDependencies?.[name]) !== range)) issue("lock-conflict", `${name} lockfile version/declaration does not match the selected profile and manifest.`)
      if (selected) {
        const installed = path.join(profileRoot, "node_modules", name, "package.json")
        if (!fs.existsSync(installed) || !isWithin(fs.realpathSync(path.join(profileRoot, "node_modules")), fs.realpathSync(installed)) || JSON.parse(fs.readFileSync(installed, "utf8")).version !== selected || JSON.parse(fs.readFileSync(installed, "utf8")).name !== requested?.name) issue("profile-unavailable", `The dedicated profile package ${name}@${selected} is missing or changed.`, "Operator installation of the repository-owned locked runtime profile with scripts disabled")
      }
    }
    // Only the dependency closure of explicitly admitted browser packages is
    // available to application imports. Tooling and the editor graph are excluded.
    const clientRoot=(name:string)=>{try{return clientPackages.has(npmDescriptor(name,declared[name]).name)}catch{return false}}
    const pendingClients = Object.keys(declared).filter(clientRoot).map(name => "node_modules/" + name), clients = new Set<string>(), visited = new Set<string>()
    const nestedDependency = (location: string, name: string) => {
      let parent = location
      while (parent) {
        const candidate = parent + "/node_modules/" + name
        if (profileLock.packages[candidate]) return candidate
        const at = parent.lastIndexOf("/node_modules/")
        parent = at < 0 ? "" : parent.slice(0, at)
      }
      return "node_modules/" + name
    }
    while (pendingClients.length) {
      const location = pendingClients.pop()!
      if (visited.has(location)) continue
      visited.add(location)
      const record = profileLock.packages[location]
      if (!record || record.link) { issue("profile-unavailable", "Missing pinned browser dependency: " + location); continue }
      const name = location.slice(location.lastIndexOf("node_modules/") + 13)
      if (location === "node_modules/" + name) clients.add(name)
      if (lock) {
        const upstream = lock.packages[location]
        if (!upstream || upstream.link || upstream.version !== record.version || upstream.integrity !== record.integrity) issue("lock-conflict", "Browser dependency graph differs from the uploaded lock: " + location)
      }
      for (const dependency of new Set([...Object.keys(record.dependencies ?? {}), ...Object.keys(record.optionalDependencies ?? {}), ...Object.keys(record.peerDependencies ?? {})])) {
        const next = nestedDependency(location, dependency)
        const optional = record.optionalDependencies?.[dependency] || (!record.dependencies?.[dependency] && record.peerDependenciesMeta?.[dependency]?.optional)
        if (optional && !profileLock.packages[next]) continue
        pendingClients.push(next)
      }
    }
    report.clientDependencies = [...clients].sort()
    // The executed transitive client graph must also match an uploaded lock; no hidden version substitution.
    if (lock) for (const [location, record] of Object.entries(lock.packages) as Array<[string, any]>) {
      const name = location.split("node_modules/").at(-1)!
      if (["react", "react-dom", "scheduler", "react-router-dom", "react-router", "cookie", "set-cookie-parser", "clsx", "classnames"].includes(name)) {
        if (record.link || record.version !== profileLock.packages[`node_modules/${name}`]?.version || record.integrity !== profileLock.packages[`node_modules/${name}`]?.integrity) issue("lock-conflict", `Locked client package ${location} differs from the dedicated runtime profile.`)
      }
    }
    if (lock) {
      const checked = new Set<string>(), pending = Object.keys(declared).filter(clientRoot)
      while (pending.length) {
        const name = pending.pop()!
        if (checked.has(name)) continue
        checked.add(name)
        const selected = profileLock.packages[`node_modules/${name}`], locked = lock.packages[`node_modules/${name}`]
        if (!selected || !locked || locked.version !== selected.version || locked.integrity !== selected.integrity || locked.link) issue("lock-conflict", `Required client dependency ${name} is missing or differs in the uploaded lock.`)
        for (const dependency of Object.keys(selected?.dependencies ?? {})) pending.push(dependency)
      }
    }
    report.notes.push(lock ? "Versions, integrity and required dependency/peer graph checked against the "+lockDescription+"." : lockNames.length ? "The uploaded lockfile is unsupported; it is preserved and runtime admission is refused." : "No lockfile: disclosed pinned profile versions must satisfy every declared range.")
    if (object(manifest.scripts) && Object.keys(manifest.scripts).length) report.notes.push("Package scripts, including install/build hooks, are inspected only and never run during intake or preview.")
    let tsconfigPaths = false
    const viteFile = ["vite.config.ts", "vite.config.js", "vite.config.mts", "vite.config.mjs", "vite.config.cts", "vite.config.cjs"].find(file => fs.existsSync(path.join(root, file)))
    try { const config = staticViteConfig(root, declared); report.runtimeRoot=config.runtimeRoot; report.exportBuild=config.exportBuild; report.aliases = config.aliases; report.base = config.base; report.publicDir = config.publicDir; tsconfigPaths=Boolean(config.tsconfigPaths); for (const detail of config.preserved ?? []) report.configuration.push({ file: viteFile!, classification: "preserved-not-applied", detail }); if (viteFile) report.configuration.push({ file: viteFile, classification: "safely-translated", detail: "Static React/Tailwind plugin declarations, project aliases and local base; no config execution." }) }
    catch (error) { issue("executable-config", (error as Error).message, "An isolated Vite configuration/plugin runner"); report.configuration.push({ file: viteFile ?? "vite.config", classification: "requires-isolated-execution", detail: (error as Error).message }) }
    try { report.entry = htmlEntry(root,report.publicDir,report.runtimeRoot) ?? (report.runtimeRoot&&report.runtimeRoot!=="."?undefined:project.detection.entry); if (!report.entry) throw new Error("No supported client entry found.") } catch (error) { issue("html-entry", (error as Error).message) }
    report.environment = { MODE: "production", PROD: true, DEV: false, SSR: false, BASE_URL: report.base, ...publicRuntimeValues(runtimeValues) }
    const configs = new Set<string>()
    const readTsconfig = (file: string) => {
      if (configs.has(file)) return
      if (configs.size >= 8) throw new Error("Too many referenced TypeScript configurations.")
      configs.add(file)
      const inherited = (name:string,chain=new Set<string>()):any => {
        if(chain.has(name)||chain.size>=8)throw Error("Cyclic/deep TypeScript extends chain.")
        chain.add(name);const own=json(root,name,true)
        if(!object(own)||own.compilerOptions!==undefined&&!object(own.compilerOptions))throw Error("Invalid TypeScript config data.")
        if(!own.extends)return own
        if(typeof own.extends!=="string"||!/^\.\/[A-Za-z0-9_.-]+\.json$/.test(own.extends))throw Error("Only confined same-directory TypeScript extends files are supported.")
        const baseFile=path.posix.join(path.posix.dirname(name),own.extends)
        configs.add(baseFile);if(configs.size>8)throw Error("Too many TypeScript configuration files.")
        const parent=inherited(baseFile,chain)
        return {...parent,...own,references:own.references,compilerOptions:{...parent.compilerOptions,...own.compilerOptions}}
      }
      const config = inherited(file), options = config.compilerOptions ?? {}
      if (options.jsxImportSource && options.jsxImportSource !== "react" || options.experimentalDecorators || options.emitDecoratorMetadata || options.useDefineForClassFields === false || options.plugins || options.jsxFactory || options.jsxFragmentFactory || options.jsx && !["react-jsx", "react-jsxdev", "preserve"].includes(options.jsx)) throw new Error("Unsupported TypeScript runtime transformation setting.")
      const appliesToSource = file === "tsconfig.json" || file === "jsconfig.json" || !Array.isArray(config.include) || config.include.some((item: unknown) => typeof item === "string" && /^src(?:[/*]|$)/.test(item))
      if (appliesToSource) for (const name of ["useDefineForClassFields", "verbatimModuleSyntax", "importsNotUsedAsValues", "preserveValueImports"]) {
        if (options[name] !== undefined) {
          if (report.compilerOptions[name] !== undefined && report.compilerOptions[name] !== options[name]) throw new Error("Conflicting TypeScript client transformation options.")
          report.compilerOptions[name] = options[name]
        }
      }
      if (options.paths) {
        if (!object(options.paths) || options.baseUrl && typeof options.baseUrl!=="string") throw new Error("Only project-root TypeScript aliases are supported.")
        for (const [key, replacements] of Object.entries(options.paths)) {
          if (!key.endsWith("/*") || !Array.isArray(replacements) || replacements.length !== 1 || typeof replacements[0] !== "string" || !replacements[0].endsWith("/*")) throw new Error("Only single-target TypeScript path aliases are supported.")
          const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), options.baseUrl??".", replacements[0].slice(0, -2).replace(/^\.\//, ""))), alias = key.slice(0, -2)
          confinedFile(root, target)
          if(tsconfigPaths && report.aliases[alias]===undefined) { if(!/^[@~][\w/-]*$/.test(alias))throw Error("Unsupported TypeScript plugin alias.");report.aliases[alias]=target }
          if (report.aliases[alias] !== target) throw new Error(`TypeScript alias ${alias} must match an explicit static Vite alias.`)
        }
      }
      if (Array.isArray(config.references)) for (const reference of config.references) { if (typeof reference.path !== "string") throw new Error("Invalid tsconfig reference."); readTsconfig(path.posix.normalize(path.posix.join(path.posix.dirname(file), reference.path))) }
    }
    try { for (const file of ["tsconfig.json", "jsconfig.json"]) if (fs.existsSync(path.join(root, file))) readTsconfig(file)
      for (const file of configs) report.configuration.push({ file, classification: "statically-supported", detail: "Client transpilation and matching explicit aliases; semantic type checking is an independent export gate." }) } catch (error) { issue("tsconfig", (error as Error).message) }
    try { report.cssPlan=inspectCssPlan(root,declared,selectedProfile); for(const file of report.cssPlan?.files??[])report.configuration.push({file,classification:"safely-translated",detail:"Finite static CSS data through the operator-pinned "+report.cssPlan!.kind+" adapter; uploaded configuration is never executed."}) } catch(error) { issue("css-config",(error as Error).message) }
    const cssConfigs = fs.readdirSync(root).filter(file => /^(?:tailwind|postcss)\.config\.(?:[cm]?[jt]s|json)$/.test(file) || /^\.postcssrc(?:\.|$)/.test(file))
    if (manifest.postcss) cssConfigs.push("package.json#postcss")
    for (const file of cssConfigs) {
      if(report.cssPlan?.files.includes(file))continue
      if(/^tailwind\.config\.[jt]s$/.test(file)&&isDefaultTailwindConfig(fs.readFileSync(confinedFile(root,file),'utf8'))) {
        report.configuration.push({file,classification:'preserved-not-applied',detail:'Finite default legacy Tailwind config; CSS-first compiler defaults are equivalent, bytes preserved and no config executed.'});continue
      }
      report.issues.push({ file, code: "css-config", classification: "requires-isolated-execution", message: `${file}: custom Tailwind/PostCSS configuration requires isolated configuration support; only defaults and admitted CSS-first literal themes are supported.`, requiredCapability: "An isolated plugin/configuration profile" })
    }
    for (const entry of fs.readdirSync(project.sourceRoot, { recursive: true })) {
      if (typeof entry !== "string" || !entry.endsWith(".css")) continue
      const file = "src/" + entry.split(path.sep).join("/")
      try {
        const stylesheet = fs.readFileSync(confinedFile(root, file), "utf8")
        if (/@import\s+(?:url\()?\s*[\"\']?https?:|url\(\s*[\"\']?https?:/i.test(stylesheet)) report.notes.push(`${file}: external CSS resource URLs are preserved; controlled preview network access remains denied.`)
        const result = report.cssPlan ? (validateFiniteCss(stylesheet,report.cssPlan),{theme:false}) : validateStylesheetConfiguration(stylesheet, selectedProfile !== PROFILE)
        if (result.theme) report.configuration.push({ file, classification: "safely-translated", detail: "Literal CSS @theme custom properties through the pinned Tailwind compiler." })
      } catch (error) { report.issues.push({ file, code: "css-directive", classification: "unsupported", message: file + ": " + (error as Error).message, requiredCapability: "A supported static theme or isolated configuration profile" }) }
    }
    // Environment references are statically classified; an unknown variable is
    // never silently replaced with undefined or a platform environment value.
    for (const entry of fs.readdirSync(project.sourceRoot, { recursive: true })) {
      if (typeof entry !== "string" || !/\.[jt]sx?$/.test(entry)) continue
      const file = "src/" + entry.split(path.sep).join("/"), source = ts.createSourceFile(file, fs.readFileSync(confinedFile(root, file), "utf8"), ts.ScriptTarget.Latest, true)
      const visit = (node: ts.Node) => {
        if (ts.isPropertyAccessExpression(node) && node.expression.kind === ts.SyntaxKind.MetaProperty && node.name.text === "env") {
          const parent = node.parent
          if (!ts.isPropertyAccessExpression(parent) || parent.expression !== node || !Object.prototype.hasOwnProperty.call(report.environment, parent.name.text)) {
            report.issues.push({ code: "environment-reference", file, classification: "unsupported", message: `${file}: environment references require an explicitly granted static public value; platform env is never exposed.`, requiredCapability: "Explicit project public environment configuration" })
          }
        }
        if (ts.isElementAccessExpression(node) && node.expression.kind === ts.SyntaxKind.MetaProperty) report.issues.push({ code: "dynamic-environment", file, classification: "unsupported", message: `${file}: computed import.meta access is unsupported.`, requiredCapability: "Statically understood environment references" })
        if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "process" && node.name.text === "env") {
          if (!ts.isPropertyAccessExpression(node.parent) || node.parent.name.text !== "NODE_ENV") report.issues.push({ code: "environment-reference", file, classification: "unsupported", message: `${file}: only the fixed production process.env.NODE_ENV compatibility constant is supported.`, requiredCapability: "Explicit project public environment configuration" })
        }
        ts.forEachChild(node, visit)
      }
      visit(source)
    }
    report.notes.push("Versioned controlled browser compilation, not an uploaded Vite server. Default React updates use incremental rebuild + document reload. The operator may enable controlled Fast Refresh for supported component boundaries; other edits still reload or restart. BrowserRouter requires a controlled provider.")
  } catch (error) { issue("runtime-inspection", (error as Error).message) }
  for (const item of report.issues) {
    item.file ??= item.code === "tsconfig" ? "tsconfig.json / jsconfig.json" : item.code === "css-config" ? "Tailwind / PostCSS configuration" : item.code === "executable-config" ? "vite.config" : "package.json / package-lock.json"
    item.classification ??= ["executable-config", "css-config"].includes(item.code) ? "requires-isolated-execution" : "unsupported"
    item.message = item.message.split(project.root).join("<project>").split(applicationRoot).join("<platform>")
  }
  report.supported = report.issues.length === 0
  return report
}
