# Phase 4 public production seams checkpoint

Date: 2026-09-17

Branch: `phase-4-product-ux`

Implementation checkpoint: `32d3308`

Status: **PASS for this bounded Phase-4 public/auth infrastructure slice; Phase 4 remains open**

## Why this pass existed

The prior public/app information-architecture correction established the intended UI flow, but three hosted-production seams still contradicted it:

1. Marketplace catalog browse/detail were still authenticated at the hosted product controller boundary, so anonymous public Marketplace access would fail in true hosted mode.
2. The OIDC callback still redirected to the historical fixed `/workspace/northstar` path, so contextual purchase/login intent could not resume.
3. The hosted TLS static server served the SPA document only for root and workspace paths, so hard refresh/direct navigation to public and app routes could return 404.

Checkout also needed to hydrate its summary from the actual public listing in hosted mode rather than only from local sample data.

## Corrections

### Public catalog boundary

`/catalog/browse` and `/catalog/detail` are now explicit anonymous published-read endpoints before private session authentication. They remain constrained to the configured editor origin/host, HTTPS, JSON POST requests, exact bounded request fields, and no local editor key. All private product mutations and private reads continue through the existing session + CSRF authority boundary.

The browser client now uses a separate `publicPost` path only for these two catalog reads. Private product methods retain the authenticated client path.

### Contextual hosted authentication

Successful OIDC callback now returns only to the fixed same-origin `/auth/complete` route rather than the historical fixture workspace.

`AuthComplete` verifies the newly issued hosted session and then resumes the previously stored internal `wcb-auth-next` path when it is a safe relative path; otherwise it falls back to `/dashboard`. The browser never supplies an arbitrary redirect URL to the server callback.

This enables the intended flow:

`project detail -> Buy -> login when anonymous -> /auth/complete -> intended checkout`

### Hosted SPA direct routes

The hosted TLS server now recognizes the intended Phase-4 SPA document routes, including Marketplace, Pricing, Login/Signup, auth completion, Dashboard, My Projects, Purchases, Settings, Creator Studio routes, Control, project detail, checkout, and workspace routes. Those paths resolve to platform `index.html`; assets retain the existing confined static namespace.

### Checkout hydration

Hosted checkout resolves the selected project through the public listing detail API. It remains intentionally non-transactional until Phase 5 payment-provider integration.

## Landing preservation

This pass does **not** alter landing composition. The selected Mainline-derived landing remains structurally unchanged; the locked rule remains: preserve the original template composition/layout and change only WebCanBe copy/branding/assets/links plus necessary technical/accessibility fixes.

The previously added 120 ms restrained navigation transition remains the only landing navigation behavior change in this sequence.

## Verification

GitHub Actions run `35221269275`:

- Phase-4 focused/landing suite: **20/20 PASS** across 6 files.
- OIDC identity regression: **15/15 PASS**.
- hosted product controller regression, scoped to the relevant controller describe: **8/8 PASS**; 58 unrelated tests skipped by name filter.
- TypeScript: **PASS** as part of `npm run build`.
- production Vite build: **PASS**.
- root `npm ci`: **0 vulnerabilities**.
- Phase-3 branch remained `5d3aa70dfd42e5706a23bd881e97e46665948a30`.
- `main` remained `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`.
- Vercel deployment for implementation checkpoint `32d3308`: **SUCCESS**.

### Regression-audit note

An earlier broad validation attempt ran environment-sensitive isolated assessment-worker tests without the trusted runtime/isolation setup used by their original harness. Four worker failures were unrelated `isolated_assessment_error` outcomes and were not fixed or weakened. The final validation deliberately scoped the inherited Phase-3 run to the hosted product HTTP-controller describe affected by this Phase-4 contract change.

Two inherited Phase-3 assertions that required catalog authentication were updated on the Phase-4 branch only because public published catalog reads are now an intentional Phase-4 product contract. Forged/private entitlement operations remain denied.

## Remaining Phase-4 work

- actual rendered desktop/tablet/mobile browser QA on the current preview;
- final login/signup visual and edge-state polish;
- Marketplace/detail/checkout visual polish without changing payment truth;
- Creator Studio and Control final visual/responsive polish;
- Docs/public Pricing completion as appropriate;
- accessibility pass and final Phase-4 reconciliation/regression.

Real payment processing, KYC/payouts, AI, real deployment providers, and production hardening remain Phase 5.
