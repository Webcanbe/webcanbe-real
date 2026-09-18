# WebCanBe Phase 2 — recovered, validated, committed

The iCloud repository was preserved. Work continued in a fully local clone at
`/Users/olivertaylor/Developer/WebCanBe-recovery`, with the readable recovery
snapshot retained at `/Users/olivertaylor/Developer/WebCanBe-recovery-backup`.
This report supersedes the earlier report that described iCloud download blockers.
No action is required from the user to preserve this checkpoint.

1. **Current branch:** `phase-2-compatible-editor`; clean working tree in the local clone.
2. **Starting commit / inherited state:** `6f3582a` (`6f3582affe8efd03489d87f0a83d24b5bd6e5f63`), with 11 modified tracked files and an untracked project registry. No staged changes were inherited. The Phase 2 branch already existed. No applicable AGENTS.md or SECURITY.md was found.
3. **Interrupted work found:** bounded ZIP intake, adapter classification expansion, new source transaction types, preliminary project/session security, bridge/runtime changes and workspace integration. Runtime/security integration was incomplete.
4. **Preserved:** all good inherited Phase 2 work, Phase 1 architecture and source files. Recovery backed up and hash-verified 45 files, cloned the known Phase 1 remote baseline, and reapplied the recovered changes on the Phase 2 branch. The original repository was not reset, checked out, overwritten or deleted during local recovery. No merge or push was performed; main was untouched.
5. **Architecture changes:** extended the existing React adapter, transaction pipeline and runtime. Added project registry, controlled preview bundler and source ZIP exporter. Source remains the authority; preview instrumentation exists only in generated browser bundles. Landing and unrelated product-shell design were unchanged.
6. **Preview/session security:** development-only operator key authorizes API access and session creation. Each scoped server record binds project, preview ID, hashed 256-bit opaque capability, canonical source root, allowed operations and ten-minute expiration. Writes reauthorize immediately before atomic rename, validate known identities and expected project revision/content, and reject symlink/hardlink/path escapes. The opaque-origin iframe receives only a nonsecret bridge session ID; CSP denies network access. Origin/Host checks supplement authentication. Hosted account ownership and OS/process isolation are not implemented.
7. **ZIP import:** controlled yauzl intake; 25 MiB compressed, 40 MiB total inflated, 2 MiB per file, 2,000 entries, 100:1 ratio, bounded path depth/length, 20 stored imports. Rejects traversal, absolute/Windows paths, duplicate/conflicting paths, symlinks/special/encrypted entries, invalid CRC/size/UTF-8, binary text, unsupported extensions and private metadata/env files. Imported installs, lifecycle scripts and Vite/Tailwind config are never executed.
8. **Source mapping:** native DOM, component boundaries, nested component children and fragments analyzed independently. Static JSX text/string expressions, multiple directly imported stylesheets, CSS Modules, inline styles and supported static Tailwind map to exact ranges. Dynamic expressions, shadows, spreads and ambiguity receive machine-readable reasons and restrictions. Destructured helper/module shadows are covered by regressions.
9. **Semantic editing:** changes existing gap, alignment, justification, order, flex sizing and grid source declarations. Unsupported drag intent is restricted. No guessed absolute positioning or layout additions.
10. **Responsive editing:** actual iframe widths 390/768/1280; writes supported existing media-query declarations or existing base/md/lg Tailwind tokens. Unknown or missing responsive constructs are rejected. Preview rebuild/reload reflects the source change; imported-project HMR is not implemented.
11. **Undo/redo:** real transaction patches with content hashes, conflict checks and redo invalidation on new edits. Restores actual source. History is in memory and limited to atomic single-file operations.
12. **Diff:** transaction ID, affected path, source offset and before/after added/removed text come from the same mutation patches used for history.
13. **Compatibility:** actual analyzed source counts; score is `round(100 * (full + 0.5 * partial) / total)`. Field Notes showed 20 full, 0 partial, 5 code-only source targets (80%). Runtime instances are not counted as separate source locations. Full does not mean every imaginable visual operation is supported.
14. **Tailwind / clsx / cn:** bounded static spacing, sizing, color, typography, radius, flex/grid/alignment utilities and existing breakpoint prefixes. No conversion to inline styles. Proven clsx/classnames imports, including cn aliases, support static strings/arrays in the adapter. Dynamic branches and arbitrary/shadowed helpers are restricted. The preview resolver currently supports React runtime packages only; helper dependencies and custom Tailwind configuration still trigger source-only fallback.
15. **Fixtures:** preserved original compatible React/Vite fixture and made it standalone; added nine-file Field Notes editorial project combining CSS, CSS Modules, inline styles, Tailwind, nested components and dynamic children. Focused in-test fixtures cover safe/unsafe helpers and mixed support.
16. **Security tests:** wrong project/session/capability, operation scope, expiration, cross-project write refusal, traversal, file/root symlinks, hardlinks, unknown identities, stale source, direct preview-origin requests, operator authentication, malformed ZIPs and nonexecution during intake. Browser isolation checks additionally prove the preview cannot read editor DOM or call engine APIs and contains no privileged key/capability.
17. **Tests / typecheck:** 49/49 tests across two suites passed, including original engine regressions, import/security/mapping/mutation/history/diff cases. `tsc -b` passed through the build script. No lint script is configured. Chromium passed import/render/select/edit/diff/reload/undo/redo/export across CSS Modules, inline, Tailwind and responsive CSS. No uncaught runtime errors. A test-server Vite cache collision discovered during validation was fixed by isolating its cache.
18. **Production build:** `npm run build` passed (TypeScript plus Vite). This builds the application shell; the local development engine is not exposed as a hosted production mutation API.
19. **Commits:** `68666d6` — `feat: add isolated project import and source-backed editing`; `d1683f6` — `docs: record Phase 2 validation and remaining constraints`. Final HEAD: `d1683f64b5796cc43cc81284f2007ca1accd96a3`. Git status and diff whitespace checks are clean.
20. **Remaining limitations / risks:** React 19 allowlisted runtime and conventional entry layout only; incomplete external dependency/config resolution, full CSS cascade and Tailwind vocabulary; no new responsive construct authoring; code panel is read-only; history is not durable or multi-file; imported previews reload rather than HMR; mobile editor shell hides intake controls; no hosted ownership or resource-isolated runner. Concurrent hostile local filesystem writers and browser CPU exhaustion are outside this local checkpoint's protection.

**PHASE 2 DEFINITION OF DONE: NOT YET**

Next recommended implementation step: expand the controlled dependency resolver
and fixture matrix, beginning with trusted clsx/classnames and explicit version
compatibility, while keeping imported configuration and scripts inert. Complete
broader safe mapping/responsive authoring and transaction-backed code editing;
before hosted use, add account ownership and an isolated runner with resource limits.

The exported Field Notes ZIP was inspected: nine real source/config files, all
expected edits present, no permanent `data-wcb-id` instrumentation or capability.
The accompanying source snapshot is a fresh archive of the final committed HEAD;
it excludes local project storage, credentials, dependency directories and Git metadata.
