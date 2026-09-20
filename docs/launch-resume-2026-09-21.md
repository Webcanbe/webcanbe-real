# Webcanbe interruption-safe launch checkpoint

Recorded: 2026-09-21 KST. This is an incremental continuation record, not a replacement for historical handoffs.

## Gate 2 production blocker isolated — 2026-09-21 KST

- Production/main remains `381fdc7e300d05e6f4b22cf46e2e7715614e7d01`.
- New diagnostic branch: `phase5-gate2-provider-boundary-smoke`; draft PR #42.
- Focused static Gate 2 tests: **7/7 PASS**.
- Real production browser probe against `https://webcanbe.com/_ops/gate2-auth-smoke` proves route/noindex and no-write safety, but the GitHub provider popup does not open because production reports `Firebase Authentication is not configured.`
- Production bundle inspection proves all six Firebase Web SDK fields were compiled as `void 0`: `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`.
- Latest diagnostic evidence: workflow `35543004163`, job `106163934006`.
- The probe entered no credentials, made no authorization/link decision, called no Firebase exchange/link endpoint, created no Webcanbe first-party session, enabled no product mutation, and changed no production product data.
- Therefore the current first release blocker is **production build-time Firebase Web configuration**, before the remaining human-authenticated Gate 2 E2E.

### Exact next order

1. Restore the six public `VITE_FIREBASE_*` values in the production **Vite/Cloudflare build environment** and rebuild main.
2. Re-run the credential-free provider-boundary smoke until it reaches the official GitHub provider page without identity exchange/link/session side effects.
3. Then run the human-authenticated Gate 2 same-account GitHub + Email E2E.
4. Keep Gate 3/product mutation OFF until Gate 2 is genuinely green.
5. Then proceed with the already-reconciled Gate 3 activation candidate and production Gate 4 launch chain.
6. Live Worker rollback, real off-site DB restore, and commercial payment/seller activation remain separate later gates.

---

## Latest verified checkpoint

- Production/main remains `381fdc7e300d05e6f4b22cf46e2e7715614e7d01`.
- Gate 3 staging was reconciled with current main instead of being promoted from the diverged `9f8b5d184682567bb7881af2a1f42ddc71bd5e1e` tree unchanged.
- Backup before reconciliation: `backup/gate3-v3-before-main-reconcile-20260921` at `9f8b5d184682567bb7881af2a1f42ddc71bd5e1e`.
- Reconciled Gate 3 code checkpoint: `edc11bb0df4b54defec030a9cfa068b10ae2236c`.
- Exact main → reconciled staging comparison: **ahead 52 / behind 0**. The diff contains the intended Gate 3 launch/materialization helpers and workflow targeting changes; current-main handoff/launch documents are preserved rather than dropped.
- `package.json` at the reconciled checkpoint contains both operator commands:
  - `db:recovery:preflight` → `node scripts/db/recovery-preflight.mjs`
  - `launch:smoke-fixture` → `node scripts/launch/materialization-smoke-fixture.mjs`
- Reconciled staging verification at `edc11bb0df4b54defec030a9cfa068b10ae2236c`:
  - UI `35520243803`: **PASS**
  - durable editor/export `35520243786`: **PASS**
  - Bigperson `35520243691`: **PASS**
- No production mutation switch, entitlement fixture, payment authority, or production data mutation was enabled by this reconciliation.

## Gate 2 evidence recovered in this continuation

- Main source wiring was re-read rather than inferred from identity counts:
  - GitHub uses Firebase `signInWithPopup(..., new GithubAuthProvider())`.
  - Email signup/login use Firebase password APIs and the ordinary auth UI refuses blank email/password before provider calls.
  - The Gate 2 diagnostic only links GitHub/Email after an existing first-party session, and signed-out linked-provider tests exchange a fresh Firebase ID token for the Webcanbe first-party session.
  - Existing Gate 2 tests assert the noindex diagnostic route, provider-link gating, read-only private-read checks, password clearing, and no raw internal account ID rendering.
- This is **static source/test evidence only**. It does not prove that the deployed Firebase/GitHub provider configuration reaches the official provider screen or that a real linked login returns to the same production account.
- An isolated no-credential production browser check was attempted, but the permitted browser connector failed before opening the page with a usage-limit error. No browser, account, credential, session, or provider state was changed.
- Therefore Gate 2 / Gate 2B remain **not PASS**. Do not treat the static verification as authenticated E2E.

## Current launch status

- Gate 3 staging is now based on current main history and no longer drops the recovery-preflight operator command.
- Gate 3 remains staging-only. Product mutation remains OFF in production.
- Gate 2 authenticated GitHub/Email linking, same-account login, refresh and logout evidence remains the production activation blocker.
- Live Worker rollback and real off-site database restore remain separate pending Gate 5 drills.
- Payment/seller commercial activation remains separate unfinished work.

## Next autonomous action

When permitted isolated-browser execution is available, open `https://webcanbe.com/_ops/gate2-auth-smoke`, initiate the GitHub sign-in flow only until the official GitHub/Firebase provider page is reached, enter no credentials, make no authorization/link decision, and record the provider-boundary result or any pre-provider error. If the provider boundary succeeds, keep actual login/linking as user-authenticated E2E; do not mark Gate 2 green without that evidence.

---

## Earlier interruption snapshot

The following block is retained only as the pre-reconciliation snapshot. Where it conflicts with the latest verified checkpoint above, the latest checkpoint wins.

### Verified starting point

- Repository: `Webcanbe/webcanbe-real`.
- Main at the start of this continuation: `044a6a5d29b5f91b2f5074ff2c8eff2a4bacae10`.
- Last verified main implementation checkpoint: `0ad5747a89a01414b966ac8ceee82eb44c6c1768`.
- Main already includes the founder-goal handoff commit `8d1c191982231b733e6c2f0fb951b413a262aa65`; preserve it during reconciliation.
- The interrupted launch-plan update did land: `044a6a5d29b5f91b2f5074ff2c8eff2a4bacae10` records the recovery preflight. Do not recreate that update blindly.
- Active materialization staging: `phase5-gate3-materialization-staging-v3` at `9f8b5d184682567bb7881af2a1f42ddc71bd5e1e`.
- Comparing those exact main/staging SHAs returned 50 ahead / 3 behind, merge base `0ad5747a89a01414b966ac8ceee82eb44c6c1768`. These counts are a snapshot, not a merge approval.

### Evidence recovered after interruption

- Main browser matrix `35517525373`, job `106095859190`: completed successfully; result re-read in this continuation. This is the existing public Chromium/Firefox/WebKit desktop/mobile matrix, not authenticated provider E2E.
- Staging UI verification `35517938841`, job `106096928007`: completed successfully; result re-read in this continuation.
- Existing main handoff records main UI `35517472985`, durable `35517473076`, Bigperson `35517473013`, production smoke `35517512404`, and browser matrix `35517525373` as PASS.
- Existing main handoff records staging durable `35517938853` and Bigperson `35517938844` as PASS.
- Do not rerun unchanged completed work merely because a conversation or tool response was interrupted.

### Important unresolved integration delta at that time

The manifest difference was re-read directly at the pinned SHAs:

- Main `package.json` included `db:recovery:preflight: node scripts/db/recovery-preflight.mjs`.
- Staging `package.json` included `launch:smoke-fixture: node scripts/launch/materialization-smoke-fixture.mjs` but lacked `db:recovery:preflight`.
- Therefore that staging tip was not safe to promote unchanged, despite its passing selected CI and the historical claim that it was zero behind.
- Preserve both commands in any eventual approved integration. Do not hide the omission with a synthetic merge or suppress the recovery regression to obtain green CI.

### Gate status preserved from the earlier snapshot

- Production product reads and Control were already live according to the verified handoff.
- Gate 2 authenticated GitHub/Email linking, same-account login, refresh and logout evidence was incomplete.
- Gate 3 production mutation activation and the private fixture application were pending.
- Gate 4 staging source/save/export tests were not proof of the full production buyer/editor path.
- Public browser/accessibility/basic performance checks and recovery-wrapper rehearsals were completed subchecks; the live Worker rollback and real off-site database restore drill remained pending.
- Payment and seller commercial activation remained separate unfinished work.
