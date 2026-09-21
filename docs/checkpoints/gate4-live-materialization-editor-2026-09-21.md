# PR #60 current live-probe status — 2026-09-21 KST

## Source of truth

- repository: `Webcanbe/webcanbe-real`
- branch: `phase5-preview-live-probe`
- current main incorporated by ordinary merge commit `996d621c930614f81aea227363e75bf4a8771afe`; no rebase or force-push
- main at incorporation: `456a23c9ab9879f89a68d0682a7e7fb3cc6daba1`
- PR #60 remains **draft**
- payment-related implementation/documentation is explicitly out of scope for this continuation

## Automated regression — PASS

Integrated non-payment verification run `35593824866` / job `106313997667`: **PASS**.

Passed in that one run:
- Browser Run Visual regressions
- preview runtime security regressions
- production editor/source regressions
- Gate 2 identity-link regressions
- Gate 3 launch-chain regressions
- Firebase popup CSP regressions
- release-rights gate regressions
- Worker syntax
- production build (`tsc -b && vite build`)
- production build budget
- Wrangler Worker dry-run

Companion checks on the same integrated checkpoint also passed:
- Gate 3 v4 `35593824815`
- Firebase popup CSP `35593824861`
- Browser Run Visual `35593824862`

## Cloudflare public live probe — PASS for public runtime/asset/network-isolation scope

Actual Cloudflare branch-preview browser run:
- workflow `35594890113`
- job `106317325809`
- artifact `phase5-preview-live-evidence`, artifact ID `10636014422`
- URL: `https://phase5-preview-live-probe-webcanbe-real.iseig513.workers.dev/__wcb_preview_runtime`

Observed from the deployed page, not inferred from unit tests:
- preview document: HTTP **200**
- final route remained `/__wcb_preview_runtime`
- isolated CSP present: `default-src 'none'`, `connect-src 'none'`, `form-action 'none'`
- `X-Robots-Tag: noindex`
- `Cache-Control: no-store`
- DOM `data-wcb-preview-host="1"`: **present**
- DOM `data-wcb-preview-runtime="loaded"`: **present**
- `PreviewRuntimeHost` lazy chunk: `/assets/PreviewRuntimeHost-GVNUJF_C.js` → **200**
- `preview-runtime` lazy chunk: `/assets/preview-runtime-BfrnznKC.js` → **200**

A malicious synthetic project payload was then injected into the live deployed runtime:
- `fetch`: blocked with `Preview networking is disabled.`
- `XMLHttpRequest`: blocked
- `WebSocket`: blocked
- `EventSource`: blocked
- `navigator.sendBeacon`: returned `false`
- `RTCPeerConnection`: blocked
- external requests emitted after project payload: **0**
- sensitive Authorization / `X-WCB-CSRF` / Webcanbe-session request headers observed: **0**
- browser-context cookies: **0**
- `document.cookie`: empty
- localStorage/sessionStorage keys: empty
- source observation payload was produced and `data-wcb-ready="1"` was reached

The Worker-side Browser Run call still has the explicit service-level request allowlist:
`https://webcanbe.com/(?:__wcb_preview_runtime|assets/...)`.
The public probe above proves the deployed runtime itself cannot emit project network traffic. An actual Browser Run service invocation with a real authenticated workspace is still required to close the service-level navigation acceptance; that is not represented as a public-live PASS.

## Authenticated operator acceptance — PENDING / OPERATOR REQUIRED

Still not proven without the user's real authenticated production account:
- actual production working-copy hosted source load
- Browser Run pixels from that working copy
- source-mapped click against that authenticated project
- durable Visual edit written to PostgreSQL
- reload/reopen preserving that revision
- Code save after the Visual revision
- export of the accepted source
- independent build of the exported source
- same-account GitHub + Email login/link/private-read/refresh/logout evidence
- actual Browser Run service-level navigation allowlist while rendering the authenticated working copy

Do not merge PR #60 or mark the authenticated Gate 4 acceptance complete until those operator-authenticated checks exist.

---

# Gate 4 live materialization/editor checkpoint — 2026-09-21 KST

## Live production evidence

The launch-smoke canonical v2 entitlement successfully materialized into a real production working copy.

- materialization status: `ready`
- attempts: `1`
- workspace project: `ddbc6f4a-3138-4d98-9ffb-5e885ec55d05`
- entitlement: `8a9c7255-0d39-4e2e-abb0-a85c35ca4100`
- release: `bb231349-347b-41e4-80cc-198c1e4ebe76`
- catalog project: `1fff78b1-0ed1-58ca-a4c2-29b513c86e2b`
- source project: `4ffe6a04-425c-5192-8e35-c332888b32fd`
- source revision: `rev_21a35c0e-277a-5c26-9c6c-8b92380cfe4c`
- source content hash: `6a8d9957ba0837561f57fdcf3bd8d5e05a6e07cb4277f26045233d06fa001a29`
- canonical release snapshot hash: `84ad77ac1edac40a7fc2325ae2dc78fb9965638abb22ad3392df029233e1f5f5`
- project membership: current Webcanbe account is active `owner`
- project `releaseOrigin` exactly matches entitlement/release/catalog/source provenance
- public available Listings remain `0`

The first v1 launch-smoke entitlement was revoked and replaced by canonical v2 after the PostgreSQL JSONB key-order snapshot bug was fixed in main `89a12c26f4adca7bc5781989bcf559b384479f8f`.

## Live editor issue discovered

After successful production materialization, `/workspace/<id>` rendered the local-development editor boundary:

- Local editor access key field
- Connect / renew session
- preview unavailable

Root cause: `CompatibleWorkspace` treated the editor as hosted only when the global `wcb-editor-mode=hosted` meta existed. Production intentionally does not set that global switch because `hostedProductMode()` also gates Seller/Checkout behavior.

## Fix

PR #52 changed only the editor boundary:

- explicit `wcb-editor-mode=hosted` remains supported
- `https://webcanbe.com` + `wcb-product-read-mode=hosted` now uses hosted editor/session/project APIs
- localhost with only product-read metadata remains local
- Seller/payment/payout authority is unchanged

Verification:
- focused hosted editor CI `35581671088`: PASS
- Firebase/CSP CI `35581671080`: PASS
- Gate 3/4 integrated CI `35581671205`: PASS
- production build: PASS
- Worker dry-run: PASS
- merged main commit: `b1cdc782e7508ede0aa5f9462c810511767c0dc2`

## Next action

After the main Cloudflare deployment propagates, reload the existing production workspace. It must no longer show Local editor access. Verify hosted session/project source loads, then complete live Code/Visual save → reload/reopen → export and independent build.

## Browser Run live probe — SPA-host checkpoint

Current main code checkpoint: `f9876555c8d72d7c4e39e18ec42c989a757ad005`.

The separate second Vite preview artifact build was removed after Cloudflare branch deploys proved that `preview-runtime.html` and `preview-assets/*` were not served even though Wrangler dry-run included them.

The current no-cost production preview path is:

`/__wcb_preview_runtime` → normal SPA `index.html` → lazy `PreviewRuntimeHost` → lazy `preview-runtime` chunk under `/assets/*`.

Verified CI build from PR #59:
- ordinary app dist: 8.82 MiB
- ordinary JS: 1.12 MiB
- PreviewRuntimeHost chunk: 0.79 KiB
- preview-runtime lazy chunk: 3.44 MiB
- Wrangler Static Assets inventory: 124 files
- production editor / Browser Run Visual / Gate 2 / Gate 3/4 / preview security / Firebase CSP: PASS
- Worker dry-run: PASS

Live acceptance for this probe:
1. Cloudflare branch preview returns the SPA on `/__wcb_preview_runtime`.
2. the lazy `PreviewRuntimeHost` and `preview-runtime` chunks under `/assets/*` are present.
3. Browser Run can navigate only to the preview route and allowed assets.
4. no Webcanbe session cookie, CSRF token or platform secret is passed into imported project code.
5. then repeat the authenticated production workspace smoke: preview pixels → source-mapped click → Visual text edit → durable PostgreSQL revision.

