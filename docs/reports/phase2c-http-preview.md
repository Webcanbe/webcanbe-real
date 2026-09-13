# Phase 2C HTTP preview checkpoint: NOT YET

Updated 2026-09-13. This is a bounded runtime checkpoint, not overall Phase 2 completion.

**The HTTP compiler/listener/envelope are tested prototypes, deliberately unreachable from the editor API.** The current supported editor flow remains the Phase 2B controlled Blob bundle and HashRouter flow. BrowserRouter admission fails closed with an actionable network-isolation capability error.

The routing and standalone-export evidence is positive, but a native-sandbox Chromium probe sent three WebRTC/STUN UDP packets despite CSP networking restrictions. No approved browser runner that closes this boundary while retaining Chromium's native sandbox was available. Full nested-route editor UI acceptance and independent compatible external-project evidence are not claimed.

PHASE 2C HTTP/BROWSERROUTER CHECKPOINT: NOT YET
OVERALL PHASE 2: NOT YET
PUBLIC HOSTED IMPORT READY: NO

## Pre-implementation audit and threat-boundary record

The following original note was recorded before resumed implementation and is retained for chronology. Its in-progress statements are superseded by the completed results below.

# Phase 2C: isolated HTTP preview checkpoint

Status: implementation and validation in progress. No PASS is claimed.

## Repository audit and preserved work

Resumed on `phase-2-compatible-editor` at
`b4438a999ccd98e391dd5f2670d4deeb897e0870`, whose direct parent is
`e39d73e871efdb7687c0ee14df0ce60e1933fb4c`. Remote:
`https://github.com/Webcanbe/webcanbe-real.git`. No staged changes. The previous
model left an uncommitted partial compiler transport refactor in
`src/webcanbe-engine/runtime/isolatedPreview.ts`. It was inspected in full before
further implementation. It contains an undefined `app` variable, a syntax error,
router detection that misses nested source files, a weakened Blob router guard,
unnecessary filesystem output, and HTTP scripts placed before the root mount.
Useful compiler/artifact separation will be preserved and repaired. No reset,
restore, blind overwrite, main merge, or original iCloud repository action occurred.

## Threat boundary recorded before resumed implementation

Uploaded browser code and preview messages are untrusted. The trusted editor/API
alone holds the operator key and source-mutation capability. Existing dedicated
package/version/integrity checks, static config interpretation, confined compiler,
revision-bound source transactions and export remain authoritative.

An HTTP profile requires a server-owned artifact registry with a separate origin
for each project/session, authorized creation and artifact reads, expiry/revocation,
bounded resources and cleanup. No uploaded Node configuration may execute in the
trusted server. Preview credentials, if needed, may authorize only artifact reads;
cookies require hostname isolation because TCP ports do not isolate cookies.
Host, resource paths, reserved routes, response MIME types, SPA fallback, native
History behavior, and bridge source/origin/session/generation all require tests.

Before exposing any new listener to imported code, test the proposed iframe/CSP
policy in Chromium. Native path navigation must work, while preview code must
remain unable to access parent DOM/tokens, other previews, platform APIs, external
network, persistent workers or top-level escape. An iframe's ability to navigate
itself is a separate boundary from fetch/image/script CSP. Use only synthetic data
and controlled loopback collectors for these probes. A browser policy that cannot
enforce the requested boundary must remain disabled and be reported as a blocker.

Full-product requirements in the phase documents and recovery report remain open
and unchanged by this bounded checkpoint. Imported rebuild/reload is not HMR.


## Completed repository audit

- Work was performed in the existing recovery checkout on branch `phase-2-compatible-editor`, not in the original iCloud repository.
- Starting HEAD: `b4438a999ccd98e391dd5f2670d4deeb897e0870`; its direct parent is the requested implementation parent `e39d73e871efdb7687c0ee14df0ce60e1933fb4c`.
- Remote: `https://github.com/Webcanbe/webcanbe-real.git`. The initial remote branch tip matched starting HEAD. Initial remote main: `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`.
- Ran the requested status, unstaged diff and staged diff audit before implementation. There were no staged changes. One pre-existing partial edit in `runtime/isolatedPreview.ts` was inspected and preserved where useful.
- That partial edit was not a completed HTTP implementation: it contained an undefined application variable, a syntax error, incomplete history-router detection, a weakened Blob rejection, lost controlled tsconfig handling, unnecessary filesystem output and HTTP script ordering problems. The shared compiler/artifact separation was retained and repaired rather than blindly restored or overwritten.
- Required project records, current handoff, phase documents and relevant runtime, bridge, mapping, mutation and regression files were read. Committed reports were used as the baseline, not old Documents output directories.
- No reset, restore, discard, force-push, main merge, dependency upgrade, public import deployment or paid infrastructure change was performed.

**Exact remaining blocker:** browser-side WebRTC/RTC networking can bypass the currently relied-upon CSP network restriction, so the HTTP preview remains disabled until there is a tested defense-in-depth solution.

## Threat boundary and admission decision

The trusted editor/API owns the operator key, source-session capability, project registry and mutation authorization. Uploaded browser code is adversarial. Generated mappings and messages are observations, not authority to read arbitrary files or write source. Uploaded Node configuration/plugins must never execute in that trusted process.

The intended HTTP boundary uses a unique host per generation, an artifact-only server-owned registry, read-only session credentials and two opaque iframe layers. It is not a path under the editor origin, a port-only cookie boundary, a generic filesystem server, a URL proxy or an uploaded Vite server. The compiler uses the existing platform dependency profile and static supported configuration grammar; it does not execute uploaded configuration.

### Native browser policy experiment

Tested with Playwright and Chromium `153.0.8010.12`, explicitly using `chromiumSandbox: true` in the committed verification scripts:

| Policy | Native pathname push/replace | Parent DOM/storage | Cross-origin self-navigation request |
| --- | --- | --- | --- |
| HTTP, opaque `allow-scripts` | Works | Denied | Sent without parent confinement |
| HTTP, `allow-scripts allow-same-origin` diagnostic only | Works | Parent denied; own storage available | Sent without parent confinement |
| HTTP, exact parent `frame-src` | Works | Denied | Blocked before request |
| HTTP inside platform-owned opaque Blob envelope | Works | Denied | Blocked before request |
| Existing parent-derived opaque Blob | Pathname changes throw SecurityError | Denied | Sent without parent confinement |

No `allow-same-origin` was added to the real editor iframe or to the HTTP prototype. The original BrowserRouter can use native History API in an opaque HTTP document; an origin-bearing iframe is not needed for that behavior. The editor route remained unchanged. Native history was observed, never replaced, monkey-patched or simulated.

**Blocking result:** a synthetic loopback-only WebRTC/STUN probe received **three UDP packets** from an opaque HTTP iframe despite `connect-src 'none'`, disabled workers/frames and the attempted `webrtc 'block'` directive. Chromium reported that directive as unrecognized. The committed policy test intentionally exits **2**, not zero, for this result. CSP fetch/resource restrictions are not a complete network-egress boundary.

A local macOS network-only sandbox experiment allowed one loopback TCP listener and denied other TCP and UDP traffic. It rendered only with Playwright's default native-browser-sandbox-disabled mode, which was rejected as an acceptance result. Retaining `chromiumSandbox: true` caused Chromium helper sandbox initialization failures (Operation not permitted), network/GPU process crashes and a Playwright session assertion. This experiment was not turned into a product runner, and the native browser sandbox was not disabled to manufacture support. Docker, Podman and Lima were not available on PATH.

**Precise missing capability:** an approved browser execution environment that enforces all network egress, including WebRTC, while retaining the browser's native sandbox, plus server-owned admission/attestation binding that environment to the preview session. A client-provided flag, CSP, localhost, CORS or a secret URL cannot substitute for it. An arbitrary external iframe embedding is also not proof that the intended confinement envelope is present; a future broker must enforce the admitted execution path.

The editor plugin therefore does not instantiate or import `HttpPreviewServer`. History-router requests return an explicit `http-network-boundary` compatibility error. Supplying `transport: http`, `allowUnsafe` or `runnerApproved` does not open the gate. Source inspection and export remain available on rejected previews.

### Correction to historical networking claims

The Phase 2B resource/fetch CSP, opaque-origin parent separation and mutation authorization remain in place and their regressions pass. The new probes expose inherited Blob self-navigation and WebRTC limitations; historical wording such as "offline" or "all networking disabled" must not be interpreted as an enforced hostile-code network sandbox. This report does not retroactively turn Phase 2B into a hosted/security acceptance pass. Only authorized local projects should be used with the retained local workflow.

## Exact implementation changes

| Area | Changes and active status |
| --- | --- |
| `runtime/isolatedPreview.ts` | Shared controlled compiler behind Blob/HTTP transport boundary. Retained Blob BrowserRouter rejection; recursive static import/re-export/namespace detection. Retained pinned manifest/lockfile/version/integrity checks, confined resolver, static config grammar, `tsconfigRaw: {}`, temporary AST instrumentation and no host dependency fallback. In-memory artifacts, absolute HTTP asset URLs, public inert-asset allowlist and 15-second cancellable esbuild context. |
| `runtime/httpPreviewServer.ts` | **Dormant prototype only.** Registry-bound read-only artifact listener, unique generation host, ticket/cookie authorization, typed resources/SPA routing, lifecycle/resource limits and teardown. No production endpoint enables it. |
| `runtime/previewEnvelope.ts` | **Dormant prototype only.** Trusted opaque wrapper with exact child-origin `frame-src`, nested `allow-scripts` iframe, bounded ready/expiry behavior and source/origin/session/generation-checked forwarding. |
| `bridge/previewSecurity.ts` | Shared precise UI/API networking notice and explicit disabled-HTTP blocker; no all-egress CSP guarantee. |
| `bridge/previewRoute.ts` | Bounded local path/query/hash validation; never an upstream URL. |
| `bridge/previewProtocol.ts`, `runtime/previewBridge.ts` | Generation-bound observations, stricter source identity/geometry/payload validation, route observation without changing native history, selection geometry updates and invalidation scaffolding. Legacy shape checks remain for compatibility; live editor requires exact generation. |
| `runtime/projectRegistry.ts` | Server-side session liveness/expiry lookup and revocation, retaining existing scoped capability/root checks. |
| `runtime/viteFixturePlugin.ts` | Fail-closed HTTP admission, generation/revision on Blob responses, explicit stop/revocation and stale source/inspect rejection. Existing operator key, Host/Origin, session capability and mutation checks retained. |
| `visual-editor/CompatibleWorkspace.tsx` | Generation-keyed iframe and Blob URL cleanup, source/origin/session/generation validation, stale asynchronous selection/connection guards, stop/state handling and dormant HTTP local-route restoration UI. Existing source transaction/history/export pipeline reused. No landing/auth/marketplace redesign. |
| Fixtures/tests/scripts | Two ordinary authored BrowserRouter fixtures; 26 additional tests; reusable native-sandbox browser policy/artifact/editor-boundary/export/Field Notes verification scripts. Existing Phase 2B browser script now explicitly retains Chromium's native sandbox. |

Imported updates are still **rebuild/reload, not HMR**. No application router, routes, basename, window/history or package/config files are rewritten merely to open a preview.

## HTTP prototype profile, routing and artifact policy

The existing dedicated `react19-vite6` profile is retained. Tested fixture pins: React/React DOM `19.3.0`, React Router DOM `7.18.3`, Vite `6.4.3`, React plugin `4.3.4`. Existing supported Phase 2B profile capabilities include Tailwind `4.3.3`, TypeScript `5.9.3`, clsx `2.1.1` and classnames `2.5.1`, subject to the existing manifest/lockfile/integrity and static-config gates. Toolchain actually used: Node `26.4.0`, TypeScript `5.9.3`, esbuild `0.25.12`, Vite `6.4.3`. No framework was upgraded.

Each prototype generation has a new `http://wcb-<generation>.localhost:<server-owned-port>` host. The listener binds explicitly to `127.0.0.1`; request Host must match an active registry entry. TCP ports do not isolate cookies, so hostnames, not different ports alone, are the cookie boundary. A one-use 256-bit ticket, stored hashed and expiring after 30 seconds, exchanges for a distinct preview-read cookie. The cookie is host-only `__Host-wcb-preview`, `HttpOnly; Secure; SameSite=None; Partitioned; Path=/`. The ticket/cookie never grant source writes, editor access or another preview's reads. Partitioned secure localhost cookies were exercised in the real nested opaque Chromium iframe, including asset loading and hard refresh; other browser engines are not certified.

Every artifact request checks the current registry/session/root/expiry and read credential. No wildcard CORS/Host policy, editor credential, filesystem path, uploaded plugin runner, open upstream URL or WebSocket transport is provided. Bootstrap redirects to the requested path/query/fragment; subsequent navigation uses the app's original router. Fragments are browser-side and are not sent as HTTP request targets.

SPA fallback requires an authorized permitted HTML iframe navigation: `Accept: text/html`, navigation mode, iframe destination and an extensionless nonreserved path. Missing scripts, styles and images return non-HTML 404, never a 200 entry document. Dotfiles, private source/config/lock/map paths, control/API prefixes, traversal, double encoding and malformed paths are denied, not SPA fallbacks. Requests are resolved only against the build's in-memory artifact map, not the filesystem. Standalone top-level execution from this prototype listener is not a supported mode; independent exports are tested separately.

HTTP artifacts use absolute `/_wcb/` bundle paths and absolute imported asset URLs. Public copying is limited to ordinary image/font formats; uploaded scripts, configs, source maps, metadata and symbolic links are excluded/rejected. This is not arbitrary Vite/public-directory compatibility. Public assets larger than 2 MiB, more than 2,000 files or builds over 32 MiB are rejected. Path spaces, extensionful client routes, arbitrary Unicode route strings, arbitrary asset types, dynamic/router-import patterns beyond the static supported compiler profile and broader configurations remain unsupported or unverified. Existing explicit React Router basename is preserved; it is not inferred into a new Vite base or forced onto the source.

Prototype limits are four active previews, one reserved concurrent compiler, 100 retained session records, 32 connections, 32 request headers, five-second request/header timeouts and one-second keepalive. Start reserves capacity before asynchronous listener startup. Source sessions expire after at most the existing ten-minute lease. Stop, expiry, revocation, restart and close remove live host mappings, read secrets and artifact buffers. Hosts/generations are not reused, responses are no-store, and a closed server instance cannot restart. Already delivered bytes cannot be revoked from a recipient's memory. Session leases and server-side checks, not client unload callbacks, are authoritative. Durable tenancy quotas and hostile-browser CPU/memory/process containment are still open.

## Authored fixtures and observed routes

These are **newly authored unannotated fixtures, not independent external-project evidence**. Both keep ordinary React entrypoints, original BrowserRouter declarations and route/config/package files. The chosen pinned dependency metadata follows the existing supported profile; no pre-existing external app was modified to obtain a pass.

| Fixture | Tested native paths and features |
| --- | --- |
| `fixtures/coast-paths` | Root `/`; nested parameter `/places/42?mode=quiet#details`; navigate to place 7 with a changed query; Link/useNavigate; back/forward; direct entry and hard refresh; public compass SVG and imported SVG on deep paths; own `/not-on-the-map` screen; CSS Modules and text edits. |
| `fixtures/harbor-desk` | Original literal `basename="/desk"`; root `/desk/`; nested `/desk/projects/23?tab=notes#summary`; navigate to project 24; Link/history/refresh; public badge image; own `/desk/missing` screen; text and CSS edits. |

The prototype browser harness selects actual rendered source identities, calls the real source store/mutation/history/export functions from the trusted QA process, checks the actual source diff, rebuilds and restores the nested route/query/anchor, and verifies undo/redo. It also checks selection geometry after layout/scroll/resize. This validates compiler/bridge/transaction composition; it **does not** replace the requested end-to-end editor UI acceptance. That full BrowserRouter editor sequence remains blocked because the API deliberately refuses HTTP admission.

## Validation commands and results

Commands were run in the recovery checkout. The example variables below stand for private local QA destinations; no operator keys, session capabilities, bootstrap URLs or private development logs are committed. Set `WCB_PLAYWRIGHT_MODULE` to an installed Playwright module if it is not resolvable normally. The actual tool was the locally installed Playwright module shipped with the Playwright MCP package, controlled through Node scripts, not a claimed UI automation or Codex Security service.

```sh
npm test
npx tsc -b
npm run build
npm run dev -- --host 127.0.0.1 --port 5183 --strictPort
node scripts/verify-phase2b-browser.cjs "$QA/phase2b" "$PRIVATE_DEV_LOG" http://127.0.0.1:5183
node scripts/verify-field-notes-browser.cjs "$QA/field-notes" "$PRIVATE_DEV_LOG" http://127.0.0.1:5183
node scripts/verify-phase2c-editor-boundary.cjs "$PRIVATE_DEV_LOG" http://127.0.0.1:5183
node scripts/verify-phase2c-artifacts.cjs "$QA/http-artifacts"
node scripts/verify-phase2c-policy.cjs "$QA/policy"
python3 scripts/verify-export-sandbox.py "$QA/http-artifacts/coast-paths-edited.zip" "$QA/coast-build"
python3 scripts/verify-export-sandbox.py "$QA/http-artifacts/harbor-desk-edited.zip" "$QA/harbor-build"
node scripts/verify-phase2c-export-render.cjs "$QA/coast-build" "$QA/harbor-build" "$QA/standalone"
node scripts/verify-phase2c-editor-regressions.cjs "$QA/editor"
git diff --check
```

| Validation | Observed result |
| --- | --- |
| Unit/security/runtime suite | **95 tests pass in four suites**, including all existing 69 and 26 added cases; final full run 3.13 seconds. |
| TypeScript + production build | `npm run build` exits 0; TypeScript check succeeds; Vite builds 59 modules, CSS 306.11 kB and JS 415.96 kB; 2.52 seconds. |
| Existing HashRouter regressions | Trail Atlas and Studio Ledger pass real editor import, supported profile/assets/routes, text/style source patches, diff, reload, undo/redo and export. |
| Field Notes browser regression | Final committed generalized harness exits 0: real source text, CSS Modules, inline style, Tailwind, responsive CSS/Tailwind, diff, undo/redo, export, desktop/mobile viewport and parent/API guards. |
| Editor bridge/stop boundary | Exits 0: wrong source/origin, sibling opaque frame, stale generation, forged session and malformed geometry rejected; real hover positive control works; parent token inaccessible; stop/reconnect revokes/replaces URL; editor route unchanged. |
| Authored HTTP prototype | Both fixtures pass root/nested/parameter/query/anchor/navigation/history/direct-refresh/assets/unknown screen/source transactions/export/geometry checks. Production HTTP enabled = false; full editor nested-route acceptance = false. |
| HTTP authorization/resources | Unit cases cover project A credential denied for project B, invalid/expired/revoked session, replayed/expired ticket, duplicate cookies, forged Host/method, reserved/encoded/filesystem paths, typed missing resources, stop/rebuild/expiry stale artifacts, failed compilation/capacity, concurrent startup and closed registry. |
| Browser policy | **Expected exit 2, blocking admission.** Native HTTP History works; opaque parent/storage/top-navigation/fetch denials hold; wrapper prevents cross-origin self-navigation; WebRTC sends three UDP packets. |
| Independent export builds | Both archives build under the existing macOS isolated export runner; read/write/exec/network-denial probes all true. Original Node config runs only in this sandbox, not the trusted editor. Coast: 44 modules, JS 265.88 kB, CSS 0.66 kB, 497 ms. Harbor: 41 modules, JS 264.38 kB, CSS 0.32 kB, 529 ms. |
| Independent export rendering | Both built `dist` outputs render without the editor at 1280x900 and 390x844; nested query/hash, root/history/refresh, assets, edited text and 40px padding verified; no source instrumentation or runtime errors. |

The first artifact-browser run hit a navigation-wait race in the test harness; it was corrected to wait for real frame navigation and rerun successfully. The first Field Notes run used an ambiguous viewport selector; the harness selector was corrected and the final committed generalized script was rerun successfully. These were harness failures, not silently counted as passes. The native-browser-sandbox failure and WebRTC policy failure remain failed evidence, not harness successes.

For the final rerun, `verify-phase2c-editor-regressions.cjs` started the unchanged trusted editor plugins with the existing server-owned registry injection seam, a fresh temporary registry and the same loopback/Host/filesystem policy. It ran both existing HashRouter scripts, Field Notes and the focused editor-boundary checks, then closed Vite and removed only its owned temporary registry, private log and generated QA module. This is test-only orchestration, not a production transport or security bypass. The import registry was not purged to make tests pass. Existing/user imports were retained. QA uses a bounded fresh registry for the HTTP prototype and ephemeral local build jobs for exports. Only owned test listeners/browser processes are cleaned up; this is not a deployment.

### Durable committed evidence

- [Final test/build/verification summary](phase2c-evidence/verification-results.json)
- [Final HashRouter/Field Notes/overlay/security editor results](phase2c-evidence/editor-results.json)
- [Prototype routing/transaction results](phase2c-evidence/prototype-results.json)
- [Native History/CSP/WebRTC policy results](phase2c-evidence/policy-results.json), with ephemeral collector port redacted
- [Independent standalone render results](phase2c-evidence/standalone-results.json)
- [Coast nested edited render](phase2c-evidence/coast-paths-nested.png)
- [Harbor standalone mobile render](phase2c-evidence/harbor-desk-standalone-mobile.png)

Rendered content was inspected, not HTTP 200 alone. The screenshots show the edited nested heading, parameters/query/anchor where present, working navigation and loaded public/imported imagery. Field Notes desktop and the basename mobile render were visually inspected; screenshots containing editor runtime IDs/private operator UI were deliberately not committed. Raw private logs, imported copies, export archives and temporary dependencies are not the authoritative report and are not committed. The scripts and authored fixtures reproduce those checks locally.

## Independently authored authorized project search

No independently authored project matching this narrow installed profile was established. Two official React Router candidates were checked without modifying their dependencies/router/config:

- [Official basic example manifest](https://raw.githubusercontent.com/remix-run/react-router/main/examples/basic/package.json): declares React 18.2, React Router DOM 6.15, Vite 4.0.4, React plugin 3 and TypeScript 4.9.5 ranges, plus dependencies outside the profile. It was not relabeled compatible or executed after alterations.
- [Official JavaScript framework template manifest](https://raw.githubusercontent.com/remix-run/react-router-templates/main/javascript/package.json): declares React Router framework/node/serve/dev 7.16.0, React 19.2.6 range and Vite 8.0.3 range. Framework/server configuration and dependencies do not match the supported declarative-router profile. It was not rewritten into a passing fixture.

These are candidate-origin/version records as observed on 2026-09-13, not successful external import evidence. That validation gate remains open.

## Documentation basis and version discipline

- Installed official React Router `7.18.3` package declarations/JSDoc for BrowserRouter and basename were read. They describe use of native browser History API. This was the exact-version reference; version-specific remote pages were unavailable, and the Context7 result pointed at newer/main documentation rather than this installed version.
- [Official BrowserRouter documentation](https://reactrouter.com/api/declarative-routers/BrowserRouter) was used for general API context, not as proof of an exact-version runtime pass.
- [Vite 6 static asset handling](https://v6.vite.dev/guide/assets.html) and [esbuild public path documentation](https://esbuild.github.io/api/#public-path) informed artifact/public-path handling; installed compiler/build behavior was then tested.
- [HTML navigation/history specification](https://html.spec.whatwg.org/multipage/browsing-the-web.html), [CSP Level 3](https://www.w3.org/TR/CSP3/), [iframe sandbox reference](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe) and [Set-Cookie reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie) informed the policy experiments. Browser probes, not documentation assumptions, determine the gate result.

## Security-focused review and remaining work

A manual security-focused review inspected listener reachability/binding, unique origins and cookie scope, registry authority, bootstrap/replay/expiry/revocation, raw resource paths/fallbacks, source mutation authority, bridge envelopes and lifecycle. **Codex Security did not run.** The review included executable policy and adversarial tests rather than a claim of an exhaustive external security assessment.

Review-driven hardening includes startup capacity reservation before await, prohibition on restarting a closed registry, unconditional production HTTP rejection without a second transport-selection race, connection/inspection epochs for stale async work, source-revision checks and Unicode-safe source identity validation. Reader credentials are unrelated to operator credentials. The compiled child and wrapper contain only public session/generation identity and preview-read bootstrap information, never the editor key or source-write capability. All live editor bridge observations must match source window, opaque origin, session, generation and validated payload; they cannot invoke source mutations. Mutations continue through authenticated explicit user actions and revision-checked server transactions.

The operator approved the two final review fixes before commit. Hash and HTTP route changes now clear bridge selection/hover/drag state and send a generation-bound clear observation. The editor independently invalidates its overlay, inspector, deduplication key and in-flight inspection sequence on an actual route change. Duplicate route observations retain a current selection. Source revisions, identities, mutation authorization and iframe permissions are unchanged. Focused browser coverage verifies a retained DOM node, a deliberately delayed inspection response, scroll/resize, fresh reselection and duplicate-route stability; both actual HashRouter applications also select before navigating and verify stale source controls/geometry disappear.

The security notice is now persistent, including after inspection, and states only the verified opaque parent/storage and CSP fetch/resource boundary. It explicitly warns that CSP does not block all browser egress, including WebRTC/RTC networking. Both the disabled-HTTP API error/status and UI say a tested defense-in-depth solution is required. Two additional unit tests cover this wording, and the browser checks the rendered notice. No sandbox permission, CSP directive, dependency or HTTP admission gate was weakened.

The first delayed-inspection harness attempted a location.hash assignment that did not navigate the opaque Blob; bounded diagnostics showed no route event and an unchanged hash. The harness now uses the native fragment history.pushState operation used by HashRouter, explicitly asserts that navigation occurred, and then tests invalidation. The corrected complete editor regression run exits zero. This is a harness correction, not a router/history replacement in the application.

To complete Phase 2C, resolve the approved runner/admission boundary without weakening the native browser sandbox; bind artifact creation/access and the immutable compiled revision to that admitted execution; integrate the dormant transport through the existing editor pipeline; run the full real nested-route editor select/edit/source/diff/reload/undo/redo/export sequence; repeat cross-session/network/cleanup attacks in that environment; and validate an unchanged independently authored authorized compatible project if available. Broader-browser cookie/network policy behavior remains unverified. Do not enable the prototype merely by deleting the rejection or accepting a client claim of isolation.

## Full scope preserved

This checkpoint does not redefine overall Phase 2 or reduce the product. All remaining requirements in the existing phase/project documents remain open: broader dependencies and configuration/Tailwind support; responsive authoring; semantic gestures; editable Code UI; durable and multi-file history; genuine imported-project HMR; hosted ownership, resources and hostile-code isolation. The full product-experience/navigation/seller/footer/Docs plan remains required, alongside landing, dashboard, auth and marketplace work at their planned stages. None was deleted, replaced by this runtime task, redesigned or marked complete here.

## Publication

Implementation and validation checkpoint: **`4a6520f795e52bff2ccebabd1ea13274dfe85466`**, directly descended from starting HEAD `b4438a999ccd98e391dd5f2670d4deeb897e0870`. A normal push to `origin/phase-2-compatible-editor` succeeded. `git ls-remote origin refs/heads/phase-2-compatible-editor refs/heads/main` verified that exact checkpoint at the remote branch and unchanged main at `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. The working tree was clean after that push.

This accompanying documentation-only receipt records the verified publication; it changes no tested code. The receipt's final remote tip is checked again on delivery. The staged checkpoint scan covered 51 files, checked all four known private development keys, and found no known-key, private runtime path or credential-pattern matches. Only authored app screenshots and sanitized result data were committed, not operator logs, session credentials, imported project copies or export job directories.

The failed all-egress policy probe remains a blocker, not a functional regression hidden as a pass. No main merge, force-push, public deployment, sandbox relaxation or speculative WebRTC workaround was performed. Work stops after this safe checkpoint and publication receipt.

PHASE 2C HTTP/BROWSERROUTER CHECKPOINT: NOT YET
OVERALL PHASE 2: NOT YET
PUBLIC HOSTED IMPORT READY: NO
