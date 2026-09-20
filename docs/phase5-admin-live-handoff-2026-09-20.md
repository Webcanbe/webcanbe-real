# LIVE BIGPERSON ENROLLMENT SCREEN CHECKPOINT — 2026-09-20 KST

- User has reached the real production route `/_ops/keystone-7f31`.
- Production UI visibly shows the Bigperson Operations gate:
  - `Three factors are required every time.`
  - privileged factor input
  - `Verify all 3 factors`
  - `First Bigperson: register passkey`
- Current DB state before enrollment remains:
  - active Google first-party session: 1
  - active Bigperson: 0
  - Bigperson security rows: 0
  - active Bigperson passkeys: 0
- Exact next action:
  1. enter the same privileged factor that was used to derive the configured bootstrap digest;
  2. click `First Bigperson: register passkey`;
  3. complete the browser/macOS WebAuthn registration prompt;
  4. then verify DB rows before attempting a normal Control read.
- Do **not** use `Verify all 3 factors` before first passkey enrollment because there is no enrolled Bigperson passkey yet.
- If WebAuthn registration is rejected, capture the exact UI/server error and inspect credential device type/backed-up policy before changing unrelated auth/Hyperdrive state.

---

# Webcanbe Phase 5 — Admin / Hyperdrive / Live Production Handoff

Status timestamp: **2026-09-20 KST**  
Repository: `Webcanbe/webcanbe-real`  
Production branch: `main`  
Canonical code baseline (last non-documentation change): `12ca43d3c0d58848e81bf1d657da6d48ae4f75e1`  
Production domain: `https://webcanbe.com`

> This is the current recovery document. Read this file first before older Phase 5 handoffs.
> Older files contain historically correct checkpoints but may still say Hyperdrive is unbound or Control is not live. Those statements are superseded by this document.

---

## 1. Exact current state

The infrastructure and Admin implementation are live.

Verified production state at this checkpoint:

- Cloudflare Worker `webcanbe-real` is deployed.
- Cloudflare Hyperdrive is live.
- Hyperdrive binding name is `HYPERDRIVE`.
- Hyperdrive configuration is `webcanbe-production-db`.
- Hyperdrive configuration ID is `7f537011fc1a4303aac7aff9601a1699`.
- Production DB/schema readiness returns ready.
- Public authoritative catalog route returns HTTP 200.
- Production Control switch is live.
- Production product read mode is still intentionally closed.
- Production product mutation mode is still intentionally closed.
- Hidden Control route is `/_ops/keystone-7f31`.
- User has successfully reached the live Bigperson Operations three-factor gate in production.
- Current production DB state:
  - active first-party sessions: **1**
  - active Google-backed first-party sessions: **1**
  - active Bigpersons: **0**
  - Bigperson security rows: **0**
  - active Bigperson passkeys: **0**
  - live unused Bigperson challenges: **0**

Current UI visible in production:

- heading: `Three factors are required every time.`
- factor input is rendered
- `Verify all 3 factors` action is rendered
- `First Bigperson: register passkey` action is rendered

Therefore the next live step is **not** Hyperdrive, OAuth setup, Firebase setup, DB schema setup, Control routing, or Cloudflare deployment. The next live step is the first Bigperson enrollment ceremony.

---

## 2. Immediate next action

From:

`https://webcanbe.com/_ops/keystone-7f31`

perform:

1. stay signed in with the allowlisted Google-backed first-party session;
2. enter the already configured Bigperson privileged factor;
3. choose `First Bigperson: register passkey`;
4. complete the WebAuthn registration ceremony;
5. verify production DB rows:
   - `wcb_product_operators`: one active `bigperson`
   - `wcb_bigperson_security`: one row
   - `wcb_bigperson_passkeys`: one active row
   - registration challenge consumed;
6. then perform one `Verify all 3 factors` Control read;
7. verify the Control read succeeds using:
   - current Google-backed session
   - privileged factor
   - enrolled passkey.

After that, the Admin/Bigperson production E2E gate is closed.

### Current WebAuthn behavior that must not be forgotten

The present implementation deliberately rejects a credential when:

- `credentialDeviceType !== "singleDevice"`, or
- `credentialBackedUp === true`.

Authentication also rejects an enrolled credential later if it is not stored as single-device / non-backed-up.

That means a normal cloud-synced passkey may be rejected by the current policy. If first registration fails at the WebAuthn verification step, inspect the returned error before changing anything. Do not restart Hyperdrive or auth work.

---

## 3. Current canonical main and verification

Canonical code baseline (documentation-only commits follow it on `main`):

`12ca43d3c0d58848e81bf1d657da6d48ae4f75e1`

Current main verification:

- Phase 5 UI verify `35501800213`: **PASS**
- Phase 5 Bigperson checkpoint verify `35501800204`: **PASS**
- Phase 5 durable editor/export verify `35501800209`: **PASS**
- Phase 5 production smoke `35501834873`: **PASS**

Previous live Control deployment proof:

- production smoke `35501017695`: **23/23 PASS**
- confirmed:
  - root 200
  - HSTS
  - nosniff
  - frame deny
  - popup-compatible COOP
  - CSP
  - no unsafe eval
  - request IDs
  - real 404/noindex handling
  - dashboard noindex
  - robots/sitemap
  - `wcb-control-mode=hosted` present in live HTML
  - product read/mutation switches absent
  - DB ready
  - schema ready
  - catalog authoritative DB read 200.

---

## 4. Recent canonical commit progression

Important checkpoints in order:

- `417e4c11ef912e92e2ec3153ec6b3fcb6b653ddb`
  - Admin + durable editor integration baseline
  - full Phase 5 verification green
- `af716033089b9e4cec80559b908dc51d40888583`
  - FK index hardening/main production checkpoint
- `f63d1c836c8a9ed506528b0436be47d94e2becfa`
  - Hyperdrive binding and normal Bigperson runtime vars committed
- `17a97df78730b9433ccb08f293bcc7a3de019290`
  - production smoke changed to require DB `ready`
- `d10dd3f617537fc47ca87820194b8d8071b233f7`
  - production Control frontend switch activated and required secret-name validation added
- `1d0e46ffaed2d75e6387f1e42534296835f141d3`
  - live Control deployment smoke gate added
- `d83731bedfa749074aef7c37795a3d2ab66b199e`
  - Cloudflare TypeScript runtime compatibility fix
- `12ca43d3c0d58848e81bf1d657da6d48ae4f75e1`
  - DB session `created_at` + auth provider provenance fixes and regressions.

---

## 5. Cloudflare / Wrangler production configuration

Current `wrangler.jsonc` contains:

- Worker name: `webcanbe-real`
- Worker entry: `./worker/index.js`
- `nodejs_compat`
- static assets from `./dist`
- SPA fallback
- worker-first handling
- rate-limit bindings:
  - `AUTH_RATE_LIMITER`
  - `PUBLIC_API_RATE_LIMITER`
  - `PRIVATE_API_RATE_LIMITER`
  - `BIGPERSON_RATE_LIMITER`
- Bigperson rate limit: 5 requests / 60 seconds
- `WEBCANBE_CONTROL_MODE=enabled`
- configured Bigperson Google allowlist variable
- `HYPERDRIVE` → `7f537011fc1a4303aac7aff9601a1699`
- required runtime secret-name declarations for:
  - Google OAuth client ID
  - Google OAuth client secret
  - Bigperson factor pepper
  - Bigperson bootstrap factor salt
  - Bigperson bootstrap factor digest
- Worker bundle definitions:
  - `__filename`
  - `__dirname`

Do not remove the `define` entries without replacing the Ready analyzer runtime strategy. They are currently required because the canonical React analyzer imports TypeScript.

### Production Control frontend switch

`index.html` contains:

`<meta name="wcb-control-mode" content="hosted" />`

Production product switches intentionally remain absent:

- `wcb-product-read-mode`
- `wcb-product-mutation-mode`

This means Control can be live while the general product read/mutation activation remains closed.

---

## 6. Hyperdrive state

Production PostgreSQL role:

`webcanbe_hyperdrive`

Verified role state:

- LOGIN: true
- superuser: false
- create role: false
- create database: false
- member of `webcanbe_runtime`: true

Cloudflare Hyperdrive:

- configuration name: `webcanbe-production-db`
- database: PostgreSQL
- connection model: Direct/Public
- database name: `postgres`
- port: 5432
- dedicated DB role: `webcanbe_hyperdrive`
- caching: off
- Worker binding: `HYPERDRIVE`
- configuration ID: `7f537011fc1a4303aac7aff9601a1699`

Production readiness proves the Worker is actually using the binding. This is no longer a planned configuration.

---

## 7. Production Supabase project and migration history

Production project:

- name: `webcanbe-production`
- project ID: `kappcfofcobhudmeuzmt`
- region: `ap-northeast-2`
- PostgreSQL 17

Recorded migrations, in production order:

1. `20260919011315 webcanbe_phase3_authoritative_schema`
2. `20260919011359 lock_webcanbe_schema_to_server_only`
3. `20260919011451 create_server_only_webcanbe_runtime_role`
4. `20260919012300 prepare_hyperdrive_login_role`
5. `20260919013329 add_webcanbe_user_profiles`
6. `20260920064953 phase5_control_roles`
7. `20260920064957 phase5_bigperson_three_factor`
8. `20260920070349 phase5_fk_covering_indexes`
9. `20260920090828 phase5_session_created_at`
10. `20260920091425 phase5_session_auth_provider`

---

## 8. DB authority / browser access model

Current architecture remains server-authoritative:

Browser → Cloudflare Worker / Hyperdrive → PostgreSQL.

The browser is not granted direct product authority through Supabase.

Verified after privileged schema migration:

- Supabase `anon`: zero direct grants on Webcanbe `wcb_*` tables
- Supabase `authenticated`: zero direct grants on Webcanbe `wcb_*` tables
- `webcanbe_runtime`: bounded DML rights on Webcanbe tables
- `webcanbe_hyperdrive`: inherits `webcanbe_runtime`

The generic Supabase RLS warning should not be treated as proof of direct browser access. The retained design is server-only grants. Do not blindly enable RLS without redesigning the Worker/runtime role behavior.

---

## 9. FK / DB performance hardening

Supabase performance analysis found 21 foreign keys without covering indexes.

The repository added:

`deployment/hosted/postgres-phase5-fk-indexes.sql`

The canonical schema also includes the same set.

Production migration:

`20260920070349 phase5_fk_covering_indexes`

After application:

- uncovered Webcanbe FK count: 0
- remaining performance advisor findings were unused-index INFO findings before real traffic.

---

## 10. Bigperson platform authority model

Platform roles are separate from workspace roles.

Platform hierarchy:

`reviewer → admin → bigperson`

Workspace roles remain:

`owner / editor / viewer`

Authority rules:

- reviewer:
  - review/assessment-related authority
- admin:
  - seller/admin publication/TEST entitlement authority
- bigperson:
  - platform-role transitions
  - highest privileged Control authority

The final active Bigperson is protected by a PostgreSQL trigger so the final privileged authority cannot be silently removed, disabled, or demoted.

---

## 11. Bigperson mandatory three-factor design

Every privileged Control read/operation requires all three:

1. Google-backed first-party Webcanbe session
2. separate privileged factor
3. WebAuthn passkey proof

### Google factor

Bigperson ceremony requires:

- first-party DB session
- provider `google`
- Google issuer `https://accounts.google.com`
- verified Google subject
- verified email matching the configured Bigperson allowlist
- session creation freshness within the configured short Bigperson window.

The current active production session now has:

- `created_at`
- Google issuer
- `auth_provider=google`
- email verified
- allowlist match.

### Privileged factor

Factor derivation uses:

- PBKDF2
- SHA-256
- 600,000 iterations
- factor + NUL + pepper as key material
- bootstrap salt
- base64url digest

Cloudflare has separate configured values for:

- factor pepper
- bootstrap factor salt
- bootstrap factor digest

Important hardening added before first live Bigperson:

- bootstrap digest is mandatory;
- if the digest is missing, bootstrap fails closed;
- first registration no longer accepts any arbitrary factor merely because the digest is absent.

### WebAuthn passkey

Current implementation requires:

- user verification
- resident credential
- local-device preference
- ES256 / RS256
- one-time registration/authentication challenge
- 90-second challenge window
- exact origin/RP binding
- operation challenge bound to exact method/path/body
- currently requires single-device, not-backed-up credential.

---

## 12. Bigperson production schema

Production includes:

- `wcb_product_operators`
- `wcb_bigperson_security`
- `wcb_bigperson_passkeys`
- `wcb_bigperson_challenges`
- `wcb_operator_step_up_evidence`
- `wcb_control_audit`

The original Bigperson migration had a critical stale FK reference to nonexistent `wcb_users(id)`. It was fixed before production application to use:

`wcb_user_profiles(user_id)`

Challenge sessions bind to the real `wcb_sessions(session_id)`.

Bigperson table browser-role privileges are explicitly revoked and runtime access is granted through the server runtime role.

Current live state before first enrollment:

- active Bigperson: 0
- Bigperson security row: 0
- active Bigperson passkey: 0
- live registration challenge: 0

---

## 13. Privileged Control features implemented

Current privileged Operations implementation includes:

### Operator authority

- reviewer/admin/bigperson platform roles
- activate/deactivate privileged operators
- role transitions
- final-Bigperson database protection
- operator epoch changes.

### Session security

- bounded session list
- no cookie/token/hash exposure
- revoke individual first-party session
- audited session revocation.

### Seller application

- approve
- reject
- rejected intake cannot be silently reopened.

### Review

- immutable review decision
- approved-for-next-stage
- rejected
- immutable submission snapshot revalidation.

### Assessment

- admit approved submission to assessment
- recheck seller/snapshot/review provenance
- isolated assessment state.

### Release promotion

Admin+ can promote only a passed immutable assessment result.

Server rechecks:

- result
- assessment request
- submission
- review
- lease
- seller
- source/workspace/catalog provenance
- immutable snapshot integrity.

Creates:

- `wcb_project_releases`
- `wcb_seller_release_promotions`

### Listing publication

Admin+ can publish one promoted immutable release into one Listing.

Creates:

- `wcb_listings`
- `wcb_listing_publications`

Publication is one-way / provenance-bound.

### Ready qualification

Ready is **not** submitted by the browser.

Server derives from immutable release source with the retained canonical React compatibility analyzer.

Derived statuses:

- `ready`
- `partial`
- `code_only`

Browser/operator cannot supply score/status.

### TEST entitlement controls

Admin+ can:

- grant provider=`test` entitlement
- revoke TEST entitlement
- invalidate TEST entitlement

Payment-provider entitlement state is intentionally outside this mutation surface.

### Audit

Privileged operations append bounded audit evidence.

High-risk operations require fresh proof rather than trusting that the Control page is already open.

---

## 14. Ready analyzer / Cloudflare Worker deployment incident

The Worker Ready path imports the retained React source analyzer:

`src/webcanbe-engine/adapters/react/reactSourceAdapter.ts`

That analyzer imports TypeScript.

Initial production deployment failed during Cloudflare Worker version validation with:

`ReferenceError: __filename is not defined`

The stack reached:

- `node_modules/typescript/lib/typescript.js`
- `reactSourceAdapter.ts`

Cloudflare error code:

`10021`

This was **not** a Hyperdrive problem.

Fix:

Wrangler `define` supplies Worker-safe values for:

- `__filename`
- `__dirname`

This preserved the canonical Ready analyzer instead of replacing it with a weaker parser.

After the fix:

- UI CI PASS
- Bigperson CI PASS
- durable CI PASS
- Wrangler dry-run PASS
- production deployment succeeded
- live smoke eventually reached 23/23 PASS.

Do not delete this compatibility shim casually.

---

## 15. Hyperdrive cutover timeline

The Hyperdrive work went through several explicit gates.

### Before binding

- production readiness returned `database: unconfigured`
- catalog failed closed
- `webcanbe_hyperdrive` was NOLOGIN.

### Role activation / config

The dedicated role was enabled for LOGIN and a Cloudflare Hyperdrive configuration was created.

### Source config

`wrangler.jsonc` was updated with:

- normal Bigperson vars
- `HYPERDRIVE` binding
- no duplicate vars object
- no duplicate hyperdrive binding.

### Ready smoke

The production smoke expectation was upgraded from `either` to `ready`.

This intentionally failed while the production Worker still lacked the deployed binding.

### Live result

After production deployment:

- readiness status 200
- database ready
- schema ready
- catalog 200.

Hyperdrive work is complete.

---

## 16. Control activation timeline

Control has its own independent two-part production gate.

Worker:

`WEBCANBE_CONTROL_MODE=enabled`

Frontend:

`<meta name="wcb-control-mode" content="hosted" />`

The frontend meta was initially missing, so the hidden route could render the shell but production Control mode would remain disabled.

It was then added and a production smoke assertion was created:

`production Control switch is deployed`

The first smoke correctly failed while the latest HTML had not propagated.

After Cloudflare deployment and the TypeScript runtime fix, the assertion passed.

Current production Control activation is verified live.

---

## 17. Google OAuth / DB session incidents fixed

Two separate DB-session defects were found only after Hyperdrive became live.

### Defect 1: missing `created_at`

Observed behavior:

- Google OAuth succeeded
- DB session row was inserted
- browser returned to `/auth/complete`
- UI showed:
  `Your sign-in session could not be verified.`

Production DB inspection showed an active session existed.

Cause:

`resolveDatabaseSession()` selected `s.created_at`, but production `wcb_sessions` did not have a `created_at` column.

Fix:

Repository migration:

`deployment/hosted/postgres-session-created-at.sql`

Production migration:

`20260920090828 phase5_session_created_at`

Behavior:

- adds `created_at`
- backfills existing seven-day production sessions with `expires_at - interval '7 days'`
- adds default `clock_timestamp()`
- enforces NOT NULL.

Canonical `deployment/hosted/postgres.sql` was also fixed for fresh installs.

### Defect 2: missing `auth_provider`

After the timestamp fix, DB inspection showed:

- correct Google issuer
- verified allowlist-matching account
- `auth_provider=NULL`.

Cause:

`establishFirstPartySession()` sent issuer/subject/email/profile into `issueDatabaseSession()` but omitted `identity.provider`.

This would have broken the later Bigperson check:

`session.authProvider === "google"`

Fix:

- Worker now passes `provider: identity.provider`
- DB session adapter validates/normalizes provider
- existing known sessions are backfilled only from known issuer mappings.

Production migration:

`20260920091425 phase5_session_auth_provider`

Current active production session now has:

- active=true
- Google issuer
- `auth_provider=google`
- `created_at`
- valid expiry
- allowlist match.

---

## 18. Google / Firebase authentication architecture

Production auth supports:

### Google

Direct Worker OAuth flow:

- Authorization Code
- PKCE
- state
- nonce
- signed temporary login cookie
- server token exchange
- Google JWKS verification
- issuer/audience/nonce/email verification
- first-party Webcanbe session.

### GitHub / Email

Firebase Authentication frontend providers:

- GitHub popup
- email/password signup
- email/password login

Browser receives Firebase ID token.

Worker verifies the Firebase token server-side, then exchanges it into the same first-party Webcanbe session authority.

Firebase browser state is not accepted as product authority by itself.

Firebase Authorized Domains work was completed before this checkpoint.

---

## 19. First-party DB sessions

Canonical DB session authority now includes:

- session ID
- internal user ID
- creation time
- expiry
- active state
- token hash
- CSRF hash
- auth issuer
- auth subject
- auth provider.

Session token and CSRF are random 32-byte base64url values.

Browser cookie:

`__Host-wcb-session`

Properties include:

- Secure
- HttpOnly
- Path=/
- SameSite=Strict
- bounded lifetime.

The browser retrieves a rotated CSRF value through:

`POST /__webcanbe/auth/session`

Private operations are then same-origin + session + CSRF protected.

---

## 20. Production routes relevant to this handoff

Authentication:

- `/__webcanbe/auth/start`
- `/__webcanbe/auth/callback`
- `/__webcanbe/auth/firebase-exchange`
- `/__webcanbe/auth/session`
- `/__webcanbe/auth/logout`

Readiness:

- `/__webcanbe/ops/readiness`

Public catalog:

- `/__webcanbe/api/product/catalog/browse`
- `/__webcanbe/api/product/catalog/detail`

Private product/account:

- `/__webcanbe/api/workspaces`
- `/__webcanbe/api/product/purchases`
- `/__webcanbe/api/product/workspace-projects/list`
- `/__webcanbe/api/product/workspace-projects/materialize`
- `/__webcanbe/api/account/get`
- `/__webcanbe/api/account/update`
- `/__webcanbe/api/account/sessions/revoke-all`
- `/__webcanbe/api/account/identities/link/firebase`

Privileged Bigperson:

- `/__webcanbe/api/ops/bigperson/register/options`
- `/__webcanbe/api/ops/bigperson/register/verify`
- `/__webcanbe/api/ops/bigperson/operation/options`
- Control read/mutation routes under `/__webcanbe/api/ops/*`.

Hidden frontend route:

- `/_ops/keystone-7f31`

The path is not authorization. Server authority remains mandatory.

---

## 21. Durable editor / export proof integrated

The separate durable-editor proof was integrated into the current Admin line.

Proven behavior includes:

- accepted Code save persists as durable source revision;
- history transaction is durable;
- reopen/restart sees the same accepted revision;
- accepted bytes remain exact;
- Visual / Code / Split share the same canonical request/revision acceptance path;
- standalone export uses a fresh checkout;
- exported project independently builds;
- exported result excludes Webcanbe runtime state such as `.webcanbe`;
- exported package does not require Webcanbe runtime dependency;
- export remains behind independent-build validation and fresh authority.

Dedicated workflow:

`Phase 5 durable editor export verify`

Current main run:

`35501800209` PASS.

---

## 22. Production modes still intentionally closed

Even though Hyperdrive and Control are live, general production product activation is still deliberately staged.

Still closed:

- production product read mode meta
- production product mutation mode meta
- general materialization UI activation
- full seller hosted mutation activation
- payment checkout/payment-provider integration.

Do not turn on all product mutation surfaces merely because Control is live.

Activation sequence remains:

1. finish first Bigperson E2E;
2. verify DB-backed auth/session/private reads;
3. activate product read mode intentionally;
4. verify clean-account read flow;
5. activate mutation/materialization intentionally;
6. verify clean-account create/edit/save/reload/export E2E;
7. payment provider later.

---

## 23. Payment status

Production payment provider is not complete.

Still future work:

- actual provider selection/integration
- server-created checkout/payment intent
- verified payment webhook
- real commercial entitlement issuance
- seller payout/KYC
- full purchase E2E.

TEST entitlements are separate and already supported by Admin Control.

Do not confuse TEST entitlement tooling with production payment completion.

---

## 24. Seller / Creator Studio status

Backend seller/review/assessment/publication authority exists.

The retained Creator Studio UI still has surfaces that are intentionally not fully production-activated through general hosted product mode.

Backend authority already includes:

- seller application
- submissions
- review
- assessment admission/result lineage
- release promotion
- Ready
- Listing publication.

Admin Control can operate the privileged side of this pipeline.

---

## 25. Security / privacy hardening already present

Implemented launch hardening includes:

- HTTPS production
- HSTS
- nosniff
- frame deny
- popup-compatible COOP
- CSP
- no unsafe eval
- request IDs
- real unknown-route 404
- noindex for private routes
- dashboard noindex
- robots protection
- sitemap public-route filtering
- same-origin POST checks
- CSRF
- bounded request sizes
- rate limiting
- first-party authority
- server-only DB grants
- session revocation
- privileged audit
- exact-body-bound Bigperson high-risk challenges
- no client-provided platform-role authority.

---

## 26. CI workflows

Current important workflows:

### Phase 5 UI verify

Checks:

- runtime profile preparation
- secret scan
- focused Phase 4/5 regressions
- session/schema regressions
- Worker syntax
- production Vite build
- Wrangler dry-run.

Current main:

`35501800213` PASS.

### Phase 5 Bigperson checkpoint verify

Checks:

- Bigperson Control
- three-factor
- privileged mutations
- Ready qualification
- durable proof
- launch hardening
- hosted product authority
- Worker syntax
- production build
- Wrangler dry-run.

Current main:

`35501800204` PASS.

### Phase 5 durable editor export verify

Checks durable save/history/recovery/export.

Current main:

`35501800209` PASS.

### Phase 5 production smoke

Runs after successful main UI verification.

Current main:

`35501834873` PASS.

Database expectation is now `ready`, not `either`.

---

## 27. Important recent rollback branches

Recent Phase 5 production checkpoints include:

- `backup-main-before-admin-durable-integration-2026-09-20`
  - `7d31e1f361e6373d8ee80c6bb960d5faa59122f0`
- `backup-phase5-before-publication-control-2026-09-20`
  - `2006c905b4f974e895c470a977bdb6cae294a29b`
- `backup-phase5-after-publication-before-ready-2026-09-20`
  - `4ceb8eb427103db33401fd4dc871e118644f77d3`
- `backup-phase5-admin-closed-before-durable-integration-2026-09-20`
  - `5f2c76c2bed64db253cf1143661b546059fdeda2`
- `backup-main-before-fk-index-hardening-2026-09-20`
  - `417e4c11ef912e92e2ec3153ec6b3fcb6b653ddb`
- `backup-main-before-hyperdrive-2026-09-20`
  - `417e4c11ef912e92e2ec3153ec6b3fcb6b653ddb`
- `backup-main-before-hyperdrive-binding-2026-09-20`
  - `af716033089b9e4cec80559b908dc51d40888583`
- `backup-main-hyperdrive-bound-before-ready-gate-2026-09-20`
  - `f63d1c836c8a9ed506528b0436be47d94e2becfa`
- `backup-main-before-live-control-2026-09-20`
  - `17a97df78730b9433ccb08f293bcc7a3de019290`
- `backup-main-before-live-control-smoke-2026-09-20`
  - `d10dd3f617537fc47ca87820194b8d8071b233f7`
- `backup-main-before-cloudflare-typescript-shim-2026-09-20`
  - `1d0e46ffaed2d75e6387f1e42534296835f141d3`
- `backup-main-before-session-auth-fix-2026-09-20`
  - `d83731bedfa749074aef7c37795a3d2ab66b199e`

There are many additional Phase 4/5 backup branches. Do not delete them casually.

---

## 28. Files that matter most for resuming

Start with:

1. `docs/phase5-admin-live-handoff-2026-09-20.md` — this file
2. `docs/current-handoff.md`
3. `docs/phase5-resume-2026-09-19.md`
4. `docs/phase5.md`
5. `docs/project-record.md`

Runtime/config:

- `wrangler.jsonc`
- `worker/index.js`
- `worker/hyperdrive.js`
- `worker/postgres-session.js`
- `worker/bigperson-auth.js`
- `worker/control-mutations.js`
- `worker/ready-qualification.js`
- `worker/materialization.js`
- `src/hostedProductClient.ts`
- `src/App.tsx`
- `index.html`

DB:

- `deployment/hosted/postgres.sql`
- `deployment/hosted/postgres-supabase-hardening.sql`
- `deployment/hosted/postgres-control-roles.sql`
- `deployment/hosted/postgres-bigperson-3factor.sql`
- `deployment/hosted/postgres-phase5-fk-indexes.sql`
- `deployment/hosted/postgres-session-created-at.sql`
- `deployment/hosted/postgres-session-auth-provider.sql`

Tests:

- `src/phase5-bigperson-control.test.ts`
- `src/phase5-bigperson-three-factor.test.ts`
- `src/phase5-bigperson-mutations.test.ts`
- `src/phase5-ready-qualification.test.ts`
- `src/phase5-editor-durable-export.test.ts`
- `src/phase5-session-schema.test.ts`
- `src/phase5-hyperdrive-config.test.ts`
- `src/phase5-production-public-smoke.test.ts`
- `worker/postgres-session.test.js`

---

## 29. Do not redo

A future session should **not** restart or redesign any of the following:

- do not recreate Supabase from scratch;
- do not create a second DB model;
- do not replace PostgreSQL authority with browser Supabase REST authority;
- do not redo Hyperdrive provisioning;
- do not revert `webcanbe_hyperdrive` to NOLOGIN while production uses it;
- do not remove the Hyperdrive binding;
- do not redo Google OAuth/Firebase configuration;
- do not re-add Control through ordinary product read mode;
- do not remove the dedicated Control gate;
- do not replace canonical Ready with browser-submitted status;
- do not remove the Worker TypeScript `__filename/__dirname` compatibility definitions without a replacement runtime design;
- do not remove `wcb_sessions.created_at`;
- do not stop persisting `auth_provider`;
- do not redo FK indexes;
- do not weaken three-factor privileged operations into route secrecy;
- do not redesign the dashboard/landing during backend continuation;
- do not fake product/payment/seller data.

---

## 30. What is genuinely left

### Immediate

- first production Bigperson passkey enrollment;
- first successful production three-factor Control read;
- DB verification of Bigperson rows and consumed challenge/audit.

### After Admin closure

- deliberate product read activation;
- DB-backed private read smoke;
- deliberate materialization/product mutation activation;
- clean-account E2E:
  - sign up/sign in
  - browse
  - detail
  - entitlement
  - materialize
  - workspace
  - Visual edit
  - Code edit
  - Save
  - reload same accepted revision
  - Export
  - standalone independent build.

### Later

- production payment provider
- verified checkout/webhook
- real commercial entitlements
- seller payout/KYC
- broader launch work.

---

## 31. Current truth in one sentence

**Webcanbe production now has live Hyperdrive, live DB-backed first-party auth, live independently gated Bigperson Control, green Phase 5 CI and production smoke; the user is currently at the production three-factor Bigperson registration gate, and the only remaining Admin E2E step is to enroll the first passkey and prove one three-factor Control read.**
