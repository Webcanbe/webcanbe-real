# Webcanbe Phase 5 — Launch Plan

Status date: 2026-09-19 KST  
Production branch: `main`  
Baseline commit when this plan was written: `fc24f43b0a7a89c84c9d84e7c428ccdac12ade11`

## Recovery / session continuity

If work resumes in a new session, read `docs/phase5-resume-2026-09-19.md` first. It is the authoritative snapshot of the current implementation, infrastructure, completed work, frozen UI rules, and exact Hyperdrive resume point.

## Phase 5 goal

Turn the current production-looking Webcanbe surface into a real launchable product without another UI redesign.

The dashboard UI is frozen unless an explicit bug or user-requested change requires touching it. Phase 5 is now functionality, persistence, authority, payments, editor reliability, and launch hardening.

## Current production baseline

### Done

- [x] React 19 + TypeScript + Vite 6 frontend.
- [x] Cloudflare Workers + Static Assets production deployment.
- [x] Production branch is `main`.
- [x] Cloudflare build: `npm run build`.
- [x] Cloudflare deploy: `npm run deploy:cloudflare`.
- [x] Public landing and retained dashboard UI are deployed.
- [x] Google OAuth Authorization Code + PKCE runs through the Cloudflare Worker.
- [x] Google session uses signed Secure HttpOnly cookies and CSRF-protected logout.
- [x] Firebase Web SDK is installed.
- [x] Firebase GitHub login uses `GithubAuthProvider` + `signInWithPopup`.
- [x] Firebase Email/Password signup uses `createUserWithEmailAndPassword`.
- [x] Firebase Email/Password login uses `signInWithEmailAndPassword`.
- [x] Firebase config is read only from the existing `VITE_FIREBASE_*` build variables.
- [x] No GitHub OAuth Client ID/Secret is stored in frontend code or Cloudflare variables.
- [x] Successful login returns to the existing `/dashboard`.
- [x] Dashboard UI is frozen at the current approved state.
- [x] Phase 4/5 focused tests, Worker syntax check, and production Vite build pass on the current auth integration.

### Important current boundary

The repository Worker now implements the authentication boundary including `/__webcanbe/auth/firebase-exchange` and has a Workers-compatible public catalog route for:

- `/__webcanbe/api/product/catalog/browse`
- `/__webcanbe/api/product/catalog/detail`

GitHub/Email Firebase identity is verified server-side and exchanged for the first-party Webcanbe session before protected production access.

The public catalog adapter preserves the existing PostgreSQL Listing/Release queries and release provenance, and fails closed with `503` when no Hyperdrive database binding exists. Read-only Workspaces, Purchases/Entitlements, Working-copy list, and Account profile routes are implemented behind the DB-session + CSRF boundary. Private product mutations, seller mutations, payment routes, and control mutations remain intentionally closed.

Production route activation is now observed: direct GET probes to both the Firebase exchange and public catalog routes return Worker-level 403 responses instead of the prior SPA 404. Full provider sign-in smoke still remains.

---

## Execution order

### P5.1 — Unify production identity and first-party sessions

Priority: **first**

Goal: Google, GitHub, and Email/Password all end in the same server-authoritative Webcanbe session boundary.

- [x] Add a Firebase-session exchange endpoint to the Worker.
- [x] Browser sends a Firebase ID token after GitHub/Email login.
- [x] Worker verifies Firebase JWT signature, issuer, audience, expiry, issued-at/auth-time, and project ID.
- [x] Worker mints the same Webcanbe Secure HttpOnly session used by the product.
- [x] Protected production frontend gates now require the first-party server session; persistent Firebase state is only used to refresh/exchange that server session.
- [x] Define canonical session identity fields (`identityProvider`, `providerSubject`, prefixed `sub`, `signInProvider`) for Google/Firebase subjects.
- [x] Logout clears the first-party Webcanbe session and Firebase client state together.
- [ ] Complete live production provider smoke: Google, GitHub, email signup/login, persistent refresh, logout, and direct `/dashboard`. The Firebase exchange route is now confirmed live at the Worker boundary; cryptographic JWT tests, auth-route tests, Worker syntax, Vite build, and Wrangler bundle dry-run pass.

Exit gate: every provider reaches one server-authoritative session contract. **Code/CI and production route activation are complete; interactive GitHub/Email provider smoke remains.**

### P5.2 — Activate the real hosted product API

Priority: **second**

Architecture finding (2026-09-19):
- The retained authoritative implementation already exists as `HostedProductController + PostgresProductDomainStore + PostgresIdentityStore/PostgresAccess`.
- It is currently composed inside the private Node HTTPS hosted-editor runtime and is explicitly marked not launch-ready.
- Do **not** create a second catalog/purchase/workspace schema in Cloudflare.
- The preferred launch path is to keep the existing PostgreSQL schema/domain logic and add a Workers-compatible thin boundary. Cloudflare Hyperdrive officially supports PostgreSQL with `pg`; the repository already uses a compatible `pg` version.
- This step requires a real managed PostgreSQL database + Hyperdrive binding before production product routes can be enabled.

Goal: replace local/demo product state with real server data.

- [ ] Deploy the complete existing `/__webcanbe/api/product/*` boundary.
- [x] Build the Worker/Hyperdrive connection seam without creating a second data model.
- [x] Provision a real managed PostgreSQL database in Supabase Seoul (`webcanbe-production`).
- [x] Apply the retained authoritative Phase 3 PostgreSQL schema (36 Webcanbe tables + triggers/functions).
- [x] Remove all `anon`/`authenticated` privileges from Webcanbe tables/functions and lock future default grants.
- [x] Fix mutable `search_path` warnings on Webcanbe PostgreSQL functions.
- [x] Create a non-login `webcanbe_runtime` server role with bounded DML privileges.
- [x] Prepare dedicated `webcanbe_hyperdrive` NOLOGIN role inheriting `webcanbe_runtime`.
- [ ] Enable LOGIN with an operator-generated password, then create/bind Cloudflare Hyperdrive.
- [x] Prepare a PostgreSQL-backed Worker session adapter using the existing `wcb_identity_accounts`, `wcb_sessions`, `wcb_workspace_members`, and `wcb_disabled_users` authority tables.
- [x] Preserve issuer+subject identity mapping without unsafe automatic email linking; new verified identities can atomically receive an internal UUID + owner workspace once DB mode is activated.
- [x] Expose authenticated workspace lookup through the Worker DB-session boundary.
- [x] Implement Workers-compatible catalog browse/detail using the retained Phase 3 SQL and public response contract.
- [x] Route public catalog requests through the Worker and fail closed with 503 while the database binding is absent.
- [x] Expose read-only purchases/entitlements through a user-scoped DB query.
- [x] Expose read-only working-copy list with active workspace membership checks.
- [ ] Expose working-copy materialization mutation after live Hyperdrive/session verification.
- [ ] Preserve server-side workspace/user authorization on every mutation.
- [x] Prepare a separate read-only production frontend mode for Workspaces, Purchases/Working copies, Dashboard library data, and Account profile without activating seller/control/checkout mutations.
- [ ] After Hyperdrive smoke passes, activate it with `<meta name="wcb-product-read-mode" content="hosted">`.
- [ ] Remove production dependence on local demo arrays where a real API exists.
- [ ] Add explicit loading, empty, permission-denied, and failure states.
- [x] Add unit coverage for published/available/active filtering, immutable release provenance, filter validation, and missing-Hyperdrive failure.
- [x] Add real `wrangler deploy --dry-run` bundling to CI so Workers/pg compatibility is verified before merge.

Exit gate: dashboard, Marketplace, Purchases, and project lists can be driven by real persisted data.

### P5.3 — Account and workspace persistence

- [x] Persist Webcanbe account profile independent of provider (`wcb_user_profiles`).
- [x] Persist workspace ownership/membership; first verified DB identity can atomically receive an owner workspace.
- [ ] Link provider identities to the same internal account only through explicit verified rules.
- [ ] Account page reads real email/provider/session information in production. Existing Settings UI is already wired to the account API behind the inactive read-only production switch.
- [ ] Workspace selector reads real workspaces in production. Code is prepared behind the inactive read-only production switch.
- [ ] Add account deletion/session revocation path.
- [x] Keep provider credentials/tokens out of Webcanbe browser persistence beyond what Firebase itself requires.

Exit gate: a user can leave, return, sign in again, and recover the same account/workspaces.

### P5.4 — Marketplace → purchase → entitlement → working copy

- [ ] Marketplace only exposes published immutable Listings.
- [ ] Detail page resolves exact release/version provenance.
- [ ] Checkout creates a server-side pending purchase.
- [ ] Payment success is accepted only from a verified provider webhook.
- [ ] Entitlement grant is atomic/idempotent.
- [ ] Purchases page reads real entitlements.
- [ ] “Create working copy” materializes from the purchased immutable release.
- [ ] Duplicate webhook/retry cannot double-grant.
- [ ] Refund/reversal path has defined entitlement behavior.

Exit gate: a real user can buy one real listing and create one real editable working copy without fake state.

### P5.5 — Payment provider production integration

Decision gate: choose the actual provider before implementation.

Required regardless of provider:

- [ ] Hosted/secure checkout.
- [ ] Server-created checkout session/payment intent.
- [ ] Verified signed webhook.
- [ ] No amount, product, seller, or entitlement authority from client input.
- [ ] Idempotency on create and webhook processing.
- [ ] Refund/reversal handling.
- [ ] Receipt/purchase record.
- [ ] Test mode end-to-end before production credentials.

Exit gate: money state and product entitlement state cannot diverge silently.

### P5.6 — Real editor/project persistence

- [ ] Open a materialized working copy from the real project store.
- [ ] Visual / Code / Split operate on the same canonical source revision.
- [ ] Save creates durable revision/history state.
- [ ] Autosave or explicit-save policy is defined and visible.
- [ ] Detect stale/conflicting revisions.
- [ ] Reload restores the same source and history.
- [ ] Export produces a normal standalone codebase.
- [ ] No hosted runtime dependency is required by exported code.
- [ ] Large-project and failure recovery tests.

Exit gate: edit → save → reload → continue → export works on a real persisted project.

### P5.7 — Creator/Seller production connection

The Phase 3 backend foundations already exist; Phase 5 connects them to the live product surface.

- [ ] Seller application UI uses real state.
- [ ] Submission captures immutable source provenance.
- [ ] Operator review uses real authority.
- [ ] Assessment job/result flow remains fenced and immutable.
- [ ] Passed assessment promotion remains explicit.
- [ ] Listing publication remains explicit.
- [ ] Creator Studio reads real submissions/listings.
- [ ] No fake sales, review, approval, or publication state remains in production.

Exit gate: a creator can submit a real project and an authorized operator can publish a real Listing through the retained pipeline.

### P5.8 — Launch hardening

- [ ] Remove or restrict development-only routes such as public dashboard preview before public launch.
- [ ] Confirm Firebase Authorized Domains includes production domains.
- [ ] Confirm Google OAuth redirect/origin/branding verification.
- [x] Baseline security headers on Worker/API/static responses: HSTS, nosniff, DENY framing, strict referrer policy, restricted camera/mic/geolocation, and popup-compatible COOP.
- [x] CSRF/origin protections on authenticated Worker POST boundaries.
- [ ] Add CSP only after a dedicated retained-landing compatibility inventory/pass.
- [ ] Add auth/API abuse rate limiting.
- [ ] Auth abuse/rate limits.
- [ ] 404/500 and failed-network UX.
- [ ] Mobile pass.
- [ ] Safari/Chrome/Firefox pass.
- [ ] Accessibility keyboard/focus pass.
- [ ] Performance/Lighthouse pass on landing and app shell.
- [ ] Production logging/observability with secrets and personal data redacted.
- [ ] Database backup/restore procedure.
- [ ] Rollback procedure tested.
- [ ] Legal pages match actual data handling.
- [x] Add `robots.txt` that excludes authenticated/private routes and `/__webcanbe/`.
- [x] Add public-only `sitemap.xml`.
- [x] Webcanbe favicon/Apple touch icon and base OG/Twitter metadata are in place.
- [ ] Final per-route metadata/canonical audit before launch.
- [ ] Full production smoke test with a clean account.

Exit gate: one clean user can sign up, sign in, browse, purchase, materialize, edit, save, reload, export, and sign out on production without manual intervention.

---

## What is intentionally not a Phase 5 blocker

Unless separately promoted into scope:

- Phone login.
- Dashboard redesign.
- Theme/settings drawer implementation.
- Decorative UI work.
- Enterprise/team administration beyond what launch needs.
- Advanced AI editing beyond the source-authority guarantees already required.
- Unrelated marketing experiments.

## Operating rule from this checkpoint

1. Do not redesign the approved dashboard while implementing Phase 5.
2. Before a risky product/backend change, create a rollback branch.
3. Keep `main` production-deployable.
4. Every completed Phase 5 slice must update:
   - `docs/phase5.md`
   - `docs/current-handoff.md`
   - `docs/project-record.md` when the change is architecturally meaningful.
5. No fake production state: disabled or honest empty states are preferred to simulated success.
6. Client state is never authority for account, money, entitlement, seller, release, publication, or project ownership.

## Immediate next task

**Enable LOGIN for the prepared `webcanbe_hyperdrive` role, create the Cloudflare Hyperdrive binding, then run live DB-session/catalog/private-read smoke.**

Connected infrastructure audit:
- Supabase organization discovered: `Webcanbe`.
- Organization plan: Free.
- Supabase project created: `webcanbe-production` (`ap-northeast-2`, Seoul).
- Authoritative schema migration applied successfully.
- Supabase security advisors are currently clean after server-only privilege hardening.
- Reported project cost: **$0/month**.
- Recommended region for the current Korea-based launch path: `ap-northeast-2` (Seoul).
- Production Supabase project creation and authoritative schema migration are complete.

Do not start payments or private product mutations until the durable DB session boundary is activated.
