# Security Review: WebCanBe-recovery

## Scope

Every one of the 12 changed candidate paths, including package lock and threat model; supporting boundary callers reviewed.

- Scan mode: branch_diff
- Target kind: git_diff
- Target ID: target_sha256_42cde00d65c36327af49fc5a5303d4c9c61fe0885f27c22a108e77905fb8cf01
- Revision range: 982625986289baf8101a7d73c96fe47ce0602f0d...fb861acbb8e490ae65e71821e70ef3bce5765e95
- Snapshot digest: codex-security-snapshot/v1:sha256:35ae7236ce0ae0797099db2cadaf9fde290431deea537f568a2358146727aeea
- Inventory strategy: diff
- Included paths: .
- Excluded paths: none
- Runtime or test status: not recorded

Limitations and exclusions:
- Not a professional penetration test.
- Immutable candidate 9826259..fb861ac; final 775f9b6 compatibility corrections independently reread and identified separately.
- Excluded Unchanged repository paths beyond direct dependencies: Narrow diff; no P39/P61, later-phase or production security claim.

### Scan Summary

| Field | Value |
| --- | --- |
| Scan outcome | completed |
| Reportable findings | 0 |
| Severity mix | none |
| Confidence mix | none |
| Coverage | complete |
| Validation mode | Static security review; retained and targeted regression evidence, no quantitative DoS claim. |

Canonical artifacts: `scan-manifest.json`, `findings.json`, and `coverage.json`. This report is a deterministic projection of those files.

## Threat Model

Text: # Compatibility edge threat model (before implementation) Scope: P05/P06/P08 only. Baseline 982625986289baf8101a7d73c96fe47ce0602f0d; ancestor bc19fac8d91d7360c409285e8613509c3c4e7404. Fetched feature and live main verified, clean initial tree; no local main. - Lock data cannot authorize execution by merely parsing. Descriptor spelling, real package identity, locator version, integrity and complete dependency/peer edges must independently match an operator graph. Exact descriptor lookup must not resolve an ambiguous range by convenience. Alias/workspace traversal, duplicate keys, integrity downgrade and virtual peer collisions refuse. No parse-error fallback. - Berry cache checksums are not npm tarball SRI. Support requires independently verified cache/locator mappings and virtual peer identities; copying a checksum into an integrity field is forbidden. - Bun binary input must use a verified versioned decoder or an isolated, pinned metadata-only executable. Magic-byte preservation is insufficient. No install/manager execution in editor, no project config/scripts/network or host resolution. - Inert oversized tools need a role enforced in every source store, snapshot, loader, semantic tool, config reader, preview transport and export consumer. A path classifier alone is insufficient: canonical .cjs bytes are currently ordinary importable source and export tooling can execute them. Keep the 2 MiB bound unless end-to-end nonexecution can be proved. - Vite root/alias paths are data, confined to canonical project with symlink refusal. Root, index, module source, public assets and config-relative aliases have distinct bases. Unsupported source layouts remain explicit, never guessed. Build settings must distinguish preview from independent production export build. No arbitrary externalization/stubbing of Node modules. - Uno presets/transformers are only named operator constructors with literal validated options. Never import uploaded configuration. Worker receives immutable data, remains pinned, dedicated-resolution, empty private environment, two-worker capacity, 128 MiB old/16 MiB young heap, 8 s deadline. Count and byte limits bound input/output. Transform source in derived compiler artifacts only; preserve canonical/export bytes and instrumentation offsets. Reject dynamic config/functions/custom transformers, unknown options and forged adapter objects. - Review changed trust paths after freeze and add focused adverse cases. Preserve all 549 prior identities, account gated skips separately. P07 and P39/P61 authority unchanged.

## Findings

### No findings

No reportable findings survived the canonical discovery, validation, and reportability gates.

## Reviewed Surfaces

| Surface | Risk Area | Outcome | Notes |
| --- | --- | --- | --- |
| alternateLockfiles.ts | not recorded | No issue found | Reviewed exact descriptor versus package identity, trusted version/SRI and full dependency/peer normalization, alias/path confusion, fail-closed unsupported Berry/workspace/binary formats. Record-name Set prevents redundant list scans in final reread. |
| staticCss.ts, cssWorkerSource.ts, isolatedPreview.ts | not recorded | No issue found | Independent complete source/diff review of AST token provenance, finite options, pinned worker resolution, nonexecution, bounds and original-source instrumentation. Three nonsecurity compatibility defects corrected at 775f9b6; independent final-path reread found no residual defect. |
| runtimeCompatibility.ts, htmlConfiguration.ts, finiteBuild.ts | not recorded | No issue found | Independent complete review of admission callers, Vite/static path confinement and HTML active content rejection, fixed immutable Rollup graph worker, external fs/promises never admitted to preview. Final transformed HTML caller reread. |
| Uno65/forms1 profile manifest and package-lock.json | not recorded | No issue found | Reviewed 13 exact root pins, 220 lock records; no links/nonregistry sources/invalid SRI. npm ci --ignore-scripts and npm ls --all passed; forms1 declared Uno65 peers complete. Old profiles unchanged. |
| phase2-breadth-css.test.ts, phase2-compatibility-edge.test.ts, threat-model.md | not recorded | No issue found | All changed tests and supplied model reviewed. Old test identity retained; valid directives refusal replaced by executable-options refusal, positive semantics and reviewed corrections explicitly asserted. No private material or production operations. |
