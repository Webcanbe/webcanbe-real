# Phase 2D/E: real Code ↔ Canvas and durable source history

Date: 2026-09-13. Repository: `Webcanbe/webcanbe-real`, branch `phase-2-compatible-editor`.

**PHASE 2D/E CODE↔CANVAS + DURABLE HISTORY CHECKPOINT: PASS** (the tested local scope below).

**OVERALL PHASE 2: NOT YET. PUBLIC HOSTED IMPORT READY: NO.**

## Checkpoint and architecture audit

Work started with the expected clean local and live remote branch at `66403284303f12cfdc38139c4d81780ef63b131a`, after checking ancestry and reading AGENTS, project record, current handoff and the Phase 2/2B/2C/2C.1/2C.2 reports. Main was `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. The original 116 tests passed before implementation.

Implementation and executable verification are committed as **`390d1f09a1bd50b062a80483c80bbffb96e7a10a`**, `feat: unify code and visual revisions with durable source history`. The accompanying documentation commit contains this report, sanitized evidence and updated handoff. Its own hash is deliberately not embedded in this file; verify the publication tip against the live branch. Only this feature branch is authorized for push. No main merge, force push, public deployment, hosted service, paid infrastructure or credentials were required.

The audit found an existing `MutationTransaction`, source patcher, project registry and in-memory `MutationHistory`; a separate code/canvas document would duplicate authority. The implementation extends those structures. Actual project files remain canonical. The durable ledger stores the existing transaction model and hydrates its undo/redo projection; it is not an alternate canvas representation. The adapter still computes supported visual patches, the registry still authorizes project access, and the existing runtime/compiler/bridge/controlled runner retain their boundaries.

## Revision and transaction contract

Each accepted transaction records its project, local operator actor, visual/code/system producer, timestamp, transaction ID, idempotency key and request hash, expected base revision, unique new revision, file operations and expected hashes, forward source patches, affected-file before/after states, validation result and status. Each revision has a unique ID, parent revision ID, content hash and originating transaction reference. Content hashing deterministically covers the editable `src` source set; it is not a whole asset/configuration repository hash.

All production source mutations use the same acceptance path, including visual edits, code saves, safe file operations and undo/revert/redo. Per-project asynchronous serialization and a process lease cover registry operations. The lease uses a SQLite `BEGIN IMMEDIATE` lock, released by the kernel when its owning process dies; a competing server cannot write through a held lease. On acquiring a lease, a surviving server reloads and recovers any dead peer's journal before admitting reads or writes. Unrelated projects retain separate queues. Existing import admission serialization remains.

Both base revision and expected file hashes must match before staged validation and are checked again at commit, alongside authorization and path identity. Revision IDs remain distinct when undo produces identical bytes, preventing an ABA stale-anchor acceptance. Source identities sent to the visual editor include revision/content scope and server-recognized source anchors. An old character range from revision X cannot mutate X+1.

Retries with the same idempotency key and request body return the original accepted or validation-rejected transaction without another mutation. Reusing a key for a different request returns a conflict. New UI actions use generated keys, retained across an uncertain save response. Compatible older visual API callers receive a deterministic request key. Authorization, path and stale-base rejection do not create source revisions. Parse/compiler rejection of a proposed save is recorded as a failed transaction with diagnostics and no new source revision.

Editable paths remain confined to `src` JavaScript, JSX, TypeScript, TSX, CSS and JSON. Code cannot write package manifests, lockfiles, runtime configuration, arbitrary paths or platform state. Create/update/rename/delete are staged together; rename destinations must be vacant. Path traversal, links, hardlinks, root/segment identity changes, case aliases, invalid UTF-8 and conflicting path operations are rejected. Limits are 1–100 operations, 2 MiB per source file, 2,000 files and 40 MiB for the project including inert assets/configuration, with an 8 MiB source API body ceiling.

## Persistence, commit and recovery

The local persistence backend is a private JSON ledger at `.webcanbe/history/<project-id>/history.json`. `writer.sqlite` supplies only process exclusion; revision/transaction data lives in the JSON ledger. History and recovery files are outside imported source and absent from source ZIP exports. Imported projects retain their existing `.webcanbe/projects/<project-id>` location and can be reopened by the same project ID after restart.

The commit protocol is:

1. Prepare and validate the entire proposed source set without changing canonical files.
2. Write and fsync `pending.json`, containing all affected-file before/after states and the proposed ledger.
3. Replace each affected file atomically, fsyncing file and directory entries. Deletes are similarly synchronized.
4. Atomically replace and fsync `history.json`. This ledger commit point decides transaction acceptance.
5. Remove and synchronize the journal, then return the accepted transaction.

A failure before the ledger commit point rolls all touched source back. A crash after it retains/completes the accepted state. Recovery runs before a new session or compiler can use the source; another live registry also recovers when next acquiring its lease. Recovery first checks the entire touched set against the journal's known before/after states. Unexpected third-party content causes quarantine/operator recovery instead of clobbering it. Journal-associated temporary files are removed during recovery. The test suite kills actual child processes with SIGKILL after journal creation, after the first source write and after the ledger commit point.

This gives coherent API-visible transactions under the private local storage model; an arbitrary outside filesystem reader could observe intermediate file replacements. Hostile concurrent filesystem writers, multi-host distributed storage, disk corruption and power-loss hardware behavior are not newly claimed. The fsync protocol and process-crash tests establish the tested local durability foundation. External source edits are detected as an `external_…` revision and block mutations until operator reconciliation; there is no automatic Git/watcher ingestion or outside-change adoption UI.

Undo/revert is a new inverse transaction against current HEAD, not a restore of an old whole-project snapshot. Every affected file must still match the original transaction's post-state (or pre-state for redo). Later unrelated work in other files survives. A later change anywhere in the same affected file conflicts conservatively, even if a more sophisticated merge might prove it independent. Selective revert removes the reverted transaction from the active past stack and adds it to the redo stack. Undo/redo themselves remain visible with their own new revision IDs. A new ordinary edit clears redo; a checkpoint does not. A checkpoint runs configured validation and records a new revision with unchanged source bytes; it is not an undoable source change.

The JSON ledger is intentionally local and unbounded at this checkpoint. It retains full affected-file inverse evidence; compaction, history quotas, backups, migrations beyond schema 1 and hosted storage are future work. Unaccepted editor drafts are memory-only and are not crash-safe. Accepted source, mixed-producer history, HEAD and undo/redo state persist across editor/server restarts.

## Code, Canvas and History behavior

The Code view uses CodeMirror 6 with JavaScript/TypeScript/JSX, CSS and JSON support. It provides a source tree, file opening, text editing, per-file dirty state, accepted-source changed markers, save and Meta/Ctrl+S, parse diagnostics, draft diff and safe create/rename/delete controls. Code loads lazily on first use. One explicit save makes one transaction, not one transaction per character.

Typing maintains a local draft and debounces parsing by 500 ms. An invalid draft remains visible, leaves canonical source unchanged and keeps the last-good controlled preview running. Repair and save validate and accept the real source. Drafts survive Code/Canvas/History switches and session reconnect within the current editor page. A dirty page has a before-unload guard. A stale draft is rejected explicitly: the UI can rebase only if that file's accepted baseline is unchanged, preserving intervening other-file edits. Same-file divergence requires manual reconciliation while retaining the draft.

After acceptance, the workspace updates its revision, invalidates selection and pending source-inspection responses, obtains fresh source analysis/anchors and rebuilds the controlled preview. It retains the route and viewport where supported. It deliberately clears selection rather than guessing a new source range. A new visual selection uses the fresh mapping. Shared component definitions expose effect scope; editing a definition can affect all rendered instances, and shared styles can affect multiple matches. A code edit to one component invocation's literal prop affects that invocation; this is tested with another instance remaining unchanged. Dynamic/unsupported constructs retain partial or code-only capability status.

The History view shows transaction/revision identities, time, producer, summary, affected files, diff, HEAD, validation outcome and revert availability. It contains only real source activity. Top-level undo/redo and selective History revert use the same durable boundary. The initial diff display shows literal before/after source rather than a polished line-matching UI. Referenced file rename/delete is refused if compilation would break; the UI does not rewrite imports automatically. The common API can submit a rename and all necessary import updates together, covered by a successful multi-file test.

## Actual validation policy and execution boundary

| Action | Validation before canonical acceptance |
| --- | --- |
| Typing | Debounced esbuild syntax transform, PostCSS parse or JSON parse of that draft; no source write or preview restart |
| Supported visual text/style mutation | Existing capability/adapter checks, expected revision/hash and parse of affected source; fresh analysis/preview after acceptance |
| Code save, file operation, undo/revert/redo | Parse the staged editable source set and compile the staged project with the existing confined preview compiler |
| Checkpoint and export | Full configured staged source parse and controlled preview compilation; export then uses the existing source ZIP exporter |

This is syntax and supported-profile compilation, not semantic TypeScript checking of uploaded projects or arbitrary uploaded build execution. The platform itself passes `tsc -b`. The normal code save and structural/multi-file save currently share the deeper compile level. Temporary validation roots are private, canonicalized and removed in `finally`; diagnostics redact project/platform/staging paths. Uploaded Node configuration, lifecycle hooks, plugins and package scripts are never executed in the editor process.

Strict preview still requires the server-selected `WCB_PREVIEW_PROVIDER=lima` provider. Project JavaScript stays in Linux Chromium; the ordinary browser receives platform-owned separate-origin raster viewer code, PNG frames and sanitized observations. Operator keys, capabilities and source authority remain outside the project job. The runner, isolated compiler, dedicated dependency profile, original fixtures and runner scripts were unchanged relative to the starting checkpoint. New CodeMirror packages are editor dependencies only. No raw project HTTP iframe, `allow-same-origin` workaround, unsafe browser sandbox flag, client-selected strictness or network fallback was introduced.

Without the configured provider, the existing qualified legacy Blob/HashRouter path remains; BrowserRouter admission remains disabled. Legacy regression evidence is identified as such and is not evidence of strict zero egress. Strict HashRouter Code and BrowserRouter Code acceptance both ran against the actual controlled Linux provider.

## Tests, build, browser and export evidence

Sanitized receipts are in [phase2de-evidence](phase2de-evidence/verification-results.json). Runtime keys, capabilities, private source archives, guest identifiers and raw process logs were excluded from tracked evidence. Screenshots and raw harness artifacts remain in ignored local QA storage, with selected authored-fixture screenshots delivered separately.

| Verification | Result |
| --- | --- |
| Original baseline suite | 116 passed; original test files retained unchanged |
| Final complete suite | **145/145 passed**, 7 suites, including 29 new durable-source/API/crash cases |
| TypeScript | `npx tsc -b` passed |
| Production build | `npm run build` passed, 82 modules, 2.29 s |
| Dependency check | Pinned CodeMirror versions installed with scripts disabled; npm audit reported 0 vulnerabilities |
| Controlled runner | Existing `runner:prepare` and `runner:verify` rerun passed real isolation/resource probes |
| Prior browser regressions | Trail Atlas, Studio Ledger and Field Notes passed import, router, source-edit, diff, undo/redo, export and bridge/lifecycle tests |
| Controlled BrowserRouter regressions | Nested/parameter/search/hash/basename/direct deep-link, refresh/back/forward, assets/404, selection/edit/diff/undo/redo/export, viewport and source authority passed |
| New Code/Canvas acceptance | Visual → Code → separate server restart; Code text/class/CSS/Module/prop; invalid draft → repair; structure → stale-anchor rejection → fresh visual; mixed history → undo/redo → export → second restart passed |
| Strict HashRouter Code | Tailwind `p-10` → `p-16` rendered at 64 px; one component prop changed 4 → 9 while another stayed 2 |
| Safe file-operation UI | Create → rename → delete passed configured pre-acceptance compilation |
| Independent final source export | Isolated pinned Vite build passed; uncoupled desktop/mobile render with source edits, nested routes, assets and no editor instrumentation passed |

The new 29 tests cover A/B history reopening with exact HEAD, selective inverse preservation/conflict, stale concurrent requests and ABA, same-key retry and mismatched-key conflict, outside-source mismatch, project/capability isolation, unauthorized operations, traversal/symlink/hardlink/case/size limits, staged multi-file partial failure rollback, crash recovery at three actual process termination points, a surviving registry's peer recovery, controlled compilation before file operation acceptance, stale anchors after structural code, validation failures and checkpoints. They add to all 116 existing tests, rather than weakening them.

The controlled-runner rerun recorded **zero isolated external collector packets**, with positive controls for fetch, WebSocket, EventSource, beacon, image, STUN, UDP TURN, supplied ICE, raw TCP/UDP, DNS, IPv4 and IPv6 loopback. Filesystem/process/secret and control-VSOCK probes passed. Memory exhaustion was killed; a frozen worker was killed after 65,088 ms. Limits remained 1.5 GiB memory, zero swap, 192 tasks, 150% CPU and a 65-second outer deadline. Revocation and actual guest expiry passed. These are the existing finite probes, not a new claim of complete DTLS/SCTP payload coverage or universal cross-browser isolation. See [runner receipt](phase2de-evidence/runner-security-results.json) and [controlled browser receipt](phase2de-evidence/controlled-results.json).

The new acceptance harness forks independent Vite server processes, obtaining fresh in-memory operator credentials after each restart. It verifies exact durable HEAD and mixed visual/code/history state and regenerates a fresh controlled preview from canonical source. The host browser is native-sandbox Chromium `151.0.7922.34`, editor 1600×1100, controlled viewports 1280 and 768; the retained controlled regression includes mobile coverage. The new harness reports no runtime errors or framework overlay. A captured Code screenshot was also visually inspected. QA is functional acceptance, not final UI polish or accessibility certification.

The final edited ZIP builds independently using the existing macOS sandbox harness and pinned profile dependencies: 44 modules, 1.28 s. Outside reads/writes, shell execution and network are denied by its probes; uploaded package scripts are not run. The export's Vite configuration is evaluated only inside that separate QA sandbox, never in the trusted editor. A separate static server, with no editor/registry, renders the built output in native-sandbox Chromium at 1280×900 and 390×844. It confirms the final visual text/style, literal prop, CSS Module 44 px, structural removal, nested routes/history/reload, asset loading and absence of generated source instrumentation or runtime errors. See [standalone receipt](phase2de-evidence/standalone-results.json).

The production build has one non-failing Vite size advisory: the lazily loaded Code workspace chunk is 543.01 kB (184.66 kB gzip), above the 500 kB advisory. Main JS is 422.53 kB (116.96 kB gzip); CSS is 307.84 kB (26.20 kB gzip). No lint script is configured. Browser and agent-browser integrations were unavailable in this session, so existing Playwright CLI harness conventions were used with the installed bundled Playwright runtime. CodeMirror integration followed its official basic setup/language documentation; no custom editor engine was built.

During verification the compiler correctly rejected a noncanonical macOS temporary path and a rename proposal omitting importing files. The staged path was canonicalized and the test submitted the complete import update. A parallel QA server port collision was fixed by reserving an ephemeral port; the final full acceptance rerun passed. No fixture/profile/security relaxation or original test removal was used to obtain a pass.

## Reproduction and cleanup

Run only from the trusted WebCanBe repository with the existing local runtime/profile prepared:

```sh
npm ci --ignore-scripts
npm test
npx tsc -b
npm run build
npm run runner:prepare
npm run runner:verify
WCB_PLAYWRIGHT_MODULE=/path/to/playwright node scripts/verify-phase2c-editor-regressions.cjs .webcanbe/runner/qa-phase2de-legacy
WCB_PLAYWRIGHT_MODULE=/path/to/playwright node scripts/verify-phase2c2-controlled.cjs .webcanbe/runner/qa-phase2de-controlled
WCB_PLAYWRIGHT_MODULE=/path/to/playwright node scripts/verify-phase2de.cjs .webcanbe/runner/qa-phase2de-delivery
python3 scripts/verify-export-sandbox.py .webcanbe/runner/qa-phase2de-delivery/phase2de-edited.zip .webcanbe/runner/qa-phase2de-delivery-export-build
WCB_PLAYWRIGHT_MODULE=/path/to/playwright node scripts/verify-phase2de-export.cjs .webcanbe/runner/qa-phase2de-delivery-export-build .webcanbe/runner/qa-phase2de-delivery-export-render
```

The final suite used Vitest's JSON reporter at ignored `.webcanbe/runner/qa-phase2de-delivery/tests.json`; the sanitized receipt captures its result and SHA-256 hashes of all 14 implementation files. Browser harnesses close their own servers and browsers. After testing, the guest listed zero `wcb-*` systemd job units and the existing local VM was stopped successfully. Use `runner:prepare` to restart it, then `WCB_PREVIEW_PROVIDER=lima npm run dev` for a strict editor session. Reopen the project URL and connect with that server's newly issued local key; no key is saved in this report or source.

All changed implementation files were reviewed for credentials, private project contents, runtime authority, generated source artifacts and accidental QA data. Staged whitespace and artifact scans passed. The committed evidence contains authored-fixture booleans/metrics and source hashes only. This is implementation review and regression verification; no external security audit or Codex Security scan is claimed.

## Remaining scope and next checkpoint

There is no blocking decision for this local Phase 2D/E checkpoint. The next architecture-preserving work must retain the full product plan and these explicit limitations:

- Broader CSS/Tailwind/source analysis, full responsive authoring, semantic drag/gesture breadth and unchanged compatible external-project evidence remain open.
- Controlled preview uses rebuild/reload and raster polling; genuine imported-project HMR, streaming/text-input ergonomics, broader runtime/dependency/configuration profiles and longer-session UX remain open. Existing lease expiry and reconnect semantics remain.
- Code exposes the supported `src` scope; multi-file commits are supported by the transaction API, while the UI saves a file or a file operation at a time. No automatic import rewrite, fuzzy same-file merge, semantic uploaded TypeScript service, durable unsaved drafts, Git ingestion or CRDT/collaboration was added.
- JSON history is private local storage with conservative inverse conflicts, not hosted multi-user persistence. Hosted ownership, scheduling, storage, cookie/resource isolation, limits/compaction and recovery operations need separate work.
- Final Phase 2 external-project and security audit remains required. This local controlled-runner checkpoint cannot establish public hosted import readiness.
- Landing/dashboard/Marketplace, final visual design, full experience/navigation/footer/Docs, AI editing, seller/payment/admin and the rest of the final product scope are preserved for later work. None was removed or represented as complete.

Do not merge main or deploy public imports from this checkpoint. The current handoff and final live branch verification identify the delivered tip.
