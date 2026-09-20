# Gate 5 browser hardening — 2026-09-20 KST

Production browser compatibility smoke `35516707994` passed on Chromium, Firefox, and WebKit for desktop and mobile. Production smoke `35516693367` also passed. Landing overflow/accessibility hardening and build-size budgets are live. See `docs/current-handoff.md` for the full checkpoint.

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

# LAUNCH CLOSURE ORDER — 2026-09-20 KST

Current source branch: `phase5-product-read-launch` from main `ac60ef75ce5ad0c5024febae92b99b25a3acab44`.

Release sequence:
1. production read activation + branch CI;
2. production Google/GitHub/Email private-read smoke;
3. deliberate materialization mutation activation;
4. clean-account browse → entitlement → materialize → edit → save → reload → export E2E;
5. browser/mobile/accessibility/performance + backup/rollback final pass;
6. beta/public activation;
7. commercial payment/payout closure for the paid launch.

Detailed gate criteria: `docs/launch-plan-2026-09-20.md`.

---

## 2026-09-20 authoritative resume pointer

The newest complete state is in:

`docs/phase5-admin-live-handoff-2026-09-20.md`

Read that file before the older recovery deltas below. Hyperdrive, production DB sessions, production Control deployment, Cloudflare TypeScript runtime compatibility, and the DB session created_at/auth-provider incidents have all been resolved after the older checkpoints in this file.

Current immediate step: first production Bigperson passkey enrollment + three-factor Control read.

---

## Latest recovery delta — green main + production smoke + FK index hardening

- Admin + durable editor integration is on main and passed all three main verification workflows.
- Automatic production smoke `35495723690` passed 21/21 checks against live `webcanbe.com`; the database is still deliberately unconfigured and Worker readiness/catalog fail closed with 503.
- Integration exposed and fixed stale whole-suite assumptions for Control routing, DB session auth provenance, and runtime-profile preparation.
- Production Supabase migration `20260920070349 phase5_fk_covering_indexes` adds 21 FK covering indexes identified by the performance advisor.
- Production catalog query now confirms zero uncovered `wcb_*` foreign keys.
- Performance advisor's remaining findings are unused-index INFO only, expected before traffic.
- Canonical schema and regression test preserve the index set.
- Immediate live gate: create/bind Hyperdrive without exposing the DB password, then run DB-session/provider/private-read smoke and first Bigperson enrollment/Control E2E.

---

## Latest recovery delta — Admin + durable editor proof integrated

- The six-commit `phase5-editor-durable-export` proof branch has been functionally integrated onto the newer Bigperson/Admin line.
- The integrated durable test proves persisted accepted save/history, restart/reopen consistency, fresh-checkout standalone export build, shared Visual/Code/Split source authority, and export validation authority.
- A stale read-mode regression was updated to the current safer architecture: product read mode cannot activate Control; Control uses its own production gate.
- Combined integrated runs:
  - `35495424755` Bigperson/Admin: PASS
  - `35495424762` durable editor/export: PASS
- Production Bigperson schema is already applied and verified.
- The integrated branch is ahead of `main` with no commits behind, so it can be fast-forwarded after a main backup.
- After main integration, the remaining live infrastructure gate is Hyperdrive + first production Bigperson enrollment/Control E2E, with production read/mutation activation still closed.

---

## Latest recovery delta — production Bigperson schema applied

- Production Supabase migrations `phase5_control_roles` and `phase5_bigperson_three_factor` are applied and recorded.
- Production has the reviewer/admin/bigperson role constraint, final-Bigperson protection trigger, and the three Bigperson 3-factor tables.
- Bigperson FKs were corrected before deployment to use `wcb_user_profiles(user_id)`, not nonexistent `wcb_users`.
- Production privilege verification after migration: anon=0 grants, authenticated=0 grants, webcanbe_runtime=160 table grants across 40 wcb tables.
- Supabase Security Advisor currently reports 0 lints. The generic RLS-disabled warning from table listing is expected under the deliberate server-only/no-browser-grants model; do not blindly enable RLS.
- All Bigperson security/passkey/challenge tables are empty before first enrollment.
- Ready qualification now uses the canonical immutable-source React compatibility analyzer server-side and is CI-proven.
- Admin code/schema work is closed. The remaining live Admin gate is Hyperdrive + production Bigperson config + first device-bound passkey enrollment + Control E2E.
- Proceed next with safe integration of the already-passing durable editor proof while keeping production activation closed.

---

## Latest recovery delta — publication and TEST entitlement Control

- Admin+ Control now promotes passed immutable assessment results into immutable releases with full stored provenance revalidation.
- Admin+ Control now publishes one promoted release into one published Listing through the retained `wcb_listing_publications` boundary.
- Admin+ Control now grants/transitions only `provider=test` entitlements; payment-provider entitlements cannot be mutated from this surface.
- All three operations require a new exact-body-bound mandatory three-factor proof and append privileged audit evidence.
- Bounded Control reads now include catalog projects, promotions and publication rows.
- Backup before this slice: `backup-phase5-before-publication-control-2026-09-20` at `2006c905b4f974e895c470a977bdb6cae294a29b`.
- Ready qualification remains the next Admin item because the canonical Phase 3 Ready result is source-derived through the React compatibility analyzer. Do not create a weaker immutable qualification from operator/client input.
- After exact Ready qualification: provision the first production Bigperson, run Control smoke/E2E, then continue Hyperdrive/product activation and editor-branch integration.

---

Bigperson ceremony rate limit: 5 per minute per user through a dedicated Cloudflare binding.\n\n# Webcanbe Phase 5 — Session Recovery Snapshot

Snapshot date: **2026-09-19 KST**  
Code baseline before this recovery update: `3c383c6bb0dc0b63df2a03143606f5c575ffbb3f`  
Repository: `Webcanbe/webcanbe-real`  
Production branch: `main`  
Production domain: `https://webcanbe.com`

> This file exists so a new ChatGPT session can resume Phase 5 without re-deciding architecture or repeating finished work. Read this file first, then `docs/phase5.md`, `docs/current-handoff.md`, and `docs/project-record.md`.

## Latest recovery delta — privileged Control mutations

- Real production Worker mutations exist for operator role/state, seller approval/rejection, session revoke, review decision and assessment admission.
- Every mutation consumes a fresh exact-body-bound three-factor proof.
- reviewer+: review/assessment; admin+: seller/session; bigperson only: platform-role transition.
- Role thresholds are enforced server-side; UI state is not authority.
- All mutations are idempotency-keyed and append immutable privileged audit evidence.
- Control UI clears the factor before each passkey prompt and exposes no session tokens/hashes.
- Final-Bigperson DB protection remains active.

---

## Latest recovery delta — Bigperson review / assessment

- Operations can make immutable seller review approve/reject decisions with a fresh three-factor proof.
- Worker rechecks pending state + immutable snapshot hash before review insert.
- Approved reviews can be admitted to assessment only with another fresh three-factor proof and matching seller/snapshot/review provenance.
- Review/assessment mutations append privileged Control audit transitions.
- Next: release promotion, Listing publication, Ready qualification, entitlement operations, then provisioning/E2E.

---

## Latest recovery delta — Bigperson session security

- Control exposes bounded active-session IDs/user/provider/expiry but never token/cookie hashes.
- Bigperson can revoke an individual first-party session only through a new three-factor operation-bound ceremony.
- Session revocation is append-only audited as `session.revoke`.
- Audit UI now displays bounded before/after transition detail.
- Next: remaining review/assessment/release/listing/Ready mutations + production provisioning/E2E.

---

## Latest recovery delta — Bigperson mutation UI

- Bigperson can now perform audited platform-role/active-state transitions and seller application approve/reject from Operations.
- Every mutation starts a new mandatory three-factor ceremony; opening Control does not authorize later writes.
- The WebAuthn challenge binds exact method/path/body hash.
- Successful proof mints short-lived session-bound `control_high_risk` evidence used by append-only Control audit.
- Operator epoch advances on authority change; final active Bigperson remains DB-protected.
- Rejected seller applications cannot be reopened through this intake mutation.
- Browser clears the separate factor before passkey.
- Next: privileged session/security controls + audit drill-down + remaining review/publication operations.

---

## Latest recovery delta — mandatory Bigperson three-factor security

- Every Bigperson Control operation requires all three: enrolled Google-authenticated first-party session + separate privileged factor + verified WebAuthn/passkey assertion.
- Google authority is issuer+subject after bootstrap; deployment allowlist email is not the durable identity key.
- Bigperson Google sessions must be no older than 10 minutes.
- Privileged factor is never stored as plaintext; PBKDF2-SHA256 600k + per-user salt + server-only pepper. During the one-time first bootstrap, a deployment salt is combined with the entered factor and pepper; only the derived digest is persisted. An optional pre-provisioned digest can additionally pin the bootstrap factor.
- First Bigperson bootstrap requires all three factors and closes after an active Bigperson exists.
- WebAuthn requires user verification and a device-bound, non-backed-up credential; operation challenges expire after 90 seconds and bind exact user/session/method/path/body hash.
- Challenges are one-time and passkey counters are persisted.\n- Dedicated Bigperson ceremony rate limit: 5 attempts/minute/user.
- Control UI clears the entered factor before passkey and requires a new ceremony for each Control read.
- Migration: `deployment/hosted/postgres-bigperson-3factor.sql`.
- Credential values are intentionally absent from Git and Markdown.
- Production secret provisioning and first passkey enrollment still wait for deployment/Hyperdrive availability.

---

## Latest recovery delta — bigperson Control foundation

- Platform authority is `reviewer → admin → bigperson`, separate from workspace roles.
- Ordinary navigation no longer exposes Control and the obvious `/control` route is gone.
- Privileged route: `/_ops/keystone-7f31`; obscurity is not authorization.
- Production Control has an independent activation gate and bounded Worker read path.
- reviewer handles review/assessment authority; admin+ handles seller/publication/TEST entitlement authority; only bigperson may change privileged platform roles.
- Fresh session-bound high-risk step-up evidence remains mandatory for Control mutations.
- Database trigger protects the final active bigperson.
- Explicit migration: `deployment/hosted/postgres-control-roles.sql`.
- Next slice: passkey-backed step-up minting + privileged mutation UI + privileged session/security controls.
- Dashboard/landing unchanged.

---

## Latest recovery delta — coherent reload / Refresh accepted

- Initial Code workspace load accepts files + history only when both report the same accepted revision.
- `Refresh accepted` re-reads accepted files/history and the active file against one revision.
- Dirty drafts are never discarded by refresh; clean active files update to accepted bytes.
- A moved HEAD immediately turns older dirty drafts stale under the existing explicit-save guard.
- Validation, pending-save identity and project-search results derived from the old HEAD are cleared.
- Draft recovery remains separate from accepted-source authority.
- Verification run `35450499806` passed secret scan, recovery/save/search/navigation regressions, Vite build and Wrangler dry-run.
- P5.6 reload/recovery implementation is complete in code; canonical production DB activation remains Hyperdrive/session-smoke gated.
- Dashboard/landing unchanged.

---

## Latest recovery delta — explicit save and stale drafts

- Code uses an explicit-save policy.
- Drafts are auto-backed up for recovery only; accepted source, preview, history, project search and export do not change until Save succeeds.
- The save-policy banner shows accepted/draft/conflict state, pending draft count and accepted HEAD.
- Stale drafts are detected against current HEAD before save; Save source / Save all are blocked for stale bases.
- Server expectedRevision/CAS remains final authority.
- Rebase is allowed only when the accepted file bytes are unchanged; otherwise manual reconciliation is required.
- Export explicitly uses accepted source and excludes unsaved Code drafts.
- Verification run `35450086111` passed all branch gates.
- Dashboard/landing unchanged.

---

## Latest recovery delta — bounded project source search

- Project-wide accepted-source search is implemented server-side behind the existing project/session authority.
- `Cmd/Ctrl+F` is current-file draft Find/Replace.
- `Shift+Cmd/Ctrl+F` is project-wide accepted-source search.
- `search` is read-only: viewer allowed, cross-tenant denied, no source/history mutation.
- Bounds: 160-character query, 100 results, 20 per file, 512 KiB per file, 8 MiB scanned per request, explicit truncation metadata.
- Search result offsets are anchored to accepted source; exact jumps are refused when the target file has an unsaved draft.
- Verification run `35449313942` passed secret scan, actual HTTP authority regressions, production build and Wrangler dry-run.
- Dashboard/landing unchanged.

---

## Latest recovery delta — Worker working-copy materialization

- Entitlement → working-copy materialization is implemented in the Cloudflare Worker.
- It verifies immutable release file/history/content/snapshot provenance before creating source.
- It creates the existing `wcb_projects` row + owner project membership + ready materialization atomically.
- Session and workspace authority are rechecked inside the DB transaction.
- Exact retry is idempotent; conflicting key/workspace reuse is refused.
- Production mutation activation remains closed behind BOTH:
  - Worker env `WEBCANBE_PRODUCT_MUTATIONS=enabled`
  - frontend meta `wcb-product-mutation-mode=hosted`
- Neither activation switch is enabled yet.
- Hyperdrive read/session smoke is still the next infrastructure gate.
- Verification run `35448977411` passed all branch gates.

---

## Latest recovery delta — editor navigation and exact code jump

- Quick Open: `Cmd/Ctrl+P`, file-path filtering, recent files.
- Current-file Find / Replace: `Cmd/Ctrl+F`, next/previous, case-sensitive, replace/replace-all.
- Replacements are draft-only until normal validated source Save.
- Visual selection opens the exact SourceTarget range in CodeMirror.
- Resolved component definitions and caller/invocation origins also jump to exact ranges.
- CodeMirror selects and scrolls the requested range into view.
- Verification run `35447572418` passed all branch gates.
- Dashboard/landing unchanged.

---

## Latest recovery delta — editor keyboard shortcuts

- Compatible editor now exposes source-safe keyboard shortcuts on top of the existing source transaction/history authority.
- Project transaction undo: `Cmd/Ctrl+Z` outside text/code editing.
- Project transaction redo: `Shift+Cmd/Ctrl+Z` or `Ctrl+Y`.
- CodeMirror keeps local text undo/redo while focused.
- Code save: `Cmd/Ctrl+S`; save all dirty drafts: `Shift+Cmd/Ctrl+S`.
- Surface navigation: `Shift+V/C/S/H` for Visual/Code/Split/History.
- Preview: `V` Select, `I` Interact, `Shift+M/T/D` viewport, `Esc` clear selection.
- Export: `Shift+Cmd/Ctrl+E`.
- `?` opens the in-editor shortcut guide.
- Verification run `35446327861` passed secret scan, source/editor regressions, Vite build and Wrangler dry-run.
- Dashboard and landing remain frozen/unchanged.

---

## Latest recovery delta — explicit provider identity linking prepared

- P5.3 provider-linking server boundary is implemented.
- A live first-party DB session + valid CSRF + freshly verified Firebase ID token is required.
- Mapping authority is exact issuer+subject only.
- Same-account linking is idempotent.
- Inactive same-account mapping can be reactivated.
- Cross-account identity collisions are refused; no automatic merge occurs.
- Email is never used as identity-linking authority.
- Route: `/__webcanbe/api/account/identities/link/firebase`.
- Client method: `hostedProductClient.linkFirebaseIdentity(idToken)`.
- UI activation is intentionally deferred until Hyperdrive production smoke.
- Verification run `35433139579` passed all Phase 5 gates.
- Dashboard UI unchanged.

---

## Latest recovery delta — legal/privacy consistency complete

- Launch-hardening legal review is complete.
- Current Privacy Policy matches Google + Firebase + first-party session + Cloudflare + Supabase/PostgreSQL data flow.
- Policy explicitly states that provider email alone is not authority for silent identity merging.
- Terms continue to qualify payment/deployment and other unfinished features as pre-release/unavailable rather than active.
- `src/phase5-privacy-current.test.ts` locks the material disclosures and security contact.
- No dashboard UI changed.
- Hyperdrive remains unbound and is still the main infrastructure blocker for activating DB-backed production read mode.

---

## Latest recovery delta — live Worker routing + account authority summary

- Worker-first routing is now **confirmed live**, not merely prepared.
- Automatic production smoke run `35424848026` passed on `main`.
- Direct production checks confirmed:
  - real 404 for unknown HTML routes
  - `/dashboard-preview` blocked on canonical production
  - `/login` noindex/nofollow
  - readiness remains Worker-owned and refuses unsupported GET
- Account profile API now includes server-derived connected provider families and active Webcanbe session count.
- These values come only from active issuer+subject identity rows and live first-party session rows; email is not an identity-linking authority.
- Existing Settings UI shows the summary only when product read mode is active.
- Implementation verification run `35432736254` passed all Phase 5 gates.
- Hyperdrive is still unbound; do not activate production DB read mode before Hyperdrive/session smoke.

---

## Latest recovery delta — production Worker-first routing and public smoke

A live production smoke run found that ordinary SPA/static requests were bypassing the Worker because `assets.run_worker_first` only listed API/auth paths. The Worker-owned API/readiness routes were healthy, but normal HTML routes therefore missed the security headers, request ID, server-side noindex, and real-404 middleware implemented in source.

Current branch correction:
- `wrangler.jsonc` uses `assets.run_worker_first: true`
- public production smoke runner added
- automatic post-main-CI smoke workflow added
- regression requires Worker-first routing
- branch verification run `35424537541` passes secret scan, tests, syntax, Vite build and Wrangler dry-run

Do not claim the routing correction is live until the post-merge production smoke passes after Cloudflare deployment. Hyperdrive remains unbound.

---

## Latest recovery delta — read-only truthfulness hardening

This recovery document predates the newest read-only guardrail pass in some earlier sections. The current continuation also includes:

- production read mode cannot create a new working copy; materialization remains behind the full hosted mutation mode
- empty production catalog/purchase data does not fall back to demo rows in Dashboard
- missing release metadata uses a neutral placeholder rather than a demo project clone
- Dashboard renders explicit hosted loading/failure states
- the committed-secret scanner no longer treats explanatory Markdown mentions of rejected VITE secret-like names as a frontend exposure; executable/configuration sources still receive that heuristic and actual credential patterns still scan all tracked text
- verification run `35424179755` passed secret scan, focused tests, Worker syntax, Vite build, and Wrangler dry-run

Hyperdrive is still unbound and the production read-mode activation marker is still intentionally absent.


---

## 1. Non-negotiable current product decisions

### Dashboard/UI freeze

The current dashboard is approved and should be treated as frozen.

Do **not** redesign or “clean up” the dashboard unless the user explicitly requests a specific UI change.

Final UI constraints already established:

- Keep the Ropean-inspired dashboard shell.
- Keep existing left sidebar/top header/menu structure.
- Keep the current menu counts/labels.
- Keep account/profile dropdowns and their existing subtle fade/slide animations.
- Keep collapsed sidebar icon-only; do not let labels leak underneath content.
- Keep bottom account dropdown above content; do not reintroduce clipping.
- Canonical production must not expose `/dashboard-preview`; it is development-only.
- Top-level React render failures use the existing 500 recovery surface rather than a blank page.
- Top-right brightness/theme button is removed.
- Top-right settings icon remains **visual UI only**; it currently has no Theme Settings drawer/function.
- Settings and Account use visually distinct icons; Account uses `UserCircle2`.
- Official symbol is the transparent-background blue three-stroke Webcanbe mark stored as `public/favicon.png`.
- Visible product wordmark casing is **Webcanbe**.
- Do not replace the retained landing-page visible logo with the favicon mark.
- Landing should remain visually unchanged unless explicitly requested.

### Phase 5 scope

Phase 5 is now backend/functionality/launch work:

1. production identity/session authority
2. PostgreSQL/Hyperdrive
3. real catalog/workspace/purchase data
4. account/workspace persistence
5. purchase/entitlement/materialization
6. payment provider
7. persisted editor/save/reload/export
8. seller pipeline production connection
9. launch hardening

Do not restart a dashboard redesign pass.

---

## 2. Current frontend/deployment architecture

### Frontend

- React 19
- TypeScript
- Vite 6
- Vite output: `dist/`
- Root React entry: `src/main.tsx`
- Main app/routing: `src/App.tsx`
- The project is **not Next.js**.

### Landing

The root landing route is React-hosted but loads the retained static landing document:

- `src/Home.tsx`
- `public/wcb-landing/index.html`
- localized runtime presentation assets under `public/wcb-landing/vendor/`

The landing was previously localized/pruned with visual parity checks and should not be reworked during ordinary Phase 5 backend work.

### Cloudflare

Production project/Worker name:

`webcanbe-real`

Production branch:

`main`

Build command:

`npm run build`

Deploy command:

`npm run deploy:cloudflare`

Worker entry:

`worker/index.js`

Wrangler config:

`wrangler.jsonc`

Important Wrangler facts at this snapshot:

- `compatibility_date: 2026-09-18`
  - Do not casually bump to the local KST date without checking UTC; `2026-09-19` previously failed as a future compatibility date.
- `nodejs_compat` is enabled.
- Static assets use `dist`.
- SPA fallback is enabled.
- Worker-first routes currently include:
  - `/__webcanbe/auth/*`
  - `/__webcanbe/api/product/catalog/*`
  - `/__webcanbe/api/workspaces`
  - `/__webcanbe/api/product/purchases`
  - `/__webcanbe/api/product/workspace-projects/list`
  - `/__webcanbe/api/account/*`

### Cloudflare secret delivery

Google OAuth runtime secrets were originally entered in Cloudflare Builds variables. The deploy script deliberately forwards them to Wrangler runtime secrets:

`scripts/cloudflare-deploy.mjs`

Required names:

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`

The script creates a temporary local secrets JSON, executes `wrangler deploy --secrets-file`, then deletes that temporary file.

Do not commit those secret values.

---

## 3. Firebase Authentication status

Firebase Web SDK is installed:

`firebase@^12.19.0`

Client implementation:

`src/firebaseAuth.ts`

Cloudflare/Vite build variable names:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

The current Firebase project ID is public configuration and is:

`webcanbe-b607e`

### GitHub sign-in

Implemented with:

- `GithubAuthProvider`
- `signInWithPopup`

GitHub Client ID/Secret are configured in Firebase itself.

Do **not** add GitHub OAuth Client ID/Secret to frontend code or Cloudflare variables.

### Email/password

Signup:

`createUserWithEmailAndPassword`

Login:

`signInWithEmailAndPassword`

Existing login UI is retained. The same input visually steps from email to password instead of redesigning the modal.

### Google

Google login remains a separate first-party Worker OAuth implementation:

- Authorization Code flow
- PKCE S256
- ID-token verification
- nonce/state verification
- Secure HttpOnly first-party session

Google live login was successfully tested earlier and reached the real dashboard.

### Firebase → first-party Webcanbe exchange

GitHub/Email do not remain browser-only authority.

After Firebase login:

1. browser gets Firebase ID token
2. POSTs it to:
   `/__webcanbe/auth/firebase-exchange`
3. Worker verifies Firebase RS256 JWT
4. Worker validates issuer/audience/expiry/issued-at/auth-time/project
5. Worker mints the same first-party Webcanbe session boundary used by production routes

Worker verifier:

`worker/firebase-auth.js`

Firebase JWKS source is the Google Secure Token service.

Interactive GitHub/Email production smoke is still worth doing after Hyperdrive is live, but the route and cryptographic test coverage are implemented.

---

## 4. Session authority model

### Before Hyperdrive binding

Current production auth must remain working even though Hyperdrive is not yet attached.

When `env.HYPERDRIVE` is absent:

- Google/Firebase exchange uses the signed HMAC first-party session fallback.
- Session cookie remains Secure + HttpOnly + SameSite=Strict.
- Existing production login continues to function.
- DB-backed product routes fail closed with 503 rather than fabricate state.

### After Hyperdrive binding

The Worker is already coded to switch automatically to durable PostgreSQL sessions.

Implementation:

`worker/postgres-session.js`

When Hyperdrive exists:

- identity is mapped by issuer + subject
- verified first login may atomically create:
  - internal user UUID
  - owner workspace UUID
  - identity mapping
- session token is random and only its SHA-256 digest is stored
- CSRF token is random and only its digest is stored
- disabled-user checks are enforced
- expired/inactive sessions are rejected
- logout revokes the DB session
- Google and Firebase ultimately use the same durable DB session authority

Do not replace this with client-supplied user/workspace IDs.

---

## 5. Production PostgreSQL / Supabase

### Supabase organization

Name:

`Webcanbe`

Organization ID:

`pmlquwiuwgczcmhgcrkf`

### Production project

Name:

`webcanbe-production`

Project ref / ID:

`kappcfofcobhudmeuzmt`

Region:

`ap-northeast-2` — Seoul

Status at snapshot:

`ACTIVE_HEALTHY`

Database:

- PostgreSQL 17
- reported server version: `17.6.1.166`
- direct host:
  `db.kappcfofcobhudmeuzmt.supabase.co`
- database name for the planned Hyperdrive connection:
  `postgres`

Project creation cost confirmed through the Supabase tool:

**$0/month** on the current organization plan.

### Applied migrations

These migrations are already applied in production:

1. `20260919011315 webcanbe_phase3_authoritative_schema`
2. `20260919011359 lock_webcanbe_schema_to_server_only`
3. `20260919011451 create_server_only_webcanbe_runtime_role`
4. `20260919012300 prepare_hyperdrive_login_role`
5. `20260919013329 add_webcanbe_user_profiles`

### Authoritative schema

Source:

`deployment/hosted/postgres.sql`

The existing Phase 3 schema was reused. No second launch-time product schema was invented.

It includes the existing identity/session/workspace/project/catalog/release/listing/entitlement/materialization/seller/assessment/control/deploy-intent model.

Current production DB has **37 Webcanbe tables**, including provider-independent `wcb_user_profiles`.

Only the expected singleton lock/pool rows were initially pre-seeded.

---

## 6. Supabase security hardening already completed

Immediately after applying the schema, Supabase correctly reported a critical issue:

`anon` and `authenticated` had broad privileges on the new `public.wcb_*` tables because of Supabase public-schema defaults.

This was fixed.

### Current DB security state

- `anon` Webcanbe table grants: **0**
- `authenticated` Webcanbe table grants: **0**
- future default table/function/sequence grants to those roles were revoked
- Webcanbe PostgreSQL functions had their mutable `search_path` fixed
- Webcanbe functions were also stripped from browser roles
- Supabase Security Advisor after hardening: **0 findings**

Reproducible hardening source:

`deployment/hosted/postgres-supabase-hardening.sql`

### Why RLS was not blindly enabled

Webcanbe's current production DB authority model is:

**Cloudflare Worker / Hyperdrive → PostgreSQL**

not:

**browser → Supabase PostgREST**

RLS was therefore not mechanically enabled with no policies, because doing so would deny the intended server access while not matching the chosen boundary.

Instead, browser Supabase roles have no Webcanbe DB privileges.

Do not casually reverse this decision.

---

## 7. Database roles already prepared

### `webcanbe_runtime`

Created as:

- NOLOGIN
- non-superuser
- cannot create DB
- cannot create roles
- no replication
- USAGE on public schema
- bounded SELECT/INSERT/UPDATE/DELETE on Webcanbe tables
- future Webcanbe table grants prepared for server runtime

### `webcanbe_hyperdrive`

Created as:

- NOLOGIN
- non-superuser
- cannot create DB
- cannot create roles
- inherits/member of `webcanbe_runtime`

This is deliberate.

No DB password was generated or saved in GitHub/chat.

---

## 8. Provider-independent account profile status

Production table:

`wcb_user_profiles`

Repository migration:

`deployment/hosted/postgres-account-profile.sql`

Current behavior:

- internal Webcanbe user UUID is the profile key
- profile persists display name, email, email verification state, picture URL, timestamps
- provider email is metadata only; it is not an automatic identity-linking authority
- first DB-backed login seeds the profile
- later logins can refresh provider-derived email/picture state
- a user-edited display name is not overwritten on login
- DB session resolution returns real profile values
- Worker account routes:
  - `/__webcanbe/api/account/get`
  - `/__webcanbe/api/account/update`
- account update currently permits only `displayName`
- frontend adapter has `account()` and `updateAccount()`
- existing Settings UI has not yet been switched to live DB mode; do not redesign it

Supabase security after adding this table:

- no `anon` or `authenticated` direct grants
- `webcanbe_runtime` has bounded DML access
- Security Advisor: 0 findings

---

## 9. Exact current manual blocker: Hyperdrive credential + binding

This is the exact point where Phase 5 should resume.

### Step A — enable login with an operator-generated password

In Supabase SQL Editor for `webcanbe-production`, the user should choose a strong password privately and execute:

```sql
ALTER ROLE webcanbe_hyperdrive
LOGIN PASSWORD 'PRIVATE_PASSWORD_CHOSEN_BY_USER';
```

Do **not** ask the user to paste that password into ChatGPT.

### Step B — create Cloudflare Hyperdrive

Use Cloudflare Hyperdrive → Create Configuration.

Suggested name:

`webcanbe-production-db`

Use Supabase **Direct connection**, not the browser API.

Connection components:

- host: `db.kappcfofcobhudmeuzmt.supabase.co`
- port: `5432`
- database: `postgres`
- user: `webcanbe_hyperdrive`
- password: user's private password from Step A
- TLS/SSL: enabled

After creation, the user only needs to provide the **Hyperdrive configuration ID**, not the database password.

### Step C — what ChatGPT should do after receiving the Hyperdrive ID

Add to `wrangler.jsonc`:

```json
"hyperdrive": [
  {
    "binding": "HYPERDRIVE",
    "id": "<HYPERDRIVE_CONFIG_ID>"
  }
]
```

Then deploy through the existing `npm run deploy:cloudflare` path.

Do not put the database password in `wrangler.jsonc`, GitHub, frontend code, or chat.

---

## 10. Worker Product API status

### Public catalog routes — implemented

Files:

- `worker/hyperdrive.js`
- `worker/product-catalog.js`

Routes:

- `/__webcanbe/api/product/catalog/browse`
- `/__webcanbe/api/product/catalog/detail`

Properties:

- uses retained PostgreSQL Listing/Release tables
- only published/available/active catalog state is exposed
- immutable release provenance is retained
- missing Hyperdrive fails closed with 503
- no fake marketplace state is generated by the Worker

### Private read routes — implemented and merged

Routes:

- `/__webcanbe/api/workspaces`
- `/__webcanbe/api/product/purchases`
- `/__webcanbe/api/product/workspace-projects/list`
- `/__webcanbe/api/account/get`
- `/__webcanbe/api/account/update`

Implementation:

`worker/product-private.js`

Authority:

- first-party live DB session required when Hyperdrive exists
- CSRF required
- purchases scoped to `session.userId`
- working-copy reads require:
  - materialization owner
  - active workspace membership
  - owner/editor role

These routes are intentionally read-only.

### Private mutation routes — still closed

Do **not** prematurely open:

- test entitlement grant
- working-copy materialization mutation
- payment mutations
- seller mutations
- operator/control mutations

until Hyperdrive is live and DB-backed production smoke passes.

---

## 11. Safe production read-only frontend switch

Implementation:

- `productionReadProductMode()`
- `productReadMode()`

Activation marker:

`<meta name="wcb-product-read-mode" content="hosted">`

**This marker is intentionally absent from production right now.**

When later activated after Hyperdrive smoke, it affects only read-oriented
surfaces that already have server routes:

- AppShell workspace selector
- Dashboard/product library reads
- Purchases
- Working-copy list
- Account profile read/update in the existing Settings UI

It does not activate:

- Seller
- Control
- Checkout
- test entitlement grants
- materialization mutations
- payment mutations

Those continue to require the full `hostedProductMode()`.

This separation prevents a single frontend flag from exposing unfinished
mutation APIs.

---

## 12. Browser product client status

Client:

`src/hostedProductClient.ts`

It already contains methods for:

- public catalog browse
- catalog detail
- purchases
- workspace projects
- workspaces
- materialization
- seller application/studio
- source projects
- control

Important:

Some client methods exist before their production Worker routes are enabled. Do not mistake “client method exists” for “production backend is live”.

The currently live/implemented Worker scope is the source of truth.

---

## 13. Latest verification state

Latest `main` GitHub Actions run checked for this snapshot:

Run ID:

`35412569320`

Result:

**PASS**

Successful gates:

- dependency install
- focused inherited Phase 4/5 tests
- Worker syntax validation
- Vite production build
- Wrangler Worker bundle dry-run

Repository dependency audit at the same time reported no npm vulnerabilities during CI install.

---

## 14. Repository hygiene already fixed

The old Framer-export README was removed.

Current `README.md` describes the real:

- React/Vite stack
- Cloudflare Worker deployment
- Google/Firebase authentication
- PostgreSQL/Supabase architecture
- Phase 5 references

Added:

`.env.example`

It contains only public Vite/Firebase variable names.

Updated `.gitignore` to ignore:

- `.env`
- `.env.local`
- `.env.*.local`

while allowing `.env.example`.

No server secret values belong in `VITE_*` variables.

---

## 15. Route/error hardening now complete

### Route metadata / canonical status

- public SPA routes synchronize title/description/canonical/OpenGraph/Twitter metadata
- aliases canonicalize: `/templates`→`/browse`, `/pricing`→`/plans`, `/privacy`→`/policy`
- private/unknown client routes use `noindex, nofollow`
- unknown HTML navigation gets a real HTTP 404 from the Worker while still rendering the React NotFound surface


- canonical production `/dashboard-preview` is blocked
- normal `/dashboard` remains protected
- unknown paths use the real 404 surface
- unexpected React render failures use a top-level recoverable 500 surface
- no dashboard visual redesign was introduced

---

## 15. Production authentication details worth preserving

### Google Worker routes

- `/__webcanbe/auth/start`
- `/__webcanbe/auth/callback`
- `/__webcanbe/auth/session`
- `/__webcanbe/auth/logout`

### Firebase exchange

- `/__webcanbe/auth/firebase-exchange`

### Security properties

- same-origin POST checks
- Content-Type validation
- Secure HttpOnly cookies
- SameSite cookies
- CSRF token
- Google PKCE
- Google nonce/state
- Google ID-token signature/issuer/audience verification
- Firebase RS256 signature verification
- Firebase issuer/audience/expiry/iat/auth_time validation
- bounded request/token sizes
- no GitHub OAuth secret in frontend/Cloudflare
- no Firebase client state accepted as backend product authority

---

## 16. User-wide session revocation

- backend route prepared: `POST /__webcanbe/api/account/sessions/revoke-all`
- requires live DB session + CSRF
- revokes all active `wcb_sessions` for the internal user
- clears current first-party cookie
- client method: `HostedProductClient.revokeAllSessions()`
- UI is intentionally not activated until Hyperdrive/session smoke passes
- full destructive account deletion remains intentionally deferred until retention rules are defined

---

## 16. Production smoke sequence after Hyperdrive is connected

Run in this order.

### A. Google account

1. Log out fully.
2. Log in with Google.
3. Confirm redirect to `/dashboard`.
4. Confirm DB rows appear for:
   - `wcb_identity_accounts`
   - `wcb_sessions`
   - `wcb_workspace_members`
5. Refresh browser.
6. Confirm session persists.
7. Call/read:
   - Workspaces
   - Purchases
   - Working copies
8. Confirm expected initial result:
   - one owner workspace
   - zero purchases for a new user
   - zero working copies
9. Log out.
10. Confirm the DB session becomes inactive and protected route redirects.

### B. GitHub via Firebase

1. GitHub popup login.
2. Firebase ID token exchange.
3. Same first-party DB session behavior as Google.
4. Refresh persistence.
5. Logout.

### C. Email/password

Test both:

- new signup
- existing login

Confirm both enter the same first-party DB session path.

### D. Public catalog

With an empty catalog DB:

- browse should return an empty real list, not 503
- detail for unknown listing should return 404
- no local/demo fallback should masquerade as DB data when hosted mode is active

---

## 17. Baseline response security headers and crawler policy

Implemented in:

- `worker/security-headers.js`
- `public/robots.txt`
- `public/sitemap.xml`

Current response headers:

- HSTS `max-age=31536000`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- static referrer policy `strict-origin-when-cross-origin`
- authenticated dynamic endpoints remain `no-referrer`
- permissions policy disables camera/microphone/geolocation
- COOP is `same-origin-allow-popups` for Firebase/GitHub popup compatibility

Do not change COOP to strict `same-origin` without retesting popup auth.

CSP is **enabled** after the retained-landing compatibility inventory. The enforced
policy keeps same-origin script authority, blocks inline/eval scripts, and retains
inline styles only because the selected landing requires them. Do not loosen or
replace this policy without rerunning the compatibility regression.

Crawler policy:

- private/authenticated/API routes are disallowed in `robots.txt`
- private/authenticated SPA responses also receive `X-Robots-Tag: noindex, nofollow`
- sitemap contains only public routes
- `/dashboard-preview` is also excluded from crawling even though the route
  remains available for development verification

---

## 18. Abuse rate limiting status

Cloudflare Workers Rate Limiting bindings are now configured in `wrangler.jsonc`:

- `AUTH_RATE_LIMITER`
  - namespace: `136713667501`
  - 30 calls / 60 seconds per key
- `PUBLIC_API_RATE_LIMITER`
  - namespace: `136713667502`
  - 180 calls / 60 seconds per key
- `PRIVATE_API_RATE_LIMITER`
  - namespace: `136713667503`
  - 180 calls / 60 seconds per key

Behavior:

- Google auth start/callback and Firebase exchange use a SHA-256 fingerprint of Cloudflare-provided IP + bounded User-Agent + route scope.
- The raw IP/User-Agent are not stored in the key output and are not logged by Webcanbe telemetry.
- Public catalog/readiness use the same hashed anonymous strategy.
- Private product/account API calls are limited by authoritative DB `userId` only **after** session and CSRF validation.
- Over-limit response: HTTP 429 + `Retry-After: 60`.
- If the Cloudflare rate-limit service itself errors/unavailable, Webcanbe fails open so abuse protection does not become an availability dependency.
- Rate limiting is an extra abuse layer only; it never replaces authentication, CSRF, membership, entitlement, seller, payment, or operator authority.
- Cloudflare's API is local/eventually consistent, so it must never be used for billing/accounting or exact product-state counters.

Implementation:

- `worker/rate-limit.js`
- `src/phase5-rate-limit.test.ts`
- `worker/rate-limit.test.js`

## 19. Next implementation sequence after live DB smoke

### P5.2 continuation

1. account/session lookup from real DB
2. real workspace selector
3. remove remaining production demo/local arrays where real API exists
4. real empty/error/loading states
5. working-copy materialization mutation with strict entitlement/workspace authority

### P5.3

Account/workspace persistence:

- provider-independent account profile
- verified provider linking rules
- account deletion
- session revocation
- persistent workspace recovery

### P5.4

Marketplace purchase chain:

- immutable Listing/Release
- server-created purchase
- verified payment webhook
- atomic/idempotent entitlement
- working-copy materialization
- reversal/refund behavior

### P5.5

Choose and integrate actual payment provider.

No payment-provider decision should silently create a parallel entitlement model.

### P5.6

Real editor persistence:

- open real materialized project
- Visual/Code/Split = same source
- save revision
- history
- conflict/stale revision detection
- reload
- export

### P5.7

Connect existing seller pipeline:

- application
- immutable submission
- operator review
- assessment
- release promotion
- Listing publication
- Creator Studio real state

### P5.8

Launch hardening:

- remove/restrict development preview routes
- auth rate limits
- security headers/CSP
- failure UX
- browser/mobile pass
- accessibility
- performance
- observability
- backup/restore
- rollback drill
- legal/data-handling review
- sitemap/robots/metadata
- clean-account full production smoke

---

## 20. Things not to redo

A future session should **not** restart or repeat these unless there is evidence they are broken:

- Google OAuth setup
- Firebase GitHub/Email implementation
- transparent Webcanbe favicon/logo work
- dashboard redesign
- dashboard menu reconstruction
- dashboard dropdown animation work
- Cloudflare Worker conversion
- Cloudflare OAuth secret forwarding
- Supabase project creation
- Phase 3 schema design
- Supabase browser-role hardening
- runtime role creation
- private read Worker adapter design

Continue from Hyperdrive connection.

---

## 21. Key files to read first in a new session

In order:

1. `docs/phase5-resume-2026-09-19.md` — this document
2. `docs/phase5.md`
3. `docs/current-handoff.md`
4. `docs/project-record.md`
5. `wrangler.jsonc`
6. `worker/index.js`
7. `worker/postgres-session.js`
8. `worker/product-catalog.js`
9. `worker/product-private.js`
10. `src/hostedProductClient.ts`
11. `src/firebaseAuth.ts`
12. `deployment/hosted/postgres.sql`
13. `deployment/hosted/postgres-supabase-hardening.sql`

---

## 22. Secret-handling rule

Never request or store in chat/GitHub:

- Google OAuth client secret
- Hyperdrive/Supabase database password
- payment-provider secret keys
- webhook signing secrets
- any future operator/runner credential

For the immediate next step, the only value ChatGPT needs from the user is the **Cloudflare Hyperdrive configuration ID** after the user privately creates the DB password/configuration.

---

## 23. Resume instruction for the next ChatGPT session

If the user says “continue Phase 5” after a session break:

1. fetch/read this file from `main`
2. verify current `main` has not diverged materially
3. inspect `docs/current-handoff.md`
4. ask only whether Hyperdrive has been created **if no Hyperdrive binding exists in `wrangler.jsonc`**
5. if the user provides a Hyperdrive configuration ID, add the `HYPERDRIVE` binding, deploy, and run the production smoke sequence
6. do not touch the dashboard UI
7. update all Phase 5 markdown records after each completed slice


---

## Database backup / recovery operations

Current Supabase project is on Free and must not rely on managed automatic backups.

Prepared operator tooling:
- `scripts/db/backup.mjs`
- `scripts/db/verify-backup.mjs`
- `npm run db:backup`
- `npm run db:backup:verify -- <archive>`
- runbook: `docs/operations/database-backup-restore.md`

Backup properties:
- data-only `public.wcb_*`
- secret URL not passed in command-line args
- SHA-256 checksum written next to archive
- `pg_restore --list` verification
- `backups/` is gitignored

Recovery rule:
- do not first restore over the only production DB
- restore into a separate recovery DB/project
- apply repo schema/migrations first
- validate security/readiness/auth/product state
- only then cut Hyperdrive over


---

## Cloudflare Worker rollback operations

Prepared:
- `scripts/cloudflare-rollback.mjs`
- `docs/operations/cloudflare-rollback.md`
- `npm run deploy:versions`
- `npm run deploy:deployments`
- `npm run deploy:rollback -- <VERSION_ID>`

Guardrails:
- exact UUID-shaped version ID required
- `WEBCANBE_ROLLBACK_CONFIRM=ROLLBACK_PRODUCTION` required
- no automatic “previous version” selection
- Worker rollback and DB recovery are separate procedures

Important:
- Cloudflare rollback does not rewind PostgreSQL rows/schema or external provider state.
- A controlled live production rollback drill is still pending.


---

## Committed-secret CI guard

Prepared and active on `main`:
- `scripts/security/scan-secrets.mjs`
- `npm run security:secrets`
- Phase 5 CI runs it before tests/builds

Scans all tracked files for:
- secret-bearing files such as committed .env/.dev.vars/private-key/backup artifacts
- PEM private keys
- common live GitHub/Stripe/OpenAI/Slack token shapes
- PostgreSQL URLs containing a real embedded password
- unsafe Vite public environment names carrying SECRET/PASSWORD/PRIVATE_KEY/SERVICE_ROLE/ACCESS_TOKEN

Historical Phase 2 compatibility fixtures intentionally contain fake `VITE_SECRET` / `VITE_ACCESS_TOKEN` names. Only the VITE-name heuristic is skipped for those narrow fixture paths; actual credential patterns are still scanned there.

Latest branch verification with the scanner enabled passed the secret scan, focused Phase 4/5 tests, syntax checks, Vite build and Wrangler dry-run.
