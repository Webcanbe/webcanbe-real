# Webcanbe interruption-safe launch checkpoint

Recorded: 2026-09-21 KST. This is an incremental continuation record, not a replacement for historical handoffs.

## Gate 2 production blocker isolated — 2026-09-21 KST

- Production/main remains `381fdc7e300d05e6f4b22cf46e2e7715614e7d01`.
- New diagnostic branch: `phase5-gate2-provider-boundary-smoke`.
- Credential-free provider-boundary workflow added on draft PR #42.
- Focused static Gate 2 tests: **7/7 PASS**.
- Real production browser probe against `https://webcanbe.com/_ops/gate2-auth-smoke` proves:
  - route HTTP 200: PASS
  - `noindex, nofollow`: PASS
  - GitHub probe control enabled: PASS
  - no Firebase exchange/link request was made: PASS
  - no Webcanbe first-party session cookie was created: PASS
  - provider popup **does not open** because the deployed app reports `Firebase Authentication is not configured.`
- Production bundle inspection gives the exact cause: all six Firebase Web SDK fields are compiled as `void 0`:
  - `apiKey`
  - `authDomain`
  - `projectId`
  - `storageBucket`
  - `messagingSenderId`
  - `appId`
- Therefore the prior assumption that only human provider interaction remained was incomplete. The current first blocker is **production build-time Firebase Web configuration**.
- The latest diagnostic workflow run carrying bundle evidence is `35543004163`, job `106163934006`. It fails intentionally at the provider-boundary assertion and must not be called a Gate 2 PASS.
- No production mutation switch, entitlement fixture, payment authority, identity link, credential submission, authorization decision, or production data mutation was performed by this diagnostic.

## Exact next implementation order

1. Restore the six public `VITE_FIREBASE_*` values in the **production build environment** used by Vite/Cloudflare; do not put OAuth client secrets or user credentials into frontend code.
2. Trigger a production rebuild from main and verify the emitted JS no longer contains an all-`void 0` Firebase config.
3. Re-run the credential-free Gate 2 provider-boundary smoke. It must reach the official GitHub provider page and close without exchange/link/session side effects.
4. Only then perform the human-authenticated Gate 2 E2E: Google baseline/private reads/refresh → link GitHub + Email to the same internal account → logout → linked GitHub login/read/refresh/logout → linked Email login/read/refresh/logout.
5. Keep Gate 3 staging and product mutation OFF until step 4 is green.
6. After Gate 2 is green, promote the reconciled Gate 3 candidate, apply the private no-public-Listing launch fixture, activate materialization deliberately, and run the production Gate 4 materialize → edit → save → reopen → standalone export/build chain.
7. Live Worker rollback, real off-site DB restore, and commercial payment/seller activation remain later independent launch gates.

---

## Latest verified Gate 3 checkpoint

- Gate 3 staging was reconciled with current main instead of being promoted from the diverged `9f8b5d184682567bb7881af2a1f42ddc71bd5e1e` tree unchanged.
- Backup before reconciliation: `backup/gate3-v3-before-main-reconcile-20260921` at `9f8b5d184682567bb7881af2a1f42ddc71bd5e1e`.
- Reconciled Gate 3 code checkpoint: `edc11bb0df4b54defec030a9cfa068b10ae2236c`.
- Current Gate 3 documentation checkpoint: `b1284e268f8a53aed63491b42e62014bd903d45e`.
- `package.json` preserves both `db:recovery:preflight` and `launch:smoke-fixture`.
- Reconciled staging verification:
  - UI `35520243803`: **PASS**
  - durable editor/export `35520243786`: **PASS**
  - Bigperson `35520243691`: **PASS**
- Gate 3 remains staging-only and product mutation remains OFF in production.

---

## Earlier interruption snapshot

The older details remain in Git history and `docs/current-handoff.md`; when they conflict with the two sections above, the newer Gate 2 production evidence and the reconciled Gate 3 checkpoint win.
