# Security Review: WebCanBe-recovery

## Scope

Frozen compatibility breadth diff 0f33e11..aedbc024: all32 changed paths reviewed. Final remediated code bc19fac additionally reviewed on affected paths without changing the immutable scan target.

- Scan mode: branch_diff
- Target kind: git_diff
- Target ID: target_sha256_42cde00d65c36327af49fc5a5303d4c9c61fe0885f27c22a108e77905fb8cf01
- Revision range: 0f33e11ea60ee4b69ed6a0de5144f73400fe5808...aedbc02414f66d6b2ce83c288dc6c2e246b4ea79
- Snapshot digest: codex-security-snapshot/v1:sha256:27690ce0fb4e23aa443efbb6af3d5a276b9b3adc0c54c862d642c46cf7d1ee66
- Inventory strategy: diff
- Included paths: .
- Excluded paths: none
- Runtime or test status: 504 default passes plus45 separately passing native/hosted identities =549 distinct tests. Five browser groups pass. Exact PG Recipe artifact renders with38 cached resources and ENETUNREACH direct public egress. Final code type/build pass.
- Artifacts reviewed: /tmp/wcb-breadth-security-admission.json, /tmp/wcb-breadth-security-assets.json, /tmp/wcb-breadth-security-css.json, /tmp/wcb-breadth-security-admission-final.json, /tmp/wcb-breadth-security-css-final.json, /tmp/wcb-breadth-security-assets-final.json, docs/reports/phase2-compatibility-breadth-evidence/threat-model.md, .webcanbe/compatibility-breadth/assets-refresh-final.json, .webcanbe/compatibility-breadth/default-security-final.json, .webcanbe/compatibility-breadth/recipe-native.json
- Scan context: Supplied pre-implementation scoped threat model retained verbatim. No P39/P61/later-product audit or professional pentest. Final three security-relevant code paths and focused regressions reread against frozen candidate; QA optional artifact argument reviewed by parent.

Limitations and exclusions:
- No production deployment, external pentest or quantitative denial-of-service stress measurement.
- A cybersecurity safeguard blocked attempted bounded stress validation; not retried. Static source/control/sink assessment and ordinary functional regression establish the bug and correction.
- Immutable scan target aedbc024 includes one low finding. Final remediation commit bc19fac8d91d7360c409285e8613509c3c4e7404 has separate affected-path review; the seal is not represented as a different immutable Git target.
- Excluded Unchanged P39/P61 and Phase3/4/5 paths: Unchanged P39/P61 implementation and Phase3/4/5 scope; unrelated repository paths.
- Excluded External production environments: Production evidence and professional penetration testing.

### Scan Summary

| Field | Value |
| --- | --- |
| Scan outcome | completed |
| Reportable findings | 1 |
| Severity mix | low: 1 |
| Confidence mix | high: 1 |
| Coverage | partial |
| Validation mode | Static complete source/control/sink analysis and ordinary regression verification; actual local PG/mTLS/native integration. |

Canonical artifacts: `scan-manifest.json`, `findings.json`, and `coverage.json`. This report is a deterministic projection of those files.

## Threat Model

Text: # P05–P08 pre-implementation threat model Scope: only compatibility admission, pinned graphs, static HTML/config/CSS interpretation, explicit public runtime values and trusted static resource acquisition. Baseline 0f33e11ea60ee4b69ed6a0de5144f73400fe5808. The authoritative final ledger is reused. P39/P61 and later product scope are excluded. ## Overview and existing boundaries Uploaded ZIPs cross strict path/type/CRC/encoding/member/total/ratio checks before private materialization (projectRegistry.ts:43–113). Runtime inspection selects only repository-owned profiles, checks uploaded package/lock records and confines installed dependencies (runtimeCompatibility.ts:169–249). Source/config is parsed as data; source JavaScript executes only in native isolated Linux. The compiler confines filesystem reads, keeps source canonical and returns ephemeral artifacts (isolatedPreview.ts:54–164). Hosted preview obtains source from PG, then checks current authorization/revision before returning or starting a runner (controlledPreview.ts:156–192,236–264). The worker serves only digest-bound local artifacts (scripts/runner/worker.cjs:63–76); the OS launch uses an isolated network namespace. The current GitHub ZIP provider is a separate fixed-host intake API, not a general resource downloader. ## Actors, assets and assumptions An authenticated malicious project author controls every imported file, manifest, config literal, source URL and compiled browser request. They do not control operator profiles, trusted service composition, PG grants or the host. Protect other tenants, canonical accepted bytes/history, operator packages, host network/filesystem/credentials, compiler resources, artifact identity and current-generation authority. Public resource servers and DNS answers are untrusted. TEST fixtures/providers do not grant production access. Existing limits remain unchanged; no bundled Yarn executable is run or granted an enlarged member budget. ## Planned boundaries and adversarial acceptance | Boundary | Threat hypothesis | Required controls and proof | |---|---|---| | Lock data → pinned graph | Ambiguous descriptors, alternate protocols, forged integrity or omitted required peers substitute executable dependencies. | Finite versioned grammar; strict sizes/duplicate rejection; exact registry versions/SRI against operator lock; complete dependency/peer traversal; explicit optional peers; no lifecycle/manager execution; no host fallback. Yarn Berry cache checksums are not npm tarball SRI. Unproven Berry/binary Bun forms remain refused. | | Config/HTML → compiler options | Calls/getters/spread/prototypes/URLs turn static interpretation into execution or escape paths; custom HTML adds uncontrolled script entry. | AST-only finite literal semantics, bounded recursion and collections, exact imported known binding identity, confined real paths. One intended local module entry; reject inline/extra/remote scripts, active embedding/event handlers and unknown executable config. Preserve canonical bytes; generated preview HTML is noncanonical. | | CSS config → trusted compiler | Uploaded plugins, content globs/config loading or dynamic functions read host paths/run code/network. | Operator-pinned compiler only; serialize finite validated config data, supply bounded source content explicitly, disable config-file discovery; known finite transforms only. Unknown effects refuse with distinct labels. No uploaded plugin import/eval. | | Runtime public-value policy → artifact | Private/example secrets become browser values, grants cross projects or change mid-compile. | Server-owned explicit project policy, public VITE names and bounded secret-screened values; never auto-read example values; fresh owner/revision checks before and after async work. Values are intentionally public and artifact-bound; accepted source/export unchanged. No confidential server secrets. | | Source static URL → trusted fetch/cache | SSRF, DNS rebinding, redirect pivot, metadata access, cookie leakage, bombs or active content reach the trusted host/another tenant. | HTTPS only, fixed GET and headers/no cookie/auth/proxy, no URL credentials, public address validation and pinned TLS hostname lookup for every hop, reject reserved/private/loopback/link-local/metadata and IPv6 unless validated, bounded redirects/deadline/concurrency/body/aggregate/cache, reject nonidentity encoding, validate MIME and magic. CSS resources parsed without execution; scripts/HTML/SVG active content refused. Tests cover redirects, loop, timeout, oversize, invalid MIME, all denied networks and authorization loss. | | Cached bytes → isolated artifacts | Cache poisoning, stale source fetch authority, unbounded growth or direct runner egress bypass source identity. | Content hashes and source-derived URL references; explicit project authorization before cache access/fetch and after completion; generation/revision checks; bounded immutable artifacts using existing PG artifact store. Rewriting only ephemeral preview output, never canonical source/export. Runner egress remains denied; no new runner-network permission. | These are pre-implementation hypotheses and acceptance conditions, not confirmed vulnerabilities. Complete final Codex Security review is required after freeze. The independent scoped architecture review will be retained and reconciled before finalizing this model. Critical/high findings require cross-tenant execution, credential disclosure or host/network authority gain; malformed self-only refusal is not such a finding. Resource exhaustion or stale-grant work is material when it crosses existing bounded admission/authority controls. Independent baseline architecture review completed: 12 effective-resource rows and 98 anchors verified against 0f33e11, retained in baseline-architecture.json. Parent confirmed the compiler/profile, fresh PG and runner artifact/no-egress facts at their consumers. New behavior will be reviewed against the final changed revision, not this baseline model.

## Findings

| Finding | Severity | Confidence | Detailed write-up |
| --- | --- | --- | --- |
| [Repeated resource literals trigger quadratic work in the shared editor](#finding-1) | low | high | inline below |

### Confidence Scale

| Label | Meaning |
| --- | --- |
| high | Direct evidence supports the finding with no material unresolved blocker. |
| medium | Evidence supports a plausible issue, but material runtime or reachability proof remains. |
| low | Evidence is incomplete and the item is retained only for explicit follow-up. |

<a id="finding-1"></a>

### [1] Repeated resource literals trigger quadratic work in the shared editor

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Exact new shared-editor input/control/sink chain. Static reasoning establishes repeated whole-string copying; focused functional regression verifies the replacement. No quantitative stress result claimed. |
| Category | Algorithmic resource exhaustion |
| CWE | CWE-400, CWE-407 |
| Affected lines | src/webcanbe-engine/runtime/staticAssets.ts:134-139, src/webcanbe-engine/runtime/controlledPreview.ts:158-167 |

#### Summary

Frozen implementation aedbc024 copies the complete JavaScript artifact for each repeated static-resource literal. The network URL limit counts distinct downloads and does not limit these synchronous copies. An authorized project author can therefore increase shared-editor work disproportionately. The final working tree replaces the loop with one linear chunks/join construction; the original finding is retained here for the immutable reviewed candidate.

#### Root Cause

Every literal edit rebuilds the full immutable string, despite URL fetch deduplication.

#### Validation

Validation outcomes are recorded below.

Validation method: Static source/control/sink assessment plus ordinary 128-literal functional regression after remediation. Attempted bounded stress reproduction was blocked by a cybersecurity safeguard and was not retried.

- **Disposition:** reportable

Evidence:
- Source-order AST visit at lines134–136 collects disjoint literal edits including repeated URL values. Set deduplication affects network calls only.
- Frozen line138 iterates every edit and slices the whole evolving string, producing O(number of literals × artifact length) copying.
- ControlledPreview.start path executes materialize in shared hosted editor process after compilation. Per-project authority is checked, but accepted source remains untrusted for host resource consumption.
- Final working tree replaces loop with source-order non-overlapping slices followed by one join; ordinary regression asserts one fetch, all replacements, surrounding source exact and original artifact unchanged.

#### Dataflow

Text: 1. Project owner includes repeated ordinary public image string literals in a used client value. 2. Compiler output is parsed by TrustedStaticAssets. 3. URL Set deduplicates downloads, leaving all edit spans. 4. Frozen line138 repeatedly copies the whole bundle synchronously, delaying unrelated shared editor tasks.

#### Reachability

An authenticated project owner imports source and starts its preview through the hosted TLS service. When operator publicStaticAssets is true, ControlledPreview compiles then materializes resource literals in the shared editor process. This is lower-trust source crossing into shared host availability, rather than self-only runner CPU.

#### Severity

**Low** — Medium impact is transient shared-service availability, without confidentiality/integrity compromise established. Medium likelihood reflects opt-in functionality and an authenticated source author. The required matrix maps medium/medium to low (P3).

Linear disjoint slicing/join removes this root cause. Final implementation has that fix with functional regression; final path re-review is pending and will be recorded separately without erasing the frozen-candidate finding.

**Impact assessment:** medium

**Likelihood assessment:** medium

#### Remediation

Corrected in final implementation bc19fac8d91d7360c409285e8613509c3c4e7404. Source-order non-overlapping slices and one join remove repeated whole-artifact copies. All download and authority limits remain. Final asset path was independently re-reviewed after the generated Fast Refresh manifest integration, with no new plausible trust-boundary issue. Original immutable aedbc024 finding remains visible.

Tests:
- Ordinary 128 repeated literals: exactly one fetch, every replacement and surrounding source preserved; original artifact unchanged.
- Stress reproduction blocked by cybersecurity safeguard; no measured latency or crash claim.

## Reviewed Surfaces

| Surface | Risk Area | Outcome | Notes |
| --- | --- | --- | --- |
| Admission, locks, HTML/config and preservation (9 paths) | not recorded | No issue found | Exact graph/integrity/peer gates, no manager execution, archive limits, confined source and static semantics. HTML whitespace observation closed in final path. |
| Public values, assets and hosted authority (7 paths) | not recorded | Reported | One quadratic rewriting finding validated statically and fixed. SSRF/DNS/redirect/MIME/limits/revocation scope reviewed. Final manifest rewrite independently reread. |
| CSS workers and dedicated profile locks (8 paths) | not recorded | No issue found | Fixed worker code, bounded heap/deadline/capacity, empty env and dedicated resolver; 521 exact package records inspected. Unneeded host preload eliminated for finite CSS. |
| QA and threat/baseline evidence (8 paths) | not recorded | No issue found | Fixed native sandbox probe, exact upstream hashes, unchanged acceptance limits. Imported temporary source caused an initial broad-test collection failure, retained and excluded from owned-test runs. Final optional snapshot argument is data-only and stays in unchanged sandbox. |
| Post-freeze affected security paths and tests | not recorded | No issue found | htmlConfiguration.ts, isolatedPreview.ts, staticAssets.ts and associated regressions reviewed at final hashes; one known fixed finding, zero confirmed unresolved vulnerabilities. |
| Frozen32 changed paths | not recorded | Reported | 9 admission,7assets/authority,8CSS/profiles,8QA/evidence reviewed; one source-validated finding. |

## Open Questions And Follow Up

- Quantitative peak delay of the original quadratic loop was not measured because the stress exercise was blocked; no corresponding timing claim is made.
- Final asset-manifest integration and remediated-path reread still underway.
  - Follow-up prompt: Review deferred unit deferred-1fcb4b653b3733d1 and close its stated proof gap.
