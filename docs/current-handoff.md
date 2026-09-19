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