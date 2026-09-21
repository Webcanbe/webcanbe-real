import { createHash } from "node:crypto"
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, join, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import { readSourceManifest } from "./backup-source-manifest.mjs"

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
  if ([...value.searchParams.keys()].some(key => key !== "sslmode")) {
    throw new Error(`${label} contains unsupported connection parameters.`)
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

function sameDatabaseIdentity(left, right) {
  return Boolean(left && right) &&
    left.systemIdentifier === right.systemIdentifier &&
    left.database === right.database
}

function guardedPreparationSql(recoveryIdentity, recordedSourceIdentity, liveSourceIdentity) {
  const forbidden = [recordedSourceIdentity, liveSourceIdentity].filter(Boolean)
  const forbiddenChecks = forbidden.map(identity =>
    `(actual_system_identifier = '${identity.systemIdentifier}' AND actual_database = '${identity.database}')`,
  ).join(" OR ") || "FALSE"

  return `SET LOCAL lock_timeout = '30s';
SET LOCAL statement_timeout = '30s';

DO $$
DECLARE
  actual_system_identifier text;
  actual_database text;
  table_count integer;
  table_list text;
BEGIN
  SELECT system_identifier::text, current_database()
    INTO actual_system_identifier, actual_database
    FROM pg_control_system();

  IF actual_system_identifier <> '${recoveryIdentity.systemIdentifier}'
     OR actual_database <> '${recoveryIdentity.database}' THEN
    RAISE EXCEPTION 'Recovery target identity changed after approval.';
  END IF;

  IF ${forbiddenChecks} THEN
    RAISE EXCEPTION 'Recovery target matches a protected source identity.';
  END IF;

  SELECT count(*), string_agg(format('public.%I', table_name), ', ' ORDER BY table_name)
    INTO table_count, table_list
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name LIKE 'wcb\\_%' ESCAPE '\\';

  IF table_count < 40 OR table_list IS NULL THEN
    RAISE EXCEPTION 'Recovery target does not contain the canonical schema.';
  END IF;

  EXECUTE 'TRUNCATE TABLE ' || table_list || ' RESTART IDENTITY CASCADE';
END
$$;

SET LOCAL lock_timeout = 0;
SET LOCAL statement_timeout = 0;
`
}

const backup = process.argv[2] ? resolve(process.argv[2]) : ""
if (!backup || !existsSync(backup)) {
  console.error("Usage: WEBCANBE_RESTORE_CONFIRM=RESTORE_RECOVERY_TARGET npm run db:restore:recovery -- <backup.dump>")
  process.exit(1)
}

let recovery
let liveSource
try {
  recovery = parseDatabaseUrl(process.env.RECOVERY_DATABASE_URL, "RECOVERY_DATABASE_URL")
  liveSource = process.env.WEBCANBE_DATABASE_URL
    ? parseDatabaseUrl(process.env.WEBCANBE_DATABASE_URL, "WEBCANBE_DATABASE_URL")
    : undefined
} catch (error) {
  console.error(error instanceof Error ? error.message : "Database configuration is invalid.")
  process.exit(1)
}

if (liveSource && targetIdentity(liveSource) === targetIdentity(recovery)) {
  console.error("Refusing restore because recovery target resolves to the production database target.")
  process.exit(1)
}
if (process.env.WEBCANBE_RESTORE_CONFIRM !== "RESTORE_RECOVERY_TARGET") {
  console.error("Refusing recovery restore without WEBCANBE_RESTORE_CONFIRM=RESTORE_RECOVERY_TARGET.")
  process.exit(1)
}
if (!liveSource && process.env.WEBCANBE_RESTORE_OFFLINE_SOURCE_CONFIRM !== "USE_BACKUP_SOURCE_IDENTITY") {
  console.error("WEBCANBE_DATABASE_URL is unavailable; offline restore requires WEBCANBE_RESTORE_OFFLINE_SOURCE_CONFIRM=USE_BACKUP_SOURCE_IDENTITY.")
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

let recordedSourceIdentity
try {
  const digest = createHash("sha256").update(readFileSync(backup)).digest("hex")
  const manifest = readSourceManifest(backup, digest)
  recordedSourceIdentity = {
    systemIdentifier: manifest.systemIdentifier,
    database: manifest.database,
  }
  console.log(`Recorded backup source identity verified: ${manifest.systemIdentifier}/${manifest.database}.`)
} catch (error) {
  console.error("Backup source identity verification failed: " + (error instanceof Error ? error.message : String(error)))
  process.exit(1)
}

let recoveryIdentity
let liveSourceIdentity
try {
  recoveryIdentity = probeDatabaseIdentity(recovery, "Recovery")
  if (sameDatabaseIdentity(recordedSourceIdentity, recoveryIdentity)) {
    throw new Error("Recovery target matches the PostgreSQL cluster/database identity recorded in the backup.")
  }
  if (liveSource) {
    liveSourceIdentity = probeDatabaseIdentity(liveSource, "Production")
    if (sameDatabaseIdentity(liveSourceIdentity, recoveryIdentity)) {
      throw new Error("Production and recovery connect to the same PostgreSQL cluster/database identity.")
    }
  }
} catch (error) {
  console.error("Recovery target identity verification failed: " + (error instanceof Error ? error.message : String(error)))
  process.exit(1)
}

if (liveSourceIdentity && !sameDatabaseIdentity(liveSourceIdentity, recordedSourceIdentity)) {
  console.log("Current production identity differs from the backup source identity; recovery remains guarded against both identities.")
}
console.log("PostgreSQL recovery target identity verified as distinct from the recorded backup source" + (liveSourceIdentity ? " and current production." : "."))

if (process.env.WEBCANBE_RESTORE_PLAN_ONLY === "1") {
  console.log(`Recovery restore plan verified: ${basename(backup)} → separate recovery target.`)
  process.exit(0)
}

const restoreDirectory = mkdtempSync(join(tmpdir(), "wcb-recovery-restore-"))
chmodSync(restoreDirectory, 0o700)
const guardSql = join(restoreDirectory, "guard.sql")
const restoreSql = join(restoreDirectory, "restore.sql")
let restoreExitCode = 0

try {
  writeFileSync(
    guardSql,
    guardedPreparationSql(recoveryIdentity, recordedSourceIdentity, liveSourceIdentity),
    { mode: 0o600 },
  )
  writeFileSync(restoreSql, "", { mode: 0o600 })

  const render = spawnSync("pg_restore", [
    "--data-only",
    "--no-owner",
    "--no-acl",
    "--exit-on-error",
    "--file", restoreSql,
    backup,
  ], { stdio: "inherit", env: pgEnvironment(recovery) })

  if (render.error?.code === "ENOENT") {
    throw new Error("pg_restore is not installed or is not on PATH.")
  }
  if (render.status !== 0) {
    restoreExitCode = render.status ?? 1
  } else {
    const restore = spawnSync("psql", [
      "--no-psqlrc",
      "--set", "ON_ERROR_STOP=1",
      "--single-transaction",
      "--file", guardSql,
      "--file", restoreSql,
    ], { stdio: "inherit", env: pgEnvironment(recovery) })

    if (restore.error?.code === "ENOENT") {
      throw new Error("psql is required to apply a guarded PostgreSQL recovery restore.")
    }
    if (restore.status !== 0) restoreExitCode = restore.status ?? 1
  }
} catch (error) {
  console.error("Recovery restore failed: " + (error instanceof Error ? error.message : String(error)))
  restoreExitCode = 1
} finally {
  rmSync(restoreDirectory, { recursive: true, force: true })
}

if (restoreExitCode) process.exit(restoreExitCode)

const preflightEnv = { ...process.env, RECOVERY_DATABASE_URL: process.env.RECOVERY_DATABASE_URL }
delete preflightEnv.WEBCANBE_DATABASE_URL
const preflight = spawnSync(
  process.execPath,
  ["scripts/db/recovery-preflight.mjs"],
  { cwd: process.cwd(), env: preflightEnv, stdio: "inherit" },
)
if (preflight.status !== 0) process.exit(preflight.status ?? 1)

console.log(`Recovery restore completed and preflight passed: ${basename(backup)}.`)
