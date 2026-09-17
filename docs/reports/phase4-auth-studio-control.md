# Phase 4 auth, Creator Studio, and Control checkpoint

Date: 2026-09-17

Branch: `phase-4-product-ux`

Implementation checkpoint: `5aa460aaa758fe6c769147117aaa13a65adc5b7f`

Status: **PASS for this bounded Phase-4 UI slice; Phase 4 remains open**

## Scope completed

### Authentication surface

The previous UI-only successful-login buttons were removed. Hosted login/signup now call the existing hosted identity start boundary (`POST /__webcanbe/auth/start`) and redirect only to the server-returned authorization URL. A bounded internal `next` path is retained for contextual return after authentication. The screen explicitly states that direct email/password is not enabled by the current hosted identity boundary rather than inventing a second authentication system.

This is not a claim that final email/password, reset, verification, or production passkey/WebAuthn UX exists. Those remain deferred until there is a real backend ceremony/provider to support them.

### Creator Studio UI

The old static seller preview was replaced by a hosted-aware Creator Studio over the existing seller-scoped Phase-3 backend:

- reads the current seller application and truthfully handles no-application, pending, approved, rejected, loading, and error states;
- creates a real pending seller application through the existing server endpoint;
- approved creators read the existing Studio aggregate for submissions, imports, reviews, assessment summaries, releases, Listings, and WebCanBe Ready state;
- the overview derives pipeline counts/state from server data rather than invented sales metrics;
- published Listings expose only the already-authorized bounded metadata edit surface (title, summary, availability, tags, demo metadata); immutable release binding and publication authority remain unchanged;
- new submissions select an existing authorized workspace/source project and enter the existing quarantine/review pipeline; they do not implicitly publish a Listing.

Local/non-hosted mode is explicitly labeled as a UI preview and does not fabricate seller review or sales records.

### Control UI

A separate `/control` UI was added over the existing operator-only `POST /__webcanbe/api/product/control/read` boundary. It presents bounded operational views for seller applications, submission state, Listings, Ready qualifications, and append-only privileged audit evidence.

The UI does not accept or mint roles, does not expose step-up evidence, and does not add a client-side `stepUp=true` bypass. High-risk mutations remain behind the existing server-minted, session-bound, expiring `control_high_risk` step-up boundary. This pass intentionally keeps Control high-risk mutation UX read-only instead of faking a production passkey ceremony.

## Verification

The implementation was first exercised on a temporary work branch by GitHub Actions run `35217889622`, then the exact validated final tree was replayed as one clean commit on the canonical Phase-4 branch.

- focused Phase-4/landing tests: **11/11 PASS** across 4 test files;
- TypeScript: **PASS** as part of `npm run build`;
- production Vite build: **PASS**;
- root `npm ci`: **0 vulnerabilities**;
- existing large `CodeWorkspace` chunk advisory remains non-failing;
- Phase-3 branch remained `5d3aa70dfd42e5706a23bd881e97e46665948a30`;
- `main` remained `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`;
- Vercel deployment for implementation checkpoint `5aa460aaa758fe6c769147117aaa13a65adc5b7f`: **SUCCESS**.

## Visual-browser QA limitation

A live-browser inspection was attempted against the Vercel Phase-4 preview with TinyFish. The deployment is protected by Vercel authentication and the browser profile had no saved credentials, so the run reached only the Vercel login wall. No WebCanBe application screenshot was therefore accepted as visual evidence.

Consequently this checkpoint is **not** Phase-4 visual closure. Actual rendered desktop/mobile inspection of Dashboard, My Projects, Purchases, Marketplace/detail, Workspace, Auth, Creator Studio, and Control remains required before practical Phase-4 closure.

## Preserved boundaries

- Phase 3 product-domain, source, revision, authority, provenance, isolation, Ready, assessment, entitlement, and Control contracts are unchanged.
- Real marketplace payment/KYC/payout, real deployment-provider integration, AI editing/metering, production WebAuthn/passkey ceremony, observability/rate-limit/fraud/load hardening remain Phase 5.
- `P39_NATIVE_ACCEPTANCE=DEFERRED` remains preserved.
- The P61 historical second-app warm-update HTTP 422 disclosure remains preserved.

## Next bounded Phase-4 work

Continue public/product UX completion and accessibility/responsive polish while preserving the current source-first product semantics. Resolve or obtain legitimate preview access before claiming browser-level visual fidelity or Phase-4 practical closure.
