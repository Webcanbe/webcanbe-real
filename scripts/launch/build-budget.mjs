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
const isSourceDemo = item => item.file.startsWith("demo/aperture-north/")
const isDeferredRouteCss = item => /^assets\/(?:creator-shell|control-requests|my-requests)-[^/]+\.css$/.test(item.file)
const total = sum(() => true)
const appTotal = sum(item => !isPreview(item) && !isSourceDemo(item))
const jsTotal = sum(item => !isPreview(item) && !isSourceDemo(item) && item.file.endsWith(".js"))
const cssTotal = sum(item => !isPreview(item) && !isSourceDemo(item) && item.file.endsWith(".css"))
const appCssTotal = sum(item => !isPreview(item) && !isDeferredRouteCss(item) && item.file.startsWith("assets/") && item.file.endsWith(".css"))
const largestJs = max(item => !isPreview(item) && item.file.endsWith(".js"))
const largestCss = max(item => !isPreview(item) && item.file.endsWith(".css"))
const previewTotal = sum(isPreview)
const previewJsTotal = sum(item => isPreview(item) && item.file.endsWith(".js"))
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
  sourceDemoTotal: 3 * 1024 * 1024,
}

const checks = [
  ["total dist", total <= limits.total, `${mib(total).toFixed(2)} MiB <= 30 MiB`],
  ["app dist", appTotal <= limits.appTotal, `${mib(appTotal).toFixed(2)} MiB <= 15 MiB`],
  ["total JS", jsTotal <= limits.jsTotal, `${kib(jsTotal).toFixed(1)} KiB <= 2048 KiB`],
  ["total CSS", cssTotal <= limits.cssTotal, `${kib(cssTotal).toFixed(1)} KiB <= 560 KiB`],
  ["app CSS", appCssTotal <= limits.appCssTotal, `${kib(appCssTotal).toFixed(1)} KiB <= 230 KiB`],
  ["largest JS chunk", largestJs.bytes <= limits.largestJs, `${largestJs.file} ${kib(largestJs.bytes).toFixed(1)} KiB <= 700 KiB`],
  ["largest CSS chunk", largestCss.bytes <= limits.largestCss, `${largestCss.file} ${kib(largestCss.bytes).toFixed(1)} KiB <= 300 KiB`],
  ["preview runtime total", previewTotal <= limits.previewTotal, `${mib(previewTotal).toFixed(2)} MiB <= 14 MiB`],
  ["preview runtime JS", previewJsTotal <= limits.previewJsTotal, `${mib(previewJsTotal).toFixed(2)} MiB <= 13 MiB`],
  ["preview largest JS", previewLargestJs.bytes <= limits.previewLargestJs, `${previewLargestJs.file} ${mib(previewLargestJs.bytes).toFixed(2)} MiB <= 13 MiB`],
  ["source demo", sourceDemoTotal <= limits.sourceDemoTotal, `${mib(sourceDemoTotal).toFixed(2)} MiB <= 3 MiB`],
  ["production source maps", sourceMaps.length === 0, sourceMaps.length ? sourceMaps.map(item => item.file).join(", ") : "none"],
]

let failed = false
for (const [label, ok, detail] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label} — ${detail}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
