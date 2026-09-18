# P61 assistant closure checkpoint — FINAL — 2026-09-16

Branch: `phase2-p61-assistant-closure`
Base: `4cce6c861b8a47b224ee2b73f3f644731af53feb`
Scope: P61 only. P05/P39/main untouched. Full 646+ regression not run.

## P61 status

**PASS at the exact retained internal local-TEST measurement/evidence boundary.**

This does **not** mean the historical second-application 422 was explained, fixed, erased, or shown harmless. It remains retained as an unresolved historical anomaly. The PASS is an adjudication against the original P61 definition of done, which requires reproducible representative measurements plus sustained concurrent/load/long-session/resource evidence **with failures retained**. The original P61 text does not require a post-hoc exact root cause for every retained failure.

Machine-readable reasoning and evidence mapping: `assistant-adjudication.json`.

## Historical 422 reconstruction

- `resources-1789396020314.json` passed the first four resource checks and the Kanban warm-update path, then stored only the intentionally generic public 422. It contains no internal exception, stage marker, accepted Habit revision, or server error trace.
- `resources-1789396118017.json` shortly afterward adds stage/accepted-revision instrumentation and passes both app warm updates plus capacity reclamation.
- `runtime-attempts.json` retains only the generic failure text for the failed attempt.
- `harness-and-failure-notes.json` narrows the historical window only to the second application `code/update` request; it does not distinguish code from preview update.
- Git history for `scripts/qa/final-resource-load.cjs` has a single committed introduction at `2d0087ac8a009af36dd43023e988f7dfdcbd6e69`. That committed source already contains `receipt.stage`, `acceptedRevision`, and `leaseStates` diagnostics which are absent from the failed receipt. Therefore the exact pre-instrumentation harness source was an unretained working-tree state; it cannot be reconstructed from Git.
- The published evidence set contains no matching stderr/onError record exposing the internal exception. The later TEST `onError` boundary was added after the failure and the failure did not reproduce afterward.

Exact stage/root cause therefore remain **UNPROVEN**. No speculative race, timeout, database, lease, artifact, or runner cause is adopted.

## Retained P61 DoD mapping

Original retained requirement:
`Representative cold import/start, warm CSS/React/refresh/reload/restart/export and resource measurements (G.1/2G.2)`.

Original retained missing proof:
`Reproducible representative cold/warm/capture/export measurements plus sustained concurrent/load/long-session/resource evidence, with failures retained; deployed performance remains external.`

Current evidence satisfies that boundary:

- Exact unchanged Zustand: cold start 4216.40 ms, first raster 2992.70 ms, warm raster 2116.48 ms under the unchanged 4000 ms raster bound after the general absent-selection optimization.
- Instrumented A→B→A diagnostic: 16/16 HTTP stages, zero failures, three independent artifact/owner/fence checks, no retry.
- Bounded P61 load: 58.01 s, 2 users / 3 projects / concurrency 2, 167 API operations, 145 successes + 22 expected refusals, zero unexpected failures, repeated warm updates, session turnover, resource samples, and final zero worker jobs/leases.
- Separate packaged sustained-session/renewal evidence already retained by P39: 93.104 s, 16 iterations, verified cleanup. This cross-evidence does not change P39's native-IME/accessibility PARTIAL status.
- Prior 43/43 targeted P61 tests remain PASS and were not rerun for this documentation-only adjudication.
- Historical failed receipt remains present and explicitly classified; it is not replaced by later success.

## Residual risk and scope

The historical generic 422 remains an unresolved anomaly. A future recurrence is a new failure and should be diagnosed using the later server-side TEST `onError` seam. P61 PASS is not a production sizing, SLO, multi-hour soak, multi-host, or deployed reliability claim; those production/deployment requirements remain external where already classified.

No production code changed in this adjudication. No P05/P39 work, no main change, no full 646+ regression, no load rerun, and no broad security scan occurred.

## Integration note

The authoritative feature ledger/handoff are **not overwritten on this dedicated branch**, because P05 and P39 are concurrently advancing from separate branches. Final integration must apply only this P61 delta:

- `P61: PARTIAL -> PASS`
- remove P61 from `internalRemaining`
- increment PASS by one and decrement PARTIAL by one from whatever the then-current ledger counts are
- preserve `resources-1789396020314.json`, `harness-and-failure-notes.json`, and the unresolved-anomaly disclosure
- do not modify P05 or P39 status while applying the P61 delta

No further P61 engineering blocker remains at the retained internal measurement DoD.
