# Webcanbe Phase 5 — Session Recovery Snapshot

Snapshot date: **2026-09-19 KST**  
Code baseline before this recovery update: `3c383c6bb0dc0b63df2a03143606f5c575ffbb3f`  
Repository: `Webcanbe/webcanbe-real`  
Production branch: `main`  
Production domain: `https://webcanbe.com`

> This file exists so a new ChatGPT session can resume Phase 5 without re-deciding architecture or repeating finished work. Read this file first, then `docs/phase5.md`, `docs/current-handoff.md`, and `docs/project-record.md`.

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
