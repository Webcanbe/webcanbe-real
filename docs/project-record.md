# WebCanBe project record

The source is the product. Preserve adapter / bridge / runtime / transaction separation.

- Phase 1 reviewed baseline: `6f3582a`.
- Recovered Phase 2: `68666d6` implementation, `d1683f6` validation.
- The full original recovery report is preserved verbatim at
  `reports/phase2-recovery-report.md`; its original and iCloud repository are untouched.
- Active repository: `~/Developer/WebCanBe-recovery`, branch `phase-2-compatible-editor`.
- Verified remote: `https://github.com/Webcanbe/webcanbe-real.git`.
- Phase 2B: targeted runtime-profile checkpoint passes. See `phase2b-runtime.md`
  for pinned versions, stage-specific audit, fixtures, commands, evidence and limits.
- Overall Phase 2 remains NOT YET complete; public hosted import is NOT ready.
- Full outstanding Phase 2 requirements remain in `phase2.md` and the recovery report.
- Current commit/push state and next task: `current-handoff.md`.

No main merge, force push, public runtime deployment, landing redesign or paid
infrastructure is authorized by this checkpoint. Future hosted runtime work requires
ownership authorization and resource isolation; a browser iframe does not isolate Node.
