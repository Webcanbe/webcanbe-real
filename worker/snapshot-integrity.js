import { createHash } from "node:crypto"

function canonicalValue(value, arrayElement = false) {
  if (value === null) return "null"
  const type = typeof value
  if (type === "string" || type === "boolean" || type === "number") return JSON.stringify(value)
  if (type === "undefined" || type === "function" || type === "symbol") return arrayElement ? "null" : undefined
  if (Array.isArray(value)) {
    return "[" + value.map(item => canonicalValue(item, true) ?? "null").join(",") + "]"
  }
  if (type === "object") {
    const parts = []
    for (const key of Object.keys(value).sort()) {
      const encoded = canonicalValue(value[key], false)
      if (encoded !== undefined) parts.push(JSON.stringify(key) + ":" + encoded)
    }
    return "{" + parts.join(",") + "}"
  }
  return JSON.stringify(value)
}

export function canonicalJson(value) {
  const encoded = canonicalValue(value, false)
  if (encoded === undefined) throw new TypeError("Snapshot payload is not JSON-serializable.")
  return encoded
}

export function releaseSnapshotHash({ projectId, revisionId, contentHash, files, history }) {
  return createHash("sha256").update(canonicalJson({
    projectId,
    revisionId,
    contentHash,
    files,
    history,
  })).digest("hex")
}
