import { existsSync, readFileSync, writeFileSync } from "node:fs"

export const SOURCE_MANIFEST_SUFFIX = ".source.json"
export const SOURCE_MANIFEST_FORMAT = "webcanbe-postgres-backup-source-v1"
const SYSTEM_IDENTIFIER = /^\d+$/
const DATABASE_NAME = /^[A-Za-z0-9._-]+$/
const SHA256 = /^[a-f0-9]{64}$/

export function sourceManifestPath(backupPath) {
  return backupPath + SOURCE_MANIFEST_SUFFIX
}

export function validateSourceManifest(value, expectedArchiveSha256) {
  if (!value || typeof value !== "object") throw new Error("Backup source identity manifest is malformed.")
  if (value.format !== SOURCE_MANIFEST_FORMAT) throw new Error("Backup source identity manifest format is unsupported.")
  if (!SYSTEM_IDENTIFIER.test(String(value.systemIdentifier || ""))) throw new Error("Backup source system identifier is malformed.")
  if (!DATABASE_NAME.test(String(value.database || ""))) throw new Error("Backup source database name is malformed.")
  if (!SHA256.test(String(value.archiveSha256 || ""))) throw new Error("Backup source archive digest is malformed.")
  if (expectedArchiveSha256 && value.archiveSha256 !== expectedArchiveSha256) throw new Error("Backup source manifest archive digest mismatch.")
  const createdAt = String(value.createdAt || "")
  if (!createdAt || Number.isNaN(Date.parse(createdAt))) throw new Error("Backup source manifest creation time is malformed.")
  return Object.freeze({
    format: SOURCE_MANIFEST_FORMAT,
    systemIdentifier: String(value.systemIdentifier),
    database: String(value.database),
    archiveSha256: String(value.archiveSha256),
    createdAt,
  })
}

export function readSourceManifest(backupPath, expectedArchiveSha256) {
  const file = sourceManifestPath(backupPath)
  if (!existsSync(file)) throw new Error("Backup source identity manifest is missing.")
  let parsed
  try { parsed = JSON.parse(readFileSync(file, "utf8")) }
  catch { throw new Error("Backup source identity manifest is not valid JSON.") }
  return validateSourceManifest(parsed, expectedArchiveSha256)
}

export function writeSourceManifest(backupPath, manifest) {
  const validated = validateSourceManifest(manifest, manifest.archiveSha256)
  writeFileSync(sourceManifestPath(backupPath), JSON.stringify(validated, null, 2) + "\n", { mode: 0o600 })
  return validated
}
