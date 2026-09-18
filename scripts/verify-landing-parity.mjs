import { promises as fs } from "node:fs"
import http from "node:http"
import path from "node:path"
import * as parse5 from "parse5"
import { chromium } from "playwright"
import pixelmatch from "pixelmatch"
import { PNG } from "pngjs"

const publicRoot = path.resolve("public")
const referenceSource = path.resolve(".landing-reference/index.html")
const referenceTarget = path.join(publicRoot, "wcb-landing", "__reference.html")
const evidenceDir = path.resolve(".landing-parity")
await fs.mkdir(evidenceDir, { recursive: true })

const getAttr = (node, name) => node.attrs?.find(attr => attr.name === name)?.value
function sanitizeReference(parent) {
  if (!parent?.childNodes) return
  const next = []
  for (const node of parent.childNodes) {
    if (node.tagName === "script") continue
    if (node.tagName === "template" && getAttr(node, "data-dgst")) continue
    sanitizeReference(node)
    if (node.content) sanitizeReference(node.content)
    next.push(node)
  }
  parent.childNodes = next
}
const referenceRaw = await fs.readFile(referenceSource, "utf8")
const referenceDoc = parse5.parse(referenceRaw)
sanitizeReference(referenceDoc)
await fs.writeFile(referenceTarget, parse5.serialize(referenceDoc))

const mime = file => {
  const ext = path.extname(file).toLowerCase()
  return ext === ".html" ? "text/html; charset=utf-8"
    : ext === ".css" ? "text/css; charset=utf-8"
    : ext === ".js" || ext === ".mjs" ? "text/javascript; charset=utf-8"
    : ext === ".svg" ? "image/svg+xml"
    : ext === ".png" ? "image/png"
    : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg"
    : ext === ".webp" ? "image/webp"
    : ext === ".avif" ? "image/avif"
    : ext === ".woff2" ? "font/woff2"
    : "application/octet-stream"
}
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://127.0.0.1")
    let pathname = decodeURIComponent(url.pathname)
    if (pathname === "/") pathname = "/wcb-landing/index.html"
    const file = path.resolve(publicRoot, "." + pathname)
    if (!file.startsWith(publicRoot + path.sep)) throw new Error("outside root")
    const data = await fs.readFile(file)
    res.writeHead(200, { "content-type": mime(file), "cache-control": "no-store" })
    res.end(data)
  } catch {
    res.writeHead(404)
    res.end("not found")
  }
})
await new Promise(resolve => server.listen(4179, "127.0.0.1", resolve))

const browser = await chromium.launch({ headless: true })
const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
]
const results = []

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      colorScheme: "light",
      deviceScaleFactor: 1,
    })
    const page = await context.newPage()
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" })

    const load = async (url, name, forbidLaunch) => {
      const launchRequests = []
      const onRequest = request => {
        if (/launchuicomponents\.com/.test(request.url())) launchRequests.push(request.url())
      }
      page.on("request", onRequest)
      await page.goto(url, { waitUntil: "networkidle", timeout: 90000 })
      await page.waitForTimeout(3000)
      const image = await page.screenshot({ fullPage: true, animations: "disabled" })
      await fs.writeFile(path.join(evidenceDir, name + ".png"), image)
      page.off("request", onRequest)
      if (forbidLaunch && launchRequests.length) {
        throw new Error("Localized page still requested Launch UI assets: " + JSON.stringify([...new Set(launchRequests)].slice(0,20)))
      }
      return PNG.sync.read(image)
    }

    const before = await load("http://127.0.0.1:4179/wcb-landing/__reference.html", viewport.name + "-before", false)
    const after = await load("http://127.0.0.1:4179/wcb-landing/index.html", viewport.name + "-after", true)

    if (before.width !== after.width || before.height !== after.height) {
      throw new Error(`${viewport.name}: screenshot geometry changed ${before.width}x${before.height} -> ${after.width}x${after.height}`)
    }
    const diff = new PNG({ width: before.width, height: before.height })
    const mismatched = pixelmatch(before.data, after.data, diff.data, before.width, before.height, {
      threshold: 0.1,
      includeAA: false,
    })
    const pixels = before.width * before.height
    const ratio = mismatched / pixels
    await fs.writeFile(path.join(evidenceDir, viewport.name + "-diff.png"), PNG.sync.write(diff))
    results.push({ viewport: viewport.name, width: before.width, height: before.height, mismatched, pixels, ratio })
    if (ratio > 0.005) {
      throw new Error(`${viewport.name}: visual parity exceeded 0.5% threshold (${(ratio * 100).toFixed(4)}%)`)
    }
    await context.close()
  }
} finally {
  await browser.close()
  server.close()
  await fs.rm(referenceTarget, { force: true })
}

await fs.writeFile(path.join(evidenceDir, "report.json"), JSON.stringify({ threshold: 0.005, results }, null, 2) + "\n")
console.log(JSON.stringify(results, null, 2))
