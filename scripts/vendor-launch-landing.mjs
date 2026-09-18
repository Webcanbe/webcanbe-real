import { promises as fs } from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import * as parse5 from "parse5"

const publicRoot = path.resolve("public")
const landingPath = path.join(publicRoot, "wcb-landing", "index.html")
const vendorRoot = path.join(publicRoot, "wcb-landing", "vendor")
const origin = "https://www.launchuicomponents.com"

const variantSelection = new Map([
  ["hero-variants", 1],
  ["logos-variants", 1],
  ["bento-grid-variants", 1],
  ["items-variants", 1],
  ["faq-variants", 1],
  ["cta-variants", 1],
  ["testimonials-variants", 1],
  ["social-proof-variants", 1],
  ["feature-variants", 5],
  ["stats-variants", 1],
])

const report = {
  inputBytes: 0,
  outputBytes: 0,
  removedScripts: 0,
  removedTemplates: 0,
  removedDarkOnlyNodes: 0,
  removedVariantSubtrees: 0,
  variantContainers: {},
  downloadedAssets: 0,
  downloadedBytes: 0,
  externalAssetReferencesAfter: [],
  nextAssetReferencesAfter: [],
}

const getAttr = (node, name) => node.attrs?.find(attr => attr.name === name)?.value
const setAttr = (node, name, value) => {
  node.attrs ??= []
  const found = node.attrs.find(attr => attr.name === name)
  if (found) found.value = value
  else node.attrs.push({ name, value })
}
const removeAttr = (node, name) => {
  if (node.attrs) node.attrs = node.attrs.filter(attr => attr.name !== name)
}
const classes = node => (getAttr(node, "class") || "").split(/\s+/).filter(Boolean)
const isElement = node => Boolean(node?.tagName)
const countElements = node => {
  let count = isElement(node) ? 1 : 0
  for (const child of node.childNodes || []) count += countElements(child)
  if (node.content) count += countElements(node.content)
  return count
}
const darkOnly = node => {
  const tokens = classes(node)
  return tokens.includes("hidden") && tokens.some(token => /^dark:(block|flex|grid|inline|inline-block|inline-flex)$/.test(token))
}

function pruneTree(parent) {
  if (!parent?.childNodes) return
  const next = []
  for (const node of parent.childNodes) {
    if (node.tagName === "script") {
      report.removedScripts++
      continue
    }
    if (node.tagName === "template" && getAttr(node, "data-dgst")) {
      report.removedTemplates++
      continue
    }
    if (isElement(node) && darkOnly(node)) {
      report.removedDarkOnlyNodes += countElements(node)
      continue
    }
    if (isElement(node)) {
      const tokens = classes(node)
      const variantClass = tokens.find(token => variantSelection.has(token))
      if (variantClass) {
        const selected = variantSelection.get(variantClass)
        const elementChildren = (node.childNodes || []).filter(isElement)
        const keep = elementChildren[selected - 1]
        if (!keep) throw new Error(`Variant ${variantClass} has ${elementChildren.length} children; cannot keep ${selected}.`)
        let removed = 0
        for (const child of elementChildren) if (child !== keep) removed += countElements(child)
        report.removedVariantSubtrees += removed
        report.variantContainers[variantClass] = { before: elementChildren.length, kept: selected, removedElements: removed }
        node.childNodes = [keep]
        const keptClasses = tokens.filter(token => token !== variantClass)
        if (keptClasses.length) setAttr(node, "class", keptClasses.join(" "))
        else removeAttr(node, "class")
      }
    }
    pruneTree(node)
    if (node.content) pruneTree(node.content)
    next.push(node)
  }
  parent.childNodes = next
}

const sha = value => crypto.createHash("sha256").update(value).digest("hex")
const sanitize = value => value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
const contentExtension = (type, fallback = "") => {
  const clean = (type || "").split(";")[0].trim().toLowerCase()
  return clean === "image/avif" ? ".avif"
    : clean === "image/webp" ? ".webp"
    : clean === "image/png" ? ".png"
    : clean === "image/jpeg" ? ".jpg"
    : clean === "image/svg+xml" ? ".svg"
    : clean === "font/woff2" ? ".woff2"
    : clean === "text/css" ? ".css"
    : fallback
}

const manifest = {}
const inflight = new Map()

async function fetchRemote(remoteUrl, requestedLocalPath) {
  if (manifest[remoteUrl]) return manifest[remoteUrl].local
  if (inflight.has(remoteUrl)) return inflight.get(remoteUrl)

  const task = (async () => {
    const headers = remoteUrl.includes("/_next/image")
      ? { "user-agent": "Mozilla/5.0 WebCanBe asset vendor", accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8" }
      : { "user-agent": "Mozilla/5.0 WebCanBe asset vendor", accept: "*/*" }
    const response = await fetch(remoteUrl, { headers, redirect: "follow" })
    if (!response.ok) throw new Error(`Asset fetch failed ${response.status}: ${remoteUrl}`)
    const bytes = Buffer.from(await response.arrayBuffer())
    const type = response.headers.get("content-type") || ""
    let localPath = requestedLocalPath
    if (!path.extname(localPath)) localPath += contentExtension(type)
    const abs = path.join(publicRoot, localPath.replace(/^\//, ""))
    await fs.mkdir(path.dirname(abs), { recursive: true })
    await fs.writeFile(abs, bytes)
    report.downloadedAssets++
    report.downloadedBytes += bytes.length
    manifest[remoteUrl] = {
      local: "/" + localPath.replace(/^\//, "").split(path.sep).join("/"),
      bytes: bytes.length,
      sha256: sha(bytes),
      contentType: type,
    }

    if (type.includes("text/css") || localPath.endsWith(".css")) {
      let css = bytes.toString("utf8")
      const refs = [...css.matchAll(/url\((['"]?)([^)'"]+)\1\)/g)].map(match => match[2])
      for (const ref of [...new Set(refs)]) {
        if (!ref || ref.startsWith("data:") || ref.startsWith("#")) continue
        const resolved = new URL(ref, remoteUrl)
        if (!/^(www\.)?launchuicomponents\.com$/.test(resolved.hostname)) continue
        const remote = resolved.href
        const staticPath = resolved.pathname.startsWith("/_next/static/")
          ? "wcb-landing/vendor" + resolved.pathname
          : "wcb-landing/vendor/css-assets/" + sha(remote).slice(0,16) + (path.extname(resolved.pathname) || "")
        const local = await fetchRemote(remote, staticPath)
        css = css.split(ref).join(local)
      }
      await fs.writeFile(abs, css)
      manifest[remoteUrl].sha256 = sha(css)
      manifest[remoteUrl].bytes = Buffer.byteLength(css)
    }
    return manifest[remoteUrl].local
  })()

  inflight.set(remoteUrl, task)
  try { return await task } finally { inflight.delete(remoteUrl) }
}

async function localizeUrl(raw) {
  if (!raw) return raw
  let remote
  if (raw.startsWith("/_next/")) remote = new URL(raw, origin).href
  else {
    let parsed
    try { parsed = new URL(raw) } catch { return raw }
    if (!/^(www\.)?launchuicomponents\.com$/.test(parsed.hostname)) return raw
    if (!parsed.pathname.startsWith("/_next/")) return raw
    remote = parsed.href
  }

  const url = new URL(remote)
  if (url.pathname === "/_next/image") {
    const sourceName = path.basename(url.searchParams.get("url") || "image")
    const base = sanitize(sourceName.replace(/\.[^.]+$/, "")) || "image"
    const width = sanitize(url.searchParams.get("w") || "auto")
    const key = sha(remote).slice(0,12)
    return fetchRemote(remote, `wcb-landing/vendor/images/${base}-${width}-${key}`)
  }
  if (url.pathname.startsWith("/_next/static/")) {
    return fetchRemote(remote, "wcb-landing/vendor" + url.pathname)
  }
  return raw
}

async function localizeSrcset(value) {
  const items = value.split(",").map(part => part.trim()).filter(Boolean)
  const result = []
  for (const item of items) {
    const match = item.match(/^(\S+)(\s+.+)?$/)
    if (!match) { result.push(item); continue }
    result.push((await localizeUrl(match[1])) + (match[2] || ""))
  }
  return result.join(", ")
}

async function localizeNode(node) {
  if (isElement(node)) {
    const rel = (getAttr(node, "rel") || "").toLowerCase()
    const as = (getAttr(node, "as") || "").toLowerCase()
    if (node.tagName === "link" && as === "image") {
      const imageSet = getAttr(node, "imagesrcset")
      if (imageSet && /-dark\./i.test(decodeURIComponent(imageSet))) {
        node.__remove = true
        return
      }
    }
    for (const name of ["src", "href"]) {
      const value = getAttr(node, name)
      if (!value) continue
      const shouldAsset = name === "src" || node.tagName === "link" && (rel === "stylesheet" || rel === "preload")
      if (shouldAsset) setAttr(node, name, await localizeUrl(value))
    }
    for (const name of ["srcset", "imagesrcset"]) {
      const value = getAttr(node, name)
      if (value) setAttr(node, name, await localizeSrcset(value))
    }
    removeAttr(node, "data-dpl-id")
    removeAttr(node, "data-nimg")
  }
  if (node.childNodes) {
    for (const child of node.childNodes) await localizeNode(child)
    node.childNodes = node.childNodes.filter(child => !child.__remove)
  }
  if (node.content) await localizeNode(node.content)
}

function collectBadRefs(node, out) {
  if (isElement(node)) {
    for (const attr of node.attrs || []) {
      if (!["src","srcset","href","imagesrcset"].includes(attr.name)) continue
      if (/launchuicomponents\.com/.test(attr.value)) out.external.push({tag:node.tagName,attr:attr.name,value:attr.value})
      if (/(^|[ ,])\/_next\//.test(attr.value)) out.next.push({tag:node.tagName,attr:attr.name,value:attr.value})
    }
  }
  for (const child of node.childNodes || []) collectBadRefs(child, out)
  if (node.content) collectBadRefs(node.content, out)
}

const source = await fs.readFile(landingPath, "utf8")
report.inputBytes = Buffer.byteLength(source)
await fs.rm(vendorRoot, { recursive: true, force: true })
const doc = parse5.parse(source)
pruneTree(doc)
await localizeNode(doc)

const bad = { external: [], next: [] }
collectBadRefs(doc, bad)
report.externalAssetReferencesAfter = bad.external
report.nextAssetReferencesAfter = bad.next
if (bad.external.length || bad.next.length) {
  throw new Error("Landing still contains external Launch UI asset references: " + JSON.stringify(bad, null, 2))
}

let output = parse5.serialize(doc)
output = output.replace(/\s*\.hero-variants>\*,[\s\S]*?\.stats-variants>\*:nth-child\(1\)\s*\{\s*display:\s*block;\s*\}/, "")
report.outputBytes = Buffer.byteLength(output)

await fs.writeFile(landingPath, output)
await fs.writeFile(path.join(vendorRoot, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n")
await fs.writeFile(path.join(publicRoot, "wcb-landing", "cleanup-report.json"), JSON.stringify(report, null, 2) + "\n")

console.log(JSON.stringify({
  inputBytes: report.inputBytes,
  outputBytes: report.outputBytes,
  removedScripts: report.removedScripts,
  removedTemplates: report.removedTemplates,
  removedDarkOnlyNodes: report.removedDarkOnlyNodes,
  removedVariantSubtrees: report.removedVariantSubtrees,
  variantContainers: report.variantContainers,
  downloadedAssets: report.downloadedAssets,
  downloadedBytes: report.downloadedBytes,
}, null, 2))
