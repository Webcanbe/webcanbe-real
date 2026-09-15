# P05 targeted closure — 2026-09-15

**P05 PARTIAL. Internal blockers: P05 / P39 / P61. Phase 2 internal closure: NO.**

## Scope and verification

Verified the clean `phase-2-compatible-editor` checkout at
`9a5c7579ec831d047df19cf5efbba676a6853279` in
`/Users/olivertaylor/Developer/WebCanBe-recovery`. Fetched origin and verified the
feature tip, main `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`, and ancestry.
There is no local main branch. No main push, merge, deployment, installation,
project script execution, P39/P61 work, or later-phase work occurred.

Selectively restored these eight files from parallel snapshot
`862575adbc617465db1d74d5ec343c8f691edc97`, then reviewed and corrected them:

- `src/webcanbe-engine/runtime/alternateLockfiles.ts`
- `src/webcanbe-engine/runtime/intakeMetadata.ts`
- `src/webcanbe-engine/runtime/projectRegistry.ts`
- `src/webcanbe-engine/runtime/projectExport.ts`
- `src/webcanbe-engine/runtime/isolatedPreview.ts`
- `src/webcanbe-engine/phase2-p05-berry.test.ts`
- `src/webcanbe-engine/phase2-p05-inert-tooling.test.ts`
- `src/webcanbe-engine/phase2-p05-redux-real.test.ts`

This includes the inert-tool product work from
`6f7cff2e7e85ce9c3b6ebd3a812c790d2360d3cb`. Relevant earlier product/test commits:
`487b5ea`, `8aa7b35`, `2dd58e4`, `b59ccf5`, `b8163ef`, `73a0767`, `d099fe5`,
`265941d`. No parallel workflow or unrelated history was merged.

Additional changes: three P05-only test files (`phase2-p05-trust.test.ts`,
`phase2-p05-boundaries.test.ts`, `phase2-p05-frozen-admission.test.ts`) and two
reporting strings in the direct consumer `runtime/runtimeCompatibility.ts`.
The latter now states checksum provenance accurately and no longer labels all
Berry input unsupported.

## Berry trust and finite forms

The bounded parser accepts lock version 8, exact npm descriptors/locators and
aliases, finite hexadecimal virtual identities (including Yarn's 128-digit
hashes), one `workspace:.` root, finite builtin compatibility patch metadata,
conditions, dependency/peer metadata and inert bin paths. It executes no YAML,
Yarn, PnP loader, uploaded plugin, script or package-manager configuration.

Descriptor and locator package names, exact version and virtual identity must
agree. Repeated locators cannot disagree about graph/checksum data; different
virtual locators cannot overwrite one trusted package location. Peer constraints
are checked against graph-selected providers, without inventing peer descriptors.
An optional dependency cannot erase an overlapping required peer obligation.

Berry checksums are **unverified cache metadata**, constrained to the exact cache
key and a 128-digit lowercase hexadecimal label. They do not authenticate npm
package bytes. Changing a syntactically valid untrusted digest changes only that
label. If an operator provides a Berry locator/checksum attestation, mismatches
refuse. Required names, versions, dependency/peer edges and SRI come from the
operator-owned profile. Admission performs no network resolution, installation
or host-node_modules fallback. Existing operator provisioning remains responsible
for verified package bytes; this task does not independently rehash installed
packages or claim to verify absent Yarn cache ZIPs.

[Yarn 4.2.2 Cache.ts](https://github.com/yarnpkg/berry/blob/%40yarnpkg/cli/4.2.2/packages/yarnpkg-core/sources/Cache.ts)
computes the checksum from its cache archive. Its cache key and archive bytes
cannot be replaced with npm tarball SRI. The pinned source was inspected as data.

Builtin patches parse, but normalization refuses unpatched-package substitution:
execution requires an explicit operator-owned patched locator and trusted byte
integrity. No uploaded patch is applied. Arbitrary file/link/portal/git/patch and
non-root workspace dependencies still refuse. Root-only support does not claim
universal workspace or patch support.

Conditional records may omit a checksum while inert. Only optional dependencies
absent from the trusted graph or excluded by its OS/CPU metadata are omitted;
required edges and required peers cannot silently disappear. Libc conditions are
preserved as data, not evaluated as permission to execute a package.

## Frozen Redux and oversized inert Yarn

Frozen application: `reduxjs/redux-essentials-example-app` commit
`b4414e1504c914ece3253dd8a21adfb2278464d9`.
The exact Yarn 4.2.2 lock parses; all declared root locators resolve. Full ZIP
intake and export preserve every original file byte, including the bundled Yarn
release. No upstream file, source or configuration was edited or removed.

- Lock: 96,291 bytes; SHA-256 `1d757201762d9525bed90f1ce55fed9f38ee99af895876674020d3cf87823abd`.
- Yarn release: 2,742,928 bytes; SHA-256 `1aa43a5304405be7a7cb9cb5de7b97de9c4e8ddd3273e4dad00d6ae3eb39f0ef`.
- Needed executable graph: **FAIL / unprovided**. Current profile lacks required
  Redux packages, including `@reduxjs/toolkit` and `react-redux`; normalization and
  runtime admission correctly refuse. Parsing is not application acceptance.

Only exact `.yarn/releases/yarn-X.Y.Z.cjs` paths receive the 4 MiB inert member
limit. Ordinary files retain 2 MiB; uploads retain 25 MiB, total inflated bytes
40 MiB, 2,000 entries and 100:1 compression ratio. CRC/size/path/symlink checks
remain. Generic `.yarn` tooling and PnP loaders, including small uploaded plugins,
are refused in Blob/HTTP preview and independent export compilation. Static Vite
plugin loading and source symlinks cannot bypass the boundary. ZIP export stores
bytes only; WebCanBe does not run the exported project's package manager.

## Bun binary and exact remaining requirements

The retained ledger explicitly requires the Todo binary lock: 262,443 bytes,
SHA-256 `4a6802815bb395350e14d4bd5d2162157bc2a21de755ca72c82a09dc8808c143`, from
`tuanductran/todo-list-react` commit `f48aef130c31452341450adfb6c3fc2234b79389`.
Its opaque-byte round trip and runtime refusal pass. Binary graph support **FAILS**.

The [Bun binary serializer](https://github.com/oven-sh/bun/blob/bun-v1.2.0/src/install/lockfile.zig)
uses versioned package structures, typed buffer offsets, alignment and additional
workspace/override/patch sections. A header check is insufficient to establish
those graph semantics. No exact decoder or isolated trusted inspector was proven
within this bounded task; implementation stopped without executing Bun.

Remaining P05 blockers:

1. Verified Bun binary decoder or trusted isolated metadata-only boundary.
2. Exact retained Redux/Bulletproof/Todo operator-owned version, integrity and
   package graphs, including any required graph-specific adapters. Redux was
   freshly checked; Bulletproof/Todo graph gaps remain as retained in the ledger,
   without rerunning the common-app corpus or waiving their requirements.

Bun cannot honestly be reported as the sole blocker. P05 remains PARTIAL.

## Targeted validation and changed-path security review

**76 distinct targeted passes, 0 failures, 0 P05 skips.** TypeScript compile passed
(`tsc --noEmit --pretty false`). The 35 unrelated tests in the alias test file were
excluded by name filter. The full 646+ regression is deferred to final Phase-2
closure. All 40 existing test files remain byte-identical to the starting feature
HEAD; all prior test identities are retained. Three test files imported from the
parallel branch preserve their test names while strengthening fixtures/assertions.

Tests cover Berry identity/checksum/alias/peer mismatch, conditional omissions,
patch trust, unsupported protocols, the real frozen inputs, byte-exact round trips,
ordinary/inert/archive/aggregate/entry limits, compression bombs, traversal,
symlinks, plugin/PnP imports, preview/export refusal and existing alternate-lock
and npm-alias admission behavior. See [targeted receipt](phase2-p05-evidence/targeted-tests.json).

One intermediate imported test failed before reaching its assertion because
macOS's temporary path was noncanonical. The fixture now uses `realpath`; its
execution-refusal assertion passes. No production path-confinement check was weakened.

Manual security review covered the five changed production files listed above
and the direct `runtimeCompatibility.ts` consumer. Corrected descriptor/locator
confusion, virtual location overwrite, patch byte substitution, optional/required
peer overlap and tooling import gaps. Cache identities are case-sensitive.
No new network/process/package-install path exists. Confirmed unresolved
vulnerabilities in changed paths: **0**. This is a scoped manual review, not a
claim of exhaustive security or application acceptance.
