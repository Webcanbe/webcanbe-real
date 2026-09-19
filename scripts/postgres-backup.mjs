import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"

function fail(message) {
  console.error(message)
  process.exit(1)
}

function commandAvailable(command) {
  const result = spawnSync(command, ["--version"], { stdio: "ignore" })
  return result.status === 0
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) fail("DATABASE_URL is required. Keep it in the shell environment; do not commit it.")
if (!commandAvailable("pg_dump")) fail("pg_dump is required in PATH.")

const requested = process.argv[2]
const stamp = new Date().toISOString().replace(/[:.]/g, "-")
const output = resolve(requested || `backups/webcanbe-data-${stamp}.dump`)
mkdirSync(dirname(output), { recursive: true })

const result = spawnSync("pg_dump", [
  "--dbname", databaseUrl,
  "--format=custom",
  "--data-only",
  "--no-owner",
  "--no-privileges",
  "--table=public.wcb_*",
  "--file", output,
], {
  stdio: ["ignore", "inherit", "inherit"],
  env: process.env,
})

if (result.status !== 0) fail("pg_dump failed; no backup should be trusted.")
const bytes = statSync(output).size
if (bytes <= 0) fail("pg_dump produced an empty file.")

const digest = createHash("sha256").update(readFileSync(output)).digest("hex")
const manifest = {
  schema: 1,
  createdAt: new Date().toISOString(),
  type: "postgres-custom-data-only",
  scope: "public.wcb_*",
  bytes,
  sha256: digest,
  backupFile: output.split("/").at(-1),
}
writeFileSync(output + ".json", JSON.stringify(manifest, null, 2) + "\n", { mode: 0o600 })

console.log(JSON.stringify({
  ok: true,
  backup: output,
  manifest: output + ".json",
  bytes,
  sha256: digest,
}))
