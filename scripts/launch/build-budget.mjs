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

const total = sum(() => true)
const jsTotal = sum(item => item.file.endsWith(".js"))
const cssTotal = sum(item => item.file.endsWith(".css"))
const largestJs = max(item => item.file.endsWith(".js"))
const largestCss = max(item => item.file.endsWith(".css"))
const sourceMaps = files.filter(item => item.file.endsWith(".map"))

const limits = {
  total: 15 * 1024 * 1024,
  jsTotal: 2 * 1024 * 1024,
  cssTotal: 220 * 1024,
  largestJs: 700 * 1024,
  largestCss: 180 * 1024,
}

const checks = [
  ["total dist", total <= limits.total, `${mib(total).toFixed(2)} MiB <= 15 MiB`],
  ["total JS", jsTotal <= limits.jsTotal, `${kib(jsTotal).toFixed(1)} KiB <= 2048 KiB`],
  ["total CSS", cssTotal <= limits.cssTotal, `${kib(cssTotal).toFixed(1)} KiB <= 220 KiB`],
  ["largest JS chunk", largestJs.bytes <= limits.largestJs, `${largestJs.file} ${kib(largestJs.bytes).toFixed(1)} KiB <= 700 KiB`],
  ["largest CSS chunk", largestCss.bytes <= limits.largestCss, `${largestCss.file} ${kib(largestCss.bytes).toFixed(1)} KiB <= 180 KiB`],
  ["production source maps", sourceMaps.length === 0, sourceMaps.length ? sourceMaps.map(item => item.file).join(", ") : "none"],
]

let failed = false
for (const [label, ok, detail] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label} — ${detail}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
