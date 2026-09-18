# Phase 3 seller intake foundation

Date: 2026-09-16

Branch: `phase-3-hosted-product`

Starting checkpoint: `4ede26c09a7e197294a5a170309cfe4c82fb1c9f`

Status: PASS

## Scope completed

This pass adds only the first hosted seller intake slice. It does not connect
payments, redesign the seller UI, execute submitted code, run compatibility or
security builds, publish approved releases, or alter buyer behavior.

- A session-bound seller application is unique per existing WebCanBe user and
  has `pending`, `approved`, or `rejected` state.
- Approval and rejection require the existing durable product-operator
  capability. Operator provisioning remains absent from HTTP.
- Only the approved application owner can create a submission from a workspace
  project for which the existing source authority is currently valid.
- A rejected application cannot be reopened or create new submissions in this
  intake workflow. Historical submissions remain visible only to their owner.
- The controller uses the existing hosted TLS/origin/session-cookie/CSRF
  boundary and accepts no client identity, role, or operator claim.

## Immutable provenance and quarantine

Submission reads the authoritative accepted `wcb_projects` revision inside the
existing PostgreSQL transaction and verifies its bounded source history. It
stores the exact files/history together with source project, revision, content
hash, and snapshot hash. The snapshot table rejects update and deletion; review
state is a separate record so future workflow changes cannot rewrite historical
provenance. Submitting a later source revision creates a new submission ID.

The only initial state is `pending_review`. No submission code is materialized
to a checkout or runner. The operation has no writes to catalog projects,
ProjectRelease, Listing, LicenseEntitlement, or entitlement materialization.

## Verification

- Targeted seller-intake tests: 4/4; eight unrelated hosted-product tests were
  skipped by the test-name filter.
- TypeScript: PASS (`npx tsc -b --pretty false`).
- Production build: PASS (`npm run build`).
- Focused security diff scan: complete coverage of five changed files; zero
  findings and zero unresolved security items.
- Full default regression: NOT RUN, per the bounded task instruction.

## Next bounded task

Add an operator-authenticated review-decision record and read-only quarantine
queue for submitted snapshots, without executing project code or publishing an
approved release.
