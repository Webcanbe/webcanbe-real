# Gate 5 recovery / Worker rollback-plan checkpoint — 2026-09-21 KST

## Verified checkpoint

- Production/main remains `c0889c867170219545c7f05662e7f0c744a83362` (`Fix Firebase popup CSP`).
- Gate 3 activation candidate remains `phase5-gate3-materialization-staging-v4` at `aa1cf8571ae6a95aff653d7385fdf883d9ea50e3`; exact main→v4 comparison is still ahead-only / 0 behind.
- Gate 5 recovery branch: `phase5-recovery-restore-rehearsal`, draft PR #46.
- Latest verified Gate 5 code/test checkpoint: `a417e10c083578cf58abfc36fc8c9e46bb38e869`.
- Recovery verification run `35551013662`, job `106185647363`: **PASS**.
  - recovery/restore regressions: PASS
  - recovery tooling syntax: PASS
  - secret scan: PASS
- Later commits in this branch may be documentation-only `[skip ci]`; do not treat them as new implementation evidence without a new verification run.

## Worker rollback hardening completed

- `scripts/cloudflare-rollback.mjs` supports a non-mutating `WEBCANBE_ROLLBACK_PLAN_ONLY=1` mode.
- Plan mode validates the supplied UUID-shaped Worker Version ID and performs two read-only Wrangler queries:
  - `wrangler versions list --json`
  - `wrangler deployments status --json`
- The exact rollback target must exist in the current recent-version data.
- Current deployment status must expose at least one Worker version ID; otherwise planning fails closed rather than executing with unknown active state.
- Plan output records both the verified rollback target and the current active Worker version ID(s).
- If the rollback target is already present in the current deployment, the plan explicitly tells the operator to inspect traffic allocation before taking action.
- Plan mode never invokes `wrangler rollback`, requires no destructive confirmation flag, and makes no deployment/traffic change.
- A missing target fails before the deployment-status query. Missing active-version evidence also fails closed.
- Existing destructive rollback protections remain unchanged: an actual rollback requires `WEBCANBE_ROLLBACK_CONFIRM=ROLLBACK_PRODUCTION` and forwards only the exact operator-supplied version ID.
- Behavioral subprocess coverage proves the read-only target/status queries, active-version reporting, fail-closed paths, and exact destructive forwarding against a fake Wrangler boundary.
- `docs/operations/cloudflare-rollback.md` documents this preflight before any controlled rollback.

## Recovery restore tooling already prepared

- The branch still carries the guarded recovery-only restore path from verified checkpoint `d7585eb605ac9d377721d34b04c71e3cd851fa9e`.
- It requires a distinct recovery DB target and explicit `WEBCANBE_RESTORE_CONFIRM=RESTORE_RECOVERY_TARGET` confirmation.
- It verifies the backup before mutation, checks the canonical recovery schema, truncates only the recovery target, restores data-only with `--exit-on-error --single-transaction`, and runs recovery preflight afterward.
- Plan-only restore rehearsal remains non-mutating.

## Safety / launch status

- No live Worker rollback was executed.
- No production database or recovery database was mutated.
- Production product mutation remains OFF.
- Draft PR #46 remains recovery-preparation only and is not merged into Gate 3 v4.
- Gate 2 provider initiation is already closed; do not repeat it. Gate 2 as a whole still requires the human-authenticated same-account GitHub/Email link/login/private-read/refresh/logout sequence before Gate 3 production activation.
- The controlled live Worker rollback drill and a real off-site recovery-database restore remain pending Gate 5 drills.

## One next autonomous action

Continue Gate 5 without touching production by extending the recovery rehearsal to verify the *post-rollback* verification contract against fixtures: after a simulated rollback command, require a production-smoke/readiness verification step in the runbook/test harness before the drill can be considered complete. Keep the real rollback itself pending until a controlled production drill is explicitly safe.
