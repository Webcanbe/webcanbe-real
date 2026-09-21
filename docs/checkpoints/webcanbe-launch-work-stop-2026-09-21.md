# Webcanbe Launch Work — hourly automation stop checkpoint

Recorded: 2026-09-21 KST.

## Automation state

- The hourly ChatGPT automation `Webcanbe Launch Work` was explicitly disabled by the user on 2026-09-21 KST.
- Last recorded automation run time before disable: 2026-09-21 15:39 KST.
- Do not resume hourly autonomous work unless the user explicitly re-enables or asks to continue it.

## Production / main

- Production/main: `c0889c867170219545c7f05662e7f0c744a83362` (`Fix Firebase popup CSP`).
- Cloudflare production build has all six Firebase Web build variables.
- Firebase popup CSP is live and credential-free GitHub provider initiation reaches the official GitHub OAuth boundary.
- Production product mutation remains OFF.

## Gate 2

- Credential-free provider-boundary proof is complete.
- Verified clean provider-boundary run: `35546159751`.
- Human-authenticated Gate 2 is still pending:
  - Google-backed account baseline + private reads + refresh
  - link GitHub and Email to the same internal Webcanbe account
  - logout
  - linked GitHub login -> same account + reads/refresh/logout
  - linked Email login -> same account + reads/refresh/logout
- Do not mark Gate 2 fully green until that authenticated same-account evidence exists.

## Gate 3 / Gate 4

- Active activation candidate: `phase5-gate3-materialization-staging-v4`.
- Draft PR: #45.
- Branch head at stop review: `aa1cf8571ae6a95aff653d7385fdf883d9ea50e3`.
- Exact main -> v4: ahead 24 / behind 0.
- Integrated Gate 3 v4 verification: `35545791365` PASS.
- Combined Gate 4 Visual + Code launch-chain checkpoint: `85c66326ae85ffe5065197ecd4272673b1021bf2`.
- Combined launch-chain verification: `35546569409` PASS.
- v4 remains STAGING ONLY and must stay unmerged/unactivated until authenticated Gate 2 is green.

## Gate 5 recovery / rollback

- Active recovery branch: `phase5-recovery-restore-rehearsal`.
- Draft PR: #46.
- Branch head at stop: `04880ad83425bfe45598e58b66614db6121d49fb` (documentation checkpoint).
- Exact main -> recovery branch: ahead 26 / behind 0.
- Latest verified recovery implementation/test checkpoint: `3b708ba09931f4dde6cea07545074cf04b551ff6`.
- Recovery CI: `35569282299`, job `106237292624`: PASS.

### Recovery work completed

- Worker rollback plan/execution preflight verifies requested target exists and current active deployment evidence exists.
- After rollback, active deployment is re-read and the requested target must actually be active before production smoke is accepted.
- Post-rollback production smoke must pass with database expected ready.
- Recovery DB restore tooling requires a distinct recovery target and explicit confirmation.
- Backup verification occurs before target mutation.
- Restore is data-only, single-transaction, exit-on-error, and followed by recovery preflight.
- Recovery restore now uses connected PostgreSQL identity guards:
  - probes production and recovery with `pg_control_system().system_identifier` + `current_database()`
  - refuses DNS/hostname aliases that actually point to the same PostgreSQL cluster/database
  - refuses failed/malformed identity probes
  - refuses connected database-name mismatch
  - keeps DB credentials out of CLI args
- These refusal paths are covered by fake-tool regressions; CI did not touch a live production/recovery DB.

## No live destructive action performed

- No production materialization mutation enabled.
- No launch fixture applied to production.
- No live Worker rollback executed.
- No live recovery DB truncate/restore executed.
- No payment/seller payout authority enabled.

## Exact resume point if work restarts

1. Re-read main, PR #45/v4, PR #46/recovery and latest CI before any write.
2. Human-authenticated Gate 2 remains the production activation blocker.
3. Independent Gate 5 next task from the latest recovery checkpoint: bind backup artifacts to a non-secret source PostgreSQL cluster/database identity manifest and verify it during recovery restore, so source identity does not depend only on simultaneous production reachability.
4. Keep Gate 3 v4 at 0 behind relative to main before any eventual promotion.
5. Do not enable production mutation until authenticated Gate 2 is genuinely green.
