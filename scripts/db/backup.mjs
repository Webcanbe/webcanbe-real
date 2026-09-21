import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import { sourceManifestPath, writeSourceManifest } from "./backup-source-manifest.mjs"

const SYSTEM_IDENTIFIER = /^\d+$/
const DATABASE_NAME = /^[A-Za-z0-9._-]+$/
const IDENTITY_SQL = "select system_identifier::text || E'\\t' || current_database() from pg_control_system()"

const raw = process.env.WEBCANBE_DATABASE_URL
if (!raw) {
  console.error("WEBCANBE_DATABASE_URL is required.")
  process.exit(1)
}

let url
try {
  url = new URL(raw)
} catch {
  console.error("WEBCANBE_DATABASE_URL is invalid.")
  process.exit(1)
}
if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.username || !url.password) {
  console.error("WEBCANBE_DATABASE_URL must be a password-authenticated PostgreSQL URL.")
  process.exit(1)
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-")
const target = resolve(process.argv[2] || `backups/webcanbe-data-${stamp}.dump`)
mkdirSync(dirname(target), { recursive: true })

const database = decodeURIComponent(url.pathname.replace(/^\//, "") || "postgres")
if (!DATABASE_NAME.test(database)) {
  console.error("WEBCANBE_DATABASE_URL database name is invalid.")
  process.exit(1)
}

const pgEnv = {
  ...process.env,
  PGHOST: url.hostname,
  PGPORT: url.port || "5432",
  PGDATABASE: database,
  PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password),
  PGSSLMODE: url.searchParams.get("sslmode") || "require",
}
delete pgEnv.WEBCANBE_DATABASE_URL
delete pgEnv.RECOVERY_DATABASE_URL

function probeSourceIdentity() {
  const result = spawnSync("psql", [
    "--no-psqlrc",
    "--tuples-only",
    "--no-align",
    "--set", "ON_ERROR_STOP=1",
    "--command", IDENTITY_SQL,
  ], { env: pgEnv, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
  if (result.error?.code === "ENOENT") throw new Error("psql is required to bind the backup to its PostgreSQL source identity.")
  if (result.status !== 0) throw new Error("PostgreSQL source identity probe failed.")
  const lines = String(result.stdout || "").trim().split(/\r?\n/).filter(Boolean)
  if (lines.length !== 1) throw new Error("PostgreSQL source identity probe returned malformed output.")
  const parts = lines[0].split("\t")
  if (parts.length !== 2 || !SYSTEM_IDENTIFIER.test(parts[0]) || !DATABASE_NAME.test(parts[1])) {
    throw new Error("PostgreSQL source identity probe returned malformed output.")
  }
  if (parts[1] !== database) throw new Error("Connected PostgreSQL database does not match WEBCANBE_DATABASE_URL.")
  return { systemIdentifier: parts[0], database: parts[1] }
}

let sourceBefore
try {
  sourceBefore = probeSourceIdentity()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}

const result = spawnSync("pg_dump", [
  "--format=custom",
  "--data-only",
  "--no-owner",
  "--no-acl",
  "--table=public.wcb_*",
  "--file", target,
], { stdio: "inherit", env: pgEnv })

if (result.error?.code === "ENOENT") {
  console.error("pg_dump is not installed or is not on PATH.")
  process.exit(1)
}
if (result.status !== 0) process.exit(result.status ?? 1)

let sourceAfter
try {
  sourceAfter = probeSourceIdentity()
} catch (error) {
  rmSync(target, { force: true })
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
if (
  sourceBefore.systemIdentifier !== sourceAfter.systemIdentifier ||
  sourceBefore.database !== sourceAfter.database
) {
  rmSync(target, { force: true })
  console.error("PostgreSQL source identity changed while the backup was being created; refusing an unbound archive.")
  process.exit(1)
}

const size = statSync(target).size
if (!size) {
  rmSync(target, { force: true })
  console.error("Backup file is empty.")
  process.exit(1)
}

const digest = createHash("sha256").update(readFileSync(target)).digest("hex")
writeFileSync(target + ".sha256", digest + "  " + target.split("/").pop() + "\n", { mode: 0o600 })
writeSourceManifest(target, {
  format: "webcanbe-postgres-backup-source-v1",
  systemIdentifier: sourceAfter.systemIdentifier,
  database: sourceAfter.database,
  archiveSha256: digest,
  createdAt: new Date().toISOString(),
})

console.log(`Backup created: ${target}`)
console.log(`Bytes: ${size}`)
console.log(`SHA-256: ${digest}`)
console.log(`Source identity manifest: ${sourceManifestPath(target)}`)
