# Webcanbe Launch Closure Plan — 2026-09-20 KST

## Gate 3 v4 current-main staging: **VERIFIED, NOT DEPLOYED**

- branch: `phase5-gate3-materialization-staging-v4`
- draft PR: #45
- verified checkpoint: `bd03d69726b31a70e2a981b35b609fe3ac69e33f`
- integrated verification `35545791365`: **PASS**
- Firebase/CSP focused verification `35545791377`: **PASS**
- rebuilt from current main after Firebase build-variable fallback and popup CSP work
- preserves `db:recovery:preflight` + adds `launch:smoke-fixture`
- includes private no-Listing launch fixture + explicit staged frontend/Worker materialization switches
- includes Gate 4 immutable release → materialize → durable edit → reopen → standalone export/build regression
- production mutation remains OFF
- v3 is superseded for activation; use v4 after Gate 2 is green

## Active continuation — 2026-09-21 KST

Read `docs/launch-resume-2026-09-21.md` before resuming after an interruption. The latest verified implementation remains `0ad5747a89a01414b966ac8ceee82eb44c6c1768`; later documentation commits are not new production feature evidence. The existing hourly task resumes unfinished work automatically at its next invocation and checks whether lost-response writes already landed.

Gate 3 v3 at `9f8b5d184682567bb7881af2a1f42ddc71bd5e1e` lacks main's `db:recovery:preflight` package command. Do not promote it unchanged or treat ahead/behind counts as proof that all main changes are preserved. The live rollback/restore drills and authenticated provider E2E remain pending.

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

## Launch truthfulness cleanup: **LIVE**

- code: `cb1c168771b988a25b74d42902da29b36e04c190`
- UI `35514696758`, durable `35514696790`, Bigperson `35514696759`, production smoke `35514742329`: PASS
- unavailable phone sign-in is disabled instead of redirecting to another provider
- paid plans cannot be purchased before billing activation
- stale Phase 4/account-backend copy removed
- no product mutation/payment authority was enabled

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

## Gate 3 v3 staging: **VERIFIED, NOT DEPLOYED**

- branch: `phase5-gate3-materialization-staging-v3`
- code checkpoint: `67b0010bc17fb71cf8d71e31664585e0553166e6`
- UI `35514261090`: PASS
- durable `35514261052`: PASS
- Bigperson `35514261054`: PASS
- based on current main and includes the live auth-logo/spinner polish
- Gate 4 materialize → durable edit → reopen → standalone export/build regression included
- production activation remains blocked on interactive Gate 2

## Gate 3 v3 current-production rebase: **VERIFIED**

- staging checkpoint: `d9d7b5be1f0334bb988f663e508c74cc7ddc0f81`
- UI `35514962485`: PASS
- durable `35514962469`: PASS
- Bigperson `35514962482`: PASS
- includes latest production auth/UI truthfulness changes plus Gate 3/4 regressions
- still not deployed; interactive Gate 2 remains required first

## Gate 3 — Materialization mutation activation

Only after Gate 2 passes and the current staging/main integration has been reconciled without dropping existing main commands or test coverage.

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

## Gate 5 browser/accessibility/build hardening: **CLOSED**

- production code `cc3584c4232d1bc382865cb8bcc775895391b2fb`
- UI `35516646841`, durable `35516646678`, Bigperson `35516646722`, production smoke `35516693367`: PASS
- Chromium / Firefox / WebKit production matrix `35516707994`: PASS
- desktop/mobile responsive overflow, keyboard focus, accessible names, uncaught page errors and basic timing checks are automated
- production build-size budgets are enforced
- Supabase Security Advisor: 0 findings
- Performance Advisor currently reports unused-index INFO only; no index removal at low traffic

## Gate 5 recovery / DR preflight: **CLOSED**

- verified main checkpoint: `0ad5747a89a01414b966ac8ceee82eb44c6c1768`
- UI `35517472985`, durable `35517473076`, Bigperson `35517473013`, production smoke `35517512404`, browser matrix `35517525373`: PASS
- live DB recovery invariants checked: 40 Webcanbe tables, 11 migrations, zero direct browser-role Webcanbe table/routine grants, bounded runtime/Hyperdrive roles, required immutability triggers
- read-only recovery preflight command added
- backup and rollback wrappers behaviorally rehearsed without touching production
- live Worker rollback and real off-site DB restore drill remain pending

## Gate 5 — Launch hardening

The completed subchecks above do not close this entire gate. Remaining live drills and authenticated/editor coverage must be tracked separately.

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

1. Resume from `docs/launch-resume-2026-09-21.md`. First check whether the GitHub/Firebase login initiation reaches its official provider screen without submitting credentials; capture and fix any pre-authentication failure through permitted operations.
2. For the remaining authenticated Gate 2 evidence, open `https://webcanbe.com/_ops/gate2-auth-smoke` in the user's real browser and establish the Google baseline with private reads and refresh persistence.
3. While still on that Google-backed internal account, link GitHub and Email identities.
4. Verify logout, then verify linked GitHub and linked Email logins return to the same Webcanbe account and pass the same reads.
5. Before Gate 3 activation, compare the actual latest main/staging files and reconcile the known package-command omission through permitted operations. Retain `db:recovery:preflight` alongside `launch:smoke-fixture`, preserve the corresponding regression coverage, and verify the resulting candidate. Do not use a synthetic merge or a different tool interface to bypass a denied write.
6. Only after Gate 2 and the reconciled candidate are verified, apply the private launch-smoke entitlement/release fixture, verify zero public Listing, activate materialization, then execute the production Gate 4 chain.
