import path from "node:path"
import { createHash } from "node:crypto"
import { createRequire } from "node:module"
import { build, transform, type BuildResult, type OnLoadResult, type Loader } from "esbuild"
import ts from "typescript"
import type { PreviewArtifact } from "./isolatedPreview"
import type { RefreshManifest } from "./refreshPolicy"

export function developmentVendor(code: string) {
  const ast = ts.createSourceFile("vendor.js", code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS), ranges: Array<[number,number]> = []
  const visit = (node: ts.Node) => { if (ts.isPropertyAccessExpression(node) && node.getText(ast) === "process.env.NODE_ENV") ranges.push([node.getStart(ast), node.end]); else ts.forEachChild(node, visit) }; visit(ast)
  for (const [start,end] of ranges.sort((a,b) => b[0]-a[0])) code = code.slice(0,start) + '"development"' + code.slice(end)
  return code
}
function componentBoundary(file: string, code: string) {
  if (!/\.[jt]sx$/.test(file)) return false
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let exports = 0, safe = true
  for (const statement of source.statements) {
    if (ts.isExportDeclaration(statement)) { safe = false; continue }
    if (ts.isExportAssignment(statement)) { exports++; safe &&= ts.isIdentifier(statement.expression) && /^[A-Z]/.test(statement.expression.text); continue }
    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined
    if (!modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) continue
    if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) continue
    exports++
    if (ts.isFunctionDeclaration(statement)) safe &&= Boolean(statement.name && /^[A-Z]/.test(statement.name.text))
    else if (ts.isVariableStatement(statement)) safe &&= statement.declarationList.declarations.every(d => ts.isIdentifier(d.name) && /^[A-Z]/.test(d.name.text) && Boolean(d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))))
    else safe = false
  }
  return safe && exports > 0
}
/** The already confined esbuild graph is reused as data. Babel configuration is
 * explicitly disabled. No uploaded module/config is evaluated on this host. */
export async function fastRefreshArtifacts(bundle: BuildResult, sources: Map<string, { source: string; result: OnLoadResult }>, root: string, applicationRoot: string, entry: string, files: Map<string, PreviewArtifact>, environment: Record<string, string | boolean>): Promise<string | undefined> {
  const metadata = bundle.metafile!
  const inputs = Object.keys(metadata.inputs)
  // CSS module export maps, dynamic imports and CommonJS project code need a
  // richer update graph. Preserve the standard rebuild/reload for those cases.
  if (inputs.some(key => key.endsWith(".module.css") || metadata.inputs[key].imports.some(i => i.kind === "dynamic-import"))) return "CSS Modules/dynamic imports require the normal incremental rebuild/reload profile."
  const require = createRequire(path.join(applicationRoot, "package.json")), babel = require("@babel/core"), refreshPlugin = require("react-refresh/babel")
  const id = (key: string) => createHash("sha256").update(key.startsWith("confined:") ? path.relative(root, key.slice(9)) : key).digest("hex").slice(0,24)
  const manifest: RefreshManifest = { version: 1, entry: "", modules: Object.create(null) }
  for (const key of inputs) {
    const full = key.replace(/^confined:/, ""), current = id(key), vendor = full.includes(path.sep + "node_modules" + path.sep), source = sources.get(full)
    if (full === path.join(root, entry)) manifest.entry = current
    const imports: Record<string,string> = Object.create(null)
    for (const dependency of metadata.inputs[key].imports) {
      // esbuild marks an unused/type-only import external without resolving it.
      // It receives no require mapping; any unexpected live use fails closed.
      if (dependency.external) continue
      if (!dependency.original || !metadata.inputs[dependency.path]) return "An unresolved module edge requires rebuild/reload."
      imports[dependency.original] = id(dependency.path)
    }
    let code: string, boundary = false
    if (key.endsWith(".css")) code = "module.exports = {}"
    else if (!source) {
      const artifact = Object.entries(metadata.outputs).find(([name,output]) => output.inputs[key] && !output.entryPoint && !/\.(?:js|css)$/.test(name))
      // File loader outputs have exactly one matching input and an inert extension.
      const name = artifact && "/" + path.relative(path.join(root, ".webcanbe-virtual-output"), path.resolve(root, artifact[0])).split(path.sep).join("/")
      if (!name || !files.has(name) || /\.(?:js|css)$/.test(name)) return "An unsupported asset module requires rebuild/reload."
      code = "module.exports = " + JSON.stringify(name)
    } else {
      const original = String(source.result.contents), extension = path.extname(full).slice(1).replace(/^[mc]js$/, "js")
      boundary = !vendor && componentBoundary(full, source.source)
      let transformed = original
      if (!vendor) {
        const stripped = await transform(original, { loader: extension as Loader, jsx: "preserve", target: "es2020", logLevel: "silent" })
        transformed = babel.transformSync(stripped.code, { filename: "component.jsx", babelrc: false, configFile: false, plugins: [[refreshPlugin, { skipEnvCheck: true }]], parserOpts: { plugins: ["jsx"] }, sourceMaps: false, comments: true }).code
      }
      code = (await transform(transformed, { loader: extension === "json" ? "json" : "jsx", format: "cjs", jsx: "automatic", target: "es2020", define: { "process.env.NODE_ENV": vendor ? '"development"' : '"production"', ...Object.fromEntries(Object.entries(environment).map(([k,v]) => ["import.meta.env."+k,JSON.stringify(v)])) }, logLevel: "silent" })).code
    }
    // esbuild's automatic JSX transform introduces this known graph edge.
    if (code.includes('require("react/jsx-runtime")') && !imports["react/jsx-runtime"]) {
      const runtime = inputs.find(input => /node_modules\/react\/jsx-runtime\.js$/.test(input))
      if (!runtime) return "JSX runtime graph is unavailable."
      imports["react/jsx-runtime"] = id(runtime)
    }
    manifest.modules[current] = { code, imports, boundary }
  }
  if (!manifest.entry) return "Refresh entry is unavailable."
  const runtime = await build({ stdin: { contents: 'module.exports = require("react-refresh/runtime")', resolveDir: applicationRoot }, bundle: true, platform: "browser", format: "iife", globalName: "__wcbRefreshLibrary", write: false, define: { "process.env.NODE_ENV": '"development"' }, logLevel: "silent" })
  const bootstrap = runtime.outputFiles![0].text + `\n(()=>{const refresh=__wcbRefreshLibrary;refresh.injectIntoGlobalHook(window);let manifest=${JSON.stringify(manifest)};const cache=Object.create(null);
function load(id){if(cache[id])return cache[id].exports;const spec=manifest.modules[id];if(!spec)throw Error('Unknown confined module');const module=cache[id]={exports:{}};const localRequire=name=>{if(!Object.prototype.hasOwnProperty.call(spec.imports,name))throw Error('Unmapped confined import');return load(spec.imports[name])};const register=(type,name)=>refresh.register(type,id+' '+name);new Function('module','exports','require','$RefreshReg$','$RefreshSig$',spec.code)(module,module.exports,localRequire,register,refresh.createSignatureFunctionForTransform);return module.exports}
function boundary(exports){const keys=Object.keys(exports).filter(k=>k!=='__esModule');return keys.length>0&&keys.every(k=>refresh.isLikelyComponentType(exports[k]))}
window.__wcbApplyRefresh=(next,changed)=>{for(const id of changed)if(!cache[id]||!boundary(cache[id].exports))throw Error('Refresh boundary changed');manifest=next;for(const id of changed){delete cache[id];if(!boundary(load(id)))throw Error('Refresh export changed')}refresh.performReactRefresh();return true};load(manifest.entry)})();`
  files.set("/_wcb/app.js", { contentType: "text/javascript; charset=utf-8", body: Buffer.from(bootstrap) })
  files.set("/_wcb/refresh.json", { contentType: "application/json", body: Buffer.from(JSON.stringify(manifest)) })
  return undefined
}
