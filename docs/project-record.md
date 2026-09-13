# WebCanBe project record

The source is the product. Preserve adapter / bridge / runtime / transaction separation.

- Phase 1 reviewed baseline: `6f3582a`.
- Recovered Phase 2: `68666d6` implementation, `d1683f6` validation.
- The full original recovery report is preserved verbatim at
  `reports/phase2-recovery-report.md`; its original and iCloud repository are untouched.
- Active repository: `~/Developer/WebCanBe-recovery`, branch `phase-2-compatible-editor`.
- Verified remote: `https://github.com/Webcanbe/webcanbe-real.git`.
- Phase 2B: targeted runtime-profile checkpoint passes. See `phase2b-runtime.md`
  for pinned versions, stage-specific audit, fixtures, commands, evidence and limits.
- Overall Phase 2 remains NOT YET complete; public hosted import is NOT ready.
- Full outstanding Phase 2 requirements remain in `phase2.md` and the recovery report.
- Current commit/push state and next task: `current-handoff.md`.

No main merge, force push, public runtime deployment, landing redesign or paid
infrastructure is authorized by this checkpoint. Future hosted runtime work requires
ownership authorization and resource isolation; a browser iframe does not isolate Node.


## 2026-09-13: Phase 2C isolated HTTP prototype and safe admission blocker

Continued the existing recovery branch from b4438a999ccd98e391dd5f2670d4deeb897e0870, preserving and repairing the audited partial compiler edit. No project restart, main change, original iCloud change or framework upgrade. See [complete report](reports/phase2c-http-preview.md) for exact files, threat boundary, test commands, screenshots, external-candidate versions, security review and publication record.

The unchanged BrowserRouter HTTP prototype passes authored root/nested/parameter/query/anchor/basename/assets/history/refresh/transaction/export checks, with independent isolated export builds and uncoupled desktop/mobile renders. HTTP remains unreachable from the editor because native-sandbox Chromium's CSP did not block WebRTC traffic. No approved runner was substituted by an unsafe flag. Unit suite: 95 passing including all existing 69; TypeScript/build and existing HashRouter/Field Notes regressions pass. Full BrowserRouter editor UI and compatible independent external-project acceptance remain open. Manual security review was performed; Codex Security did not run. The approved overlay/message fixes, focused regressions and all failed probes are disclosed in the report.

Historical blanket offline/network-isolation language is qualified by the new self-navigation/WebRTC probes. Existing opaque-origin/resource CSP/mutation controls remain, but they do not establish hosted hostile-code isolation.

Phase 2C NOT YET. Overall Phase 2 NOT YET. Public hosted import ready NO. The full product-experience/navigation/seller/footer/Docs plan is preserved, together with broader dependencies/configs/Tailwind, responsive authoring, semantic gestures, editable Code UI, durable/multi-file history, imported HMR and hosted ownership/resource isolation. This runtime checkpoint does not replace or complete any of those requirements.

Publication receipt: implementation/validation checkpoint `4a6520f795e52bff2ccebabd1ea13274dfe85466` was normally pushed to `origin/phase-2-compatible-editor` and its exact remote tip verified. Main remained `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. The accompanying receipt changes documentation only. HTTP remains disabled; Phase 2C NOT YET, overall Phase 2 NOT YET, public hosted import ready NO. Work stops here without a speculative WebRTC workaround.


## 2026-09-13: Phase 2C.1 controlled browser boundary foundation

See [Phase 2C.1 report](reports/phase2c1-network-isolation.md) and current handoff. The safe checkpoint and remote were verified before work. Browser controls failed reproducible RTC/STUN/TURN/remote-ICE network probes; separate origins and media permissions do not supply zero egress. Strict arbitrary JavaScript execution must move into a controlled browser/network job with mediated display/input. Moving only the HTTP server would not close the boundary.

The dormant controlled transport now binds immutable artifacts and server-authorized session/generation/revision leases, denies external network capability and separates raster output from executable app bytes. No concrete isolation provider or public viewer is installed; test doubles do not prove network/process isolation. BrowserRouter HTTP remains disabled. All original tests and the existing HashRouter/Field Notes workflows are preserved; final evidence is in the report. No platform secret or mutation authority enters the preview job. Phase 2C.1 NOT YET; Phase 2C NOT YET; overall Phase 2 NOT YET; public hosted import ready NO. Existing broader product requirements are unchanged.


## 2026-09-13: Phase 2C.2 first real local controlled runner

The [Phase 2C.2 report](reports/phase2c2-controlled-runner.md) records the clean `6b43dce` baseline, actual OS boundary and sanitized negative/positive evidence. A project-local no-mount Lima VM runs Chromium and its supervisor inside private Linux namespaces and a bounded systemd cgroup. The existing controlled broker now serves an authenticated raster/selection/input path to a separate-origin trusted viewer. Project JavaScript never reaches the ordinary browser in strict mode; credentials/source-write authority never enter the job.

Local controlled-runner and BrowserRouter checkpoints PASS, including nested/deep-link/history/basename/assets/404, visual source changes/diff/undo/redo/export, real network/process/filesystem/resource/expiry/revoke checks and all preserved browser regressions. 116 tests include the original 108. Default non-strict Blob compatibility remains qualified; raw HTTP admission stays disabled without the server-selected controlled provider. Overall Phase 2 NOT YET; public hosted imports NO. Main and broader product scope are untouched. No paid or hosted infrastructure was required.


## 2026-09-13: Phase 2D/E Code ↔ Canvas and durable source history

Local targeted checkpoint PASS; overall Phase 2 NOT YET; public hosted imports NO. Clean starting local/live branch was `66403284303f12cfdc38139c4d81780ef63b131a`. Implementation/verification commit is `390d1f09a1bd50b062a80483c80bbffb96e7a10a`; the accompanying report/handoff is a separate branch commit. Main remains `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. See the [complete report](reports/phase2de-code-canvas-history.md) and [evidence receipt](reports/phase2de-evidence/verification-results.json).

CodeMirror direct editing and Visual editing now share the existing authorized transaction model, unique source revisions, expected hashes and idempotency. Code acceptance refreshes source analysis/anchors and the controlled raster preview while preserving route/viewport and invalidating stale selections. A private JSON ledger outside source exports persists mixed history and inverse evidence; a fsynced journal recovers multi-file source changes and a SQLite process lease serializes competing registries. Undo/revert creates a current-base inverse, preserves unrelated files and refuses same-file conflicts. Invalid local drafts retain the accepted source/preview. Accepted source/history survives actual server restarts; memory-only unsaved drafts do not.

All original 116 tests retained unchanged; 145 tests pass. TypeScript/build, real controlled-runner isolation/resource regressions, legacy HashRouter/Field Notes, controlled BrowserRouter, new Code/Canvas/strict HashRouter/restart/file-operation acceptance and independent final exported build/render pass. SIGKILL tests cover journal/partial-source/committed-ledger recovery. Original runner/compiler/profile/fixture implementations are unchanged. No active preview jobs remained; the existing local VM was stopped. No external security audit, hosted readiness, main merge, paid infrastructure or deployment is claimed.

Still open: broader CSS/Tailwind/source analysis, full responsive authoring, semantic gestures, true imported HMR, broader runtime/configuration profiles, hosted ownership/scheduling/storage/resource isolation, external-project/security audit, history compaction/recovery UX and the full final product/experience/Marketplace/AI/seller/payment/admin plan. The report documents conservative reverts, source-only editing scope, configured compiler validation and draft durability limits. This checkpoint supersedes historical statements that Code and history are wholly unimplemented without deleting their broader remaining requirements.
