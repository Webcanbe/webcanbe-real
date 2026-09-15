# P05 final narrow follow-up — 2026-09-16

**P05 PARTIAL. Internal blockers: P05 / P39 / P61. Phase 2 internal closure: NO.**

## Scope

Continued the clean `phase-2-compatible-editor` checkout from
`6e55240cfe498808129f5237eb7bda298bc18071`. Main remains
`dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. This follow-up changed only the two
retained P05 areas: verified Bun binary-lock decoding and exact trusted graphs for
the frozen Redux, Bulletproof, and Todo applications. Prior Berry, inert tooling,
archive, export, source, security, and 76-test evidence was reused.

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

The binary lock decodes and matches the manifest. Strict graph admission then
finds one exact upstream incompatibility: `@julr/unocss-preset-forms@1.0.0`
declares peer `unocss: ^0.31.0 || ^65.0.0`, while the frozen lock resolves
`unocss@66.0.0`. Trusted metadata and npm SRI confirm both identities. The peer
range does not admit 66.0.0, so Todo remains refused. The preinstall command
`npx only-allow bun` is never run. No legacy-peer or relaxed admission path was
introduced.

## Targeted validation

The newly and directly affected set passes **49/49 tests in 7 files**, with zero
failures. It covers Bun exact/malformed decoding, the exact Todo lock, exact Redux
admission/build, exact Bulletproof root/admission/build/export, nested-root
ambiguity, P05 boundaries, inert tooling, alternate-lock behavior, and directly
affected CSS/runtime compatibility. TypeScript passes with `tsc --noEmit`.

The previously established 76 P05 passes were not rerun broadly. The full 646+
regression remains deferred to final Phase-2 closure. No prior test identity was
removed or modified.

## Changed-path security review

Reviewed `bunBinaryLock.ts`, `alternateLockfiles.ts`, `runtimeCompatibility.ts`,
`projectRegistry.ts`, `projectExport.ts`, `intakeMetadata.ts`, `isolatedPreview.ts`,
`staticCss.ts`, and their new direct tests/profiles. The review covered malformed
binary offsets and lengths, overflow, resource exhaustion, protocol acceptance,
path/workspace escape, dependency and integrity substitution, peer mismatch,
package-manager/config/plugin execution, host fallback, nested-root ambiguity, and
source/export mutation.

All binary tables and strings are bounded before access. Lock resolution is limited
to the statically required closure and cannot expose inert unrelated records.
Nested roots and resolved profile modules must remain beneath their respective
confined roots. Uploaded tooling remains inert archive data. Confirmed unresolved
vulnerabilities in the changed surfaces: **0**.

## Remaining P05 blocker

Exact Todo graph peer mismatch only:
`@julr/unocss-preset-forms@1.0.0` requires
`unocss ^0.31.0 || ^65.0.0`, but the frozen lock selects `unocss@66.0.0`.
P05 therefore remains PARTIAL under strict admission.
