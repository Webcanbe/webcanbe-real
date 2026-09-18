# Phase 4 public/auth/purchase-flow correction

Date: 2026-09-17

Branch: `phase-4-product-ux`

Implementation checkpoint: `ec2be20d2c7e602ae94ae725cc69e8e203a06972`

Status: **PASS for this bounded Phase-4 IA slice; Phase 4 remains open**

## User-facing structure corrected

The product now distinguishes public browsing from the authenticated application instead of placing Dashboard/My Projects/Purchases in the public Marketplace header.

### Public surfaces

- Landing remains the existing selected Mainline-template composition. This pass did not reorder, simplify, remove, or visually redesign landing sections.
- Marketplace and project detail use a minimal public shell rather than authenticated app navigation.
- Public header exposes brand plus bounded public/account actions; authenticated product destinations are not shown as ordinary public top navigation.
- Pricing remains a public surface.

### Authenticated app

The authenticated application now uses a sidebar-oriented shell with Dashboard, My Projects, Purchases, Marketplace, Creator Studio, Plans, and account/settings access. Protected app routes verify the hosted session before rendering in hosted mode.

### Purchase intent

Project detail no longer uses the Phase-3 TEST-entitlement shortcut as a simulated purchase action.

The intended flow is now represented as:

`public Marketplace -> project detail -> Buy -> login/signup when anonymous -> checkout -> provider-confirmed payment (Phase 5) -> entitlement -> Dashboard / working-copy flow`

If already authenticated, Buy proceeds to the checkout surface. If anonymous, the safe internal checkout path is retained as contextual auth intent.

The Phase-4 checkout surface is intentionally non-transactional: it defines order/checkout information architecture but does not claim payment success or create a marketplace entitlement. Real card-first provider integration remains Phase 5.

## Navigation feel

Internal client-side navigation now has a deliberately small 120 ms transition boundary with a restrained fade/2 px progress indicator. This is intended to avoid the previous abrupt instantaneous route swap without adding artificial slow loading. `prefers-reduced-motion` is respected.

The landing's own internal route helper uses the same bounded transition behavior while preserving its original template composition.

## Verification

GitHub Actions run `35220267664`:

- focused Phase-4/landing tests: **16/16 PASS** across 5 test files;
- TypeScript: **PASS** as part of `npm run build`;
- production Vite build: **PASS**;
- root `npm ci`: **0 vulnerabilities**;
- Phase-3 branch remained `5d3aa70dfd42e5706a23bd881e97e46665948a30`;
- `main` remained `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`;
- Vercel deployment for `ec2be20d2c7e602ae94ae725cc69e8e203a06972`: **SUCCESS**.

An earlier run failed two stale literal-string assertions because Purchases and Control had become stronger protected routes. The assertions were updated to require the protected route forms; product behavior was not weakened to satisfy the old tests.

## Important remaining correctness work

This checkpoint does not yet declare the complete public/auth/payment architecture finished. Before Phase-4 practical closure, the hosted production composition still needs explicit validation that:

1. anonymous Marketplace/catalog reads are truly public at the hosted HTTP boundary rather than accidentally requiring a session;
2. the OIDC callback resumes the contextual safe `next` destination rather than a historical fixed workspace path;
3. direct/hard-refresh SPA routes are served by the hosted editor server for all intended public/app routes;
4. actual rendered desktop/mobile flows receive live-browser visual QA.

Those items are the next bounded correction pass. Real payment processing remains Phase 5.
