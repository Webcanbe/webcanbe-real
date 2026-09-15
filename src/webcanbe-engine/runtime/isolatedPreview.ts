import { assertSourceDirectory, sourceDirectory, editableModule } from "./sourceDirectory"
import { buildFiniteExportGraph } from "./finiteBuild"
import { cssCompiler } from "./staticCss"
import { staticHtml, previewDocument } from "./htmlConfiguration"
import { developmentVendor, fastRefreshArtifacts } from "./fastRefreshCompiler"
import { validateStylesheetConfiguration } from "./configuration"
import { IncrementalPreviewCompiler } from "./incrementalPreview"
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { context, type BuildOptions, type Loader } from "esbuild"
import ts from "typescript"
import { inspectRuntime, RuntimeCompatibilityError, PROFILE } from "./runtimeCompatibility"
import { instrumentReactSource } from "../adapters/react/reactSourceAdapter"
import { isWithin, safeArchivePath, type ProjectRecord } from "./projectRegistry"
import { isInertToolingPath } from "./intakeMetadata"

export type PreviewArtifact = { body: Buffer; contentType: string }
export type HttpPreviewBuild = { html: string; files: Map<string, PreviewArtifact> }
const historyRouters = new Set(["BrowserRouter", "createBrowserRouter", "unstable_HistoryRouter"])
const assetTypes: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", ico: "image/x-icon", woff: "font/woff", woff2: "font/woff2" }

function historyImport(code: string, file: string) {
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  return source.statements.some(statement => {
    if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) return false
    const module = statement.moduleSpecifier
    if (!module || !ts.isStringLiteral(module) || !/^react-router(?:-dom)?$/.test(module.text)) return false
    if (ts.isExportDeclaration(statement)) return !statement.isTypeOnly && (!statement.exportClause || !ts.isNamedExports(statement.exportClause) || statement.exportClause.elements.some(item => historyRouters.has(item.propertyName?.text ?? item.name.text)))
    if (statement.importClause?.isTypeOnly) return false
    const bindings = statement.importClause?.namedBindings
    return Boolean(bindings && (!ts.isNamedImports(bindings) || bindings.elements.some(item => !item.isTypeOnly && historyRouters.has(item.propertyName?.text ?? item.name.text))))
  })
}

/** Conservative transport selection; the compiler also enforces the Blob guard. */
export function requiresHttpPreview(project: ProjectRecord) {
  let bytes = 0
  for (const file of fs.readdirSync(project.sourceRoot, { recursive: true })) {
    if (typeof file !== "string" || !/\.[jt]sx?$/.test(file)) continue
    const full = fs.realpathSync(path.join(project.sourceRoot, file))
    if (!isWithin(project.sourceRoot, full) || !safeArchivePath(path.relative(project.root, full))) throw new Error("Router source escaped its registered root.")
    const content = fs.readFileSync(full)
    bytes += content.length
    if (content.length > 2 * 1024 * 1024 || bytes > 40 * 1024 * 1024) throw new Error("Preview source limit exceeded.")
    if (historyImport(content.toString("utf8"), file)) return true
  }
  return false
}

async function boundedBuild(options: BuildOptions) {
  const compiler = await context(options)
  const timeout = setTimeout(() => { void compiler.cancel() }, 15_000)
  try { return await compiler.rebuild() }
  finally { clearTimeout(timeout); await compiler.dispose() }
}

/** No uploaded module/config is evaluated by Node. No artifacts are written to disk. */
async function compilePreview(project: ProjectRecord, applicationRoot: string, transport: "blob" | "http", incremental?: IncrementalPreviewCompiler, runtimeValues: Record<string,string> = {}, productionExport = false) {
  assertSourceDirectory(project)
  const runtime = inspectRuntime(project, applicationRoot, runtimeValues)
  if (!runtime.supported) throw new RuntimeCompatibilityError(runtime.issues)
  const profileRoot = path.join(applicationRoot, "runtime-profiles", runtime.profile)
  const require = createRequire(path.join(profileRoot, "package.json"))
  const vendorRoot = fs.realpathSync(path.join(profileRoot, "node_modules"))
  // Finite CSS toolchains are loaded only inside their confined worker.
  let compile: typeof import("tailwindcss").compile | undefined
  if (!runtime.cssPlan) {
    if (!isWithin(vendorRoot, fs.realpathSync(require.resolve("tailwindcss")))) throw new Error("Dedicated Tailwind compiler is unavailable; host fallback is forbidden.")
    compile = (require("tailwindcss") as typeof import("tailwindcss")).compile
  }
  const root = fs.realpathSync(project.root)
  let shell = staticHtml(root,runtime.publicDir,runtime.runtimeRoot)
  const prepareCssSource=(file:string,code:string)=>!productionExport && /\.[jt]sx$/.test(file)?instrumentReactSource(file,code):code
  const finiteCss = runtime.cssPlan ? await cssCompiler(root,profileRoot,runtime.cssPlan,prepareCssSource,runtime.runtimeRoot,sourceDirectory(project) === 'src' ? undefined : sourceDirectory(project)) : undefined
  if(runtime.cssPlan?.kind==='unocss'&&shell){
    const index=path.posix.join(runtime.runtimeRoot??'.','index.html')
    shell=staticHtml(root,runtime.publicDir,runtime.runtimeRoot,await finiteCss!.source(index,fs.readFileSync(path.join(root,index),'utf8')))
  }
  const outputRoot = path.join(root, ".webcanbe-virtual-output")
  let bytes = 0
  const tailwindOutputs = new Map<string, string>()
  const options: BuildOptions = {
    entryPoints: [runtime.entry!], absWorkingDir: root, bundle: true, write: false, outdir: outputRoot,
    entryNames: productionExport ? "assets/app" : "_wcb/app", chunkNames: "assets/[name]-[hash]", assetNames: productionExport ? "assets/[name]-[hash]" : "_wcb/assets/[name]-[hash]", publicPath: productionExport ? runtime.base : "/", format: productionExport ? "esm" : "iife", splitting: productionExport, platform: "browser", jsx: "automatic", minify: true,
    metafile: true, tsconfigRaw: { compilerOptions: runtime.compilerOptions }, define: { "process.env.NODE_ENV": '"production"', ...Object.fromEntries(Object.entries(runtime.environment).map(([key, value]) => ["import.meta.env." + key, JSON.stringify(value)])) }, logLevel: "silent",
    plugins: [{ name: "confined-source", setup(builder) {
      builder.onStart(() => { bytes = 0; tailwindOutputs.clear() })
      builder.onResolve({ filter: /.*/ }, async args => {
        if (args.pluginData?.profileResolution) return
        if (productionExport && runtime.exportBuild?.external.includes(args.path)) return { path: args.path, external: true }
        if(args.path==="virtual:uno.css"&&runtime.cssPlan?.kind==="unocss")return {path:"uno.css",namespace:"trusted-uno"}
        // Preserve CSS resource URLs as browser data; never fetch them in the
        // compiler. The controlled HTTP runner still denies all external egress.
        if (transport === "http" && args.importer.endsWith(".css") && ["url-token", "import-rule"].includes(args.kind)) {
          if (/^https?:\/\//i.test(args.path)) {
            const url = new URL(args.path)
            if (url.username || url.password) throw new Error("CSS resource credentials are forbidden.")
            return { path: args.path, external: true }
          }
          if (args.kind === "url-token" && /^data:(?:image\/(?:png|jpeg|gif|webp|avif|svg\+xml)|font\/(?:woff2?|ttf|otf))(?:;[^,]*)?,/i.test(args.path)) return { path: args.path, external: true }
        }
        const vendorImporter = isWithin(vendorRoot, args.importer)
        const alias = Object.keys(runtime.aliases).sort((a, b) => b.length - a.length).find(key => args.path === key || args.path.startsWith(key + "/"))
        let candidate: string
        if (args.kind === "entry-point") candidate = path.resolve(root, args.path)
        else if (alias && !vendorImporter) candidate = path.resolve(root, runtime.aliases[alias], args.path.slice(alias.length + 1))
        else if (args.path.startsWith("./") || args.path.startsWith("../")) candidate = path.resolve(path.dirname(args.importer), args.path)
        else if (transport === "http" && ["url-token", "import-statement"].includes(args.kind) && args.path.startsWith("/") && !args.path.startsWith("//")) {
          const relative = args.path.slice(1)
          if (!safeArchivePath(relative)) throw new Error("Invalid public asset path.")
          if(runtime.publicDir===false)throw Error("Public assets are disabled by source configuration.")
          candidate = path.resolve(root, runtime.publicDir??"public", relative)
        } else {
          const name = args.path.startsWith("@") ? args.path.split("/").slice(0, 2).join("/") : args.path.split("/")[0]
          if (!vendorImporter && !runtime.clientDependencies.includes(name)) throw new Error('Unknown or undeclared preview import: ' + args.path)
          const resolved = await builder.resolve(args.path, { kind: args.kind, resolveDir: vendorImporter ? path.dirname(args.importer) : profileRoot, pluginData: { profileResolution: true } })
          if (resolved.errors.length || !resolved.path || !isWithin(vendorRoot, fs.realpathSync(resolved.path))) throw new Error('Dependency is unavailable in the dedicated profile: ' + args.path)
          return { path: resolved.path, namespace: "confined" }
        }
        const resolved = [candidate, ...[".tsx", ".jsx", ".ts", ".js", ".mts", ".cts", ".mjs", ".cjs", ".css", ".json", "/index.tsx", "/index.jsx", "/index.ts", "/index.js"].map(ext => candidate + ext)].find(file => fs.existsSync(file) && fs.statSync(file).isFile())
        if (!resolved) throw new Error('Preview dependency is unresolved: ' + args.path)
        const actual = fs.realpathSync(resolved)
        const projectRelative = path.relative(root, actual).split(path.sep).join("/")
        if (!vendorImporter && isInertToolingPath(projectRelative)) throw new Error("Inert package-manager tooling cannot be imported or executed.")
        if (!vendorImporter) {
          if (!isWithin(root, resolved)) throw Error("Preview import escaped its permitted root.")
          // Every segment is checked before reading, including in-project links.
          let current = root
          for (const part of path.relative(root, resolved).split(path.sep)) {
            current = path.join(current, part)
            if (fs.lstatSync(current).isSymbolicLink()) throw Error('Source import links are forbidden.')
          }
          if (sourceDirectory(project) !== 'src' && editableModule.test(actual) && !isWithin(project.sourceRoot, actual)) throw Error('Import outside the canonical source tree.')
        }
        if (vendorImporter ? !isWithin(vendorRoot, actual) : !isWithin(root, actual) || !safeArchivePath(path.relative(root, actual))) throw new Error("Preview import escaped its permitted root.")
        return { path: actual, namespace: "confined" }
      })
      builder.onLoad({filter: /.*/,namespace:"trusted-uno"},async()=>({contents:await finiteCss!("/* webcanbe uno entry */"),loader:"css"}))
      builder.onLoad({ filter: /.*/, namespace: "confined" }, async args => {
        const content = fs.readFileSync(args.path)
        bytes += content.length
        if (bytes > 40 * 1024 * 1024 || content.length > 2 * 1024 * 1024) throw new Error("Preview source limit exceeded.")
        const ext = path.extname(args.path).slice(1).replace(/^[mc]([jt])s$/, "$1s")
        const vendor = isWithin(vendorRoot, args.path)
        if (assetTypes[ext]) return { contents: content, loader: transport === "http" ? "file" : "dataurl" }
        if (!["tsx", "jsx", "ts", "js", "css", "json"].includes(ext)) throw new Error("Unsupported preview file type.")
        let code = content.toString("utf8")
        const cached = incremental?.transforms.get(args.path)
        if (ext !== "css" && cached?.source === code) return cached.result
        const originalCode = code
        if (vendor && incremental?.fastRefresh && /^(tsx|jsx|ts|js)$/.test(ext)) code = developmentVendor(code)
        if (ext === "css" && finiteCss) code = await finiteCss(code,path.relative(root,args.path).split(path.sep).join('/'))
        else if (ext === "css") {
          const cssConfig = validateStylesheetConfiguration(code, runtime.profile !== "react19-vite6")
          if (/@import\s+["']tailwindcss["']\s*;/.test(code)) {
            if (!runtime.dependencies.some(item => item.name === "tailwindcss")) throw new Error("Tailwind CSS import is not declared.")
            const themeKey = cssConfig.theme ? code : "default"
            let tailwind = tailwindOutputs.get(themeKey)
            if (!tailwind) {
              const compiler = await compile!(cssConfig.theme ? code : '@import "tailwindcss";', { loadStylesheet: async id => { if (id !== "tailwindcss") throw new Error("External Tailwind stylesheet denied."); return { path: require.resolve("tailwindcss/index.css"), content: fs.readFileSync(require.resolve("tailwindcss/index.css"), "utf8"), base: "" } } })
              const sources = fs.readdirSync(project.sourceRoot, { recursive: true }).filter((file): file is string => typeof file === "string" && /\.(tsx?|jsx?)$/.test(file))
              const candidates = sources.flatMap(file => {
                const absolute = fs.realpathSync(path.join(project.sourceRoot, file))
                if (!isWithin(root, absolute)) throw new Error("Tailwind candidate file escaped the project.")
                return fs.readFileSync(absolute, "utf8").match(/[a-zA-Z0-9_:/.[\]#%()-]+/g) ?? []
              })
              tailwind = compiler.build([...new Set(candidates)])
              tailwindOutputs.set(themeKey, tailwind)
            }
            code = cssConfig.theme ? tailwind : code.replace(/@import\s+["']tailwindcss["']\s*;/g, tailwind)
          }
        }
        if (!vendor && /^(tsx|jsx|ts|js)$/.test(ext) && transport === "blob" && historyImport(code, args.path)) throw new Error("Browser-history router requires an isolated HTTP preview runner. HashRouter is supported.")
        if (!productionExport && !vendor && /^(tsx|jsx)$/.test(ext)) code = instrumentReactSource(path.relative(root, args.path).split(path.sep).join("/"), code)
        if (!vendor && runtime.cssPlan?.kind==='unocss' && /^(tsx|jsx|ts|js)$/.test(ext)) code = await finiteCss!.source(path.relative(root,args.path).split(path.sep).join('/'),code)
        if (!vendor && path.relative(root,args.path).split(path.sep).join("/") === runtime.entry && shell?.styles.length) code = shell.styles.map(file => { const relative=path.relative(path.dirname(args.path),path.join(root,file)).split(path.sep).join("/"); return "import "+JSON.stringify(relative.startsWith(".")?relative:"./"+relative)+";" }).join("\n")+"\n"+code
        const result = { contents: code, loader: args.path.endsWith(".module.css") ? "local-css" as const : ext as Loader, resolveDir: path.dirname(args.path) }
        if (ext !== "css" && incremental) {
          if (incremental.transforms.size >= 2000) incremental.transforms.clear()
          incremental.transforms.set(args.path, { source: originalCode, result })
        }
        return result
      })
    } }],
  }
  const fingerprint = JSON.stringify({ root, transport, runtime, shell, cssSources:finiteCss?.fingerprint })
  const bundle = incremental ? await incremental.build("app", fingerprint, options) : await boundedBuild(options)
  if (productionExport) {
    const modules: Record<string,string> = Object.create(null), files = new Map<string,PreviewArtifact>()
    for (const file of bundle.outputFiles!) {
      const relative = path.relative(outputRoot, file.path).split(path.sep).join('/')
      if (!safeArchivePath(relative)) throw Error('Invalid export artifact path.')
      if (relative.endsWith('.js')) modules[relative] = file.text
      else files.set('/' + relative, { body: Buffer.from(file.contents), contentType: relative.endsWith('.css') ? 'text/css' : assetTypes[path.extname(relative).slice(1)] })
    }
    // Public URL prefixes belong to artifacts, not to Rollup module identity.
    // Rebind only generated static module references to exact emitted members.
    const urls = new Map(Object.keys(modules).map(file => [(runtime.base === './' ? './' : runtime.base) + file, file]))
    for (const [file, code] of Object.entries(modules)) {
      const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS), edits: Array<{start:number;end:number;text:string}> = []
      const visit = (node: ts.Node) => {
        const literal = (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) ? node.moduleSpecifier : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments.length === 1 ? node.arguments[0] : undefined
        if (literal && ts.isStringLiteral(literal) && urls.has(literal.text)) {
          const relative = path.posix.relative(path.posix.dirname(file), urls.get(literal.text)!)
          edits.push({ start: literal.getStart(source), end: literal.getEnd(), text: JSON.stringify(relative.startsWith('.') ? relative : './' + relative) })
        }
        ts.forEachChild(node, visit)
      }
      visit(source)
      modules[file] = edits.sort((a,b) => b.start-a.start).reduce((text,e) => text.slice(0,e.start)+e.text+text.slice(e.end), code)
    }
    const plan = runtime.exportBuild ?? { external: [], output: {} }
    // esbuild resolves/transpiles the application using only the confined graph;
    // Rollup performs production chunking on these immutable ES modules.
    // Rollup is the fixed operator compiler graph, independent of the app's Vite version.
    const output = await buildFiniteExportGraph(path.join(applicationRoot, 'runtime-profiles', PROFILE), 'assets/app.js', modules, plan)
    for (const file of output) files.set('/assets/' + file.fileName, { body: Buffer.from(file.code), contentType: 'text/javascript' })
    return { files, shell }
  }
  const bridgeOptions: BuildOptions = { entryPoints: [path.join(applicationRoot, "src/webcanbe-engine/runtime/previewBridge.ts")], bundle: true, write: false, outfile: path.join(outputRoot, "_wcb/bridge.js"), format: "iife", minify: true, logLevel: "silent", define: { __WCB_HTTP_PREVIEW__: String(transport === "http") } }
  const bridge = incremental ? await incremental.build("bridge", transport, bridgeOptions) : await boundedBuild(bridgeOptions)
  const files = new Map<string, PreviewArtifact>()
  for (const file of [...bridge.outputFiles!, ...bundle.outputFiles!]) {
    const relative = path.relative(outputRoot, file.path).split(path.sep).join("/")
    if (!safeArchivePath(relative)) throw new Error("Invalid preview artifact path.")
    const ext = path.extname(relative).slice(1)
    const contentType = ext === "js" ? "text/javascript; charset=utf-8" : ext === "css" ? "text/css; charset=utf-8" : assetTypes[ext]
    if (!contentType) throw new Error("Unsupported preview artifact type.")
    files.set("/" + relative, { body: Buffer.from(file.contents), contentType })
  }
  if (transport === "http" && incremental?.fastRefresh) incremental.refreshFallback = await fastRefreshArtifacts(bundle, incremental.transforms, root, applicationRoot, runtime.entry!, files, runtime.environment)
  return { files, shell }
}

export async function buildIsolatedPreview(project: ProjectRecord, applicationRoot: string) {
  const { files, shell } = await compilePreview(project, applicationRoot, "blob")
  const js = files.get("/_wcb/bridge.js")!.body.toString() + "\n" + files.get("/_wcb/app.js")!.body.toString()
  const css = files.get("/_wcb/app.css")?.body.toString() ?? ""
  // Retained Phase 2B opaque Blob transport; no same-origin grant.
  const policy = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data:; font-src data:; connect-src \'none\'; base-uri \'none\'; form-action \'none\';">'
  return previewDocument(shell, '<style>'+css.replace(/<\/style/gi,"<\\/style")+'</style>', '<script>'+js.replace(/<\/script/gi,"<\\/script")+'</script>',policy)
}

export async function buildIsolatedHttpPreview(project: ProjectRecord, applicationRoot: string, incremental?: IncrementalPreviewCompiler, runtimeValues: Record<string,string> = {}, productionExport = false): Promise<HttpPreviewBuild> {
  const { files, shell } = await compilePreview(project, applicationRoot, "http", incremental, runtimeValues, productionExport)
  const runtime=inspectRuntime(project,applicationRoot,runtimeValues)
  const publicRoot = path.join(project.root, runtime.publicDir||"public")
  let bytes = [...files.values()].reduce((size, file) => size + file.body.length, 0)
  const base = runtime.base
  if (runtime.publicDir!==false && fs.existsSync(publicRoot)) {
    if (fs.lstatSync(publicRoot).isSymbolicLink()) throw new Error("Public directory links are forbidden.")
    for (const entry of fs.readdirSync(publicRoot, { recursive: true, withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error("Public asset links are forbidden.")
      if (!entry.isFile()) continue
      const absolute = path.join(entry.parentPath, entry.name)
      const relative = path.relative(publicRoot, absolute).split(path.sep).join("/")
      if (!isWithin(publicRoot, fs.realpathSync(absolute)) || !safeArchivePath(relative)) throw new Error("Public asset escaped its root.")
      // Publish only inert images/fonts. Source/config/maps/dotfiles never become artifacts.
      if (relative.split("/").some(part => part.startsWith(".") || /^(?:_wcb|__webcanbe|api|src|node_modules)$/i.test(part))) continue
      const contentType = assetTypes[path.extname(relative).slice(1).toLowerCase()]
      if (!contentType) continue
      const body = fs.readFileSync(absolute)
      bytes += body.length
      if (body.length > 2 * 1024 * 1024 || bytes > 32 * 1024 * 1024 || files.size >= 2000) throw new Error("HTTP artifact limit exceeded.")
      files.set("/" + relative, { body, contentType })
      if (base !== "/" && base !== "./") files.set(base + relative, { body, contentType })
    }
  }
  if (bytes > 32 * 1024 * 1024) throw new Error("HTTP artifact limit exceeded.")
  if (productionExport) {
    const prefix = base === './' ? './' : base
    const css = files.has('/assets/app.css') ? '<link rel="stylesheet" href="' + prefix + 'assets/app.css">' : ''
    return { files, html: previewDocument(shell, css, '<script type="module" src="' + prefix + 'assets/app.js"></script>') }
  }
  const css = files.has("/_wcb/app.css") ? '<link rel="stylesheet" href="/_wcb/app.css">' : ''
  return { files, html: previewDocument(shell, css, '<script src="/_wcb/bridge.js"></script><script src="/_wcb/app.js"></script>') }
}
