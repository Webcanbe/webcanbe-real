# P05 assistant Bun binary decoder checkpoint — 2026-09-15

This is **parallel evidence only** on `phase2-p05-assistant-followup`; it does not change P05 status and must not be merged wholesale.

## Exact retained input

- Repository: `tuanductran/todo-list-react`
- Commit: `f48aef130c31452341450adfb6c3fc2234b79389`
- `packageManager`: `bun@1.1.42`
- `bun.lockb`: 262443 bytes
- SHA-256: `4a6802815bb395350e14d4bd5d2162157bc2a21de755ca72c82a09dc8808c143`

## Implementation

`src/webcanbe-engine/runtime/bunBinaryLock.ts` is a bounded internal data decoder for the retained Bun format-v0 / serializer version 2 boundary. It was derived against pinned official Bun 1.1.42 source (`oven-sh/bun` tag commit `50eec0025b482ad7b340c82f64749903b2fad4b8`, `src/install/lockfile.zig`) and cross-checked against the independent MIT `hyrious/bun.lockb` parser only as a secondary reference.

The decoder does **not** execute Bun, package scripts, bunfig, plugins, network resolution, package installation, or host `node_modules`. It bounds input/package counts, validates header/version/ranges/string-pool references/UTF-8/dependency buffer layout, accepts only npm package resolutions at this boundary, extracts exact semver + registry URL + SRI metadata, refuses workspace behavior, and preserves Bun's `invalid_package_id` sentinel as unresolved data rather than inventing a package target.

The official serializer's buffers are interleaved as descriptor `[start,end]` followed by that buffer; the first draft incorrectly treated them as a single descriptor table. The exact retained lock exposed and corrected that error. The exact lock also exposed `0xffffffff` unresolved resolution sentinels; these are represented as `targetId: null` and are never treated as resolved package authority.

`src/webcanbe-engine/runtime/bunBinaryAlternate.ts` adapts that decoded graph to the existing finite lock interface without running a package manager. It resolves only exact descriptors that the binary graph maps to one unique package identity. If the same descriptor maps to multiple package ids, the adapter refuses instead of guessing Bun hoisting. Root dependency/dev/optional/peer groups are preserved; transitive normal/optional/peer edges are retained; unsupported behavior fails closed.

The adapter also validates the **retained serializer tail boundary** before admitting metadata. After the six official core interleaved buffers it requires the core zero terminator and requires that terminator to end the declared serialized payload. Optional Bun workspace/trusted-dependency/override/patch tail sections are therefore refused instead of being silently ignored. This is deliberately an exact finite Todo boundary, not a claim of universal Bun binary-lock support.

## Verification

Three branch-only GitHub Actions checkpoints completed successfully.

- Initial exact decoder checkpoint: run `34976264726`, job `104404634351`.
- Decoder + finite-lock adapter checkpoint: run `34977998722`, job `104410603896`.
- Final serializer-tail hardening checkpoint: run `34978658841`, job `104412774132`.

The final run passed every step:

1. checkout of the safe branch;
2. repository pinned dependency install with lifecycle scripts disabled (`npm ci --ignore-scripts --no-audit --no-fund`);
3. exact retained Todo `bun.lockb` and `package.json` download from the pinned upstream commit;
4. exact `bun.lockb` SHA-256 verification;
5. `tsc --noEmit --pretty false`;
6. targeted `phase2-p05-bun-binary-decoder.test.ts`;
7. targeted `phase2-p05-bun-binary-real.test.ts`;
8. targeted `phase2-p05-bun-binary-alternate.test.ts`.

The exact retained binary tests additionally check that decoded root dependency/dev-dependency maps equal the frozen upstream `package.json`, each direct descriptor resolves to a semver-compatible exact package record, registry resolution is HTTPS npm/Yarn registry data, SRI is present, and every non-null dependency target points to an existing decoded package record.

Each temporary CI workflow was deleted after verification and is not part of the branch tip.

## What this does and does not close

This removes the earlier uncertainty that the retained 262443-byte Bun binary lock could not be decoded safely without invoking uploaded project code, and demonstrates a bounded path into WebCanBe's finite lock abstraction. It is **not yet P05 PASS**. The active feature branch still needs an independently reviewed integration of this metadata into runtime admission/trusted profiles, and the retained Redux/Bulletproof/Todo executable graphs still need their operator-owned exact version/integrity/dependency/peer closure.

The current decoder is intentionally limited to the retained npm-resolution/core-tail boundary. Additional Bun resolution/workspace/tail forms require explicit bounded semantics or refusal. Do not broaden the claim from this checkpoint.

If reused, selectively port/review only:

- `src/webcanbe-engine/runtime/bunBinaryLock.ts`
- `src/webcanbe-engine/runtime/bunBinaryAlternate.ts`
- `src/webcanbe-engine/phase2-p05-bun-binary-decoder.test.ts`
- `src/webcanbe-engine/phase2-p05-bun-binary-real.test.ts`
- `src/webcanbe-engine/phase2-p05-bun-binary-alternate.test.ts`

Do not merge this branch wholesale. Full Phase-2 regression remains deferred to the final closure run.
