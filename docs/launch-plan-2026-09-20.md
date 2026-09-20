# Webcanbe Launch Closure Plan — 2026-09-20 KST

## Launch objective

Ship the real production product quickly without reopening completed architecture or exposing unfinished mutations as if they were live.

Current verified baseline:
- pre-launch main: `ac60ef75ce5ad0c5024febae92b99b25a3acab44`
- Admin/Bigperson production E2E: complete
- Hyperdrive + PostgreSQL authority: live
- durable editor/export proof: integrated
- production read activation: `phase5-product-read-launch`
- general product mutation activation: still closed
- commercial payment: still separate

## Release discipline

Every bounded slice follows:

`code → focused regression → full CI/build/dry-run → production smoke → Markdown checkpoint`

Production rules:
- no demo/local product fallback when production read mode is active
- no browser role or route-state authority
- no enabling seller/payment/materialization merely because read mode works
- no dashboard/landing redesign during launch closure
- no secrets in Git, Markdown, Vite public variables, or chat
- preserve rollback checkpoints

## Gate 1 verification result

Branch code checkpoint: `2aba73e72901f9208378a7a6595ddadb1141da26`

- UI `35509040875`: PASS
- Bigperson `35509040888`: PASS
- durable editor/export `35509040858`: PASS
- status: **CLOSED IN PRODUCTION** — main UI, Bigperson, durable, and production smoke all PASS; live read=hosted and mutation=closed.

## Gate 1 — Production read activation

Branch: `phase5-product-read-launch`

Scope:
- enable `wcb-product-read-mode=hosted`
- keep `wcb-product-mutation-mode` absent
- Marketplace browse/detail/preview read authoritative catalog data
- AppShell workspace selector reads DB
- Dashboard / Projects / Purchases read DB state
- Settings account/profile reads DB
- empty production state remains empty; never substitute demo projects
- Control remains independently gated
- Seller and Checkout remain on the full-hosted/non-production boundary

Acceptance:
- Phase 5 UI CI PASS
- Bigperson checkpoint PASS
- durable editor/export PASS
- production build + Wrangler dry-run PASS
- after main deployment, production smoke confirms read=on / mutation=off

## Gate 2 automated preflight: **CLOSED**

- main `ef175c6659d3a09f73e8e36ee486b91ffbf9e881`
- UI / Bigperson / durable / production smoke all PASS
- anonymous private reads and materialization fail closed in production
- clean-account backend reads return truthful empty arrays
- interactive provider-specific browser smoke remains

## Gate 2 authenticated smoke UI: **LIVE**

- `https://webcanbe.com/_ops/gate2-auth-smoke`
- HTTP 200 / noindex
- Google, GitHub/Firebase, Email signup/login entry paths available
- automatic Account / Workspace / Purchases / Working copies / Catalog checks
- refresh-persistence and logout-invalidation checks included
- product mutation still closed

## Gate 2 — Interactive production auth + private-read smoke

Run against a clean/new account and an existing account.

Google:
- login
- dashboard
- refresh persistence
- workspace read
- purchases read
- projects read
- account read/update
- logout and DB-session invalidation

GitHub via Firebase:
- popup
- server exchange into first-party Webcanbe session
- same private reads
- refresh
- logout

Email/password:
- signup
- existing login
- same first-party DB session/read path

Acceptance:
- no local/demo fallback
- no auth-provider-specific product authority
- private requests require live DB session + CSRF
- clear empty/error/loading states

## Gate 3 v2 staging: **VERIFIED, NOT DEPLOYED**

- branch: `phase5-gate3-materialization-staging-v2`
- code checkpoint: `718588c99f4af96f7c46e9140abd9f0c17bda054`
- UI `35511748159`: PASS
- durable `35511748083`: PASS
- Bigperson `35511748095`: PASS
- rebased from current main, including safe provider-linking changes
- no public Listing created by the launch fixture
- production activation remains blocked on interactive Gate 2

## Gate 3 — Materialization mutation activation

Only after Gate 2 passes.

Activation:
- enable Worker `WEBCANBE_PRODUCT_MUTATIONS=enabled`
- add production `wcb-product-mutation-mode=hosted`

Production materialization acceptance:
- active entitlement belongs to current user
- editable workspace membership
- immutable published release provenance
- idempotency
- transactional working-copy creation
- retry cannot create duplicate canonical copy
- unauthorized account/session/workspace refuses

Keep payment-provider entitlement creation and unrelated seller mutations closed until separately qualified.

## Gate 4 preverification: **CHAIN PASS ON STAGING**

- checkpoint `75810cef69b3b43947029ccaf42f844f4e319ac6`
- UI `35511923446`: PASS
- durable `35511923498`: PASS
- Bigperson `35511923419`: PASS
- release provenance → materialized history → durable edit → reload → independent export/build is regression-proven
- real production clean-account E2E still requires Gate 2 then Gate 3 activation

## Gate 4 — Clean-account product E2E

Required launch path:

`Sign up → Browse → Detail → Entitlement → Materialize → Workspace → Visual edit → Code edit → Save → Reload → same accepted revision → Export → fresh standalone build`

Also verify:
- stale draft/conflict behavior
- history continuity
- sign-out/sign-in reopen
- direct workspace route protection
- export excludes Webcanbe runtime state

## Gate 5 — Launch hardening

Before broad public traffic:
- Chrome + Safari + Firefox smoke
- desktop + mobile responsive pass
- keyboard/focus/accessibility pass
- error/empty/loading copy pass
- request IDs and production error observability
- DB backup/restore drill
- Worker rollback drill
- security headers/CSP/noindex/robots/sitemap final check
- secret scan
- privacy/terms/data-handling final check
- performance pass on landing, browse, dashboard, workspace

## Gate 6 — Release scope

### Earliest safe beta
Open after Gates 1–5 if every exposed capability is truthful. Payment may remain unavailable only if the UI does not pretend a transaction can complete.

### Full commercial launch
Additionally requires:
- actual payment provider
- server-created checkout/payment intent
- signed verified webhook
- idempotent commercial entitlement grant
- duplicate/retry handling
- refund/reversal semantics
- purchase receipt/history
- seller payout/KYC/merchant obligations
- purchase → entitlement → materialization full production E2E

## Current next action

1. Complete the live Gate 2 flow at `https://webcanbe.com/_ops/gate2-auth-smoke`: Google baseline, private reads, refresh, link GitHub, link Email, logout, then linked GitHub/Email login verification.
2. After Gate 2 is green, activate from `phase5-gate3-materialization-staging-v2`.
3. Apply the private launch-smoke fixture and verify it creates zero public Listing rows.
4. Enable materialization, then execute the production Gate 4 chain through save/reload/export/independent build.
