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

## Required post-rollback verification

A zero exit from `wrangler rollback` is not considered a successful Webcanbe recovery by the wrapper.

First, immediately after Wrangler succeeds, `scripts/cloudflare-rollback.mjs` runs a fresh read-only:

```bash
npx wrangler deployments status --json
```

The exact requested rollback target UUID must now be present in the current Worker deployment. If deployment status is unavailable/malformed, exposes no version IDs, or shows a different active version instead of the requested target, the wrapper exits non-zero and **does not run the production smoke**. This prevents a healthy response from an unrelated still-active deployment from being accepted as rollback proof.

Only after requested-target convergence is verified does the wrapper automatically run:

```bash
WEBCANBE_EXPECT_DATABASE=ready npm run smoke:production:public
```

This verifies the production root/security headers, hosted Control/read mode with mutations still closed, readiness, authoritative catalog access, anonymous private-read refusal, and anonymous materialization refusal against the live production origin. The wrapper exits 0 only when both requested-target deployment evidence and this production smoke/readiness check pass.

If either post-check fails, the wrapper exits non-zero and prints that recovery is incomplete. **The Worker rollback command has already occurred at that point**; a failed convergence check or smoke does not undo it. Investigate the live deployment and choose either a forward fix or another explicitly verified rollback target rather than assuming the previous state was restored.

After the automated post-check is green, verify incident-specific behavior as needed:

1. Google login can begin.
2. If Firebase login was involved, test Firebase exchange only with a real provider login.
3. Check Cloudflare errors/logs for the incident window.
4. Record the rollback version ID, cause, deployment-convergence result, automated smoke result, and recovery result in `docs/current-handoff.md`.

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

Behavioral subprocess rehearsal covers planning, confirmed execution preflight, requested-target convergence, and the post-rollback success contract. Invalid version IDs and missing production confirmation are refused before the fake Wrangler boundary. Plan mode proves the exact recent target and current deployment are read through `versions list` and `deployments status` without a rollback call. Confirmed execution proves those same two read-only checks run again before the exact approved UUID is forwarded to `wrangler rollback`; a stale target stops before status/rollback. Missing active-version evidence also fails closed.

After a simulated successful rollback, the harness performs a second `deployments status --json` read. A wrong post-rollback active version fails closed and proves the smoke is not invoked. Only when the requested target is present does the harness require `smoke:production:public` with `WEBCANBE_EXPECT_DATABASE=ready`; a simulated smoke failure keeps the overall recovery command failed even though the rollback command itself succeeded.

Verified implementation/test checkpoint: `faf4e5f66e83c9de1cd0e7991e56bdc382a1cf42`. Recovery CI `35564722856`, job `106224184976`: **PASS**.

A live production rollback drill has **not** been intentionally executed yet, so do not mark the live rollback procedure fully tested until a controlled drill is performed against a safe known-good version.