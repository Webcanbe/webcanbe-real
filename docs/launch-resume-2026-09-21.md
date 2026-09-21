# Latest recovery continuation — 2026-09-21 KST

- Production/main: `c0889c867170219545c7f05662e7f0c744a83362` (`Fix Firebase popup CSP`).
- Active Gate 3 activation candidate: `phase5-gate3-materialization-staging-v4` at `aa1cf8571ae6a95aff653d7385fdf883d9ea50e3`, draft PR #45; exact main→v4 comparison is ahead-only / **0 behind**. Keep it staging-only until authenticated Gate 2 is green.
- Gate 2 credential-free GitHub provider boundary is verified. Gate 2 as a whole is still pending the user's authenticated Google baseline + same-account GitHub/Email link/login/read/refresh/logout sequence. Do not repeat the credential-free provider-boundary proof unless deployed auth configuration changes.
- Production product mutation remains OFF.
- Gate 5 recovery branch: `phase5-recovery-restore-rehearsal`, draft PR #46.
- Latest verified recovery implementation/test checkpoint: `faf4e5f66e83c9de1cd0e7991e56bdc382a1cf42`.
- Recovery CI `35564722856`, job `106224184976`: **PASS** across recovery regressions, syntax checks and secret scan.
- Confirmed Worker rollback now requires target/current-deployment preflight before `wrangler rollback`; after Wrangler returns success it re-reads `wrangler deployments status --json` and requires the exact requested target UUID to be present in the active deployment before any production smoke can run. A wrong-active-version outcome fails closed and skips the smoke, preventing a healthy unrelated deployment from being mistaken for a successful rollback.
- Only after target convergence is proved does the wrapper run `npm run smoke:production:public` with `WEBCANBE_EXPECT_DATABASE=ready`; a failed smoke keeps the overall recovery command failed even though the rollback has already occurred.
- No live Worker rollback was executed and no production/recovery database was mutated by this checkpoint.
- Next independent recovery action: harden recovery-target identity before `TRUNCATE` by adding a read-only connected-server identity check for production and recovery targets, so DNS aliases that resolve to the same PostgreSQL server/database cannot bypass the existing URL host/port/database comparison; prove the refusal path without touching a live DB.

---

# Webcanbe interruption-safe launch checkpoint

Recorded: 2026-09-21 KST. This is an incremental continuation record, not a replacement for historical handoffs.

## Verified starting point

- Repository: `Webcanbe/webcanbe-real`.
- Main at the start of this continuation: `044a6a5d29b5f91b2f5074ff2c8eff2a4bacae10`.
- Last verified main implementation checkpoint: `0ad5747a89a01414b966ac8ceee82eb44c6c1768`.
- Main already includes the founder-goal handoff commit `8d1c191982231b733e6c2f0fb951b413a262aa65`; preserve it during reconciliation.
- The interrupted launch-plan update did land: `044a6a5d29b5f91b2f5074ff2c8eff2a4bacae10` records the recovery preflight. Do not recreate that update blindly.
- Active materialization staging: `phase5-gate3-materialization-staging-v3` at `9f8b5d184682567bb7881af2a1f42ddc71bd5e1e`.
- Comparing those exact main/staging SHAs returned 50 ahead / 3 behind, merge base `0ad5747a89a01414b966ac8ceee82eb44c6c1768`. These counts are a snapshot, not a merge approval.

## Evidence recovered after interruption

- Main browser matrix `35517525373`, job `106095859190`: completed successfully; result re-read in this continuation. This is the existing public Chromium/Firefox/WebKit desktop/mobile matrix, not authenticated provider E2E.
- Staging UI verification `35517938841`, job `106096928007`: completed successfully; result re-read in this continuation.
- Existing main handoff records main UI `35517472985`, durable `35517473076`, Bigperson `35517473013`, production smoke `35517512404`, and browser matrix `35517525373` as PASS.
- Existing main handoff records staging durable `35517938853` and Bigperson `35517938844` as PASS.
- Do not rerun unchanged completed work merely because a conversation or tool response was interrupted.

## Important unresolved integration delta

The manifest difference was re-read directly at the pinned SHAs:

- Main `package.json` includes `db:recovery:preflight: node scripts/db/recovery-preflight.mjs`.
- Staging `package.json` includes `launch:smoke-fixture: node scripts/launch/materialization-smoke-fixture.mjs` but lacks `db:recovery:preflight`.
- Therefore the existing staging tip is not safe to promote unchanged, despite its passing selected CI and the historical claim that it was zero behind.
- Preserve both commands in any eventual approved integration. Do not hide the omission with a synthetic merge or suppress the recovery regression to obtain green CI.
- Earlier package-script writes were reported blocked by tool safety. This continuation did not retry that blocked write through a different interface and did not change either package manifest.

## Gate status to preserve

- Production product reads and Control are already live according to the verified handoff.
- Gate 2 authenticated GitHub/Email linking, same-account login, refresh and logout evidence remains incomplete. This continuation made no database query and must not represent historical identity counts as newly checked.
- Gate 3 production mutation activation and the private fixture application remain pending. This continuation did not enable either.
- Gate 4 staging source/save/export tests are not proof of the full production buyer/editor path.
- Public browser/accessibility/basic performance checks and recovery-wrapper rehearsals are completed subchecks; the live Worker rollback and real off-site database restore drill remain pending. Gate 5 as a whole is not closed.
- Payment and seller commercial activation remain separate unfinished work.

## Hourly interruption recovery

The existing `Webcanbe Launch Work` hourly task was updated without changing its schedule or creating another task.

At the next invocation after any interruption, inspect remote heads, this note, the current handoff/plan and the exact existing CI runs first. Recover the last unfinished implementation, verification or documentation step. Check whether writes with lost responses already landed before retrying. Continue automatically on that scheduled invocation; another user message is not required.

Before each write, re-read affected branch/file state. On a non-fast-forward conflict, preserve concurrent changes and reconcile rather than force-pushing. Save a bounded checkpoint before a long test. Record pending tests as pending, and blocked work as blocked. A permission or safety denial is not permission to switch interfaces to bypass it.

`docs/current-handoff.md` and the launch plan contain historical recovery work; this incremental record is the newest continuity anchor. Use the latest section above when older blocks conflict, and do not repeatedly prepend unchanged status merely to create activity.

## Next autonomous action

Continue the recovery branch with the connected-server identity guard described in the latest section above. Keep the human-authenticated Gate 2 same-account sequence pending without re-running the already-closed credential-free provider-boundary proof. Before any Gate 3 activation, re-read main and v4 and preserve v4 at zero-behind; do not enable production mutation until authenticated Gate 2 is genuinely green.