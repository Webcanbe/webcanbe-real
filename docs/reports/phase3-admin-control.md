# Phase 3 Admin/Control backend checkpoint

Date: 2026-09-17

Branch: `phase-3-hosted-product`

Base: `b27a775ca014fadfd8fde3715be2c37d5fa54fff`

Status: PASS

The authenticated Control read aggregates bounded metadata from the existing
seller application, submission/review, assessment/result, immutable release,
Listing, Ready, deploy-intent, and audit tables. Durable active operator and
session authority are checked before and after reads. Source bodies, worker
credentials/fences, secrets, idempotency keys, and step-up evidence IDs are not
returned.

High-risk operator authority and seller application transitions require a
fresh, active, server-minted `control_high_risk` evidence record bound to the
same operator and session. There is no HTTP mint endpoint. An ordinary user
cannot self-promote, and deactivation increments durable operator authority so
revocation is effective immediately. Seller rejection remains terminal.

Each Control mutation and its audit record commit in one PostgreSQL transaction.
Audit binds actor, `product_operator` authority, action, target, before/after
details, server step-up evidence, idempotency key, and timestamp. An immutable
trigger refuses update/delete. These operations do not create or mutate source,
release, Listing, Ready, entitlement, payment, workspace materialization, or
deploy state.

Verification: targeted tests 3/3 (63 unrelated skipped); TypeScript PASS;
production build PASS with the existing non-failing chunk advisory; full
regression NOT RUN. Focused security scan
`499198fe-a246-43b8-871c-fb718b3b6314` reviewed four changed files/four threat
surfaces and found zero findings. Its snapshot preceded a one-line,
risk-reducing omission of step-up evidence IDs from Control read output; that
line was manually reviewed. Security unresolved: 0.

Remaining closure step: reconcile completed Phase-3 scope, run one default
regression, preserve known Phase-2 cleanup-race/P39/P61 disclosures, and publish
closure only if supported.
