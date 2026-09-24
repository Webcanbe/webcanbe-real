import fs from "node:fs"
import path from "node:path"

const root = path.resolve(process.argv[2] || "dist")
if (!fs.existsSync(root)) {
  console.error("Build budget requires an existing dist directory.")
  process.exit(1)
}

const files = []
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (entry.isFile()) files.push({ file: path.relative(root, full).split(path.sep).join("/"), bytes: fs.statSync(full).size })
  }
}
walk(root)

const sum = predicate => files.filter(predicate).reduce((total, item) => total + item.bytes, 0)
const max = predicate => files.filter(predicate).reduce((largest, item) => item.bytes > largest.bytes ? item : largest, { file: "", bytes: 0 })
const mib = value => value / (1024 * 1024)
const kib = value => value / 1024

const isPreview = item => /^assets\/(?:preview-runtime|PreviewRuntimeHost)-[^/]+\.js$/.test(item.file)
const isSourceDemo = item => item.file.startsWith("demo/aperture-north/") || item.file.startsWith("demo/stillform/") || item.file.startsWith("template-source/")
const total = sum(() => true)
const appTotal = sum(item => !isPreview(item) && !isSourceDemo(item))
const jsInventory = sum(item => !isPreview(item) && !isSourceDemo(item) && item.file.endsWith(".js"))
const cssInventory = sum(item => !isPreview(item) && !isSourceDemo(item) && item.file.endsWith(".css"))

// The app, public landing, docs, and editor are separate entry/dynamic routes.
// Aggregate bytes for mutually exclusive chunks are an inventory, not a browser
// download. Vite's manifest gives the actual static import graph for each route.
const manifestPath = path.join(root, ".vite/manifest.json")
if (!fs.existsSync(manifestPath)) {
  console.error("Build budget requires Vite's production asset manifest.")
  process.exit(1)
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"))
const entry = "index.html"
const previewEntry = "src/preview-runtime.ts"
const posthog = Object.keys(manifest).find(key => key.includes("posthog-js/dist/module"))
const buildLeague = Object.keys(manifest).find(key => key === "src/BuildLeague.tsx")
if (!manifest[entry]?.isEntry || !manifest[previewEntry]?.file || !posthog || !buildLeague) throw new Error("Expected app, preview, global analytics, and Build League chunks in Vite manifest.")
const fileBytes = new Map(files.map(item => [item.file, item.bytes]))
function routeFiles(keys) {
  const visited = new Set(), delivered = new Set()
  function add(key) {
    if (visited.has(key)) return
    const chunk = manifest[key]
    if (!chunk) throw new Error(`Missing manifest import: ${key}`)
    visited.add(key)
    delivered.add(chunk.file)
    for (const css of chunk.css || []) delivered.add(css)
    for (const dependency of chunk.imports || []) add(dependency)
  }
  keys.forEach(add)
  return delivered
}
function routeBytes(keys, extension) {
  return [...routeFiles(keys)].filter(file => file.endsWith(extension)).reduce((bytes, file) => {
    if (!fileBytes.has(file)) throw new Error(`Missing built asset: ${file}`)
    return bytes + fileBytes.get(file)
  }, 0)
}
// Analytics initializes on every app entry and Build League chrome mounts on
// every app route. Include both in every candidate route, even though Vite emits
// them as dynamic imports. A route may also load its own dynamic chunk.
const globalRoute = [entry, posthog, buildLeague]
const dynamicRoutes = Object.keys(manifest).filter(key => manifest[key].isDynamicEntry && !key.includes("preview-runtime"))
const appRoutes = [globalRoute, ...dynamicRoutes.map(key => [...globalRoute, key])]
const publicJs = sum(item => !item.file.startsWith("assets/") && !isSourceDemo(item) && item.file.endsWith(".js"))
const publicCss = sum(item => !item.file.startsWith("assets/") && !isSourceDemo(item) && item.file.endsWith(".css"))
const jsTotal = Math.max(publicJs, ...appRoutes.map(keys => routeBytes(keys, ".js")))
const cssTotal = Math.max(publicCss, ...appRoutes.map(keys => routeBytes(keys, ".css")))
const appCssTotal = routeBytes(globalRoute, ".css")
const largestJs = max(item => !isPreview(item) && item.file.endsWith(".js"))
const largestCss = max(item => !isPreview(item) && item.file.endsWith(".css"))
const previewFiles = routeFiles([previewEntry])
const previewTotal = [...previewFiles].reduce((bytes, file) => bytes + (fileBytes.get(file) ?? 0), 0)
const previewJsTotal = routeBytes([previewEntry], ".js")
const previewLargestJs = max(item => isPreview(item) && item.file.endsWith(".js"))
const sourceDemoTotal = sum(isSourceDemo)
const sourceMaps = files.filter(item => item.file.endsWith(".map"))

const limits = {
  total: 30 * 1024 * 1024,
  appTotal: 15 * 1024 * 1024,
  jsTotal: 2 * 1024 * 1024,
  cssTotal: 560 * 1024,
  appCssTotal: 230 * 1024,
  largestJs: 700 * 1024,
  largestCss: 300 * 1024,
  previewTotal: 14 * 1024 * 1024,
  previewJsTotal: 13 * 1024 * 1024,
  previewLargestJs: 13 * 1024 * 1024,
  sourceDemoTotal: 12 * 1024 * 1024,
}

const checks = [
  ["total dist", total <= limits.total, `${mib(total).toFixed(2)} MiB <= 30 MiB`],
  ["app dist", appTotal <= limits.appTotal, `${mib(appTotal).toFixed(2)} MiB <= 15 MiB`],
  ["route JS", jsTotal <= limits.jsTotal, `${kib(jsTotal).toFixed(1)} KiB <= 2048 KiB (inventory ${kib(jsInventory).toFixed(1)} KiB)`],
  ["route CSS", cssTotal <= limits.cssTotal, `${kib(cssTotal).toFixed(1)} KiB <= 560 KiB (inventory ${kib(cssInventory).toFixed(1)} KiB)`],
  ["app entry CSS", appCssTotal <= limits.appCssTotal, `${kib(appCssTotal).toFixed(1)} KiB <= 230 KiB`],
  ["largest JS chunk", largestJs.bytes <= limits.largestJs, `${largestJs.file} ${kib(largestJs.bytes).toFixed(1)} KiB <= 700 KiB`],
  ["largest CSS chunk", largestCss.bytes <= limits.largestCss, `${largestCss.file} ${kib(largestCss.bytes).toFixed(1)} KiB <= 300 KiB`],
  ["preview runtime total", previewTotal <= limits.previewTotal, `${mib(previewTotal).toFixed(2)} MiB <= 14 MiB`],
  ["preview runtime JS", previewJsTotal <= limits.previewJsTotal, `${mib(previewJsTotal).toFixed(2)} MiB <= 13 MiB`],
  ["preview largest JS", previewLargestJs.bytes <= limits.previewLargestJs, `${previewLargestJs.file} ${mib(previewLargestJs.bytes).toFixed(2)} MiB <= 13 MiB`],
  ["first-party templates and source", sourceDemoTotal <= limits.sourceDemoTotal, `${mib(sourceDemoTotal).toFixed(2)} MiB <= 12 MiB`],
  ["production source maps", sourceMaps.length === 0, sourceMaps.length ? sourceMaps.map(item => item.file).join(", ") : "none"],
]

let failed = false
for (const [label, ok, detail] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label} — ${detail}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
