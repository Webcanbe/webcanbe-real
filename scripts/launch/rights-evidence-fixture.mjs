import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const fixture = path.join(root, "fixtures/studio-ledger")
const sha256 = value => createHash("sha256").update(value).digest("hex")

function walk(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules",".git","dist"].includes(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (entry.isFile()) out.push(full)
  }
  return out
}

const files = walk(fixture)
  .map(full => ({
    file: path.relative(fixture, full).split(path.sep).join("/"),
    bytes: fs.readFileSync(full),
  }))
  .sort((a,b) => a.file.localeCompare(b.file))

const sourceMembers = files.map(item => [item.file, sha256(item.bytes)])
const sourceTreeSha256 = sha256(JSON.stringify(sourceMembers))

const lock = JSON.parse(fs.readFileSync(path.join(fixture,"package-lock.json"),"utf8"))
const dependencies = Object.entries(lock.packages ?? {})
  .filter(([name]) => Boolean(name))
  .map(([name, meta]) => ({
    package: name.replace(/^node_modules\//,""),
    version: typeof meta.version === "string" ? meta.version : "",
    license: typeof meta.license === "string" ? meta.license : "",
  }))
  .sort((a,b) => a.package.localeCompare(b.package))
const unresolvedDependencies = dependencies.filter(item => !item.license)
const dependencyInventorySha256 = sha256(JSON.stringify(dependencies))

const assetMembers = files.filter(item => /^src\/assets\//.test(item.file))
  .map(item => [item.file, sha256(item.bytes)])
const sourceText = files.filter(item => /\.(?:tsx?|jsx?|css|json|html|md|svg)$/i.test(item.file))
  .map(item => item.bytes.toString("utf8")).join("\n")
const externalUrls = [...new Set([...sourceText.matchAll(/https?:\/\/[^\s"'<>)}]+/g)].map(match => match[0]))].sort()
const assetInventorySha256 = sha256(JSON.stringify(assetMembers))

const result = {
  schema: 1,
  fixture: "fixtures/studio-ledger",
  source: {
    reviewed: unresolvedDependencies.length === 0 && externalUrls.length === 0,
    unresolvedCount: 0,
    origin: "first_party_repo",
    original: true,
    reference: "source-tree-sha256:" + sourceTreeSha256,
    fileCount: files.length,
  },
  dependencies: {
    reviewed: unresolvedDependencies.length === 0,
    unresolvedCount: unresolvedDependencies.length,
    reference: "package-license-inventory-sha256:" + dependencyInventorySha256,
    packages: dependencies.length,
    licenses: [...new Set(dependencies.map(item => item.license).filter(Boolean))].sort(),
  },
  assets: {
    reviewed: externalUrls.length === 0,
    unresolvedCount: externalUrls.length,
    reference: "asset-inventory-sha256:" + assetInventorySha256,
    assets: assetMembers.map(([file]) => file),
    externalUrls,
  },
}
process.stdout.write(JSON.stringify(result,null,2)+"\n")
