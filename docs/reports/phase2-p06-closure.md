# P06 closure — 2026-09-15

**P06 PASS. Nested source tree PASS. Independent export-build integration PASS.**

Started from verified clean `6ad7dc21dd5b580fea84b09d767fe5984c576387` on
`phase-2-compatible-editor` after fetching origin. There is no local main branch;
`origin/main` remains `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`.
Final implementation: `47a97751eee352643ff704886ac1392a812c43a7`. Publication follows in documentation commits.

## Canonical nested source authority

Static Vite root plus its single HTML module entry determines one project-confined
source directory. Referenced TypeScript configuration and explicit runtime aliases
retain their actual relative bases. Supported tests include `src`, `client/src`,
`apps/web/src`, and `frontend/source`; no project-name adapter was added.

The existing revision ledger records the relative source directory; older histories
retain their implicit `src` identity without migration or changed hashes. Local registry,
PG intake/checkouts/digests, staged Code validation, Visual anchors, undo/redo, restart,
semantic checking and exact ZIP export use the actual canonical paths. PG acceptance
cannot rebind that directory. Nested compiler imports and CSS candidates cannot silently
consume another editable tree. Traversal, changed root identity, symlink escapes,
missing/ambiguous HTML and dynamic nested roots refuse. No source mirror is created.

## Independent production export build

The real export API keeps the established validation/authorization seam and validates
the actual ZIP in a fresh disposable checkout. The standalone
`scripts/qa/common-export.cjs` uses the same independent gate.

The trusted confined esbuild resolver composes the complete application into immutable
ES modules. Generated public URLs are rebound only to exact emitted graph members;
the finite Rollup helper then applies production options. Application dependencies use
their selected pinned profile. Rollup **4.63.2** uses the fixed operator
`react19-vite6` compiler graph, including when the application uses retained Vite 8.
Operator esbuild is **0.25.12**, TypeScript **5.9.3**. Existing profile files/locks are unchanged.

Actual application-export tests preserve `external: ['fs/promises']` imports and observe
fewer eligible chunks with `output.experimentalMinChunkSize: 3500` versus `0`.
Preview still refuses reachable Node imports. A production-build PASS does not claim
that an external Node import can run in a browser. Exports contain no editor bridge or
source instrumentation. Full source/config ZIP bytes remain exact.

Uploaded Vite/Rollup modules, plugins, lifecycle hooks and build scripts never execute.
There is no imported or host node_modules fallback. Unknown executable effects refuse;
Todo's missing runtime alias remains an upstream incompatibility. Whole-export admission
has two slots; existing byte/count bounds, compiler deadlines and worker limits remain.

## Verification and security

**621 distinct passing identities: all prior 594 plus 27 new. All 38 prior test files
are byte-exact; zero outstanding failures or skips.**

- Affected integration: 224 passes; four gated cases subsequently exercised.
- Full preserved suite ran **once**, serially with every native/PG/mTLS/packaged-editor
  flag enabled: 619 passes, two failures, zero skips.
- Final bounded correction rerun: all 68 authority/P06 tests pass, including native
  nested semantic checking and real PG nested acceptance/root-rebinding refusal.
- Final TS include-prefix compatibility check: 41 passes; four gated identities already
  passed in the preceding runs. Specific files/subtrees retain their compiler options.
- TypeScript, production build and hosted package pass at the final source revision.
- New standalone nested application export gate passes with exact source and finite plan.

The full-run failures were an old revocation test whose validation hook had been bypassed,
and one Vite temporary-directory cleanup race. The existing validation seam was restored,
with fresh authorization before either diagnostics or success; no old test was changed.
Development also caught harness syntax/type errors, encoded-anchor assertion error,
legacy intake/changed-root return regressions and generated module URL rebinding.
Review corrected Vite8 compiler selection, repeated hosted ledger reads and overly narrow
TypeScript include-prefix matching.
Only affected paths/tests were reread/rerun after these corrections; no second full suite.

Parent security review covers all **20 changed paths** (19 implementation/tooling paths
and the new test file), following direct source, history, authorization and compiler
consumers. Final corrections have recorded rereads/digests. **Confirmed unresolved
vulnerabilities: 0.** This is a bounded code review, not a broad scan, independent
security certification or production penetration test.

[Regression identities](phase2-p06-evidence/regressions.json),
[standalone export](phase2-p06-evidence/standalone-export.json),
[security coverage](phase2-p06-evidence/security-review.json),
[threat model](phase2-p06-evidence/threat-model.md).
Historical reports, unchanged application/browser evidence and every non-P06 ledger row
are preserved. No corpus reconstruction or P05/P39/P61 implementation occurred.

## Final disposition

P06 blockers: **NONE**. Current internal blockers: **P05 / P39 / P61**.
Matrix: **48 PASS / 3 PARTIAL / 1 deferred FAIL / 12 EXTERNAL-EVIDENCE**.
**Phase 2 internal software closure: NOT YET.** Phase 3/4/5 remain out of scope.
Owned TEST leases, services, schema, credentials and scratch artifacts were cleaned;
the VM was stopped. Only a normal feature-branch push; no main merge or deployment.
