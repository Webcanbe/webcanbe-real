# Phase 3 hosted product route integration

Date: 2026-09-16

Branch: `phase-3-hosted-product`

Starting checkpoint: `3d4053427a2db3196174acf2aeffddb77373686e`

Status: PASS

## Scope completed

This pass connects only the existing product routes to the existing hosted
product controller. It does not redesign routes, change the landing page,
introduce a parallel identity/product API, alter product-domain semantics, or
add a real payment provider.

- `/browse` reads the authenticated hosted catalog with the existing query and
  tag-filter contract.
- `/project/:slug` reads authoritative listing/release detail.
- The existing project action reuses an active entitlement or requests a TEST
  self-grant, then materializes the entitled immutable release into an
  authenticated workspace and opens `/workspace/:workspaceProjectId`.
- `/projects` reads purchases and owned materialized workspace copies
  separately. A purchase may exist without a copy.
- Non-hosted mode retains the existing local presentation data so the existing
  Vite product preview remains functional; hosted mode does not use it for
  authoritative product state.

## Authority and provenance

The client adapter bootstraps the existing session-issued CSRF token and uses
same-origin authenticated POSTs. It never accepts or sends a user identity,
membership, project role, or operator flag. The new TEST self-grant convenience
endpoint binds the beneficiary to `session.userId` and calls the unchanged
durable product-operator check. Non-operators receive 403.

Materialization still verifies the entitlement owner and active state, current
workspace membership, deterministic idempotency key, immutable release
snapshot integrity, and exact source project/revision/content/snapshot hashes.
The My Projects query first filters durable materializations by the session user
and then applies the existing fresh session/project/membership grant to every
returned project. Cross-user get/materialize attempts refuse.

## Verification

- Focused tests: 12/12 in two files.
- TypeScript: PASS (`npx tsc -b --pretty false`).
- Production build: PASS (`npm run build`).
- Focused security diff scan: complete coverage of six changed files; zero
  findings and zero unresolved security items.
- Full default regression: NOT RUN, per the bounded task instruction.

The prior preserved Stage-B full run remains 686/687. Its only failure remains
the unrelated untouched Phase-2 Vite temporary-cache cleanup race at
`src/webcanbe-engine/phase2de.test.ts:16` (`ENOTEMPTY`). This pass does not call
that historical run green and does not modify Phase-2 cleanup or product code.

## Next bounded task

Add a verified payment-provider event adapter that grants or transitions the
existing provider-agnostic entitlement contract without changing
materialization, provenance, or tenant-authority semantics.
