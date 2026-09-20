# Firebase build-variable production redeploy checkpoint — 2026-09-21 KST

Purpose: force and record a fresh production build after the operator added the six public Firebase Web SDK Vite variables to Cloudflare Builds → Variables and secrets.

Production/main before this checkpoint:
`381fdc7e300d05e6f4b22cf46e2e7715614e7d01`

Verified pre-rebuild failure evidence:
- Gate 2 diagnostic route and noindex behavior: PASS.
- Focused Gate 2 static tests: 7/7 PASS.
- Credential-free provider smoke run: `35543004163`, earlier job `106163934006`.
- Production JS bundle had all six Firebase Web fields compiled as `void 0`.
- The deployed app therefore returned `Firebase Authentication is not configured.` before a GitHub provider popup could open.
- The diagnostic made no Firebase exchange/link request, created no Webcanbe first-party session, and changed no production product data.

Operator action now completed:
- Added/saved these six names in Cloudflare Builds → Variables and secrets:
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_STORAGE_BUCKET`
  - `VITE_FIREBASE_MESSAGING_SENDER_ID`
  - `VITE_FIREBASE_APP_ID`
- Secret values are intentionally not copied into Git or this document.

This commit intentionally forces a fresh main build from Git so Cloudflare cannot merely serve/retry the previously compiled artifact.

Next verification:
1. wait for this main deployment to become live;
2. rerun the credential-free Gate 2 provider-boundary smoke;
3. require the official GitHub provider boundary to open without credentials and without exchange/link/session side effects;
4. keep Gate 2 authenticated E2E and Gate 3 production mutation pending until separately proven.
