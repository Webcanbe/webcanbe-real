# P61 narrow closure follow-up — 2026-09-15

**P61 remains PARTIAL solely because the historical second-application 422 has
no retained internal exception and did not reproduce. Zustand and bounded load
now pass. Internal blockers remain P05 / P39 / P61.**

The reviewed remote probe `b7c8f8bcaa9116e7dd34ffe111e464cd9dd8c202`
was based exactly on the starting feature tip and was cherry-picked as `901ba83`.
It admits only a confined local `.json`/`.webmanifest` manifest, validates it
through the existing path/realpath rules, never reads or interprets its contents,
and removes its link from generated controlled-preview HTML. Remote, protocol,
traversing, missing, wrong-extension and variant-attribute forms refuse. Canonical
`index.html` and exact source export are unchanged; no networking is enabled.

## Zustand: PASS

Exact unchanged `pmndrs/zustand` commit
`b57db4f86ef179285da216eeb291266da82c361c`, `examples/demo`, ZIP SHA-256
`bd5bcca159e5f47025c934c619454254cbe891307ac76d2ad544100d4fb3d11a`
passed the ordinary packaged HTTPS/PostgreSQL/mTLS/isolated-Linux path. All
canonical file hashes matched. Cold start was 4216.40 ms. First raster HTTP time
was 2992.70 ms (925852 bytes); warm raster was 2116.48 ms (919180 bytes). Both
passed the unchanged 4000 ms worker/browser bound and exposed the real Zustand
accessibility text.

The pre-fix diagnostic localized the capture timeout: an isolated-world selection
query ran on every frame despite no selected element and consumed 2846.79 ms;
the AX snapshot completed at 3575.54 ms and raster began at 3575.97 ms, leaving
too little of the 4000 ms budget. The general worker now tracks supervisor-owned
selection presence and skips only that absent-selection query. Navigation, route
change, preview updates and non-select pointer actions clear the state; a selected
or disconnected element is still observed and validated normally. Post-fix first
capture reached AX readiness at 1313.29 ms, raster completed at 2800.76 ms.

Measured cold path: source read 5.68 ms; materialized by 8.52 ms; compile/build
1858.91 ms; artifact put/get by 2032.60 ms; Chromium by 290.24 ms and context by
300.86 ms inside the worker; navigation/load by 1285.21 ms; runner/lease/open by
4177.70 ms. There was no separate application-defined readiness wait.

## Historical second-app 422: NOT REPRODUCED / UNPROVEN

One instrumented A → B → A sequence completed 16/16 HTTP stages with no retry:
both exact apps started/captured, then A Code/update/capture, B Code/update/capture,
and A Code/update/capture. Server-side markers confirmed source commit and preview
hold, compile/materialization, artifact put/get, fenced runner update, post-update
authorization/revision validation and capture. Three database checks tied each
current artifact to the expected project, workspace, revision, generation,
user/session, fence epoch and running lease.

The historical `resources-1789396020314.json` receipt contains only the generic
public 422. It cannot identify the internal stage or exception, and the failure
did not recur. Exact failure stage and root cause therefore remain **UNPROVEN**;
no retry, expectation change or speculative defect fix was added. Local TEST
editor/gateway entrypoints now route unexpected errors to the existing server-side
`onError` boundary while public HTTP and gateway responses stay generic.

## Targeted verification and security

43/43 targeted tests passed, zero failures/skips: 27 finite HTML/runtime cases,
13 raster/selection cases and 3 hosted mTLS/lease cases. This includes the new
manifest refusals and actual no-selection/selected-source worker behavior. No
existing test identity was removed or modified. The 646-test full regression is
deferred to final Phase-2 closure. Prior bounded load evidence is reused and was
not rerun.

Changed production paths and direct consumers were reviewed only for manifest
traversal/symlink/scheme/attribute handling, browser fetch surface, canonical
source divergence, selection lifecycle/authority and local diagnostic exposure.
Public responses remain generic. Zero confirmed unresolved vulnerabilities in
this bounded review. Details: `phase2-p61-evidence/followup.json` and
`phase2-p61-evidence/security-followup.json`.

## Remaining P61 blocker

The historical second-app warm-update 422 has no provable failure stage or root
cause. Passing later runs cannot manufacture that missing evidence, so the
retained P61 definition remains PARTIAL.

---

# Historical P61 bounded attempt — 2026-09-15

**P61 PARTIAL. Internal blockers remain P05 / P39 / P61.**
Started clean at `427c77be667c620a65a290ffa4f77fb97ab7950c` on
`phase-2-compatible-editor`; fetch, expected HEAD, main ancestry and unchanged
`origin/main` (`dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`) verified before edits.
No production implementation changed. This run found no proven general
performance defect safe to repair within the requested narrow scope.

## Zustand: NOT YET

Exact original `b57db4f86ef179285da216eeb291266da82c361c:examples/demo`, ZIP SHA
`bd5bcca159e5f47025c934c619454254cbe891307ac76d2ad544100d4fb3d11a`, all source
hashes verified. Ordinary packaged HTTPS/PG/mTLS startup now refuses before raster:
84.59 ms uninstrumented; 91.17 ms with TEST error logging; 97.80 ms with timestamps.
The last attempt read source in 5.80 ms and materialized it in 4.49 ms; compilation
was requested at process-monotonic 546.999 ms and refused during compatibility
inspection: `RuntimeCompatibilityError: Unsupported HTML link semantics.`
The original `index.html` contains `rel="manifest"`, which the current finite HTML
grammar does not admit. No lease, Chromium, navigation, readiness or raster stage
was reached. There is consequently no fresh cold/warm raster timing or proof of
the historical screenshot bottleneck. Adding HTML semantics would broaden this
performance-only attempt, so the guard remains intact. No source substitution,
timeout increase, raster retry or app-specific exception. Temporary diagnostic
edits were removed; the bounded timings/error receipt is retained.

## Second-application warm-update 422: NOT YET

The original `scripts/qa/final-resource-load.cjs` scenario passed unchanged,
including A then B Code/warm updates, 16 concurrent captures, the expected third-job
admission refusal and capture-burst refusals. A later success does not explain
`resources-1789396020314.json`. Its only stored failure is a generic 422; it lacks
inner error/stage/authority/fence data. No exact historical cause can be inferred.
The new bounded run also passed A → B → A and 20 updates, verifying each current
artifact's project/workspace/revision/generation, owner user/session, fence epoch
and running lease. Source markers remained independent. No suppression/retry or
expectation change. The historical failure remains an explicit internal blocker.

## One bounded representative load: PASS at the stated TEST boundary

Existing local isolated Linux VM, actual packaged HTTPS/PG/mTLS service. 2 users,
2 workspaces, 3 projects (exact frozen Kanban/Habit inputs), concurrency 2. A single
58.01-second run performed 167 project API operations: 145 successes, 22 expected
refusals, 0 unexpected failures. Counts exclude login/session provisioning and
read-only diagnostic SQL/resource sampling. Included 3 imports, 7 starts/stops,
48 successful captures, 39 successful source reads, 19 Code edits, 20 warm updates
(including one native-selection-backed Visual edit), and 4 session turnovers.
20 artifact/owner/fence checks; zero observed stale, duplicate or cross-project
results. Third-job pressure, wrong user, wrong generation and stale revision refuse.

| Successful operation latency | p50 ms | p95 ms | max ms |
|---|---:|---:|---:|
| All | 99.97 | 2066.22 | 4211.56 |
| Raster | 99.52 | 153.02 | 161.26 |
| Warm update | 1908.62 | 2227.92 | 2328.55 |
| Source read | 24.09 | 27.80 | 32.69 |

The 4211.56 ms maximum is cold startup, not raster. Resource samples:

| Resource | Initial | Observed peak | Final |
|---|---:|---:|---:|
| Aggregate worker tasks | 0 | 232 | 0 |
| Aggregate worker memory, bytes | 0 | 1289572352 | 0 |
| Active leases | 0 | 2 | 0 |
| Editor RSS, bytes | 151994368 | 487424000 | 340770816 |

Each worker retained 1.5 CPU, 1.5 GiB memory and 192-task limits. Seven distinct
lease generations were stopped. Initial/final guest command-line probes found
zero Chromium/worker matches, corroborated by zero owned worker tasks/leases.
The in-run probe counted 2 browser command matches and 8 worker-command matches
(including launcher wrappers); those are **not** a count of eight worker instances.
Browser contexts were not independently enumerated; the unchanged worker creates
one context per browser and final process/job teardown bounds their lifetime.
Peak figures are sampled, not continuous telemetry. Editor RSS did not return to
its cold level, but decreased from its observed peak; no 58-second result establishes
long-term memory stability. No production capacity, multi-hour soak or queue-size
telemetry claim. The retained burst scenario separately proves bounded refusals.

## Verification and review

19/19 targeted existing tests passed, zero skips/failures: fixed capture (12),
refresh (4), hosted runner (3), including actual native raster/refresh and mTLS.
Command and individual identities are in `phase2-p61-evidence/targeted-tests.json`.
No P05/P39 tests or complete suite were run. No existing test file/identity changed.
**646-test full regression execution deferred to final Phase-2 closure; no prior
test identity was removed or intentionally modified.**

Changed security scope: only the two new QA entrypoints and their direct consumers.
No production source, authorization, validation, cache, artifact, lease, egress or
resource policy changed. Zero confirmed unresolved vulnerabilities in this review.
A final QA-only correction records cleanup failure and gives baseline refusal a
nonzero exit status; syntax checks suffice, with no second load run.
Historical reports and all non-P61 ledger rows remain intact. No P01–P64 rebuild,
P05/P39 work, later phases, payments, final UI, main merge or public deployment.

## Remaining blockers

1. Ordinary unchanged Zustand is blocked by current manifest-link validation;
   the historical 4000 ms raster failure and its bottleneck remain unclosed.
2. Historical second-app 422 root cause is still unestablished. Passing reruns
   cannot substitute for diagnosis.

Load evidence is complete only at the bounded TEST scope above. Cleanup receipt verifies all 13 TEST leases stopped, no active artifacts, schema/PKI/password/tunnels/gateway removed and VM stopped. Publication is a normal feature-only push; the final response records its verified SHA.
