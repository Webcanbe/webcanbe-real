# Phase 2B runtime compatibility

## Audit of d1683f6

| Stage | Actual checkpoint behavior |
| --- | --- |
| ZIP acceptance | Bounded non-executing extraction; React/Vite declarations and conventional src entry required |
| Static analysis | React AST and exact CSS/JSX ranges; independent per-source targets |
| Dependency resolution | Host application's React/react-dom/scheduler packages; React major only checked; uploaded locks unused |
| Execution | Controlled esbuild browser bundle inside opaque srcdoc; uploaded Vite/tsconfig ignored; no uploaded Node execution |
| Mapping | Temporary native JSX IDs in bundles; CSS/Modules/inline/static Tailwind source origins |
| Mutations | Scoped authorized transactions; minimal source patches; existing semantic/responsive constructs |
| Export | Actual uploaded files plus source edits, independent of temporary instrumentation; no separate clean export build verification |

The old preview's successful rendering did not establish declared-version or build
configuration compatibility. Phase 2B replaces that assumption with an explicit
repository-owned runtime profile. This document is updated with final test results
before committing the completed checkpoint.

## Supported profile: react19-vite6

| Package | Pinned version |
| --- | --- |
| React / React DOM | 19.3.0 |
| React Router DOM / React Router | 7.18.3 |
| clsx | 2.1.1 |
| classnames | 2.5.1 |
| Tailwind / @tailwindcss/vite | 4.3.3 |
| Vite | 6.4.3 |
| @vitejs/plugin-react | 4.3.4 |
| TypeScript | 5.9.3 |

The repository-owned `runtime-profiles/react19-vite6/package.json` and npm lock
are the authority for this profile. Install it deliberately with
`npm run runtime:prepare` (`npm ci --ignore-scripts` in that profile directory).
Importing a project never invokes this command or installs its dependencies.
Client resolution is confined to the profile's own package directory; there is no
fallback to the editor's `node_modules`. Build tools in the trusted editor remain
separate from imported application dependencies. npm audit reported zero known
vulnerabilities for the completed profile at validation time.

Every declared dependency must have a profile version satisfying its semver range.
Without a lockfile, the UI discloses the exact selected profile versions. With an
npm v2/v3 lockfile, declarations, versions and package integrity must match,
including the executed transitive client graph. Conflicts, missing packages,
unsupported versions, overrides/workspaces and other lockfile formats produce
explicit diagnostics; source and dependency declarations are never rewritten.
The profile is intentionally finite: matching a React major version is insufficient.

### Stage boundaries

1. **ZIP acceptance:** existing bounded, non-executing intake. A project may be
   accepted for source inspection while its runtime/configuration is unsupported.
2. **Static analysis:** existing per-source React/CSS capability analysis. Runtime
   support and visual editability are different results.
3. **Dependency resolution:** explicit profile/manifest/lock checks above, followed
   by confined browser-condition package resolution; unknown imports fail closed.
4. **Application execution:** only browser code in a sandboxed iframe. No uploaded
   Node module, Vite config, build hook or plugin executes in the trusted API.
5. **Source mapping:** normal JSX/TSX, nested components, direct CSS/Modules imports,
   inline styles, static Tailwind and proven clsx/cn aliases retain exact ranges.
6. **Visual mutation:** the unchanged scoped transaction pipeline edits supported
   text/style and existing semantic/responsive source constructs.
7. **Export:** original files plus actual source patches; package/config/lock files
   are preserved, without instrumentation, credentials or hidden fixture files.

### Narrow configuration grammar

`index.html` is parsed as HTML data: one project-local `src` JSX/TSX module and a
`div#root` mount. This supports ordinary alternative entries such as
`src/client.jsx`; the original conventional entry fallback remains for old fixtures.
Inline/head scripts, custom HTML execution and nonstandard mounts are rejected.
Document metadata is not a general HTML templating API.

The Vite AST grammar permits a single object/default `defineConfig` export,
known React/Tailwind plugin calls without custom arguments, `/` or `./` base,
and a `resolve.alias` object whose @/~ prefixes resolve through
`fileURLToPath(new URL('./project-local-directory', import.meta.url))`.
The imports must be declared and known. No uploaded import or expression is evaluated.
Spreads, computed values, callbacks, arbitrary statements/plugins and other fields
require a separately isolated configuration runner.

JSONC TypeScript configuration is read as data. Single-target `@/* -> src/*`
paths must agree with explicit Vite aliases; bounded local references are inspected.
Alias escapes, conflicting paths, package extends, plugin/decorator/custom JSX
transforms and unsupported runtime-transform options are rejected. Type checking
is separate from the browser preview's transpilation.

Local assets imported from source or CSS resolve inside the project and become
browser data URLs. HTTP assets, Node builtins, arbitrary package imports and
application-root escapes are refused. Public-directory URL conventions and general
HTTP serving behavior are not claimed by this profile.

Tailwind 4 defaults and the static Vite Tailwind plugin pattern are supported.
Tailwind 3, custom config/PostCSS plugins and unimplemented directives such as
`@theme`, `@apply` and `@utility` are explicitly rejected instead of silently ignored.

### Routing and preview authority

React Router HashRouter, routes, links and nested components execute unchanged.
BrowserRouter/browser-history/server routing needs an isolated HTTP preview runner
and is reported as unsupported. The editor's Select / Interact toggle allows real
link navigation without turning preview messages into mutation commands. Hash-route
messages are validated and carried across preview rebuilds; they confer no authority.

`about:srcdoc` was unsuitable for the router's URL resolution. The editor now loads
an in-memory HTML Blob URL inside `sandbox="allow-scripts"`, with NO
`allow-same-origin`. The document still has an opaque security origin even though
the Blob URL has a useful location origin. A controlled Chromium probe verified
`event.origin === "null"`, `self.origin === "null"`, and denied parent-DOM, storage
and the tested fetch/resource requests before this transport change was approved.
The main two-project browser workflow rechecks DOM/API-fetch denial and absence of the operator key.

CSP restricts fetch/resource loads, frames, workers and forms, but does not block
all possible browser egress. The Phase 2C WebRTC/RTC and self-navigation probes
qualify the historical networking claim; HTTP admission remains disabled. Blob URLs are
revoked when replaced. They are not authorization credentials or server endpoints.
Ten-minute project/session/operation/root/revision/capability checks remain unchanged;
privileged keys and mutation capability never enter the iframe. No public endpoint,
account system or hosted imported-code service was added.

## Fixtures and validation

`fixtures/trail-atlas` is a newly authored JSX walking-guide fixture with HashRouter,
separate pages, nested cards, JSON data, an SVG asset, CSS and CSS Modules, using a
normal `src/client.jsx` entry. `fixtures/studio-ledger` is a newly authored TSX
studio-planning fixture with routes, multiple components, JSON/SVG assets, Vite/
TypeScript aliases, static clsx calls and responsive Tailwind utilities. Both have
ordinary manifests, lockfiles and executable Vite configurations, with no WebCanBe
source annotations. They are distinct regression fixtures, not independently
sourced projects or evidence of universal real-world compatibility.

Validated on macOS with Node 26.4.0 and Chromium through the available Playwright
runtime. Browser plugin and agent-browser CLI were unavailable; Playwright was the
recorded fallback. Desktop editor viewport was 1440x1000, standalone 1280x900, and
standalone mobile 390x844. New controls use neutral native styling; landing and
unrelated product-shell styling were unchanged.

Commands:

```sh
npm ci --ignore-scripts
npm run runtime:prepare
npm test
npm run build
npm run dev -- --host 127.0.0.1 --port 5181
# Playwright can be supplied from an existing installation; it is not an app dependency.
WCB_PLAYWRIGHT_MODULE=/absolute/path/to/playwright node scripts/verify-phase2b-browser.cjs /absolute/qa-output /absolute/private-dev.log http://127.0.0.1:5181
python3 scripts/verify-export-sandbox.py /absolute/qa-output/trail-atlas-edited.zip /absolute/new-trail-validation
python3 scripts/verify-export-sandbox.py /absolute/qa-output/studio-ledger-edited.zip /absolute/new-studio-validation
```

Results: **69 tests passed across three suites**, including all 49 existing cases.
TypeScript (`tsc -b`) and the Vite production build passed. No lint script exists.
The old poison-config test still proves intake does not execute config; preview
acceptance now requires supported static config instead of ignoring that poison.
New tests cover manifest/version/integrity conflicts, missing/transitive packages,
alias escape, executable/forged config, hooks, unknown imports, unsupported routing/
Tailwind, source transactions, and unmodified dependency metadata on export.
Existing cross-project, stale revision, expiry and source-root security tests pass.

For both projects, Chromium verified ZIP import, disclosed resolution, real render,
local assets, internal routes, mapped selection, text/style source changes, diffs,
full editor reload, source undo/redo and export. The original Field Notes browser
loop also passed after the transport change, including CSS Modules, inline styles,
Tailwind and responsive CSS/Tailwind edits, true viewport widths and isolation checks.
No uncaught application runtime errors or framework overlays were observed.

### Independent export verification

The macOS-only QA runner creates a fresh job, extracts the exported source and copies
actual package files from the dedicated profile into the job. It validates exact
fixture manifest/lock/profile agreement and installed package integrity metadata.
There are no links back to editor dependencies. Platform-optional packages that are
not installed are not needed by the tested macOS build.

Uploaded Vite configuration and approved installed plugins execute only under the
OS sandbox with a clean environment. File reads are limited to job/runtime and OS
paths; writes to the job; execution to Node/esbuild; network denied. The only extra
OS permissions added during diagnosis were the root directory read required by dyld
and read-only account-directory lookup required by Vite. Synthetic canary probes
prove outside-file read/write denial, shell-exec denial and network denial before
building. A 45-second process-group timeout bounds each command. Uploaded npm
lifecycle/build scripts are never invoked.

Both exported projects passed real standalone Vite builds under that policy. Their
built files then passed Chromium render/assets/routes/reload checks from temporary
loopback-only static servers, with all external browser requests blocked. Edited
text and CSS/Tailwind values were present without source IDs, bridge code, operator
credentials or the editor. This is an approved local QA environment, not a service
for arbitrary user configuration or a cross-platform/VM resource-isolation claim.

## Remaining requirements and statuses

**PHASE 2B TARGETED CHECKPOINT: PASS** for the explicit profile above.
**OVERALL PHASE 2: NOT YET.** **PUBLIC HOSTED IMPORT READY: NO.**

Remaining: more dependency/version/lockfile profiles and independently authored
project coverage; BrowserRouter/HTTP routing; broader safe CSS cascade/aliases and
Tailwind configuration; new responsive construct authoring; transaction-backed
editable code UI; durable/multi-file history; imported-project HMR; hosted account
ownership and resource-isolated execution. The existing no-landing-redesign scope,
marketplace/auth redesign deferral, AI-editing deferral and no-main-merge rule remain.

Next recommended task: add an isolated HTTP preview profile for ordinary
BrowserRouter applications, keeping account/ownership and mutation authority outside
that runner, then validate independently authored projects against explicit versions.

## Changed modules

- `runtime/runtimeCompatibility.ts`: explicit profiles, package/lock identity,
  HTML entry parsing and static configuration/alias interpretation.
- `runtime/isolatedPreview.ts`: dedicated package resolution, local assets,
  configuration diagnostics, router restrictions and Tailwind guards.
- `runtime/projectRegistry.ts` and `runtime/viteFixturePlugin.ts`: entry detection
  and owner-visible runtime reporting; existing mutation authorization preserved.
- `bridge/previewProtocol.ts`, `runtime/previewBridge.ts` and
  `visual-editor/CompatibleWorkspace.tsx`: validated hash-route messages, neutral
  interaction control, credential-free sandboxed Blob transport and profile details.
- `runtime-profiles/react19-vite6`, two new fixture directories and
  `phase2b.test.ts`: pinned reproducible dependencies and positive/negative coverage.
- `scripts/verify-phase2b-browser.cjs` and `scripts/verify-export-sandbox.py`:
  reproducible browser loop and independent OS-isolated export QA.
- Package parser dependencies, concise AGENTS/project/handoff documents and preserved
  historical report. No source mutation/history architecture replacement.


## Phase 2C follow-up qualification (2026-09-13)

The Phase 2B baseline above remains the controlled Blob bundle, not an uploaded Vite server. Its 69 tests and the HashRouter/Field Notes browser editing flows passed the Phase 2C regression runs. The shared compiler now also produces dormant HTTP artifacts, but history-router admission is deliberately rejected until an approved browser network-isolation runner exists. See the [Phase 2C report](reports/phase2c-http-preview.md).

New native-sandbox browser probes found that an opaque HTTP document can use native pathname History API without allow-same-origin. They also found inherited Blob self-navigation and WebRTC egress gaps beyond resource/fetch CSP. Earlier offline or complete-network-denial wording must not be treated as a security guarantee. No existing iframe permission or source-mutation authorization was weakened to conceal this. A full BrowserRouter editor and hosted/security acceptance pass is not claimed. Imported rebuild/reload is still not HMR.


Phase 2C.1 follow-up: the [controlled-execution foundation and new network evidence](reports/phase2c1-network-isolation.md) preserve this compatible local workflow and its tests, while moving the intended strict execution boundary into a controlled browser/network job. No strict client-iframe guarantee, installed provider, BrowserRouter admission or hosted readiness is claimed.
