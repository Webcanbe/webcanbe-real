# Combined public and authenticated UI release candidate

Base: `f6748084bd05b1eb4cf837dd5665434f0f6d2074`.
Public/docs parent: `914cd6c2c82cae57a094e3ce480e5b76fb5e4ca5` (PR #87).
Authenticated app/editor parent: `31a687d48d3ff1be19a6b579d41ae11f68bb28bb` (PR #88).
Both exact commits are merged as parents on `integration/final-ui-rc`; main is not merged or deployed.

## Reconciliation

- `src/App.tsx`: retain public components, static navigation and query category initialization while retaining ProductShell, auth intent, onboarding and distinct authenticated routes. `/browse` remains public; `/marketplace` is protected and is the signup destination. The public branch must not shadow the authenticated branch.
- `worker/index.js`: combine workspace creation dispatch with public catalog HTML, listing sitemap, canonical redirects and real 404 responses.
- `worker/security-headers.js`: retain public route manifest and CSP plus all app noindex routes. `/marketplace` is private.
- `scripts/generate-public.mjs`, `src/public/route-manifest.json`, `vercel.json`, `scripts/public-vite-plugin.mjs`, `public/robots.txt`: remove the old `/marketplace` alias and serve all new app routes from the private SPA. Public and OAI-SearchBot crawling remains enabled; new private destinations are excluded. Remove accumulating React footer image preloads so generation is idempotent.
- `src/main.tsx`, `src/app.css`, `src/phase4-final-ui.css`, `src/app-shell.css`, `src/editor-shell.css`, `compatibleWorkspace.css`: retain the app/editor slice's CSS order and scoped shell rules. Public CSS is retained independently. Both sets were checked byte-for-byte against their ready parents.
- `src/globals.css`, `public/fonts/`: serve the exact existing app fonts locally under the existing CSP, preserving typography. SHA-256/source provenance and OFL licenses accompany the fonts.
- `scripts/production-smoke-public.mjs`: inspect activation flags in the app shell and public URLs in the sitemap child document, following the static-public split.
- Legal/business content and core payment, AI, auth/revision authority are unchanged by conflict resolution.

## Legacy classification

The exact identities and pre-existing opt-in skips are in `final-ui-legacy-classification.json`.

Of the reported 109 failed tests: 2 were stale source strings; 4 were superseded Phase 4 assertions; 96 were historical runtime/fixture tests requiring absent locked profiles; 7 were maintained runtime/editor/export/assessment tests requiring those same profiles. All 103 runtime failures pass after preparing all 13 checked-in profile lockfiles. They are retained in the full suite, not excluded.

The six source assertions now preserve the original invariants: local editable landing and routes, real auth, privileged server boundary, CSS cascade ordering and fixed safe auth completion. Product behavior was not reverted to satisfy them.

New legacy exclusions: **none**. Existing opt-in skips: **61 identities across 18 files**, listed individually with environment gates in the JSON inventory. They require native Linux/mTLS runners, PostgreSQL or separately supplied immutable external fixtures. They are not claimed as executed here.

## Validation scope

Run focused checks before the final aggregate. Final validation includes TypeScript, production build and budgets, Worker syntax/dry-run, secret scan, the complete default test suite (including maintained release/security/editor/auth tests), public link/SEO validation, production public smoke with unconfigured database, and Chromium/Firefox/WebKit at 1440×900 and 390×844.

Browser evidence distinguishes the local production Worker public pages from the fixture-server editor. Auth navigation/onboarding is exercised with local demo authentication; actual Google/GitHub/email provider interaction and production data are not claimed. The fixture's external Unsplash image remains intentionally refused by its preview CSP. Hosted backend/real-account acceptance remains an operator acceptance activity.
