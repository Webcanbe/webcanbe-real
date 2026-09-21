# Webcanbe Launch Closure Plan — 2026-09-20 KST

## Gate 4 combined Visual + Code staging proof: **PASS**

- v4 checkpoint: `85c66326ae85ffe5065197ecd4272673b1021bf2`
- integrated verification: `35546569409` **PASS**
- chain: immutable release → materialize → safe Visual source mutation → durable Visual revision → Code revision → reopen → standalone export/build
- history ordering verified as `visual` then `code`
- both edits survive reopen and export
- immutable release provenance retained
- no Webcanbe runtime state in standalone export
- staging evidence only; production mutation remains OFF until authenticated Gate 2 passes

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

Read `docs/launch-resume-2026-09-21.md` first after any interruption. Production main is `c0889c867170219545c7f05662e7f0c744a83362`; active Gate 3 candidate `phase5-gate3-materialization-staging-v4` is `aa1cf8571ae6a95aff653d7385fdf883d9ea50e3`, current-main-based and **0 behind**, and must remain draft/staging-only until authenticated Gate 2 is green.

The credential-free GitHub provider boundary is already verified and should not be repeatedly re-proved. Gate 2 as a whole still requires the user's authenticated Google baseline plus same-account GitHub/Email linking/login/read/refresh/logout sequence. Production product mutation remains OFF.

Independent Gate 5 recovery work continues on `phase5-recovery-restore-rehearsal`, draft PR #46. Latest verified recovery implementation/test checkpoint is `faf4e5f66e83c9de1cd0e7991e56bdc382a1cf42`; recovery CI `35564722856`, job `106224184976`: **PASS**. Confirmed rollback now verifies the exact requested Worker target both before and after the rollback command, and only runs production smoke after post-rollback deployment convergence is proved. No live rollback or DB restore was performed by this checkpoint.

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
- credential-free provider-boundary proof is complete; authenticated same-account E2E remains separate

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

Run against the existing Google-backed account, then verify linked providers return to that same internal account.

Google:
- login
- dashboard/private reads
- refresh persistence

GitHub via Firebase:
- link to the current first-party account
- logout
- popup login
- server exchange into the same first-party Webcanbe account
- same private reads
- refresh
- logout

Email/password:
- link Email identity to the current first-party account
- logout
- existing login
- same first-party DB session/read path
- refresh
- logout

Acceptance:
- no local/demo fallback
- no auth-provider-specific product authority
- same internal account across Google/GitHub/Email
- private requests require live DB session + CSRF
- clear empty/error/loading states

## Gate 3 v3 staging: **HISTORICAL / SUPERSEDED**

- v3 remains historical evidence only
- do not use it for activation

## Gate 3 v4 active staging: **VERIFIED, NOT DEPLOYED**

- branch: `phase5-gate3-materialization-staging-v4`
- current docs head: `aa1cf8571ae6a95aff653d7385fdf883d9ea50e3`
- combined Visual + Code launch-chain code checkpoint: `85c66326ae85ffe5065197ecd4272673b1021bf2`
- integrated run `35546569409`, job `106173445526`: PASS
- current main→v4 comparison: ahead-only / **0 behind**
- preserves `db:recovery:preflight` and `launch:smoke-fixture`
- includes latest Firebase build/CSP fixes and staged frontend/Worker materialization switches
- Gate 4 regression proves immutable release → materialize → React source analysis → safe Visual mutation → durable Visual revision → Code revision → reopen → standalone export/build
- verifies accepted history producer order visual→code, both edits survive reopen/export, release provenance survives, and no Webcanbe runtime state ships
- keep PR #45 draft/staging-only until authenticated Gate 2 is green

## Gate 3 — Materialization mutation activation

Only after Gate 2 passes and the current v4/main relationship has been rechecked at activation time.

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

## Gate 5 recovery / DR preflight: **CLOSED; LIVE DRILLS STILL PENDING**

- verified main checkpoint: `0ad5747a89a01414b966ac8ceee82eb44c6c1768`
- UI `35517472985`, durable `35517473076`, Bigperson `35517473013`, production smoke `35517512404`, browser matrix `35517525373`: PASS
- live DB recovery invariants checked: 40 Webcanbe tables, 11 migrations, zero direct browser-role Webcanbe table/routine grants, bounded runtime/Hyperdrive roles, required immutability triggers
- read-only recovery preflight command added
- guarded recovery-target restore tooling and Worker rollback rehearsal live on draft PR #46
- rollback implementation checkpoint `faf4e5f66e83c9de1cd0e7991e56bdc382a1cf42`, recovery CI `35564722856` / job `106224184976`: PASS
- confirmed rollback requires preflight, exact target forwarding, post-rollback requested-target convergence from a fresh deployment-status read, and production smoke/readiness
- a wrong post-rollback active version fails closed before production smoke
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

1. Keep authenticated Gate 2 pending for the user's Google baseline plus same-account GitHub/Email link/login/read/refresh/logout sequence; do not spend independent runs re-proving the unchanged credential-free provider boundary.
2. Continue Gate 5 recovery preparation on draft PR #46. Next engineering slice: before any recovery-target `TRUNCATE`, add a read-only connected-server identity comparison for production and recovery targets so alternate DNS names cannot make the same PostgreSQL server/database look distinct; prove the refusal path without a live DB.
3. Re-read main and Gate 3 v4 before every consequential write; keep v4 **0 behind** and draft/staging-only.
4. Only after authenticated Gate 2 is green, use v4 (or rebuild from newer main if needed) for the private fixture, deliberate materialization activation, and production Gate 4 chain.
5. Then execute the controlled live Worker rollback drill, real off-site DB restore drill, and finally the separately gated commercial payment/seller work.
