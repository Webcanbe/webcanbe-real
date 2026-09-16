# Phase 3 product-domain foundation

Date: 2026-09-16

Branch: `phase-3-product-foundation`

Exact base: `545eb5b388c9062fc46361cd62e74a78466bd095`

Result: **PASS**

## Outcome

This pass turns the frozen source-first editor engine into the first coherent
WebCanBe marketplace backend slice. It proves:

`catalog/listing → immutable release → TEST entitlement → authorized working
copy → edit copy while release and provenance remain unchanged`.

A second user cannot read or materialize the first user's entitlement or copied
project, and a workspace member cannot use another workspace as a materialization
target without server-side authority.

## Canonical domain and reuse

- `CatalogProject` associates marketplace identity with one existing source
  project and owner workspace.
- `ProjectRelease` records one immutable accepted `SourceRevision`, its source
  project, content hash, snapshot hash, version, and complete byte-exact source
  snapshot.
- `Listing` is mutable catalog presentation and availability metadata. Its
  selected release must belong to the same catalog project.
- `LicenseEntitlement` is a provider-agnostic purchase/right record. This pass
  creates only `TEST` provider entitlements.
- `WorkspaceProject` is an owned editable copy produced from exactly one
  entitlement and release. It is not the entitlement itself.

Release publishing and copy materialization reuse `SqliteAuthorityStore`,
`ProjectRegistry`, `DurableSource`, `SourceRevision`, and the existing revision
ledger. No parallel source or project system was introduced.

## Release immutability and lineage

Publishing captures the accepted head only after server-side source and
workspace checks, then rechecks both authorities immediately before persistence.
The snapshot rejects links, unsafe paths, case-insensitive duplicate members,
oversize members, and oversize archives. It preserves source bytes and records:

- source project ID;
- source revision ID;
- source content hash;
- immutable snapshot hash.

SQLite update and delete triggers make a persisted release immutable. Listing
metadata can be updated separately. A different accepted source revision cannot
replace a release; publishing it creates a new release identity.

Materialization writes the exact release bytes through the existing source
registry and creates a new root revision whose `releaseOrigin` contains the
entitlement, release, catalog, source project, source revision, content, and
snapshot identities. `DurableSource` validates this origin, and the PostgreSQL
project store rejects any later provenance change.

## Catalog read contract

The authoritative service contract supports:

- public browse of published, available listings;
- bounded text query over listing title, summary, and tags;
- all-tags filtering;
- listing detail by listing ID or slug;
- selected release identity, version, status, and exact source lineage;
- public/demo metadata already attached to the catalog/listing.

This is deliberately a backend/service API. A public HTTP adapter and final
Phase-4 UI are not part of this pass.

## Entitlement and materialization semantics

- TEST grants are unique per user, release, and provider, and idempotent by
  provider reference.
- Entitlements appear in Purchases before any editable copy exists.
- A valid entitlement creates at most one WorkspaceProject.
- Repeated same-workspace materialization returns the same copy, including after
  the copy has been edited.
- Reusing an idempotency key for different materialization inputs conflicts; the
  key never grants authority.
- The session user, workspace membership, entitlement owner/state, and copied
  project ownership are independently verified.
- Revoked or invalid entitlements explicitly refuse materialization.
- Cross-user access, guessed identifiers, and cross-workspace materialization
  refuse.

## Verification evidence

| Check | Result |
| --- | --- |
| Focused Phase-3 contract tests | 10/10 PASS |
| Full default Vitest run | 679 passed, 61 existing environment-gated skipped, 0 failed |
| TypeScript (`npx tsc -b`) | PASS |
| Production build (`npm run build`) | PASS |
| Changed-surface security review | PASS, 0 unresolved reportable findings |

The 10 focused cases cover catalog filtering and lineage, release immutability,
new-revision/new-release identity, post-capture authority recheck, entitlement
uniqueness and idempotency, Purchases versus My Projects, idempotent
materialization, exact provenance and copy isolation after edits, user/workspace
authority, revoked/invalid refusal, and idempotency-key non-authority.

The full default run retains 61 environment-gated skips. It is not relabeled as
a new all-environment 740/740 receipt. The frozen Phase-2 730/730 closure remains
unchanged and is not reopened by this report.

## Security result and limits

All IDs are references. Authority comes from the active server session,
workspace membership, source/revision grants, entitlement ownership/state, and
workspace-project ownership. Existing revision, artifact, isolation, and source
transaction checks were not weakened.

The changed-surface scan reviewed all seven implementation/test files and found
zero unresolved reportable findings. Daybreak was unavailable, so this is not a
penetration test or production deployment proof.

Product-domain persistence is single-host SQLite in this slice. Materialization
uses pending/ready rows across the product database and existing source registry;
the live request is idempotent, but restart-safe reconciliation of a process
failure between those stores is not yet implemented. No public controller calls
the service in this pass, and no payment, seller/KYC, review/quarantine, GitHub
sync, deployment, Creator Studio, admin UI, or AI editing work is included.

## Next bounded task

Add hosted PostgreSQL persistence and an authenticated HTTP controller for the
same domain contract, including restart-safe reconciliation of pending
entitlement materializations and an explicit operator capability for internal
TEST entitlement grant/revocation. Preserve the now-tested identities,
immutability, authority, idempotency, and provenance semantics unchanged.
