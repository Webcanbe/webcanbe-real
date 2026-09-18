# Phase 2C.2 — first local controlled preview runner

2026-09-13. **Outcome: fixed for the tested local provider.** Strict execution and the full local BrowserRouter editor path pass. Overall Phase 2 remains NOT YET; public hosted import readiness remains NO.

## Starting checkpoint

Before edits, the working checkout was clean on `phase-2-compatible-editor` at `6b43dcee099b270d6b1663467218532574ce6bc2`, matching the live remote branch at `https://github.com/Webcanbe/webcanbe-real.git`. Its parent is `fbd95b46e9ac0ac02ae7e422501f0a7395d45ce4`, following `4a6520f795e52bff2ccebabd1ea13274dfe85466`. Remote main was `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. All 108 baseline tests passed before implementation. Read AGENTS, project record/current handoff, Phase 2/2B/2C/2C.1 reports and the compiler, registry, controlled transport, bridge, source transactions and editor callers.

The Phase 2C.1 conclusion is preserved: browser CSP/sandbox/origin controls cannot establish strict zero egress for arbitrary project JavaScript in ordinary end-user browsers. This checkpoint moves the execution boundary; it does not revisit iframe WebRTC workarounds.

## Security boundary and local architecture

An imported project controls its browser JavaScript, DOM, routes, logs and artifact content. It receives no editor key, capability, source root, platform cookie, mutation API, CDP address, SSH credential or generic command execution channel. Uploaded configuration, hooks and Node-side project code still do not execute in the trusted editor/compiler. The trusted computing base is the existing server authorization/compiler/transaction code, fixed runner supervisor and libraries, Chromium native sandbox, Linux kernel/systemd/bubblewrap, Lima/Virtualization.framework and the local operator/host OS. Browser or kernel vulnerabilities are not claimed impossible; a finite test matrix does not prove their absence.

The invariant is **no project-originated networking outside its execution job**, including browser paths that bypass Fetch/CSP. Pixels and bounded observations returned through the requesting user's authorized broker are intentional preview output. That mediation grants no external network capability. In-job loopback networking is not external egress.

`RunnerProvider` extends the existing `ProjectRunner` seam, retaining its compatibility name. `ControlledPreviewTransport` still prepares immutable digest-bound artifacts and owns project/session/revision/generation leases. The new `LocalLimaRunnerProvider` launches a fixed guest entrypoint through private stdin/stdout. It exposes capture/sample, bounded input and stop; no provider-specific implementation is spread through the editor.

The local provider uses a project-local Lima 2.2.0 Apple Virtualization VM: Debian 13, two vCPUs, 4 GiB RAM, 12 GiB sparse disk, plain mode, no host-directory mounts, no host agent forwarding, no loaded user SSH public keys, no guest agent/containerd/port forwarding. Its management network is used by trusted provisioning/control only. Every browser and its supervisor execute inside a new bubblewrap user, network, mount, PID, IPC, UTS and cgroup namespace. The job has only loopback, no host/sibling interface or routes; `/proc` exposes only job processes. systemd permits AF_UNIX/INET/INET6/NETLINK and denies AF_VSOCK, closing Lima's host-control socket family. No-new-privileges and dropped capabilities remain active. Read-only runtime libraries/fonts and a private tmpfs home/tmp replace the guest filesystem. No host project/source directories, device sockets, shell path, management credentials or privileged filesystem are mounted into the job.

The outer systemd cgroup enforces 1536 MiB memory, zero swap, 150% CPU quota, 192 tasks, zero core dumps, a 65-second deadline and whole-cgroup termination. Broker/worker leases are at most 60 seconds; IPC commands are bounded to 12 seconds and close verification to 8 seconds. The broker admits at most four jobs and one compilation/startup at a time. It retains or quarantines authority when cleanup cannot be verified. A root-owned revoke tombstone, checked again by systemd before execution, prevents a delayed startup from reviving an already stopped generation. Tombstones contain generated identifiers only and remain in the disposable VM; profile and artifact state disappears with each job's tmpfs. Stopping/deleting the VM removes that local development state.

Chromium is launched with `chromiumSandbox: true`, with no `--no-sandbox`, renderer API deletion, WebRTC patch or credential injection. Startup reads `chrome://sandbox` and requires namespace and seccomp sandbox activation. Native output in this installation reports both active.

Inside the controlled browser, a unique `http://wcb-<generation>.preview.invalid` origin serves the immutable snapshot through exact-origin Playwright fulfillment. Missing resources and reserved API paths return 404, invalid methods 405; extensionless document navigation receives the application shell for BrowserRouter fallback. External requests continue to the real outer boundary. Fulfillment is artifact transport, **not the firewall**. BrowserRouter basename does not invent a Vite asset base: the basename fixture uses valid root-relative public assets.

The ordinary client loads only the platform-owned `RasterViewerServer` at a separate `wcb-view.localhost` origin in `sandbox="allow-scripts"`. It receives PNG data and validated dimensions/sequence, never project HTML, SVG markup, JavaScript, DOM replay or arbitrary URLs. The viewer has no credential or mutation authority; parent DOM/storage/cookies and its own opaque storage/cookies are denied in real browser tests. The authenticated editor parent owns every API request. Local auth remains the existing single-operator in-memory key and project capabilities; localhost, origin checks, URL randomness and CORS are not substitutes for those capabilities. Hosted deployment requires separate site/cookie/ownership infrastructure and is not implemented here.

Selection remains coordinate → controlled-browser isolated-world DOM lookup → bounded source identity/geometry/styles → actual current-project source membership check → trusted inspector → explicit authorized mutation transaction → new revision and runner generation. A project can falsify its own DOM attributes; membership checks do not make those attributes cryptographic attestations. Such data cannot grant source-write authority, choose another project/root or bypass the existing capability/revision/actual-target checks. Source inspection displays the real target before an explicit edit. No observation automatically mutates source.

The client displays a 900-pixel-high raster, polls modestly, sends click/select/scroll/history/navigation/viewport commands and queues at most one pending interaction. Stale coordinate frames are rejected. Mobile/tablet viewport selection survives rebuilds, undo/redo and reconnect. Console output is capped at 20 final formatted lines of 300 characters. PNG output is fixed-type and bounded to 8 MiB/4096 dimensions; real viewport dimensions are further limited to 1920×1080. This is a reusable screenshot/input prototype, not a video stream or complete remote-desktop product.

## Admission and compatibility

`WCB_PREVIEW_PROVIDER=lima npm run dev` selects the installed local provider on the server. **All** imported JavaScript in that mode, including HashRouter, stays in the controlled browser. A provider error does not fall back to client-side project execution. Without that server configuration, the previous authorized-local Blob/HashRouter mode keeps its explicit non-strict warning and BrowserRouter remains disabled. The dormant raw HTTP artifact listener remains unreachable from the editor; no untrusted executable HTTP iframe was enabled and no `allow-same-origin` was added.

External project networking remains the literal server-owned `{ external: "deny" }` capability. There is no enabled-network option, client isolation assertion, generic proxy, URL relay or runner command API. A future network-enabled project capability needs its own authorization and network policy.

The dedicated React/Vite runtime, supported source mapping, mutation/diff/undo/redo/export boundaries and previous compatibility limits remain. No landing/auth/marketplace/Docs product redesign, main merge, public deployment, paid service or global VM/container installation occurred.

## Reproduction

On the tested Apple Silicon macOS environment:

```sh
npm run runner:prepare
npm run runner:verify
WCB_PREVIEW_PROVIDER=lima npm run dev
npm test
npm run build
WCB_PLAYWRIGHT_MODULE=/absolute/installed/playwright node scripts/verify-phase2c2-controlled.cjs .webcanbe/runner/qa-controlled
WCB_PLAYWRIGHT_MODULE=/absolute/installed/playwright node scripts/verify-phase2c-editor-regressions.cjs .webcanbe/runner/qa-legacy
```

`runner:prepare` downloads checksum-verified Lima into ignored `.webcanbe/runner`, uses a digest-pinned Debian image, provisions signed Debian packages and pinned Playwright Core 1.63.0, and copies only fixed runner/proof tools. It is idempotent for the existing development VM. No user-project npm scripts execute. Lima may keep its normal image cache in the user's Library cache. Other host platforms are rejected by this preparation script; they are future providers, not implicitly supported.

Observed guest versions: Chromium 152.0.7977.82 (`152.0.7977.82-1~deb13u1`), bubblewrap `0.12.0-1~deb13u1`, systemd `257.13-1~deb13u1`, Linux `6.12.95+deb13-cloud-arm64`, Node `20.19.2+dfsg-1+deb13u2`. Host Node 26.4.0, npm 11.17.0, TS 5.9.3, Vite 6.4.3; native-sandbox client Playwright uses the installed Chromium. Re-run all real isolation probes after changing the kernel/browser/provider packages.

Stop the editor, then release the development VM with:

```sh
LIMA_HOME="$PWD/.webcanbe/runner/lima" .webcanbe/runner/tools/bin/limactl stop wcb
```

Do not restart admission after a cleanup-quarantine error until the VM's jobs are confirmed stopped (stopping the VM establishes this). VM creation and toolkit download are local disk/network costs, not cloud purchases.

## Validation and evidence

See [sanitized outer-boundary evidence](phase2c2-evidence/network-results.json), [controlled editor results](phase2c2-evidence/controlled-results.json) and [verification receipt](phase2c2-evidence/verification-results.json). Raw private dev logs, editor keys, ZIP exports and full screenshots stay in ignored local QA storage.

| Gate | Final evidence |
| --- | --- |
| Existing and new tests | All original 108 retained; 116 tests in six suites, including eight raster/input/source/quarantine cases. Mock tests explicitly do not certify OS isolation. |
| TypeScript/production | `npx tsc -b` / `npm run build` pass. |
| Real network boundary | Positive collectors receive fetch, WebSocket, EventSource, image, beacon, STUN, UDP TURN, supplied-ICE packets, raw TCP/UDP and DNS. IPv4 guest/loopback and IPv6 loopback positive controls work. Isolated execution delivers zero collector traffic. |
| RTC details | Native RTCPeerConnection/RTCDataChannel objects create offers; a supplied remote ICE candidate is accepted. STUN/TURN/ICE packet paths reach collectors outside isolation and are denied inside. TURN-over-TCP is initiated alongside raw TCP. No claim of a complete positive DTLS/SCTP payload exchange is made; kernel network namespace and socket-family confinement enforce the no-external-socket invariant. |
| Probe independence | No CSP, iframe policy or Fetch interception denies probe traffic. Only a synthetic document is delivered in memory. The synthetic probe disables Chromium's LocalNetworkAccessChecks identically in positive and isolated runs so that browser permission checks cannot masquerade as OS denial. Production worker flags retain that browser default. Native Chromium sandbox remains active in both. |
| Filesystem/process | Outside synthetic canary, traversal and `/proc/1/root` reads denied; read-only runtime writes denied; `/bin/sh` absent; same-user outside PID inaccessible. A child Node process inherits the same namespaces and denied VSOCK capability. This proves no escape, not a ban on every in-job child process. No host-directory mounts; platform-secret canary removed by clean environment. |
| Resource/cleanup | Real memory exhaustion kills the cgroup. SIGSTOP-frozen worker is killed by the outer deadline in about 65 seconds. Exact memory/CPU/task/deadline properties recorded. Stop/reuse tombstones reject a revoked generation. Real short guest lease expires without a broker follow-up. Runtime storage persists on hard refresh within one job and is absent after generation/session restart. Startup+stop failure is injected at the child-process seam and quarantines further admission. |
| Authority | Parent/own DOM-storage-cookie denials, no project DOM/scripts/key in viewer, cross-project and forged-capability rejection, stale generation/revision mutation rejection, revoke/expire and cleanup checks. API/source mutations retain existing authorization tests. |
| BrowserRouter editor | Coordinate selection, validated source identity/geometry, actual text and supported CSS edit, changed rendering, diff, undo/redo/export; nested/parameter routes, search/hash, direct deep link, actual document recreation on hard refresh, back/forward, basename, local assets, application 404 and missing asset/internal API 404. Click navigation, scrolling and viewport persistence pass. |
| HashRouter/Field Notes | Original Trail Atlas and Studio Ledger import/profile/assets/routes/text/style/diff/reload/undo/redo/export pass. Field Notes text, CSS Modules, inline, Tailwind/responsive, viewport, parent/API, diff/undo/redo/export pass. Existing forged-message/stale-overlay/late-inspection/stop-restart regressions pass. |

The new browser harness uses isolated temporary project registries and synthetic Coast Paths telemetry for assertions. Telemetry belongs to the controlled test fixture, not production observation authority; real screenshots and mapped selection/source checks independently exercise rendering. The basename variant has an explicit basename and valid public asset URLs. No unchanged external hosted project acceptance is inferred from these authored fixtures.

## Review and resolved failures

The security-fix skill supplied one read-only pre-patch investigation and one fresh candidate bypass/regression review. This is a scoped source review and executable validation, not a hosted Codex Security scan or exhaustive audit.

Initial launcher checks caught missing netlink access for bubblewrap and systemd RestrictSUIDSGID blocking `openat2`. The final launcher retains no-new-privileges, dropped capabilities, namespace isolation and explicit socket-family filtering, with native Chromium sandbox verification. Node's read-only externalized builtin libraries were added; no host/private directories were exposed. Chromium 152's actual sandbox diagnostic uses “Layer 1 Sandbox: Namespace”; the matcher was corrected against that output.

An initially broken network positive control was correctly rejected. Chromium's local-network permission gate prevented the synthetic HTTP collector requests even outside isolation. The final test removes that gate identically in both runs and asserts positive delivery per protocol before accepting the negative run. The first preparation retry also rejected an existing VM name; idempotent existing-instance startup fixed the harness.

Editor tests caught overlapping navigation being dropped and late startup responses overwriting Stop; bounded queuing and epoch invalidation corrected them. A test attempted an unsupported tag-selector style source; it was changed to the existing supported class-based property rather than expanding mutation semantics. The independent review confirmed lost viewport settings after rebuild, overlong grouped-console prefixes, and missing quarantine when startup cleanup fails before a handle is returned. Each was fixed and verified with real viewer/console regressions or targeted child-process fault injection. No failed experiment is counted as an acceptance pass.

## Remaining work

This is a **local development checkpoint** for this tested provider and dependency profile. The ordinary browser viewer uses PNG polling with click/select/scroll and route/history controls; keyboard/text-entry, drag gestures, smooth streaming, accessibility interaction and long-lived reconnect ergonomics are future work. Jobs intentionally expire within 60 seconds. BrowserRouter is available locally only through the strict provider, not raw client HTTP execution.

Hosted account ownership, tenant scheduling/storage isolation, independently scoped hosted credentials/cookie sites, authenticated hosted viewer delivery, abuse controls and production resource management are not implemented or tested. Overall Phase 2's broader profiles/configurations/Tailwind cascade, durable/multi-file history, imported HMR, editable Code UI, semantic gestures and full product experience plan remain open. Main remains untouched.

PHASE 2C.2 CONTROLLED-RUNNER CHECKPOINT: PASS (tested local provider)
PHASE 2C HTTP/BROWSERROUTER CHECKPOINT: PASS (controlled local viewer)
OVERALL PHASE 2: NOT YET
PUBLIC HOSTED IMPORT READY: NO
