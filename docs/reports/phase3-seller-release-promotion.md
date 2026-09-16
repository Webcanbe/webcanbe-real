# Phase 3 passed-assessment release promotion

Date: 2026-09-16

Branch: `phase-3-hosted-product`

Starting checkpoint: `7335204d594a76ce75b4fda33b5357bd306d8021`

Status: PASS

## Scope completed

This pass adds only the explicit trusted promotion boundary from an accepted
assessment result to an immutable release. Listing publication remains a later
separate action.

### Operator authority and exact lineage

The existing authenticated hosted product controller exposes one promotion
action with an exact request-body contract. Session, TLS/origin, and CSRF
authority remain in the existing boundary. The PostgreSQL store requires a
durable active product operator inside the transaction before reading protected
lineage and rechecks that authority before returning. IDs are selectors only.

The selected result must be terminal `passed`. Its assessment request,
immutable submission, `approved_for_next_stage` review decision, completed
lease, worker and fencing generation must all agree on seller, submission,
source project, revision, content hash, and snapshot hash. Failed and errored
outcomes, stale or substituted references, and cross-seller inputs refuse.

The target catalog must be active and must match the assessed source project,
submission workspace, and seller creator. This prevents an operator request
from attaching another seller's assessed snapshot to an unrelated catalog.

### Immutable exactly-once creation

The store decodes the submission's frozen files and history, verifies the
revision ledger and source content hash, and recomputes the complete snapshot
digest. It does not consult current seller HEAD. In one transaction it inserts
one canonical `ProjectRelease` from those bytes and one append-only promotion
record binding result, assessment, submission, seller, source, review,
operator, catalog, version, and release.

A per-result advisory transaction lock plus unique result, release, catalog
version, and operator/idempotency constraints serialize races. An exact repeat
returns the original promotion and release. A different key, version, catalog,
or provenance for the result conflicts without creating another release.
Existing release immutability and a new promotion update/delete refusal trigger
preserve history across restart.

### Non-publication boundary

Promotion creates no `Listing`, does not make the release purchasable, and does
not grant or transition an entitlement. It creates no payment state or working
copy, does not modify seller HEAD, does not access the network, and does not
execute submitted code or invoke package tooling. The existing internal
`ProjectRelease.status = published` lifecycle value does not itself provide
marketplace availability; that requires a separate `Listing` record.

## Verification

- Targeted promotion tests: 6/6; forty unrelated hosted-product tests were
  skipped by the test-name filter.
- Coverage includes authenticated operator-only HTTP authority, client
  self-assertion refusal, valid passed-result promotion, failed/errored refusal,
  exact lineage, cross-seller/job/submission/snapshot/catalog substitution,
  duplicate replay, conflicting attempts, source HEAD changes before and after
  promotion, immutable stored release, and zero listing/entitlement/payment/
  materialization/execution side effects.
- TypeScript: PASS (`npx tsc -b --pretty false`).
- Production build: PASS (`npm run build`); the existing chunk-size advisory is
  non-failing.
- Focused security diff scan
  `3d7da8e0-1128-492f-aefe-8bb238cc36e9`: complete coverage of all five changed
  files plus directly supporting session, operator, transaction, provenance,
  uniqueness, and immutability controls; zero findings and zero unresolved
  items. Delegated review was disabled by task policy, so the parent reviewed
  every changed file. Daybreak access was not granted; the advisory did not
  gate the scan.
- Full default regression: NOT RUN, per the bounded task instruction.

## Next bounded task

Implement an explicit operator-authenticated Listing publication decision for
one promoted immutable `ProjectRelease`, without payment or entitlement side
effects.
