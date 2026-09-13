# Phase 2 recovery checkpoint

The source remains the product. This extends the reviewed Phase 1 engine at
`6f3582a`, on `phase-2-compatible-editor`. It does not replace its adapter,
bridge, runtime, or mutation boundaries, and does not change the landing page.

## Run and verify

Validated with Node 26.4.0. The runtime needs Node's `zlib.crc32` API.
From this trusted WebCanBe repository, run `npm ci --ignore-scripts`, `npm test`,
`npm run build`, then `npm run dev`. Build includes `tsc -b`; no lint script is
configured. These commands must never be run automatically in an uploaded project.

Open `/workspace/northstar`. Enter the local editor access key printed by that
server run, then choose Connect / renew session. The key is held in editor
memory, is not persisted in browser storage, and is not sent to the preview.
Import a ZIP of `fixtures/field-notes` to exercise the complete editor loop.
Imported source is stored under the ignored `.webcanbe/projects/<uuid>` directory.
Reopen `/workspace/<uuid>` after a restart; reconnect with the new server key.

## Trust and execution boundaries

Every engine endpoint requires the operator key. Session creation is an
operator-authorized action, not an unauthenticated local-origin bootstrap.
Project operations additionally require a server-created random session ID and
256-bit opaque capability. The server stores only its hash, expiration, permitted
operations, project ID and canonical source root. Sessions expire after ten
minutes; at most 100 are retained. Origin/Host checks are defense in depth.

Writes reauthorize at commit, validate the source identity and project revision,
confine paths to the registered `src` root, reject symlink/hardlink targets and
check expected content/inode/device before an atomic single-file rename. Unknown
identities, stale revisions, expired authority and cross-project requests fail
closed. These checks assume private local project storage; concurrent hostile
processes with filesystem write access require stronger OS isolation.

ZIP intake parses data without executing it. A controlled esbuild browser bundle
resolves project-relative files and an allowlist of installed React 19 runtime
modules. Uploaded package scripts, Vite config, tsconfig, Tailwind plugins/config
and environment files are never evaluated or loaded into the server runtime.
No dependencies are installed for imported projects.

The preview runs in `srcdoc` with `sandbox="allow-scripts"`, an opaque origin,
and CSP denying network connections, frames, workers, forms and remote assets.
It receives a nonsecret session ID for bridge messages, never the operator key
or capability. Preview messages can request selection/inspection; writes require
an explicit editor action. Temporary DOM source IDs exist only in bundled copies.
Imported files cannot be served through the main Vite application transform path.

This is a local single-operator development runtime. Production build success
does not imply a hosted import/mutation service. Hosted account ownership,
process/CPU/memory isolation and a safely isolated dependency runner remain open.

## ZIP limits and export

| Limit | Value |
| --- | --- |
| Compressed upload | 25 MiB |
| Uncompressed total | 40 MiB |
| Individual file | 2 MiB |
| Entries | 2,000 |
| Compression ratio | 100:1 per member |
| Path | 512 characters, 20 segments, 128 characters per segment |
| Stored imports | 20 projects |

All entries are validated before any extraction writes. Reject traversal,
absolute/Windows/UNC variants, ambiguous Unicode/reserved paths, case-insensitive
duplicates, file/directory conflicts, links/special files, encrypted members,
invalid sizes/checksums/UTF-8, binary text, and unsupported extensions. `.git`,
`node_modules`, `.webcanbe` and secrets-bearing `.env` files are refused.
A conventional React/Vite package and `src/main` or `src/index` JSX/TSX entry are
required. Unsupported previews retain source inspection when intake succeeds.

Export packages the actual current source, including package metadata and config,
without regeneration or permanent instrumentation. Exported package dependencies
remain the project's own declarations; preview resolution does not rewrite them.

## Editing and analysis

React-specific AST work remains in the React adapter. Native DOM, custom component
boundaries, nested components and fragment children receive independent analysis.
Safe static JSX text/string expressions, imported CSS, CSS Modules, inline object
properties and static Tailwind tokens produce exact source ranges. Dynamic
classes/children, ambiguous styles and spreads have machine-readable reasons and
restricted capabilities. Component calls are code-only; mapped rendered children
can be selected independently. Source inspection is read-only in this checkpoint.

Compatibility is derived from the analyzed source target list:
`round(100 * (full + 0.5 * partial) / total)`. Counts describe static source
locations, not the number of runtime instances. Full means supported safe edits
without detected limitations, not arbitrary visual editability.

Semantic controls change existing gap, alignment, justification, order, flex sizing
and grid declarations. They do not infer placement from pixel drags or introduce
absolute positioning. CSS changes preserve comments and unrelated text. Complex
cascade/specificity, runtime overrides and globally imported styles are not fully
modeled; broader mapping needs regression-backed expansion.

Viewport modes use real iframe widths: mobile 390, tablet 768, desktop 1280, scaled
to fit the editor. Responsive mutations change existing supported CSS media-query
declarations or existing unambiguous base/md/lg Tailwind utilities. Missing or
unknown responsive constructs are rejected. Imported previews rebuild/reload
after transactions; imported-project HMR is not implemented.

Tailwind supports bounded static spacing, sizing, color, typography, radius,
flex/grid/alignment utilities using installed v4 defaults. It never converts them
to inline styles. Arbitrary values, custom themes/config/plugins and the full
utility vocabulary are not supported. Proven `clsx`/`classnames` imports (including
`cn` aliases) support literal strings and arrays in the adapter; dynamic branches
and arbitrary local `cn` functions are restricted. The controlled preview does
not yet resolve these helper packages, so such projects currently use source
inspection unless their code avoids that runtime dependency.

Every successful change records a transaction ID, exact before/after source
patches, affected file and content hashes. Undo/redo applies those patches to real
source and refuses external conflicts. A new edit invalidates redo. Diff output
uses the same transaction patches, with paths, offsets and added/removed text.
History is in memory and single-file; durable and atomic multi-file transactions
are intentionally not claimed.

## Regression and browser coverage

`engine.test.ts` and `phase2.test.ts` cover 49 passing cases: original engine
behavior, malformed and malicious ZIPs, no uploaded script/config execution,
export round trips, invalid/wrong/expired/scoped capabilities, cross-project
writes, root/file symlinks, hardlinks, traversal, unknown identities, HTTP origin
and operator authentication, stale writes, source mapping, CSS/module/inline/
Tailwind editing, static/dynamic helpers, semantic restrictions, responsive
source patches, undo/redo conflicts, diff and multi-file rejection.

Fixtures comprise the existing compatible React/Vite project (now standalone)
and a nine-file Field Notes editorial project combining CSS, CSS Modules, inline
styles, Tailwind, nested custom components and runtime-generated children. Focused
inline fixtures cover safe/unsafe helpers and malicious archives.

Browser acceptance uses Chromium against the local server: import Field Notes,
render, select its heading, edit text, inspect disk and diff, undo exact source,
redo, edit CSS Modules and inline styles, edit Tailwind/base and tablet tokens,
edit a mobile media query, verify actual viewport widths, then download source.
The exported ZIP is checked for real edits and absence of generated source IDs.
Chromium also verifies that the iframe cannot read the editor DOM or call engine APIs,
and that its HTML contains no operator key or capability. No uncaught runtime
errors occurred. No uploaded install/build command is used in this workflow.

## Remaining definition-of-done work

Phase 2 is NOT YET complete. Next, extend the controlled dependency resolver and
real-project fixture matrix (starting with trusted clsx/classnames and explicit
version compatibility) while preserving execution and capability boundaries.
Then complete broader safe stylesheet/Tailwind analysis, responsive authoring,
transaction-backed code editing and durable history. Hosted use additionally
requires account/project ownership and an isolated runner with resource limits.
The local engine checkpoint must not be presented as a production multi-user
security boundary or universal React/Vite project support.
