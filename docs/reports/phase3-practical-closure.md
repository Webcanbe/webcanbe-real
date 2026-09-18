# Phase 3 practical closure

Date: 2026-09-17

Branch: `phase-3-hosted-product`

Validated implementation checkpoint: `51fbea3fc6fc5a5038cfa1a03c9f1d314d919bf7`

Status: **PRACTICAL PHASE 3 CLOSED**

This report reconciles the locked Phase-3 Product Functionality / Marketplace scope against the accumulated milestone evidence and the final default regression. It does not promote Phase-4 UX/UI or Phase-5 AI/payment/production-hardening work into Phase 3.

## Scope reconciliation

- Product domain / immutable `ProjectRelease` lineage: PASS.
- Hosted PostgreSQL persistence and authenticated product controller: PASS.
- Marketplace catalog, `/browse`, authoritative project detail, and functional hosted product routes: PASS. Final public visual design remains Phase 4.
- Provider-agnostic entitlement -> authorized workspace materialization: PASS.
- Purchases/entitlements remain distinct from My Projects/editable working copies: PASS.
- Seller application/onboarding authority: PASS.
- Seller submission, quarantine, immutable review decision and cross-seller isolation: PASS.
- Assessment admission, claim/leasing, lease renewal/cancellation, stale-fence rejection and result acceptance: PASS.
- Isolated seller assessment worker and bounded result boundary: PASS.
- Passed-assessment-only release promotion: PASS.
- Explicit Listing publication bound to promoted immutable release: PASS.
- Non-executing seller ZIP admission with archive-safety reuse: PASS.
- Non-executing seller GitHub admission with immutable commit pinning, trusted fetch boundary and ZIP-safety reuse: PASS.
- Server-authoritative WebCanBe Ready qualification with immutable release/evidence provenance and truthful `ready` / `partial` / `code_only` states: PASS.
- Seller-scoped Creator Studio functional backend: PASS.
- Bounded project Share contract with revocation and authority checks: PASS.
- Exact-revision Export product flow reusing the retained Phase-2 exporter: PASS.
- Exact-revision Deploy intent/state contract: PASS. No production provider call is made in Phase 3.
- Admin/Control read backend over existing product records: PASS.
- Privileged Control transitions, immediate operator revocation, immutable append-only audit and server-minted fresh step-up boundary: PASS.

No parallel source/project truth was introduced. IDs remain references rather than authority; source/release provenance and tenant boundaries remain server-authoritative.

## Final regression and build

The first remote closure attempt on GitHub Actions failed because the CI runner used Node 22 and installed only the root dependency graph while the retained Phase-2/3 tests require separately installed repository-owned trusted runtime profiles. That run is preserved as an environment/setup failure receipt rather than relabeled as a product regression.

The closure runner was corrected to use Node 26 and to prepare every committed `runtime-profiles/*/package-lock.json` with `npm ci --ignore-scripts --prefix <profile>` before executing the same default test command. GitHub Actions run `35208645693` then completed successfully:

- test files: 49 passed, 6 skipped;
- tests: **750 passed, 61 skipped, 0 failed**;
- Phase-3 hosted-product suite: **66/66 passed**;
- TypeScript: PASS as part of `npm run build` (`tsc -b`);
- production Vite build: PASS;
- only the existing non-failing chunk-size advisory remained;
- `main` verification: PASS.

The successful recovery workflow published the minimal compatibility fixes as `51fbea3fc6fc5a5038cfa1a03c9f1d314d919bf7` and removed its temporary recovery workflow/script afterward.

## Security and dependency disclosure

Phase-3 changed-surface security reviews remain green:

- final-sprint Pass 1 focused scan: zero findings / zero unresolved;
- Admin/Control focused scan: zero findings / zero unresolved, with the subsequent one-line risk-reducing omission of step-up evidence IDs manually reviewed;
- the final default regression preserved the authority, provenance, isolation and lifecycle assertions across the combined suite.

This is not a claim that every pinned trusted runtime profile has a clean current `npm audit`. During CI preparation, several compatibility profiles reported dependency advisories, including high/critical severities in some older pinned graphs. Those profiles are operator-owned compatibility inputs and must not be blindly rewritten with `npm audit fix --force`; their advisories remain an explicit production dependency-hardening item for Phase 5. Root `npm ci` reported zero vulnerabilities in the successful closure run.

## Preserved historical receipts

- `P39_NATIVE_ACCEPTANCE=DEFERRED`. The synthetic/unit P39 suite passing in the final regression does not replace the deferred native macOS IME/VoiceOver acceptance evidence.
- P61 historical second-application warm-update HTTP 422 remains disclosed; its exact historical root cause was not proven.
- The earlier Stage-B raw full run remains recorded as 686/687 with the untouched Phase-2 Vite temporary-cache `ENOTEMPTY` cleanup race; its exact serialized case later passed 1/1. The new clean 750-pass run does not erase that historical receipt.
- The initial Phase-3 remote closure CI failure caused by missing trusted runtime-profile preparation remains preserved as an environment/setup failure before the corrected successful run.

## Correct later-phase deferrals

### Phase 4 — Full Product UX/UI

Preserved for Phase 4:
- final public landing / Marketplace / detail / demo / Docs / Pricing UX;
- contextual AuthModal, login/signup/reset/verification UX;
- final sidebar, Dashboard, My Projects and Purchases experience;
- final `Visual | Code | Split` workspace UX;
- Creator Studio UI;
- separate Control application UI;
- responsive/mobile/accessibility and interaction polish.

### Phase 5 — AI + Payments + Production / Launch Hardening

Preserved for Phase 5:
- AI editing on the same source/revision/auth model, diff/review/history/rollback and metering;
- real marketplace checkout, subscriptions, seller KYC and payouts;
- platform fees, refunds, chargebacks and accounting ledger;
- real deployment-provider integrations and production credentials;
- production WebAuthn/passkey ceremony where not already genuinely implemented;
- observability, rate limits, abuse/fraud controls, backup/recovery, load/performance and final production security/reliability;
- runtime-profile dependency-advisory adjudication/update strategy and launch hardening.

## Closure result

```text
PHASE3_SCOPE_RECONCILED=PASS
FINAL_REGRESSION=750 PASSED / 61 SKIPPED / 0 FAILED
KNOWN_PHASE2_CLEANUP_FLAKE=PRESERVED_HISTORICAL_RECEIPT
NEW_REGRESSION_FAILURES=0
PHASE3_PRACTICAL_CLOSURE=PASS
PHASE4_DEFERRALS_PRESERVED=PASS
PHASE5_DEFERRALS_PRESERVED=PASS
P39_NATIVE_ACCEPTANCE=DEFERRED
P61_HISTORICAL_422_DISCLOSURE=PRESERVED
MAIN=dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b
MAIN_UNCHANGED=YES
NEXT_PHASE=PHASE_4
BLOCKER=NONE
```

No merge to `main` is performed by this closure. Phase 4 should branch from the final Phase-3 closure checkpoint so the product UX/UI work sits directly on the reconciled Phase-3 functionality while `main` remains untouched until an explicit later decision.
