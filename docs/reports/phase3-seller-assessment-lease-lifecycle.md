# Phase 3 seller assessment lease lifecycle

Date: 2026-09-16

Branch: `phase-3-hosted-product`

Starting checkpoint: `f364e58b6fb5758a5b18ebecc813b6c14961d11f`

Status: PASS

## Scope completed

This pass adds only live-fence-guarded renewal and cancellation for an existing
claimed assessment job. It does not add assessment execution.

### Renewal

The current active server-provisioned worker must present the exact assessment
job, submission, snapshot, and generation fence. PostgreSQL serializes the
operation with the same job advisory lock and lease-row lock as claiming. The
lease must be `leased` and database-clock live at the locked read and again in
the conditional update.

Renewal extends the existing expiry by the bounded internal lease interval. It
does not change the worker, generation, claim timestamp, assessment job,
submission, seller, source project/revision/content, snapshot, review decision,
or admission record. Expired, stale-generation, competing-owner, cancelled, and
substituted-identity renewal attempts refuse.

### Cancellation

Cancellation uses the same worker credential and exact live fence. It changes
only runtime state to `cancelled` and adds the database cancellation timestamp.
An identical retry by the same authenticated worker and fence returns the
stored cancellation record idempotently.

The cancelled state is durable and terminal. Claim/reclaim refuses it even
after lease expiry; renewal and the live fence assertion refuse it immediately.
PostgreSQL constrains state/timestamp consistency, protects immutable copied
provenance, and rejects later update or deletion of a cancelled row.

## Restart and non-execution guarantees

Renewed expiry and cancellation live in PostgreSQL and remain authoritative to
a new store/process instance. Worker, generation, submission, source revision,
content hash, and snapshot binding do not change across renewal, cancellation,
or restart.

The lifecycle methods perform authenticated parameterized PostgreSQL operations
only. They do not execute submitted code, invoke npm/pnpm/yarn/bun, run uploaded
scripts/configuration/plugins/hooks, access external network, publish a
ProjectRelease or Listing, grant an entitlement, or materialize a workspace
project.

## Verification

- Targeted lease-lifecycle tests: 5/5; twenty-five unrelated hosted-product
  tests were skipped by the test-name filter.
- TypeScript: PASS (`npx tsc -b --pretty false`).
- Production build: PASS (`npm run build`); the existing chunk-size advisory is
  non-failing.
- Focused security diff scan `b839e337-1808-45ea-a5b9-a23006cd47a3`: complete
  coverage of all four changed files, zero findings, zero unresolved security
  items.
- Full default regression: NOT RUN, per the bounded task instruction.

## Next bounded task

Implement immutable assessment-result acceptance guarded by the current live
lease fence, without in-process submitted-code execution or release/listing
publication.
