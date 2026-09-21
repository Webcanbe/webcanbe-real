# Webcanbe production database backup and recovery

Status: 2026-09-19 KST

## Current production facts

- Supabase project: `webcanbe-production`
- Project ref: `kappcfofcobhudmeuzmt`
- Region: Seoul (`ap-northeast-2`)
- PostgreSQL: 17
- Webcanbe schema: source-controlled in `deployment/hosted/postgres.sql` plus subsequent migrations/hardening.
- Current organization plan: Free.

Supabase currently does **not** include automatic database backups on the Free plan. Their production guidance recommends regularly exporting Free-plan databases yourself. Free projects may also be paused for low activity.

Official references:

- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/deployment/going-into-prod
- https://supabase.com/docs/guides/platform/free-project-pausing

## Backup model

Webcanbe treats the Git repository as the source of truth for schema and migration logic.

The operator backup therefore captures **data only** for `public.wcb_*` tables. It deliberately does not dump:

- Supabase platform/auth schemas
- database passwords/custom-role credentials
- Cloudflare secrets
- Firebase secrets
- Storage objects
- GitHub/Google OAuth secrets

This prevents a recovery archive from becoming a second secret store and avoids restoring Supabase-managed internals into a fresh project.

## Requirements

Install PostgreSQL client tools that provide:

- `pg_dump`
- `pg_restore`

Keep the direct PostgreSQL connection URL in a private operator environment variable:

```bash
export WEBCANBE_DATABASE_URL='postgresql://webcanbe_hyperdrive:PRIVATE_PASSWORD@db.kappcfofcobhudmeuzmt.supabase.co:5432/postgres?sslmode=require'
```

Do not put that value in:

- GitHub
- `.env.example`
- frontend `VITE_*` variables
- Cloudflare source files
- ChatGPT

## Create a backup

```bash
npm run db:backup
```

Optional explicit output path:

```bash
npm run db:backup -- backups/manual-before-migration.dump
```

The command creates:

- a PostgreSQL custom-format, data-only archive
- a sibling `.sha256` checksum file

The database URL is translated into `PGHOST` / `PGUSER` / `PGPASSWORD` child-process environment variables; it is not passed to `pg_dump` as a command-line argument.

## Verify a backup

Always verify an archive immediately after creating/copying it:

```bash
npm run db:backup:verify -- backups/manual-before-migration.dump
```

Verification checks:

1. file exists and is non-empty
2. SHA-256 matches when a checksum file exists
3. `pg_restore --list` can read the archive
4. the archive contains a reasonable number of `public.wcb_*` table-data entries

A backup that has not passed verification is not considered a usable backup.

## Storage rule

`backups/` is gitignored.

After verification, copy the archive and checksum to an encrypted location **outside both Supabase and this Git repository**. Keep at least one independent copy.

Do not commit production database dumps to GitHub.

## Required cadence before public launch

Until the project moves to a plan with managed backups/PITR:

- backup before every production schema migration
- backup before payment/entitlement migrations
- backup before destructive operational maintenance
- maintain a regular off-site backup cadence once real user data exists
- verify every created copy

## Recovery strategy

Do not restore directly over the only production database as the first recovery step.

Preferred recovery flow:

1. Stop/disable product mutations if production is still reachable.
2. Preserve the damaged production DB for investigation; do not immediately overwrite it.
3. Create a separate recovery PostgreSQL/Supabase project.
4. Apply the source-controlled Webcanbe schema/migrations to the recovery DB.
5. Set a private `RECOVERY_DATABASE_URL` for the new DB.
6. Restore the verified data archive into the recovery DB.
7. Run integrity and security checks.
8. Run Webcanbe readiness + auth/catalog/workspace smoke against the recovery environment.
9. Only after verification, switch Hyperdrive/application traffic to the recovered database.
10. Rotate DB credentials after the incident and update the Hyperdrive origin configuration.

Restore into an already migrated **recovery** DB only through the guarded wrapper. It verifies the archive and source manifest, proves the recovery target is not the recorded or current production identity, and performs the identity assertion, truncate, and restore in one rollback-safe database session:

```bash
WEBCANBE_DATABASE_URL='postgresql://PRODUCTION_REFERENCE_URL' \
RECOVERY_DATABASE_URL='postgresql://RECOVERY_TARGET_URL' \
WEBCANBE_RESTORE_CONFIRM=RESTORE_RECOVERY_TARGET \
npm run db:restore:recovery -- backups/webcanbe-data-YYYY.dump
```

Do not bypass this wrapper with a direct networked `pg_restore`; that separates target verification from the destructive restore connection.

## Recovery validation

Before cutover, confirm at minimum:

- expected Webcanbe table count
- Supabase Security Advisor has no unresolved security findings
- browser `anon` / `authenticated` roles still have no `wcb_*` table privileges
- `webcanbe_runtime` / Hyperdrive login remain non-superuser
- immutable release/listing/audit triggers still exist
- readiness endpoint reports database/schema ready
- Google/Firebase first-party DB sessions work
- owner workspace is recovered
- purchases/entitlements match expected rows
- working-copy materializations resolve exact release provenance

## Paid-plan transition

Before material production usage, reconsider the database plan. Supabase Pro currently provides managed daily backups with seven-day retention; PITR is a separate paid add-on for lower RPO. The application backup procedure should remain useful even after upgrading because it provides an operator-controlled off-site logical copy.


## Automated recovery preflight

After restoring data into a separately migrated recovery database, set `RECOVERY_DATABASE_URL` in the private operator shell and run:

```bash
npm run db:recovery:preflight
```

The preflight is read-only. It verifies:

- at least 40 `public.wcb_*` tables exist
- `anon` and `authenticated` retain zero direct `wcb_*` table grants
- `anon` and `authenticated` retain zero direct `wcb_*` routine grants
- `webcanbe_runtime` remains a bounded non-login role
- `webcanbe_hyperdrive` remains a bounded login role
- immutable release, published-listing guard, and control-audit triggers exist
- Supabase migration history contains the expected launch-era baseline

The command never prints the database URL and performs only SELECT queries. A passing preflight does not replace application-level auth/catalog/workspace smoke.
