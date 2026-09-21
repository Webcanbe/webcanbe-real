# Gate 5 recovery / Worker rollback-plan checkpoint — 2026-09-21 KST

## Verified checkpoint

- Production/main remains `c0889c867170219545c7f05662e7f0c744a83362` (`Fix Firebase popup CSP`).
- Gate 3 activation candidate remains `phase5-gate3-materialization-staging-v4` at `aa1cf8571ae6a95aff653d7385fdf883d9ea50e3`; current main has not advanced, so the candidate remains current-main-based and zero-behind.
- Gate 5 recovery branch: `phase5-recovery-restore-rehearsal`, draft PR #46.
- Verified Gate 5 branch checkpoint: `96770dc0ce1edd68e665f90e33cd5c73199a2243`.
- Recovery verification run `35547935738`, job `106177148268`: **PASS**.
  - recovery/restore regressions: PASS
  - recovery tooling syntax: PASS
  - secret scan: PASS

## Worker rollback hardening completed in this checkpoint

- `scripts/cloudflare-rollback.mjs` now supports a non-mutating `WEBCANBE_ROLLBACK_PLAN_ONLY=1` mode.
- Plan mode validates the supplied UUID-shaped Worker Version ID, invokes only `wrangler versions list --json`, and requires the exact target UUID to appear in the returned recent-version data.
- Plan mode never invokes `wrangler rollback`, does not require the destructive production confirmation flag, and exits without changing any Worker deployment.
- A target absent from the current versions-list data fails closed instead of automatically choosing or substituting another version.
- Existing destructive rollback protections remain unchanged: an actual rollback still requires `WEBCANBE_ROLLBACK_CONFIRM=ROLLBACK_PRODUCTION` and forwards only the exact operator-supplied version ID.
- Behavioral subprocess coverage proves both paths: listed target succeeds without a rollback command; missing target fails; approved destructive rehearsal still forwards the exact version only to a fake Wrangler boundary.
- `docs/operations/cloudflare-rollback.md` now requires this plan step before an intentional rollback.

## Safety / launch status

- No live Worker rollback was executed.
- No production database or recovery database was mutated.
- Production product mutation remains OFF.
- Draft PR #46 remains recovery-preparation only and is not merged into the Gate 3 v4 activation candidate.
- Gate 2 provider initiation is already closed; do not repeat it. Gate 2 as a whole still requires the human-authenticated same-account GitHub/Email link/login/private-read/refresh/logout sequence before Gate 3 production activation.
- The controlled live Worker rollback drill and a real off-site recovery-database restore remain pending Gate 5 drills.

## One next autonomous action

Extend the non-mutating Worker rollback preflight on `phase5-recovery-restore-rehearsal` to read `wrangler deployments status --json` and record the currently active Worker version alongside the verified target, while still making zero deployment changes. This should give the later controlled live rollback drill explicit current-versus-target evidence without consuming the human-authenticated Gate 2 blocker.
