# Phase 3 promoted-release Listing publication

Date: 2026-09-17

Branch: `phase-3-hosted-product`

Starting checkpoint: `c1babdd86dbdfbab4843fe126a2d6414578452ab`

Status: PASS

## Scope completed

This pass adds only the explicit operator-controlled transition from one
already-promoted immutable release to one public marketplace Listing.

### Operator authority and eligibility

The existing authenticated hosted product controller exposes one exact-body
publication action. It reuses the retained TLS/origin/CSRF/session boundary;
clients cannot add an operator flag or otherwise self-assert authority. The
store requires an active durable product-operator record at transaction entry
and rechecks it before return.

The selected immutable promotion must join its exact `ProjectRelease` and
active `CatalogProject`. Seller, catalog, release, source project, source
revision, content hash, and snapshot hash must agree across those records, and
the catalog creator must be the assessed seller. Consequently raw submissions,
unassessed or failed/errored paths with no promotion, non-promoted releases,
and seller/project/release substitutions cannot publish.

### Atomic decision and immutable binding

Publication serializes on the catalog and atomically inserts a public,
available Listing plus an append-only publication record binding promotion,
assessment result, seller, catalog, release, Listing, operator, status, key,
and timestamp. Unique constraints prevent a second publication for the same
promotion, catalog, release, or Listing. Exact same-key replay returns the
existing decision and current Listing metadata; conflicting keys or bindings
refuse.

The normal seller metadata route is retained but hardened: it cannot create a
published Listing, transition a non-public Listing to published, change the
status of a published Listing, or change its release. A PostgreSQL trigger also
refuses published release rebinding, while the publication record itself
rejects update/delete. Marketplace copy, tags, demo metadata, and availability
remain mutable on the same release binding.

### Public read and no-money boundary

A promoted release alone has no Listing and remains absent from hosted
browse/detail. Once the atomic publication succeeds, the existing read path
returns the Listing with the promoted release's exact revision and snapshot.
No browse UI was changed.

The publication transaction writes only Listing/publication state. It grants
no entitlement, creates no workspace project or materialization, starts no
checkout, invokes no payment provider, creates no payout/KYC state, accesses no
network, executes no seller code, and does not mutate the release or seller
source.

## Verification

- Targeted Listing-publication tests: 4/4; forty-six unrelated hosted-product
  tests were skipped by the test-name filter.
- Coverage includes authenticated operator publication, unauthenticated and
  seller refusal, client authority-flag refusal, exact release/result/snapshot
  binding, raw/unpromoted and cross-seller/project/release refusal, duplicate
  replay, conflict rejection, pre-publication absence, browse/detail presence,
  immutable release state, and zero entitlement/materialization/project or
  execution/payment-provider effects.
- TypeScript: PASS (`npx tsc -b --pretty false`).
- Production build: PASS (`npm run build`); the existing chunk-size advisory is
  non-failing.
- Focused security diff scan
  `1681d588-bdb5-481d-8db4-240021cd59c7`: complete coverage of all five changed
  files plus directly supporting session, operator, promotion, release,
  catalog, transaction, and read-path controls; zero findings and zero
  unresolved items. Delegated review was disabled by task policy, so the parent
  reviewed every changed file. Daybreak access was not granted; the advisory
  did not gate the scan.
- Full default regression: NOT RUN, per the bounded task instruction.

## Next bounded task

Implement a non-executing seller ZIP-import admission contract that reuses the
existing source/revision quarantine and freezes exact provenance before review.
