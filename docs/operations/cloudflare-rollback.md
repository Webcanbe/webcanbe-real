# Webcanbe Cloudflare Worker rollback

Status: 2026-09-21 KST

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
6. Verify the target and current production deployment without changing production:

```bash
WEBCANBE_ROLLBACK_PLAN_ONLY=1 \
npm run deploy:rollback -- <WORKER_VERSION_ID>
```

Plan mode performs two read-only Wrangler queries: `wrangler versions list --json` and `wrangler deployments status --json`. It requires the exact target UUID to appear in recent-version data and requires current deployment status to expose at least one active Worker version ID. It prints the verified rollback target and the currently active version ID(s), then exits without calling `wrangler rollback` or changing traffic. If either source is unavailable, malformed, the target is missing, or current-version evidence cannot be identified, the wrapper fails closed. If the target is already present in the current deployment, inspect the traffic allocation before taking action.

7. If the incident includes DB schema/data changes, take a fresh DB backup if possible and use `docs/operations/database-backup-restore.md` as the recovery plan.

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

After explicit confirmation but **before** `wrangler rollback`, the execution path repeats the same read-only target/current-deployment preflight used by plan mode. A stale or missing target, malformed Wrangler JSON, failed version/status query, or missing current-deployment version evidence stops the command before any rollback. Only after those checks pass does the wrapper forward the exact operator-supplied version ID to `wrangler rollback`.

The script never automatically chooses “previous” because the immediately previous version may itself be bad.

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

Behavioral subprocess rehearsal now covers both planning and confirmed execution. Invalid version IDs and missing production confirmation are refused before the fake Wrangler boundary. Plan mode proves the exact recent target and current deployment are read through `versions list` and `deployments status` without a rollback call. Confirmed execution proves those same two read-only checks run again before the exact approved UUID is forwarded to `wrangler rollback`; a stale target stops before status/rollback. Missing active-version evidence also fails closed. A live production rollback drill has **not** been intentionally executed yet, so do not mark the live rollback procedure fully tested until a controlled drill is performed against a safe known-good version.
