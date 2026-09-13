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
