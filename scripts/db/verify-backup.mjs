import { createHash } from "node:crypto"
import { existsSync, readFileSync, statSync } from "node:fs"
import { resolve } from "node:path"
import { spawnSync } from "node:child_process"

const target = process.argv[2] ? resolve(process.argv[2]) : ""
if (!target || !existsSync(target)) {
  console.error("Usage: node scripts/db/verify-backup.mjs <backup.dump>")
  process.exit(1)
}
if (!statSync(target).size) {
  console.error("Backup file is empty.")
  process.exit(1)
}

const manifest = target + ".sha256"
const digest = createHash("sha256").update(readFileSync(target)).digest("hex")
if (existsSync(manifest)) {
  const expected = readFileSync(manifest, "utf8").trim().split(/\s+/)[0]
  if (expected !== digest) {
    console.error("Backup checksum mismatch.")
    process.exit(1)
  }
}

const result = spawnSync("pg_restore", ["--list", target], { encoding: "utf8" })
if (result.error?.code === "ENOENT") {
  console.error("pg_restore is not installed or is not on PATH.")
  process.exit(1)
}
if (result.status !== 0) {
  process.stderr.write(result.stderr || "")
  process.exit(result.status ?? 1)
}

const listing = result.stdout || ""
const matches = listing.match(/TABLE DATA public wcb_[A-Za-z0-9_]+/g) || []
const tables = new Set(matches.map(value => value.split(" ").at(-1)))
if (tables.size < 20) {
  console.error(`Backup archive contains only ${tables.size} Webcanbe table-data entries; expected at least 20.`)
  process.exit(1)
}

console.log(`Backup verified: ${target}`)
console.log(`SHA-256: ${digest}`)
console.log(`Webcanbe table-data entries: ${tables.size}`)
