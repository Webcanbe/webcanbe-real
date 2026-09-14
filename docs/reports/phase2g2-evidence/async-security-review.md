# Phase 2G.2 async composition security review and remediation

Codex Security diff scan: `6204235c-d90b-48eb-b0cb-b9f4c06f6862`.
Base: `65005b3822418594dd95ca826e8ff90b912c8df3`.
Immutable pre-remediation patch digest: `codex-security-snapshot/v1:sha256:abd7b289f89b0a64c1aabcc8c061bd772948c36c9df24084748ebea523262ede`.

The desktop workflow completed preflight, an independent fresh-context architecture model, complete changed-source discovery, targeted dynamic validation, attack-path assessment and sealed canonical finalization. Independent authority and preview/UI reviewers covered disjoint source groups; the parent covered remaining source/authoring/profile/CLI/test/export code. The authoritative inventory had27 source paths;3 changed CJS files omitted by its extension filter were also reviewed. This is complete coverage for those30 changed surfaces, not an exhaustive new repository audit. The previous Standard scan remains historical evidence.

## Finding and fix

One medium/P2 finding: `csf_5e72dea745ffe86a68a49107`, candidate `candidate-30ee9c9db582d3ab` (CWE-362/CWE-400). In the scanned `controlledPreview.ts:164–168`, the compiler capacity check preceded an awaited hosted session-expiry lookup, then recorded the reservation. Eight simultaneous authorized starts all reached private materialization before any pending entry existed. Actual Linux runner quotas remained PostgreSQL-owned but occurred after compilation. The measured outcome was8 materializations versus intended1; heavy compilation and runner execution were deliberately stopped by the bounded probe. No service crash, cross-tenant source leak or sandbox escape was claimed.

The final implementation awaits expiry first, then checks closed/quarantined/expired/capacity state and records the pending entry without an intervening await. The new default regression holds8 requests at expiry, then requires1 materialization and7 capacity rejections. The authoring/controlled test group passed29 tests. An independent final source reread confirmed the exact root cause is removed. The sealed report remains the pre-fix review, not a rewritten zero-findings result.

Same-login capability stop during an already-authorized source commit was also investigated. PG commit still requires the active authenticated account and unchanged workspace/project grant epochs; that same actor can mint another capability. No privilege escalation or tenant-boundary impact was established, so it did not become a security finding. Ordinary lifecycle/uncertain-response semantics remain governed by source revision and idempotent retry.

## Follow-up changes and checks

The exact packaged `editor.cjs` now replaces the test bootstrap wrapper in hosted acceptance. All12 real HTTPS/OIDC/PG/mTLS/fault/browser cases pass through its configuration loader and PG factory. Independent review verified trusted operator-only configuration, listener closure before provider drainage, generic uncertain-cleanup failure reporting, required application/profile/compiler resources and placeholder-only config. No new authority finding was found.

The finite task-exhaustion probe is reachable only via trusted proof startup. It attempts at most256 sleeping child processes under the unchanged TasksMax192 policy, checks every successful waitpid against its own child, and requires the fork limit plus complete reaping. Actual final probe:182 spawned, next fork denied, children reaped. Existing complete OS network/process/filesystem/memory/watchdog proofs pass. No launch policy, budget or imported-script entry point changed.

The scan tool's finding UI can derive its optional source excerpt from the baseline Git revision for an uncommitted patch. The canonical candidate locations, parent-read patch, dynamic probe and final implementation hashes are the actual evidence; a baseline-only UI excerpt is not used to validate this finding. Canonical files and generated report were sealed before remediation and are retained locally. No source edits occurred during the scan.

Final source hashes are in `async-implementation-digests.json`; test boundaries/counts are in `async-validation.json`. Unchanged original305 tests are preserved within325 distinct passes. Production credentials/DNS/PG-PITR/cloud-node/real-load proof and the remaining Phase2 software gaps remain open. Daybreak was not granted; this is not a professional penetration test.

Workbench measured usage across5 participating task records: **9,473,777 total tokens;9,433,580 input tokens;8,935,552 cached input tokens;40,197 output tokens**. Coverage reported complete. These are the tool's measured aggregate token counts, not a cost estimate.

Final UI follow-up: raster requests pin revision as well as generation/connection epoch. Queued input is bound to its connection and drains through the current committed callback; refresh attempts pin revision and ignore superseded completions, with source-acceptance/compatibility continuations guarded too. Independent reread found no new security issue. The final browser test holds an old capture before sending it through real verified TEST HTTPS, releases after Code acceptance/refresh, receives server409 and requires a ready preview plus working input. This reproduces the stale error path without fabricating a response. The retained authored-export verifier is the same reviewed local QA harness used by both standalone hosted exports; imported corpus code still runs only in the Linux sandbox.
