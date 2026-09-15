# Phase 2 P61 final adjudication — 2026-09-16

**P61: PASS at the retained internal local-TEST measurement/evidence boundary.**

This report supersedes only the current P61 status. It does not delete or rewrite the historical P61 closure report, failed receipts, or failure classification. P05 and P39 are outside this branch's scope.

## Exact retained requirement

P61 requires:

> Representative cold import/start, warm CSS/React/refresh/reload/restart/export and resource measurements (G.1/2G.2)

The pre-implementation ledger records the missing proof as:

> Reproducible representative cold/warm/capture/export measurements plus sustained concurrent/load/long-session/resource evidence, with failures retained; deployed performance remains external.

The evidence now satisfies that exact internal requirement.

## Current accepted evidence

- Exact unchanged Zustand passes the ordinary packaged HTTPS/PostgreSQL/mTLS/isolated-Linux path. Cold start: 4216.40 ms. First raster: 2992.70 ms. Warm raster: 2116.48 ms. The raster calls remain under the unchanged 4000 ms bound. The general fix removes measured absent-selection observation overhead rather than changing the timeout.
- A later instrumented A→B→A sequence passes all 16 HTTP stages with no retry and verifies three independent artifact/owner/fence bindings.
- The dedicated bounded P61 load passes for 58.01 seconds with 2 users, 3 projects and concurrency 2: 167 API operations, 145 successes, 22 expected refusals, zero unexpected failures, repeated warm updates, session turnover, resource samples, and verified return to zero jobs/leases.
- Separate already-retained packaged sustained-session/renewal evidence runs for 93.104 seconds over 16 iterations with verified cleanup. Reusing this as P61 long-session evidence does not change P39's own native-IME/accessibility status.
- Prior P61 targeted verification remains 43/43 PASS. No tests were rerun for this documentation-only adjudication. The full 646+ regression remains deferred to final Phase-2 integration.

## Historical second-application 422 remains retained

`resources-1789396020314.json` remains a real failed product attempt. It passed the first four resource checks and the Kanban warm path, then stored only the deliberately generic public 422 during the second-application code/update window. It is not relabeled as success.

The exact stage and root cause are **UNPROVEN** and are not guessed. The retained evidence cannot recover them:

- the public receipt intentionally lacks the internal exception;
- `runtime-attempts.json` contains only the same generic failure;
- `harness-and-failure-notes.json` narrows the window only to second-app `code/update`;
- the committed `final-resource-load.cjs` already contains stage/accepted-revision/lease-state diagnostics that are absent from the failed receipt, so the pre-instrumentation harness state that generated it was not retained as a Git object;
- no matching server stderr/onError trace was published;
- the later TEST onError seam was added after the failure and the failure did not reproduce afterward.

Therefore the anomaly remains explicitly unresolved. Later successes do not erase it and this PASS does not claim the anomaly harmless.

## Why this is P61 PASS rather than a DoD waiver

The stronger later statement that P61 could close only after reconstructing the exact historical exception is not part of the original retained P61 requirement. The original DoD explicitly asks for representative/reproducible measurements and sustained load/session/resource evidence **with failures retained**. Those measurements now exist, and the failed receipt remains retained and disclosed.

Treating an intentionally unrecorded historical exception as a permanent mandatory proof would add an impossible post-hoc criterion after the fact. This adjudication does not reduce the original scope: it applies the original text literally while keeping the failure visible.

A future recurrence is a new failure and must be investigated through the later server-side TEST diagnostic boundary. P61 PASS is not a production capacity, SLO, multi-hour soak, multi-host or deployed reliability claim; applicable production evidence remains external.

## Branch and integration

P61 work is isolated on `phase2-p61-assistant-closure`, based on `4cce6c861b8a47b224ee2b73f3f644731af53feb`. No production code, P05, P39 or main branch was changed by this adjudication.

Because P05 and P39 are concurrently advancing elsewhere, this branch deliberately does not overwrite the older shared `final-ledger.json` or `current-handoff.md`. Final integration must apply only the P61 status delta to the then-current files:

- P61 `PARTIAL -> PASS`;
- remove P61 from the then-current internal blocker list;
- PASS count +1, PARTIAL count -1;
- preserve the failed receipt and unresolved-anomaly disclosure;
- preserve whatever newer P05/P39 status exists at integration time.

Machine-readable adjudication: `phase2-p61-evidence/assistant-adjudication.json`.
Durable investigation checkpoint: `phase2-p61-evidence/assistant-progress.md`.
Historical P61 report remains unchanged at `phase2-p61-closure.md`.
