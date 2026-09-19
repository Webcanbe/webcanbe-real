# Webcanbe Cloudflare Worker rollback

Status: 2026-09-19 KST

## Purpose

This runbook rolls the **Worker deployment** back to a previously published Cloudflare Worker version.

A Worker rollback can restore the prior Worker code/static assets/bindings/compatibility configuration captured in that Worker version. It does **not** rewind PostgreSQL data or other external resource state. If an incident includes a database migration or corrupted data, use the database recovery runbook separately.

Cloudflare reference:

- https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/
- https://developers.cloudflare.com/workers/wrangler/commands/workers/

## Before rollback

1. Confirm the incident is caused by the deployed Worker/application version.
2. Check `docs/current-handoff.md` for the most recent known-good implementation checkpoint.
3. Inspect recent Cloudflare versions:

```bash
npm run deploy:versions
```

4. Inspect current/recent deployments:

```bash
npm run deploy:deployments
```

5. Select the exact known-good **Worker Version ID**. Do not guess.
6. If the incident includes DB schema/data changes, take a fresh DB backup if possible and use `docs/operations/database-backup-restore.md` as the recovery plan.

## Execute rollback

The repository wrapper refuses to act without both:

- a UUID-shaped Worker Version ID
- the explicit production confirmation environment variable

```bash
WEBCANBE_ROLLBACK_CONFIRM=ROLLBACK_PRODUCTION \
npm run deploy:rollback -- <WORKER_VERSION_ID>
```

Optional incident message:

```bash
WEBCANBE_ROLLBACK_CONFIRM=ROLLBACK_PRODUCTION \
WEBCANBE_ROLLBACK_MESSAGE='Rollback after production auth regression' \
npm run deploy:rollback -- <WORKER_VERSION_ID>
```

The script passes the exact version ID to `wrangler rollback`. It never automatically chooses “previous” because the immediately previous version may itself be bad.

## After rollback

Verify in order:

1. `https://webcanbe.com/` returns normally.
2. `POST /__webcanbe/auth/session` still refuses unauthenticated requests normally rather than 500.
3. Google login can begin.
4. If Firebase login was involved, test Firebase exchange only with a real provider login.
5. Public Marketplace/catalog route returns the expected state.
6. If Hyperdrive is active, run `POST /__webcanbe/ops/readiness`.
7. Verify dashboard protected-route behavior.
8. Check Cloudflare errors/logs for the incident window.
9. Record the rollback version ID, cause, and recovery result in `docs/current-handoff.md`.

## Important database warning

Cloudflare Worker rollbacks do not revert:

- Supabase/PostgreSQL rows
- schema migrations
- external payment state
- Firebase accounts
- secrets stored outside the Worker version
- external provider side effects

If old Worker code is incompatible with a newer DB schema, a Worker rollback can make the incident worse. In that situation, restore/repair the DB or deploy a forward-fix version instead.

## Roll-forward

Once the root cause is fixed:

1. branch from the intended source state
2. run the full Phase 5 verification workflow
3. deploy normally
4. run production smoke
5. keep the rollback version available until the new deployment is proven stable

## Drill status

The rollback wrapper and guardrails are CI-verified, but a live production rollback drill has **not** been intentionally executed yet. Do not mark the Phase 5 “rollback procedure tested” item complete until a controlled drill is performed against a safe known-good version.
