# Phase 3 final sprint Pass 1 — product residual completion

Date: 2026-09-17

Branch: `phase-3-hosted-product`

Starting checkpoint: `ecd0fe1e96e13beb8008dc78d8ea36f445ade8d0`

Status: PASS

## Scope completed

This pass adds only the three requested product surfaces: server-authoritative
WebCanBe Ready qualification, a seller-scoped Creator Studio backend, and
separate Share, Export, and inert Deploy contracts. They reuse the existing
identity, membership, source/revision, assessment, promotion, release, Listing,
and hosted-controller infrastructure.

### WebCanBe Ready

An authenticated active product operator can qualify an existing promoted
immutable ProjectRelease only when the referenced immutable assessment result
is `passed` and every catalog, source-project, revision, content, and snapshot
identity agrees across the release, promotion, and result. The stored release
snapshot is decoded and integrity-checked; the retained static React source
analyzer and compatibility summary derive `ready`, `partial`, or `code_only`
plus inspectable evidence and reasons. Seller/client input cannot supply the
status or compatibility result.

The qualification row records the exact release, promotion, assessment result,
source lineage, result digest, qualification version, operator, and timestamp.
Database uniqueness and immutable triggers make exact replay safe and prevent
historical rewrite. Qualification does not publish a Listing, create a purchase
or entitlement, materialize a project, execute code, or invoke payments.

### Creator Studio backend

The authenticated hosted controller exposes a minimum Studio aggregate only to
the current user when their seller application is approved. Every query is
scoped by that server-authenticated user identity and returns their application,
submissions, ZIP/GitHub imports, seller-safe review and assessment summaries,
promoted releases, Listings, and Ready qualifications. It omits worker
credentials, live fencing tokens, secrets, and unrelated tenant records.

The only Studio mutation updates bounded title, summary, availability, tags,
and demo metadata on the seller's own published Listing. It cannot change the
slug, publication status, immutable ProjectRelease binding, source snapshot,
review/assessment history, qualification, or operator publication authority.

### Share

Only the current project owner can create a view or edit share. The transaction
records and grants exact workspace and project membership epochs to a known
recipient, after refusing recipients with independent active authority. Exact
replay is idempotent; cross-project/key conflicts refuse. Revocation requires
the current owner, deactivates only the membership epochs created by that share,
and is durable and idempotent. A share ID remains a reference, not authority.

### Export

Export requires the existing hosted project `export` permission and exact
current expected revision. The canonical source/history snapshot is archived
with the existing Phase-2 safe exporter, preserving path/member/size controls
and without source materialization or execution. Authority is rechecked after
archive creation. The result includes exact project, workspace, revision,
content hash, archive SHA-256, archive bytes, and release provenance when the
working copy originated from a release.

### Deploy contract

Deploy in this pass is an inert immutable intent only. The server authenticates
existing project/source authority, pins the exact current revision and content
digest, and rechecks both inside the transaction. Requester-scoped idempotency
allows exact replay and refuses a reused key for another project or revision.
The model stores only requested status/history and provenance: it contains no
provider credentials or provider call, grants no authority, mutates no source,
and creates no Listing, entitlement, checkout, or payment state.

## Verification

- Targeted Pass 1 tests: 5/5; 58 unrelated hosted-product tests were skipped by
  the exact test-name filter.
- Coverage includes exact Ready evidence/release binding, operator-only
  qualification, truthful Ready/partial/code-only states, cross-release
  refusal, qualification immutability, seller-scoped Studio access and mutable
  Listing metadata, cross-seller denial, share grant/access/revocation,
  cross-project refusal, exact authorized export and digest provenance, exact
  deploy revision/idempotency/cross-tenant refusal, and absence of provider,
  payment, publication, entitlement, or execution side effects.
- TypeScript: PASS (`npx tsc -b --pretty false`).
- Production build: PASS (`npm run build`); the existing chunk-size advisory is
  non-failing.
- Focused security diff scan `3b883b7f-aef1-483c-b14a-1784346ba7c8`
  reviewed all six changed files and the retained hosted authority controls;
  coverage complete, five threat surfaces closed, zero findings, zero
  unresolved. Delegation was disabled by task policy. Daybreak access was not
  granted and did not gate the review.
- Full default regression: NOT RUN, per instruction.

## Next bounded task

Implement the operator-only Admin/Control read and state-transition backend
over existing product records without adding payment or UI work.
