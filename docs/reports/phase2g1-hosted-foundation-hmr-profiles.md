# Phase 2G.1 — Hosted foundation, controlled incremental preview, runtime profiles

Date: 2026-09-14. Bounded local checkpoint, not production hosting.

**PHASE 2G.1 HOSTED FOUNDATION + HMR + PROFILE CHECKPOINT: PASS**

**OVERALL PHASE 2: NOT YET**

**PUBLIC HOSTED IMPORT READY: NO**

The source-first editor now has an injected account/session and membership boundary, actual local SQLite authority/artifact/lease adapters, controlled-provider scheduling, imported CSS hot updates and module incremental rebuilds, and two additional explicitly pinned runtime profiles. The existing local Lima provider remains the real execution boundary and regression path. React module updates reload the document; they are not React Fast Refresh or module HMR. No real hosted provider, identity provider, distributed source store, production DNS or public import service was exercised.

## Repository and preflight

Work began in the requested recovery repository on `phase-2-compatible-editor`, with a clean working tree and local/live feature HEAD `52ada8d8a4a6d618d2b7202ec5780166fe35733a`. Origin was `https://github.com/Webcanbe/webcanbe-real.git`. Verified ancestry included `247d8ec83af3a83b766228f6325b2dd5983ec5e1`, `1a825e9b9107840a0faf00c24b9754f6c5fd3527` and `fac8339e86ca2e0a6395f73b922917fdc1a41de6`. Live main and `origin/main` remained `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`; there is no local main branch.

Before edits, read `AGENTS.md`, current handoff, project record, Phase 2/2B documentation and every recovery/2C/2C.1/2C.2/2D/E/2F report. Inspected actual registry, API, authorization, durable source/history, import/export, compiler/configuration, provider, launcher/worker/stop, raster viewer and editor rebuild paths. Implementation commit: **401450f88162d46c1291544d4b8f101e5702d993**. Documentation/evidence follow in a separate commit; this report does not embed its own commit ID. Only the feature branch is published, without force or merge.

## Authority, sessions and roles

`hostedAuthority.ts` defines distinct opaque user, workspace/team, project, runner-session, generation and revision identities and project roles `owner`, `editor`, `viewer`. Platform seller/reviewer/admin/bigperson roles remain separate and unimplemented. Imported project IDs, account/session IDs and generations are UUIDs; canonical revision IDs remain the existing durable-source identities. The historical `phase1-fixture` identifier is local-only and cannot pass hosted project-ID admission. Public project records omit filesystem roots and history internals.

`SqliteAuthorityStore` uses actual SQLite WAL and FULL synchronous writes. It stores hashed session/CSRF tokens, session expiry/revocation, workspace membership, project ownership and project membership. A grant requires an active authenticated session, active membership in the authoritative project workspace, active project membership and the requested project operation. Workspace and project membership versions prevent an old capability from becoming valid after removal/regrant or role changes. Session/token, project-capability and runner ownership checks happen server-side; supplied project/workspace IDs are selectors, never proof.

`issueVerifiedSession` is a trusted provisioning seam for an eventual verified identity provider. There is no browser endpoint accepting a user ID as authentication, and no product login UI. Account sessions expire within ten minutes, can be revoked, and are bounded to 20 per user/1,000 overall. The hosted HTTP seam requires the `__Host-wcb-session` cookie, a session-bound CSRF header, POST JSON, exact configured Host/Origin and an encrypted socket. The cookie is Secure, HttpOnly, SameSite=Strict, Path=/, with no Domain. Duplicate session cookies and editor/preview/runner credential confusion are rejected. Forwarded headers are not an implicit TLS or host attestation.

The Vite QA adapter accepts an explicit `HostedSessionBoundary` plus controlled provider, lease store and artifact store. It has no local operator-key fallback in that mode. It binds each project capability to the exact account session and current membership epoch. Every source/inspect/files/validation/history/checkpoint/revert/undo/redo/Code/visual mutation, preview action, runner allocation, artifact lookup and export uses the same authorization. Responses, including rejected validation diagnostics, are rechecked after asynchronous work; source commits recheck inside the existing source transaction. Import requires workspace write membership, assigns ownership on the server, rechecks after extraction and discards the import if ownership registration fails. Listings contain only currently authorized projects. Browser-supplied user, role and source-root fields are rejected.

Owners/editors can use the write operations; viewers can inspect, read history/source, preview and export, but cannot write or checkpoint. All users still need project membership; workspace membership alone does not grant project access. Role-management/provisioning methods are server-only seams, not new public administrative APIs. The existing local operator key remains confined to the local development path. Hosted editor credentials are not placed in localStorage. Project capabilities remain in trusted editor memory; the raster viewer and project runner receive neither account cookies nor editor mutation credentials.

## Storage and secrets

| Boundary | Implemented adapter / invariant | Remaining hosted work |
| --- | --- | --- |
| `ProjectSourceStore` | Existing real files, hashes, CAS, preparation, lease and commit through injected `ProjectStoreFactory` | Durable hosted implementation and private compiler materialization |
| `RevisionHistoryStore` | Existing journal/ledger, retry/revert/rejection, combined with source in `ProjectPersistence` | Distributed transaction/recovery, retention and migration |
| `ArtifactStore` | Actual SQLite immutable snapshot blobs, full workspace/project/revision/generation/digest key, digest verification on write/read | Real object backend, access controls and lifecycle evidence |
| `RunnerProvider` | Existing `LocalLimaRunnerProvider` plus scheduling wrapper and explicit revoke contract | A real hosted isolation provider implementing the contract |
| `SessionLeaseStore` | Actual durable SQLite allocation state and exclusive controller lease | Multi-host admission/fencing and distributed recovery |
| Auth/membership stores | Actual local SQLite session and membership lookups | Verified identity integration and durable hosted operational lifecycle |

Source and history deliberately stay in one commit/recovery domain; an adapter must not independently commit a blob write and a history record. The new interfaces do not replace files with canvas JSON or change canonical source authority. The present factory is synchronous and still materializes a private filesystem checkout for compiler/export work. It is an explicit replaceable boundary, not a completed remote database/object-store implementation.

Artifact reads require a live project grant and the full ownership tuple. A known SHA-256, guessed bucket/key or other project's identical content is insufficient. Stored bytes are recomputed against the digest; immutable conflicts fail. Snapshots are at most 32 MiB/2,000 files, with an additional serialized-store bound and 16-artifact workspace limit. Only the internal controller can retire artifacts after membership revocation. Accepted updates replace the stored revision/digest reference; obsolete records are retired. Project/source path traversal, symlink, archive and export guards remain in place. No browser API exposes backend bucket keys or filesystem paths.

`previewSecrets.ts` separates development, preview and production environments. A server-policy grant names a particular project/account session and at most 16 `WCB_PREVIEW_*` values; fresh project authorization and exact project/session checks precede reads from the preview environment only. Unknown, oversized or absent values fail. Known-value redaction handles raw, URL-encoded and base64 values before truncation. The broker redacts its known capability from observations; API errors redact known editor credentials and private paths.

**No actual secret store or delivery channel is configured. The runner receives zero project or platform secrets by default.** This checkpoint establishes and tests the grant/redaction seam; it does not claim cloud secret-manager or secret delivery validation. Enabling delivery later must connect that grant to the isolated provider and apply its values to all log/error redaction paths. Browser-runtime values can be read by that project's code and pixels and must be scoped accordingly. Database admin, payment, editor, platform and unrelated project credentials must never be delivered. Stored secrets are outside source/history and are not included in exports; ZIP admission continues to reject `.env` and credential-bearing infrastructure content.

## Scheduling, resource ownership and recovery

`ScheduledRunnerProvider` wraps the provider instead of hardwiring editor logic to Lima. Each allocation binds the user, workspace, project, preview session, generation, immutable snapshot, request hash and idempotency key. It accepts the supported fixed resource budget: 1,536 MiB memory, 150% CPU, 192 tasks and 32 MiB artifacts. Startup is bounded to 15 seconds, execution to 60 seconds, and idle expiry to at most 60 seconds. Input/updates count as activity; polling raster frames does not extend an idle lease. HMR/reloads do not extend the generation deadline.

Admission is bounded to four jobs globally, two per workspace and two per project; the broker also conservatively serializes pending startup. Unsettled and quarantined allocations consume capacity. A retained allocation request must match its original hash and ownership; replay cannot steal a job or resurrect a stopped allocation. Lease records are capped at 10,000 until operator retention maintenance. Existing import and preview-session caps remain conservative local limits, not fair distributed quotas.

The SQLite controller writer lease is held for the process lifetime and released by the kernel on crash. A new controller first revokes durable unsettled allocations and verifies cleanup before admitting work. This prevents a second local controller from stealing active jobs; it is not a distributed consensus implementation. The provider revoke contract includes a durable cancellation tombstone, process-tree cleanup and verification. The existing Lima fixed launcher/stop path implements that contract. Late startup is closed; revoked/expired owners and stale asynchronous worker responses fail closed. Failed/uncertain cleanup persists quarantine, blocks new admission and requires operator recovery. Server shutdown closes held-update generations too and reports uncertain cleanup without leaving the viewer open.

The real provider retains the no-host-mount VM, private network/PID/filesystem namespaces, Chromium native sandbox, socket-family restrictions, cgroups, external watchdog and fixed private stdio protocol. No source root, editor cookie/key or project write capability enters the job. Local scheduling doubles prove state-machine behavior only; the actual Lima probes separately prove the exercised local isolation/resource boundary.

## Viewer, origins and cookie assumptions

Imported JavaScript continues to run only inside the controlled Linux browser in strict/hosted mode. The ordinary browser receives platform-owned raster presentation, PNG frames and sanitized observations. It never receives executable imported module updates, artifact URLs, runner credentials or source mutation authority. Fresh generations use fresh private browser storage. Same-generation CSS/module updates intentionally retain storage within that project's already authorized session; storage is not shared across projects or sessions.

The production policy requires separately configured HTTPS editor and viewer **cookie sites**, not merely random ports or sibling hostnames. `hostedRasterViewerDocument` accepts messages only from the exact configured editor parent and contains no project HTML, fetch API, cookies or storage access. The configured hosted viewer URL carries no capability. The local raster viewer and sandbox behavior remain tested; hosted serving must apply the existing restrictive viewer CSP and sandbox contract.

The operator must validate configured site names against the public suffix list; taking the final two hostname labels is insufficient. The current parser validates configured relationships but is not a DNS/PSL provisioning service. Real DNS, TLS termination/proxy attestation, CDN behavior, browser cookie handling across deployed sites, per-project viewer routing and production CSP headers are **UNPROVEN**. HTTP QA injects `localQa=true` in test code only to exercise Host/Origin/CSRF policy on loopback. Production mode refuses a cleartext socket. Local browser tests do not pretend that injection is a deployed Secure-cookie login flow.

## Imported update behavior

An accepted durable source revision invalidates the current selection immediately. The server holds an eligible same-session generation only long enough for a bounded update; stale source/frame/revision requests are still denied. Each compiler belongs to one preview session. esbuild retains its dependency/parse graph; byte-identical JSX transformations are cached with a bound. Builds reset byte counters and theme caches, compare configuration identity, and report changed source files. Changed configuration disposes old contexts. Full immutable output snapshots are digest-checked before the worker acknowledges the new revision. Frame sequence numbers remain monotonic across updates; they are not reset to permit replay.

| Accepted change | Actual path | Preserved state / limit |
| --- | --- | --- |
| CSS-only emitted difference, identical HTML/non-CSS artifacts | **CSS hot update**, stylesheet replacement inside the controlled worker; no process or document restart | Route, viewport, scroll and React component state remain |
| React/JS/TS module or CSS Module change that changes JS output | **Incremental rebuild + document reload** inside the same controlled job | Route, viewport, scroll and job-local storage remain; React state resets |
| File create/rename/delete, configuration fingerprint or incompatible graph/HTML/profile transition | **Full controlled generation restart** | Last known route and editor viewport restored where safe; new job/browser storage |
| Unsupported profile/configuration or stale/expired authority | Structured refusal; no permissive browser fallback | Invalid drafts retain prior accepted source/preview; uncertain update retires the job |

The worker independently verifies the old revision/digest and CSS-only invariant. It replaces styles in an isolated browser world, clears stale selection, and never asks imported code to validate authority. Module reload clears observations from the old document. Source/worker authorization is rechecked after compilation and acknowledgement; failure retires the job. No uploaded Vite HMR server, WebSocket credential, plugin or configuration execution was added to the trusted editor.

**True React module HMR/Fast Refresh is not implemented.** The safely equivalent path for this checkpoint is the measured incremental rebuild/reload. It must not be marketed or recorded as Fast Refresh. Broader state-preserving imported module HMR remains in final Phase 2 scope. Existing staged Code validation still performs a fresh confined compile before acceptance; this conservative validation cost is disclosed separately from the retained preview graph. No claim is made that every compiler pass visits only one file or that snapshots are transported as byte deltas.

## Runtime and configuration matrix

| Versioned profile | React / DOM | Vite / React plugin | TypeScript | Router | CSS / Tailwind | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| `react19-vite6` (unchanged) | 19.3.0 | 6.4.3 / 4.3.4 | 5.9.3 | 7.18.3 | CSS, Modules, default Tailwind 4.3.3; existing theme-directive rejection retained | All prior regression fixtures/tests |
| `react18-vite5-v1` | 18.3.1 | 5.4.21 / 4.7.0 | 5.9.3 | 7.18.3 | CSS, Modules; narrowly admitted literal Tailwind 4.3.3 themes | Unchanged official React 18 TypeScript starter |
| `react19-vite8-v1` | 19.3.0 | 8.3.0 / 6.1.1 | 6.0.3 | 7.18.3 | CSS, Modules; narrowly admitted literal Tailwind 4.3.3 themes | Unchanged official React 19 TypeScript starter and authored kitchen fixture |

New client allowlist entries are Zustand 5.0.8 and NanoID 5.1.16. The expanded profiles also pin clsx 2.1.1 and classnames 2.5.1, plus the exact declared types/lint/build tooling needed by the unchanged starters. Full package/version lists and manifest/lock SHA-256 values are in [runtime-profiles.json](phase2g1-evidence/runtime-profiles.json). Presence of a tool in a profile does not permit importing it into browser source or executing it on intake.

Selection is deterministic across an ordered, named profile list. Every declared dependency/devDependency must have a provided version satisfying its range. A single npm lock v2/v3 must match declarations, versions and integrity, including the selected transitive client graph. Unsupported locks, links, packages, mismatches and missing dedicated installations produce issues. A lockless starter is explicitly reported as lockless and uses disclosed profile pins satisfying its unchanged ranges. No uploaded install/lifecycle/postinstall/shell script runs. Profiles are installed by the operator with `npm ci --ignore-scripts`; resolution never falls back to editor `node_modules`.

Preview uses the confined platform compiler and declared browser packages, not any of these uploaded Vite dev servers. The independent export gate executes the actual selected Vite CLI and original config **only inside the existing macOS build sandbox**, with a clean environment, copied dedicated dependencies, network/filesystem/shell denial probes and a 45-second process-group deadline. Package scripts are not invoked.

The 2026-09-14 npm audit receipt reports zero advisories for the Vite 8 profile and two affected package records for Vite 5 (one moderate esbuild development-server advisory and one high Vite record covering development-server/Windows paths and its transitive esbuild advisory). See [profile-audits.json](phase2g1-evidence/profile-audits.json) for exact upstream advisory links/ranges. Those dev servers are not launched or reachable; the old Vite CLI runs only in the offline export sandbox. This is bounded legacy build compatibility, not an endorsement for deploying a Vite 5 dev server. No forced dependency upgrade or source rewrite was used to make the independent starter pass. An initial Router 6/NanoID candidate was replaced by patched explicit pins before final acceptance.

Configuration is reported separately as statically supported, safely translated, requiring isolated execution, or unsupported:

- Static Vite grammar supports declared zero-argument React/Tailwind plugin forms, explicit confined `@`/`~` alias objects using literal `fileURLToPath(new URL(..., import.meta.url))`, and bounded local base `/`, `./` or `/prefix/`. No AST node is evaluated as user code. Functions, plugin options, spread/computed config, arbitrary imports/statements, unknown behavior-changing fields and multiple configs are refused.
- JSONC tsconfig/jsconfig and up to eight explicit local references are inspected. Single-target path aliases must agree with Vite aliases; relevant supported client transform options are passed to the compiler. Extended configs, custom JSX runtimes/factories, decorators/metadata, conflicting transform settings and unsupported alias forms are refused. Semantic TypeScript checking remains an independent export/build gate; preview is transpilation.
- Static public environment constants are MODE=`production`, PROD=true, DEV=false, SSR=false, BASE_URL=the admitted base, and fixed `process.env.NODE_ENV`. Unknown/dynamic `import.meta.env` access produces a file-specific issue; platform environment values are never read into source.
- Local public assets, root asset imports, SVG/PNG and CSS Modules are supported by the confined artifact server/compiler. No remote asset/network exception is inferred.
- Expanded profiles admit only root, parameterless CSS-first `@theme` blocks containing literal custom properties alongside the declared Tailwind import. Dynamic functions, nested forms, scanning, plugin/config/reference/apply/custom-variant directives and JS Tailwind/PostCSS configs remain refused. Configuration discovery includes `.config.[cm]?[jt]s`, JSON and `.postcssrc` forms rather than silently ignoring them. The original profile's theme rejection is unchanged.

No new Vite 7, Tailwind 3, arbitrary dependency, arbitrary server/SSR, lifecycle, executable Vite/plugin or remote configuration support is claimed. These remain structured blockers and retained future scope. Configuration is never edited to manufacture compatibility.

Session responses keep runtime execution, per-element visual editability, Code editing, configuration support, security admission, export/build validation and hosted readiness separate. The inherited element score is explicitly visual-only; there is no project-wide percentage implying security or hosting readiness. Hosted readiness is always UNPROVEN/false in this seam. UI changes are functional update-status and stale-selection behavior only; no final product UI was redesigned.

## Corpus provenance

| Corpus | Classification | Source and preservation |
| --- | --- | --- |
| Existing Field Notes/Trail Atlas/Studio Ledger/coast/Code/responsive fixtures | **AUTHORED FIXTURE** | Retained regressions, not third-party evidence |
| `profile-kitchen` | **AUTHORED FIXTURE** | Ordinary React/TS/Router/Zustand/NanoID/CSS Module/static-theme/public-asset combination; explicitly labelled |
| `vite-react18-ts` | **INDEPENDENT PROJECT — official starter template** | `vitejs/vite`, create-vite@5.5.2, commit `73cd3c1de63d6f511b7a6003d0cb8079dd491176`, `packages/create-vite/template-react-ts/` |
| `vite-react19-ts` | **INDEPENDENT PROJECT — official starter template** | `vitejs/vite`, commit `99bd9d1d46153fa939f4a304cc0177db42e28776`, same upstream directory |

Every upstream template file is unchanged, including `_gitignore`, `_oxlintrc.json`, package manifests, configuration and assets. No lock was added to either template. Per-file upstream Git blob hashes and SHA-256 hashes, source URLs/commits and `modifications: []` are recorded in `docs/corpus`; complete upstream MIT licenses are retained there. Tests verify exact bytes before compilation and ZIP intake. Browser acceptance renders both through real Lima, verifies unchanged source again and exports it. The standalone build/render gate uses those exports unchanged. Private telemetry exists only in disposable authored QA copies and is removed through Code before export; it is not added to the independent projects or committed source.

These are independently authored **starters**, not independently authored full applications. They do not establish broad external compatibility. More substantial licensed projects, retained unchanged at exact commits, remain part of Phase 2G.2 acceptance.

## Validation and adversarial matrix

All original **196 tests in eight files remain unchanged**. Added 41 authority/scheduling cases, five failure/recovery cases and 21 runtime/configuration cases: **263/263 tests in 11 files pass**. TypeScript and production build pass. The existing lazy Code chunk advisory remains 543.01 kB (184.66 kB gzip); it is not a new checkpoint failure. No lint script is configured. Sanitized machine receipts are in `phase2g1-evidence`; raw QA screenshots, archives, tokens, databases and VM state remain private/untracked.

| Boundary / attack | Evidence and result |
| --- | --- |
| User A reads/writes project B source, files, history, inspection, mutation, Code, checkpoint, revert, undo/redo, export or preview | Actual HTTP + SQLite tests for another user in the same workspace and another workspace; all denied with authorized positive controls |
| Forged workspace/project/user/role/root identity | Opaque membership lookup, exact project scope and rejected identity fields; HTTP denial |
| Viewer writes or reuses editor generation/capability | Role denial and exact account-session binding; real Lima/HTTP acceptance |
| Removed membership, role changes, expired/revoked sessions, remove/regrant | Fresh DB checks and membership epochs; tests plus active runner revocation acceptance |
| Cross-project digest, artifact reuse or object-key guessing | Actual SQLite full-tuple authorization and digest validation; absent/mismatched/revoked reads denied |
| Stale source revision, old generation, repeated frame sequence | Existing/new broker tests and real acceptance; denied before returning observations or accepting input |
| Runner allocation theft, changed replay payload, stopped-allocation resurrection | Durable allocation hash and owner checks; deterministic provider doubles with actual SQLite |
| Cross-project logs/viewer stream | Preview membership/session/generation gates; real cross-project capture denial and bounded sanitized observations |
| Preview/runner/editor credential confusion, forged Origin/Host, missing CSRF, duplicated cookies, local key on hosted path | HTTP/session-policy tests with valid-cookie positive controls; cleartext denied in production mode |
| Secret environment/project/session confusion and known-value exposure | Grant/redactor tests with synthetic values; actual job has no injected secrets; existing real filesystem secret-absence probe |
| Tenant/project concurrency and global capacity exhaustion | Actual SQLite admission limits with scheduling doubles; quarantine retains capacity |
| Timeout, idle expiry, cancellation, late worker response and cleanup failure | Deterministic state-machine tests; admission fails closed; real provider watchdog/resource/expiry checks separately |
| External network, process, filesystem, shell, VSOCK and host state | **Real Lima probes PASS**, collector-positive controls, zero isolated collector records, native Chromium sandbox retained |
| Public DNS/cookies, real cloud tenancy, multi-host storage/scheduler, deployed identity/secret manager | **UNPROVEN**, not inferred from mocks or loopback QA |

Real isolation probes observed separate private namespaces, only loopback interfaces, denied VSOCK (including child processes), all outside filesystem/process/shell probes denied and no host home. CPU/memory/tasks/no-new-privileges/control-group properties matched the contract. Memory exhaustion was killed. A deliberately frozen worker was terminated by the external watchdog after 65,091 ms (65-second supervisor backstop around the 60-second application lease). Positive controls reached TCP, UDP, DNS, fetch, image, beacon, EventSource, WebSocket, STUN/TURN and remote ICE collectors; isolated jobs produced **zero** collector records. Revoked-generation restart was denied.

Failure/recovery coverage includes actual source-process SIGKILL at journal, partial-write and committed-ledger checkpoints (retained Phase 2D/E tests); actual scheduler-process SIGKILL with recovery by a fresh controller; injected filesystem rename failures for pending journal and history writes with unchanged source/HEAD after restart; mid-commit session revocation with rollback; duplicate request and stale worker response; late startup cancellation and stop failure/quarantine. Storage fault injection uses real temporary files/SQLite, while provider stop-failure behavior uses doubles. Cloud node loss, object-store partial writes, distributed revocation races and regional outages remain unproven.

Browser regressions pass for legacy HashRouter/Field Notes, controlled BrowserRouter/basename/deep links/search/hash/history/refresh/assets, Code↔Canvas and invalid drafts, safe file operations, real server restart/HEAD/history/undo, and the unchanged Phase 2F responsive/semantic harness for both routers at 390/768/1280. Browser and export runs used Chromium 151.0.7922.34 with native sandbox. Screenshots were inspected for meaningful content, expected identity and absence of framework overlays; final new/Code/responsive/export runs report no runtime errors.

Two old browser-harness restart assertions were legitimately superseded, not removed from the unit suite. `verify-phase2c2-controlled.cjs` now requires same generation + new revision + new document birth and retained job storage for a module reload; CSS edit/undo/redo require new revision, same generation, computed style and retained viewport. The fresh-generation storage-empty assertion remains. `verify-phase2de.cjs` repaired Code-draft acceptance now requires same generation + new revision + rendered repaired heading; invalid-draft last-good, stale anchor and fresh-server-generation checks remain. This is stronger coverage of the new intended behavior, not a claim that reload is HMR.

Six separate export builds/renders pass: unchanged independent React 18 and React 19 starters; authored expanded profile; authored responsive BrowserRouter and HashRouter exports; authored Code↔Canvas export. Each builds in its own sandbox and renders without the editor, bridge, registry or runner API. Outside reads/writes, shell and network denial probes pass. Desktop/mobile identity, content, images, counter interaction (new corpus), existing routes/history/responsive styles and instrumentation absence pass.

Initial validation failures were investigated: Node Fetch overwrote the forged Host header in the first hosted HTTP test harness, causing invalid positive controls; the harness now uses `node:http` with explicit Host and tests both allowed and denied cases. Old browser expectations incorrectly required a new generation for every edit and were strengthened as described above. Vite 5's PostCSS search hit a parent repository package file outside its export sandbox; the identical export was rerun in a clean temporary job outside repository ancestry, with the same deny policy and unchanged source/config, and passed. No sandbox weakening or upstream source edit was used. An initial public-source download's Python certificate-chain error was resolved using the existing Node trust store, without disabling TLS verification.

## Engineering measurements

One final local authored-kitchen acceptance run, warm installed dependencies/VM, not statistically representative production benchmarks:

| Operation | Observed wall time |
| --- | ---: |
| Cold ZIP import + first compile/runner start in that test | 1,239 ms |
| Accepted CSS edit + incremental preview update | 385 ms |
| Accepted React module edit + incremental rebuild/reload | 412 ms |
| Structural edit + full controlled generation restart | 1,222 ms |
| Viewer frame request | 31 ms |
| Unchanged React 18 starter export validation/archive | 80 ms |
| Unchanged React 19 starter export validation/archive | 86 ms |

CSS and React edit measurements include their source validation/acceptance path. The retained context cache also has an equivalence test against a fresh compile after edits to rule out stale transformed modules. Independent Vite build logs observed approximately 250 ms (React 18), 294 ms (React 19), and 314 ms (authored expanded), excluding sandbox setup/dependency copying. These are engineering observations, not latency promises or evidence of hosted scalability.

## Reproduction, publication and remaining Phase 2G.2

From the feature repository, use the repository's Node runtime and installed package lock. Prepare the original and expanded profiles with `npm run runtime:prepare` and `npm run runtime:prepare:expanded` (both disable lifecycle scripts). Run `npm test`, `npx tsc --noEmit`, `npm run build`, then `npm run runner:prepare` and `npm run runner:verify`. The existing Lima VM is the only infrastructure used.

Browser harnesses are `verify-phase2c-editor-regressions.cjs` (which runs Phase 2B/Field Notes and boundary regressions), `verify-phase2c2-controlled.cjs`, `verify-phase2de.cjs`, `verify-phase2f.cjs` and `verify-phase2g.cjs` under `scripts/`; each accepts a private output directory. Set `WCB_PLAYWRIGHT_MODULE` to an installed Playwright package if it is not locally resolvable. The Phase 2G harness explicitly wires the hosted QA seam to real SQLite and Lima; ordinary `WCB_PREVIEW_PROVIDER=lima npm run dev` retains isolated local developer auth. No public login or hosted endpoint is silently enabled by these changes.

Use `verify-phase2g-export-sandbox.py --profile <versioned-profile>` for the new corpus and the unchanged `verify-export-sandbox.py` for earlier exports, followed by the corresponding standalone browser harness (`verify-phase2g-export.cjs`, `verify-phase2f-export.cjs`, `verify-phase2de-export.cjs`). Choose an otherwise empty job outside another repository's ancestry for legacy Vite 5. Full receipts identify the tested variants without embedding private paths. Final QA job units were checked and the local VM stopped after validation.

Outgoing commits were reviewed for actual credentials, private keys, auth cookies/tokens, private source, personal filesystem paths, QA archives/screenshots/databases and VM state. Only implementation, reproducible authored/public licensed corpus, exact profile manifests/locks, harnesses, documentation and sanitized receipts are included. No force push, main merge, paid infrastructure, broad credentials or public deployment occurred.

The smallest remaining **Phase 2G.2 work for genuine overall Phase 2 PASS** is a controlled hosted validation slice plus completion of the retained compatibility/audit gates:

1. Select an available authorized hosted environment and wire verified identity sessions, a durable source/history/artifact implementation and a real isolated provider to these seams. Preserve transactional source authority, tenant quotas, multi-host fencing, revoke/recovery/retention and cleanup verification. No provider purchase or irreversible architecture choice was made here.
2. Exercise real editor/viewer HTTPS sites, DNS/TLS/proxy/CDN/cookie/CSP isolation with at least two users and two workspaces. Repeat source/history/artifact/log/runner theft, session/membership revocation, CSRF, exhaustion, crash/cancellation and cleanup probes against the deployed private environment. Verify scoped secret-manager delivery/redaction only if grants are enabled. These need actual infrastructure/DNS/identity access and are UNPROVEN locally.
3. Finish the final Phase 2 compatibility acceptance plan: broader unchanged licensed full-project corpus, profile/configuration gaps, state-preserving imported module HMR where safe, and the remaining responsive/semantic/source-analysis and Code/history/recovery limits. Keep separate compatibility dimensions and reproducible independent exports; do not erase any pending item because this bounded profile matrix passes.
4. Run the final independent/external security and project compatibility audit with real hosted evidence, resolve its blockers and update the final Phase 2 release decision. Local doubles, starter templates and a cloud API shape cannot establish that decision.

The complete later product plan remains intact: final Phase 4 Landing/Dashboard/Auth/Workspace/Creator Studio, Marketplace, seller/reviewer/admin/bigperson roles, payments, AI editing, collaboration, broader gestures, navigation/footer/Docs and final experience design. No remaining Phase 2 or product scope was reduced to pass 2G.1.
