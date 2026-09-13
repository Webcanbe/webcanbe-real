import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { build, type Loader } from "esbuild"
import ts from "typescript"
import { clientPackages, inspectRuntime, PROFILE, RuntimeCompatibilityError } from "./runtimeCompatibility"
import { instrumentReactSource } from "../adapters/react/reactSourceAdapter"
import { isWithin, safeArchivePath, type ProjectRecord } from "./projectRegistry"

/** No uploaded module is evaluated by Node. All resolution and transforms are owned here. */
export async function buildIsolatedPreview(project: ProjectRecord, applicationRoot: string) {
  const runtime = inspectRuntime(project, applicationRoot)
  if (!runtime.supported) throw new RuntimeCompatibilityError(runtime.issues)
  const profileRoot = path.join(applicationRoot, "runtime-profiles", PROFILE)
  const require = createRequire(path.join(profileRoot, "package.json"))
  const vendorRoot = fs.realpathSync(path.join(profileRoot, "node_modules"))
  if (!isWithin(vendorRoot, fs.realpathSync(require.resolve("tailwindcss")))) throw new Error("Dedicated Tailwind compiler is unavailable; host fallback is forbidden.")
  const { compile } = require("tailwindcss") as typeof import("tailwindcss")
  const root = fs.realpathSync(project.root)
  let bytes = 0
  let tailwind: string | undefined
  const bundle = await build({
    entryPoints: [runtime.entry!], absWorkingDir: root, bundle: true, write: false, outfile: "preview.js", format: "iife", platform: "browser", jsx: "automatic", minify: true,
    tsconfigRaw: {}, define: { "process.env.NODE_ENV": '"production"', "import.meta.env": "{}" }, logLevel: "silent",
    plugins: [{ name: "confined-source", setup(builder) {
      builder.onResolve({ filter: /.*/ }, async args => {
        if (args.pluginData?.profileResolution) return
        const vendorImporter = isWithin(vendorRoot, args.importer)
        const alias = Object.keys(runtime.aliases).sort((a, b) => b.length - a.length).find(key => args.path === key || args.path.startsWith(key + "/"))
        let candidate: string
        if (args.kind === "entry-point") candidate = path.resolve(root, args.path)
        else if (alias && !vendorImporter) candidate = path.resolve(root, runtime.aliases[alias], args.path.slice(alias.length + 1))
        else if (args.path.startsWith("./") || args.path.startsWith("../")) candidate = path.resolve(path.dirname(args.importer), args.path)
        else {
          const name = args.path.startsWith("@") ? args.path.split("/").slice(0, 2).join("/") : args.path.split("/")[0]
          if (!vendorImporter && (!clientPackages.has(name) || !runtime.dependencies.some(dependency => dependency.name === name))) throw new Error(`Unknown or undeclared preview import: ${args.path}`)
          const resolved = await builder.resolve(args.path, { kind: args.kind, resolveDir: vendorImporter ? path.dirname(args.importer) : profileRoot, pluginData: { profileResolution: true } })
          if (resolved.errors.length || !resolved.path || resolved.external || !fs.existsSync(resolved.path) || !isWithin(vendorRoot, fs.realpathSync(resolved.path))) throw new Error(`Dependency is unavailable in the dedicated profile: ${args.path}`)
          return { path: fs.realpathSync(resolved.path), namespace: "confined" }
        }
        const resolved = [candidate, ...[".tsx", ".jsx", ".ts", ".js", ".css", ".json", "/index.tsx", "/index.jsx", "/index.ts", "/index.js"].map(ext => candidate + ext)].find(file => fs.existsSync(file) && fs.statSync(file).isFile())
        if (!resolved) throw new Error(`Preview dependency is unresolved: ${args.path}`)
        const actual = fs.realpathSync(resolved)
        if (vendorImporter ? !isWithin(vendorRoot, actual) : !isWithin(root, actual) || !safeArchivePath(path.relative(root, actual))) throw new Error("Preview import escaped its permitted root.")
        return { path: actual, namespace: "confined" }
      })
      builder.onLoad({ filter: /.*/, namespace: "confined" }, async args => {
        const content = fs.readFileSync(args.path)
        bytes += content.length
        if (bytes > 40 * 1024 * 1024 || content.length > 2 * 1024 * 1024) throw new Error("Preview source limit exceeded.")
        const ext = path.extname(args.path).slice(1).replace(/^[mc]js$/, "js")
        const vendor = isWithin(vendorRoot, args.path)
        if (/^(png|jpg|jpeg|gif|webp|svg|woff|woff2)$/.test(ext)) return { contents: content, loader: "dataurl" }
        if (!["tsx", "jsx", "ts", "js", "css", "json"].includes(ext)) throw new Error("Unsupported preview file type.")
        let code = content.toString("utf8")
        if (ext === "css") {
          if (/@(?:plugin|config|source|tailwind|theme|utility|variant|custom-variant|apply|reference|screen)\b/i.test(code)) throw new Error("Tailwind plugins, configuration and filesystem scanning are disabled in previews.")
          if (/@import\s+["']tailwindcss["']\s*;/.test(code)) {
            if (!runtime.dependencies.some(item => item.name === "tailwindcss")) throw new Error("Tailwind must be declared by the imported project.")
            if (tailwind === undefined) {
              // Compile only the installed default theme; never load project plugins/config.
              const compiler = await compile(fs.readFileSync(require.resolve("tailwindcss/index.css"), "utf8"))
              const sources = fs.readdirSync(project.sourceRoot, { recursive: true }).filter((file): file is string => typeof file === "string" && /\.(tsx?|jsx?)$/.test(file))
              const candidates = sources.flatMap(file => {
                const absolute = fs.realpathSync(path.join(project.sourceRoot, file))
                if (!isWithin(root, absolute)) throw new Error("Tailwind candidate file escaped the project.")
                return fs.readFileSync(absolute, "utf8").match(/[a-zA-Z0-9_:/.[\]#%()-]+/g) ?? []
              })
              tailwind = compiler.build([...new Set(candidates)])
            }
            code = code.replace(/@import\s+["']tailwindcss["']\s*;/g, tailwind)
          }
        }
        if (!vendor && /^(tsx|jsx|ts|js)$/.test(ext)) {
          const parsed = ts.createSourceFile(args.path, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
          for (const statement of parsed.statements.filter(ts.isImportDeclaration)) {
            if (ts.isStringLiteral(statement.moduleSpecifier) && /^react-router(?:-dom)?$/.test(statement.moduleSpecifier.text)) {
              const bindings = statement.importClause?.namedBindings
              if (bindings && (!ts.isNamedImports(bindings) || bindings.elements.some(item => ["BrowserRouter", "createBrowserRouter", "unstable_HistoryRouter"].includes(item.propertyName?.text ?? item.name.text)))) throw new Error("Browser-history router requires an isolated HTTP preview runner. HashRouter is supported.")
            }
          }
        }
        if (!vendor && /^(tsx|jsx)$/.test(ext)) code = instrumentReactSource(path.relative(root, args.path).split(path.sep).join("/"), code)
        return { contents: code, loader: args.path.endsWith(".module.css") ? "local-css" : ext as Loader, resolveDir: path.dirname(args.path) }
      })
    } }],
  })
  const bridge = await build({ entryPoints: [path.join(applicationRoot, "src/webcanbe-engine/runtime/previewBridge.ts")], bundle: true, write: false, format: "iife", minify: true, logLevel: "silent" })
  const js = bridge.outputFiles[0].text + "\n" + (bundle.outputFiles.find(file => file.path.endsWith(".js"))?.text ?? "")
  const css = bundle.outputFiles.find(file => file.path.endsWith(".css"))?.text ?? ""
  // The editor loads this HTML as a Blob in sandbox="allow-scripts" (no same-origin grant).
  // The document remains opaque; CSP denies network, frames, workers and forms.
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none';"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css.replace(/<\/style/gi, "<\\/style")}</style></head><body><div id="root"></div><script>${js.replace(/<\/script/gi, "<\\/script")}</script></body></html>`
}
