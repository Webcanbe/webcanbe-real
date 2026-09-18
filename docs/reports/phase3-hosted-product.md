# Phase 3 hosted product

Date: 2026-09-16

Branch: `phase-3-hosted-product`

Exact foundation base: `5cdd40cd5e9ff08d3e1c3aeb3f670e0bf7ed5fdf`

Stage A checkpoint: `f8e03a6cf464a586d15f8fdf598f7c83bc374cc5`

Result: **PASS under the approved targeted closure policy**

## Stage A: Mainline landing port

The actual long Mainline homepage structure was translated to the existing
React 19, Vite, and Tailwind 4 application. Its navbar, hero, proof strip,
feature/product showcases, resource section, proof carousel, pricing, FAQ, CTA,
and footer rhythm remain. Branding and content are WebCanBe-specific, the top
decorative gradient was removed, and existing product routes were preserved.
No Next.js dependency or migration was introduced. The source archive was not
committed; the required third-party notice is retained.

Stage A is frozen at its checkpoint and was not changed during Stage-B closure.

## Stage B: hosted product persistence and controller

PostgreSQL now stores the existing canonical product-domain contract:

- CatalogProject and independently mutable Listing metadata;
- immutable ProjectRelease source snapshots and lineage;
- provider-agnostic LicenseEntitlement records, with TEST-only mutation here;
- durable pending/ready/failed materialization state and working-copy provenance.

Editable copies are created in the existing `wcb_projects` source/history
tables. There is no parallel project or source system. A release trigger rejects
updates and deletion, while snapshot hashes bind the original project, revision,
content, files, and history.

The HTTP controller uses the existing hosted TLS, exact-origin, host, secure
cookie, CSRF, active-session, disabled-user, workspace membership, and project
grant model. Request bodies have exact field allowlists. IDs select records but
never authorize operations.

TEST entitlement grants and terminal transitions require an authenticated user
who also has an active server-provisioned product-operator row. Operator
provisioning is not exposed through the controller, so a client cannot assert
operator/admin authority.

## Restart-safe materialization

Materialization durably reserves one stable workspace-project identity before
copy creation. Startup and periodic reconciliation process a bounded number of
pending rows. Each attempt rechecks the entitlement state and current
owner/editor workspace membership, validates the immutable release bytes,
history, and hashes, and creates or exactly replays the existing project,
project-owner membership, and ready state in one PostgreSQL transaction.

A restart cannot allocate a second project for the same entitlement. Failed
authority or entitlement state is recorded explicitly, and an authorized retry
uses the same durable identity. The copied project receives a new revision but
retains exact entitlement, release, catalog, original project/revision/content,
and release-snapshot provenance. Later edits cannot change `releaseOrigin` or
the original release.

## Verification

| Check | Result |
| --- | --- |
| Focused landing/foundation/hosted-product tests | 18/18 PASS |
| Exact previously failing Phase-2 test, serialized | 1/1 PASS |
| TypeScript (`npx tsc -b`) | PASS |
| Production build (`npm run build`) | PASS |
| Focused security review | PASS, 0 unresolved reportable findings |
| Preserved full default run | 686/687 runnable tests, 61 skipped |
| Full default rerun | NOT RUN by explicit closure policy |

The preserved full run's only failure was not an assertion failure. The
untouched Phase-2 test completed, then its `afterEach` cleanup encountered
`ENOTEMPTY` at `src/webcanbe-engine/phase2de.test.ts:16` while Vite's temporary
dependency cache was still being populated. The exact case was rerun with:

```text
npx vitest run src/webcanbe-engine/phase2de.test.ts --testNamePattern "rejects unresolved structural multi-file proposals without partial files" --environment node --pool forks --maxWorkers 1 --no-file-parallelism
```

It passed 1/1 with 28 unselected tests skipped. No Phase-2 production or test
code changed. The full run remains truthfully recorded as 686/687 and is not
claimed as green.

The focused security scan reviewed all eight changed implementation,
migration, dependency, and test surfaces plus their direct authority/source
helpers. It completed with zero reportable findings. Daybreak access was not
granted, so this is not a penetration test or production-deployment proof.

## Preserved boundaries and exclusions

Purchases/entitlements remain distinct from editable workspace projects. Real
payment providers, seller KYC/payout, review/quarantine, full GitHub sync,
Creator Studio, deployment product flow, final admin/UI, and AI editing remain
out of scope. Phase 2, `phase-3-product-foundation`, and main are unchanged.

## Next bounded task

Connect the existing browse, purchase, and workspace-project product routes to
the authenticated hosted product controller without changing the landing page
or product-domain semantics.
