import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { spawnSync } from "node:child_process"

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

const pgEnv = {
  ...process.env,
  PGHOST: url.hostname,
  PGPORT: url.port || "5432",
  PGDATABASE: decodeURIComponent(url.pathname.replace(/^\//, "") || "postgres"),
  PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password),
  PGSSLMODE: url.searchParams.get("sslmode") || "require",
}
delete pgEnv.WEBCANBE_DATABASE_URL

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

const size = statSync(target).size
if (!size) {
  console.error("Backup file is empty.")
  process.exit(1)
}

const digest = createHash("sha256").update(readFileSync(target)).digest("hex")
writeFileSync(target + ".sha256", digest + "  " + target.split("/").pop() + "\n", { mode: 0o600 })

console.log(`Backup created: ${target}`)
console.log(`Bytes: ${size}`)
console.log(`SHA-256: ${digest}`)
