# Phase 3 seller assessment result acceptance

Date: 2026-09-16

Branch: `phase-3-hosted-product`

Starting checkpoint: `ba9bc31f0e6460832fb063cd4b63b893b07cc3fc`

Status: PASS

## Scope completed

This pass adds only the trusted storage boundary for assessment outcomes
produced elsewhere. It does not execute submitted project code.

### Live-fence authority

Acceptance validates an active provisioned worker credential and the exact
assessment job, submission, snapshot, worker owner, and current generation. The
job's lease row is locked and must be `leased` and database-clock live. A final
conditional state update repeats owner, generation, state, and live-expiry
checks, so expiry, reclaim, cancellation, or another owner cannot race a result
into acceptance.

### Immutable result and provenance

The accepted result stores a server-generated identity plus the exact seller,
source project/revision/content/snapshot, review decision, admitting operator,
admission time, worker, lease generation, outcome, metadata, artifact
references, idempotency key, digest, and completion time. PostgreSQL permits one
result per job generation and one use of a worker idempotency key. Result update
and deletion are rejected.

The same transaction changes the lease to terminal `completed`. Completed jobs
cannot renew, cancel, satisfy a live fence, or be reclaimed. `passed`, `failed`,
and `errored` are assessment outcomes only and do not approve or publish the
submission.

Metadata is restricted to a JSON object of at most 8,192 serialized characters.
Artifact references are unique opaque UUIDs capped at twenty and sorted before
persistence; they
remain references, never authority. Canonical result hashing allows an exact
same-key replay to return the original immutable row. Any different content or
key for the accepted attempt fails as a conflict.

## Restart and non-execution guarantees

The result row and completed lease state remain authoritative after a new
store/process instance. Exact replay stays idempotent while wrong-worker and
stale delivery continue to refuse, and all source/review/admission provenance
remains byte-for-byte bound.

Acceptance performs authenticated parameterized PostgreSQL operations only. It
does not execute submitted code, invoke npm/pnpm/yarn/bun, run uploaded scripts,
configuration, plugins, or hooks, access external network, create or publish a
ProjectRelease or Listing, grant an entitlement, make anything purchasable, or
materialize a workspace project.

## Verification

- Targeted result-acceptance tests: 6/6; thirty unrelated hosted-product tests
  were skipped by the test-name filter.
- TypeScript: PASS (`npx tsc -b --pretty false`).
- Production build: PASS (`npm run build`); the existing chunk-size advisory is
  non-failing.
- Focused security diff scan `0d377165-dd82-40cc-b63e-19008e1bf15f`: complete
  coverage of all four changed files, zero findings, zero unresolved security
  items.
- Full default regression: NOT RUN, per the bounded task instruction.

## Next bounded task

Implement an out-of-process isolated assessment worker that consumes the exact
leased snapshot and submits through this result boundary, without release or
listing publication.
