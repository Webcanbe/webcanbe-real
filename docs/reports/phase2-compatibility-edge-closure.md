# Phase 2 compatibility edge closure — 2026-09-15

**P05 PARTIAL · P06 PARTIAL · P08 PASS · P07 regression PASS. Internal software closure: NOT YET.**

This narrow continuation starts at `982625986289baf8101a7d73c96fe47ce0602f0d`.
Origin was fetched; clean feature worktree, expected feature HEAD, implementation ancestor
`bc19fac8d91d7360c409285e8613509c3c4e7404`, and live main
`dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b` were verified before editing.
There is no local main branch. Frozen candidate: `fb861acbb8e490ae65e71821e70ef3bce5765e95`.
Final product implementation: `775f9b67ed3aa9e0465fed446029ee5502192b2a`.
Documentation/evidence follows separately; publication receipt records the final pushed SHA.

Only P05/P06/P08 ledger rows change. P07/P39/P61 and every other row are retained exactly.
Current counts: **47 PASS / 4 PARTIAL / 1 deferred later-phase FAIL / 12 EXTERNAL-EVIDENCE**.
Historical reports remain intact. No matrix reconstruction, upstream project rewrite,
main merge, force push, public deployment, final UI, or Phase 3/4/5 work occurred.

## Newly closed requirements

### P05 subset: npm descriptor and alias identity

Yarn classic now distinguishes the requested name from the real npm package name,
including scoped aliases and explicit `npm:` semver descriptors. Alias descriptors
require exact lookup. The graph normalizer checks real identity, exact version/SRI,
dependency edges and required peers against operator metadata at the aliased location.
Runtime profile selection understands exact npm alias pins and refuses mismatched
installed identity. Tests cover alias identity spoofing, missing descriptors/peers and
unproved traversal/protocol forms. A per-record name set avoids repeated list scans.
No manager executes; unsupported lock errors still refuse admission.

### P06 subset: root relationships and classified build effects

A literal project-confined Vite root determines its `index.html`, entry path and default
public directory. Config-relative absolute aliases keep their own base. Root symlinks,
escapes, missing nested HTML, executable field values and shadowed path globals refuse.
This supports non-root layouts whose entry remains in the retained canonical `src` tree.
It does **not** complete separate source trees such as `client/src` (see blockers).

Bulletproof's exact literal `external:['fs/promises']` and
`output.experimentalMinChunkSize:3500` are recognized as **independent production-build
options**. Chunk sizing has no preview effect; a reachable Node import still refuses
browser compilation. A fixed worker applies these options to an immutable, already
resolved/transpiled JS module graph, with actual chunk-merging and external-import
preservation tests. It imports only pinned operator Rollup, never uploaded config/plugins,
and has no filesystem module fallback. The full application export-build pipeline is
not yet connected to this helper; no application export parity claim is made.

Todo's TS `@` mapping has no Vite alias or tsconfig-paths adapter in its frozen Vite config.
Its browser resolution is therefore an upstream incompatibility, correctly refused.
Inventing that missing relationship is not required for P06 closure.

### P08: retained finite CSS requirement PASS

The operator compiler now implements the specified general forms preset, directives,
variant groups, and literal `presetUno({dark:'media'})` / class mode. It handles grouped
JSX and HTML attributes, chained grouped `@apply`, responsive `@screen`, and unchanged
source/export bytes. No uploaded configuration is imported or evaluated.

- Exact new profile: UnoCSS **65.5.0**, forms **1.0.0**, MagicString **0.30.21**;
  13 root pins / 220 locked package records, public npm SRI throughout.
- Existing UnoCSS **66.0.0** graph also receives the finite directives and variant-group adapters.
- The installed forms1 metadata requires Uno `^0.31.0 || ^65.0.0`. Todo declares Uno `^66.0.0`.
  Peer checks are not overridden. This exact application graph incompatibility stays
  in P05/application evidence; it does not invalidate the general implemented CSS semantics.
- CSS workers retain dedicated transitive resolution, no private environment,
  two-worker capacity, 128 MiB old/16 MiB young heaps and an 8-second deadline.
  Inputs/derived sources retain 2 MiB/member, 40 MiB aggregate and 2,000-source bounds.
- Arbitrary functions, custom executable transformers/plugins, dynamic imports,
  forged adapter objects, duplicate adapters and unknown options refuse.
- Source-content fingerprints renew compiler contexts after edits. JSX is instrumented
  before transformation; transformed HTML passes through the complete HTML validator.
  Supported canonical JS/TS extensions and confined helper modules are included.

The native authored fixture independently renders forms and directives with computed
input appearance `none`, directive padding `16px`, and responsive padding `32px` at 1280
versus `8px` at 390. Media dark output and responsive/group interaction have compiler
assertions. The fixture is clearly labelled; it is not a substituted corpus application.
[Native CSS evidence](phase2-compatibility-edge-evidence/uno-native.json).

P08 PASS concerns the retained finite compiler requirement, not universal Uno plugins,
every package version, or forced full-application PASS.

## Exact remaining internal P05/P06/P08 blockers

1. **P05 — Berry:** version8/checksum-cache identity, exact descriptor/locator and virtual-peer
   normalization are not implemented or independently verified. Redux retains `10c0/…`
   cache checksums, not interchangeable npm tarball SRI. No checksum substitution/fallback.
2. **P05 — workspaces/protocols:** confined workspace graph resolution and the remaining
   non-npm protocol cases lack a verified adapter. Only statically supported npm forms close.
3. **P05 — Bun binary:** Todo's 262,443-byte lock remains opaque. No exact-format decoder or
   pinned isolated metadata-only Bun boundary has been proven. No unknown-byte fake parsing,
   install invocation or uploaded Bun execution was introduced. Documentation describes
   binary-lock printing, but that alone does not prove the required isolation and graph contract.
4. **P05 — exact graphs:** the retained Redux/Bulletproof/Todo exact root/version graphs are
   still unprovided. All concrete missing/version/lock issues remain in the application receipt;
   no newest-version or host-node_modules substitution is permitted.
5. **P05 — Redux inert tooling:** `.yarn/releases/yarn-4.2.2.cjs` remains 2,742,928 bytes.
   A general role was threat-modelled, but not implemented: path/extension classification
   alone cannot enforce nonexecution through canonical stores, generic `.cjs` imports,
   semantic tooling and independent export consumers. Those paths currently have no shared
   durable inert-role authority. The 2 MiB member limit remains unchanged; no bytes are dropped.
6. **P06 — separate nested source trees:** root-relative entry layouts outside canonical
   top-level `src`, e.g. `client/src/main.tsx`, need coordinated registry/source-authority mapping.
7. **P06 — complete independent export builds:** compose canonical projects into the immutable
   resolved JS graph and apply the finite Rollup plan in the independent application build gate.
   Direct helper tests do not establish full application build integration.

**P08 remaining internal blockers: NONE for the specified retained finite semantics.**
Unknown executable plugins/configuration remain intentionally unsupported, not silently applied.
These P05/P06 gaps are internal engineering, not production credentials or DoD waivers.

## Frozen retained application stages

[Exact stage receipt](phase2-compatibility-edge-evidence/application-stage-results.json).
All original commits/archive hashes and canonical file hashes were verified; no upstream
source, configuration, dependencies, tooling member or lockfile was changed or omitted.

| App | Intake → lock/dependency → configuration → compilation → runtime → render |
|---|---|
| Redux | **FAIL → FAIL → diagnostic PASS → NOT REACHED → NOT REACHED → NOT REACHED**. Oversized tooling stops intake; separately materialized exact files provide static diagnosis only. |
| Bulletproof React | **PASS → FAIL → FAIL → NOT REACHED → NOT REACHED → NOT REACHED**. Exact Vite grammar/build plan now passes; missing exact package graph, CSS profile and required explicit public values still block the overall configuration stage. |
| todo-list-react | **PASS → FAIL → FAIL → NOT REACHED → NOT REACHED → NOT REACHED**. Binary graph, exact profile, upstream forms/Uno peer conflict, undeclared runtime alias and explicit public values remain. |

Recipe was checked only because shared compiler paths changed. Its unchanged 67-file
archive compiles to a **byte-exact copy of the prior uncached HTML and 36-file artifact**.
The prior actual cached/native P07 render and export evidence is reused, without repeating
network fetching or a full editing workflow. P07 stays PASS.
[Preservation proof](phase2-compatibility-edge-evidence/recipe-preservation.json).

## Final verification and security

**594 distinct passing tests, including every prior 549 identity and 45 new identities.**
Default:549PASS/45SKIP; native gated:69PASS; exact packaged hosted:12PASS.
The union accounts for all45 skipped identities; zero outstanding skips or failures.
[Identity ledger](phase2-compatibility-edge-evidence/regressions.json).

The clock-generated future-iat title has explicit old/new labels; unchanged source identity
was verified. One existing test body replaces its obsolete valid-directive refusal with
an executable-options refusal under the same title. Positive directive semantics and all
review-discovered defects receive added coverage. No test identity is deleted or counted
as a pass merely because it skipped. Old profile manifests and locks remain unchanged.
TypeScript, production build and packaged CLI pass. Unaffected historical browser,
application workflow and export evidence is retained; no new P39/P61 capacity claim.

Codex Security **d5962344-0b45-4600-98c7-972dce940e1a** sealed the immutable
`9826259..fb861ac` review. All 12 changed paths, including the profile lock and supplied
threat model, were accounted for. Parent and independent delegated reviews followed
changed trust paths into their direct consumers. **Confirmed unresolved vulnerabilities: 0.**
[Canonical report](phase2-compatibility-edge-evidence/security/report.md).

Three concrete compatibility defects discovered during review were fixed at 775f9b6:
stale incremental Uno snapshots, discarded transformed HTML, and incomplete module-extension/
helper coverage. A redundant alias-record scan was also removed. Final changed paths were
independently reread at recorded hashes; the seal is not misrepresented as covering a different
commit. [Final reread](phase2-compatibility-edge-evidence/security/final-reread.json).
No broad repeat scan, quantitative DoS measurement or professional penetration-test claim.
Daybreak advisory returned `not_granted`; tool-measured token usage was unavailable and is not estimated.

Failures remain documented: initial incompatible Uno66/forms1 package preparation refused
peer constraints; an attempted nonexistent forms1.0.1 metadata query failed; pinned upstream
source downloads were unavailable; the first TypeScript check found an unsupported Object.hasOwn
library declaration and was corrected without changing the target; the native authored QA
incorrectly called a semantic-only `check` RPC after its style assertions, then passed after
that harness call was removed; initial evidence clock normalization matched the fixed iat1
case too and was narrowed. No failed attempt is presented as successful proof.

## Final state

Internal blockers now: **P05 / P06 / P39 / P61**. P39 and P61 remain exactly as previously
recorded. External production-evidence rows remain
P29/P41/P43/P45/P46/P48/P49/P50/P51/P52/P55/P56. P64 stays deferred Phase3/4/5.

**Phase2 internal software closure: NOT YET. Overall Phase2: NOT YET.
Phase3 may begin under original DoD: NO.**
Only a normal feature-branch push is authorized. Owned TEST jobs/services/tunnels/schema/
password/PKI are cleaned and the VM stopped; exact cleanup/publication receipts accompany
the final evidence. Main is unchanged.
