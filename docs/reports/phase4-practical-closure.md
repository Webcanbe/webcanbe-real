# Phase 4 practical closure checkpoint

Date: 2026-09-17 KST
Branch: `phase-4-product-ux`
Validated implementation SHA: `1968fe8fbe5dc71235a1d0e7769c8386f6e68a48`
Phase 3 frozen baseline: `5d3aa70dfd42e5706a23bd881e97e46665948a30`
Main frozen baseline: `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`

## Status

- `PHASE4_IMPLEMENTATION=PASS`
- `PHASE4_FULL_REGRESSION=PASS`
- `PHASE4_BUILD=PASS`
- `ROOT_NPM_AUDIT=PASS`
- `PHASE3_UNCHANGED=YES`
- `MAIN_UNCHANGED=YES`
- `PHASE4_RENDERED_VISUAL_ACCEPTANCE=NOT_YET`
- `PHASE4_PRACTICAL_CLOSURE=NOT_YET`

The remaining Phase 4 blocker is rendered desktop/mobile/accessibility visual acceptance against the current protected Vercel branch preview. The preview deployment itself is successful, but external browser access is currently gated by Vercel Authentication and the connected Vercel integration cannot issue a bypass/share URL for this project. Do not relabel this as visual acceptance.

## Launch UI landing

The public landing is now based on the Launch UI visual/section language while preserving the existing WebCanBe image assets. It uses:

- sticky translucent/white product navigation;
- centered large hero and two primary actions;
- framed product mockup with restrained glow;
- capability/logo strip;
- feature-item grid;
- product story / feature screenshot sections;
- stats;
- pricing;
- FAQ;
- CTA;
- footer.

Existing image assets remain in place and are reused, including:

- `/mainline/hero.webp`
- `/mainline/features/triage-card.svg`
- `/mainline/features/cycle-card.svg`
- `/mainline/features/overview-card.svg`
- `/mainline/resource-allocation/templates.webp`

The page remains true-white/near-black with neutral gray used for hierarchy rather than as the primary canvas. Public top navigation does not expose Pricing.

## Phase 4 application surfaces retained

The Phase 4 application remains wired to the real Phase 3 product/authority model rather than replacing it with template-only behavior:

- truthful hosted login/signup entry through the existing identity boundary;
- contextual auth resume;
- anonymous public Marketplace catalog reads;
- authenticated app sidebar;
- Dashboard based on real workspace/purchase state rather than fabricated analytics;
- separate My Projects and Purchases destinations;
- provider-deferred checkout that does not fake payment success;
- actual `CompatibleWorkspace` with `Visual | Code | Split` and Changes/history;
- Creator Studio UI over the seller-scoped backend;
- Control UI over operator-only backend reads/authority;
- true-white Phase 4 styling and responsive/mobile navigation.

Real payments/KYC/payouts, AI editing/metering, real deployment-provider execution, production passkey/WebAuthn ceremony where still deferred, and launch hardening remain Phase 5.

## Full regression closure evidence

GitHub Actions diagnostic run: `35238194794`.

Environment:

- Node 26;
- root `npm ci`;
- every committed `runtime-profiles/*/package-lock.json` prepared separately with `npm ci --ignore-scripts --prefix <profile>`.

Final result after reconciling two stale Phase 3-era catalog-auth test expectations:

- test files: `54 passed / 6 skipped / 0 failed`;
- tests: `769 passed / 61 skipped / 0 failed`;
- production TypeScript + Vite build: PASS;
- root `npm audit`: `0 vulnerabilities`;
- Phase 3 exact ref: unchanged at `5d3aa70dfd42e5706a23bd881e97e46665948a30`;
- main exact ref: unchanged at `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`.

The build retains one non-failing advisory: `CodeWorkspace` output chunk remains above 500 kB after minification. This is an optimization advisory, not a correctness failure.

## Preserved failed receipt and test reconciliation

The first broad Phase 4 closure run was not green. Diagnostic capture showed exactly two failing tests, both in `src/hostedProductClient.test.ts`:

1. a historical assertion expected Marketplace browse/detail to require an authenticated controller/CSRF path;
2. a historical assertion used `browse()` as the unauthenticated-private-access refusal case.

Those expectations conflicted with the intentional Phase 4 contract already covered by `phase4-public-production.test.ts`: published catalog browse/detail are public bounded reads, while private operations remain authenticated and CSRF-protected.

The tests were reconciled without weakening product authority:

- public browse/detail now assert direct public catalog POSTs with no `X-WCB-CSRF` header;
- private Purchases is now the unauthenticated refusal case and still requires the hosted session boundary;
- private mutations and reads remain on the authenticated `post()` path.

Before that correction the diagnostic receipt was `767 passed / 61 skipped / 2 failed`; after correction the full preserved regression is `769 passed / 61 skipped / 0 failed`. Preserve both facts.

## Deployment / rendered-QA boundary

GitHub/Vercel status for the Launch UI checkpoint reported deployment success. GitHub check metadata exposes the branch preview hostname:

`webcanbe-real-git-phase-4-product-ux-web-can-be.vercel.app`

Direct browser-content access returned `login_required`. The connected Vercel integration lists the WebCanBe team but currently returns no project record for this Git-linked deployment and could not create an authenticated share/bypass URL. Therefore no screenshot-level desktop/mobile/accessibility acceptance is claimed in this checkpoint.

## Historical disclosures preserved

- `P39_NATIVE_ACCEPTANCE=DEFERRED`; synthetic/unit success does not replace the missing real macOS native IME / interactive VoiceOver receipt.
- P61 historical second-application warm-update HTTP 422 remains disclosed; exact historical root cause remains UNPROVEN.
- Phase 3 historical raw `686/687` cleanup-race receipt remains historical evidence and is not erased by later green regressions.

## Next Phase 4 action

Do not reopen completed product/backend architecture and do not start Phase 5 yet. The remaining bounded Phase 4 action is to obtain legitimate rendered access to the current branch preview, inspect landing/login/dashboard/My Projects/Purchases/Marketplace/workspace/Creator Studio/Control at desktop and mobile widths, fix only concrete visual/accessibility defects found there, and then publish final Phase 4 closure if that rendered acceptance is green.
