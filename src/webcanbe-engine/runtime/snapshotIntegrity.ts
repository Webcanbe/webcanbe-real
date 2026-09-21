import { createHash } from "node:crypto"

function canonicalValue(value: unknown, arrayElement = false): string | undefined {
  if (value === null) return "null"
  const type = typeof value
  if (type === "string" || type === "boolean" || type === "number") return JSON.stringify(value)
  if (type === "undefined" || type === "function" || type === "symbol") return arrayElement ? "null" : undefined
  if (Array.isArray(value)) {
    return "[" + value.map(item => canonicalValue(item, true) ?? "null").join(",") + "]"
  }
  if (type === "object") {
    const record = value as Record<string, unknown>
    const parts: string[] = []
    for (const key of Object.keys(record).sort()) {
      const encoded = canonicalValue(record[key], false)
      if (encoded !== undefined) parts.push(JSON.stringify(key) + ":" + encoded)
    }
    return "{" + parts.join(",") + "}"
  }
  return JSON.stringify(value)
}

export function canonicalJson(value: unknown): string {
  const encoded = canonicalValue(value, false)
  if (encoded === undefined) throw new TypeError("Snapshot payload is not JSON-serializable.")
  return encoded
}

export function releaseSnapshotHash(value: {
  projectId: string
  revisionId: string
  contentHash: string
  files: readonly (readonly [string, string])[]
  history: unknown
}): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex")
}
