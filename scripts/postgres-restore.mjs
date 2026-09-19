import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

function fail(message) {
  console.error(message)
  process.exit(1)
}

function run(command, args, options = {}) {
  return spawnSync(command, args, { encoding: "utf8", ...options, env: process.env })
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) fail("DATABASE_URL is required. Use a fresh recovery target unless you have an approved production incident plan.")
if (process.env.WCB_RESTORE_CONFIRM !== "RESTORE_WEB_CANBE_DATA") {
  fail("Set WCB_RESTORE_CONFIRM=RESTORE_WEB_CANBE_DATA to acknowledge a restore.")
}

const inputArg = process.argv[2]
if (!inputArg) fail("Usage: npm run db:restore -- /path/to/webcanbe-data.dump")
const input = resolve(inputArg)
if (!existsSync(input)) fail("Backup file does not exist.")

for (const command of ["pg_restore", "psql"]) {
  if (run(command, ["--version"], { stdio: "ignore" }).status !== 0) fail(`${command} is required in PATH.`)
}

const list = run("pg_restore", ["--list", input])
if (list.status !== 0) fail("Backup archive could not be read by pg_restore.")
const suspicious = list.stdout
  .split("\n")
  .filter(Boolean)
  .filter(line => / TABLE DATA /.test(line))
  .filter(line => !/ public wcb_[A-Za-z0-9_]+ /.test(line))
if (suspicious.length) fail("Backup contains table data outside public.wcb_*; refusing restore.")

const tableQuery = "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'wcb\\_%' ESCAPE '\\\\' ORDER BY tablename;"
const tablesResult = run("psql", [databaseUrl, "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-c", tableQuery])
if (tablesResult.status !== 0) fail("Could not inspect target Webcanbe schema.")
const tables = tablesResult.stdout.trim().split("\n").filter(Boolean)
if (!tables.length) fail("Target has no wcb_* schema. Apply the authoritative migrations before restoring data.")

for (const table of tables) {
  if (!/^wcb_[A-Za-z0-9_]+$/.test(table)) fail("Unexpected target table name.")
  const count = run("psql", [databaseUrl, "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-c", `SELECT count(*) FROM public."${table}";`])
  if (count.status !== 0) fail(`Could not inspect target table ${table}.`)
  if (Number(count.stdout.trim()) > 0) {
    fail(`Target table ${table} is not empty. Restore is allowed only into an empty/fresh Webcanbe target.`)
  }
}

const manifestPath = input + ".json"
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
  if (manifest?.scope !== "public.wcb_*" || manifest?.type !== "postgres-custom-data-only") {
    fail("Backup manifest does not match the expected Webcanbe data-only format.")
  }
}

const restore = run("pg_restore", [
  "--dbname", databaseUrl,
  "--data-only",
  "--no-owner",
  "--no-privileges",
  "--exit-on-error",
  "--single-transaction",
  input,
], { stdio: "inherit" })

if (restore.status !== 0) fail("pg_restore failed and the transaction was rolled back.")

console.log(JSON.stringify({ ok: true, restored: input, tablesChecked: tables.length }))
