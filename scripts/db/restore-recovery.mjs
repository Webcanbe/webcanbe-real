import { existsSync } from "node:fs"
import { basename, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import pg from "pg"

const { Client } = pg
const UUIDISH = /^[A-Za-z0-9._-]+$/
const SYSTEM_IDENTIFIER = /^\d+$/
const IDENTITY_SQL = "select system_identifier::text || E'\\t' || current_database() from pg_control_system()"

function parseDatabaseUrl(raw, label) {
  if (!raw) throw new Error(`${label} is required.`)
  let value
  try { value = new URL(raw) } catch { throw new Error(`${label} is invalid.`) }
  if (!["postgres:", "postgresql:"].includes(value.protocol) || !value.hostname || !value.username || !value.password) {
    throw new Error(`${label} must be a password-authenticated PostgreSQL URL.`)
  }
  const database = decodeURIComponent(value.pathname.replace(/^\//, "") || "postgres")
  if (!UUIDISH.test(database)) throw new Error(`${label} database name is invalid.`)
  return { value, database }
}

function targetIdentity(parsed) {
  return [
    parsed.value.hostname.toLowerCase(),
    parsed.value.port || "5432",
    parsed.database.toLowerCase(),
  ].join(":")
}

function pgEnvironment(parsed) {
  const env = {
    ...process.env,
    PGHOST: parsed.value.hostname,
    PGPORT: parsed.value.port || "5432",
    PGDATABASE: parsed.database,
    PGUSER: decodeURIComponent(parsed.value.username),
    PGPASSWORD: decodeURIComponent(parsed.value.password),
    PGSSLMODE: parsed.value.searchParams.get("sslmode") || "require",
  }
  delete env.WEBCANBE_DATABASE_URL
  delete env.RECOVERY_DATABASE_URL
  return env
}

function probeDatabaseIdentity(parsed, label) {
  const result = spawnSync("psql", [
    "--no-psqlrc",
    "--tuples-only",
    "--no-align",
    "--set", "ON_ERROR_STOP=1",
    "--command", IDENTITY_SQL,
  ], {
    env: pgEnvironment(parsed),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
  if (result.error?.code === "ENOENT") {
    throw new Error("psql is required to verify PostgreSQL recovery-target identity.")
  }
  if (result.status !== 0) {
    throw new Error(`${label} PostgreSQL identity probe failed.`)
  }
  const lines = String(result.stdout || "").trim().split(/\r?\n/).filter(Boolean)
  if (lines.length !== 1) throw new Error(`${label} PostgreSQL identity probe returned malformed output.`)
  const parts = lines[0].split("\t")
  if (parts.length !== 2 || !SYSTEM_IDENTIFIER.test(parts[0]) || !UUIDISH.test(parts[1])) {
    throw new Error(`${label} PostgreSQL identity probe returned malformed output.`)
  }
  if (parts[1] !== parsed.database) {
    throw new Error(`${label} connected database identity does not match the configured database name.`)
  }
  return { systemIdentifier: parts[0], database: parts[1] }
}

function quoteIdent(value) {
  return '"' + String(value).replaceAll('"', '""') + '"'
}

const backup = process.argv[2] ? resolve(process.argv[2]) : ""
if (!backup || !existsSync(backup)) {
  console.error("Usage: WEBCANBE_RESTORE_CONFIRM=RESTORE_RECOVERY_TARGET npm run db:restore:recovery -- <backup.dump>")
  process.exit(1)
}

let source
let recovery
try {
  source = parseDatabaseUrl(process.env.WEBCANBE_DATABASE_URL, "WEBCANBE_DATABASE_URL")
  recovery = parseDatabaseUrl(process.env.RECOVERY_DATABASE_URL, "RECOVERY_DATABASE_URL")
} catch (error) {
  console.error(error instanceof Error ? error.message : "Database configuration is invalid.")
  process.exit(1)
}

if (targetIdentity(source) === targetIdentity(recovery)) {
  console.error("Refusing restore because recovery target resolves to the production database target.")
  process.exit(1)
}
if (process.env.WEBCANBE_RESTORE_CONFIRM !== "RESTORE_RECOVERY_TARGET") {
  console.error("Refusing recovery restore without WEBCANBE_RESTORE_CONFIRM=RESTORE_RECOVERY_TARGET.")
  process.exit(1)
}

const verify = spawnSync(
  process.execPath,
  ["scripts/db/verify-backup.mjs", backup],
  { cwd: process.cwd(), env: process.env, encoding: "utf8" },
)
if (verify.stdout) process.stdout.write(verify.stdout)
if (verify.status !== 0) {
  if (verify.stderr) process.stderr.write(verify.stderr)
  process.exit(verify.status ?? 1)
}

let sourceIdentity
let recoveryIdentity
try {
  sourceIdentity = probeDatabaseIdentity(source, "Production")
  recoveryIdentity = probeDatabaseIdentity(recovery, "Recovery")
} catch (error) {
  console.error("Recovery target identity verification failed: " + (error instanceof Error ? error.message : String(error)))
  process.exit(1)
}
if (
  sourceIdentity.systemIdentifier === recoveryIdentity.systemIdentifier &&
  sourceIdentity.database === recoveryIdentity.database
) {
  console.error("Refusing restore because production and recovery connect to the same PostgreSQL cluster/database identity.")
  process.exit(1)
}
console.log("PostgreSQL recovery target identity verified as distinct from production.")

if (process.env.WEBCANBE_RESTORE_PLAN_ONLY === "1") {
  console.log(`Recovery restore plan verified: ${basename(backup)} → separate recovery target.`)
  process.exit(0)
}

const client = new Client({
  connectionString: process.env.RECOVERY_DATABASE_URL,
  application_name: "webcanbe_recovery_restore",
  statement_timeout: 30_000,
  query_timeout: 30_000,
})

try {
  await client.connect()
  const rows = (await client.query(
    "select table_name from information_schema.tables where table_schema='public' and table_name like 'wcb_%' order by table_name",
  )).rows
  const tables = rows.map(row => String(row.table_name))
  if (tables.length < 40) throw new Error(`Recovery target has only ${tables.length} wcb_* tables; apply the canonical schema first.`)

  const tableList = tables.map(table => `public.${quoteIdent(table)}`).join(", ")
  await client.query("BEGIN")
  try {
    await client.query(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`)
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    throw error
  }
} catch (error) {
  console.error("Recovery target preparation failed: " + (error instanceof Error ? error.message : String(error)))
  process.exitCode = 1
} finally {
  await client.end().catch(() => {})
}

if (process.exitCode) process.exit(process.exitCode)

const restore = spawnSync("pg_restore", [
  "--data-only",
  "--no-owner",
  "--no-acl",
  "--exit-on-error",
  "--single-transaction",
  "--dbname", recovery.database,
  backup,
], { stdio: "inherit", env: pgEnvironment(recovery) })

if (restore.error?.code === "ENOENT") {
  console.error("pg_restore is not installed or is not on PATH.")
  process.exit(1)
}
if (restore.status !== 0) process.exit(restore.status ?? 1)

const preflightEnv = { ...process.env, RECOVERY_DATABASE_URL: process.env.RECOVERY_DATABASE_URL }
delete preflightEnv.WEBCANBE_DATABASE_URL
const preflight = spawnSync(
  process.execPath,
  ["scripts/db/recovery-preflight.mjs"],
  { cwd: process.cwd(), env: preflightEnv, stdio: "inherit" },
)
if (preflight.status !== 0) process.exit(preflight.status ?? 1)

console.log(`Recovery restore completed and preflight passed: ${basename(backup)}.`)
