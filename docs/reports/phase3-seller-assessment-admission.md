# Phase 3 seller assessment admission

Date: 2026-09-16

Branch: `phase-3-hosted-product`

Starting checkpoint: `af00daf79fa94defd348c1643932f76c0fe4bb7a`

Status: PASS

## Scope completed

This pass adds only snapshot-bound admission into an assessment-job request. It
does not add an assessment worker or any submitted-code execution.

- The existing hosted TLS/origin/session-cookie/CSRF controller authenticates
  the request before dispatch. The admission body contains only expected
  submission, seller, snapshot, review-decision, and idempotency references.
- The PostgreSQL transaction requires the existing durable active product
  operator before and after admission work.
- A submission without a decision or with a `rejected` decision is refused.
  Only its own immutable `approved_for_next_stage` decision is accepted.
- The decision's seller application, seller, source project, source revision,
  content hash, and snapshot hash must all match the immutable submission.

## Immutable request and idempotency

The assessment request stores its own stable identity together with submission,
seller, source project/revision/content/snapshot, review-decision, `requested`
status, admitting operator, idempotency key, and creation timestamp. PostgreSQL
allows one request per submission and decision and rejects update or deletion.

Identical retries and the same valid admission under a fresh key return the
original request. Reusing a key for another admission or substituting a seller,
submission, snapshot, or decision fails without creating a second request.

## Non-execution boundary

Admission performs parameterized PostgreSQL reads and one insert only. It does
not invoke a worker, subprocess, package manager, lifecycle hook, uploaded
configuration/plugin/script, filesystem checkout, or external network. It also
creates no catalog project, ProjectRelease, Listing, LicenseEntitlement, or
workspace-project materialization.

## Verification

- Targeted assessment-admission tests: 4/4; sixteen unrelated hosted-product
  tests were skipped by the test-name filter.
- TypeScript: PASS (`npx tsc -b --pretty false`).
- Production build: PASS (`npm run build`).
- Focused security diff scan `7c115169-baed-4daa-b46d-2f0310948d1d`:
  complete coverage of all five changed files; zero findings and zero unresolved
  security items.
- Full default regression: NOT RUN, per the bounded task instruction.

## Next bounded task

Implement restart-safe server-side leasing and claiming for `requested`
assessment jobs while preserving snapshot binding and still performing no
submitted-code execution.
