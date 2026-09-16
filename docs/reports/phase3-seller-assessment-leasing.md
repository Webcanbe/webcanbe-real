# Phase 3 seller assessment leasing

Date: 2026-09-16

Branch: `phase-3-hosted-product`

Starting checkpoint: `ce5a064ba06227a9e7e3162229188df9f2cecc1a`

Status: PASS

## Scope completed

This pass adds only restart-safe server-side claiming and leasing for existing
immutable `requested` assessment jobs. It does not add assessment execution.

- The trusted provisioning seam creates a cryptographically random worker
  credential; only its SHA-256 digest is stored in PostgreSQL.
- There is no browser/HTTP product-controller claim route. Claim and fence
  operations require an active provisioned worker credential inside the
  transaction.
- Claiming reloads the immutable assessment request, submission, and review
  decision. The request must still be `requested`, the decision must be
  `approved_for_next_stage`, and all copied provenance must agree.

## Lease state and fencing

One PostgreSQL lease row is keyed by assessment request. A transaction-scoped
advisory lock and row lock serialize claim/reclaim. The database clock decides
whether a lease is live:

- a live duplicate from the same authenticated worker returns the same lease;
- a live claim from another worker is refused;
- an expired lease may be reclaimed, preserving all immutable provenance and
  incrementing the generation;
- the mandatory fence assertion requires the current worker, generation,
  submission, snapshot, `leased` state, and live database expiry.

Both the immutable request and lease survive a new store/process instance.
The monotonically increasing generation makes a prior owner or result visibly
stale after reclaim.

## Non-execution boundary

Claiming performs authenticated parameterized PostgreSQL operations only. It
does not execute submitted project code, invoke npm/pnpm/yarn/bun, run uploaded
scripts/configuration/plugins/hooks, access external network, create a
ProjectRelease or Listing, grant an entitlement, or materialize a workspace
project.

## Verification

- Targeted assessment-leasing tests: 5/5; twenty unrelated hosted-product tests
  were skipped by the test-name filter.
- TypeScript: PASS (`npx tsc -b --pretty false`).
- Production build: PASS (`npm run build`); the existing chunk-size advisory is
  non-failing.
- Focused security diff scan `ea3b502f-a802-4fff-8f4e-b89bb852a5de`: four
  changed files reviewed, zero findings, zero unresolved security items. The
  final current-diff check included the later strengthening-only lease-expiry
  constraint and final live-fence recheck.
- Full default regression: NOT RUN, per the bounded task instruction.

## Next bounded task

Implement live-fence-guarded lease renewal and cancellation transitions for
claimed assessment jobs, still without executing submitted code.
