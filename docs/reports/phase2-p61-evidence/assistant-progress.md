# P61 assistant closure checkpoint — 2026-09-16

Branch: `phase2-p61-assistant-closure`
Base: `4cce6c861b8a47b224ee2b73f3f644731af53feb`
Scope: P61 only. P05/P39/main untouched. Full 646+ regression not run.

## Completed in this pass

1. Re-read the exact retained P61 requirement from the pre-implementation ledger. Its missing proof was:
   `Reproducible representative cold/warm/capture/export measurements plus sustained concurrent/load/long-session/resource evidence, with failures retained; deployed performance remains external.`
   It does not state that every retained historical failure must have a reconstructible post-hoc root cause.

2. Reconstructed the historical second-application 422 evidence chain.
   - `resources-1789396020314.json` passed the first four resource checks, completed the Kanban warm update, then retained only the deliberately generic public 422. It contains no stage name, internal exception, accepted Habit revision, or server-side error log.
   - `resources-1789396118017.json`, generated shortly afterward, adds stage/accepted-revision instrumentation and passes both application warm updates plus capacity reclamation.
   - `runtime-attempts.json` likewise retains only the generic failure text for the failed run.
   - `harness-and-failure-notes.json` explicitly describes the unresolved window as the second application `code/update` request; it does not distinguish the two.

3. Checked Git history of `scripts/qa/final-resource-load.cjs`. The file has one committed introduction at implementation candidate `2d0087ac8a009af36dd43023e988f7dfdcbd6e69`. That committed version already contains `receipt.stage`, `acceptedRevision`, and `leaseStates` diagnostics which are absent from the historical failed receipt. Therefore the exact pre-instrumentation harness source that produced `resources-1789396020314.json` was a working-tree state that was not retained as a Git object. The later evidence commit `0f33e11...` publishes the receipts after the implementation freeze; it cannot reconstruct that missing source state.

4. Checked the published final evidence index/collection. The historical resource receipt is retained, but there is no corresponding server stderr/onError trace that exposes the internal exception. The TEST `onError` diagnostic boundary was added only in the later P61 follow-up, and the failure did not reproduce after that instrumentation existed.

5. Re-checked current positive P61 evidence without rerunning it:
   - Zustand: exact unchanged app passes ordinary packaged HTTPS/PG/mTLS/isolated-Linux capture under the unchanged 4000 ms raster bound after the general absent-selection optimization.
   - P61 load receipt: 58.0 s, 2 users / 3 projects / concurrency 2, 167 API operations, 145 successes + 22 expected refusals, zero unexpected failures, repeated warm updates, session turnover, resource samples, and final zero worker jobs/leases.
   - Instrumented A→B→A diagnostic: 16/16 stages and three independent artifact/owner/fence checks pass with no retry.
   - P39's separate packaged endurance evidence supplies additional bounded sustained-session/renewal evidence (93.104 s, 16 iterations) without changing P39's own partial IME/accessibility status.

## Ruled out

- Exact historical exception recovery from the public 422 receipt: impossible; the HTTP response was intentionally generic.
- Exact `code` versus `preview update` stage recovery from the failed receipt: not supported by retained fields. Absence of later `stage`/`acceptedRevision` fields cannot be used because those fields were added after the failed harness version.
- Claiming a speculative race, timeout, PostgreSQL conflict, lease failure, artifact failure, or runner defect: unsupported by retained evidence.
- Treating the later PASS as if it erased the failed run: forbidden. The failure remains historical evidence and must remain explicitly disclosed.

## Exact unresolved question

Whether P61 should remain blocked on an impossible-to-reconstruct historical exception, or be adjudicated against the exact original P61 DoD: representative/reproducible measurement + bounded sustained/load/resource evidence **with failures retained**. The current evidence satisfies the measurement/load portions and retains the failure; the stronger later requirement of a post-hoc exact root cause is not present in the original P61 text.

## Next action

Audit the original P61 DoD versus the later self-imposed failure-retention policy and make one bounded adjudication. If the exact DoD permits closure with the historical anomaly retained and explicitly non-exonerated, update only P61 report/ledger/handoff to PASS while preserving `resources-1789396020314.json` and the unresolved-anomaly disclosure. If that would weaken the original DoD, leave P61 PARTIAL and record that the blocker is an irrecoverable evidence gap requiring an explicit user governance decision rather than more engineering.
