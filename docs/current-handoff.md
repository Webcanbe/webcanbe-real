# Current handoff: Phase 2F responsive and semantic authoring (2026-09-14)

**PHASE 2F RESPONSIVE + SEMANTIC AUTHORING CHECKPOINT: PASS locally. OVERALL PHASE 2: NOT YET. PUBLIC HOSTED IMPORT READY: NO.**

See the [complete Phase 2F report](reports/phase2f-responsive-semantic-authoring.md) and [sanitized verification receipt](reports/phase2f-evidence/verification-results.json). Earlier handoffs below are historical.

- Started clean at expected/live `fac8339e86ca2e0a6395f73b922917fdc1a41de6`, descending from `390d1f09a1bd50b062a80483c80bbffb96e7a10a`. Implementation: **`1a825e9b9107840a0faf00c24b9754f6c5fd3527`**; final invalid-viewport guard: **`247d8ec83af3a83b766228f6325b2dd5983ec5e1`**. Documentation is a separate commit. Only `phase-2-compatible-editor` is published; main stays `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`.
- The existing React adapter plus additive project style reconciliation expose literal/inline/CSS/Module/Tailwind/responsive/inherited origins, active/effective source candidates, exact ranges, known source-use counts and shared scope. Explicit source-scope edits affect all matching uses; instance-only shared requests are refused. Ambiguous cascade, dynamic values and unsafe selectors retain Code access.
- Preview mobile/tablet/desktop widths remain 390/768/1280. A separate authoring selector edits base/default or an existing project CSS/Tailwind breakpoint. Only the selected token/declaration changes. Static CSS @theme breakpoint literals are understood by analysis, **but the unchanged runtime still rejects @theme/configuration directives**. Do not claim custom theme preview support. Unknown viewports and unsupported variants fail closed.
- Expanded utility families, static local const/object/array token origins, existing Flex/Grid properties and adjacent native JSX sibling reorder share normal source transactions, revisions, hash checks, durable History, inverse/restart behavior and controlled preview rebuilds. No coordinates, alternate canvas document or second history. Shared const storage is explicit; writes/aliases/deletion/exports/dynamic values are conservative.
- All original **145 tests remain unchanged; 196/196 pass** with 51 new cases. TypeScript/build, real controlled runner isolation/resource probes, unchanged legacy and controlled browser suites, Code/Canvas/invalid-draft/file-operation/restart regressions, both responsive router paths and independent exports build/render pass. No runtime errors in final new/Code/export acceptance. Original fixtures, compiler, runner/security and durable storage implementation remain unchanged.
- Final browser jobs were cleaned up; the local VM is stopped after validation. Restart with `npm run runner:prepare`, then `WCB_PREVIEW_PROVIDER=lima npm run dev`. Credentials are newly issued by the local server, not stored here.
- Limits: existing declarations only; explicit reorder controls rather than pointer drag; partial cascade/value vocabulary, approximate static counts, local const tracing rather than general prop/cross-file analysis, and no independently authored external-project acceptance. The fixture and its HashRouter variant are explicitly authored QA, not third-party evidence.
- Still open: genuine imported HMR, broader runtime/dependency/config profiles, hosted ownership/scheduling/storage/cookie/resource isolation, production hosted provider, broader independent real-project validation, final external/security audit, remaining compatibility gaps and the entire final product/Phase 4 UI/AI/Marketplace/seller/payment/admin/collaboration/experience scope. No main merge or public deployment.

Verify the final live feature tip, clean tree and unchanged main before continuing. The report intentionally does not embed its own documentation commit hash.

---

# Current handoff: Phase 2D/E Code ↔ Canvas and durable history (2026-09-13)

**PHASE 2D/E CODE↔CANVAS + DURABLE HISTORY CHECKPOINT: PASS locally. OVERALL PHASE 2: NOT YET. PUBLIC HOSTED IMPORT READY: NO.**

See the [complete Phase 2D/E report](reports/phase2de-code-canvas-history.md) and [sanitized verification receipt](reports/phase2de-evidence/verification-results.json). Earlier handoffs below are historical checkpoints.

- Verified clean starting HEAD/live branch `66403284303f12cfdc38139c4d81780ef63b131a` and main `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b` before work. Implementation and executable acceptance: **`390d1f09a1bd50b062a80483c80bbffb96e7a10a`**. This documentation is a separate commit on the same branch; verify the final tip against live `origin/phase-2-compatible-editor` before continuing. No main merge, rewrite, public deployment or paid infrastructure.
- Visual edits, Code saves, create/update/rename/delete, checkpoint and inverse transactions share the existing authorized source acceptance path. Canonical real project files remain the product; the existing adapter/bridge/runtime/transaction boundaries are retained. Every accepted mutation has an expected base, unique revision, file hashes, idempotency key, validation and source inverse evidence. Source anchors are revision/content scoped; acceptance clears stale selection and analysis before rebuilding the controlled preview with route/viewport retained.
- Persistence: private `.webcanbe/history/<project-id>/history.json`, outside exported source. Fsynced write-ahead journal and ledger commit point recover interrupted multi-file writes. SQLite supplies a kernel-released per-project writer lease, not revision storage. Actual SIGKILL tests cover journal/partial-write/post-commit crash points and recovery by a fresh or surviving registry. Unexpected outside source changes fail closed for operator reconciliation.
- Undo/selective revert is a new current-base inverse transaction. Later unrelated files survive; a later change anywhere in an affected file refuses conservatively. Redo persists; ordinary edits clear redo, checkpoints do not. The local ledger retains full affected-file inverse evidence and has no compaction/hosted migration facility yet.
- CodeMirror provides Code/file tree, memory drafts, keyboard save, diagnostics, diff, changed markers and safe file operations. Invalid drafts retain last-good source/preview. Drafts survive view switches and reconnect, but unaccepted drafts are not crash-safe. Accepted source, exact HEAD, mixed producer history and undo/redo survive editor/server restart. File operations compile before acceptance; automatic import rewriting and a multi-file editor save UI remain future work.
- All **116 prior tests remain unchanged; 145/145 pass**. TypeScript, production build, existing runner isolation/resource checks, original HashRouter/Field Notes and controlled BrowserRouter regressions, new Code/Canvas/restart/strict HashRouter/file-operation browser acceptance, and independent final exported build/render all pass. No runtime errors in the new browser/export runs. One non-failing Vite advisory: lazy Code chunk 543.01 kB (184.66 kB gzip). No external security audit is claimed.
- Runner/compiler/profile/original fixture files are unchanged. Strict imported JavaScript still runs only in the existing Linux Chromium job; the ordinary browser receives the separate-origin raster viewer. Source authority stays outside the project. No active job units remained after QA; the local VM was stopped. `npm run runner:prepare`, then `WCB_PREVIEW_PROVIDER=lima npm run dev` restarts strict local work. Reconnect at the existing project URL with the new server key. No keys are persisted in this handoff.
- Next: preserve broader CSS/Tailwind analysis, responsive authoring, semantic gestures, true imported HMR, wider runtime/configuration profiles, hosted ownership/scheduling/storage/resource isolation and the final Phase 2 external-project/security audit. The full final product experience, landing/dashboard/Marketplace, navigation/footer/Docs, AI, seller/payment/admin scope remains open and unchanged. Local Phase 2D/E success does not make overall Phase 2 or hosted imports ready.

The report intentionally does not embed its own documentation commit hash. Verify HEAD, clean status, live feature branch and unchanged main before the next task.

---

# Current handoff: Phase 2C.2 local controlled runner (2026-09-13)

**Phase 2C.2 PASS locally; Phase 2C HTTP/BrowserRouter PASS through the controlled local viewer; overall Phase 2 NOT YET; public hosted imports NO.**

See the [complete Phase 2C.2 report](reports/phase2c2-controlled-runner.md) and [evidence](reports/phase2c2-evidence/verification-results.json). Earlier handoffs below are historical checkpoints.

- Started clean at `6b43dcee099b270d6b1663467218532574ce6bc2`, matching the live branch. Main remains `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. Only `phase-2-compatible-editor` is published; no main merge or hosted deployment.
- Concrete `RunnerProvider` / local Lima provider extends the Phase 2C.1 broker. Every strict project/browser runs inside a no-host-mount Linux VM job with private network/filesystem/PID namespaces, socket-family restriction, native Chromium sandbox, cgroup limits, external deadline and verified stop/revoke behavior.
- `npm run runner:prepare`, then `npm run runner:verify`, then `WCB_PREVIEW_PROVIDER=lima npm run dev`. Development-only Apple Silicon macOS provider; no cloud account, purchase or global installation. The VM was stopped after checkpoint validation; preparation restarts it.
- The ordinary browser receives only platform-owned separate-origin raster viewer code, PNG frames and sanitized source/geometry observations. All keys, session capabilities and mutation authority remain in the trusted editor/server. External networking is denied; no project networking capability is inferred from transport.
- Full local BrowserRouter navigation/assets/selection/edit/diff/undo/redo/export and preserved HashRouter/Field Notes regressions pass. All original 108 tests retained; 116 pass with TypeScript/production build. Real positive/negative network, process/filesystem, memory/frozen-worker, source authorization, cross-project, expiry/revoke and cleanup evidence is committed.
- Without the server-selected Lima provider, BrowserRouter remains disabled and legacy Blob/HashRouter retains its non-strict warning. No raw project HTTP iframe or `allow-same-origin` path was enabled. Strict failures do not fall back to client execution.
- Preview sessions last at most 60 seconds; reconnect renews. This is PNG polling and bounded click/select/scroll/route/viewport input, not finished streaming, keyboard/text-input or remote-desktop UX. Supported source mutations are unchanged. On cleanup quarantine, stop the VM before restarting admission.
- Next bounded work: hosted ownership/scheduling/storage/cookie isolation and stronger viewer ergonomics need separate implementation and tests. Broader Phase 2 profile/configuration, history/HMR, Code UI and product-experience work remains open. Do not mark public hosted imports ready from this local checkpoint.

The report intentionally does not embed its own commit hash. Verify HEAD against the live branch before continuing.

---

# Current handoff: Phase 2C.1 controlled execution foundation (2026-09-13)

**Phase 2C.1 network isolation NOT YET; Phase 2C HTTP/BrowserRouter NOT YET; overall Phase 2 NOT YET; public hosted imports NO.**

The [Phase 2C.1 report](reports/phase2c1-network-isolation.md) and sanitized evidence are the current record. The earlier handoff below is retained as history.

- Audited clean starting HEAD and live remote at `fbd95b46e9ac0ac02ae7e422501f0a7395d45ce4`, descended from `4a6520f795e52bff2ccebabd1ea13274dfe85466`; main remains `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`.
- Native-sandbox browser probes reproduce RTC/STUN/TURN/remote-ICE egress despite CSP, media Permissions Policy, separate origin and opaque confinement. The current CSP draft has a WebRTC directive, but the tested browsers do not implement it. Collector-positive HTTP/resource denials are not all-egress proof.
- Added dormant `ControlledPreviewTransport` / `ProjectRunner` foundation: immutable artifact digest, server-authorized leases, credential-free job, raster/input boundary, lifecycle invalidation and fail-closed unavailable provider. No concrete OS-isolated browser provider or separate-origin raster viewer is installed. Mock runner tests prove broker behavior only.
- HTTP remains unreachable from the editor. No same-origin sandbox grant, client isolation flag, credential injection or unsafe native-sandbox bypass was added. Legacy local Blob/HashRouter keeps its qualified warning and existing source authorization.
- All original 95 tests are retained; **108 tests pass** with 13 new foundation cases, and TypeScript/production build pass. Exact results are in the report receipt. Existing Trail Atlas/Studio Ledger/Field Notes source-edit/diff/undo/redo/export and bridge/cleanup browser regressions pass.
- Next: implement and negatively test an actual controlled browser/network provider and authenticated separate-origin raster presentation. All strict imported JS must stay inside that boundary, including HashRouter apps. Do not expose artifact/bootstrap URLs to an uncontrolled browser. Then integrate validated observations and run the full BrowserRouter editor workflow before considering admission.
- External project networking is a distinct server-owned capability and is denied by this foundation. Preview transport must not grant it. Existing mutation authorization remains the only source-write path.
- The full broader Phase 2 and product experience plan remains open. No main merge, force push, public deployment, purchase or infrastructure installation.

This checkpoint is published only on `phase-2-compatible-editor`; verify its delivered commit against the live branch. The report intentionally does not embed its own commit hash.

---

# Current handoff: Phase 2C safe blocked checkpoint (2026-09-13)

**Current status: Phase 2C NOT YET; overall Phase 2 NOT YET; public hosted imports NO.**

The [complete committed Phase 2C report](reports/phase2c-http-preview.md) and its evidence are authoritative. The older Phase 2B handoff below is retained as historical baseline, not a claim of HTTP support.

- The existing controlled Blob/HashRouter workflow remains active. It is not a general uploaded Vite server.
- Shared HTTP compiler/artifacts, isolated-origin artifact registry, read-only bootstrap/cookie lifecycle and opaque confinement envelope are implemented as dormant prototypes. No editor endpoint starts the HTTP listener. BrowserRouter requests fail closed with an approved browser network-isolation capability error.
- Authored BrowserRouter routing/basename fixtures and independent export builds/renders pass; 95 tests and TypeScript/production build pass. Existing Trail Atlas/Studio Ledger and final Field Notes browser editing regressions pass. Prototype source-transaction QA is not full nested-route editor UI acceptance.
- Blocking browser evidence: native History works in opaque HTTP frames, but Chromium sends WebRTC/STUN UDP despite CSP. A macOS network sandbox experiment did not work with Chromium's native sandbox retained. No unsafe runner/client-flag bypass was admitted.
- Complete security/privacy/lifecycle and limitation details, including inherited Blob network limitations and the verified route-overlay fix, are in the report. Codex Security did not run.
- Next: resolve an approved browser egress/admission boundary, finish production editor integration, exercise the full nested-route editing loop and obtain unchanged compatible external-project evidence. Do not simply delete the BrowserRouter rejection.
- Preserve broader dependencies/config/Tailwind, responsive authoring, semantic gestures, editable Code UI, durable/multi-file history, imported HMR, hosted ownership/resource isolation and the full experience/navigation/seller/footer/Docs plan. No landing/auth/marketplace redesign or main merge occurred.

Implementation/validation checkpoint `4a6520f795e52bff2ccebabd1ea13274dfe85466` was normally pushed and verified at `origin/phase-2-compatible-editor`; main is unchanged. The documentation-only publication receipt is recorded in the report. No further runtime work or speculative WebRTC workaround follows this checkpoint.

## Historical Phase 2B handoff (retained)

# Current handoff — Phase 2B

Working copy: `~/Developer/WebCanBe-recovery`.
Branch: `phase-2-compatible-editor`.
Verified remote: `https://github.com/Webcanbe/webcanbe-real.git`.

## Checkpoint and publication

- Starting checkpoint verified clean at `d1683f6`, descending from `68666d6`
  and Phase 1 `6f3582a`; original report copied verbatim into
  `reports/phase2-recovery-report.md`. Original report and iCloud repo untouched.
- Both recovery commits were pushed and their remote ancestry verified.
- Phase 2B implementation: `e39d73e871efdb7687c0ee14df0ce60e1933fb4c`
  (`feat: validate dedicated React Vite runtime profiles and routed imports`).
  Pushed and remote HEAD verified at this commit before this documentation commit.
- This accompanying documentation is published on the same branch. Verify current
  tip with `git rev-parse HEAD` and `git ls-remote origin refs/heads/phase-2-compatible-editor`.
- Main remains `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. No merge, force push,
  history rewrite, deployment, public import service or purchase occurred.
- Tracked/staged credential/private-runtime scans and diff whitespace checks passed.

## Results and boundaries

PHASE 2B TARGETED CHECKPOINT: PASS (the explicit profile only).
OVERALL PHASE 2: NOT YET.
PUBLIC HOSTED IMPORT READY: NO.

See `phase2b-runtime.md` for the full stage-specific audit, exact supported versions,
commands/results, changed modules, test environment and remaining limitations.

Dedicated profile: React/DOM 19.3.0, Router 7.18.3 (HashRouter), Tailwind 4.3.3,
Vite 6.4.3, React plugin 4.3.4, TypeScript 5.9.3, clsx 2.1.1, classnames 2.5.1.
Manifests and npm locks are data; versions and integrity must match. No fallback to
editor node_modules. Narrow static Vite/TypeScript aliases, local assets, CSS/Modules,
nested JSX/TSX and existing supported mutations are verified.

`npm test`: 69 passing tests. `npm run build`: TypeScript and production build pass.
No lint script configured. Both new, explicitly labelled fixtures pass browser ZIP
import → routes → mapped source edit → diff → reload → undo/redo → export.
The original Field Notes browser regression loop also passes.

Both final exports build independently in fresh macOS sandbox jobs and render as
standalone apps in Chromium, with working routes/assets/edits and no instrumentation.
Outside file reads/writes, shell execution and network are denied by tested probes.
Clean environment, copied dedicated dependency files, exact lock/profile checks,
45-second process-group timeout; uploaded config executes only inside this QA sandbox.
The local QA runner is not a hosted or universal configuration execution service.

Preview Blob transport retains sandbox="allow-scripts" without same-origin access;
Chromium verifies opaque document/message origins and denies parent DOM, storage and
tested fetch/resource requests, not all browser egress. WebRTC/RTC networking can
bypass CSP; HTTP stays disabled pending a tested defense-in-depth solution.
No key/capability is sent to preview. Ten-minute authority and source guards
remain unchanged. Auto-review initially rejected the Blob proposal; controlled
security probes established the retained isolation, and the action was then approved.

## Next bounded task

Add an isolated HTTP preview profile for unchanged BrowserRouter applications and
validate independently authored projects against explicit dependency versions.
Do not substitute routers/config/code to claim compatibility.

Still open: broader dependency/lock profiles, CSS cascade and Tailwind config,
universal responsive authoring, editable code UI, durable/multi-file history,
imported HMR, hosted ownership and resource isolation. The original remaining
requirements in `phase2.md` and the recovery report are not cancelled. Landing/auth/
marketplace redesign, AI editing and main merging remain out of scope.
