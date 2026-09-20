# Webcanbe interruption-safe launch checkpoint

Recorded: 2026-09-21 KST. This is an incremental continuation record, not a replacement for historical handoffs.

## Latest continuation — Firebase/CSP + Gate 3 v4

- Production/main code HEAD: `c0889c867170219545c7f05662e7f0c744a83362` (`Fix Firebase popup CSP`).
- The operator added and saved all six `VITE_FIREBASE_*` values under Cloudflare Builds → Variables and secrets and triggered a fresh production build.
- After that rebuild, the old `Firebase Authentication is not configured.` failure disappeared. The next real browser failure was `auth/internal-error` caused by production CSP blocking `https://apis.google.com/js/api.js`.
- Minimal CSP fix was verified on branch/PR #43 and squash-merged to main:
  - `script-src 'self' https://apis.google.com https://www.gstatic.com`
  - script `unsafe-inline` remains forbidden
  - `unsafe-eval` remains forbidden
  - focused Firebase/CSP tests, production build, and Wrangler dry-run: run `35545390283` **PASS**
- A provider-boundary smoke rerun immediately after the merge still observed the old live CSP (`script-src 'self'`), so Cloudflare propagation of `c0889c8` was **not yet proven** at that instant. Do not interpret that rerun as a failure of the merged CSP code.
- Actual authenticated GitHub/Email same-account E2E remains **NOT PASS**. Product mutation remains OFF on production.
- Diagnostic branch/PR #42 remains a no-credential provider-boundary probe; it must never enter credentials, approve OAuth, link an identity, or create a first-party session during the boundary-only check.

### Gate 3 v4 staging

- Old v3 was backed up at `backup/gate3-v3-before-firebase-sync-20260921`.
- The conflicted main→v3 sync PR #44 was closed without merge.
- New branch: `phase5-gate3-materialization-staging-v4`, rebuilt directly from current main `c0889c8`.
- Draft PR: #45.
- v4 carries forward:
  - private source-backed launch-smoke fixture/runbook
  - `launch:smoke-fixture` while retaining `db:recovery:preflight`
  - explicit staged frontend + Worker materialization switches
  - Gate 3 mutation-authority regression
  - Gate 4 immutable release → materialize → durable Code edit → reopen → standalone export/build regression
  - durable-editor and Bigperson verification coverage
  - the latest Firebase project-ID fallback and popup CSP fix from main
- Exact main→v4 relationship before this documentation commit: **ahead 15 / behind 0**.
- Integrated v4 verification workflow has been added; its final result is **pending** at this checkpoint.
- v4 is staging-only. Do **not** merge/deploy its mutation switches to production until authenticated Gate 2 is green.

### Exact next actions

1. Re-run the credential-free Gate 2 provider-boundary smoke once live Cloudflare production serves the new CSP; require an official `github.com` provider page with zero exchange/link/session side effects.
2. Finish/read the Gate 3 v4 integrated CI and repair only genuine regressions.
3. If provider boundary passes but actual login/linking needs the operator, record that human-only Gate 2 blocker once and continue independent Gate 3/4/5 work.
4. Never enable production materialization mutation before same-account GitHub/Email login + private reads + refresh + logout evidence is green.
5. After Gate 2, use v4—not v3—as the activation candidate.

---

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

`docs/current-handoff.md` and the launch plan contain the latest recovery work; the legacy resume/project-record headers may still show the earlier browser checkpoint. Use this incremental record to avoid falling back to that older state. Do not repeatedly prepend unchanged status to all documents merely to create activity.

## Next autonomous action

Check the existing production GitHub/Firebase sign-in initiation in an isolated browser without entering credentials or linking accounts, and capture any failure before the provider sign-in screen. This can distinguish a code/configuration blocker from the remaining user-only authenticated E2E. If the official provider sign-in screen is reached, record that limited result and keep the actual login/linking gate pending; do not impersonate the user or create accounts. Reconcile the staging integration delta only through permitted operations before any future activation.
