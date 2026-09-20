import pg from "pg"

const { Client } = pg
const raw = process.env.RECOVERY_DATABASE_URL || process.env.WEBCANBE_DATABASE_URL

if (!raw) {
  console.error("RECOVERY_DATABASE_URL or WEBCANBE_DATABASE_URL is required.")
  process.exit(1)
}

let parsed
try {
  parsed = new URL(raw)
} catch {
  console.error("Database URL is invalid.")
  process.exit(1)
}
if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
  console.error("Recovery preflight requires a PostgreSQL URL.")
  process.exit(1)
}

const client = new Client({
  connectionString: raw,
  application_name: "webcanbe_recovery_preflight",
  statement_timeout: 15_000,
  query_timeout: 15_000,
})

const checks = []
const add = (label, ok, detail) => {
  checks.push({ label, ok, detail })
  console.log(`${ok ? "PASS" : "FAIL"}  ${label} — ${detail}`)
}

try {
  await client.connect()

  const tableCount = Number((await client.query(
    "select count(*)::int as n from information_schema.tables where table_schema='public' and table_name like 'wcb_%'",
  )).rows[0]?.n || 0)
  add("Webcanbe table set", tableCount >= 40, `${tableCount} wcb_* tables`)

  const browserGrants = Number((await client.query(
    "select count(*)::int as n from information_schema.role_table_grants where table_schema='public' and table_name like 'wcb_%' and grantee in ('anon','authenticated')",
  )).rows[0]?.n || 0)
  add("Browser table grants remain stripped", browserGrants === 0, `${browserGrants} direct grants`)

  const browserRoutineGrants = Number((await client.query(
    "select count(*)::int as n from information_schema.routine_privileges where routine_schema='public' and routine_name like 'wcb_%' and grantee in ('anon','authenticated')",
  )).rows[0]?.n || 0)
  add("Browser routine grants remain stripped", browserRoutineGrants === 0, `${browserRoutineGrants} direct grants`)

  const roles = (await client.query(
    "select rolname, rolsuper, rolcreaterole, rolcreatedb, rolcanlogin, rolreplication, rolbypassrls from pg_roles where rolname in ('webcanbe_runtime','webcanbe_hyperdrive') order by rolname",
  )).rows
  const byName = new Map(roles.map(row => [row.rolname, row]))
  const runtime = byName.get("webcanbe_runtime")
  const hyperdrive = byName.get("webcanbe_hyperdrive")
  const safeRole = role => Boolean(role) && role.rolsuper === false && role.rolcreaterole === false && role.rolcreatedb === false && role.rolreplication === false && role.rolbypassrls === false
  add("Runtime role is bounded", safeRole(runtime) && runtime.rolcanlogin === false, runtime ? "non-login bounded runtime role" : "missing")
  add("Hyperdrive login role is bounded", safeRole(hyperdrive) && hyperdrive.rolcanlogin === true, hyperdrive ? "bounded login role" : "missing")

  const triggerRows = (await client.query(
    "select t.tgname from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal and t.tgname in ('wcb_immutable_project_release','wcb_guard_published_listing_release','wcb_immutable_control_audit')",
  )).rows
  const triggers = new Set(triggerRows.map(row => row.tgname))
  for (const required of ["wcb_immutable_project_release","wcb_guard_published_listing_release","wcb_immutable_control_audit"]) {
    add(`Required trigger ${required}`, triggers.has(required), triggers.has(required) ? "present" : "missing")
  }

  let migrationCount = 0
  try {
    migrationCount = Number((await client.query(
      "select count(*)::int as n from supabase_migrations.schema_migrations",
    )).rows[0]?.n || 0)
    add("Migration history is present", migrationCount >= 11, `${migrationCount} migrations`)
  } catch (error) {
    add("Migration history is present", false, error instanceof Error ? error.message : "query failed")
  }

  const failed = checks.filter(check => !check.ok)
  console.log(`Recovery preflight complete: ${checks.length} checks, ${failed.length} failures.`)
  if (failed.length) process.exitCode = 1
} finally {
  await client.end().catch(() => {})
}
