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
network. No key/capability is sent to preview. Ten-minute authority and source guards
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
