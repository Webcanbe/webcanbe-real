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

Finish Gate 1 CI on `phase5-product-read-launch`. Merge to `main` only if all launch branch workflows are green. Immediately after deployment, run Gate 2 instead of starting unrelated features.
