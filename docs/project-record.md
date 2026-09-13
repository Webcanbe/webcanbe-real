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
