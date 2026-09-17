# Phase 4 product hub and workspace-mode checkpoint

Date: 2026-09-17

Branch: `phase-4-product-ux`

Implementation checkpoint: `21462c9ed0755c957e49c7c22a1ae3abf4c4fd96`

Status: **PASS for this bounded Phase-4 pass**

## Scope completed

This pass advances the final product UX without changing the Phase-3 product-domain, authority, source, release, entitlement, or assessment contracts.

### Dashboard / My Projects / Purchases

- Primary product navigation now exposes Dashboard, Browse, My Projects, Purchases, and Plans as distinct destinations.
- `My Projects` now represents editable working copies only; it no longer visually conflates purchases with editable projects.
- `Purchases` is a dedicated route and presents release-bound entitlements separately from working copies.
- In hosted mode, an active purchase can create its working copy through the existing server-authoritative workspace/materialization APIs. Existing copies reopen instead of duplicating.
- Hosted loading, empty, error, active/revoked/invalid, and materialization-in-progress states are explicit.
- Dashboard content is derived from working-copy and entitlement state. It shows real counts and identifies active purchases that do not yet have a working copy as `Ready to open`; fake charts/analytics and the prior hard-coded personal greeting were removed.
- Recent hosted activity is derived from persisted workspace-copy and entitlement timestamps rather than fabricated dashboard events.

### Real workspace UX

The actual production workspace route continues to use `CompatibleWorkspace`; this pass does not replace it with the older static mock.

- Workspace mode selection is now `Visual | Code | Split`.
- Existing durable history remains available as `Changes` rather than being removed.
- Split mode keeps the controlled real-project preview visible while exposing the existing source editor beside it.
- `CodeWorkspace` accepts split visibility without creating a second source/editor truth.
- Visual, Code, and Split continue to operate over the same project/revision/backend contract.
- The real workspace chrome now follows the Phase-4 true-white/neutral visual system, including responsive collapse rules.

## Verification

GitHub Actions run `35214239562` completed successfully.

- focused test files: 3 passed;
- focused tests: **7/7 PASS**;
- Phase-3 landing preservation test: PASS;
- Phase-4 UX foundation tests: PASS;
- new product-hub/workspace-mode tests: **4/4 PASS**;
- TypeScript: PASS as part of `npm run build`;
- Vite production build: PASS;
- root `npm ci`: zero reported vulnerabilities;
- existing non-failing >500 kB chunk advisory remains;
- `phase-3-hosted-product` remained exactly `5d3aa70dfd42e5706a23bd881e97e46665948a30`;
- `main` remained exactly `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`.

Vercel reported deployment success for implementation checkpoint `21462c9ed0755c957e49c7c22a1ae3abf4c4fd96`.

## Visual-QA boundary

The code/build/deployment checkpoint is green, but this is not Phase-4 closure. The browser automation connector's strict-agent mode was unavailable for this account during this pass, so no claim is made that the current rendered implementation has completed final screenshot-to-design visual signoff. That remains a required Phase-4 task.

## Remaining Phase 4 work

- browser-level visual QA and iterative pixel/interaction correction on the real preview;
- final Marketplace/detail/demo polish;
- contextual authentication UX and honest auth states;
- Creator Studio final UI over the existing backend;
- separate Control UI over the existing privileged backend;
- workspace inspector/Changes/runtime presentation refinement and share/export/publish surface integration where backed by existing contracts;
- Docs/Pricing final UX;
- responsive/mobile/accessibility audit and final Phase-4 reconciliation.

Phase 5 remains untouched: AI provider integration/metering, real payments/KYC/payouts, real deploy-provider integration, production WebAuthn ceremony where applicable, and launch hardening.
