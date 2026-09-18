# Phase 3 non-executing seller GitHub admission

Date: 2026-09-17

Branch: `phase-3-hosted-product`

Starting checkpoint: `e6a146ee8f87ff55bde73111009ce94b618361c7`

Status: PASS

## Scope completed

This pass adds only seller-authorized, non-executing GitHub archive admission
into the existing hosted source, ZIP safety, and seller quarantine pipeline.

### Authority and trusted fetch boundary

The existing hosted controller authenticates through the retained
TLS/origin/CSRF/session boundary and accepts one exact request shape. There is
no URL input. The store requires that the current user owns the referenced
approved seller application and has active owner/editor membership in the
referenced workspace before remote work, then rechecks that same authority in
the commit transaction.

Repository identity is bounded to owner/name and canonicalized to lowercase.
Canonical provenance requires a full lowercase 40-hex commit and a 64-hex
expected archive SHA-256; branch names, abbreviated commits, and moving refs
refuse. Only the server-created GitHub adapter builds a fixed HTTPS request to
`codeload.github.com`. It supplies no production credential, follows no
redirect, accepts no compressed transport, pins checked public IPv4 addresses,
and bounds headers, archive bytes, and transfer time.

The provider verifies SHA-256 before returning bytes. The product store then
requires the returned provider, repository, commit, and digest to match the
request and independently recomputes the digest before persistence.

### Shared archive safety and immutable provenance

Fetched bytes pass through the same `readSafeZip` path used by direct ZIP
admission. All established path, file-type, link, duplicate/collision, entry,
member-size, total-size, compression-ratio, actual-inflation, CRC, UTF-8, and
bounded metadata checks remain in force. Only after those checks does the
GitHub path require and strip one canonical codeload wrapper root, revalidating
every resulting path and case-normalized collision.

One PostgreSQL transaction creates the existing hosted source project and
revision, immutable seller submission, `pending_review` state, ZIP admission,
and immutable GitHub-admission record. The latter records seller, repository,
commit, archive identity/digest, source project/revision/content/snapshot,
submission, and timestamp. Database uniqueness, advisory locks, and immutable
triggers make exact replay idempotent and conflicting digest, key, workspace,
seller, repository, or commit provenance refuse rather than overwrite.

### Quarantine-only boundary

Imported bytes remain data. Admission does not evaluate JavaScript or
TypeScript, load uploaded Vite/config/plugin/hook code, start a child process or
package manager, install dependencies, or use host modules. It triggers no
assessment and creates no ProjectRelease, Listing, entitlement, materialized
workspace project, checkout, payment, payout, or purchasable state.

## Verification

- Targeted GitHub-admission tests: 4/4; 54 unrelated hosted-product tests were
  skipped by the exact test-name filter.
- Coverage includes authenticated HTTP admission, approved-seller and workspace
  authority, full-commit and digest provenance, repository canonicalization,
  exact replay, cross-seller/workspace refusal, moving-ref and arbitrary-URL
  refusal, conflicting digest refusal, shared ZIP traversal refusal, inert
  imported code/config, and quarantine-only/no-publication side effects.
- TypeScript: PASS (`npx tsc -b --pretty false`).
- Production build: PASS (`npm run build`); the existing chunk-size advisory is
  non-failing.
- Focused security diff scan `0bcbda2f-ce8c-40b9-a9be-48d8a872bb43` reviewed
  all six changed files plus the fixed GitHub adapter, hosted identity boundary,
  and transaction control; coverage complete, zero findings, zero unresolved.
  Delegation was disabled by task policy. Daybreak access was not granted and
  did not gate the review.
- Full default regression: NOT RUN, per instruction.

## Next bounded task

Define the smallest WebCanBe Ready certification-evidence contract over
immutable assessment results, without changing assessment execution, Listing
publication, entitlements, or payments.
