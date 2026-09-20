# GATE 5 RECOVERY / DR PREFLIGHT CLOSED — 2026-09-20 KST

# GATE 3 V4 CURRENT-MAIN STAGING VERIFIED — 2026-09-21 KST

- Current activation candidate is `phase5-gate3-materialization-staging-v4`; v3 is historical/backup only.
- v4 was rebuilt directly from current main after Firebase build-variable/project-ID/CSP fixes rather than merging the diverged v3 tree.
- Verified checkpoint: `bd03d69726b31a70e2a981b35b609fe3ac69e33f`.
- Integrated run `35545791365` / job `106171321936`: **PASS** across Gate 3/4 launch-chain, durable editor/export, Bigperson authority, build budget, production build and Worker dry-run.
- Firebase/CSP focused run `35545791377`: **PASS**.
- Backup before retiring v3 as the active line: `backup/gate3-v3-before-firebase-sync-20260921`.
- Conflicted PR #44 was closed without merge; draft PR #45 is the v4 staging candidate.
- Production materialization mutation remains OFF; no fixture has been applied.
- Gate 2 authenticated same-account GitHub/Email E2E remains required before v4 can be promoted.

---

- Production verification trigger/code checkpoint: `0ad5747a89a01414b966ac8ceee82eb44c6c1768`.
- Main verification:
  - UI `35517472985`: **PASS**
  - durable editor/export `35517473076`: **PASS**
  - Bigperson `35517473013`: **PASS**
  - production smoke `35517512404`: **PASS**
  - Chromium / Firefox / WebKit browser matrix `35517525373`: **PASS**
- Production DB recovery invariants were rechecked live:
  - 40 `public.wcb_*` tables
  - 11 recorded Supabase migrations
  - direct `anon` / `authenticated` table grants on `wcb_*`: **0**
  - direct `anon` / `authenticated` routine grants on `wcb_*`: **0**
  - `webcanbe_runtime`: non-superuser, non-login, no create-role/create-db/replication/bypass-RLS
  - `webcanbe_hyperdrive`: bounded login role, non-superuser, no create-role/create-db/replication/bypass-RLS
  - immutable project-release, published-listing guard, and control-audit triggers are present
  - Supabase Security Advisor: **0 findings**
- Supabase table inspection also emits its generic “RLS disabled” advisory because the `wcb_*` tables do not use RLS. This is not currently equivalent to browser exposure: direct browser-role table/routine grants were independently verified as zero. Do not blindly enable RLS; the current authority model is server-only grants.
- Added `scripts/db/recovery-preflight.mjs` and `npm run db:recovery:preflight` for a read-only recovery-database invariant check.
- Added behavioral DR rehearsal:
  - rollback wrapper refuses missing confirmation and malformed version IDs before the Wrangler boundary
  - explicitly approved version IDs are forwarded exactly
  - backup wrapper keeps the DB credential out of command-line arguments
  - generated archive + checksum + `pg_restore --list` verification path is exercised with fake tools
  - branch UI rehearsal `35517366141`: **PASS**
- A live production Worker rollback drill is still intentionally pending.
- A real off-site production DB backup/restore drill is still pending because it requires the private operator DB connection and a separate recovery target.
- Gate 2 interactive state remains incomplete: Firebase identity count is still 0. Product mutation remains OFF.
- Gate 3 staging current head: `9f8b5d184682567bb7881af2a1f42ddc71bd5e1e`, main-behind: 0.
  - UI `35517938841`: **PASS**
  - durable `35517938853`: **PASS**
  - Bigperson `35517938844`: **PASS**
- Note: Gate 3 v3 preserves its older `package.json` operator command set because package-script synchronization was blocked by tool safety. Before Gate 3 production activation, rebuild the activation branch from latest main or explicitly reconcile this one package-script delta so `db:recovery:preflight` is not lost.

---

# GATE 5 BROWSER HARDENING CLOSED — 2026-09-20 KST

- Production code checkpoint: `cc3584c4232d1bc382865cb8bcc775895391b2fb`.
- UI `35516646841`: PASS
- durable editor/export `35516646678`: PASS
- Bigperson `35516646722`: PASS
- production smoke `35516693367`: PASS
- browser compatibility smoke `35516707994`: PASS
- Browser matrix: Chromium / Firefox / WebKit, desktop 1440×900 and mobile 390×844.
- Automated checks now cover public-route loading, horizontal overflow, keyboard focus, basic accessible names, uncaught page errors, and a basic navigation timing budget.
- Auth checks cover Google/GitHub SVG marks, unavailable phone sign-in disabled, labelled auth dialog, and labelled close control.
- Landing host now repairs injected vendor control accessibility and clips carousel overflow at the host boundary.
- Production build-size budgets are enforced and production source maps remain absent.
- Supabase Security Advisor: 0 findings.
- Supabase Performance Advisor: 24 unused-index INFO findings only; no index was removed because production traffic is still too low for this signal to be meaningful.
- Product mutation remains OFF. No Gate 3 fixture has been applied to production.

---

# GATE 5 BROWSER / ACCESSIBILITY / BUILD HARDENING CLOSED — 2026-09-20 KST

- Production code checkpoint: `cc3584c4232d1bc382865cb8bcc775895391b2fb`.
- Production verification:
  - UI `35516646841`: **PASS**
  - durable editor/export `35516646678`: **PASS**
  - Bigperson `35516646722`: **PASS**
  - production smoke `35516693367`: **PASS**
  - browser compatibility smoke `35516707994`: **PASS**
- Browser matrix now runs only after a successful production smoke and retries deployment propagation before failing.
- Browser coverage:
  - Chromium / Firefox / WebKit
  - desktop 1440×900
  - mobile 390×844
  - landing, Marketplace, Plans, Login, Updates, Docs/Security
  - horizontal overflow, keyboard focus, accessible button/field names, uncaught page errors, basic navigation timing
  - Google/GitHub SVG marks, disabled unavailable phone sign-in, labelled auth dialog/close button
  - truthful pre-payment plan controls
- Landing host hardening:
  - icon-only injected mobile navigation receives an accessible name
  - decorative vendor slide controls are removed from the accessibility/tab order
  - landing host now clips vendor carousel overflow at the host boundary
- Production build budget is enforced:
  - total dist <= 15 MiB
  - total JS <= 2 MiB
  - main JS chunk <= 700 KiB
  - app CSS <= 180 KiB
  - all CSS <= 500 KiB
  - largest CSS <= 300 KiB
  - no production source maps
- Supabase Security Advisor recheck: **0 findings**.
- Supabase Performance Advisor currently reports 24 `unused_index` INFO findings only. No index was removed because production traffic is still too low for “unused” to be meaningful and several indexes are deliberate FK/operations coverage.
- Rollback branch for the browser-hardening production integration: `backup-main-before-browser-hardening-2026-09-20`.
- Product mutation remains OFF and no Gate 3 fixture has been applied to production.

---

# GATE 3 V3 REBASED ON CURRENT PRODUCTION — 2026-09-20 KST

- Production launch-truthfulness code checkpoint remains `cb1c168771b988a25b74d42902da29b36e04c190`.
- Gate 3 staging branch remains `phase5-gate3-materialization-staging-v3`.
- Gate 3 v3 was reconciled with the current production App/UI truthfulness changes and newest regression suite.
- Verified staging checkpoint: `d9d7b5be1f0334bb988f663e508c74cc7ddc0f81`.
- Verification:
  - UI `35514962485`: **PASS**
  - durable editor/export `35514962469`: **PASS**
  - Bigperson `35514962482`: **PASS**
- The verified staging tree includes:
  - current Google/GitHub brand marks + circular spinner
  - disabled unavailable phone sign-in
  - truthful pre-payment plan UI
  - current Gate 2 provider-link safety
  - Gate 3 materialization switches/fixture
  - Gate 4 materialize → durable edit → reopen → standalone export/build regression
- Production remains mutation-off. The Gate 3 fixture has not been applied to production.
- Interactive Gate 2 is still the only release blocker before Gate 3 activation.
- Resume from Gate 3 v3 only; v2 and older Gate 3 branches are historical.

---

# LAUNCH TRUTHFULNESS CLEANUP LIVE — 2026-09-20 KST

- Production code checkpoint: `cb1c168771b988a25b74d42902da29b36e04c190`.
- Prelaunch UI contradictions removed:
  - Phone sign-in is disabled everywhere and no longer maps to Google in the local/demo path.
  - Dashboard Profile/Account copy now reflects the production account store instead of saying the backend will be connected later.
  - Dashboard Billing explicitly states that paid billing is not active.
  - Paid Pro/Studio plan buttons are disabled and show `Billing coming soon`; the old `Most chosen` claim is removed.
  - Paid prices are labeled as launch pricing previews.
  - Updates now describes current launch closure instead of old Phase 4 finalization.
- Verification:
  - branch UI `35514636527`: **PASS**
  - main UI `35514696758`: **PASS**
  - main durable editor/export `35514696790`: **PASS**
  - main Bigperson `35514696759`: **PASS**
  - production smoke `35514742329`: **PASS**
- Live browser verification:
  - Google button first child remains `svg.auth-provider-google`
  - GitHub button first child remains `svg.auth-provider-github`
  - phone button: `disabled=true`, title `Phone sign-in is not connected yet`
  - live JS bundle observed as `/assets/index-_863RCiw.js`
  - /plans shows paid billing inactive + disabled paid CTAs
  - /updates shows current launch-closure copy
- Rollback: `backup-main-before-launch-truthfulness-2026-09-20`.
- Gate 2 interactive provider smoke remains the release blocker; this cleanup did not enable product mutations or payment.

---

# AUTH POLISH LIVE / GATE 3 V3 READY — 2026-09-20 KST

- Production login polish remains live at main code checkpoint `f6e702960bfad13d33a97f071d217b7951ce2fc7`:
  - real Google multicolor SVG mark
  - real GitHub SVG mark
  - circular translucent-gray route/session/auth spinner instead of the old top progress bar
  - main UI `35513994500`, durable `35513994502`, Bigperson `35513994499`, production smoke `35514035976`: **PASS**
- Live DOM verification observed both provider buttons using SVG brand marks and bundle `/assets/index-CVqoyDUU.js`.
- Current Gate 3 activation branch is now **`phase5-gate3-materialization-staging-v3`**.
- Gate 3 v3 is rebuilt from current main, so it includes the auth polish and all current handoff changes.
- Verified Gate 3 v3 code checkpoint: `67b0010bc17fb71cf8d71e31664585e0553166e6`.
- Gate 3 v3 CI:
  - UI `35514261090`: **PASS**
  - durable editor/export `35514261052`: **PASS**
  - Bigperson `35514261054`: **PASS**
- Gate 3 v3 is ahead of current main and behind by 0 at the verified checkpoint.
- Gate 4 materialization → durable edit → reopen → standalone export → independent build regression remains included.
- Production DB recheck still shows Google identity 1 / Firebase identity 0 / active entitlement 0 / materialization 0.
- Therefore interactive Gate 2 is still the only release blocker. Do not deploy Gate 3 v3 until GitHub + Email are linked/tested in the real browser.
- v2 and older Gate 3 branches are historical. Resume from v3.

---

# AUTH BRAND + LOADING POLISH LIVE — 2026-09-20 KST

- Production code checkpoint: `f6e702960bfad13d33a97f071d217b7951ce2fc7`.
- Login polish shipped:
  - Google provider button now renders the multicolor Google brand SVG instead of the placeholder letter `G`.
  - GitHub provider button now renders the GitHub brand mark SVG.
  - the route transition top progress bar was removed and replaced by a centered circular translucent-gray spinner.
  - session-checking and auth busy states use the same spinner family.
- Verification:
  - branch UI `35513926569`: **PASS**
  - main UI `35513994500`: **PASS**
  - main durable editor/export `35513994502`: **PASS**
  - main Bigperson `35513994499`: **PASS**
  - production smoke `35514035976`: **PASS**
- Live browser verification:
  - Google first child is `svg.auth-provider-google`
  - GitHub first child is `svg.auth-provider-github`
  - live application bundle observed as `/assets/index-CVqoyDUU.js`
- Rollback: `backup-main-before-auth-logos-spinner-2026-09-20`.
- This was UI-only launch polish. Product mutation remains outside this change and Gate 2 interactive provider smoke remains the release blocker.

---

# GATE 2 INTERACTIVE RESUME CHECKPOINT — 2026-09-20 KST

- Main rechecked at `97f9602cf7f95d63b6ae1c4771f2780a2ab4fa8a`.
- Production DB still reports:
  - active Google identities: 1
  - active Firebase identities: 0
  - active Google sessions: 1
  - active Firebase sessions: 0
  - active entitlements: 0
  - materializations: 0
- Therefore Gate 2 provider smoke has not started/completed yet.
- Live diagnostic rechecked: `https://webcanbe.com/_ops/gate2-auth-smoke`
  - HTTP 200
  - robots: `noindex, nofollow`
  - `wcb-product-read-mode=hosted`
  - no production product-mutation meta
- Safe human sequence:
  1. Google-backed session → Run private reads
  2. Verify refresh
  3. Link GitHub to the current Webcanbe account
  4. Link a Firebase Email identity to the current Webcanbe account
  5. Verify logout
  6. Test linked GitHub login and rerun private reads/refresh
  7. Verify logout
  8. Test linked Email login and rerun private reads/refresh/logout
- Do not share passwords, ID tokens, cookies, or session secrets in chat.
- Gate 3 v2 and Gate 4 launch-chain staging remain ready but must stay undeployed until this interactive Gate 2 sequence is green.

---

# SESSION STOP CHECKPOINT — 2026-09-20 KST

- Latest main documentation HEAD: `e7504303700c99abc28978820d9ae8c6948e4d8a`.
- Latest verified substantive main code checkpoint remains `5a36af97c6b55f5854edc4430cc1668eb7436dfd`; later main commits are documentation-only `[skip ci]` checkpoints.
- Gate 2 live diagnostic remains: `https://webcanbe.com/_ops/gate2-auth-smoke`.
- Production DB was rechecked at this stop point:
  - active Google identities: 1
  - active Firebase identities: 0
  - active Google sessions: 1
  - active Firebase sessions: 0
  - active entitlements: 0
  - materializations: 0
  - published/available listings: 0
- Therefore interactive GitHub/Email Gate 2 has **not** been completed. Do not infer completion from code/CI alone.
- Gate 3 current source branch: `phase5-gate3-materialization-staging-v2`.
- Gate 3 latest documentation HEAD: `1f5e7db117b7bcbcf676efb94318311b3d851d36`.
- Latest verified Gate 3/Gate 4 code checkpoint remains `75810cef69b3b43947029ccaf42f844f4e319ac6`:
  - UI `35511923446`: PASS
  - durable editor/export `35511923498`: PASS
  - Bigperson `35511923419`: PASS
- Gate 3 v2 is currently ahead of main and not behind; it preserves the safe provider-link flow.
- Gate 4 launch-chain regression is already included in that verified staging checkpoint:
  `immutable release → materialized history → DurableSource → accepted Code save → reopen → standalone export → independent build`.
- No Gate 3 fixture has been applied to production.
- No product mutation switch has been activated in production.
- Resume rule: first re-read GitHub + this block. If Firebase identity count is still 0, continue with interactive Gate 2 only. If Gate 2 has become green, then proceed to Gate 3 production activation from the v2 branch, not the old staging branch.

---

# CURRENT RELEASE BLOCKER / GATE 3 V2 READY — 2026-09-20 KST

- Current main: `5a36af97c6b55f5854edc4430cc1668eb7436dfd` with safe Gate 2 provider-linking and all main verification green.
- Remaining Gate 2 blocker is human browser interaction only:
  - Google baseline
  - link GitHub to the existing internal account
  - link Email identity to the existing internal account
  - logout
  - verify linked GitHub login returns to the same account
  - verify linked Email login returns to the same account
  - private reads / refresh / logout all PASS
- Production DB currently still shows:
  - 1 active Google identity
  - 0 Firebase identities
  - 1 active Google session
  - 0 Firebase sessions
  so GitHub/Email Gate 2 has not yet been executed.
- Use `https://webcanbe.com/_ops/gate2-auth-smoke` for the live Gate 2 run. The page is live and noindex.
- Gate 3 activation source is now **`phase5-gate3-materialization-staging-v2`**, not the older staging branch.
- Gate 3 v2 is based on current main and is **ahead 26 / behind 0** at this checkpoint.
- Gate 3 v2 code verification:
  - UI `35511923446`: PASS
  - durable editor/export `35511923498`: PASS
  - Bigperson `35511923419`: PASS
- Gate 4 source chain is already preverified on staging:
  `immutable release → materialized history → DurableSource → accepted Code save → reopen → standalone export → independent build`.
- Supabase Security Advisor: **0 findings**.
- Performance Advisor: only 24 `unused_index` INFO findings before real traffic; do not delete launch/FK/operational indexes merely because they are unused pre-launch.
- Do not merge/deploy Gate 3 v2 until the live browser Gate 2 provider smoke is green.

---

# NEXT RELEASE BLOCKER / GATE 3 PRESTAGED — 2026-09-20 KST

- Gate 2 authenticated smoke is live at `https://webcanbe.com/_ops/gate2-auth-smoke`.
- Gate 3 has been fully prepared but not deployed on `phase5-gate3-materialization-staging`.
- Verified staging code checkpoint: `47550c1ecb1d505d52f7672744f4b08fe6d4ad33`.
- Staging CI: UI `35510969693` PASS; durable `35510969613` PASS.
- The staged launch-smoke fixture is source-backed, passes production release-integrity verification, creates no public Listing, and has not been applied to production.
- Do not merge Gate 3 until real-browser Google/GitHub/Email Gate 2 smoke is green.

---

# GATE 2 AUTHENTICATED SMOKE UI LIVE — 2026-09-20 KST

- Main checkpoint: `d6311f5ea11f8ab8b39b44b504b85104df4bef4f`.
- Main verification:
  - Phase 5 UI verify `35510422402`: **PASS**
  - Phase 5 durable editor/export verify `35510422417`: **PASS**
  - Phase 5 Bigperson checkpoint verify `35510422431`: **PASS**
  - Phase 5 production smoke `35510459871`: **PASS**
- Live diagnostic URL: `https://webcanbe.com/_ops/gate2-auth-smoke`.
- Live verification: HTTP 200, `noindex, nofollow`, production read mode active.
- Diagnostic checks only the signed-in user's own first-party session and read APIs:
  - Account
  - Workspace
  - Purchases
  - Working copies
  - Catalog
  - full-page refresh persistence
  - logout invalidation
- It can start Google, GitHub/Firebase, Email signup and Email login using the existing production auth paths.
- The diagnostic does not enable product mutations, does not materialize projects, and does not render internal account IDs.
- One branch CI failure occurred only because of a quote typo in the new static regression; after correction the full UI CI passed.
- Remaining Gate 2 blocker is human provider interaction in a real browser. Gate 3 may be prepared on a staging branch but must not be merged/activated until Gate 2 passes.
- Rollback checkpoints:
  - `backup-main-before-gate2-auth-smoke-ui-2026-09-20`
  - `backup-main-before-gate2-auth-smoke-route-fix-2026-09-20`

---

# GATE 2 AUTOMATED PREFLIGHT CLOSED IN PRODUCTION — 2026-09-20 KST

- Main checkpoint: `ef175c6659d3a09f73e8e36ee486b91ffbf9e881`.
- Verification:
  - Phase 5 UI verify `35509855707`: **PASS**
  - Phase 5 Bigperson checkpoint verify `35509855712`: **PASS**
  - Phase 5 durable editor/export verify `35509855720`: **PASS**
  - Phase 5 production smoke `35509893495`: **PASS**
- Production smoke now proves anonymous/private access is fail-closed for:
  - Workspaces
  - Purchases
  - Working-copy list
  - Account
  - materialization
- Clean-account backend regressions prove purchases and working-copy reads return truthful empty arrays and remain scoped only by authoritative session user ID.
- Production aggregate at this checkpoint:
  - users: 1
  - active sessions: 1
  - active Google sessions: 1
  - active Firebase sessions: 0
  - active workspace memberships: 1
  - entitlements: 0
  - materializations: 0
  - published/available listings: 0
- Remaining Gate 2 work is only browser-authenticated E2E for Google, GitHub/Firebase and Email/password. Product mutation remains closed.
- Rollback branch: `backup-main-before-gate2-private-read-preflight-2026-09-20`.

---

# GATE 2 PRIVATE-READ PREFLIGHT — 2026-09-20 KST

- Active branch: `phase5-gate2-private-read-preflight`.
- Production DB aggregate before interactive auth smoke:
  - users: 1
  - active sessions: 1
  - active Google sessions: 1
  - active Firebase sessions: 0
  - active workspace memberships: 1
  - entitlements: 0
  - materializations: 0
  - published/available listings: 0
- Added production smoke assertions that unauthenticated Workspaces, Purchases, Working-copy list, and Account reads all fail closed with HTTP 403.
- Added a production smoke assertion that anonymous materialization is refused before mutation evaluation.
- Added backend regressions proving a clean account returns empty purchases/working copies rather than fabricated rows and that private reads derive user scope only from the authoritative session.
- Interactive Google/GitHub/Email read E2E remains the only Gate 2 part that needs a real browser-authenticated session.

---

# GATE 1 CLOSED — PRODUCTION READ MODE LIVE — 2026-09-20 KST

- Main deployment trigger checkpoint: `df98015bdd7f905ccbf7d0a23fe497bb49e8e331`.
- Main verification:
  - Phase 5 UI verify `35509468797`: **PASS**
  - Phase 5 durable editor export verify `35509468729`: **PASS**
  - Phase 5 Bigperson checkpoint verify `35509468846`: **PASS**
  - Phase 5 production smoke `35509542122`: **PASS**
- Live production HTML now exposes `wcb-product-read-mode=hosted`.
- Live production continues to expose `wcb-control-mode=hosted`.
- `wcb-product-mutation-mode` remains absent/closed.
- Public Marketplace browse/detail/preview are on the authoritative production read boundary.
- Gate 1 is complete. Next gate is authenticated Google/GitHub/Email private-read E2E; materialization mutation must remain closed until that passes.
- Rollback branch remains `backup-main-before-product-read-launch-2026-09-20`.

---

# PRODUCT READ LAUNCH BRANCH CI GREEN — 2026-09-20 KST

Production read activation code checkpoint `2aba73e72901f9208378a7a6595ddadb1141da26` is verified.

- Phase 5 UI verify `35509040875`: **PASS**
- Phase 5 durable editor export verify `35509040858`: **PASS**
- Phase 5 Bigperson checkpoint verify `35509040888`: **PASS**
- Branch is ahead of main with no behind commits at the verified checkpoint.
- Product read is configured to turn on; product mutation remains closed.
- Public Marketplace browse/detail/preview now use authoritative production read mode.
- No Admin/Bigperson or durable-editor regression was detected.
- Next release action is main integration/deployment, followed immediately by interactive production auth/private-read smoke. Do not start materialization mutation activation before that smoke passes.

---

# PHASE 5 PRODUCT READ LAUNCH SLICE — 2026-09-20 KST

- Launch closure has started from verified main `ac60ef75ce5ad0c5024febae92b99b25a3acab44`.
- Active implementation branch: `phase5-product-read-launch`.
- This slice activates production **read-only** product mode while keeping product mutations closed.
- `/browse`, project detail, and public preview now use `productReadMode()`, preventing production from silently showing demo project data after read activation.
- Existing DB-backed workspace/dashboard/projects/purchases/settings reads remain on the same read-only authority boundary.
- Seller, Checkout, materialization, seller mutation, and payment mutation are not activated by this slice.
- Production smoke now requires `wcb-product-read-mode=hosted` while still requiring `wcb-product-mutation-mode` to be absent.
- Launch execution plan: `docs/launch-plan-2026-09-20.md`.
- Branch verification is required before integration to `main`.

---

# BIGPERSON NOW INCLUDES ALL MANAGER POWERS — 2026-09-20 KST

Unified Bigperson Operations is live on main `15d9d6aadabe...`. Bigperson inherits every Reviewer/Admin permission and the standalone console is organized into Overview / Sellers & Review / Publishing / Access & Roles / Audit. Seller approval, review, assessment, release/Listing/Ready, TEST entitlements, session revoke, operator-role management and audit are all available in the same Admin console. Main UI `35507009832`, Bigperson `35507009889`, durable `35507009845` and production smoke `35507044862` all pass.

---

# UNIFIED BIGPERSON OPERATIONS CONSOLE — 2026-09-20 KST

Bigperson is explicitly locked as a superset of all Reviewer/Admin manager permissions. The standalone Admin UI is now organized as Overview / Sellers & Review / Publishing / Access & Roles / Audit, with seller approval, review, assessment, release/Listing/Ready, TEST entitlements, sessions, role management and audit in one console. Branch CI is green: UI `35506923400`, Bigperson `35506923474`, durable `35506923428`.

---

# PERMANENT ADMIN LINK

`https://webcanbe.com/_ops/keystone-7f31`

Use this as the permanent production Admin entry point.

---

# ADMIN COMPLETE / STANDALONE PANEL LIVE — 2026-09-20 KST

Admin production E2E is complete and the Admin route has been simplified to a standalone Operations panel. The normal sidebar, top navigation/search/profile, bottom account UI, and site footer are removed from `/_ops/keystone-7f31`. Three-factor/server authority is unchanged. Main `5a844f267ffc...` passes UI `35506420844`, Bigperson `35506420826`, durable `35506420823`, and production smoke `35506452936`. Next Phase 5 work is staged product read activation.

---

# ADMIN E2E COMPLETE / PANEL-ONLY UI IN PROGRESS — 2026-09-20 KST

Production Admin E2E is now closed: Bigperson=1, security=1, passkey=1, one consumed privileged operation challenge, and active step-up evidence are verified. The hidden Admin route is now being simplified to remove the normal sidebar/header/account/footer shell and show only the Operations panel; authority logic remains unchanged.

---

# CURRENT STATE — FIRST BIGPERSON ENROLLED — 2026-09-20 KST

First production Bigperson enrollment succeeded. DB verifies Bigperson=1, security=1, active passkey=1, consumed registration challenge=1, and no live leftover registration challenge. Final Admin step: re-enter the privileged factor and click `Verify all 3 factors`, complete the passkey assertion, and confirm the privileged Control view opens.

---

# CURRENT VERIFIED STATE — OPERATOR SCHEMA FIX LIVE — 2026-09-20 KST

The missing `wcb_product_operators.updated_at` production schema bug is fixed and migration `20260920103846` is applied. Main UI/Bigperson/durable CI and production smoke all pass at `4aeeef50d929...`. Retry first Bigperson enrollment only after a fresh Google login because the Bigperson freshness window is 10 minutes.

---

# CURRENT LIVE FIX — OPERATOR updated_at — 2026-09-20 KST

The latest first-Bigperson attempt reached the final DB bootstrap transaction but failed because production `wcb_product_operators` lacked the `updated_at` column already referenced by runtime code. Production migration `20260920103846 phase5_product_operator_updated_at` is now applied and the column exists. No partial Bigperson/passkey rows were committed. The current Google session is already ~10m21s old, so re-login before the next registration retry.

---

# CURRENT NEXT ACTION — RETRY FIRST PASSKEY NOW — 2026-09-20 KST

Synced Apple/iCloud passkeys are now accepted and the policy change is deployed. Main UI/Bigperson/durable verification and production smoke all pass. Current Google session age is ~5m53s, so it is still inside the 10-minute Bigperson freshness window. Enter the factor and click `First Bigperson: register passkey` again now. Bigperson/security/passkey rows remain 0 before retry.

---

# CURRENT LIVE ISSUE — APPLE SYNCED PASSKEY — 2026-09-20 KST

The first WebAuthn ceremony succeeded on macOS but the server rejected the resulting Apple/iCloud passkey because the old Bigperson policy required single-device/non-backed-up credentials. The policy is being corrected to accept synced Apple passkeys while retaining fresh Google + privileged factor + verified WebAuthn + one-time operation-bound challenge security. DB still has Bigperson 0 / security 0 / passkey 0.

---

# CURRENT NEXT ACTION — FRESH GOOGLE LOGIN THEN PASSKEY — 2026-09-20 KST

The user reports the final 100k Bigperson KDF Secret set has been updated. Production DB still shows Bigperson 0 / security 0 / passkey 0 / no consumed challenge, and the only active Google session is ~38 minutes old. Next: sign out, sign in with Google again, return immediately to the Operations route, enter the factor, and click `First Bigperson: register passkey` within 10 minutes.

---

# CURRENT NEXT ACTION — ROTATE BIGPERSON BOOTSTRAP KDF SET — 2026-09-20 KST

The Cloudflare PBKDF2 hard-cap fix is deployed and all main CI + production smoke pass. The Worker now derives the Bigperson bootstrap factor at 100,000 PBKDF2-SHA256 iterations. Before retrying first enrollment, regenerate PEPPER/SALT/DIGEST together at 100,000 iterations and replace the three existing Cloudflare Bigperson secrets. The remembered raw factor can stay the same.

---

# CURRENT BIGPERSON BOOTSTRAP CONTRACT — 2026-09-20 KST

The previous attempt to preserve 600,000 PBKDF2 iterations through `node:crypto.pbkdf2Sync` was disproved by production: Cloudflare workerd caps PBKDF2 at 100,000 for both paths. The final Worker contract is now PBKDF2-SHA256 at 100,000 iterations with the same factor+NUL+pepper / salt / 32-byte base64url format. Because no Bigperson/security/passkey row exists yet, regenerate the three Cloudflare bootstrap factor secrets together at 100,000 iterations before retrying first enrollment.

---

# CURRENT NEXT ACTION — PBKDF2 FIX LIVE — 2026-09-20 KST

The 600,000-iteration Bigperson PBKDF2 runtime failure is fixed and deployed. Main UI/Bigperson/durable CI and production smoke pass. Current Google session is ~7m23s old against a 10-minute Bigperson freshness limit, so sign out/in once more, then immediately enter the existing factor and click `First Bigperson: register passkey`. Bigperson/passkey rows remain 0 before retry.

---

# CURRENT BLOCKER FIXED IN CODE — PBKDF2 RUNTIME — 2026-09-20 KST

The live first-Bigperson attempt exposed Cloudflare WebCrypto's PBKDF2 iteration cap: 600,000 iterations were rejected. The implementation now keeps the existing 600,000-iteration bootstrap format but uses Worker-supported `node:crypto.pbkdf2Sync`, which matches the already configured digest. No factor-set regeneration is required. CI/build/Wrangler verification passes. After production deployment, retry first passkey registration with a fresh Google session.

---

# CURRENT LIVE BLOCKER — FRESH GOOGLE SESSION — 2026-09-20 KST

First Bigperson enrollment reached the server but was rejected only because the current Google-backed first-party session was ~35 minutes old while Bigperson requires a session created within 10 minutes. Next action: sign out, sign in again with Google, return immediately to `/_ops/keystone-7f31`, enter the privileged factor, and click `First Bigperson: register passkey`.

---

# NEXT BUTTON — 2026-09-20 KST

After entering the privileged factor on the current production Admin screen, click `First Bigperson: register passkey` first. Complete the macOS/WebAuthn prompt. Use `Verify all 3 factors` only after passkey enrollment succeeds.

---

# FACTOR ORIGIN — 2026-09-20 KST

The Bigperson privileged factor was the silent value entered locally at the Mac terminal prompt `Bigperson factor:` while generating the bootstrap Pepper/Salt/Digest set. It was not a Cloudflare-created value. If it is forgotten before first enrollment, regenerate the factor set instead of guessing.

---

# FACTOR CLARIFICATION — 2026-09-20 KST

`Privileged factor` is the separate Bigperson password/string the user personally entered at the earlier terminal prompt `Bigperson factor:`. It is distinct from Pepper/Salt/Digest. If forgotten before first enrollment, regenerate the bootstrap factor set; do not restart Hyperdrive/auth work.

---

# CURRENT SCREEN / NEXT ACTION — 2026-09-20 KST

The user is now on the live production Bigperson Operations screen at `/_ops/keystone-7f31`.

Immediate next step:
- enter the configured privileged factor;
- click `First Bigperson: register passkey`;
- complete WebAuthn registration;
- then verify DB operator/security/passkey rows;
- only after enrollment, run `Verify all 3 factors`.

Do not restart Hyperdrive, Google OAuth, Firebase, or DB-session work. Those are already live and verified.

---

# CURRENT AUTHORITATIVE HANDOFF — 2026-09-20 KST

Read **`docs/phase5-admin-live-handoff-2026-09-20.md` first**.

That file supersedes older checkpoint statements in this document where they say Hyperdrive is unbound, DB sessions are not live, or production Control is not deployed.

Current canonical state at the time of that handoff:
- last non-documentation code baseline: `12ca43d3c0d58848e81bf1d657da6d48ae4f75e1`
- Hyperdrive live
- DB/schema ready
- production Control live
- DB-backed Google session live
- active Bigperson: 0
- next exact action: first Bigperson passkey enrollment, then one three-factor Control read.

---

# PHASE 5 MAIN PRODUCTION + DB INDEX HARDENING CHECKPOINT — 2026-09-20 KST

- Verified Admin + durable integration was fast-forwarded to `main`.
- Main verification after integration:
  - Phase 5 UI verify `35495682185`: PASS
  - Bigperson/Admin verify `35495682150`: PASS
  - durable editor/export verify `35495682167`: PASS
  - automatic live production smoke `35495723690`: **21/21 PASS**
- Live production smoke confirmed on first attempt:
  - root 200
  - HSTS/nosniff/frame-deny/COOP/CSP
  - request ID
  - real 404 + noindex for unknown route
  - dashboard route 200 + server-side noindex
  - robots/sitemap correctness
  - Worker-owned readiness/catalog fail closed with 503 while database binding is unconfigured
  - no credentials exposed by readiness
- Full-main regression initially exposed three integration mismatches; all were corrected before the final green main:
  - whole-suite CI now prepares the locked runtime profile before the durable export test
  - PostgreSQL session mock now covers created/auth provenance fields
  - private-route test now targets the actual hidden Operations route instead of removed `/control`
- Supabase performance advisor then identified 21 unindexed foreign keys. A production-safe `phase5_fk_covering_indexes` migration was added, rollback-dry-run verified, CI verified, and applied as migration `20260920070349`.
- Production now reports `uncovered_fk_count = 0`.
- Performance advisor now reports only `unused_index` INFO findings; this is expected before real traffic and is not a reason to delete launch-protective indexes.
- Canonical `deployment/hosted/postgres.sql` contains the same 21 covering indexes for fresh installs.
- Next live blocker remains Hyperdrive / DB-backed first-party sessions. Until then readiness/catalog correctly remain fail-closed and product read/mutation activation stays off.

---

# PHASE 5 ADMIN + DURABLE EDITOR INTEGRATION CHECKPOINT — 2026-09-20 KST

- The previously separate `phase5-editor-durable-export` proof has been integrated onto the completed Bigperson/Admin branch without replacing newer Admin code or documents.
- Integrated durable proof:
  - accepted Code save persists as one durable source revision + history transaction
  - reopen reads the accepted revision and exact accepted bytes
  - export contains accepted source, excludes Webcanbe runtime state, and independently builds in a fresh checkout
  - Visual / Code / Split remain wired to the same request/revision acceptance path
  - export remains behind independent-build validation and fresh authority
- The old production-read regression that assumed Control used `hostedProductMode()` was superseded by the stronger current design: Control uses a separate `controlMode()` / production Control gate and remains unreachable through read-only product activation.
- Integrated verification on the combined branch:
  - Bigperson/Admin regression + Worker syntax + Vite build + Wrangler dry-run: GitHub Actions `35495424755` **PASS**
  - durable save/history/export regression + Vite build + Wrangler dry-run: GitHub Actions `35495424762` **PASS**
- Durable proof is now required on `main` by its dedicated workflow, and Bigperson regression is also configured to run on `main`.
- Dashboard/landing visuals were not redesigned.
- Current branch is a strict fast-forward descendant of `main`; no merge conflict is required.
- Next repository action: back up current `main`, then fast-forward `main` to this verified integrated checkpoint.

---

# PHASE 5 BIGPERSON PRODUCTION SCHEMA CHECKPOINT — 2026-09-20 KST

- Production Supabase project `webcanbe-production` now has the privileged Control schema actually applied.
- Recorded migrations:
  - `20260920064953 phase5_control_roles`
  - `20260920064957 phase5_bigperson_three_factor`
- `wcb_product_operators.role` is live with `reviewer/admin/bigperson` constraint and default `admin`.
- Database trigger `wcb_protect_last_bigperson_trigger` is live on operator UPDATE/DELETE.
- Production now contains `wcb_bigperson_security`, `wcb_bigperson_passkeys`, and `wcb_bigperson_challenges`.
- Bigperson user foreign keys bind to the real internal account authority `wcb_user_profiles(user_id)`; challenge sessions bind to `wcb_sessions(session_id)`.
- All three Bigperson tables are empty before first enrollment.
- Direct production privilege verification:
  - `anon`: 0 grants on `wcb_*`
  - `authenticated`: 0 grants on `wcb_*`
  - `webcanbe_runtime`: SELECT/INSERT/UPDATE/DELETE on all 40 current `wcb_*` tables = 160 grants
- Supabase's generic table listing still flags RLS-disabled public tables, but the deliberate server-only model is verified by zero browser-role grants and the Supabase Security Advisor currently reports 0 lints. Do not blindly enable RLS without redesigning server access.
- Before applying, both Control/3-factor migrations and the corrected Supabase hardening script were executed against production inside rollback transactions and passed.
- A critical pre-production migration defect was caught and fixed: the original 3-factor migration referenced nonexistent `wcb_users(id)`; it now references `wcb_user_profiles(user_id)`. The canonical fresh-install schema was corrected too.
- The malformed final `DO $ ... $` block in the retained Supabase hardening script was also corrected to `DO $$ ... $$` and production dry-run verified.
- Canonical source-derived Ready qualification is implemented and CI-proven; browser/operator input cannot supply the Ready score/status.
- Admin/Bigperson code + production schema are now complete up to the live first-Bigperson ceremony.
- Remaining live Admin gate: Hyperdrive/DB-backed first-party session + Cloudflare Bigperson deployment configuration, then first device-bound passkey enrollment and production Control E2E. No privileged secret values belong in Git/chat.

---

# PHASE 5 BIGPERSON PUBLICATION + TEST ENTITLEMENT CHECKPOINT — 2026-09-20 KST

- Privileged Operations now extends beyond review/assessment into the retained Phase 3 publication lineage.
- Admin+ can promote a **passed immutable assessment result** into an immutable `wcb_project_releases` row plus `wcb_seller_release_promotions`.
- Promotion derives submission/seller/review/lease provenance server-side, requires exact catalog ownership/source/workspace matching, re-verifies the frozen submission snapshot with the same release-integrity boundary used by materialization, and refuses failed/errored or substituted results.
- Admin+ can publish exactly one promoted release as exactly one published Listing plus immutable `wcb_listing_publications`; seller/catalog/release provenance is rechecked server-side and duplicate/conflicting publication is refused.
- Admin+ can grant and terminate **provider=test only** entitlements from Control. Payment-provider entitlements remain outside this mutation surface.
- Release promotion, Listing publication and TEST entitlement grant/transition each require a fresh Google + privileged factor + operation-bound device passkey ceremony and append immutable Control audit evidence.
- Control read now includes bounded catalog-project, promotion and publication lineage so an operator does not need source bodies or worker credentials.
- The Control UI now exposes release-promotion, Listing-publication and TEST-entitlement controls; entered privileged factor is still cleared before each passkey ceremony.
- Backup before this slice: `backup-phase5-before-publication-control-2026-09-20` at `2006c905b4f974e895c470a977bdb6cae294a29b`.
- **Ready qualification is intentionally not faked.** The retained Phase 3 implementation derives Ready from actual immutable release source through the React compatibility analyzer. That exact trusted analysis still needs a production-server/Worker-compatible execution boundary before Control can mint immutable `wcb_ready_qualifications`.
- Next Admin slice: exact Ready analyzer/qualification → production Bigperson provisioning/smoke → final privileged E2E.

---

# PHASE 5 BIGPERSON PRIVILEGED MUTATION CHECKPOINT — 2026-09-20 KST

- Control is no longer read-only. The production Worker now exposes operation-bound privileged mutations for:
  - platform operator role/active transitions
  - seller application approval/rejection
  - first-party session revocation
  - immutable seller review decisions
  - assessment admission
- Every mutation uses the same mandatory three-factor ceremony as Control reads: enrolled Google identity + separate privileged factor + device-bound WebAuthn passkey.
- The WebAuthn challenge is bound to the exact mutation method/path/body; the browser cannot reuse proof for a different target or action.
- Successful WebAuthn verification mints fresh session-bound `control_high_risk` evidence consumed by the mutation transaction.
- Server role thresholds are explicit:
  - reviewer+: review decision and assessment admission
  - admin+: seller application transition and session revocation
  - bigperson only: privileged platform-role transition
- UI role checks are not trusted; Worker/PostgreSQL recheck the current role before mutation.
- Operator transitions remain protected by the PostgreSQL final-Bigperson trigger.
- Mutations are idempotency-keyed and append privileged audit evidence.
- Seller rejection remains terminal.
- Review decisions remain immutable and provenance-bound to the exact submission snapshot.
- Assessment admission requires the approved immutable review provenance.
- The Control UI clears the entered factor before every passkey ceremony.
- Session tokens/hashes and provider credentials are not exposed by Control reads.

---

# PHASE 5 BIGPERSON REVIEW / ASSESSMENT CHECKPOINT — 2026-09-20 KST

- Operations now performs immutable seller review decisions from the privileged surface.
- Review approve/reject requires a new exact-operation three-factor proof.
- The Worker verifies the submission is still pending review and that the submitted snapshot hash matches the immutable submission before inserting a decision.
- Existing review decisions cannot be rewritten to a different result.
- Approved review decisions can be admitted to assessment from Operations.
- Assessment admission requires another new three-factor proof and rechecks seller ID, submission snapshot and review decision ID against stored immutable provenance.
- Duplicate/conflicting assessment admission is refused; the first valid request remains authoritative.
- Both review and assessment actions append bounded privileged Control audit transitions.
- No source bodies or worker credentials are exposed to the Control UI.
- Verification run `35486441911`: privileged authority/mutation regressions PASS, Worker syntax PASS, production build PASS, Wrangler dry-run PASS.\n- Next Control slice: release promotion, Listing publication, Ready qualification, entitlement operations, then final provisioning/E2E.

---

# PHASE 5 BIGPERSON SESSION SECURITY CHECKPOINT — 2026-09-20 KST

- Operations now reads bounded active-session metadata: session ID, user ID, creation/expiry, active state and authentication provider; token/cookie hashes are never returned.
- Bigperson can revoke an individual first-party session from Operations.
- Session revocation requires a new mandatory three-factor ceremony and is bound to the exact target session ID.
- Revocation writes append-only `session.revoke` Control audit evidence.
- Operations audit table now shows the bounded before/after transition object in addition to actor/action/target/time.
- The single-use privileged factor field is shared by mutations but cleared before each passkey ceremony.
- This completes the initial privileged session/security control and audit drill-down slice.
- Remaining Control work: review/assessment/release/listing/Ready mutation surfaces and final production E2E/provisioning.

---

# PHASE 5 BIGPERSON MUTATION UI CHECKPOINT — 2026-09-20 KST

- Privileged Control now has real mutation paths for:
  - reviewer/admin/bigperson role + active-state transitions
  - seller application approval/rejection
- Every mutation requires a new three-factor ceremony; a prior Control read does not authorize a mutation.
- The passkey challenge is bound to the exact HTTP method, privileged path and canonical operation body.
- Successful three-factor verification mints a short-lived `control_high_risk` evidence row bound to the exact Bigperson + first-party session; the mutation consumes that evidence through the existing audit boundary.
- Operator changes write append-only `wcb_control_audit` evidence and increment operator epoch.
- PostgreSQL final-Bigperson protection remains the final guard against disabling/demoting/removing the last active Bigperson.
- Seller decisions write append-only audit evidence; rejected intake cannot be silently reopened.
- The browser clears the privileged factor before invoking the passkey prompt.
- The Operations UI exposes a single-use factor field, operator role/state form, and seller approve/reject controls.
- No client role flag or hidden-route knowledge grants mutation authority.
- Next checkpoint: privileged session/security controls + audit drill-down, then remaining review/publication mutation surfaces.

---

Bigperson ceremony rate limit: 5 per minute per user through a dedicated Cloudflare binding.\n\n# PHASE 5 BIGPERSON MANDATORY THREE-FACTOR CHECKPOINT — 2026-09-20 KST

- Bigperson Control now requires all three factors for every privileged Control read/operation:
  1. current first-party session must have been created by the enrolled Google issuer+subject
  2. separate privileged factor must verify server-side
  3. registered WebAuthn/passkey assertion with user verification must verify
- The allowlisted Google email is deployment configuration only; after bootstrap the authority is the enrolled Google issuer+subject, not an email string.
- Bigperson ceremonies reject non-Google first-party sessions even if the same Webcanbe user has another linked identity.
- Google-authenticated first-party session freshness is capped at 10 minutes for Bigperson ceremonies.
- The privileged factor is never committed to Git, stored in Markdown, embedded in frontend code, or persisted as plaintext.
- Stored factor verification uses PBKDF2-SHA256 (600,000 iterations) plus per-user salt and a server-only pepper. During the one-time first bootstrap, a deployment salt is combined with the entered factor and pepper; only the derived digest is persisted. An optional pre-provisioned digest can additionally pin the bootstrap factor.
- WebAuthn registration/authentication uses pinned SimpleWebAuthn packages, requires user verification, restricts generated credential algorithms to ES256/RS256, and refuses multi-device/cloud-synced credentials for Bigperson; the enrolled credential must report as device-bound and not backed up.
- First Bigperson enrollment requires allowlisted Google session + bootstrap factor + verified passkey registration before the role is provisioned.
- Once an active Bigperson exists, bootstrap registration closes.
- Every privileged operation gets a fresh 90-second WebAuthn challenge bound to:
  - user
  - exact first-party session
  - HTTP method
  - privileged path
  - canonical request-body hash
- Challenges are one-time and consumed transactionally; replay, another session, or a changed operation body is refused.
- Passkey counters are persisted after successful authentication.
- The Control UI clears the entered privileged factor before the passkey ceremony and does not retain it between operations.
- Control data is not auto-loaded: each read requires a new three-factor ceremony.
- Dedicated Bigperson ceremony rate limit: 5 attempts per minute per user through its own Cloudflare binding.\n- Existing protections remain: CSRF/same-origin, rate limiting, server-side Bigperson role/epoch, last-Bigperson DB protection, no client role trust, private/noindex Control route.
- Deployment migration: `deployment/hosted/postgres-bigperson-3factor.sql`.
- Secrets/config still need to be provisioned in Cloudflare before production enrollment; no user credential values are stored in the repository.\n- Verification run `35485848079`: three-factor/privileged authority regressions PASS, Worker syntax PASS, production build PASS, Wrangler dry-run PASS.

---

# PHASE 5 BIGPERSON CONTROL FOUNDATION CHECKPOINT — 2026-09-20 KST

- Restored the previously agreed platform-role hierarchy: `reviewer → admin → bigperson`.
- Platform roles are separate from workspace `owner/editor/viewer` membership.
- Removed privileged Control from ordinary app/sidebar navigation.
- Removed the obvious `/control` route.
- Privileged UI currently lives at the non-public route `/_ops/keystone-7f31`.
  - This route name is only obscurity/convenience, never an authorization boundary.
  - It is noindex/robots-disallowed and absent from normal navigation.
- Production Control has a separate activation gate (`wcb-control-mode` + Worker `WEBCANBE_CONTROL_MODE=enabled`) rather than piggybacking on ordinary product read mode.
- Production Worker Control read is server-side and bounded; it rechecks the current operator role/epoch after reading.
- Current Control read surface covers operators, users, sessions, workspaces, entitlements, seller applications, submissions, reviews, assessments/results, releases, listings, Ready qualifications, deploy intents, and immutable privileged audit.
- Canonical PostgreSQL operator authority now carries `role IN ('reviewer','admin','bigperson')`.
- Existing operator rows migrate to `admin` by default; the explicit migration is `deployment/hosted/postgres-control-roles.sql`.
- Role authority:
  - reviewer: review/quarantine/assessment workflow reads and decisions
  - admin: seller application decisions, release/listing/Ready publication authority, TEST entitlement authority
  - bigperson: platform-role grant/revoke/demotion authority
- High-risk mutations continue to require fresh server-minted `control_high_risk` evidence bound to the exact operator session, with a maximum five-minute freshness window.
- Only a bigperson may transition privileged platform roles.
- Database trigger `wcb_protect_last_bigperson` prevents removal, deactivation, or demotion of the final active bigperson.
- Browser-supplied role flags remain non-authoritative.
- This checkpoint establishes authority + hidden Control read foundation. Mutation UI/passkey ceremony/session-security controls are the next checkpoint.
- Dashboard and landing visual systems remain unchanged.

---

# PHASE 5 EDITOR RELOAD / RECOVERY CONSISTENCY CHECKPOINT — 2026-09-19 KST

- Initial Code workspace load now accepts source files + source history only when both report the same accepted revision.
- The shared `readAcceptedSnapshot()` boundary reads `files` and `history` together and refuses a mixed-revision snapshot.
- Added `Refresh accepted` for multi-tab / multi-session source changes.
- Refresh behavior:
  - re-reads authoritative accepted files + history
  - requires one coherent revision before moving local HEAD
  - re-reads the active accepted file against that same revision
  - keeps every dirty local draft byte-for-byte intact
  - refreshes a clean active file to current accepted bytes/hash/baseRevision
  - clears stale validation, pending-save identity, and project-search results derived from the previous HEAD
  - re-evaluates stale-draft status against the new HEAD
- Refresh never treats recovery drafts as accepted source and never discards them silently.
- Backed-up drafts are still recovered through the existing draft boundary after reconnect; accepted source/history remain separate authority.
- Added `src/phase5-editor-refresh-recovery.test.ts`.
- Verification run `35450499806`: secret scan PASS, editor refresh/recovery + save-policy/search/navigation regressions PASS, production build PASS, Wrangler dry-run PASS.
- P5.6 reload/recovery code path is complete; canonical production activation remains Hyperdrive/session-smoke gated.
- Dashboard and landing unchanged.

---

# PHASE 5 EXPLICIT SAVE + STALE DRAFT POLICY CHECKPOINT — 2026-09-19 KST

- The Code surface now makes the save authority explicit instead of treating draft backup like source acceptance.
- A persistent save-policy banner distinguishes:
  - accepted source is current
  - unsaved drafts
  - stale/conflicting drafts
- Drafts are still automatically backed up for recovery, but the UI now states that recovery backup does **not** change accepted source, preview, history, project search, or export.
- `Save source` / `Cmd/Ctrl+S` accepts the current file only after validation.
- `Save all drafts` / `Shift+Cmd/Ctrl+S` accepts current drafts together through the existing validated source transaction.
- Stale drafts are detected against the current accepted HEAD before a code-save request is sent.
- Save buttons are disabled for stale drafts rather than relying only on a later server rejection.
- The existing server `expectedRevision` / durable CAS boundary remains the final authority; client preflight is only an earlier truthful guard.
- The editor shows how many drafts are pending and a short accepted HEAD revision.
- Rebase remains allowed only when the accepted bytes for that file are unchanged; otherwise manual reconciliation is required.
- Export tooltip/help now states that exports contain the last accepted source and exclude unsaved Code drafts.
- Added `src/phase5-editor-save-policy.test.ts`.
- Verification run `35450086111`: secret scan PASS, save-policy/search/navigation regressions PASS, production build PASS, Wrangler dry-run PASS.
- Dashboard and landing unchanged.

---

# PHASE 5 BOUNDED PROJECT SOURCE SEARCH CHECKPOINT — 2026-09-19 KST

- Added project-wide accepted-source search as a real read-only editor capability.
- Standard editor shortcuts are now:
  - `Cmd/Ctrl+F` — current-file Find / Replace against the local draft
  - `Shift+Cmd/Ctrl+F` — project-wide search against accepted source
- Project search runs server-side through the existing authorized project/session boundary; the browser does not download every source file to grep locally.
- `search` is included in read operations and viewer authority, but not write operations.
- Search is deliberately bounded:
  - query: 1–160 single-line characters
  - results: max 100
  - per file: max 20
  - individual scanned file: max 512 KiB
  - total scanned source per request: max 8 MiB
  - result preview: bounded to a short line fragment
- Responses include scanned/total file counts and an explicit `truncated` flag when the bounded scan cannot prove completeness.
- Search is literal rather than regex-driven; case-insensitive matching retains offsets against the original accepted source.
- Hosted reads recheck current PostgreSQL source state through the existing `withHostedSource` CAS/revalidation boundary.
- Search results jump to exact CodeMirror ranges when the target file has no unsaved draft.
- If a result file has an unsaved draft, Webcanbe refuses to present the accepted-source offset as an exact draft location and asks the user to save/discard before retrying.
- Added actual HTTP authority coverage:
  - cross-tenant project search denied
  - viewer search allowed
  - invalid query/limit rejected
  - source revision/history unchanged by search
- Added `src/phase5-project-search.test.ts` and extended Phase 2G authority/cross-tenant coverage.
- Verification run `35449171295`: dedicated runtime profile prepared, secret scan PASS, project-search + authority regressions PASS, production build PASS, Wrangler dry-run PASS.
- Dashboard and landing unchanged.

---

# PHASE 5 WORKER MATERIALIZATION CHECKPOINT — 2026-09-19 KST

- Added Cloudflare Worker working-copy materialization in `worker/materialization.js`.
- The mutation requires all of:
  - live first-party DB session
  - CSRF
  - private-user rate limit
  - active owner/editor workspace membership
  - active entitlement owned by the current user
  - published immutable release
  - valid idempotency key
- Before source creation, the Worker re-verifies release provenance:
  - safe/unique bounded file paths
  - source tree content hash
  - history head revision/content hash
  - immutable release snapshot hash
- Creation is one PostgreSQL transaction:
  - reserve/replay materialization identity
  - create `wcb_projects`
  - create owner `wcb_project_members`
  - mark `wcb_entitlement_materializations` ready
  - recheck live session/workspace authority before commit
- Exact retry is idempotent and does not create a second project.
- Workspace project capacity remains 20.
- Production remains fail-closed:
  - Worker requires `WEBCANBE_PRODUCT_MUTATIONS=enabled`
  - frontend additionally requires inactive `wcb-product-mutation-mode=hosted` marker
  - neither is active on canonical production
- Read mode and mutation mode are now separate activation seams.
- Verification run `35448977411`: secret scan PASS, materialization/product regressions PASS, Worker syntax PASS, Vite build PASS, Wrangler dry-run PASS.
- Dashboard/landing unchanged.

---

# PHASE 5 EDITOR NAVIGATION + EXACT CODE JUMP CHECKPOINT — 2026-09-19 KST

- Added source-file Quick Open:
  - `Cmd/Ctrl+P`
  - path filtering
  - recent-file ordering
  - Enter opens the first match
- Added a Recent files section to the code workspace.
- Added current-file Find / Replace:
  - `Shift+Cmd/Ctrl+F`
  - next/previous match navigation
  - case-sensitive option
  - replace current match
  - replace all current-file matches
- Replace operations modify only the draft; accepted source is unchanged until the normal Save source transaction passes validation.
- Visual selection can now open the exact `SourceTarget.sourceRange` in CodeMirror rather than only opening the containing file.
- Component definitions and invocation/caller origins can also jump to their exact source ranges.
- CodeMirror selects and scrolls the requested range into view.
- Project-wide search was intentionally not faked by downloading every project file into the browser; it remains a separate future server-search boundary.
- Added regression coverage in `src/phase5-editor-navigation.test.ts`.
- Verification run `35447572418`: secret scan PASS, editor/source regressions PASS, production build PASS, Wrangler dry-run PASS.
- Dashboard and landing unchanged.

---

# PHASE 5 EDITOR KEYBOARD SHORTCUTS CHECKPOINT — 2026-09-19 KST

- Added keyboard shortcuts to the real Compatible source editor without creating a second history model.
- Project-level source history:
  - `Cmd/Ctrl+Z` — undo the last accepted source transaction
  - `Shift+Cmd/Ctrl+Z` — redo the accepted source transaction
  - `Ctrl+Y` — Windows-style redo alias
- Code editor:
  - `Cmd/Ctrl+S` — save the current dirty source file
  - `Shift+Cmd/Ctrl+S` — save all dirty drafts together in one validated source transaction
- Workspace navigation:
  - `Shift+V` Visual
  - `Shift+C` Code
  - `Shift+S` Split
  - `Shift+H` Changes/history
- Preview controls:
  - `V` select elements
  - `I` interact with preview
  - `Shift+M/T/D` mobile/tablet/desktop viewport
  - `Esc` clear selection and return to Select mode
- `Shift+Cmd/Ctrl+E` exports the project.
- `?` opens a responsive shortcut guide inside the editor.
- Important authority boundary: when an input/textarea/select/contenteditable/CodeMirror surface has focus, workspace transaction shortcuts do not intercept typing or CodeMirror's local undo/redo.
- Added regression coverage in `src/phase5-editor-shortcuts.test.ts`.
- Verification run `35446327861`: secret scan PASS, editor/source regressions PASS, production build PASS, Wrangler dry-run PASS.
- Dashboard/landing UI unchanged.

---

# PHASE 5 EXPLICIT IDENTITY LINKING CHECKPOINT — 2026-09-19 KST

- Main implementation merge: `e0e7f876272d68175a3639811f96b7b5a98ca066`.
- Added server-only explicit identity link boundary in `worker/identity-link.js`.
- Linking requires:
  - an already authenticated first-party Webcanbe DB session
  - revalidation that the session is active, unexpired, and not disabled
  - CSRF validation at the existing private Worker boundary
  - a freshly verified Firebase ID token
  - exact issuer + subject identity mapping
- Same-account existing mappings are idempotent.
- An inactive mapping can be reactivated only when it already belongs to the same internal user.
- An identity mapped to another internal user returns a conflict and is not merged.
- Email address is never accepted as linking authority.
- Worker route prepared: `/__webcanbe/api/account/identities/link/firebase`.
- Client method prepared: `hostedProductClient.linkFirebaseIdentity(idToken)`.
- No account-link UI is activated yet; wait for Hyperdrive production smoke before exposing it.
- Verification run `35433139579`: secret scan PASS, focused tests PASS, Worker syntax PASS, Vite build PASS, Wrangler dry-run PASS.
- Dashboard UI unchanged.

---

# PHASE 5 LEGAL DATA-FLOW CONSISTENCY CHECKPOINT — 2026-09-19 KST

- Privacy Policy is aligned with the currently implemented production architecture:
  - Google OAuth only requests OpenID/email/profile and does not request Gmail/Drive/Calendar access
  - GitHub and Email/Password authentication are handled through Firebase Authentication
  - Firebase ID tokens are verified by the Webcanbe Worker and exchanged for first-party sessions
  - first-party sessions use Secure HttpOnly cookies
  - Cloudflare is disclosed as delivery/Worker infrastructure
  - Supabase-hosted PostgreSQL is disclosed as server-side product/account storage
  - provider email alone is explicitly not an identity-linking authority
  - browser-facing Supabase roles are explicitly not given direct Webcanbe table access
  - deletion/retention and provider revocation behavior are described conservatively
- Terms do not claim that payment, deployment, or other unfinished integrations are already available; pre-release availability is explicitly qualified.
- `src/phase5-privacy-current.test.ts` locks the important provider/session/infrastructure disclosures and canonical security contact.
- Phase 5 launch-hardening item “Legal pages match actual data handling” is now complete.
- No dashboard UI was changed.

---

# PHASE 5 LIVE WORKER ROUTING + ACCOUNT AUTH SUMMARY CHECKPOINT — 2026-09-19 KST

- Current main after implementation merge: `8464f7e78f1bbfadef41bfc70739aeb7124f7a6e`.
- Automatic production smoke run `35424848026` completed successfully on the Worker-first routing build.
- Live observations also confirmed:
  - unknown HTML path returns HTTP 404
  - production `/dashboard-preview` is blocked as a 404
  - `/login` is noindex/nofollow
  - Worker-only readiness rejects unsupported GET instead of falling through to SPA
- The previously pending “observe Worker-first fix live” launch-hardening item is now complete.
- Account profile API now returns server-derived:
  - connected provider families from active `wcb_identity_accounts`
  - count of active, unexpired first-party `wcb_sessions`
- Provider information is never inferred by email. Identity authority remains issuer+subject.
- Existing Settings > Account layout displays the provider/session summary only when real product-read mode is active; no dashboard redesign occurred.
- Verification run `35432736254`: secret scan PASS, focused Phase 4/5 tests PASS, Worker syntax PASS, Vite build PASS, Wrangler dry-run PASS.
- Hyperdrive remains the infrastructure blocker before these DB-backed account reads can be activated on canonical production.

---

# PHASE 5 PRODUCTION WORKER-FIRST / PUBLIC SMOKE CHECKPOINT — 2026-09-19 KST

- Added `scripts/production-smoke-public.mjs` and `npm run smoke:production:public`.
- Live production smoke run `35424398121` exposed a real deployment/configuration gap:
  - Worker-owned readiness/catalog routes behaved correctly and reported the database as intentionally unconfigured.
  - ordinary HTML/static navigation was still being served asset-first, so root/dashboard/unknown routes did **not** receive Worker security headers, request IDs, server-side noindex, or real HTTP 404 status.
- Root cause: `assets.run_worker_first` only listed API/auth paths, while the static/SPA security and 404 middleware lives in `worker/index.js`.
- Fix prepared on this branch: `wrangler.jsonc -> assets.run_worker_first: true`, so all application/static requests reach the Worker before `env.ASSETS.fetch()`.
- Added regression coverage requiring Worker-first routing.
- Added a persistent post-CI workflow `.github/workflows/phase5-production-smoke.yml` that automatically retries public production smoke after successful `main` Phase 5 CI, while accepting either pre-Hyperdrive or ready database state.
- Branch verification run `35424537541`: secret scan PASS, focused tests PASS, syntax PASS, Vite build PASS, Wrangler bundle dry-run PASS.
- Live verification of the Worker-first fix remains pending until this branch is merged and Cloudflare has deployed the new `main`.
- This change does not redesign the dashboard or landing.

---

# PHASE 5 READ-ONLY TRUTHFULNESS + SECRET-SCAN RELIABILITY CHECKPOINT — 2026-09-19 KST

- Working branch verification run: GitHub Actions `35424179755` — **PASS**.
- Production read-only mode no longer exposes the working-copy materialization mutation.
- Existing working copies may still be opened; creating a new copy remains disabled until the full hosted mutation mode is deliberately activated.
- Empty production catalog/purchase state no longer falls back to demo `projects` rows inside the Dashboard.
- Missing release metadata now renders a neutral source-backed placeholder rather than cloning the first demo project.
- Dashboard now shows explicit loading and failure states before trusting hosted product data.
- Added regression coverage to keep these boundaries closed.
- Fixed a committed-secret scanner false positive: prose documentation may describe rejected `VITE_SECRET`-style names without failing CI, while executable/configuration sources still receive the unsafe-`VITE_*` name heuristic and all tracked text still receives real token/PEM/PostgreSQL-password scans.
- Secret scan, focused Phase 4/5 tests, Worker syntax, Vite production build, and Wrangler bundle dry-run all passed.
- Hyperdrive remains intentionally unbound; the production read-mode activation marker remains absent.
- Dashboard visual structure remains frozen; this pass changed product-state truthfulness/guardrails, not the approved visual system.

---

# PHASE 5 COMMITTED-SECRET CI CHECKPOINT — 2026-09-19 KST

- Main merge: `3a175a3c60e59089750621d5c68bf1d5c8e25a5c`.
- Added `scripts/security/scan-secrets.mjs`.
- CI now runs `npm run security:secrets` before the focused Phase 5 test/build gates.
- The scanner checks **all tracked files**, not only the latest diff.
- It blocks:
  - committed `.env` / `.dev.vars` / backup/credential file types
  - PEM private keys
  - common GitHub/Stripe/OpenAI/Slack secret-token formats
  - PostgreSQL URLs containing non-placeholder embedded passwords
  - unsafe `VITE_*` server-secret variable names
- Historical Phase 2 compatibility tests/evidence intentionally contain fake names such as `VITE_SECRET` and `VITE_ACCESS_TOKEN`; only the VITE-name heuristic is skipped for those narrowly scoped fixture paths.
- Actual token/PEM/PostgreSQL-password scans still run on those historical fixture files.
- Added gitignore rules for common local private-key/backup artifacts.
- Final branch verification: secret scan PASS, focused Phase 4/5 tests PASS, Worker/script syntax PASS, Vite build PASS, Wrangler bundle dry-run PASS.

---

# PHASE 5 CLOUDFLARE ROLLBACK OPERATIONS CHECKPOINT — 2026-09-19 KST

- Main merge: `f7c2c6c42cdcc121c9f638957df1ceabac5072d2`.
- Added `scripts/cloudflare-rollback.mjs`.
- Production rollback refuses to run unless:
  - the operator supplies an explicit UUID-shaped Worker Version ID
  - `WEBCANBE_ROLLBACK_CONFIRM=ROLLBACK_PRODUCTION` is present
- The wrapper never automatically chooses “the previous version”.
- Added package commands:
  - `npm run deploy:versions`
  - `npm run deploy:deployments`
  - `npm run deploy:rollback -- <VERSION_ID>`
- Added `docs/operations/cloudflare-rollback.md`.
- Runbook explicitly separates Worker rollback from PostgreSQL/data recovery. Cloudflare Worker rollback does not rewind Supabase rows, schema migrations, payment state, Firebase users, or external side effects.
- Regression coverage + syntax checks + full focused Phase 4/5 verification + Vite build + Wrangler dry-run all PASS.
- A controlled live production rollback drill is intentionally still pending; do not mark that final drill complete until it is exercised safely.

---

# PHASE 5 DATABASE BACKUP / RECOVERY OPERATIONS CHECKPOINT — 2026-09-19 KST

- Main merge: `deb36aef80f5881e906e3f9d93459e2db1775820`.
- Current Supabase organization/project remains on the Free plan, which does not include managed automatic database backups.
- Added `scripts/db/backup.mjs`:
  - requires `WEBCANBE_DATABASE_URL`
  - does not pass the database URL/password as a `pg_dump` command-line argument
  - maps credentials to PostgreSQL child-process environment variables
  - dumps data only for `public.wcb_*`
  - writes a SHA-256 checksum alongside the archive
- Added `scripts/db/verify-backup.mjs`:
  - verifies non-empty archive
  - checks SHA-256 when present
  - runs `pg_restore --list`
  - requires a reasonable count of Webcanbe table-data entries
- Added package scripts:
  - `npm run db:backup`
  - `npm run db:backup:verify -- <archive>`
- Added `docs/operations/database-backup-restore.md`.
- `backups/` is gitignored; production dumps must never be committed.
- Recovery procedure deliberately restores first into a separate recovery DB/project before Hyperdrive cutover; no destructive in-place production restore script was created.
- Verification: focused Phase 4/5 tests PASS, script syntax PASS, Worker syntax PASS, Vite build PASS, Wrangler bundle dry-run PASS.

---

# PHASE 5 USER-WIDE SESSION REVOCATION CHECKPOINT — 2026-09-19 KST

- Main merge: `d19b0538f6351776f5edc01ae11f81f89f8bf849`.
- Added `revokeAllDatabaseSessions()` to the PostgreSQL session authority layer.
- New private route:
  `POST /__webcanbe/api/account/sessions/revoke-all`
- Requires the existing first-party DB session, CSRF verification, and authenticated private-user rate limit boundary.
- The operation revalidates the current live session, revokes every active `wcb_sessions` row for that internal user, and clears the current `__Host-wcb-session` cookie.
- Added `HostedProductClient.revokeAllSessions()`; no new Settings/dashboard UI has been activated before live Hyperdrive smoke.
- Also fixed a real runtime issue: `isKnownAppPath()` was used by the Worker 404 path without being imported on `main`. The import is now fixed and covered by regression tests.
- Verification: focused Phase 4/5 tests PASS, Worker syntax PASS, Vite production build PASS, Wrangler bundle dry-run PASS.

---

# PHASE 5 SEO / CANONICAL / REAL 404 CHECKPOINT — 2026-09-19 KST

- Main merge: `4025da71e5cc4f3324274dde926e71a20fd83ec5`.
- Added route-specific document title, description, OpenGraph, Twitter, robots meta, and canonical URL synchronization.
- Aliases canonicalize to preferred routes:
  - `/templates` → `/browse`
  - `/pricing` → `/plans`
  - `/privacy` → `/policy`
- Public docs/project routes receive canonical URLs.
- Private or unknown client routes are marked `noindex, nofollow`.
- Worker now classifies known SPA routes; unknown HTML navigation requests return the existing React 404 surface with a **real HTTP 404 status** instead of SPA 200.
- Asset requests are unaffected by the HTML-navigation check.
- Verification: focused Phase 4/5 tests PASS, Worker syntax PASS, Vite production build PASS, Wrangler bundle dry-run PASS.
- No dashboard or landing visual redesign.

---

# PHASE 5 ROUTE / RENDER FAILURE HARDENING CHECKPOINT — 2026-09-19 KST

- Main merge: `d9744bb06a0e906c97998f78cea403cfcb12d947`.
- Canonical production no longer exposes the unauthenticated `/dashboard-preview`; it resolves to the normal Webcanbe 404 surface.
- Non-production preview behavior remains available for development.
- Added a top-level React error boundary so unexpected render failures show a recoverable 500 surface instead of a blank page.
- Recovery UI reuses the existing Webcanbe not-found/button styles; no dashboard redesign or new visual system was introduced.
- Focused Phase 4/5 tests PASS, Worker syntax PASS, Vite production build PASS, Wrangler bundle dry-run PASS.
- Dashboard route itself remains protected and otherwise unchanged.

---

# PHASE 5 CLOUDFLARE RATE LIMITING CHECKPOINT — 2026-09-19 KST

- Main implementation merge: `3c383c6bb0dc0b63df2a03143606f5c575ffbb3f`.
- Added native Cloudflare Workers Rate Limiting bindings:
  - `AUTH_RATE_LIMITER`: 30/min per auth fingerprint key
  - `PUBLIC_API_RATE_LIMITER`: 180/min per public/readiness fingerprint key
  - `PRIVATE_API_RATE_LIMITER`: 180/min per authenticated DB user
- Anonymous keys hash Cloudflare IP + bounded User-Agent + route scope with SHA-256; raw IP/UA are not logged.
- Private limits run only after first-party DB-session + CSRF validation and key on internal `userId`.
- Rate-limit response: HTTP 429 + `Retry-After: 60`.
- Limiter errors fail open; authentication/CSRF/authority remain independent and fail closed.
- Cloudflare rate-limit counters are treated only as abuse protection, never billing/accounting/product authority.
- Wrangler dry-run accepted the real `ratelimits` configuration.
- Focused Phase 4/5 tests, Worker syntax, Vite build, and Wrangler bundle dry-run all PASS.
- Recovery snapshot updated in the same work cycle.

---

# PHASE 5 ENFORCED CSP CHECKPOINT — 2026-09-19 KST

- Main implementation merge: `1386f4006bd162edbff89613e2557778d8b62ecb`.
- Completed a retained-landing + React-root CSP compatibility inventory before enforcement.
- Retained landing has no inline runtime scripts, external runtime scripts, eval, or new Function.
- Existing landing does require inline styles, so style policy retains `'unsafe-inline'`.
- Enforced `Content-Security-Policy` now:
  - restricts scripts to same-origin
  - blocks inline script attributes
  - does not allow unsafe-eval
  - blocks objects and framing
  - restricts base URI/forms/workers
  - explicitly permits Firebase/Google auth connectivity/frame origins
- Added `src/phase5-csp-compat.test.ts` so runtime external resources/inline scripts cannot silently return.
- Inventory report: `docs/reports/phase5-csp-inventory.md`.
- Verification passed: focused Phase 4/5 tests, Worker syntax, Vite build, Wrangler bundle dry-run.
- No dashboard/landing visual change.
- Recovery snapshot updated in the same work cycle.

---

# PHASE 5 PRIVACY-SAFE REQUEST OBSERVABILITY CHECKPOINT — 2026-09-19 KST

- Main implementation merge: `90e0707480789d55fecdf52b44d485890523302d`.
- Every Worker response now carries an `X-Request-ID` UUID for production correlation.
- Added `worker/telemetry.js`.
- Structured failure logs are intentionally bounded to:
  - event
  - request ID
  - path
  - status
- Tokens, cookies, CSRF values, emails, profiles, request bodies, DB credentials/connection strings, and payment secrets are not logged by this helper.
- Public catalog, private product, readiness DB failures, and top-level unhandled Worker failures use the request-ID correlation path.
- Focused privacy test verifies extra sensitive fields passed to the logger are discarded.
- Verification passed: focused Phase 4/5 tests, Worker syntax, Vite build, and Wrangler bundle dry-run.
- Recovery snapshot was updated in the same work cycle.
- Long-term log retention/alerting remains a later infrastructure choice.

---

# PHASE 5 PRODUCTION READINESS ENDPOINT CHECKPOINT — 2026-09-19 KST

- Main implementation merge: `06df252f54379cf4fcde1f67ae24ed5ed2cb0a4d`.
- Added same-origin `POST /__webcanbe/ops/readiness`.
- The endpoint exposes no credentials, connection strings, row contents, user identifiers, or DB role names.
- It distinguishes:
  - Hyperdrive unconfigured
  - database unavailable
  - critical schema incomplete
  - database/schema ready
- Critical schema verification covers the core session, identity, workspace, profile, catalog, release, listing, entitlement, and materialization tables.
- Added focused tests and Worker-first routing.
- Verification passed: focused Phase 4/5 tests, Worker syntax, Vite production build, and Wrangler bundle dry-run.
- Use this endpoint immediately after Hyperdrive binding before interactive provider/product smoke.
- Recovery snapshot `docs/phase5-resume-2026-09-19.md` was updated in the same work cycle.

---

# PHASE 5 PRIVATE ROUTE NOINDEX CHECKPOINT — 2026-09-19 KST

- Main implementation merge: `8200a0d54bfeaa8bd4aac81934cbcb6fc661f5ba`.
- Private/authenticated SPA routes now receive `X-Robots-Tag: noindex, nofollow` at the Worker response layer.
- Covered paths include dashboard, dashboard-preview, projects, purchases, settings, workspace, checkout, seller, control, login/signup, and auth-complete.
- Public routes such as landing, Marketplace, docs, plans, and public project detail remain indexable.
- This complements `robots.txt`; it does not rely on robots exclusion alone.
- No UI change.
- Verification: focused Phase 4/5 tests PASS, Worker syntax PASS, Vite build PASS, Wrangler bundle dry-run PASS.

---

# PHASE 5 BASELINE SECURITY HEADERS + CRAWLER POLICY CHECKPOINT — 2026-09-19 KST

- Main implementation merge: `1126a793127cfb044a6c7a21ce36e045016abc2e`.
- Added shared Worker/static security headers:
  - `Strict-Transport-Security: max-age=31536000`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin` for static assets; authenticated dynamic endpoints retain the stricter `no-referrer`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Cross-Origin-Opener-Policy: same-origin-allow-popups`
- COOP deliberately uses `same-origin-allow-popups` so Firebase/GitHub popup authentication is not broken by a strict opener policy.
- CSP was deliberately **not** added yet; the retained landing has substantial existing inline/runtime presentation content and requires a dedicated compatibility inventory first.
- Added `public/robots.txt`:
  - allows public site discovery
  - disallows auth/API/dashboard/workspace/settings/checkout/seller/control routes
- Added `public/sitemap.xml` with public routes only.
- No dashboard or landing visual change.
- Verification after test split: 75 focused tests PASS, Worker syntax PASS, Vite production build PASS, Wrangler bundle dry-run PASS.

---

# PHASE 5 SAFE PRODUCTION READ-MODE CHECKPOINT — 2026-09-19 KST

- Main implementation merge: `706620f50034df1b0053a332b3c6a104f0e7f336`.
- Added `productionReadProductMode()` / `productReadMode()` as a separate frontend capability boundary.
- Activation flag is intentionally **absent** from production `index.html`; current UI/data behavior is unchanged.
- Future activation flag:
  `<meta name="wcb-product-read-mode" content="hosted">`
- The read-only mode is prepared only for:
  - workspace selector
  - dashboard/product library reads
  - purchases
  - working-copy list
  - account profile read/update through the existing Settings UI
- Seller, Control, Checkout, and other mutation-heavy surfaces still use the full `hostedProductMode()` and therefore do not become live when read mode is activated.
- Existing Settings UI was not redesigned; when read mode is later enabled it loads the real account profile, saves only display name through the server API, and treats provider email as non-editable authority.
- Production flag must not be activated until Hyperdrive is bound and DB-session/private-read smoke passes.
- Verification: focused Phase 4/5 tests PASS, Worker syntax PASS, Vite build PASS, Wrangler bundle dry-run PASS.

---

# PHASE 5 ACCOUNT PROFILE PERSISTENCE CHECKPOINT — 2026-09-19 KST

- Main implementation merge: `cd0d21fd43a0eee8f04ffba56e7a7ab233b9384c`.
- Added production PostgreSQL table `wcb_user_profiles` through migration `add_webcanbe_user_profiles`.
- Production Webcanbe table count is now 37.
- Profile fields are provider-independent internal account state:
  - display name
  - provider-derived email + verification flag
  - picture URL
  - created/updated timestamps
- Email is **not** used to silently merge Google/Firebase identities. Identity authority remains issuer + subject.
- Durable DB session issuance seeds a profile on first login and refreshes provider-derived email/picture metadata without overwriting a user-edited display name.
- DB session resolution now returns the real persisted profile instead of blank account fields.
- Added CSRF-protected Worker account APIs:
  - `/__webcanbe/api/account/get`
  - `/__webcanbe/api/account/update`
- Account update currently permits only a bounded display-name change; client-supplied email/provider authority is rejected.
- Added corresponding `HostedProductClient.account()` and `updateAccount()` methods.
- No dashboard/landing visual changes.
- Branch verification passed: focused Phase 4/5 tests, Worker syntax, Vite build, and Wrangler bundle dry-run.
- Supabase `anon`/`authenticated` have no direct privilege on `wcb_user_profiles`; `webcanbe_runtime` has the intended DML rights.
- Supabase Security Advisor remains at 0 findings.
- RLS remains intentionally disabled for the server-only Webcanbe schema; browser Supabase roles have no Webcanbe DB privileges.
- Hyperdrive binding is still the remaining infrastructure blocker before live DB-backed account/product smoke.

---

# SESSION CONTINUITY / RECOVERY POINTER — 2026-09-19 KST

A complete recovery snapshot for the current Phase 5 state is committed at:

`docs/phase5-resume-2026-09-19.md`

Recovery snapshot commit: `189ac3726bfa2c3458cf4241d02dfb2d7fe71458`.

It contains the exact current architecture, frozen dashboard rules, Cloudflare deployment model, Google/Firebase auth state, Supabase production project/migrations/security hardening, DB roles, implemented Worker routes, verification state, manual Hyperdrive blocker, next smoke sequence, and “do not redo” list.

If this chat/session is lost, **read that file first before making changes**.

Immediate resume point:
1. user privately enables LOGIN/password for `webcanbe_hyperdrive`
2. user creates Cloudflare Hyperdrive with Supabase Direct connection
3. user sends only the Hyperdrive configuration ID
4. add `HYPERDRIVE` binding to `wrangler.jsonc`
5. deploy and smoke-test DB sessions/catalog/workspaces/purchases/working-copy reads
6. continue Phase 5 without changing dashboard UI

---

# PHASE 5 HYPERDRIVE LOGIN ROLE PREP CHECKPOINT — 2026-09-19 KST

- Prepared PostgreSQL role `webcanbe_hyperdrive` in production Supabase.
- Verified: `NOLOGIN`, non-superuser, cannot create DB/roles, and is a member of `webcanbe_runtime`.
- No password was generated, displayed, or stored by ChatGPT.
- Reproducible role creation is now recorded in `deployment/hosted/postgres-supabase-hardening.sql`.
- This deliberately leaves the final credential step under operator control.
- Required next manual step: set a strong password on this role, then create Cloudflare Hyperdrive using Supabase's direct PostgreSQL endpoint.
- Do not send the DB password in chat. Only the resulting Hyperdrive configuration ID is needed back here.

---

# PHASE 5 DB SESSION + PRIVATE READ API CHECKPOINT — 2026-09-19 KST

- Main HEAD after merge: `e1a7dabfc40bb1abd1b2db338ac7c5ddbfef40dd`.
- Google/Firebase auth now automatically switches to the durable PostgreSQL session implementation when a `HYPERDRIVE` binding exists.
- Before Hyperdrive is configured, the current signed-cookie auth fallback remains intact so production login is not broken.
- Added DB-session CSRF rotation/verification and DB-backed logout/revocation.
- Added Worker-first private read routes:
  - `/__webcanbe/api/workspaces`
  - `/__webcanbe/api/product/purchases`
  - `/__webcanbe/api/product/workspace-projects/list`
- Purchases are strictly scoped to `session.userId`.
- Working-copy reads require both the materialization owner and an active owner/editor workspace membership.
- No private mutation route, payment route, or fake product state was enabled.
- Verification: focused Phase 4/5 suite PASS, Worker syntax PASS, Vite production build PASS, Wrangler Worker bundle dry-run PASS.
- Production DB already exists and is hardened; the only infrastructure blocker for live DB-backed behavior is the Cloudflare Hyperdrive binding + dedicated password-bearing DB login.

---

# PHASE 5 PRODUCTION DATABASE + SUPABASE HARDENING CHECKPOINT — 2026-09-19 KST

- Created Supabase project `webcanbe-production` in Seoul (`ap-northeast-2`) under the existing Webcanbe organization.
- Confirmed project creation cost: **$0/month** on the current organization plan.
- Applied the retained `deployment/hosted/postgres.sql` schema as migration `webcanbe_phase3_authoritative_schema`.
- Verified all 36 Webcanbe product/identity/source/seller/control tables exist; only the two expected singleton lock/pool rows are pre-seeded.
- Initial Supabase audit correctly found a critical issue: default `anon` and `authenticated` roles had full privileges on the new public-schema Webcanbe tables.
- Removed all Webcanbe table/function privileges from `anon` and `authenticated`, and removed their future default table/function/sequence grants.
- Fixed mutable `search_path` on all Webcanbe PostgreSQL functions.
- Re-ran security advisors: **0 findings**.
- Created `webcanbe_runtime` as a NOLOGIN, non-superuser server role with only USAGE on public + SELECT/INSERT/UPDATE/DELETE on Webcanbe tables.
- Recorded the reproducible hardening migration at `deployment/hosted/postgres-supabase-hardening.sql`.
- RLS was not blindly enabled: with no browser policies it would deny all access and does not match the current server-only Webcanbe DB authority model. Browser roles are instead explicitly stripped of DB privileges.
- Next blocker: Cloudflare Hyperdrive needs a dedicated PostgreSQL LOGIN credential. The repo/runtime role is prepared, but a password-bearing login must be created and configured into Hyperdrive without exposing it in frontend code/chat.

---

# PHASE 5 P5.2 PUBLIC CATALOG WORKER CHECKPOINT — 2026-09-19 KST

- Main HEAD when recorded: `6b16415789356f28ed30559f2a6f1c6e05dd3f41`.
- Added `worker/hyperdrive.js` using the existing `pg` dependency and Cloudflare Hyperdrive connection-string contract.
- Added `worker/product-catalog.js` using the same published/available/active Listing SQL and immutable Release provenance as the retained Phase 3 `PostgresProductDomainStore`.
- Added Worker-first routes for `/__webcanbe/api/product/catalog/browse` and `/__webcanbe/api/product/catalog/detail`.
- No second catalog schema or D1 mirror was introduced.
- Without a real `HYPERDRIVE` binding, catalog routes fail closed with HTTP 503 instead of fabricating product state.
- Private purchases/workspaces/seller/control routes remain closed until DB-backed session authority is connected.
- Explicit `nodejs_compat` is set for Worker/pg portability.
- Verification: 57 focused tests PASS, Worker syntax PASS, Vite production build PASS, and Wrangler v4 Worker bundle dry-run PASS with `pg` included.
- Existing `deployment/hosted/postgres.sql` audit found no CREATE EXTENSION, CREATE ROLE, CREATE DATABASE, SUPERUSER, ALTER SYSTEM, or other obvious privileged migration requirements. It contains the retained immutable triggers/functions and 35 product/identity/source tables.
- Next infrastructure blocker: provision a real managed PostgreSQL database, apply the existing schema, then create/bind Cloudflare Hyperdrive. Do not activate private product routes before DB-backed first-party sessions use the same `wcb_sessions` authority model.

---

# PHASE 5 P5.1 SESSION UNIFICATION + P5.2 ARCHITECTURE CHECKPOINT — 2026-09-19 KST

- Main HEAD when recorded: `3f672163e93621ee565200887ffec52d59afa5a2`.
- P5.1 code is merged: Firebase GitHub/Email login now sends a Firebase ID token to `/__webcanbe/auth/firebase-exchange`.
- The Worker verifies Firebase RS256 signing keys plus issuer, audience, expiry, issued-at, auth-time, and bounded UID before minting the normal Secure HttpOnly Webcanbe session.
- New sessions carry canonical provider/subject fields; Google sessions are canonicalized the same way.
- Protected production frontend gates no longer accept Firebase browser state as authority. A persisted Firebase login may only refresh/exchange into the first-party server session.
- Logout clears both the first-party Worker session and Firebase state.
- Real cryptographic Firebase-token tests use generated RS256 keys; focused Phase 4/5 tests, Worker syntax and Vite production build PASS.
- The Firebase project ID is treated as public configuration inside the Worker rather than as a redundant runtime secret.
- Production observation is still pending: at the time of this checkpoint, `webcanbe.com/__webcanbe/auth/firebase-exchange` still returned the prior SPA 404, so Cloudflare's latest deployment has not yet been observed live.
- P5.2 audit: the existing authoritative Product API is already implemented in the Node/PostgreSQL hosted stack. It must be adapted/reused rather than rewritten as a second Cloudflare data model.
- Recommended P5.2 runtime direction: managed PostgreSQL + Cloudflare Hyperdrive + a Workers-compatible adapter around the retained PostgreSQL stores. A real database/Hyperdrive binding is the next infrastructure requirement.

---

# PHASE 5 MASTER PLAN + FIREBASE AUTH CHECKPOINT — 2026-09-19 KST

- Production branch: `main`.
- Baseline HEAD: `fc24f43b0a7a89c84c9d84e7c428ccdac12ade11`.
- Dashboard UI is frozen at the currently approved state; Phase 5 proceeds as functional/backend launch work.
- Google production auth remains on the Cloudflare Worker Authorization Code + PKCE flow.
- Firebase Web SDK is now installed and production GitHub + Email/Password auth are connected to the existing login UI.
- GitHub uses `GithubAuthProvider` + `signInWithPopup`.
- Email signup uses `createUserWithEmailAndPassword`; email login uses `signInWithEmailAndPassword`.
- Firebase configuration is read from the six existing `VITE_FIREBASE_*` Cloudflare build variables. GitHub Client ID/Secret remain only in Firebase.
- Successful GitHub/Email auth returns to the existing `/dashboard`.
- Current verification: focused inherited Phase 4/5 tests PASS, Worker syntax PASS, Vite production build PASS.
- The production Cloudflare Worker still implements auth routes only; the frontend's product API calls are not yet backed by deployed Worker product routes.
- Critical next boundary: exchange/verify Firebase identity server-side and mint the same first-party Webcanbe session before exposing private product APIs.
- Master plan: `docs/phase5.md`.

Next execution order:
1. P5.1 unified first-party session boundary for Google + Firebase identities.
2. P5.2 activate real hosted product APIs and durable account/workspace data.
3. P5.3 account/workspace persistence.
4. P5.4 Marketplace → purchase → entitlement → working copy.
5. P5.5 production payment provider.
6. P5.6 persisted editor/save/reload/export.
7. P5.7 connect the existing seller/review/assessment/release/listing pipeline.
8. P5.8 launch hardening and production smoke test.

---

# PHASE 5 CLOUDFLARE AUTH DEPLOY CHECKPOINT — 2026-09-19 KST

- Production branch: `main`.
- Cloudflare build command: `npm run build`.
- Cloudflare deploy command was changed to `npm run deploy:cloudflare`.
- `scripts/cloudflare-deploy.mjs` forwards the existing Workers Build secrets `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` to Wrangler as runtime secrets during deploy.
- This documentation-only commit intentionally retriggers the production Cloudflare build after the deploy-command setting was changed.

---

# PHASE 5 BRAND + INITIAL UI POLISH CHECKPOINT — 2026-09-18 KST

- Branch: `phase-5-product-launch`.
- Implementation HEAD before this checkpoint: `bd5256d12c57dce7097c9342692262673e8c9ccd`.
- New primary Webcanbe lockup applied across landing, public shell, dashboard chrome, app sidebar, workspace, checkout, and auth-complete surfaces.
- Added matching standalone mark and updated favicon.
- Sidebar collapsed state now uses the mark-only asset.
- Top-right account control now opens its own account popover instead of sharing the sidebar account state.
- Phase 5 focused verification + inherited Phase 4 tests + production build passed in GitHub Actions.
- Vercel build itself also completed successfully; the observed deployment failure occurred after build during `Deploying outputs` with Vercel's transient-error message. This documentation commit intentionally retriggers deployment without changing application behavior.

---

# PHASE 4 LANDING ASSET LOCALIZATION + HIDDEN-VARIANT PRUNE — 2026-09-18 KST

**PASS with rollback preserved.** The selected Launch UI-derived Webcanbe landing is now self-hosted for its runtime presentation assets, and the explicitly hidden unused variant subtrees have been removed without changing the selected visual composition beyond the retained parity threshold.

- Pre-change rollback branch: `backup-phase4-before-landing-localize-2026-09-18` at `c80ce7d807e12b1611f5317f18f5d9e33c9945ca`.
- Vendored result commit: `a6d6b8a4767b5f4b4ba08e34723f1f10613565ae` (`Vendor Launch UI landing assets and prune hidden variants [skip ci]`).
- Post-change snapshot branch: `backup-phase4-after-landing-localize-2026-09-18`.
- Guarded workflow run: GitHub Actions `35346964533` **PASS**.
- Focused landing tests: **5/5 PASS** across 4 test files.
- TypeScript + Vite production build: **PASS**.

## What changed
- 57 runtime presentation assets are now committed below `public/wcb-landing/vendor/`, including the exact optimized image responses used by the retained landing, CSS, Inter / IBM Plex Mono font files pulled by those stylesheets, and the OG image.
- `public/wcb-landing/vendor/manifest.json` records original remote URL, local path, byte count, SHA-256 and content type.
- The committed landing has **0 remaining Launch UI runtime asset references** and **0 root `/_next/` asset references** according to `public/wcb-landing/cleanup-report.json`.
- The landing HTML decreased from **1,985,579 bytes** to **859,748 bytes**.
- Removed **2,683 elements** belonging only to hidden, non-selected component variants.
- Removed **36 dark-only nodes** because the retained landing is the light selected surface.
- Removed the remaining unused Next bailout template.
- The selected variants were preserved exactly from the prior CSS selection contract:
  - Hero 1/5
  - Logos 1/5
  - Bento grid 1/4
  - Items 1/4
  - Feature 5/5
  - Testimonials 1/3
  - Stats 1/4
  - Social proof 1/5
  - FAQ 1/4
  - CTA 1/4

## Visual parity gate
The workflow compared the exact pre-cleanup rollback version against the localized/pruned version using the same headless Chrome build and full-page screenshots.

- Desktop 1440 px: **0.147648%** mismatched pixels.
- Mobile 390 px: **0.247120%** mismatched pixels.
- Retained acceptance threshold: **0.5%**.
- Both full-page screenshot geometries remained identical:
  - desktop: 1440 × 14,199
  - mobile: 390 × 15,815
- The localized page was also monitored during rendering and made **no requests to `launchuicomponents.com`**.
- The workflow refuses to commit if asset localization, visual parity, focused tests or production build fails.

## Recovery
If the localization/pruning is later judged undesirable, restore from `backup-phase4-before-landing-localize-2026-09-18`; do not attempt to reconstruct the previous 1.98 MB landing by hand.

---

# PHASE 4 NATIVE UI SHELL / ROUTING CORRECTION — 2026-09-18 KST

- Branch: `phase-4-product-ux`.
- Verified implementation HEAD: `203ccf2909c550b4139b9398e61cb4b07e209532` (`Fix native shell composition syntax`).
- GitHub Actions run `35343300208`: focused Phase-4 tests **10/10 PASS** and production TypeScript/Vite build **PASS**.
- No backend/Phase-5 implementation was started in this pass.

## UI architecture corrections
- Removed the external Ropean dashboard iframe. `/dashboard` is now a native Webcanbe route using the existing product state and AppShell/sidebar.
- Removed the landing iframe. The retained Launch UI-derived static landing is loaded into the React route, with same-origin navigation handled by the Webcanbe router rather than a separate iframe/postMessage navigation system.
- Dashboard remains white/light only; theme switching is not exposed.
- Sidebar retains the Ropean-inspired grouped structure, now has a real collapse control, and its top selector represents Webcanbe workspaces rather than a template project selector.
- Dashboard top search opens a real command palette. Keyboard shortcuts include `Cmd/Ctrl+K` search, `Cmd/Ctrl+P` Settings, `Cmd/Ctrl+1` Dashboard, and `Cmd/Ctrl+2` Marketplace.
- Notifications and account/avatar controls no longer present inert buttons. Sign out returns directly to the landing page.
- Dashboard is protected and not rendered before the auth gate allows it.

## Public shell / route corrections
- Public navigation is now Webcanbe-owned: Product, Marketplace, Learn, Resources, each mapped to a distinct real route.
- The old `Open app` public-header action was removed. Signed-in public surfaces use Account instead.
- Footer is retained on public/product pages and AppShell pages except Dashboard.
- Marketplace gets a restrained entry fade and a working sort control.
- Project `Preview project` now opens a real public preview route.
- Project-structure display now differentiates Next-style and React/Vite-style projects instead of always showing a Next.js tree.
- Unknown paths now render a real 404 rather than silently falling through to Marketplace.
- `/templates` resolves to Marketplace and legacy `/pricing` resolves to Plans.

## Settings / truthful interaction corrections
- Settings tabs now have distinct content instead of repeating the same form.
- Save changes persists the current UI-preview profile/account values in-browser.
- GitHub connection is visibly disabled with truthful copy until the backend connection is wired; it is no longer a fake active button.
- Billing and Domains similarly avoid pretending Phase-5 integrations exist.
- Sign out clears the UI-preview session or calls the hosted logout endpoint and returns to `/`.

## Landing correctness fixes
- Removed the old auth bridge script after iframe removal.
- Removed/fixed stale original-template destinations including `designwithcode.dev`, the original creator email/GitHub, `/pricing`, `/feedback-program`, Figma Community, fake Twitter/GitHub footer destinations, and `href="#"` sign-in/logo targets.
- Corrected the FAQ contradiction: Webcanbe does **not** need to remain in the exported runtime.
- Top landing navigation now points to the distinct Webcanbe Product / Marketplace / Learn / Resources destinations.
- Root document favicon, Apple touch icon, OG/Twitter title/description/image are Webcanbe-owned.

## Deferred from this UI pass
- The retained Launch UI visual document still references upstream Launch UI-hosted presentation assets in places. Full asset vendoring/deduplication and removal of unused hidden imported variants remain a separate bounded cleanup because changing those assets can alter the selected landing visual baseline.
- Real GitHub account linking, real hosted authentication provider configuration, persistent account settings, payments, seller payout/KYC, AI metering, and production deploy-provider integration remain backend/Phase-5 work.
- The existing source-first editor engine and `CompatibleWorkspace` were preserved; this pass did not redesign or weaken Visual / Code / Split source authority.

---

# Phase 3 Admin/Control backend checkpoint — 2026-09-17

**PASS. The smallest operator-only Control backend now reads existing seller,
review, assessment, release, Listing, Ready, deploy, and audit state; performs
fresh-step-up operator authority and seller-application transitions; and records
append-only audit evidence without adding lifecycle bypasses or product/money
side effects.**

This pass began at `b27a775ca014fadfd8fde3715be2c37d5fa54fff` on
`phase-3-hosted-product`; main remains
`dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. See the
[Control report](reports/phase3-admin-control.md) and
[machine evidence](reports/phase3-admin-control-evidence/index.json).

- Durable active operator authority gates Control reads and mutations.
  Ordinary users cannot self-promote; operator revocation takes effect on the
  next authority check.
- High-risk Control mutations require fresh server-minted evidence bound to the
  exact operator session. Missing, guessed, cross-session, stale, and revoked
  evidence refuses; no client route can mint evidence.
- Seller approval/rejection preserves the retained terminal-rejection rule.
  Operator grant/revoke and seller transitions atomically append actor,
  authority, action, target, before/after, evidence, and timestamp audit rows.
  Production triggers reject audit update/delete.
- Control exposes bounded metadata only: no source bodies, worker credentials,