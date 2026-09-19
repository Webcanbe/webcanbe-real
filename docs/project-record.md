# WebCanBe project record

## 2026-09-19: Durable DB sessions and private product reads prepared

The production Worker can now switch from the temporary signed-cookie session
fallback to the durable PostgreSQL session model automatically when Hyperdrive
is bound. Google and Firebase identities both create the same DB-authoritative
session path, and session refresh, CSRF verification, and logout/revocation use
the retained `wcb_sessions` authority tables.

Three read-only private product routes are now implemented: workspaces,
purchases/entitlements, and ready working-copy listing. Every request requires a
live DB session plus CSRF evidence. Purchases are user-scoped, and working-copy
reads additionally require an active owner/editor workspace membership.

The write side remains intentionally closed. Materialization, payment,
entitlement mutation, seller mutation, and control routes will not be enabled
until Hyperdrive is live and the DB-session path has passed production smoke.

---

## 2026-09-19: Production PostgreSQL provisioned and locked to server-only authority

A real Supabase PostgreSQL project named `webcanbe-production` now exists in
Seoul and has the retained Phase 3 authoritative schema applied. The migration
created the complete Webcanbe identity, session, workspace/project, catalog,
release/listing, entitlement/materialization, seller assessment/publication,
Ready, share, deploy-intent, and control/audit structures rather than creating
a second launch-time data model.

Immediately after migration, Supabase's default public-schema grants exposed
the new Webcanbe tables to `anon` and `authenticated`. The production
hardening pass removed those privileges, removed future default grants to those
roles, fixed mutable function `search_path`, and introduced a NOLOGIN
`webcanbe_runtime` server role with bounded DML rights. A subsequent Supabase
security-advisor run reported zero findings.

RLS was not enabled mechanically without policies. Webcanbe's current authority
model is Worker/Hyperdrive -> PostgreSQL, not browser -> Supabase PostgREST, so
browser database roles are explicitly denied instead. The reproducible
hardening SQL is committed at
`deployment/hosted/postgres-supabase-hardening.sql`.

The next infrastructure step is a dedicated password-bearing login inheriting
the runtime role plus a Cloudflare Hyperdrive binding; credentials must remain
server-only.

---

## 2026-09-19: P5.2 Workers public catalog and Hyperdrive seam

The first production product-API slice now has a Workers-compatible adapter
without duplicating the Phase 3 data model. The new public catalog path queries
the existing `wcb_listings`, `wcb_project_releases`,
`wcb_catalog_projects`, and `wcb_ready_qualifications` contract and returns
the same Listing and immutable Release provenance used by
`PostgresProductDomainStore`.

The Worker now owns browse/detail route dispatch and a Hyperdrive connection
seam using the existing compatible `pg` dependency. No Hyperdrive binding is
invented in source; until a real database is provisioned the routes fail closed
with HTTP 503. Purchases, workspace mutations, seller state, and Control remain
closed because they require durable DB-backed user/session authority first.

CI now performs a real Wrangler v4 dry-run after the Vite build, in addition to
the focused tests and syntax checks. This verifies that the Worker bundle,
including node-postgres, is actually bundleable under the committed
`nodejs_compat` configuration.

A static audit of the retained PostgreSQL migration found no extension, role,
database, superuser, or ALTER SYSTEM requirement. The migration keeps its
existing PL/pgSQL immutability/guard triggers and authoritative Phase 2/3
tables. The next infrastructure step is therefore a managed PostgreSQL
instance plus a Cloudflare Hyperdrive binding, not a replacement schema.

See [Phase 5 plan](phase5.md) and [current handoff](current-handoff.md).

---

## 2026-09-19: P5.1 first-party session unification and P5.2 backend audit

Firebase-backed GitHub and Email/Password authentication no longer counts as
backend authority merely because the Firebase client is signed in. After
Firebase authentication, the browser obtains a Firebase ID token and posts it
to the same-origin Cloudflare authentication boundary. The Worker validates an
RS256 signature against Google's Firebase signing keys and checks the Firebase
project audience/issuer, expiration, issued-at/authentication times, and a
bounded non-empty UID. Only then does it mint the same Secure HttpOnly
Webcanbe session used by the existing Google flow.

New Webcanbe sessions retain canonical provider/subject fields so Google and
Firebase subjects cannot collide accidentally. Persistent Firebase state may
be used only to re-establish the first-party server session; protected
production routes no longer accept Firebase client state directly. Logout
clears both layers.

The P5.2 audit also confirmed that the real product domain was already built in
the Phase 2/3 hosted stack: `HostedProductController`,
`PostgresProductDomainStore`, `PostgresIdentityStore` and
`PostgresAccess`. That code is composed into a private Node HTTPS/PostgreSQL
runtime, not the current Cloudflare static/auth Worker. Phase 5 must therefore
reuse the PostgreSQL schema/domain rules through a Workers-compatible boundary
instead of inventing a second catalog/purchase/workspace database. Managed
PostgreSQL plus Cloudflare Hyperdrive is the preferred next runtime seam.

CI covers real generated RS256 Firebase-token verification as well as the
existing Phase 4/5 suite, Worker syntax, and production Vite build. Production
Cloudflare observation of the new exchange route remained pending at this
checkpoint.

See [Phase 5 plan](phase5.md) and [current handoff](current-handoff.md).

---

## 2026-09-19: Phase 5 launch plan and Firebase authentication

Phase 5 is now explicitly a launch/functionality phase rather than another UI
redesign pass. The approved dashboard is frozen unless a concrete bug or
explicit requested UI change requires touching it.

The production frontend now includes the Firebase Web SDK and reads the six
existing `VITE_FIREBASE_*` build variables. GitHub authentication uses
`GithubAuthProvider` with `signInWithPopup`; Email/Password signup and login
use Firebase's modular password APIs. No GitHub OAuth client secret was added to
frontend code or Cloudflare. Existing Google OAuth remains on the Cloudflare
Worker's Authorization Code + PKCE path.

Protected frontend routes currently accept either the existing first-party
Google Worker session or a Firebase client session. This is intentionally not
the final backend authority model: the next Phase 5 slice must verify/exchange
Firebase identity server-side and mint the same first-party Webcanbe session
before private product APIs are exposed.

The current Cloudflare Worker still serves only the authentication boundary;
the frontend already knows about catalog, purchases, workspaces, seller, and
control endpoints, but those product routes are not yet live in production.
The Phase 5 master plan therefore prioritizes identity unification first,
followed by real hosted product APIs, durable account/workspace state,
Marketplace/purchase/entitlement/materialization, payments, editor persistence,
seller pipeline connection, and launch hardening.

Focused inherited Phase 4/5 tests, Worker syntax verification, and the Vite
production build pass at this checkpoint. See
[Phase 5 plan](phase5.md) and [current handoff](current-handoff.md).

---

## 2026-09-17: Phase 3 promoted-release Listing publication

The seller pipeline now ends in a separate explicit Listing-publication
decision. The existing hosted session boundary authenticates the request, and
the PostgreSQL product store requires durable active operator authority before
reading protected lineage and again before returning from the transaction.

Publication accepts only an existing append-only promotion and its exact
immutable release. It verifies seller, active catalog, source project,
revision, content hash, and snapshot across the promotion, release, and catalog
records. A catalog-scoped lock plus unique promotion, catalog, release, Listing,
and operator/idempotency constraints creates one unambiguous Listing and one
immutable publication record atomically.

Normal seller metadata editing cannot create published state, promote a draft,
change published state, or swap the published release. The database also
refuses publication-record mutation and published release rebinding. Listing
metadata can still evolve without changing its source identity.

Promoted-but-unpublished releases remain outside browse/detail; the published
Listing appears through the existing hosted catalog read path with exact
release revision and snapshot provenance. Publication invokes no checkout,
payment provider, payout, entitlement, materialization, project creation,
network operation, or submitted-code execution.

Focused tests pass 4/4; TypeScript and build pass; the complete five-file
security diff scan reports zero unresolved findings. The full default
regression was not run. See the
[publication report](reports/phase3-listing-publication.md),
[evidence](reports/phase3-listing-publication-evidence/index.json), and
[current handoff](current-handoff.md).

---

## 2026-09-16: Phase 3 passed-assessment release promotion

The seller pipeline now has an explicit operator-authenticated promotion
decision. It accepts only an immutable assessment result whose terminal outcome
is `passed`, then verifies the complete submission, review, admission, lease,
worker generation, result, seller, and source snapshot lineage in one
PostgreSQL transaction.

Promotion reads the frozen files and history stored on the seller submission,
recomputes revision/content/snapshot integrity, and requires an active catalog
owned by that exact seller, workspace, and source project. It never reads or
changes current seller HEAD. The resulting `ProjectRelease` therefore preserves
the assessed snapshot even when the editable source changes later.

The append-only promotion record binds the operator and resulting release to
that exact lineage. Transaction locking plus unique result, release, catalog
version, and operator/idempotency constraints make exact replay idempotent and
conflicting promotion impossible. Database triggers keep both historical
promotion decisions and releases immutable.

No `Listing`, entitlement, payment, purchase, workspace copy, execution, or
network action is implicit. A promoted release remains non-public and
non-purchasable until a later separate listing decision. Focused tests pass
6/6; TypeScript and build pass; the complete five-file security diff scan
reports zero unresolved findings. The full default regression was not run. See
the [promotion report](reports/phase3-seller-release-promotion.md),
[evidence](reports/phase3-seller-release-promotion-evidence/index.json), and
[current handoff](current-handoff.md).

---

## 2026-09-16: Phase 3 isolated seller assessment worker

The seller pipeline now has a real out-of-process assessment worker without a
parallel execution architecture. It reads only the immutable submission bytes
bound to the current live assessment fence, revalidates their stored
history/content/snapshot provenance, and never substitutes current seller HEAD.

Static profile preparation remains inert in the server process. Production
execution is composed directly from the retained hosted Linux runner and
PostgreSQL runner-fencing store. The fixed semantic TypeScript command receives
a digest-bound snapshot with external networking denied and no secrets; the
existing pinned compiler, OS namespaces, cleared environment, fixed command,
resource/time limits, mTLS transport, cleanup, and orphan recovery remain the
enforcing boundary. No local or host-process fallback exists in production.

The worker renews its product lease, aborts on lost authority, and submits
bounded `passed`/`failed`/`errored` evidence only through the existing immutable
live-fence result API after cleanup. Stale, cancelled, expired, reclaimed, or
wrong-worker output cannot become accepted. Crash/restart recovery reuses the
existing lease expiry/reclaim generation and preserves the exact snapshot.

Focused tests pass 4/4, including a real child-process boundary check, exact
snapshot consumption after seller HEAD advances, default network denial,
fail-closed hosted isolation selection, timeout, cancellation, stale reclaim,
immutable result submission, and no publication side effects. TypeScript and
build pass; the complete five-file security diff scan found zero unresolved
items. The full default regression was not run. See the
[worker report](reports/phase3-isolated-assessment-worker.md),
[evidence](reports/phase3-isolated-assessment-worker-evidence/index.json), and
[current handoff](current-handoff.md).

---

## 2026-09-16: Phase 3 seller assessment result acceptance

The hosted seller assessment pipeline now has an immutable result-acceptance
boundary. An active server-provisioned worker may submit only while it owns the
exact current live job/submission/snapshot/generation fence. PostgreSQL locks,
database-clock expiry, credential rechecks, and a terminal conditional update
keep acceptance atomic with job completion.

Each server-generated result identity stores the submitted source revision,
content hash and snapshot, review decision, admitting operator and time, worker,
fence generation, `passed`/`failed`/`errored` outcome, bounded JSON metadata,
opaque artifact references, idempotency key, and completion time. The artifact
IDs do not confer authority. Results reject update/delete, and completed jobs
cannot renew, cancel, reclaim, or accept a conflicting outcome.

Canonicalized content plus the same idempotency key allows an exact duplicate
to return the original result across restart. Stale, expired, cancelled,
wrong-worker, cross-job, substituted-snapshot, fresh-key, and conflicting-
content deliveries refuse without changing history. The boundary performs no
submitted-code execution, package-manager/script/config/plugin/hook invocation,
network request, publication, entitlement, purchase, or materialization.

Focused tests pass 6/6; TypeScript and build pass; the complete four-file
security diff scan reports zero unresolved findings. The full default
regression was not run. See the
[result-acceptance report](reports/phase3-seller-assessment-result-acceptance.md),
[evidence](reports/phase3-seller-assessment-result-acceptance-evidence/index.json),
and [current handoff](current-handoff.md).

---

## 2026-09-16: Phase 3 seller assessment lease lifecycle

Already-claimed seller assessment jobs now support server-side renewal and
durable cancellation. Both operations authenticate the provisioned worker and
bind to the exact current job, submission, snapshot, worker owner, and fencing
generation under PostgreSQL transaction locks.

Renewal requires the lease to remain live at its conditional write and extends
only its database expiry. Cancellation requires the same live fence, persists a
terminal state/timestamp, and returns the same record for an identical valid
retry. A stale generation, expired lease, competing worker, or substituted
identity refuses. Claim, renewal, and fence assertion all reject cancellation,
so a cancelled job cannot later be reclaimed or treated as runnable.

PostgreSQL preserves the lifecycle state across restart, constrains valid state
and cancellation-time combinations, and prevents mutation of copied assessment
provenance or a terminal record. The code adds no execution, package-manager,
uploaded-script/config/plugin/hook, network, publication, entitlement, or
materialization side effect. Focused tests pass 5/5; TypeScript and build pass;
the complete four-file security diff scan reports zero unresolved findings. The
full default regression was not run. See the
[lease-lifecycle report](reports/phase3-seller-assessment-lease-lifecycle.md),
[evidence](reports/phase3-seller-assessment-lease-lifecycle-evidence/index.json),
and [current handoff](current-handoff.md).

---

## 2026-09-16: Phase 3 seller assessment leasing

Immutable `requested` assessment jobs can now be claimed by a server-provisioned
worker under a durable PostgreSQL lease. Worker credentials are returned only
by the trusted provisioning seam and persisted only as SHA-256 digests; no
browser controller route accepts worker claims or client-supplied authority.

Every lease copies the request's exact submission, seller, source
project/revision/content, and snapshot provenance. Transaction serialization
prevents two live owners. PostgreSQL's clock controls expiry, and reclaim keeps
the same provenance while increasing a monotonic fencing generation. The
explicit fence assertion rejects expired, replaced, cross-job, cross-seller,
cross-submission, and substituted-snapshot ownership.

Requested jobs and active leases survive store/process restart. Claiming only
changes lease database state and performs no submitted-code execution, package
manager or uploaded hook invocation, external network access, publication,
entitlement grant, or materialization. Focused tests pass 5/5; TypeScript and
build pass; the focused four-file security diff review reports zero unresolved
findings. The full default regression was not run. See the
[assessment-leasing report](reports/phase3-seller-assessment-leasing.md),
[evidence](reports/phase3-seller-assessment-leasing-evidence/index.json), and
[current handoff](current-handoff.md).

---

## 2026-09-16: Phase 3 seller assessment admission

Approved seller submissions can now enter the future assessment pipeline only
through an active product operator and an immutable `approved_for_next_stage`
review decision. Admission reuses the existing authenticated hosted controller
and stores one separate `requested` record; client IDs remain expected
references, never authority.

The request binds seller, submission, source project/revision/content/snapshot,
and review-decision provenance. The store verifies the decision's complete
copied provenance against the immutable submission, serializes duplicate
admission, returns identical requests idempotently, and refuses conflicting
seller, submission, decision, snapshot, or key reuse. PostgreSQL rejects request
update and deletion.

This is a data-only admission record. It invokes no worker, submitted code,
package manager, uploaded hook/config, network, publication, entitlement, or
workspace-copy path. Focused tests pass 4/4; TypeScript and build pass; the
complete five-file security diff review reports zero unresolved findings. The
full default regression was not run. See the
[assessment-admission report](reports/phase3-seller-assessment-admission.md),
[evidence](reports/phase3-seller-assessment-admission-evidence/index.json), and
[current handoff](current-handoff.md).

---

## 2026-09-16: Phase 3 seller quarantine review foundation

The hosted seller intake now has an operator-only quarantine queue and an
immutable review-decision record. Queue list/inspect and decision creation reuse
the existing hosted authentication/session boundary and durable product
operator capability; clients cannot supply a reviewer or administrator claim.
The queue returns only review metadata and exact submitted provenance.

A decision records either `approved_for_next_stage` or `rejected` against the
exact immutable submission snapshot. Submission locking, expected-snapshot
matching, idempotency constraints, one-decision-per-submission uniqueness, and
database update/delete refusal preserve history. Conflicting retries and
cross-submission substitutions refuse.

Neither decision changes the permanent `pending_review` quarantine boundary or
creates a catalog project, release, listing, entitlement, materialization, build,
or execution path. Focused tests pass 4/4; TypeScript and build pass; the complete
five-file security diff review reports zero unresolved findings. The full
default regression was not run. See the
[quarantine-review report](reports/phase3-seller-quarantine-review.md),
[evidence](reports/phase3-seller-quarantine-review-evidence/index.json), and
[current handoff](current-handoff.md).

---

## 2026-09-16: Phase 3 seller intake foundation

The hosted product backend now provides the first real seller-side boundary:
session-bound seller applications begin pending, durable product operators may
approve or reject them, and only the approved application owner may submit a
currently authorized project revision. Rejection of an approved application
prevents new submissions.

Submissions reuse the existing hosted project/source/revision authority and
freeze exact files, history, revision, content hash, and snapshot hash. The
snapshot row is database-immutable; its separate state row begins only as
`pending_review`. A later source revision receives a new submission identity.
No catalog project, release, listing, entitlement, materialized copy, or
execution job is created implicitly.

Seller-intake-only tests pass 4/4; TypeScript and build pass; the complete
five-file security diff review reports zero unresolved findings. The full
default regression was not run. Payments remain Phase 5, and landing, buyer
routes, product-domain purchase semantics, Phase 2, and main are unchanged. See
the [seller-intake report](reports/phase3-seller-intake.md),
[evidence](reports/phase3-seller-intake-evidence/index.json), and
[current handoff](current-handoff.md).

---

## 2026-09-16: Phase 3 hosted product route integration

The existing product routes now use the Stage-B authenticated hosted product
controller in hosted mode without a route redesign. Browse and listing detail
read authoritative hosted catalog data; the existing action creates or reuses
an operator-authorized TEST entitlement and materializes it through the
idempotent controller contract; My Projects lists owned workspace copies and
purchase entitlements as separate concepts.

The browser adapter sends no identity, membership, workspace-authority, or
operator assertions. The server binds TEST self-grants to the authenticated
user while retaining the durable operator check, chooses only authenticated
workspace results, rechecks project authority for My Projects, and preserves
the existing immutable release and exact source-provenance contract.

Focused route/controller verification passes 12/12; TypeScript and build pass;
the complete six-file security diff review reports zero unresolved findings.
The full default regression was not rerun. The landing page, Stage-B product
semantics, Phase-3 foundation, Phase 2, and main are unchanged. See the
[route-integration report](reports/phase3-product-route-integration.md),
[evidence](reports/phase3-product-route-integration-evidence/index.json), and
[current handoff](current-handoff.md).

---

## 2026-09-16: Phase 3 hosted product

The `phase-3-hosted-product` branch continues the frozen Phase-3 foundation
`5cdd40cd5e9ff08d3e1c3aeb3f670e0bf7ed5fdf`. Stage A ports the long Mainline
homepage to the existing React 19/Vite/Tailwind application without Next.js and
without changing product routes. Stage B adds the authenticated hosted product
controller, PostgreSQL persistence, server-provisioned TEST operator authority,
and bounded restart reconciliation for pending entitlement materializations.

The existing session/membership/project checks remain authoritative. Immutable
release snapshots retain exact source revision/content lineage; working copies
reuse `wcb_projects`, preserve `releaseOrigin`, and stay distinct from purchase
entitlements. Cross-user and cross-workspace attempts refuse.

Focused verification is 18/18; TypeScript/build pass; the changed-surface
security scan reports zero unresolved findings. The single preserved default
run remains 686/687 because an untouched Phase-2 Vite cache directory was still
being populated during `afterEach` cleanup. The exact failed test then passed
1/1 serialized. Per the approved closure policy, the full suite was not rerun,
the preserved run is not called green, and no Phase-2 code changed. See the
[hosted-product report](reports/phase3-hosted-product.md),
[evidence](reports/phase3-hosted-product-evidence/index.json), and
[current handoff](current-handoff.md).

---

## 2026-09-16: Phase 3 product-domain foundation

Phase 3 begins from the exact frozen Phase-2 closure
`545eb5b388c9062fc46361cd62e74a78466bd095` on the new
`phase-3-product-foundation` branch. The first marketplace backend slice is
complete: catalog projects publish byte-exact immutable releases; listings can
change independently; internal TEST entitlements remain separate from editable
workspace copies; and an authorized entitlement materializes one idempotent
copy through the existing project/source/revision system with exact provenance.

The acceptance flow and negative authority cases pass 10/10 focused tests. The
full default regression passes 679 tests with 61 existing environment-gated
skips; TypeScript and production build pass. Changed-surface security review has
zero unresolved reportable findings. No payment provider, final marketplace UI,
or public HTTP controller is included. See the
[Phase-3 foundation report](reports/phase3-product-foundation.md) and
[current handoff](current-handoff.md). Phase-2 and main remain unchanged.

---

# P61 narrow follow-up — 2026-09-15

P61 remains PARTIAL only because the retained historical second-app 422 has no
internal exception/stage evidence and did not reproduce. Exact frozen Zustand now
passes ordinary packaged hosted capture: cold start 4216.40 ms, first raster
2992.70 ms, warm raster 2116.48 ms under the unchanged 4000 ms bound. Reviewed
manifest probe `b7c8f8bc` was cherry-picked as `901ba83`; general worker selection
tracking removes the measured absent-selection overhead. One A → B → A diagnostic
passed every stage; 43 targeted tests pass. Prior bounded load reused, full 646
regression deferred. See [closure report](reports/phase2-p61-closure.md).
Internal blockers remain P05 / P39 / P61; main unchanged.

---

# Historical P61 bounded checkpoint — 2026-09-15

**P61 PARTIAL. Internal blockers: P05 / P39 / P61. Phase 2 internal closure: NOT YET.**
Continue on `phase-2-compatible-editor`; product remains `427c77be667c620a65a290ffa4f77fb97ab7950c`.
See [P61 report](reports/phase2-p61-closure.md) and [P61 evidence](reports/phase2-p61-evidence/index.json).
- Unchanged Zustand now refuses earlier at unsupported `rel="manifest"` HTML validation:
  84.59–97.80 ms startup, no raster reached. Historical 4000 ms failure remains open.
- Original two-app scenario and A → B → A load updates pass, but the historical
  second-app 422 has no established root cause; retained as a blocker.
- One bounded load passes: 2 users/3 projects/concurrency 2, 167 operations,
  145 success/22 expected refusals/0 unexpected; 58.01 seconds; jobs/leases return to zero.
- 19 targeted P61 tests pass. 646-test full regression execution deferred to final
  Phase-2 closure; no prior test identity was removed or intentionally modified.
- Production implementation unchanged; only bounded QA/evidence/docs added.
  No P05/P39 work, matrix rebuild, broad scan, later phases, payments or final UI.
  Normal feature-branch-only publication; main unchanged.

---

# P39 checkpoint — 2026-09-15

P39 remains **PARTIAL** at product `a531b323f8160eeed80e3b67077512f76d165bff`.
[Closure report](reports/phase2-p39-closure.md) and
[evidence index](reports/phase2-p39-evidence/index.json).
Composition/focus invalidation and replay hardening, bounded real Chromium AX
observations and sustained hosted renewal/reconnect evidence are complete as documented.
Actual OS IME completion and full interactive screen-reader/accessibility remain open;
the read-only snapshot does not close the latter. 646 distinct passes preserve all
prior 621 identities; one full suite plus bounded corrections. P39-only security
review has zero confirmed unresolved vulnerabilities. TEST cleanup complete.
Internal blockers remain P05 / P39 / P61; Phase 2 internal software closure NOT YET.
Main unchanged; feature-branch-only normal publication. Historical records below preserved.

---

# WebCanBe project record

## 2026-09-15: P06 closed

P06 PASS at `47a97751eee352643ff704886ac1392a812c43a7`: actual canonical nested source directories and
independent exact-ZIP application builds using the trusted finite Rollup helper.
621 distinct passing tests preserve all prior 594 identities and 38 unchanged test files.
Bounded changed-path security review: zero confirmed unresolved vulnerabilities.
See [closure report](reports/phase2-p06-closure.md) and [current handoff](current-handoff.md).
Only P06's ledger row changes; internal blockers are P05/P39/P61 and Phase 2 internal
closure remains NOT YET. Historical evidence preserved; no later-phase/UI/payment work.

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


## 2026-09-13: Phase 2C isolated HTTP prototype and safe admission blocker

Continued the existing recovery branch from b4438a999ccd98e391dd5f2670d4deeb897e0870, preserving and repairing the audited partial compiler edit. No project restart, main change, original iCloud change or framework upgrade. See [complete report](reports/phase2c-http-preview.md) for exact files, threat boundary, test commands, screenshots, external-candidate versions, security review and publication record.

The unchanged BrowserRouter HTTP prototype passes authored root/nested/parameter/query/anchor/basename/assets/history/refresh/transaction/export checks, with independent isolated export builds and uncoupled desktop/mobile renders. HTTP remains unreachable from the editor because native-sandbox Chromium's CSP did not block WebRTC traffic. No approved runner was substituted by an unsafe flag. Unit suite: 95 passing including all existing 69; TypeScript/build and existing HashRouter/Field Notes regressions pass. Full BrowserRouter editor UI and compatible independent external-project acceptance remain open. Manual security review was performed; Codex Security did not run. The approved overlay/message fixes, focused regressions and all failed probes are disclosed in the report.

Historical blanket offline/network-isolation language is qualified by the new self-navigation/WebRTC probes. Existing opaque-origin/resource CSP/mutation controls remain, but they do not establish hosted hostile-code isolation.

Phase 2C NOT YET. Overall Phase 2 NOT YET. Public hosted import ready NO. The full product-experience/navigation/seller/footer/Docs plan is preserved, together with broader dependencies/configs/Tailwind, responsive authoring, semantic gestures, editable Code UI, durable/multi-file history, imported HMR and hosted ownership/resource isolation. This runtime checkpoint does not replace or complete any of those requirements.

Publication receipt: implementation/validation checkpoint `4a6520f795e52bff2ccebabd1ea13274dfe85466` was normally pushed to `origin/phase-2-compatible-editor` and its exact remote tip verified. Main remained `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. The accompanying receipt changes documentation only. HTTP remains disabled; Phase 2C NOT YET, overall Phase 2 NOT YET, public hosted import ready NO. Work stops here without a speculative WebRTC workaround.


## 2026-09-13: Phase 2C.1 controlled browser boundary foundation

See [Phase 2C.1 report](reports/phase2c1-network-isolation.md) and current handoff. The safe checkpoint and remote were verified before work. Browser controls failed reproducible RTC/STUN/TURN/remote-ICE network probes; separate origins and media permissions do not supply zero egress. Strict arbitrary JavaScript execution must move into a controlled browser/network job with mediated display/input. Moving only the HTTP server would not close the boundary.

The dormant controlled transport now binds immutable artifacts and server-authorized session/generation/revision leases, denies external network capability and separates raster output from executable app bytes. No concrete isolation provider or public viewer is installed; test doubles do not prove network/process isolation. BrowserRouter HTTP remains disabled. All original tests and the existing HashRouter/Field Notes workflows are preserved; final evidence is in the report. No platform secret or mutation authority enters the preview job. Phase 2C.1 NOT YET; Phase 2C NOT YET; overall Phase 2 NOT YET; public hosted import ready NO. Existing broader product requirements are unchanged.


## 2026-09-13: Phase 2C.2 first real local controlled runner

The [Phase 2C.2 report](reports/phase2c2-controlled-runner.md) records the clean `6b43dce` baseline, actual OS boundary and sanitized negative/positive evidence. A project-local no-mount Lima VM runs Chromium and its supervisor inside private Linux namespaces and a bounded systemd cgroup. The existing controlled broker now serves an authenticated raster/selection/input path to a separate-origin trusted viewer. Project JavaScript never reaches the ordinary browser in strict mode; credentials/source-write authority never enter the job.

Local controlled-runner and BrowserRouter checkpoints PASS, including nested/deep-link/history/basename/assets/404, visual source changes/diff/undo/redo/export, real network/process/filesystem/resource/expiry/revoke checks and all preserved browser regressions. 116 tests include the original 108. Default non-strict Blob compatibility remains qualified; raw HTTP admission stays disabled without the server-selected controlled provider. Overall Phase 2 NOT YET; public hosted imports NO. Main and broader product scope are untouched. No paid or hosted infrastructure was required.


## 2026-09-13: Phase 2D/E Code ↔ Canvas and durable source history

Local targeted checkpoint PASS; overall Phase 2 NOT YET; public hosted imports NO. Clean starting local/live branch was `66403284303f12cfdc38139c4d81780ef63b131a`. Implementation/verification commit is `390d1f09a1bd50b062a80483c80bbffb96e7a10a`; the accompanying report/handoff is a separate branch commit. Main remains `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. See the [complete report](reports/phase2de-code-canvas-history.md) and [evidence receipt](reports/phase2de-evidence/verification-results.json).

CodeMirror direct editing and Visual editing now share the existing authorized transaction model, unique source revisions, expected hashes and idempotency. Code acceptance refreshes source analysis/anchors and the controlled raster preview while preserving route/viewport and invalidating stale selections. A private JSON ledger outside source exports persists mixed history and inverse evidence; a fsynced journal recovers multi-file source changes and a SQLite process lease serializes competing registries. Undo/revert creates a current-base inverse, preserves unrelated files and refuses same-file conflicts. Invalid local drafts retain the accepted source/preview. Accepted source/history survives actual server restarts; memory-only unsaved drafts do not.

All original 116 tests retained unchanged; 145 tests pass. TypeScript/build, real controlled-runner isolation/resource regressions, legacy HashRouter/Field Notes, controlled BrowserRouter, new Code/Canvas/strict HashRouter/restart/file-operation acceptance and independent final exported build/render pass. SIGKILL tests cover journal/partial-source/committed-ledger recovery. Original runner/compiler/profile/fixture implementations are unchanged. No active preview jobs remained; the existing local VM was stopped. No external security audit, hosted readiness, main merge, paid infrastructure or deployment is claimed.

Still open: broader CSS/Tailwind/source analysis, full responsive authoring, semantic gestures, true imported HMR, broader runtime/configuration profiles, hosted ownership/scheduling/storage/resource isolation, external-project/security audit, history compaction/recovery UX and the full final product/experience/Marketplace/AI/seller/payment/admin plan. The report documents conservative reverts, source-only editing scope, configured compiler validation and draft durability limits. This checkpoint supersedes historical statements that Code and history are wholly unimplemented without deleting their broader remaining requirements.


## 2026-09-14: Phase 2F responsive and semantic source authoring

Local bounded checkpoint PASS; overall Phase 2 NOT YET; public hosted imports NO. Starting clean/live tip was `fac8339e86ca2e0a6395f73b922917fdc1a41de6`; implementation `1a825e9b9107840a0faf00c24b9754f6c5fd3527`, final invalid-viewport guard `247d8ec83af3a83b766228f6325b2dd5983ec5e1`. Main remains `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. See the [complete report](reports/phase2f-responsive-semantic-authoring.md) and current handoff.

The existing source adapter and transaction/runtime boundaries now support project-responsive origin analysis, explicit breakpoint/scope controls, broader bounded utility properties, safe local literal-data tracing and adjacent Flex/Grid JSX reorder. Source files and durable history remain authoritative; no coordinate model or second history. Complex cascade/dynamic/shared cases fail closed with Code access. @theme breakpoint analysis is not new runtime/configuration admission. All original 145 tests are retained unchanged in a passing 196-test suite; TypeScript/build, real runner probes, all retained browser suites, responsive router/restart/undo workflows and independent export builds/renders pass. No third-party project or external security audit is claimed.

Broader compatibility, actual imported HMR, hosted ownership/scheduling/storage/cookie/resource isolation, production hosted provider, independently authored project validation and final audit remain open. The full product plan, final Phase 4 UI, AI, Marketplace/seller/payment/admin/collaboration/experience/navigation/footer/Docs scope is unchanged. No public deployment, main merge, force push or paid infrastructure.


## 2026-09-14: Phase 2G.1 hosted foundation, incremental preview and runtime profiles

Bounded local checkpoint PASS; overall Phase 2 NOT YET; public hosted imports NO. Started clean/live at `52ada8d8a4a6d618d2b7202ec5780166fe35733a`, with the expected Phase 2F ancestry. Implementation `401450f88162d46c1291544d4b8f101e5702d993`; main stays `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. Only the feature branch is published. See the [complete report](reports/phase2g1-hosted-foundation-hmr-profiles.md), evidence and current handoff.

Actual local SQLite auth/membership/artifact/lease adapters and injected source/history/provider boundaries establish opaque project/workspace/account ownership, cookie/CSRF sessions, owner/editor/viewer roles, fresh authorization/revocation, digest-bound artifacts and bounded scheduling/recovery/quarantine around the retained real Lima provider. The source remains real files under the existing durable transaction/adapter/runtime boundaries. No hosted identity login, distributed store/scheduler or cloud secret service is claimed; runtime secrets default to none. Hosted editor/viewer cookie-site policy is explicit, but deployed DNS/TLS/cookie/CDN/CSP isolation remains UNPROVEN.

Imported CSS hot updates retain component state; React modules use cached incremental rebuild + document reload in the same controlled job, and structural/config changes restart the generation. React Fast Refresh is not implemented. New named React 18/Vite 5 and React 19/Vite 8 profiles add bounded static configuration, CSS-first literal themes, Zustand/NanoID and two unchanged licensed official Vite starter templates. Original profile and all 196 original unit tests are unchanged. The starters are independent templates, not broad external full-product compatibility evidence. Vite 5 dev-server advisories are disclosed; no uploaded dev server runs and independent config execution remains sandbox-only.

263 tests, TypeScript/build, actual runner egress/process/filesystem/resource probes, both router regressions, Code/Canvas/history/crash/restart, unchanged responsive/semantic acceptance, hosted-style real SQLite/HTTP/Lima and six separate export builds/renders pass. New tests include real scheduler SIGKILL, journal/history storage failures, revocation during commit/diagnostic validation, denied cross-user/workspace operations and scheduling fault cases. Browser harness restart expectations were explicitly superseded with stronger revision/state checks. Active/pending jobs were zero; VM stopped. No real credentials, private source, QA artifacts, VM state or personal paths were included in outgoing commits.

Phase 2G.2 must still supply real hosted identity/durable stores/provider and multi-host fencing/recovery, actual editor/viewer DNS/TLS/cookies, real tenant/resource/security acceptance, broader unchanged full-project evidence, retained HMR/configuration/source-authoring/history gaps and the final external audit. The entire final Phase 4 UI, AI, Marketplace/seller/reviewer/admin/bigperson/payments/collaboration/experience/navigation/footer/Docs plan remains intact. No main merge, public deployment, purchase or scope reduction.


## 2026-09-14: Phase 2G.2 hosted adapters and final closure audit

**Final closure checkpoint NOT YET; overall Phase 2 NOT YET; public hosted imports NO.** Starting clean/live feature tip `cac7b3abe33a26dcb4f5110b67a8433840960b95`, expected direct implementation parent `401450f88162d46c1291544d4b8f101e5702d993`. Phase 2G.2 implementation **077223d15dea834afdfeb018a7d3e80fab7edeb4**; documentation/evidence are a separate normal feature-branch commit. Main/remote HEAD remain `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. See the [complete 64-row historical closure matrix](reports/phase2g2-final-closure.md) and current handoff.

Portable signed OIDC/PKCE login, server-owned identity mapping, durable PostgreSQL sessions/source/history/artifacts/fencing and an mTLS fixed-command Linux runner provider now have real local database/TLS/native-browser integration evidence. Source/ledger acceptance remains atomic; authorization is fresh and tenant scoped; controller epochs and cleanup/quarantine remain outside process-local authority. Actual A SIGKILL/B takeover/late-A denial passed. The retained Lima isolation policy was rerun. However, the existing synchronous editor API is not yet composed with these asynchronous hosted adapters; no end-to-end hosted application or production identity/cloud/DNS proof is claimed.

Opt-in true React 18/19 Fast Refresh preserves component state in the isolated runner for unchanged component-only graphs; CSS hot update, incremental rebuild/document reload and generation restart remain accurately classified. Four fixed independent unchanged full applications were attempted with provenance/failures preserved; none rendered under current profiles. Static .mts/.cts intake parity and core-first profile diagnostics improve safe support without rewriting upstream source or relaxing policy. Remaining full-project editing/history/export and broader authoring/profile gaps are explicit.

All 263 prior tests are unchanged within 305 distinct passing tests. TypeScript/build/package, actual OS probes, five retained browser suites, local distinct-site TLS/cookie/CSRF and six independent export builds/renders pass. Separate security review actually used Codex Security Standard, found/remediated six issues and recorded partial coverage plus the tool's changing-snapshot warning. Independent final-code reread/digest verification is distinguished from the original scan snapshot; no professional penetration test is claimed. Local leases/jobs/tunnels/gateway and test credentials were cleaned up; VM stopped. No secrets/private source/personal paths/VM state are published.

The smallest next software action is async hosted editor/API composition with real two-user/two-project HTTP acceptance. Additional internal requirements and unchanged corpus failures remain; real infrastructure is not the only blocker. Later external proof requires operator-provided OIDC, private durable PostgreSQL/PITR, authorized isolated hosts and separate HTTPS DNS/cookie sites. No purchase, credentials creation, DNS change, force push, main merge or public launch. All Phase 3/4/5 and deferred product requirements remain intact.


## 2026-09-14: Phase 2G.2 asynchronous hosted editor continuation

**Async hosted composition checkpoint PASS on local TEST infrastructure; overall Phase2 NOT YET; public hosted imports NO.** Started clean on the expected/live feature tip `65005b3822418594dd95ca826e8ff90b912c8df3`; main/remote HEAD remain `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. This does not begin Phase3. See the [complete updated P01–P64 matrix](reports/phase2g2-final-closure.md), [prior adapter closure preserved verbatim](reports/phase2g2-adapter-closure.md) and [publication receipt](reports/phase2g2-evidence/async-publication.json).

The exact packaged HTTPS CLI composes signed OIDC/PG session/membership/source/history/drafts/artifacts/leases with the actual hosted mTLS Linux provider. Disposable private checkouts adapt synchronous source authoring; PostgreSQL alone owns hosted accepted source/history and scheduler authority. Two users/workspaces/projects complete Code/Visual/history/preview/input/export; adversarial references/roles/revocation/CAS/restart/actual SIGKILL/storage faults/fencing/late-result/cleanup quarantine pass. React18/19 component Code and Visual refresh preserve state; CSS/reload/restart remain separately classified. Production OIDC/PG-PITR/cloud/DNS proof remains external.

Added acknowledged draft recovery and atomic Save all, safe new CSS-media/Tailwind-variant construction, bounded Unicode/key input, DOM-only instrumentation and finite React18/Vite4/SWC/Three profile, periodic orphan recovery and finite task-exhaustion proof. All four exact unchanged projects remain in the matrix. Zustand progresses to accepted Code/Visual source, exact history/restart and independently building export, but its real3D capture still times out; the other three fail intake/profile/config. No upstream compatibility rewrites and no full unchanged application PASS.

All305 prior tests unchanged within325 distinct passes. TypeScript/build/package, retained browsers/TLS, real PG/OIDC/mTLS/fencing/crash/refresh/OS tests and eight independent export build/render jobs pass. Task limit denies after182 children with verified reaping; memory and65111ms watchdog proofs pass. Actual Codex Security diff review found a P2 async compiler-admission race, which was fixed, regression-tested and independently reread after sealing the original scan. Complete changed-surface review is not a whole-repository or professional/production security attestation.

Internal profiles/config/origins/cascade/gestures/import rewrite/semantic TS/external ingestion/history archival/refresh/input/operational quotas/secrets/full-app/performance gaps remain; production credentials alone cannot close Phase2. External production identity, durable PG/PITR, real separate HTTPS sites, isolated multi-host outage/capacity and security evidence remain distinct. Local TEST jobs/gateway/tunnels/generated PKI/config/schema/password cleaned and VM stopped. Only normal feature-branch commits/push; no main merge, force push, public deployment, purchase or account action. All later product scope retained.


## 2026-09-14: Phase 2 unchanged common React/Vite application compatibility

Bounded checkpoint NOT YET; one complete unchanged full application (9bzero/kanban-board), target at least two not met. Overall Phase 2 NOT YET; public imports NO; Phase 3 may not begin. Continued exact async composition checkpoint in the same recovery worktree. Implementation223a604 and reviewed peer-lock/QA correctiona0899ca are normal feature commits; main unchanged. [Complete report/current P01–P64 matrix](reports/phase2-common-applications.md), [publication/cleanup](reports/phase2-common-applications-evidence/publication.json).

Two versioned common profiles, exact dependency/peer lock verification, finite static config/theme/metadata interpretation, nonfetching CSS URL preservation and exact-pixel raster queue stability improve general application support. Original four pinned projects and all failures preserved. Two MIT additions frozen before implementation; Kanban proves actual rendered interaction, mapped Visual and direct Code edits, responsive behavior, history/undo-redo/crashreconnect/exact export and independent isolated build/render. Recipe's editing stages succeed but required external assets remain blocked, so no full PASS. Zustand's original ordinary4scapture failure persists despite diagnostic extended rendering; no timeout-only fix or scene rewrite.

All325originaltests/assertions and fouroldprofilelocks unchanged;341 distinctpasses with16newfocusedregressions, explicit defaultskips accounted separately. Default/PG/mTLS/packagedhosted/browser/TLS/native/export evidence retained. Fresh immutable23file CodexSecurity review sealed with0 confirmedvulnerabilities; peer-lock and QA/documentation corrections separately tested and independently reread. Local timings/resources and everyattemptfailure recorded without production capacity claims.

Internal compatibility/origins/cascade/gestures/importrewrite/semanticTS/Git/history/refresh/input/quotas/secrets/fullapp/performance gaps remain separate from external productionIdP/PGPITR/HTTPSDNS/multihost/security evidence. AllPhase 3/4/5finalproductscope preserved. No public deployment, mainmerge, forcepush, purchase, DNS or account changes. OwnedTESTcleanup and outgoingaudit documented separately.


## 2026-09-15: Phase 2 final internal closure attempt

Implementation `2d0087ac8a009af36dd43023e988f7dfdcbd6e69` continues the existing feature branch from `13871b0311c09ae07d9a8bb3e8598f46a9d38f6c`. The [full final report](reports/phase2-final-internal-closure.md) retains all64 requirement texts: **45 PASS / 6 PARTIAL / 1 FAIL / 12 EXTERNAL-EVIDENCE**. Internal closure and overall Phase2 remain **NOT YET**; public hosted import and Phase3 start remain **NO**. Two complete unchanged MIT applications now pass: Kanban and independently frozen Habit Tracker. All original failures are retained.

General changes close source origins/cascade/semantic gestures/source moves, isolated TypeScript and fixed immutable GitHub intake, safe refresh, and internal archive/migration/restore/resource/managed-preview-value seams. Real clipboard/Unicode/queue/reconnect improves P39 without claiming OS IME or full accessibility. Normal hosted Zustand and intermittent concurrent warm-update reliability remain open. Exact internal rows are P05/P06/P07/P08/P39/P61; P64 is deferred original later-phase scope, not an implementation target.

All prior341 tests/assertions preserved;429 distinctPASS, zero outstanding skipped identities. Retained browser/TLS/native/export coverage passes. Fresh Codex Security scan `61a31df3-9d69-4431-80d8-05ea621329d2` covers all74 changed paths at the immutable implementation, with zero confirmed unresolved vulnerabilities; subsequent changes are documentation/evidence only. No professional penetration-test or production evidence claim. Owned TEST infrastructure cleaned; normal feature-only publication, main unchanged `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. See [publication](reports/phase2-final-internal-evidence/publication.json) and [cleanup](reports/phase2-final-internal-evidence/cleanup.json).


## 2026-09-15: P05–P08 compatibility breadth closure

Continued0f33e11 with product implementationbc19fac8d91d7360c409285e8613509c3c4e7404; [dedicated report](reports/phase2-compatibility-breadth-closure.md) and current final ledger are authoritative. P05/P06/P08 remain PARTIAL with exact finite format/graph/config/Uno blockers; P07 PASS for scoped public values, inert intake breadth and separate trusted static asset caching. No uploaded config/manager/lifecycle execution, host fallback, source rewrite, runner egress opening or limit inflation.

Unchanged Redux remains intake/graph blocked; Bulletproof and Todo progress to intake PASS with graph/config blockers. Recipe now passes all compatibility stages through actual packaged PG/mTLS rendering,38 required cached resources and exact67-file export. Native exact artifact proves denied external egress; optional favicon and upstream React19 console warning retained. Existing Kanban/Habit complete workflow evidence is unchanged; no new complete editing-workflow claim.

549 distinct tests include every prior429 identity;30 prior files remain byte-exact.45 default skips all pass in native/hosted groups. Five browsers and type/build checks pass. Codex Security32-path frozen scan found one low resource-copy issue, fixed and reviewed on final paths;0 confirmed unresolved vulnerabilities. A blocked stress attempt is disclosed without timing/crash claims. Every historical/harness failure remains visible, including one unexplained concurrent-run422; no P61 load closure is inferred.

P39/P61 and all external obligations/P64 are retained unchanged. Matrix46PASS/5PARTIAL/1deferredFAIL/12EXTERNAL; Phase2 internal/overall closure NOT YET, public hosted import NO, Phase3 eligibility NO. Owned TEST infrastructure cleaned and VM stopped; only normal feature branch publication, main unchanged.


## 2026-09-15: P05/P06/P08 final compatibility edge checkpoint

Started from verified clean `982625986289baf8101a7d73c96fe47ce0602f0d`; final product `775f9b67ed3aa9e0465fed446029ee5502192b2a`. [Current report](reports/phase2-compatibility-edge-closure.md) and [evidence](reports/phase2-compatibility-edge-evidence/index.json) record **P05 PARTIAL, P06 PARTIAL, P08 PASS; P07 regression PASS**. Main remains dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b. Normal feature-only publication follows documentation/evidence.

General npm alias identity support, confined non-root Vite relationships, finite production Rollup plan/helper and pinned Uno65/forms1/directives/variant groups/dark media adapters added. Source/export bytes and execution/archive boundaries preserved. Berry/workspace/non-npm/binary Bun/exact graph/inert tooling edges remain P05; separate nested source trees and complete independent export build composition remain P06. Todo's undeclared runtime alias and forms1/Uno66 peer conflict remain explicit upstream issues.

Affected frozen apps retain exact hashes: Redux intake fails; Bulletproof/Todo intake passes, graph/config failures prevent compilation/runtime/render. Shared Recipe input compiles byte-exact to its prior artifact; retained P07 native/cache/export proof remains valid. Every prior 549 test identity survives within 594 distinct passes; all 45 default skips separately covered. Type/build/package and native authored CSS render pass. Immutable 12-path security review and independent final corrective rereads leave zero confirmed unresolved vulnerabilities; no professional penetration-test or load claim.

Only the three authorized ledger rows change: matrix 47 PASS / 4 PARTIAL / 1 deferred FAIL / 12 EXTERNAL. Internal P05/P06/P39/P61 and external obligations remain; Phase 2 internal/overall closure NOT YET, Phase 3 eligibility NO. Historical reports/profiles and other rows are retained. Owned TEST jobs/services/tunnels/schema/password/keys cleaned, VM stopped; no main merge, force push, public deployment or later-phase scope.
