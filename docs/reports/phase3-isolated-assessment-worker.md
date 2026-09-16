# Phase 3 isolated seller assessment worker

Date: 2026-09-16

Branch: `phase-3-hosted-product`

Starting checkpoint: `15b8f4a2254d81cb11e0d502f47f6b1274145d73`

Status: PASS

## Scope completed

This pass implements only execution of the smallest real seller assessment. It
does not publish or approve a product.

### Exact live-fence snapshot

`assessmentExecutionSnapshot` authenticates a server-provisioned worker and
requires the exact live job/submission/snapshot/generation fence under a row
lock. It joins the already-approved admission lineage, reads the immutable
seller-submission bytes rather than current project HEAD, revalidates bounded
history and the source revision/content hash, recomputes the full snapshot
digest, and checks the lease again before returning.

The worker additionally compares every copied lease provenance field with that
snapshot. IDs remain references; the worker credential plus current database
lease is authority.

### Existing isolated runner, not a second runtime

Production `HostedEditor` exposes an assessment worker composed directly from
the existing `HostedLinuxRunnerProvider` and `PostgresLeaseStore`. Each run
binds the hosted provider's authorization callback to the exact assessment
worker and fence. The job is the retained `semantic-typescript-v1` purpose,
with the immutable source revision, `network.external=deny`, the existing fixed
resource budget, deadlines, and a server-generated runner generation.

The server stages submitted files only as inert bytes in a fresh private
directory so the existing static runtime/profile parser can select the pinned
checker payload. Executable config, plugins, hooks, lifecycle/package-manager
scripts, arbitrary package installation, and uploaded Node code are not run.
The directory is removed before isolated execution begins.

The existing hosted gateway supplies verified mTLS transport, durable runner
fencing and heartbeat, fixed RPC commands, bounded I/O, cleanup and recovery.
The retained guest launch uses systemd limits plus bubblewrap private
namespaces, a cleared environment, read-only operator runtime files, private
temporary filesystems, no host project or `node_modules` mount, and default
external-network denial. The fixed checker runs pinned TypeScript as data-only,
no-emit work with its own memory and four-second deadline. No production local
or web/server execution fallback is present.

### Bounded outcome and stale-worker safety

The worker renews its five-second assessment lease while preparing/running and
aborts the hosted allocation when renewal or authority fails. Overall worker
execution is bounded to fifteen seconds by default (configurable only by
trusted server construction within 25 ms to 30 seconds), while the retained
runner has its own stricter command, transport, job and resource limits.

Validated semantic output maps to `passed` or `failed`; preparation, transport,
or checker failure maps to a bounded `errored` record only if the same live
fence still exists. At most eight truncated diagnostics are retained. Cleanup
completes before the worker calls the existing immutable
`acceptAssessmentResult` API. The worker never writes result tables directly.

Cancellation, expiry, worker revocation, reclaim, or a newer generation makes
the hosted authorization callback fail, aborts work where observed, and always
makes final acceptance fail. After a crash with no result, ordinary lease
expiry/reclaim lets another valid worker assess the same immutable snapshot;
the older generation cannot overwrite it.

## Non-publication boundary

Assessment success creates no `ProjectRelease`, `Listing`, entitlement,
purchase, or workspace copy and does not make the submission public or
purchasable. Publication remains a later explicit operator-controlled task.

## Verification

- Targeted isolated-worker tests: 4/4; thirty-six unrelated hosted-product
  tests were skipped by the test-name filter.
- The tests cover successful live-fence execution, a real child process,
  exact frozen bytes after current seller HEAD changes, hosted-only selection,
  network-denied job input, fixed resource budget, timeout/error bounds,
  cancellation, expiry/reclaim and stale output, restart through a fresh store,
  immutable result submission, and zero release/listing/entitlement side
  effects.
- TypeScript: PASS (`npx tsc -b --pretty false`).
- Production build: PASS (`npm run build`); the existing chunk-size advisory is
  non-failing.
- Focused security diff scan
  `edfeaaac-c0a4-41ee-b7fa-64eb19a2f359`: complete coverage of all five changed
  files plus directly supporting isolation controls, zero findings, zero
  unresolved items. Delegated review was unavailable by task policy, so the
  parent reviewed every file. No live cloud-host probe was performed.
- Full default regression: NOT RUN, per the bounded task instruction.

## Next bounded task

Add an explicit operator-authenticated promotion decision that can create one
immutable `ProjectRelease` from a passed assessment result, while keeping
Listing publication separate and non-automatic.
