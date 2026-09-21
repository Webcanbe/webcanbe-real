# Gate 5 recovery / Worker rollback-plan checkpoint — 2026-09-21 KST

## Verified checkpoint

- Production/main remains `c0889c867170219545c7f05662e7f0c744a83362` (`Fix Firebase popup CSP`).
- Gate 3 activation candidate remains `phase5-gate3-materialization-staging-v4` at `aa1cf8571ae6a95aff653d7385fdf883d9ea50e3`; exact main→v4 comparison remains ahead-only / **0 behind**.
- Gate 5 recovery branch: `phase5-recovery-restore-rehearsal`, draft PR #46.
- Latest verified Gate 5 implementation/test checkpoint: `4a6d33ec35f20cd1c8ac2cba21133165f08961ac`.
- Recovery verification run `35554572340`, job `106195587316`: **PASS**.
  - recovery/restore regressions: PASS
  - recovery tooling syntax: PASS
  - secret scan: PASS
- Later `[skip ci]` documentation commits do not represent newer implementation evidence.

## Worker rollback hardening completed

- `scripts/cloudflare-rollback.mjs` supports a non-mutating `WEBCANBE_ROLLBACK_PLAN_ONLY=1` mode.
- Plan mode validates the supplied UUID-shaped Worker Version ID and performs two read-only Wrangler queries:
  - `wrangler versions list --json`
  - `wrangler deployments status --json`
- The exact rollback target must exist in the current recent-version data.
- Current deployment status must expose at least one Worker version ID; otherwise planning fails closed rather than operating with unknown active state.
- Plan output records both the verified rollback target and current active Worker version ID(s).
- If the rollback target is already present in the current deployment, the plan tells the operator to inspect traffic allocation before taking action.
- Plan mode never invokes `wrangler rollback` and makes no deployment/traffic change.
- A missing target fails before the deployment-status query. Missing active-version evidence also fails closed.

### Confirmed execution now repeats the preflight

- Actual rollback still requires `WEBCANBE_ROLLBACK_CONFIRM=ROLLBACK_PRODUCTION`; missing confirmation fails **before any Wrangler subprocess is invoked**.
- After confirmation and before `wrangler rollback`, the wrapper now repeats the same two read-only checks used by plan mode.
- A stale/missing target, failed/malformed `versions list`, failed/malformed `deployments status`, or missing active-version evidence stops execution before the destructive command.
- Only after that preflight passes is the exact operator-supplied UUID forwarded to `wrangler rollback`; the wrapper never chooses a previous version automatically.
- Behavioral subprocess coverage proves this sequence against a fake Wrangler boundary and proves a stale target cannot reach either the status query or rollback command.
- Operational runbook `docs/operations/cloudflare-rollback.md` records the same execution contract.

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
- Gate 2 credential-free provider boundary remains closed. Gate 2 as a whole still requires the human-authenticated same-account GitHub/Email link/login/private-read/refresh/logout sequence before Gate 3 production activation.
- Gate 3 v4 remains draft/staging only; no launch fixture or materialization switch was enabled in production.
- The controlled live Worker rollback drill and a real off-site recovery-database restore remain pending Gate 5 drills.

## One next autonomous action

Continue Gate 5 without touching production by enforcing the **post-rollback verification contract** in the rehearsal harness: after a simulated successful rollback, require a production smoke/readiness verification step before the drill can be considered successful, and prove that verification failure leaves the drill failed. Keep the real rollback itself pending until a controlled production drill is explicitly safe.
