# P05 final narrow follow-up — 2026-09-16

**P05 PASS. Internal blockers: P39 / P61. Phase 2 internal closure: NO.**

## Scope

Continued `phase-2-compatible-editor` from
`4cce6c861b8a47b224ee2b73f3f644731af53feb`. Main remains
`dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. This follow-up closes the final
retained P05 blocker: the exact Todo forms preset on its frozen UnoCSS 66 graph.
Prior Bun, Berry, Redux, Bulletproof, inert tooling, archive, export, source,
security, and 76-test evidence was reused.

No package manager, lifecycle script, uploaded config, uploaded plugin, or host
`node_modules` was executed. No admission-time installation or network resolution
was added. P39, P61, later phases, payments, UI, and main were untouched.

## Bun v1 binary decoder

`runtime/bunBinaryLock.ts` is an internal data-only decoder for the pinned Bun
v1.1.42 format-2 serializer. It validates the fixed header and version, bounded
file and record counts, checked integer arithmetic, table alignment, typed-buffer
ranges, non-overlap, UTF-8 strings, dependency/resolution slices, target
identities, registry URLs, SHA-512 integrity, and parent-scoped descriptors.
Unsupported resolution forms and optional workspace/trust/override/patch extension
sections refuse instead of being guessed. The parser does not invoke Bun or read
project configuration or environment.

The exact retained Todo `bun.lockb` is 262,443 bytes with SHA-256
`4a6802815bb395350e14d4bd5d2162157bc2a21de755ca72c82a09dc8808c143`.
It decodes successfully and its package names, exact versions, npm integrity, and
dependency edges enter the same trusted normalization boundary as other locks.
The original binary bytes remain unchanged through source storage and export.

## Exact application graphs

### Redux

Frozen application: `reduxjs/redux-essentials-example-app` at
`b4414e1504c914ece3253dd8a21adfb2278464d9`.

The `react18-vite5-redux-msw-v1` operator profile provides the exact reachable
browser/build graph with npm SRI, frozen dependency edges, and peer validation.
Static source reachability includes `@reduxjs/toolkit`, `@mswjs/data`, MSW,
faker, date-fns, mock-socket, React, React DOM, and React Router. Declared packages
that are not reachable from the admitted browser/build path, including
`react-redux`, are not provisioned merely because they are present in the root
manifest. The exact unchanged application admits and builds.

### Bulletproof

Frozen application: `alan2207/bulletproof-react` at
`9506629ed003a561c6627735480cce4994244bb4e`.

The deterministic application root is `apps/react-vite`. Generic nested-root
selection remains confined to imported archive paths, prefers a supported archive
root, accepts exactly one supported nested root, and rejects ambiguity. Compilation
uses the selected application root while export preserves the entire archive and
canonical paths unchanged.

The `react18-vite5-tailwind3-query-radix-v1` profile provides the exact reachable
browser graph plus the finite trusted Tailwind 3/PostCSS build closure. Storybook,
Playwright, test, lint, and server packages are excluded because static source and
configuration analysis does not reach them. The exact unchanged application
admits, builds, and exports from `apps/react-vite`.

### Todo

Frozen application: `tuanductran/todo-list-react` at
`f48aef130c31452341450adfb6c3fc2234b79389`.

The binary lock decodes and matches the manifest. Static configuration parsing
accepts only the exact zero-argument `presetForms()` grammar and requires a
lock-attested `@julr/unocss-preset-forms@1.0.0` marker with its exact npm SRI.
The package is configuration metadata only; neither the uploaded package nor an
operator copy is executed.

Inspection of the exact 1.0.0 source established that zero-argument
`presetForms()` contributes one fixed rules table and one fixed preflight, with no
variants, shortcuts, theme extension, layer, or other behavior. The
operator-owned finite adapter reproduces those rules and preflight inside the
pinned UnoCSS 66.0.0 compiler. The executable profile imports only exact
operator-owned Uno core, preset, transformer, and `magic-string` packages.
Normal dependency and peer validation remains strict for every executed package;
the incompatible third-party peer declaration is never accepted as executable
authority.

The exact unchanged Todo application admits, compiles CSS, completes browser and
independent export builds, and preserves the full source tree and exported source
bytes. Its `package.json`, `bun.lockb`, and Uno configuration remain byte-exact.
The preinstall command `npx only-allow bun` is present but never run.

## Targeted validation

The final directly affected set passes **67/67 tests in 4 files**, with zero
failures. It covers exact/malformed Bun decoding; the fixed forms adapter's
representative input, textarea, select, checkbox, radio, and file-input semantics;
zero-argument enforcement; exact marker substitution/refusal; strict executable
peer regression; retained Uno65/Uno66 CSS behavior; and exact Todo admission,
CSS/browser/export compilation, source/export preservation, and inert preinstall.
TypeScript passes with `tsc -b`.

The previously established 76 P05 passes were not rerun broadly. The full 646+
regression remains deferred to final Phase-2 closure. No prior test identity was
removed or modified.

## Changed-path security review

Reviewed the changed `unoFormsV1Adapter.ts`, `cssWorkerSource.ts`, `staticCss.ts`,
`runtimeCompatibility.ts`, `alternateLockfiles.ts`, `bunBinaryLock.ts`,
`isolatedPreview.ts`, the exact profile, and direct tests. The review covered
uploaded config/package execution, host fallback, operator dependency escape,
peer-validation bypass, arbitrary preset/options execution, profile confusion,
identity/integrity substitution, optional-edge handling, and source/export
mutation.

The worker resolves every executable module beneath the selected locked profile.
It contains no import of the forms package or Uno umbrella package. Static grammar
and exact lock markers bind the finite adapter; arbitrary arguments and identities
refuse. Explicit unresolved optional Bun edges are bounded metadata and required
peers still refuse. Uploaded tooling remains inert archive data. Confirmed
unresolved vulnerabilities in the changed surfaces: **0**.

## Remaining P05 blockers

**NONE.** P05 passes at the retained finite software requirement. The full 646+
regression remains deferred to final Phase-2 closure; P39 and P61 remain unchanged.
