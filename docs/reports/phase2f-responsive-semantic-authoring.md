# Phase 2F — responsive and semantic source authoring

Date: 2026-09-14. Repository: `Webcanbe/webcanbe-real`. Branch: `phase-2-compatible-editor`.

**PHASE 2F RESPONSIVE + SEMANTIC AUTHORING CHECKPOINT: PASS** for the bounded local support documented here. **OVERALL PHASE 2: NOT YET. PUBLIC HOSTED IMPORT READY: NO.**

## Baseline and preserved boundaries

Verified working directory `~/Developer/WebCanBe-recovery`, clean tree, branch and expected HEAD `fac8339e86ca2e0a6395f73b922917fdc1a41de6`. Live origin is `https://github.com/Webcanbe/webcanbe-real.git`; its feature branch matched exactly. `git merge-base --is-ancestor` confirmed implementation ancestor `390d1f09a1bd50b062a80483c80bbffb96e7a10a`. There is no local `main` branch in this checkout: both the existing `origin/main` tracking reference and live remote main/HEAD were `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. Initial sandboxed DNS failed; an authorized network-enabled read verified the remote. No main merge, force push or public deployment is part of this checkpoint.

Read AGENTS, current handoff, project record, Phase 2/2B/2C/2C.1/2C.2/2D/E reports, and inspected adapter/source mapping, mutation, durable history, API, Code/Canvas, compiler, runner and browser harness seams. The original seven test files and original fixtures remain unchanged. The runner/provider, compiler, profile, bridge, authorization implementation and durable journal/ledger implementation remain unchanged.

Real source files remain canonical. The new operations produce ordinary existing `MutationTransaction` source patches. The existing API prepares a revision snapshot, validates the proposed source, checks expected base/hash and revision-scoped anchors, reauthorizes, and commits through `DurableSource`. Reorder additionally compiles its staged project before acceptance. There is no canvas document or second visual history.

## Style/source-origin architecture

`reactSourceAdapter.ts` retains native JSX identities and literal ranges. It now emits existing media declarations, expanded utility/property categories, lexical component ownership, conservative callback repetition, and literal value-origin metadata. The additive `projectStyles.ts` performs project-wide reconciliation over the authorized source snapshot:

- Ordinary imported CSS classes, CSS Modules, inline literals, Tailwind tokens, responsive variants and direct-parent inherited typography have distinct origins. Exact source file, token/declaration range, source value, selector/variant, active/effective flags, reason, known usage count and effect-scope text are returned to the inspector.
- Global simple-class candidates are found through static CSS imports, including entry-file imports. An unimported stylesheet is not selected merely because a class name or computed value matches. Stylesheets potentially affecting the same property are considered conservatively; this is not a complete runtime import/cascade graph.
- Simple class specificity outranks an ordinary tag selector. Existing same-selector media declarations use source order at the active width. Overlapping classes/utilities, important declarations, complex selectors, conditional/nested rules and overlapping shorthands fail closed where effective ownership cannot be proven. A computed browser value is displayed as an observation; it never selects a writable source range.
- Direct-parent inherited color/font size/font weight/line height/letter spacing is exposed read-only. Inheritance across arbitrary component boundaries, complete browser defaults, runtime CSSOM changes, external styles, layers, containers and general selectors are not resolved.
- Counts describe **statically known source uses**, not an exact DOM cardinality. Component call sites and obvious repeating callbacks increase or qualify scope; aliases, higher-order components and runtime repetition can make actual counts unknown. The UI explicitly says definition edits affect all rendered instances. Ordinary CSS is globally scoped even when imported by one component.
- Shared rules/const origins require the API's explicit `scope: "source"` strategy. The inspector shows the scope before Save and offers source scope versus instance-only scope. Instance-only requests are refused for shared sources. Reorder changes JSX definitions; it never silently isolates one repeated instance. Shared/repeated text also requires source scope. Code remains available to edit individual prop invocations.

This is conservative source analysis, not a promise of universal visual editability. Read-only reasons and Code access remain part of the supported behavior.

## Responsive model

Preview sizes remain mobile 390, tablet 768 and desktop 1280 CSS pixels. They are **viewports**, not newly invented project media queries. The separate authoring selector exposes base/default, supported Tailwind variants and the project's existing CSS media conditions. `Save at mobile/tablet/desktop` remains compatible with prior workflows; explicit breakpoint IDs select exact origins.

- Base edits replace unprefixed source values. Wider viewports may inherit them until an existing override applies; the inspector explains this behavior.
- Tailwind defaults are sm 640, md 768, lg 1024, xl 1280 and 2xl 1536 for the pinned v4 profile. Static CSS `@theme` breakpoint literals and the `initial` reset are understood by analysis. Custom/nonliteral configuration disables unsupported variant mutations instead of inventing defaults.
- **Analysis of `@theme` does not expand runtime admission.** The unchanged compiler still rejects `@theme` and unsupported Tailwind configuration/directives. Those projects retain the existing partial/code-only/runtime-unsupported qualification. The real browser acceptance uses the supported default profile.
- Existing root-level `@media (min-width: …)`, `(max-width: …)` and their `and` combinations are supported in px/rem/em, with the CSS initial 16-pixel media-query font basis. Optional `screen and` is recognized. CSS media IDs retain the original query text and file origin; no fixed 767/768/1023/1024 query is synthesized.
- At a viewport, known min-width Tailwind overrides and matching CSS media rules determine the source candidate. State/compound/unknown variants are disclosed as conditional analysis-only sources. They are not silently edited as responsive variants.
- An explicit breakpoint edit replaces only its existing token or declaration. Missing declarations/variants are refused. Creating new media rules/utilities, automatic breakpoint selection for every design and arbitrary media-range syntax remain open.

Responsive transactions use the same history, base/hash/idempotency checks, inverse patches and restart persistence as other source edits. Acceptance clears stale selection/anchors and rebuilds the controlled preview while preserving route and viewport where supported.

## Tailwind, static values and semantic operations

Supported existing utility families include spacing, sizing/min/max, typography weight/size/leading/tracking, flex direction/grow/shrink/basis, grid tracks/start placement, alignment/justification, display, border width and radius. Numeric/default semantic inputs use the bounded existing token conversion tables; explicit supported utility tokens can be supplied. Unknown/custom tokens are preserved byte-for-byte, as are unrelated variants and whitespace. No whole `className` string is reconstructed. Arbitrary/important utilities that could overlap the property make affected editing conservative. Border color/style combinations, directional radius, arbitrary expressions and complete Tailwind vocabulary are not claimed.

Literal strings and previously supported proven `clsx`/`classnames` compositions retain their behavior. New tracing follows a unique top-level local const into literal object/array properties, without JavaScript evaluation, and writes the actual underlying literal token. Shared const storage is explicitly source-scoped. Shadowing, cycles, mutable declarations, aliases that escape, assignments, deletion, mutating calls, exported mutable objects, getters/spreads, conditions and runtime expressions are refused. General cross-file constants, prop-to-definition tracing, destructured props, imported helper evaluation and arbitrary JavaScript remain partial/code-only. Existing Code edits of individual literal component props are preserved and tested by the Phase 2D/E regression.

The inspector adds adjacent sibling move controls for static native JSX children of a proven Flex/Grid source parent. They exchange the real sibling JSX ranges while retaining the separating whitespace. Comments/expressions between siblings, dynamic children, unknown layout, repeated callbacks and component-boundary sibling moves are refused. No absolute positioning, pixel-coordinate persistence or proprietary layout primitive is introduced. Pointer drag intent remains unsupported; users exercise deterministic reordering through explicit controls. Flex direction/alignment/gap and Grid tracks/start placement use ordinary style controls. Resizing is through supported existing source width/height/flex/grid properties, not freeform canvas handles.

## Caches and invalidation

Bounded 64-entry caches retain parsed TypeScript ASTs, PostCSS roots and per-file target analysis. Target-analysis entries include actual stylesheet dependency content; changing that content invalidates the entry, and returned targets are cloned. File content, filename and Tailwind mode key the source result. Revision-specific identities are attached only after current authorized analysis, so reusing an unchanged AST does not reuse an old revision anchor.

Project scope, responsive effectiveness and conservative global relationships are recomputed from current source. This avoids reparsing every unchanged source for small edits while preserving correctness. It is not a full incremental compiler, import watcher or scalability benchmark; whole-project source/hash checks and preview rebuild/reload remain part of the existing correctness boundary. True imported HMR remains open.

## Acceptance and evidence

The fixture `fixtures/responsive-authoring` is newly authored for this checkpoint, with ordinary locked React/Vite/Tailwind/BrowserRouter source, CSS Modules, media rules, inline styles and local const composition. The browser harness separately imports a labelled HashRouter variant. Original fixtures were not modified. Synthetic telemetry is appended only to private QA copies, runs inside the controlled guest, and is removed through Code acceptance before exporting. No independently authored third-party project acceptance is claimed.

| Required case | Evidence |
| --- | --- |
| A: base Tailwind | Exact single token patch and inverse test; real mobile render, exact Code content, undo and mixed-history restart |
| B: responsive Tailwind | md mutation preserves base/lg bytes; mobile/tablet/desktop effective source tests and real rendering |
| C: CSS media | Existing 620px max-width value changes without base/900px mutation; mobile rendering verified |
| D: CSS Modules | Actual module declaration patch; independent 28px result |
| E: inline | Actual inline literal patch; independent 18px result |
| F: Flex reorder | Adjacent JSX swap, real changed sibling order, History/undo and restart source tests |
| G: Flex semantics | Direction, alignment and gap tests; real column and gap rendering |
| H: Grid semantics | Tracks and placement tests; real three-column rendering and source-order behavior |
| I: shared CSS | Known-use count and scope; instance-only rejection in unit/API path and real inspector workflow |
| J: unsafe source | Dynamic expressions, mutable/aliased objects, important/arbitrary utilities, ambiguous selectors/shorthands/nested conditions and unsupported reorder rejected |
| K: Code responsive | Code changes md padding to 64px; controlled tablet Canvas reanalysis/render |
| L: stale anchor | Old revision/hash anchor rejected after Code/Visual changes; original structural Code regression retained |
| M: restart | Separate editor/server processes preserve exact HEAD and mixed source History; undo after reconnect restores source/render |
| N: export | Clean original-style source ZIP, isolated independent build and uncoupled native-browser render with no editor instrumentation/runtime dependency |

The browser flow is `/workspace/<project>` → connect → original nested route → explicit visual source edit → resize → Code → History → actual server restart → undo → clean export → independent build/render. Both router variants retain nested routes through responsive edits and restart. Existing Trail Atlas, Studio Ledger, Field Notes, controlled BrowserRouter/basename, invalid Code drafts, safe file operations and Code/Canvas restart regressions remain separate gates.

Browser plugin/skill was unavailable; the frontend testing skill's Playwright fallback used the installed bundled Playwright and native-sandbox Chromium 151.0.7922.34. Editor viewport was 1600×1100; imported viewports were 390/768/1280×900. Checks include page identity, meaningful content, no framework overlay, exact source patches, observed rendering and runtime-error collection. Screenshots were visually inspected. QA screenshots, full logs, archives, local keys, project IDs, VM artifacts and private storage are not committed.

The existing real runner probes, not mocks, establish the finite tested network/filesystem/process/resource boundary. Source authority, viewer separation, session/generation/revision authorization, network denial, native Chromium sandbox, revoke/expiry and cleanup are unchanged. The retained legacy Blob browser checks remain explicitly non-strict; they are not network isolation evidence.

## Reproduction

Run only in the trusted WebCanBe checkout with its existing dedicated profile and local runner prepared:

```sh
npm test
npx tsc -b
npm run build
npm run runner:prepare
npm run runner:verify
WCB_PLAYWRIGHT_MODULE=/absolute/installed/playwright node scripts/verify-phase2c-editor-regressions.cjs .webcanbe/runner/qa-2f-legacy
WCB_PLAYWRIGHT_MODULE=/absolute/installed/playwright node scripts/verify-phase2c2-controlled.cjs .webcanbe/runner/qa-2f-controlled
WCB_PLAYWRIGHT_MODULE=/absolute/installed/playwright node scripts/verify-phase2de.cjs .webcanbe/runner/qa-2f-code
WCB_PLAYWRIGHT_MODULE=/absolute/installed/playwright node scripts/verify-phase2f.cjs .webcanbe/runner/qa-2f-responsive
python3 scripts/verify-export-sandbox.py .webcanbe/runner/qa-2f-responsive/BrowserRouter-edited.zip .webcanbe/runner/qa-2f-browser-build
python3 scripts/verify-export-sandbox.py .webcanbe/runner/qa-2f-responsive/HashRouter-edited.zip .webcanbe/runner/qa-2f-hash-build
WCB_PLAYWRIGHT_MODULE=/absolute/installed/playwright node scripts/verify-phase2f-export.cjs .webcanbe/runner/qa-2f-browser-build .webcanbe/runner/qa-2f-browser-render
WCB_PLAYWRIGHT_MODULE=/absolute/installed/playwright node scripts/verify-phase2f-export.cjs .webcanbe/runner/qa-2f-hash-build .webcanbe/runner/qa-2f-hash-render
```

Export build directories must be new. The existing export sandbox copies pinned dependency files and verifies read/write/exec/network denials; it does not execute uploaded npm scripts. The Code/Canvas final export was also built and rendered using the unchanged Phase 2D/E export harness.

## Review findings and honest limits

Verification caught and corrected a prefixed utility value validator, a too-conservative class-versus-tag specificity rule, and repetition detection that initially mistook a root `render(<App/>)` call for a repeating callback. Focused tests cover the fixes. Further review added mutable-object alias/deletion/export guards, unimported-style rejection and nested conditional/shorthand guards. The new API test was corrected to preserve the original fixture entry's named App export. Browser-harness corrections supplied an explicit viewport accessible label and used Fetch's boolean `Response.ok`. A final negative test also caught an unknown viewport falling through to a different breakpoint; the API mutation helpers now reject it, including prototype-property names. TypeScript required the repository-compatible own-property call rather than the newer Object.hasOwn API. One original Code/Canvas run timed out during a single coordinate selection; a fresh unchanged rerun passed. Failures were not counted as passes or hidden by modifying original fixtures/assertions.

Remaining Phase 2F compatibility limits are explicit: existing declarations only; no freeform pointer drag/resize model; conservative CSS ownership rather than complete cascade; known source-use counts rather than exact runtime cardinality; bounded utility/value grammar; local static values rather than general prop/cross-file evaluation; analysis-only custom `@theme`; and no broad external-project certification. Unsupported operations retain Code access and do not invent patches.

Still open after this checkpoint: true imported-project HMR, broader runtime/dependency/configuration profiles, hosted ownership/scheduling/storage/cookie/resource isolation, production hosted runner/provider, broader independently authored real-project validation, and the final external-project/security audit. All remaining compatibility gaps and the complete final product/Phase 4 UI, landing/dashboard/Marketplace, AI, collaboration, seller/payment/admin, experience/navigation/footer/Docs scope remain open and unchanged. No final design work or public deployment was performed.

## Final verification and publication

Implementation: `1a825e9b9107840a0faf00c24b9754f6c5fd3527`. Final invalid-viewport guard: `247d8ec83af3a83b766228f6325b2dd5983ec5e1`. Documentation/evidence are committed separately on the same branch; the final delivery identifies that tip without embedding a self-referential hash here.

| Gate | Final result |
| --- | --- |
| Unit/integration/security | **196/196 passing**, 8 suites: all original 145 retained unchanged plus 51 new cases; final run 7.25 s |
| TypeScript | PASS, both standalone check and production build's `tsc -b` |
| Production build | PASS, 82 modules, 2.42 s; existing lazy Code chunk advisory 543.01 kB (184.66 kB gzip) |
| Real runner isolation/resources | PASS; zero isolated collector records; positive controls verified; 1.5 GiB memory, no swap, 192 tasks, 150% CPU, 65-second deadline; frozen worker killed after 65,112 ms |
| Legacy HashRouter/Field Notes/boundary | PASS on sequential final run; original harnesses/assertions/fixtures unchanged |
| Controlled BrowserRouter/basename/viewer/authority/expiry | PASS on sequential final run |
| Code/Canvas/restart/invalid draft/file operations | PASS on sequential final run; zero runtime errors |
| Responsive BrowserRouter + HashRouter | PASS: 390/768/1280 widths, nested-route preservation, source/scope/semantic edits, Code, actual server restart, History/undo, clean exports; zero runtime errors |
| Independent exports | Both responsive variants and original Code/Canvas final export build/render PASS; filesystem/process/network probes pass; no uploaded npm script execution |
| Final export identity | Final responsive source ZIP contents match the independently built exports exactly |
| Cleanup | No active/retained `wcb-*` job units after the final browser suites; VM shutdown recorded in the final receipt |

Sanitized [verification receipt](phase2f-evidence/verification-results.json), [responsive browser results](phase2f-evidence/responsive-results.json), [Code/Canvas results](phase2f-evidence/code-canvas-results.json), [controlled browser results](phase2f-evidence/controlled-results.json), [legacy results](phase2f-evidence/legacy-results.json), [real runner results](phase2f-evidence/runner-security-results.json), [BrowserRouter export](phase2f-evidence/export-browser-results.json), [HashRouter export](phase2f-evidence/export-hash-results.json) and [Code export](phase2f-evidence/export-code-results.json) contain booleans, metrics and implementation file hashes only. Raw QA logs, editor screenshots, ZIPs, imported copies and VM artifacts remain outside tracked evidence.

Outgoing implementation/fixture/harness and documentation files were reviewed for credentials, tokens, private source and runtime artifacts. Credential-pattern and whitespace scans passed. Publication uses a normal push only to `phase-2-compatible-editor`; live feature/main tips are verified at delivery. No main merge, force push, public deployment, paid infrastructure or external security audit is claimed.

PHASE 2F RESPONSIVE + SEMANTIC AUTHORING CHECKPOINT: PASS
OVERALL PHASE 2: NOT YET
PUBLIC HOSTED IMPORT READY: NO
