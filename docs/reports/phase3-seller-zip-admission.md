# Phase 3 non-executing seller ZIP admission

Date: 2026-09-17

Branch: `phase-3-hosted-product`

Starting checkpoint: `df98e5f10a28e5771fe18e4ba7f2718b74111a4f`

Status: PASS

## Scope completed

This pass adds only seller-authorized, non-executing ZIP admission into the
existing hosted source and seller quarantine pipeline.

### Authority and exact provenance

The existing hosted controller authenticates through the retained
TLS/origin/CSRF/session boundary and accepts one exact request shape. The store
requires that the current user owns the referenced approved seller application
and has active owner/editor membership in the referenced workspace before
archive inflation. The same authority is locked and rechecked in the commit
transaction; seller, application, workspace, admission, archive, source,
revision, snapshot, and submission IDs remain references rather than authority.

The server generates archive, admission, project, revision, and submission
identities. It records the exact archive SHA-256 and byte length, then derives a
hosted source ledger and immutable submission snapshot from the validated bytes.
One transaction writes the existing `wcb_projects`/membership rows, immutable
seller submission, `pending_review` state, and immutable ZIP-admission record.
Database uniqueness plus an advisory lock make same-seller, same-workspace,
same-archive replay idempotent; reused keys or archive digests in another
workspace/seller context conflict or deny.

### Inert archive safety

ZIP admission reuses the Phase-2 `yauzl` reader and repository limits. It
performs lazy per-entry processing with strict filenames and declared-size
validation, while independently checking archive bytes, entry count, per-file
and total uncompressed bytes, compression ratio, actual inflated bytes, CRC,
UTF-8 text, and bounded inert metadata.

Paths reject absolute forms, traversal/dot segments, backslashes/drive syntax,
control/null characters, non-NFC names, invalid/reserved segments, excessive
depth/length, and protected directories. Case-normalized duplicates,
file/directory prefix collisions, encrypted members, symlinks and other unsafe
file types refuse. Empty, malformed, high-ratio, over-limit, checksum-invalid,
and unsupported archives never reach PostgreSQL source creation.

### Quarantine-only boundary

Archive bytes are read as data only. This path does not load or evaluate
JavaScript, TypeScript, Vite configuration, plugins, hooks, or package metadata;
does not start a child process/package manager; and does not access the network
or host dependencies. It creates no assessment request/result, ProjectRelease,
Listing, entitlement, materialization, checkout, or payment state.

## Verification

- Targeted ZIP-admission tests: 4/4; fifty unrelated hosted-product tests were
  skipped by the exact test-name filter.
- Coverage includes authenticated HTTP admission, approved-seller authority,
  exact digest/source/revision/snapshot/submission provenance, replay
  idempotency, cross-seller/workspace refusal, traversal, normalized duplicate,
  symlink, malformed and decompression-bomb refusal, inert uploaded code/config,
  and quarantine-only/no-publication side effects.
- TypeScript: PASS (`npx tsc -b --pretty false`).
- Production build: PASS (`npm run build`); the existing chunk-size advisory is
  non-failing.
- Focused security diff scan `692c048b-19b2-4013-8679-8bafac0b9a4e` reviewed
  all six changed files plus the authority, source-store, metadata, and
  transaction controls; zero findings. Its fixed snapshot preceded a final
  authority-narrowing workspace-replay check prompted by review. That final
  delta was manually inspected and the targeted tests rerun green; unresolved
  security items remain zero. Delegation was disabled by task policy. Daybreak
  access was not granted and did not gate the review.
- Full default regression: NOT RUN, per instruction.

## Next bounded task

Implement a non-executing seller GitHub import admission contract pinned to an
immutable commit and archive digest, reusing this source/quarantine path without
starting WebCanBe Ready.
