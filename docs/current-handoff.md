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