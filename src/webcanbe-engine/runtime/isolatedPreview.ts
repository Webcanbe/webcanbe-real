import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { build, type Loader } from "esbuild"
import { compile } from "tailwindcss"
import { instrumentReactSource } from "../adapters/react/reactSourceAdapter"
import { isWithin, safeArchivePath, type ProjectRecord } from "./projectRegistry"

/** No uploaded module is evaluated by Node. All resolution and transforms are owned here. */
export async function buildIsolatedPreview(project: ProjectRecord, applicationRoot: string) {
  if (["tailwind.config.ts", "tailwind.config.js", "tailwind.config.cjs", "tailwind.config.mjs"].some(file => fs.existsSync(path.join(project.root, file)))) throw new Error("Custom Tailwind configuration requires an isolated runner.")
  for (const dependency of project.detection.dependencies.filter(item => ["react", "react-dom"].includes(item.name))) {
    if (!/^[~^]?19(?:\.|$)/.test(dependency.declared)) throw new Error("The controlled preview currently resolves React 19 only.")
  }
  const require = createRequire(path.join(applicationRoot, "package.json"))
  const vendorRoots = ["react", "react-dom", "scheduler"].map(name => fs.realpathSync(path.dirname(require.resolve(`${name}/package.json`))))
  const root = fs.realpathSync(project.root)
  let bytes = 0
  let tailwind: string | undefined
  const bundle = await build({
    entryPoints: [project.detection.entry!], absWorkingDir: root, bundle: true, write: false, outfile: "preview.js", format: "iife", platform: "browser", jsx: "automatic", minify: true,
    tsconfigRaw: {}, define: { "process.env.NODE_ENV": '"production"', "import.meta.env": "{}" }, logLevel: "silent",
    plugins: [{ name: "confined-source", setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => {
        let candidate: string
        const vendorImporter = vendorRoots.some(dir => isWithin(dir, args.importer))
        if (/^(react(?:\/jsx(?:-dev)?-runtime)?|react-dom(?:\/client)?|scheduler)$/.test(args.path)) candidate = require.resolve(args.path)
        else if (args.kind === "entry-point") candidate = path.resolve(root, args.path)
        else if (args.path.startsWith("./") || args.path.startsWith("../")) candidate = path.resolve(path.dirname(args.importer), args.path)
        else throw new Error(`Preview dependency is not approved: ${args.path}`)
        const resolved = [candidate, ...[".tsx", ".jsx", ".ts", ".js", ".css", "/index.tsx", "/index.jsx", "/index.ts", "/index.js"].map(ext => candidate + ext)].find(file => fs.existsSync(file) && fs.statSync(file).isFile())
        if (!resolved) throw new Error(`Preview dependency is unresolved: ${args.path}`)
        const actual = fs.realpathSync(resolved)
        const vendor = vendorRoots.some(dir => isWithin(dir, actual))
        if (!vendor && (!isWithin(root, actual) || !safeArchivePath(path.relative(root, actual)))) throw new Error("Preview import escaped the project.")
        if (vendor && !vendorImporter && args.path.startsWith(".")) throw new Error("Relative import escaped into application dependencies.")
        return { path: actual, namespace: "confined" }
      })
      builder.onLoad({ filter: /.*/, namespace: "confined" }, async args => {
        const content = fs.readFileSync(args.path)
        bytes += content.length
        if (bytes > 40 * 1024 * 1024 || content.length > 2 * 1024 * 1024) throw new Error("Preview source limit exceeded.")
        const ext = path.extname(args.path).slice(1)
        const vendor = vendorRoots.some(dir => isWithin(dir, args.path))
        if (/^(png|jpg|jpeg|gif|webp|svg|woff|woff2)$/.test(ext)) return { contents: content, loader: "dataurl" }
        if (!["tsx", "jsx", "ts", "js", "css", "json"].includes(ext)) throw new Error("Unsupported preview file type.")
        let code = content.toString("utf8")
        if (ext === "css") {
          if (/@(?:plugin|config|source|tailwind)\b/i.test(code)) throw new Error("Tailwind plugins, configuration and filesystem scanning are disabled in previews.")
          if (/@import\s+["']tailwindcss["']\s*;/.test(code)) {
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
        if (!vendor && /^(tsx|jsx)$/.test(ext)) code = instrumentReactSource(path.relative(root, args.path).split(path.sep).join("/"), code)
        return { contents: code, loader: args.path.endsWith(".module.css") ? "local-css" : ext as Loader, resolveDir: path.dirname(args.path) }
      })
    } }],
  })
  const bridge = await build({ entryPoints: [path.join(applicationRoot, "src/webcanbe-engine/runtime/previewBridge.ts")], bundle: true, write: false, format: "iife", minify: true, logLevel: "silent" })
  const js = bridge.outputFiles[0].text + "\n" + (bundle.outputFiles.find(file => file.path.endsWith(".js"))?.text ?? "")
  const css = bundle.outputFiles.find(file => file.path.endsWith(".css"))?.text ?? ""
  // srcdoc has an opaque origin. Network, frames, workers, forms and navigation of the parent are denied.
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none';"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css.replace(/<\/style/gi, "<\\/style")}</style></head><body><div id="root"></div><script>${js.replace(/<\/script/gi, "<\\/script")}</script></body></html>`
}
