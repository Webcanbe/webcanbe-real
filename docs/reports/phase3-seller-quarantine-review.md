# Phase 3 seller quarantine review foundation

Date: 2026-09-16

Branch: `phase-3-hosted-product`

Starting checkpoint: `aba9d0f7abc64d782ab3620218ddfa63136b8d0a`

Status: PASS

## Scope completed

This pass adds only a privileged, read-only quarantine queue and immutable
review decisions for the existing seller-submission snapshots.

- Authenticated list and inspect routes require the existing durable active
  product-operator capability inside the PostgreSQL transaction.
- Queue responses expose only identifiers, exact source provenance, status,
  timestamps, and the prior decision when one exists. Source bytes/history,
  session data, membership data, and operator internals are omitted.
- A decision accepts only `approved_for_next_stage` or `rejected`; the HTTP body
  cannot assert reviewer, operator, seller, or tenant authority.
- Decision creation locks the submission, verifies the caller-supplied expected
  snapshot hash against the immutable submission, copies its provenance, and
  rechecks active operator authority before returning.

## Immutability and idempotency

PostgreSQL stores one review-decision row per submission. A mutation-refusal
trigger rejects update and deletion. Identical retry input returns the original
record; the same decision submitted under a new key is also safely resolved to
that record. Reusing a key for a different submission, snapshot, or outcome and
attempting a conflicting later decision both fail without rewriting history.

The existing seller-submission snapshot remains immutable. A decision is tied
to its exact seller application, seller, source project, source revision,
content hash, and submission snapshot hash.

## Quarantine remains non-public

`approved_for_next_stage` is only permission for a later isolated assessment
stage. Neither it nor `rejected` changes the submission-state row from
`pending_review`. This pass creates no catalog project, ProjectRelease, Listing,
LicenseEntitlement, workspace materialization, build request, or submitted-code
execution path.

## Verification

- Targeted seller quarantine-review tests: 4/4; twelve unrelated hosted-product
  tests were skipped by the test-name filter.
- TypeScript: PASS (`npx tsc -b --pretty false`).
- Production build: PASS (`npm run build`).
- Focused security diff scan `fb210a8b-bfdc-4583-8785-3983a0ab0eab`:
  complete coverage of all five changed files; zero findings and zero unresolved
  security items.
- Full default regression: NOT RUN, per the bounded task instruction.

## Next bounded task

Implement snapshot-bound admission of only `approved_for_next_stage`
submissions into an isolated assessment-job request, without executing the job
or publishing a release.
