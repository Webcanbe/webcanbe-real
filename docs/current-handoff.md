# Phase 3 final sprint Pass 1 — product residual completion — 2026-09-17

**PASS. WebCanBe Ready qualification, the minimum Creator Studio backend, and
distinct Share / Export / Deploy product contracts now reuse the retained
hosted authority and immutable source/product lineage. No payment, real deploy
provider, Marketplace publication, entitlement, or code-execution side effect
was added.**

Continue only from the published `phase-3-hosted-product` branch. This bounded
pass began at `ecd0fe1e96e13beb8008dc78d8ea36f445ade8d0`; main remains
`dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. See the
[Pass 1 report](reports/phase3-final-sprint-pass1.md) and
[machine evidence](reports/phase3-final-sprint-pass1-evidence/index.json).

- An active server-side operator can qualify exactly one promoted immutable
  release against its exact accepted `passed` assessment result. The store
  revalidates release/promotion/result project, revision, content, and snapshot
  lineage, derives Ready/partial/code-only from the retained static
  compatibility analyzer, and writes append-only qualification evidence.
- An authenticated approved seller can read one seller-scoped Creator Studio
  aggregate and update only mutable metadata on their own published Listings.
  Worker/fence credentials and cross-seller records are excluded; release,
  publication, review, assessment, and qualification provenance cannot change.
- Project owners can create bounded view/edit shares backed by exact tracked
  workspace/project membership epochs and revoke those grants idempotently.
  Existing independent recipient authority is refused so revocation cannot
  erase or confuse unrelated access.
- Authorized workspace source can be exported only at the exact current
  revision through the retained Phase-2 safe ZIP exporter. The response binds
  project/workspace/revision/content/archive digests and release provenance.
- Deploy remains an immutable, inert intent tied to the authenticated requester,
  workspace project, and exact current revision/content digest. It has no
  provider integration, credential surface, execution, publication, or money
  movement.
- Focused verification passes 5/5; TypeScript and production build pass. The
  complete six-file focused security diff scan found zero findings and zero
  unresolved items. The full default regression was not run.

Next bounded task: implement the operator-only Admin/Control read and
state-transition backend over existing product records without adding payment
or UI work.

---

# Phase 3 non-executing seller GitHub admission — 2026-09-17

**GITHUB IMPORT ADMISSION PASS. An authenticated approved seller can admit one
public GitHub repository archive pinned to a full immutable commit and exact
SHA-256 digest into an authorized workspace. The validated source enters the
existing pending-review quarantine path without execution or publication.**

Continue only from the published `phase-3-hosted-product` branch. This bounded
pass began at `e6a146ee8f87ff55bde73111009ce94b618361c7`; main remains
`dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. See the
[GitHub admission report](reports/phase3-seller-github-admission.md) and
[machine evidence](reports/phase3-seller-github-admission-evidence/index.json).

- The authenticated hosted controller accepts only a canonical repository,
  full lowercase 40-hex commit, exact 64-hex expected archive digest, and
  seller/workspace references. It refuses arbitrary URL fields and moving refs.
- The server-controlled GitHub adapter alone constructs the fixed
  `codeload.github.com` request. It refuses redirects and encoded responses,
  validates and pins public DNS addresses, bounds headers/bytes/time, and
  verifies the fetched archive digest before returning bytes.
- The store verifies approved-seller ownership and workspace authority before
  the fetch and again in the commit transaction. It rechecks adapter origin and
  archive digest, then feeds bytes through the same ZIP safety boundary proven
  by seller ZIP admission and safely strips only one canonical codeload root.
- One transaction creates the existing hosted source/revision, immutable
  pending-review submission, ZIP admission, and immutable GitHub provenance.
  Repository, commit, archive, source, snapshot, and submission identities stay
  exact. Exact replay is idempotent; conflicting digest or context refuses.
- Admission runs no package manager, uploaded code/config/plugin/hook, network
  selected by the client, assessment, publication, entitlement, workspace
  materialization, checkout, payment, or payout action.
- Focused verification passes 4/4; TypeScript and production build pass. The
  complete six-file security diff scan found zero findings and zero unresolved
  items. The full default regression was not run.

Next bounded task: define the smallest WebCanBe Ready certification-evidence
contract over immutable assessment results, without changing assessment
execution, Listing publication, entitlements, or payments.

---

# Phase 3 non-executing seller ZIP admission — 2026-09-17

**ZIP IMPORT ADMISSION PASS. An authenticated approved seller can admit one
bounded, inert ZIP into an authorized workspace, producing exactly one hosted
source revision and immutable pending-review seller submission with exact
archive digest provenance. No uploaded code executes and nothing is published.**

Continue only from the published `phase-3-hosted-product` branch. This bounded
pass began at `df98e5f10a28e5771fe18e4ba7f2718b74111a4f`; main remains
`dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. See the
[ZIP admission report](reports/phase3-seller-zip-admission.md) and
[machine evidence](reports/phase3-seller-zip-admission-evidence/index.json).

- The authenticated hosted controller accepts a strictly shaped, bounded
  base64 ZIP request. The product store checks the current session, ownership
  of an approved seller application, and active workspace authority before
  archive inflation, then locks and rechecks the same authority at commit.
- Intake reuses the existing Phase-2 lazy `yauzl` boundary and limits. Absolute,
  traversal, non-NFC/control/invalid, case-normalized duplicate/conflicting,
  symlink/non-file, encrypted, malformed, oversized, excessive-count, excessive
  total/member, high-ratio, checksum-invalid, and invalid-text inputs refuse.
- One PostgreSQL transaction creates the existing hosted source project and
  revision, immutable seller submission, `pending_review` state, and immutable
  archive admission record. Archive ID/name/byte length/SHA-256, seller,
  workspace, source revision/content/snapshot, submission, and timestamp stay
  exact. Same seller/workspace/archive replay is idempotent; changed keys or
  workspace/seller context conflict or deny.
- Admission evaluates/imports no JS/TS/config/plugin, starts no process or
  package manager, performs no network access, and creates no assessment,
  release, Listing, entitlement, workspace copy, checkout, or payment state.
- Focused verification passes 4/4; TypeScript and production build pass. The
  focused six-file security scan found zero findings. Its immutable snapshot
  preceded the final authority-narrowing replay-context change; that two-line
  delta was manually reviewed and the focused tests rerun green. Security
  unresolved is zero. The full default regression was not run.

Next bounded task: implement a non-executing seller GitHub import admission
contract pinned to an immutable commit and archive digest, reusing this same
source/quarantine path without starting WebCanBe Ready.

---

# Phase 3 promoted-release Listing publication — 2026-09-17

**LISTING PUBLICATION PASS. An explicitly authenticated active product
operator can publish exactly one public `Listing` from exactly one already-
promoted immutable `ProjectRelease`. Seller/client input cannot publish or
rebind a Listing, and publication creates no money, entitlement, workspace, or
execution side effect.**

Continue only from the published `phase-3-hosted-product` branch. This bounded
pass began at `c1babdd86dbdfbab4843fe126a2d6414578452ab`; main remains
`dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. See the
[publication report](reports/phase3-listing-publication.md) and
[machine evidence](reports/phase3-listing-publication-evidence/index.json).

- The existing authenticated controller accepts only publication references
  and bounded Listing metadata. Durable active product-operator authority is
  checked inside the transaction before protected reads and before return.
- Publication joins the append-only promotion, immutable release, and active
  catalog. Seller, catalog, source project/revision/content, and snapshot
  provenance must agree exactly; raw, unpromoted, substituted, or cross-tenant
  references refuse.
- One catalog-scoped transaction creates the public Listing and immutable
  publication decision. Unique promotion/catalog/release/listing/key
  constraints make exact replay idempotent and conflicts unambiguous.
- The retained seller metadata route can no longer create a published Listing,
  transition a draft to published, change a published Listing's status, or
  swap its release. Marketplace metadata remains editable on the same binding.
- A promoted release without a Listing stays absent from public browse/detail.
  After publication, the existing hosted read paths expose the exact release,
  revision, and snapshot lineage without UI redesign.
- Focused verification passes 4/4; TypeScript and production build pass. The
  complete five-file security diff scan found zero findings and zero unresolved
  items. The full default regression was not run.

Next bounded task: implement a non-executing seller ZIP-import admission
contract that reuses existing source/revision quarantine and freezes exact
provenance before review.

---

# Phase 3 passed-assessment release promotion — 2026-09-16

**RELEASE PROMOTION PASS. An explicitly authenticated active product operator
can promote exactly one accepted `passed` assessment result into exactly one
immutable `ProjectRelease` copied from the frozen seller submission. Listing
publication, purchasability, payments, and entitlements remain separate and
non-automatic.**

Continue only from the published `phase-3-hosted-product` branch. This bounded
pass began at `7335204d594a76ce75b4fda33b5357bd306d8021`; main remains
`dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. See the
[promotion report](reports/phase3-seller-release-promotion.md) and
[machine evidence](reports/phase3-seller-release-promotion-evidence/index.json).

- The authenticated HTTP action accepts references only. Durable active
  product-operator authority is checked inside the transaction before access
  and again before return; a client flag cannot assert authority.
- Promotion joins the immutable result, assessment request, seller submission,
  review decision, and completed lease. Every seller/source/revision/content/
  snapshot/job/result/worker/generation reference must agree, and the result
  outcome must be exactly `passed`.
- The target active catalog must belong to the assessed seller, workspace, and
  source project. Stored submission history/content/snapshot integrity is
  recomputed before release creation; current seller HEAD is never read.
- One transaction creates the immutable release and append-only promotion
  record. A per-result lock and database uniqueness make an exact duplicate
  idempotent while conflicting result, key, version, seller, submission,
  snapshot, job, or catalog attempts refuse.
- Promotion creates no `Listing`, entitlement, payment, purchase, workspace
  copy, network request, package-manager action, or code execution, and does
  not modify seller HEAD. The release is therefore not automatically public or
  purchasable.
- Focused verification passes 6/6; TypeScript and production build pass. The
  complete five-file security diff scan found zero findings and zero unresolved
  items. The full default regression was not run.

Next bounded task: implement an explicit operator-authenticated Listing
publication decision for one promoted immutable `ProjectRelease`, without
payment or entitlement side effects.

---

# Phase 3 isolated seller assessment worker — 2026-09-16

**ISOLATED ASSESSMENT WORKER PASS. A server-provisioned worker holding the
exact current live assessment fence can run the existing fixed semantic check
on the immutable submitted snapshot in the existing hosted Linux isolation
boundary, then submit only through immutable result acceptance. No release,
listing, entitlement, or purchase is created.**

Continue only from the published `phase-3-hosted-product` branch. This bounded
pass began at `15b8f4a2254d81cb11e0d502f47f6b1274145d73`; main remains
`dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. See the
[worker report](reports/phase3-isolated-assessment-worker.md) and
[machine evidence](reports/phase3-isolated-assessment-worker-evidence/index.json).

- A live-fence-only snapshot read authenticates the provisioned worker and
  verifies the job, submission, seller, source revision/content, immutable
  history, snapshot digest, worker owner, and fencing generation in PostgreSQL.
- The worker stages only those frozen bytes for the existing static runtime
  admission. Uploaded Vite/TypeScript configuration is parsed as bounded data;
  no uploaded configuration, plugin, hook, script, or package manager runs in
  the web/server process.
- Production composition is hardwired to the retained
  `HostedLinuxRunnerProvider` plus `PostgresLeaseStore`. The assessment job uses
  the existing fixed `semantic-typescript-v1` command, pinned checker, mTLS
  gateway, OS namespaces, cleared environment, external-network denial,
  resource ceilings, deadline, durable runner fencing, and verified cleanup.
  There is no production host/local execution fallback.
- The worker renews its assessment lease while active, aborts when renewal or
  authority fails, bounds execution, and closes the isolated allocation before
  result acceptance. Cancellation, expiry, reclaim, or worker revocation makes
  stale output fail the existing immutable acceptance boundary.
- Outcomes are only `passed`, `failed`, or `errored` assessment evidence with
  bounded diagnostics. They do not create a release/listing, grant an
  entitlement, make anything purchasable, or materialize a workspace project.
- Focused verification passes 4/4; TypeScript and production build pass. The
  complete five-file security diff scan found zero findings and zero unresolved
  items. No live cloud-host assertion is added; the full default regression was
  not run.

Next bounded task: add an explicit operator-authenticated promotion decision
that can create one immutable `ProjectRelease` from a passed assessment result,
while keeping Listing publication separate and non-automatic.

---

# Phase 3 seller assessment result acceptance — 2026-09-16

**ASSESSMENT RESULT ACCEPTANCE PASS. A server-provisioned worker holding the
exact current live lease fence can atomically store one immutable, snapshot-
bound terminal assessment outcome. Exact replay is idempotent; stale,
cancelled, expired, substituted, wrong-worker, and conflicting delivery refuse.
This slice does not execute submitted code or publish a product.**

Continue only from the published `phase-3-hosted-product` branch. This bounded
pass began at `ba9bc31f0e6460832fb063cd4b63b893b07cc3fc`; main remains
`dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. See the
[result-acceptance report](reports/phase3-seller-assessment-result-acceptance.md)
and [machine evidence](reports/phase3-seller-assessment-result-acceptance-evidence/index.json).

- Acceptance authenticates the active provisioned worker and requires the
  exact job, submission, snapshot, worker owner, and current lease generation.
  The lease must remain database-clock live at the terminal conditional update.
- One transaction stores a server-generated result identity and atomically
  moves the lease from `leased` to durable terminal `completed`.
- The result copies exact seller/source revision/content/snapshot provenance,
  review-decision and admission lineage, worker, generation, outcome, bounded
  metadata, reference-only artifact IDs, idempotency key, and completion time.
- Outcomes are `passed`, `failed`, or `errored`; none is a publication or
  approval decision. One immutable result is allowed per job generation.
- Canonical metadata and sorted references make exact same-key replay stable.
  Different content or key for the completed attempt conflicts and cannot
  rewrite the immutable row.
- No browser result route, in-process execution, package manager, uploaded
  hook/config/plugin, network access, release/listing, entitlement, purchase,
  or workspace-copy side effect exists in this slice.
- Focused verification passes 6/6; TypeScript and production build pass. The
  complete four-file security diff scan found zero unresolved findings. The
  full default regression was not run.

Next bounded task: implement an out-of-process isolated assessment worker that
consumes the exact leased snapshot and submits through this result boundary,
without release/listing publication.

---

# Phase 3 seller assessment lease lifecycle — 2026-09-16

**ASSESSMENT LEASE LIFECYCLE PASS. The exact current live worker fence can
renew an assessment lease or durably cancel it. Cancellation is terminal across
restart; stale, expired, competing, and substituted fences refuse. This slice
still performs no submitted-code execution or publication.**

Continue only from the published `phase-3-hosted-product` branch. This bounded
pass began at `f364e58b6fb5758a5b18ebecc813b6c14961d11f`; main remains
`dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. See the
[lease-lifecycle report](reports/phase3-seller-assessment-lease-lifecycle.md)
and [machine evidence](reports/phase3-seller-assessment-lease-lifecycle-evidence/index.json).

- Renewal requires an active server-provisioned worker credential plus the
  exact job, submission, snapshot, worker owner, and current generation. Both
  the locked read and conditional update require a database-clock-live lease.
- Renewal changes only expiry. It preserves job identity, worker, generation,
  claimed time, and all immutable seller/source/snapshot provenance.
- Cancellation requires the same exact live fence and records a durable
  `cancelled` state and timestamp. An identical authenticated retry returns the
  same cancellation record without another mutation.
- Cancelled rows cannot renew, satisfy the live fence, or be reclaimed by the
  claim path after expiry. PostgreSQL constraints and a provenance/terminality
  trigger preserve the historical record across restart.
- The lifecycle seam remains server-only and has no browser controller route.
  It executes no submitted code, package manager, uploaded hook/config/plugin,
  or network operation and creates no release, listing, entitlement, or copy.
- Focused verification passes 5/5; TypeScript and production build pass. The
  complete four-file security diff scan found zero unresolved findings. The
  full default regression was not run.

Next bounded task: implement immutable assessment-result acceptance guarded by
the current live lease fence, without in-process submitted-code execution or
release/listing publication.

---

# Phase 3 seller assessment leasing — 2026-09-16

**ASSESSMENT LEASING PASS. Requested assessment jobs now have restart-safe,
server-side worker claims with exclusive live leases, database-clock expiry,
monotonic reclaim fencing, and exact immutable snapshot provenance. This slice
still performs no submitted-code execution or publication.**

Continue only from the published `phase-3-hosted-product` branch. This bounded
pass began at `ce5a064ba06227a9e7e3162229188df9f2cecc1a`; main remains
`dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. See the
[assessment-leasing report](reports/phase3-seller-assessment-leasing.md) and
[machine evidence](reports/phase3-seller-assessment-leasing-evidence/index.json).

- Workers are provisioned only through a trusted server seam. PostgreSQL stores
  only the SHA-256 credential digest, and the browser product controller has no
  assessment-claim endpoint.
- Claim admission revalidates the immutable `requested` assessment record, its
  `approved_for_next_stage` decision, and exact submission, seller, source
  project/revision/content, and snapshot provenance.
- An advisory transaction lock plus one lease row per assessment request gives
  one live owner. A duplicate claim by that owner returns the same lease; a
  competing worker cannot steal it.
- PostgreSQL's clock determines live/expired state. Expiry permits a bounded
  reclaim that preserves provenance and increments a monotonic generation, so
  stale workers and later stale results are rejectable through the mandatory
  fence check.
- Requested jobs and live lease rows persist across store/process restart. No
  claim path executes code, invokes a package manager or uploaded hook, accesses
  the network, publishes a release/listing, grants an entitlement, or creates a
  workspace copy.
- Focused verification passes 5/5; TypeScript and production build pass. The
  focused four-file security diff review found zero unresolved findings. The
  full default regression was not run.

Next bounded task: implement live-fence-guarded lease renewal and cancellation
transitions for claimed assessment jobs, still without executing submitted
code.

---

# Phase 3 seller assessment admission — 2026-09-16

**ASSESSMENT ADMISSION PASS. An active product operator can admit only an
`approved_for_next_stage` immutable seller submission into one snapshot-bound,
non-executing assessment request. The request does not build, run, fetch,
publish, entitle, or materialize anything.**

Continue only from the published `phase-3-hosted-product` branch. This bounded
pass began at `af00daf79fa94defd348c1643932f76c0fe4bb7a`; main remains
`dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. See the
[assessment-admission report](reports/phase3-seller-assessment-admission.md) and
[machine evidence](reports/phase3-seller-assessment-admission-evidence/index.json).

- The new authenticated controller route accepts only submission, seller,
  snapshot, review-decision, and idempotency references. Durable active product
  operator authority is checked inside the PostgreSQL transaction.
- Admission requires the submission's immutable decision to be exactly
  `approved_for_next_stage`. Pending and rejected submissions refuse.
- The stored request copies and binds submission ID, seller ID, source project,
  source revision, source content hash, submission snapshot hash, review
  decision ID, `requested` status, admitting operator, and creation time.
- Full decision provenance is compared against the immutable submission before
  insert. Same-snapshot cross-seller, cross-submission, decision, snapshot, and
  idempotency-key substitutions refuse.
- One request per submission/decision is returned idempotently. PostgreSQL
  rejects request update or deletion, leaving future execution state to a
  separate isolated boundary.
- The admission path contains no subprocess, package-manager, uploaded hook or
  config execution, external network, checkout/materialization, public product,
  or entitlement operation.
- Focused verification passes 4/4; TypeScript and production build pass. A
  complete five-file security diff review found zero unresolved findings. The
  full default regression was not run.

Next bounded task: implement restart-safe server-side leasing and claiming for
`requested` assessment jobs while preserving snapshot binding and still
performing no submitted-code execution.

---

# Phase 3 seller quarantine review foundation — 2026-09-16

**QUARANTINE REVIEW FOUNDATION PASS. Privileged operators can read the
metadata-only seller quarantine queue and append one immutable, exact-snapshot
review decision. Approval only means approved for a later stage: it does not
publish, build, execute, list, release, entitle, or materialize anything.**

Continue only from the published `phase-3-hosted-product` branch. This bounded
pass began at `aba9d0f7abc64d782ab3620218ddfa63136b8d0a`; main remains
`dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. See the
[quarantine-review report](reports/phase3-seller-quarantine-review.md) and
[machine evidence](reports/phase3-seller-quarantine-review-evidence/index.json).

- Queue list and inspect routes reuse the existing authenticated hosted product
  controller. Each transaction requires a fresh active session and durable
  active product-operator row; ordinary users and sellers refuse.
- Queue output is restricted to submission/seller identity, exact source
  project/revision/content/snapshot provenance, status, timestamps, and an
  existing decision. Stored source files/history and authority internals are
  not returned.
- Each decision is bound to the submitted snapshot hash and copies its exact
  provenance. Identical retries return the original record; idempotency-key
  reuse for different input, a different snapshot, or a conflicting later
  decision refuses.
- PostgreSQL permits only one decision per submission and rejects decision-row
  update or deletion. Submission source snapshots retain their existing
  immutable database boundary.
- Both `approved_for_next_stage` and `rejected` remain quarantined and
  non-public. No catalog project, ProjectRelease, Listing, entitlement,
  materialization, build, or execution side effect exists in this slice.
- Focused verification passes 4/4; TypeScript and production build pass. A
  complete five-file security diff review found zero unresolved findings. The
  full default regression was not run.

Next bounded task: implement snapshot-bound admission of only
`approved_for_next_stage` submissions into an isolated assessment-job request,
without executing the job or publishing a release.

---

# Phase 3 seller intake foundation — 2026-09-16

**SELLER INTAKE PASS. Seller application → operator-approved seller identity →
immutable source submission → non-public pending-review quarantine is complete
on `phase-3-hosted-product`. Payments remain Phase 5. Buyer routes, landing,
entitlement/materialization semantics, Phase 2, and main are unchanged.**

Continue only from the published `phase-3-hosted-product` branch. This bounded
pass began at `4ede26c09a7e197294a5a170309cfe4c82fb1c9f`; main remains
`dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. See the
[seller-intake report](reports/phase3-seller-intake.md) and
[machine evidence](reports/phase3-seller-intake-evidence/index.json).

- Seller applications are session-bound and begin `pending`. Only a durable,
  server-provisioned product operator can approve or reject them. Rejection of
  an approved seller acts as revocation for new submissions.
- Only the approved application owner can submit. Application, workspace, and
  source-project IDs remain references; fresh existing session, workspace,
  project-role, and source-revision authority is required.
- Each submission freezes the exact authorized `wcb_projects` files, history,
  source revision, source content hash, and snapshot hash. Immutable provenance
  is stored separately from the mutable review-state record, so later source
  edits require a new submission identity.
- Every new submission begins `pending_review`. Submission creates no catalog
  project, ProjectRelease, Listing, entitlement, buyer copy, or execution job.
- Seller-intake-only verification passes 4/4; TypeScript and production build
  pass. A complete five-file security diff review found zero unresolved
  findings. The full default regression was not run.

Next bounded task: add an operator-authenticated review-decision record and
read-only quarantine queue for submitted snapshots, without executing project
code or publishing an approved release.

---

# Phase 3 hosted product route integration — 2026-09-16

**ROUTE INTEGRATION PASS. Existing browse, listing detail, TEST purchase,
materialization, My Projects, and workspace access now use the authenticated
hosted product controller on `phase-3-hosted-product`. The landing page and
product-domain semantics are unchanged.**

Continue only from the published `phase-3-hosted-product` branch. This bounded
pass began at the pushed Stage-B checkpoint
`3d4053427a2db3196174acf2aeffddb77373686e`; main remains
`dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. See the
[route-integration report](reports/phase3-product-route-integration.md) and
[machine evidence](reports/phase3-product-route-integration-evidence/index.json).

- Hosted browse and listing detail read through the existing authenticated
  product controller. Local static data remains only for the existing
  non-hosted UI mode.
- The existing action creates or reuses an active TEST entitlement through a
  server-bound self-beneficiary route. Durable product-operator authority is
  still mandatory; the client cannot submit user, membership, or operator
  claims.
- Materialization uses a workspace returned by the existing authenticated
  workspace controller and the existing idempotent entitlement-copy contract.
  The returned authoritative WorkspaceProject ID opens the retained hosted
  editor route.
- My Projects reads owned materialized copies separately from purchase
  entitlements. The PostgreSQL list is user-filtered and every result receives
  the existing fresh project/session/membership authorization check.
- Focused verification passes 12/12; TypeScript and production build pass. A
  complete six-file security diff review found zero unresolved findings.
- The full default regression was not run, as explicitly required. The prior
  preserved Stage-B truth remains 686/687 with the unrelated Phase-2 temporary
  cache cleanup-race exception; it is not relabeled green.

Next bounded task: add a verified payment-provider event adapter that grants or
transitions the existing provider-agnostic entitlement contract without
changing materialization, provenance, or tenant-authority semantics.

---

# Phase 3 hosted product — 2026-09-16

**STAGE B PRODUCT STATUS PASS. Hosted PostgreSQL product persistence,
authenticated HTTP authority, operator-only TEST entitlement transitions, and
restart-safe materialization reconciliation are complete on
`phase-3-hosted-product`. Stage A is frozen at `f8e03a6`; Phase 2, the Phase-3
foundation, and main remain unchanged.**

Continue only from the published `phase-3-hosted-product` branch. The exact
foundation base is `5cdd40cd5e9ff08d3e1c3aeb3f670e0bf7ed5fdf`; main remains
`dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. See the
[hosted-product report](reports/phase3-hosted-product.md) and
[machine evidence](reports/phase3-hosted-product-evidence/index.json).

- The existing product-domain contract now persists CatalogProject,
  immutable ProjectRelease snapshots, Listing, LicenseEntitlement, and
  materialization provenance in PostgreSQL while editable copies remain in the
  existing `wcb_projects` source/history store.
- The hosted controller reuses the Phase-2 TLS/origin/cookie/CSRF session
  boundary and current membership/project authority. IDs remain references.
- TEST grant/revoke/invalidate operations require an active, server-provisioned
  product operator. Clients cannot self-assert operator authority.
- Pending materializations retain a stable copy identity and reconcile in a
  bounded, idempotent startup/periodic pass. Current entitlement state,
  workspace membership, snapshot integrity, and exact provenance are rechecked.
- Focused Stage A/Foundation/Stage B verification is 18/18; TypeScript and the
  production build pass. The focused security scan found zero unresolved
  reportable findings.
- The one preserved full default run remains **686/687**, with 61 skips. Its
  only failure was an untouched Phase-2 `afterEach` Vite temporary-cache cleanup
  race (`ENOTEMPTY` at `src/webcanbe-engine/phase2de.test.ts:16`), not a product
  assertion. Under the user-approved closure policy, the exact failing test was
  rerun alone in one Node worker and passed 1/1; the full suite was not rerun and
  is not relabeled green. No Phase-2 code changed.
- Real payments and all later Phase-3 areas remain out of scope for this pass.

Next bounded task: connect the existing browse, purchase, and workspace-project
product routes to the authenticated hosted product controller without changing
the landing page or product-domain semantics.

---

# Phase 3 product-domain foundation — 2026-09-16

**PHASE3_FOUNDATION PASS. Catalog/listing → immutable release → internal TEST
entitlement → authorized editable WorkspaceProject is proven end to end. The
frozen Phase-2 branch and main are unchanged.**

Continue only from the published `phase-3-product-foundation` branch, based
exactly on Phase-2 closure `545eb5b388c9062fc46361cd62e74a78466bd095`.
Do not resume ordinary development on `phase-2-compatible-editor`, merge to
main, or reopen the deferred P39/P61 residuals. The detailed design and evidence
are in [the Phase-3 foundation report](reports/phase3-product-foundation.md).

- The canonical product domain is `CatalogProject`, immutable
  `ProjectRelease`, independently mutable `Listing`, provider-agnostic
  `LicenseEntitlement`, and owned `WorkspaceProject`. Releases and working
  copies reuse the existing project/source/revision infrastructure.
- A release stores a byte-exact accepted source snapshot and its source project,
  revision, content, and snapshot hashes. SQLite triggers reject release update
  or deletion; a new accepted source revision requires a new release identity.
- Public catalog browse/search/tag filtering and listing detail expose only
  published, available listings and carry exact listing → release → source
  lineage.
- TEST entitlement grant, purchase listing, and working-copy materialization
  are distinct operations. Materialization is idempotent, binds exactly one
  entitlement to one copy, and stores immutable release provenance in the copy's
  root revision. Later edits affect only the copy.
- Active session, workspace membership, source/revision grant, entitlement
  owner, and copy ownership are checked server-side. Cross-user, cross-workspace,
  guessed-ID, revoked, and invalid-entitlement cases refuse.
- Verification: Phase-3 focused tests 10/10; full default suite 679 passed with
  61 pre-existing environment-gated skips; TypeScript PASS; production build
  PASS. Changed-surface security review found 0 unresolved reportable findings.
- This pass is a backend/service foundation with single-host SQLite product
  persistence; it intentionally does not add real payment processing, final UI,
  or a public HTTP controller.
- Next bounded task: add hosted PostgreSQL persistence and an authenticated HTTP
  controller for this exact contract, including restart-safe reconciliation of
  pending entitlement materializations and an explicit operator capability for
  TEST entitlement grant/revocation.

---

# Phase 2 final reconciliation — 2026-09-16

**P05 PASS. P61 PASS at the retained internal local-TEST measurement boundary.
P39 PARTIAL with native acceptance DEFERRED. Full regression 730/730. Practical
Phase 2 engineering: CLOSED. Strict Phase 2: NOT YET. Phase 3 may begin only
under the user's explicit decision to defer P39 native acceptance.**

Continue only from the final pushed `phase-2-compatible-editor` publication for
this run. Main remains `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b` and must
not be changed. The authoritative [final reconciliation](reports/phase2-final-reconciliation.md),
[64-row ledger](reports/phase2-final-internal-evidence/final-ledger.json) and
[machine evidence](reports/phase2-final-reconciliation-evidence/index.json)
supersede older status summaries while preserving their receipts.

- Exact ledger: 50 PASS / 1 PARTIAL / 12 EXTERNAL-EVIDENCE / 1 retained
  deferred FAIL (P64).
- P39 remains PARTIAL: Native IME FAIL, VoiceOver FAIL, 28/30, native
  acceptance DEFERRED. The residual is physical native macOS IME lifecycle and
  real interactive VoiceOver cursor/activation/focus/screen-reader semantics.
- P61 is PASS only at its retained internal local-TEST measurement/evidence DoD.
  The historical second-app warm-update HTTP 422 remains a real unresolved
  historical anomaly; exact stage and root cause are UNPROVEN.
- The one final complete all-identity receipt is 730/730 across 88 suites. It
  used serialized shared runner/gateway infrastructure and the trusted installed
  Playwright module. The two stale P05 expectations now describe the accepted
  exact frozen inputs while malformed, tampered, substituted and untrusted lock
  refusals remain covered. TypeScript and build pass. All prior 730 identities
  are preserved.
- Changed-surface security review found zero unresolved reportable findings;
  its final manifest carries a non-empty worktree snapshot digest and valid
  artifact receipt references. This is not a penetration test or
  production-deployment proof.
- Under the original strict DoD, Phase 3 may not begin because P39 remains
  PARTIAL. Under the user's explicit P39 deferral, practical Phase 2 is closed
  and Phase 3 may begin. External production evidence remains incomplete across
  twelve rows and is not relabeled as internal failure.

---

# P05 final narrow follow-up — 2026-09-16

**P05 PASS. Internal blockers: P39 / P61. Phase 2 internal closure: NO.**

- The exact `@julr/unocss-preset-forms@1.0.0` zero-argument behavior is a fixed
  operator-owned rules/preflight adapter under the pinned UnoCSS 66.0.0 compiler.
  The project package remains an exact lock-attested configuration marker and is
  never executed; arbitrary arguments and substituted markers refuse.
- Exact unchanged Todo now passes Bun decode, trusted graph and Uno admission,
  representative forms CSS semantics, browser/export compilation, and byte-exact
  source/export preservation. `npx only-allow bun` never runs.
- Directly affected validation: 67/67 passes in 4 files; TypeScript passes. Prior
  evidence was reused, full 646+ remains deferred, and no prior test identity was
  removed or modified. Changed-path review found zero confirmed vulnerabilities.
- Remaining P05 blockers: NONE. P39 and P61 remain unchanged.
- Main unchanged; feature-only publication. No P39/P61 or later-phase work.

See [P05 report](reports/phase2-p05-closure.md) and
[targeted evidence](reports/phase2-p05-evidence/targeted-tests.json).

---

# P61 bounded checkpoint — 2026-09-15

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

# Current handoff: P61 narrow follow-up (2026-09-15)

**P61 PARTIAL. Zustand PASS; prior bounded load PASS; historical second-app 422
stage/root cause UNPROVEN. Internal blockers: P05 / P39 / P61.**

Continue from the final pushed feature SHA recorded by the task publication on
`phase-2-compatible-editor`. See [P61 closure](reports/phase2-p61-closure.md) and
[P61 evidence](reports/phase2-p61-evidence/index.json). Main remains
`dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`.

- Cherry-picked reviewed manifest probe `b7c8f8bc` as `901ba83`; confined local
  inert manifests are stripped only from controlled preview HTML. Canonical and
  exported source stay exact; remote/protocol/traversing/variant forms refuse.
- Exact frozen Zustand passes packaged HTTPS/PG/mTLS: cold start 4216.40 ms,
  first raster 2992.70 ms, warm raster 2116.48 ms under unchanged 4000 ms bound.
  General fix skips a 2846.79 ms selection query when no selection exists.
- One instrumented A → B → A sequence passed all 16 stages and three independent
  artifact/owner/fence checks. Historical generic 422 did not reproduce; exact
  stage/root cause remain unprovable, so P61 remains PARTIAL with no speculative fix.
- 43 targeted tests pass; prior load reused, not rerun. Full 646 regression stays
  deferred. No P05/P39 work, matrix rebuild, broad scan or later-phase work.

---

# Current handoff: P39 partial closure (2026-09-15)

**P39 PARTIAL. 48 PASS / 3 PARTIAL / 1 deferred FAIL / 12 EXTERNAL-EVIDENCE.
Phase 2 internal software closure: NOT YET. Internal blockers: P05 / P39 / P61.**

Continue from P39 product `a531b323f8160eeed80e3b67077512f76d165bff` on `phase-2-compatible-editor`.
The [P39 report](reports/phase2-p39-closure.md),
[current ledger](reports/phase2-final-internal-evidence/final-ledger.json), and
[P39 evidence](reports/phase2-p39-evidence/index.json) are current authority.
Main remains `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`.

- Composition provenance/order/focus cancellation, immediate session invalidation,
  same-frame replay rejection, and bounded Chromium AX descriptions are implemented.
  Clipboard, Unicode, the 64-event queue and browser/runner isolation are preserved.
- Native OS IME remains unproven: the correct headed TEST window exposed macOS AX,
  but the bounded native-input attempt produced no composition events. CDP is not OS proof.
- Full screen-reader/accessibility remains open: the new snapshot is read-only;
  interactive remote semantics and a legitimate screen-reader integration are still needed.
- Sustained session/renewal PASS: 16 hosted iterations/renewals/reconnects, 16 Code and
  16 Visual edits, plus 12 actual viewer reconnects. Zero duplicate/stale delivery;
  49 expected authority/replay refusals. Worker jobs return to zero; viewer listeners
  remain 217 and nodes 333. This is bounded TEST evidence, not deployed capacity.
- 646 distinct passes; all prior 621 identities and 39 test files preserved.
  One full run plus bounded correction checks; initial failures remain recorded.
  TypeScript/build/package pass. P39 changed-path review: zero confirmed unresolved vulnerabilities.
- All 150 TEST leases stopped; services/tunnels/schema/PKI/password cleaned; VM stopped.
  No P05/P61 work, corpus rebuild, later phases, payments or final UI work.
  Only the feature branch is published; no main merge, force push or public deployment.

---

# Current handoff: P06 closure (2026-09-15)

**P06 PASS. 48 PASS / 3 PARTIAL / 1 deferred FAIL / 12 EXTERNAL-EVIDENCE.
Phase 2 internal software closure: NOT YET. Internal blockers: P05 / P39 / P61.**

Continue from final product `47a97751eee352643ff704886ac1392a812c43a7` on `phase-2-compatible-editor`.
The [P06 closure report](reports/phase2-p06-closure.md),
[current ledger](reports/phase2-final-internal-evidence/final-ledger.json) and
[P06 evidence](reports/phase2-p06-evidence/regressions.json) are authoritative.
Documentation/publication commits follow the product. Main remains
`dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b` (origin/main; no local main branch).

- Static nested roots use their actual canonical source paths through registry, local/PG
  revision/history, Visual/Code, semantic checking and exact export. No source mirror.
- Actual exported ZIPs reach the trusted independent production build and finite Rollup
  helper through both the export API and standalone QA gate. External imports/chunk options
  are proven. Preview still rejects reachable Node imports; Todo's missing alias is not invented.
- **621 distinct passing tests; all prior 594 identities and all 38 prior test files preserved.**
  Full suite ran once; two failures are recorded and bounded 68-test/41-test correction checks passed.
  No outstanding failures/skips. Final TypeScript/build/package pass.
- Parent changed-path security review: all 20 paths and direct consumers, final correction
  rereads, zero confirmed unresolved vulnerabilities. No broad repeated scan/corpus rebuild.
- P06 blockers: NONE. Every non-P06 ledger row and historical report is preserved.
  No P05/P39/P61, UI, payments, or Phase 3/4/5 work. TEST cleanup complete and VM stopped.
  Only a normal feature-branch push; no main merge, force push or public deployment.

---

## Historical handoffs

# Current handoff: Phase 2 narrow compatibility edges (2026-09-15)

**P05 PARTIAL / P06 PARTIAL / P08 PASS / P07 regression PASS. 47 PASS / 4 PARTIAL / 1 deferred FAIL / 12 EXTERNAL-EVIDENCE. Internal and overall Phase 2: NOT YET. Phase 3 may begin: NO.**

Continue from final product `775f9b67ed3aa9e0465fed446029ee5502192b2a`; the [edge closure report](reports/phase2-compatibility-edge-closure.md), [current ledger](reports/phase2-final-internal-evidence/final-ledger.json) and [edge evidence index](reports/phase2-compatibility-edge-evidence/index.json) are current authority. Documentation/evidence commits follow the product. The final task publication receipt identifies the pushed feature SHA. Main remains `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. Historical sections below remain intact.

- Closed the retained P08 finite forms/directives/variant-group/dark-media requirements with exact Uno65/forms1 and retained Uno66 operator graphs. Source/config/export bytes remain unchanged; no uploaded executable configuration or managers run.
- P05 adds npm protocol/scoped alias identity support. Remaining: Berry checksum/virtual peers; confined workspaces/non-npm protocols; binary Bun decoder/boundary; exact retained app graphs; general inert-tool role for oversized Redux Yarn. The 2 MiB member boundary is unchanged.
- P06 adds confined non-root Vite relationships within canonical src and finite Rollup build-plan/helper support. Remaining: separate nested source trees and full independent app export/build integration. Todo's TS alias lacks an actual runtime mechanism and remains an upstream incompatibility.
- Exact Redux intake fails; Bulletproof/Todo intake passes but dependencies/configuration still fail. Their compilation/runtime/render are not reached. Recipe's unchanged 67-file input produces the prior byte-exact HTML/36-file artifact; valid prior native/cache/export evidence is reused. P07 stays PASS.
- Every prior 549 test identity is preserved: 594 distinct passing tests, 45 new, all 45 default skips exercised separately, no outstanding skips. Build/package and authored native CSS render pass.
- Sealed immutable 12-path security review plus separate independent final correction rereads: zero confirmed unresolved vulnerabilities. Three compatibility defects fixed and tested; no broad repeated scan or production pentest claim.
- Only P05/P06/P08 ledger rows changed; all other requirement rows and old profiles are preserved. Internal blockers: P05/P06/P39/P61. No P39/P61 or Phase 3/4/5 work, main merge, public deployment or force push. Owned TEST services/tunnels/schema/password/PKI cleaned and VM stopped.

---

## Historical handoffs

# Current handoff: Phase 2 compatibility breadth (2026-09-15)

**P05 PARTIAL / P06 PARTIAL / P07 PASS / P08 PARTIAL. INTERNAL CLOSURE: NOT YET. MATRIX:46 PASS /5 PARTIAL /1 deferred later-phase FAIL /12 EXTERNAL-EVIDENCE. OVERALL PHASE2:NOT YET. PUBLIC HOSTED IMPORT:NO. PHASE3 MAY BEGIN:NO.**

Continue from product implementation `bc19fac8d91d7360c409285e8613509c3c4e7404` on `phase-2-compatible-editor`; base `0f33e11ea60ee4b69ed6a0de5144f73400fe5808`. Main remains `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. Use [the dedicated breadth report](reports/phase2-compatibility-breadth-closure.md), [current final ledger](reports/phase2-final-internal-evidence/final-ledger.json) and [breadth evidence index](reports/phase2-compatibility-breadth-evidence/index.json); do not rebuild P01–P64 or erase historical reports.

- General Yarn classic/Bun text graph adapters, finite HTML/Vite/TS aliases, Tailwind3/PostCSS/Uno workers, public-value provider and separate static-resource cache added. Exact source/config/export and all trust boundaries retained.
- P07 closes: Bulletproof/Todo archive intake now passes; unchanged Recipe passes packaged TLS/PG/mTLS import-to-render with38 cached images/fonts/CSS and exact67-file export. Exact native artifact proves no required-resource/page errors and ENETUNREACH direct external egress. Optional upstream favicon and React19 development console diagnostics remain disclosed. No extra complete editing-workflow claim.
- Remaining internal rows in this run:P05 Berry/alias/binary-Bun/unprovided graphs and oversized Redux tooling; P06 retained Rollup/root/ambiguous alias effects; P08 additional Uno forms/directives/variant-group/options/graphs. Exact finite blockers are in the report. P39/P61 remain byte-for-byte as retained; no deliberate work on them.
- All prior429 test identities preserved with30 old test files byte-exact;549 distinct passes.504 default plus45 separately covered native/hosted skips. Five browser groups, TypeScript/build and actual cached Recipe/native proof pass. One clock-generated OIDC title has explicit old/new labels; no test weakened.
- Codex Security scan28b26b91-59c0-412e-ba34-1ba51d8d55bb sealed32 candidate paths. One low algorithmic resource issue fixed; affected final paths independently reread;0 confirmed unresolved vulnerabilities. Stress reproduction was blocked and not retried. No professional pentest claim.
- Historical failures remain, including one unexplained packaged422 during simultaneous tests. No load/capacity claim. Corpus QA now materializes outside the repository with finally cleanup; product code did not change after its final review.
- Owned TEST31 leases/jobs/services/tunnels/schema/password/PKI/helpers cleaned; VM stopped. Final normal feature push/clean/main receipt is in task outputs. No main merge/public deployment/force push or later-phase scope work.

---

## Historical handoffs

# Current handoff: Phase 2 final internal closure attempt (2026-09-15)

**INTERNAL CLOSURE: NOT YET. COMMON-APPLICATION CHECKPOINT: PASS. TWO COMPLETE UNCHANGED APPLICATIONS. MATRIX: 45 PASS / 6 PARTIAL / 1 FAIL / 12 EXTERNAL-EVIDENCE. OVERALL PHASE 2: NOT YET. PUBLIC HOSTED IMPORT: NO. PHASE 3 MAY BEGIN: NO.**

Implementation `2d0087ac8a009af36dd43023e988f7dfdcbd6e69` continues `13871b0311c09ae07d9a8bb3e8598f46a9d38f6c` on the existing `phase-2-compatible-editor` branch. Main remains `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. The [final report and full unchanged-requirement P01–P64 matrix](reports/phase2-final-internal-closure.md), [final ledger](reports/phase2-final-internal-evidence/final-ledger.json), [evidence index](reports/phase2-final-internal-evidence/index.json) and [publication receipt](reports/phase2-final-internal-evidence/publication.json) are now authoritative. Earlier sections below are historical, not the current status.

- Closed P10/P12/P17/P18/P23/P25/P31/P57/P59 and internal software portions of P29/P51/P55 through general source-origin/cascade/gesture/move, isolated semantic checking, immutable intake, history archive/restore/migration, refresh, resource and managed-value seams.
- Two exact independently authored MIT apps pass full packaged HTTPS/PG/mTLS workflow and exact isolated export build/render/interaction: 9bzero/kanban-board (`83413e1f5fab4690bb46b23201a3438a427ef265`) and preselected TheUnknown550/Habit-Tracker-Web-App (`0a874ff471873cc662be5479f0cfe94f7c2d653e`). Original Redux/Bulletproof/Todo/Recipe/Zustand failures retained.
- All original 341 tests/assertions preserved. 429 distinct passes; default45 skips all exercised in native/hosted groups, none outstanding. Five retained browser groups, TLS/native OS, eight retained exports and both new final exports pass.
- Security scan `61a31df3-9d69-4431-80d8-05ea621329d2` sealed over base..implementation, all74 changed paths, zero confirmed unresolved vulnerabilities. Later changes are documentation/evidence only; not a professional penetration test.
- Exact internal rows: P05 Yarn/Bun/pinned graph and oversized Redux member; P06 custom mount/plugin/alias semantics; P07 public-env/file breadth and required remote-asset fetch/cache boundary; P08 Tailwind3/PostCSS/UnoCSS; P39 native OS IME/full accessibility/sustained session proof; P61 normal hosted Zustand4s and unexplained second-app warm-update422 plus sustained load. These are not production-credential blockers. Do not relabel them external or waive the DoD.
- External rows: P29/P41/P43/P45/P46/P48/P49/P50/P51/P52/P55/P56; exact finite production checklist is in the report. P64 remains FAIL/deferred Phase3/4/5 and is prohibited scope for this run.
- Owned TEST services/tunnels/credentials/schema/export helpers cleaned, all68 leases stopped, VM stopped. No code changes after security freeze. Do not repeatedly regenerate valid evidence or restart repository analysis; use the final ledger as the index.

---

## Historical handoffs

# Current handoff: Phase 2 unchanged common React/Vite applications (2026-09-14)

**COMMON-APPLICATION CHECKPOINT: NOT YET. COMPLETE UNCHANGED FULL-APPLICATION WORKFLOWS: 1 (9bzero/kanban-board). OVERALL PHASE2: NOT YET. PUBLIC HOSTED IMPORT READY: NO. PHASE3 MAY BEGIN: NO.**

Continued the completed async hosted composition checkpoint at `ceb95d2b473f6e6b0a03a413bd1c3ce0af509f34` in the existing recovery worktree. Implementation `223a604500912fed5c00ed2050cb535d57d5dd00`; reviewed peer-lock/QA correction `a0899cab6f4a4387116d58ae547230109be52774`. Main/remote HEAD remain `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. Only normal feature-branch publication. The [new complete report and current64-row P01–P64 matrix](reports/phase2-common-applications.md) are authoritative for this checkpoint; earlier handoffs/reports below remain historical. [Publication/cleanup receipt](reports/phase2-common-applications-evidence/publication.json).

- Added two immutable React18/Vite6 and React19/Vite7 common profiles, path-aware npm dependency/peer verification, finite static path/config/literal-theme support, bounded inert metadata policy and CSS resource preservation without a compiler fetch. All canonical initial bytes remain unchanged. Yarn/Bun/Tailwind3/PostCSS/UnoCSS and broader packages/config/env remain unsupported.
- Original four exact repositories/commits/scopes/hashes remain: Redux oversize bundled Yarn; Bulletproof env/template/file-type and profile/config failures; Todo binary lock/metadata and profile/config failures; Zustand ordinary4000ms capture timeout. No upstream rewrite, dropped file or replacement application.
- Exactly two MIT additions preselected before implementation. Kanban completes real packagedHTTPS→PG→mTLS rendering, card creation, actual viewer selection/source mapping/visibleVisual edit, directCode/CSS/responsive390/768/1280, accepted history/undo-redo/SIGKILLreconnect and exact16file independent building/rendering/interacting export. Its upstream mobile overlap remains disclosed.
- Recipe Book completes available-asset UI interaction/edit/history/restart/exact67file export/build, with corrected24/36/30px responsive heading proof, but required Cloudinary photos/Google fonts fail under default egress denial. It is **not** the second full PASS. No third addition selected. Target2 remains NOTYET.
- Zustand startup/WebGL/assets are not the observed capture blocker. Normal4screenshot fails in preview and export; longer15sdiagnostic renders original scene inabout4.1–4.2s, with CPU saturation/readback warnings and noOOM. Extended diagnosis does not change acceptance or P61 performance. Retained DOM-only instrumentation remains.
- All325 old tests unchanged;16 focused regressions produce341 distinctPASS (306default +23additional retainedPG/mTLS/refresh +12packagedhosted).35defaultskips are not passes. TypeScript/build, fivebrowsers, localTLS, nativeOS/task/memory/watchdog and eightretained isolatedexports pass. Final real-app timings/resource samples and every failed attempt are recorded.
- Fresh CodexSecurity23file immutable diff review sealed with0 confirmed vulnerabilities. Independent architecture/core/QA rereads identified and closed peer-lock completeness plus QA/documentation defects. Post-seal correction digests and test evidence are separate; no seal is claimed for another revision or production. Tool usage is recorded, not estimated.

**INTERNAL blockers remain:** P05–08package/profile/lock/config/env/CSS breadth and required external asset availability; P10/P12/P18origins/cascade/instances; P17gestures; P23importrewrite/sourcebreadth; P25semanticTS/productGit; P29historyarchival/migration/restoreUX; P31refreshgraph; P39IME/clipboard/accessibility/streaming/longsession/reconnect; P51/P61quotas/load/resources; P55managedsecretdelivery; P57/P59secondfullworkflow/originalcorpus; distinct3Dcapturelimit. **EXTERNAL:** productionIdP, real separateHTTPSDNS/proxy/CDN/cookies, deployedPGTLS/PITR/restore, isolatedmultihostoutage/capacity/secrets/security/professionalpentest evidence. Internal gaps are not credential blockers.

Next bounded engineering should address a concrete retained common-app blocker with a threat-reviewed solution, preserving default egress denial and exact source. Phase 3 product/Marketplace/Seller/Ready/GitHub/Admin backend, Phase 4 agreed finalUX/UI plus separateControlUI, and Phase 5AI/payments/productionhardening remain intact; none began. Verify fresh feature/main ancestry and clean tree before continuing. Owned TEST cleanup details are in the receipt; no new worktree/public deployment/main merge/force-push/purchase/DNS/account action.

---

# Current handoff: Phase 2G.2 async hosted editor composition (2026-09-14)

**PHASE 2G.2 ASYNC HOSTED COMPOSITION CHECKPOINT: PASS. OVERALL PHASE 2: NOT YET. PUBLIC HOSTED IMPORT READY: NO.**

This continues Phase2G.2 from clean expected/live `65005b3822418594dd95ca826e8ff90b912c8df3`. The [full P01–P64 closure matrix](reports/phase2g2-final-closure.md) preserves every original requirement and distinguishes internal software from external production-evidence blockers. Main/remote HEAD remain `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`; only `phase-2-compatible-editor` is published normally. Exact commits and cleanup are in the [publication receipt](reports/phase2g2-evidence/async-publication.json). Earlier handoffs below are historical.

- The real packaged HTTPS editor now composes asynchronous PG identity/session/membership/source/history/drafts/artifacts/leases and the actual mTLS hosted Linux provider. No Promise-returning authority is consumed synchronously; no hosted local-operator/SQLite fallback or second canonical source system is constructed. Real project bytes and accepted ledger commit together in PG; private checkouts are disposable, including compiler caches repopulated on every use.
- Two signed TEST OIDC users in separate workspaces/projects complete Code/Visual/source/history/preview/input/export through the exact packaged CLI. Owner/editor/viewer and fresh revocation, forged/stolen cross-tenant references, PG source/history/artifact faults, actual process SIGKILL/reconnect, simultaneous CAS/idempotency, fences/expiry/capacity, delayed mTLS result and lost cleanup acknowledgement are exercised. Local TEST PG/mTLS/TLS/native Linux is internal proof only.
- React18/19 component-only Code and Visual updates preserve component state through PG acceptance; CSS hot update, incremental rebuild/reload and generation restart are separately asserted. No reload is called HMR. The async sweep, compiler-admission and stale UI-response races are fixed; independent security review verified the admission remediation.
- High-value retained software improvements: acknowledged durable personal draft recovery, atomic Save all dirty files, construction of missing safe CSS media/Tailwind variants, bounded Unicode/key input through real viewer, correct DOM-only instrumentation for custom renderer intrinsics, finite React18/Vite4/SWC/Three profile, periodic orphan recovery and deliberate task-exhaustion proof. No coordinates/canvas document or arbitrary uploaded Node execution was added.
- All four exact unchanged corpus projects rerun. Three remain refused by intake/profile/configuration. Zustand now has zero profile issues, Code/Visual-source acceptance, two durable transactions across restart, exact32-file export and independent Vite build; preview/export raster capture still times out at4000ms. Zero complete unchanged full-application render passes. No upstream source/config was changed to force compatibility.
- **325 distinct tests pass; all305 prior tests unchanged.** Default290+35 gated, retained PG/mTLS/refresh24 (one duplicate), exact packaged hosted12. TypeScript/build/package, all retained browsers and local TLS, real OS/resource/crash/fencing/refresh and eight independent export build/render jobs pass. New finite task probe denied at182 children and verified reaping; memory kill and65111ms watchdog pass. Evidence links/commands/limits are in the report.
- Codex Security sealed a30-surface immutable diff review with one confirmed P2 admission race, then the fix/regression and independent reread closed it. New packaged/proof changes received follow-up review. The sealed scan is pre-remediation evidence, not a certificate for a different tree; production security and a professional penetration test are not claimed.
- Owned local TEST gateway/leases/jobs/tunnels/PKI/config/database schema/password are cleaned, and VM is stopped. Raw noncredential QA receipts remain ignored. No real credential, generated key/cookie, private source, personal path or VM/QA state is included in commits.

**Exact remaining INTERNAL blockers:** P05–08 profiles/packages/locks/config/Tailwind/public env; P10/P12/P18 component/prop/cross-file origins, precise instance effects/cascade; P17 pointer drag/resize; P23 import rewriting/broader source scope; P25 uploaded semantic TS/external source ingestion; P29 history compaction/archival/migration/recovery UX; P31 refresh graph breadth; P39 clipboard/IME/accessibility/streaming/long-session/reconnect; P51 operational quotas/load/scalability; P55 managed secret delivery/rotation; P57/P59 unchanged full-application render/edit/responsive/restart/export-render; P61 representative performance. Next priority is meaningful unchanged common React/Vite applications; production credentials are not a substitute.

**Exact remaining EXTERNAL blockers:** P41 production OIDC/account policy; P29/P45/P46 private verified-TLS durable PG/backup/PITR/restore/retention; P43/P52 separate real registrable HTTPS DNS/proxy/CDN/cookie/CSP sites; P48–50 two actual isolated hosts, installation/mTLS/firewall, partitions/node-loss/takeover/cleanup; P51/P61 real deployed capacity/load; P55 secret-manager configuration/rotation; P56 production adversarial/storage/network/security proof. No production credential, purchase, DNS change or account action was requested.

**Phase3 may not begin under the original Phase2 DoD.** All P64 later product/UI/AI/Marketplace/seller/reviewer/admin/bigperson/payment/collaboration/navigation/footer/Docs scope remains intact.

Resume by checking current clean branch/live HEAD/ancestry/main, then reading this report/matrix. Local strict QA: `npm run runner:prepare`, optionally `npm run runtime:prepare:expanded`, then `WCB_PREVIEW_PROVIDER=lima npm run dev`; refresh adds `WCB_REACT_REFRESH=1`. Hosted local TEST setup uses the retained `scripts/hosted/local-postgres.cjs` and `local-gateway.cjs`; read the [explicit hosted package guide](../deployment/hosted/README.md) for schema, runtime files and config. No public deployment is authorized.

---

# Current handoff: Phase 2G.2 final closure audit (2026-09-14)

**PHASE 2G.2 FINAL CLOSURE CHECKPOINT: NOT YET. OVERALL PHASE 2: NOT YET. PUBLIC HOSTED IMPORT READY: NO.**

The [complete closure report](reports/phase2g2-final-closure.md) maps every retained requirement P01–P64 to its starting status and final evidence. Earlier handoffs below remain historical. This is a coherent implementation checkpoint; real infrastructure is not the only remaining blocker.

- Started clean on `phase-2-compatible-editor` at live `cac7b3abe33a26dcb4f5110b67a8433840960b95`, direct implementation parent `401450f88162d46c1291544d4b8f101e5702d993`. Phase 2G.2 implementation: **077223d15dea834afdfeb018a7d3e80fab7edeb4**. Documentation/evidence are separate. Origin is `https://github.com/Webcanbe/webcanbe-real.git`; main and remote HEAD remain `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. Only the feature branch is published normally; no force push, main merge or public launch.
- Added a portable signed OIDC code/PKCE/nonce login adapter, provisioned issuer/subject mapping, short-lived revocable hashed sessions, exact HTTPS origin/host and Secure/HttpOnly/SameSite/CSRF boundaries. Real PostgreSQL login/session/source/history/artifact/lease adapters enforce fresh server-owned authorization, atomic source/ledger CAS, immutable history/artifacts and revoke/delete tombstones. Source remains real files under the existing adapter/transaction model. Local signed TEST identity and local PostgreSQL are not production provider/cloud evidence.
- Added the mTLS Linux runner provider, fixed-command gateway and reproducible private deployment package, retaining the Lima OS isolation policy. PostgreSQL owns controller epochs, immutable generations/hashes, host assignment, admission, heartbeat, expiry, recovery and quarantine. Actual controller A SIGKILL → B expiry/takeover/verified cleanup → late A rejection passed against a local isolated job. Two actual hosted nodes, operational periodic recovery and cloud resource/outage probes remain unproven.
- Opt-in `WCB_REACT_REFRESH=1` now provides true component-state-preserving React 18/19 Fast Refresh for existing component-only modules with unchanged graphs inside isolated Chromium. Default CSS hot update/module rebuild+document reload/structural restart is preserved. Unsupported refresh graphs fall back accurately. No imported JavaScript enters the ordinary WebCanBe browser; export source has no refresh/bridge instrumentation.
- Four preselected unchanged independent full projects were tested, with pinned commits, provenance, licenses and meaningful failures retained. Three failed intake; Zustand demo imported but runtime, Code acceptance and export failed its unsupported profile/dependencies. No full-project visual/responsive/accepted history/export PASS is claimed. The two safe static-config/profile-diagnostic fixes do not make those projects pass. Original official starters and authored QA retain separate passing evidence.
- **305 distinct tests pass, including all 263 unchanged originals.** Default suite: 282 passed and 23 explicit gated skips; actual PostgreSQL/mTLS-runner/React-refresh integration: 24 passed, including those 23 and one shared compiler test. TypeScript/build, packaging, real OS network/resource/cleanup probes, all five retained browser suites, local distinct-site TLS/cookie/CSRF tests and six independent export builds/renders pass. An earlier unchanged-suite teardown ENOTEMPTY race is disclosed, not removed by weakening a test. See [validation](reports/phase2g2-evidence/validation-summary.json) and the report for exact commands, boundaries and measurements.
- A separate compatibility review and actual Codex Security Standard scan were completed. Six discovered issues were remediated and retained in the [security review](reports/phase2g2-evidence/security-review.md). The tool warned that the working tree changed during the scan: its snapshot remains the starting commit. After the implementation freeze, the independent reviewer reread the final relevant code and verified all non-Markdown digests. Coverage is partial (62/355 files), and this is not a professional penetration test or a deployed security certificate.
- Final local cleanup: six gateway leases stopped, zero running preview units, gateway/tunnels stopped, generated QA credentials/test PKI removed from host and guest, VM stopped. Ignored QA receipts and disposable VM disk remain local. No live cookies/tokens, credentials, private source, personal filesystem paths, generated secrets or VM/cloud state are published.
- Resume local strict validation with `npm run runner:prepare`, then `WCB_PREVIEW_PROVIDER=lima npm run dev`; expanded profiles may need `npm run runtime:prepare:expanded`. Optional refresh adds `WCB_REACT_REFRESH=1`. The hosted QA scripts create local TEST infrastructure only. Read the [deployment package](../deployment/hosted/README.md) before using them; the gateway package is not a complete hosted editor.

**Smallest next implementation action:** migrate the existing synchronous editor registry/session/source/artifact/Canvas/history/preview API to the asynchronous PostgreSQL adapters, then prove a two-user/two-project HTTP identity-to-runner flow. Do not pass asynchronous methods into synchronous contracts or put the SQLite scheduler over the PostgreSQL provider and call it hosted. This work needs no production credentials. Broader unchanged full-project admission, responsive construction/gestures, source origins, multi-file/durable draft/history/profile/refresh/input gaps remain individually open in the closure matrix.

Actual hosted validation subsequently needs an operator-supplied OIDC client/callback registration, private PostgreSQL with verified CA/credentials and backup/PITR, authorized isolated Linux hosts with management mTLS, and separate registrable HTTPS editor/viewer sites with real DNS/TLS/proxy configuration. No purchase, production credential creation, DNS change or irreversible external account action was performed. Supplying those resources alone does not close the internal gates. Phase 3/4/5 and all deferred product/UI/AI/Marketplace/payment scope remain intact.

Verify the clean tree, ancestry, live feature tip and unchanged main before continuing. This handoff intentionally does not embed its own documentation commit hash.

---

# Current handoff: Phase 2G.1 hosted foundation, incremental preview and profiles (2026-09-14)

**PHASE 2G.1 HOSTED FOUNDATION + HMR + PROFILE CHECKPOINT: PASS (bounded local checkpoint). OVERALL PHASE 2: NOT YET. PUBLIC HOSTED IMPORT READY: NO.**

See the [complete Phase 2G.1 report](reports/phase2g1-hosted-foundation-hmr-profiles.md) and [sanitized verification receipt](reports/phase2g1-evidence/verification-results.json). Earlier handoffs below are historical.

- Started clean/live at `52ada8d8a4a6d618d2b7202ec5780166fe35733a`; expected Phase 2F ancestry verified. Implementation: **`401450f88162d46c1291544d4b8f101e5702d993`**. Documentation/evidence are separate. Only `phase-2-compatible-editor` is published; main remains `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. Verify the final feature tip and remote before continuing.
- Explicit opaque account/workspace/project/session/generation/revision identities, owner/editor/viewer roles and actual local SQLite auth/membership/artifact/lease stores now sit behind replaceable contracts. Hosted API injection uses cookie + CSRF + fresh membership and account-bound project capabilities, with no local operator-key fallback. Rechecks cover writes, returned source/history/export/diagnostics, preview/artifacts and async worker results. No verified login service or real hosted durable adapter is claimed.
- `ScheduledRunnerProvider` wraps the retained actual Lima provider: tenant/project ownership, fixed budget, deadlines, bounded admission, idempotency, durable orphan recovery, stop/revoke and quarantine. Local single-controller SQLite is not a multi-host scheduler. Project source/history stay in one durable commit domain, with a factory seam and private source materialization. Runtime secrets default to none; the explicit preview-grant/redaction seam is tested but no cloud secret delivery is enabled.
- Imported CSS-only output updates preserve React state inside the controlled browser. React/module changes use cached incremental compilation plus document reload in the same job, preserving route/viewport/job-local storage but resetting component state. Structural/config changes restart the generation. **React Fast Refresh/module HMR is not implemented.** All paths retain source authority, revision/digest checks, monotonic frame sequences, bounded expiry and raster viewer separation; imported modules never enter the ordinary WebCanBe browser in strict mode.
- The unchanged `react19-vite6` profile is joined by `react18-vite5-v1` and `react19-vite8-v1`. Pins/lock/integrity remain explicit with no host dependency fallback. New support includes static base/jsconfig/env handling, narrowed literal CSS-first themes in expanded profiles, Zustand/NanoID and two unchanged MIT-licensed official Vite starters. Executable config/lifecycle/server hooks remain refused in the editor. Vite 5 has disclosed dev-server advisories; its dev server is never launched, and its export CLI runs only in the offline sandbox. See the exact matrix and audit receipt.
- **263/263 tests pass; all original 196 tests are unchanged.** TypeScript/build, real isolation/resource probes, retained router/raster/Code↔Canvas/server-restart/history/Phase 2F responsive suites, hosted-style HTTP/SQLite/Lima acceptance and six independent export build/render jobs pass. Two browser harnesses replace obsolete every-edit-restart assertions with stronger same-generation/new-revision/render/state checks, while retaining fresh-generation isolation. Final active/pending job count was zero and the local VM is stopped.
- Resume local strict work with `npm run runner:prepare`, then `WCB_PREVIEW_PROVIDER=lima npm run dev`; install expanded locked profiles with `npm run runtime:prepare:expanded` if absent. Hosted QA is explicitly injected by `scripts/verify-phase2g.cjs`, not a production login or hosted launch mode. Raw QA/runtime state and generated credentials are untracked.
- Smallest remaining 2G.2: real verified identity + durable hosted adapters + isolated provider; actual separate HTTPS/DNS/cookie/CSP and multi-tenant/crash/resource/security evidence; larger unchanged licensed full-project corpus and retained compatibility/HMR/source-authoring/history gaps; final external security/compatibility audit. Those gates remain UNPROVEN/open. Paid infrastructure, production credentials and DNS were not requested or provisioned. All final Phase 4 UI, AI, Marketplace/seller/reviewer/admin/bigperson/payment/collaboration/navigation/footer/Docs/experience scope remains unchanged.

No public deployment, main merge, force push or paid infrastructure. Verify the live feature tip, clean tree and unchanged main before the next task. This handoff intentionally does not embed its own documentation commit hash.

---

# Current handoff: Phase 2F responsive and semantic authoring (2026-09-14)

**PHASE 2F RESPONSIVE + SEMANTIC AUTHORING CHECKPOINT: PASS locally. OVERALL PHASE 2: NOT YET. PUBLIC HOSTED IMPORT READY: NO.**

See the [complete Phase 2F report](reports/phase2f-responsive-semantic-authoring.md) and [sanitized verification receipt](reports/phase2f-evidence/verification-results.json). Earlier handoffs below are historical.

- Started clean at expected/live `fac8339e86ca2e0a6395f73b922917fdc1a41de6`, descending from `390d1f09a1bd50b062a80483c80bbffb96e7a10a`. Implementation: **`1a825e9b9107840a0faf00c24b9754f6c5fd3527`**; final invalid-viewport guard: **`247d8ec83af3a83b766228f6325b2dd5983ec5e1`**. Documentation is a separate commit. Only `phase-2-compatible-editor` is published; main stays `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`.
- The existing React adapter plus additive project style reconciliation expose literal/inline/CSS/Module/Tailwind/responsive/inherited origins, active/effective source candidates, exact ranges, known source-use counts and shared scope. Explicit source-scope edits affect all matching uses; instance-only shared requests are refused. Ambiguous cascade, dynamic values and unsafe selectors retain Code access.
- Preview mobile/tablet/desktop widths remain 390/768/1280. A separate authoring selector edits base/default or an existing project CSS/Tailwind breakpoint. Only the selected token/declaration changes. Static CSS @theme breakpoint literals are understood by analysis, **but the unchanged runtime still rejects @theme/configuration directives**. Do not claim custom theme preview support. Unknown viewports and unsupported variants fail closed.
- Expanded utility families, static local const/object/array token origins, existing Flex/Grid properties and adjacent native JSX sibling reorder share normal source transactions, revisions, hash checks, durable History, inverse/restart behavior and controlled preview rebuilds. No coordinates, alternate canvas document or second history. Shared const storage is explicit; writes/aliases/deletion/exports/dynamic values are conservative.
- All original **145 tests remain unchanged; 196/196 pass** with 51 new cases. TypeScript/build, real controlled runner isolation/resource probes, unchanged legacy and controlled browser suites, Code/Canvas/invalid-draft/file-operation/restart regressions, both responsive router paths and independent exports build/render pass. No runtime errors in final new/Code/export acceptance. Original fixtures, compiler, runner/security and durable storage implementation remain unchanged.
- Final browser jobs were cleaned up; the local VM is stopped after validation. Restart with `npm run runner:prepare`, then `WCB_PREVIEW_PROVIDER=lima npm run dev`. Credentials are newly issued by the local server, not stored here.
- Limits: existing declarations only; explicit reorder controls rather than pointer drag; partial cascade/value vocabulary, approximate static counts, local const tracing rather than general prop/cross-file analysis, and no independently authored external-project acceptance. The fixture and its HashRouter variant are explicitly authored QA, not third-party evidence.
- Still open: genuine imported HMR, broader runtime/dependency/config profiles, hosted ownership/scheduling/storage/cookie/resource isolation, production hosted provider, broader independent real-project validation, final external/security audit, remaining compatibility gaps and the entire final product/Phase 4 UI/AI/Marketplace/seller/payment/admin/collaboration/experience scope. No main merge or public deployment.

Verify the final live feature tip, clean tree and unchanged main before continuing. The report intentionally does not embed its own documentation commit hash.

---

# Current handoff: Phase 2D/E Code ↔ Canvas and durable history (2026-09-13)

**PHASE 2D/E CODE↔CANVAS + DURABLE HISTORY CHECKPOINT: PASS locally. OVERALL PHASE 2: NOT YET. PUBLIC HOSTED IMPORT READY: NO.**

See the [complete Phase 2D/E report](reports/phase2de-code-canvas-history.md) and [sanitized verification receipt](reports/phase2de-evidence/verification-results.json). Earlier handoffs below are historical checkpoints.

- Verified clean starting HEAD/live branch `66403284303f12cfdc38139c4d81780ef63b131a` and main `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b` before work. Implementation and executable acceptance: **`390d1f09a1bd50b062a80483c80bbffb96e7a10a`**. This documentation is a separate commit on the same branch; verify the final tip against live `origin/phase-2-compatible-editor` before continuing. No main merge, rewrite, public deployment or paid infrastructure.
- Visual edits, Code saves, create/update/rename/delete, checkpoint and inverse transactions share the existing authorized source acceptance path. Canonical real project files remain the product; the existing adapter/bridge/runtime/transaction boundaries are retained. Every accepted mutation has an expected base, unique revision, file hashes, idempotency key, validation and source inverse evidence. Source anchors are revision/content scoped; acceptance clears stale selection and analysis before rebuilding the controlled preview with route/viewport retained.
- Persistence: private `.webcanbe/history/<project-id>/history.json`, outside exported source. Fsynced write-ahead journal and ledger commit point recover interrupted multi-file writes. SQLite supplies a kernel-released per-project writer lease, not revision storage. Actual SIGKILL tests cover journal/partial-write/post-commit crash points and recovery by a fresh or surviving registry. Unexpected outside source changes fail closed for operator reconciliation.
- Undo/selective revert is a new current-base inverse transaction. Later unrelated files survive; a later change anywhere in an affected file refuses conservatively. Redo persists; ordinary edits clear redo, checkpoints do not. The local ledger retains full affected-file inverse evidence and has no compaction/hosted migration facility yet.
- CodeMirror provides Code/file tree, memory drafts, keyboard save, diagnostics, diff, changed markers and safe file operations. Invalid drafts retain last-good source/preview. Drafts survive view switches and reconnect, but unaccepted drafts are not crash-safe. Accepted source, exact HEAD, mixed producer history and undo/redo survive editor/server restart. File operations compile before acceptance; automatic import rewriting and a multi-file editor save UI remain future work.
- All **116 prior tests remain unchanged; 145/145 pass**. TypeScript, production build, existing runner isolation/resource checks, original HashRouter/Field Notes and controlled BrowserRouter regressions, new Code/Canvas/restart/strict HashRouter/file-operation browser acceptance, and independent final exported build/render all pass. No runtime errors in the new browser/export runs. One non-failing Vite advisory: lazy Code chunk 543.01 kB (184.66 kB gzip). No external security audit is claimed.
- Runner/compiler/profile/original fixture files are unchanged. Strict imported JavaScript still runs only in the existing Linux Chromium job; the ordinary browser receives the separate-origin raster viewer. Source authority stays outside the project. No active job units remained after QA; the local VM was stopped. `npm run runner:prepare`, then `WCB_PREVIEW_PROVIDER=lima npm run dev` restarts strict local work. Reconnect at the existing project URL with the new server key. No keys are persisted in this handoff.
- Next: preserve broader CSS/Tailwind analysis, responsive authoring, semantic gestures, true imported HMR, wider runtime/configuration profiles, hosted ownership/scheduling/storage/resource isolation and the final Phase 2 external-project/security audit. The full final product experience, landing/dashboard/Marketplace, navigation/footer/Docs, AI, seller/payment/admin scope remains open and unchanged. Local Phase 2D/E success does not make overall Phase 2 or hosted imports ready.

The report intentionally does not embed its own documentation commit hash. Verify HEAD, clean status, live feature branch and unchanged main before the next task.

---

# Current handoff: Phase 2C.2 local controlled runner (2026-09-13)

**Phase 2C.2 PASS locally; Phase 2C HTTP/BrowserRouter PASS through the controlled local viewer; overall Phase 2 NOT YET; public hosted imports NO.**

See the [complete Phase 2C.2 report](reports/phase2c2-controlled-runner.md) and [evidence](reports/phase2c2-evidence/verification-results.json). Earlier handoffs below are historical checkpoints.

- Started clean at `6b43dcee099b270d6b1663467218532574ce6bc2`, matching the live branch. Main remains `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. Only `phase-2-compatible-editor` is published; no main merge or hosted deployment.
- Concrete `RunnerProvider` / local Lima provider extends the Phase 2C.1 broker. Every strict project/browser runs inside a no-host-mount Linux VM job with private network/filesystem/PID namespaces, socket-family restriction, native Chromium sandbox, cgroup limits, external deadline and verified stop/revoke behavior.
- `npm run runner:prepare`, then `npm run runner:verify`, then `WCB_PREVIEW_PROVIDER=lima npm run dev`. Development-only Apple Silicon macOS provider; no cloud account, purchase or global installation. The VM was stopped after checkpoint validation; preparation restarts it.
- The ordinary browser receives only platform-owned separate-origin raster viewer code, PNG frames and sanitized source/geometry observations. All keys, session capabilities and mutation authority remain in the trusted editor/server. External networking is denied; no project networking capability is inferred from transport.
- Full local BrowserRouter navigation/assets/selection/edit/diff/undo/redo/export and preserved HashRouter/Field Notes regressions pass. All original 108 tests retained; 116 pass with TypeScript/production build. Real positive/negative network, process/filesystem, memory/frozen-worker, source authorization, cross-project, expiry/revoke and cleanup evidence is committed.
- Without the server-selected Lima provider, BrowserRouter remains disabled and legacy Blob/HashRouter retains its non-strict warning. No raw project HTTP iframe or `allow-same-origin` path was enabled. Strict failures do not fall back to client execution.
- Preview sessions last at most 60 seconds; reconnect renews. This is PNG polling and bounded click/select/scroll/route/viewport input, not finished streaming, keyboard/text-input or remote-desktop UX. Supported source mutations are unchanged. On cleanup quarantine, stop the VM before restarting admission.
- Next bounded work: hosted ownership/scheduling/storage/cookie isolation and stronger viewer ergonomics need separate implementation and tests. Broader Phase 2 profile/configuration, history/HMR, Code UI and product-experience work remains open. Do not mark public hosted imports ready from this local checkpoint.

The report intentionally does not embed its own commit hash. Verify HEAD against the live branch before continuing.

---

# Current handoff: Phase 2C.1 controlled execution foundation (2026-09-13)

**Phase 2C.1 network isolation NOT YET; Phase 2C HTTP/BrowserRouter NOT YET; overall Phase 2 NOT YET; public hosted imports NO.**

The [Phase 2C.1 report](reports/phase2c1-network-isolation.md) and sanitized evidence are the current record. The earlier handoff below is retained as history.

- Audited clean starting HEAD and live remote at `fbd95b46e9ac0ac02ae7e422501f0a7395d45ce4`, descended from `4a6520f795e52bff2ccebabd1ea13274dfe85466`; main remains `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`.
- Native-sandbox browser probes reproduce RTC/STUN/TURN/remote-ICE egress despite CSP, media Permissions Policy, separate origin and opaque confinement. The current CSP draft has a WebRTC directive, but the tested browsers do not implement it. Collector-positive HTTP/resource denials are not all-egress proof.
- Added dormant `ControlledPreviewTransport` / `ProjectRunner` foundation: immutable artifact digest, server-authorized leases, credential-free job, raster/input boundary, lifecycle invalidation and fail-closed unavailable provider. No concrete OS-isolated browser provider or separate-origin raster viewer is installed. Mock runner tests prove broker behavior only.
- HTTP remains unreachable from the editor. No same-origin sandbox grant, client isolation flag, credential injection or unsafe native-sandbox bypass was added. Legacy local Blob/HashRouter keeps its qualified warning and existing source authorization.
- All original 95 tests are retained; **108 tests pass** with 13 new foundation cases, and TypeScript/production build pass. Exact results are in the report receipt. Existing Trail Atlas/Studio Ledger/Field Notes source-edit/diff/undo/redo/export and bridge/cleanup browser regressions pass.
- Next: implement and negatively test an actual controlled browser/network provider and authenticated separate-origin raster presentation. All strict imported JS must stay inside that boundary, including HashRouter apps. Do not expose artifact/bootstrap URLs to an uncontrolled browser. Then integrate validated observations and run the full BrowserRouter editor workflow before considering admission.
- External project networking is a distinct server-owned capability and is denied by this foundation. Preview transport must not grant it. Existing mutation authorization remains the only source-write path.
- The full broader Phase 2 and product experience plan remains open. No main merge, force push, public deployment, purchase or infrastructure installation.

This checkpoint is published only on `phase-2-compatible-editor`; verify its delivered commit against the live branch. The report intentionally does not embed its own commit hash.

---

# Current handoff: Phase 2C safe blocked checkpoint (2026-09-13)

**Current status: Phase 2C NOT YET; overall Phase 2 NOT YET; public hosted imports NO.**

The [complete committed Phase 2C report](reports/phase2c-http-preview.md) and its evidence are authoritative. The older Phase 2B handoff below is retained as historical baseline, not a claim of HTTP support.

- The existing controlled Blob/HashRouter workflow remains active. It is not a general uploaded Vite server.
- Shared HTTP compiler/artifacts, isolated-origin artifact registry, read-only bootstrap/cookie lifecycle and opaque confinement envelope are implemented as dormant prototypes. No editor endpoint starts the HTTP listener. BrowserRouter requests fail closed with an approved browser network-isolation capability error.
- Authored BrowserRouter routing/basename fixtures and independent export builds/renders pass; 95 tests and TypeScript/production build pass. Existing Trail Atlas/Studio Ledger and final Field Notes browser editing regressions pass. Prototype source-transaction QA is not full nested-route editor UI acceptance.
- Blocking browser evidence: native History works in opaque HTTP frames, but Chromium sends WebRTC/STUN UDP despite CSP. A macOS network sandbox experiment did not work with Chromium's native sandbox retained. No unsafe runner/client-flag bypass was admitted.
- Complete security/privacy/lifecycle and limitation details, including inherited Blob network limitations and the verified route-overlay fix, are in the report. Codex Security did not run.
- Next: resolve an approved browser egress/admission boundary, finish production editor integration, exercise the full nested-route editing loop and obtain unchanged compatible external-project evidence. Do not simply delete the BrowserRouter rejection.
- Preserve broader dependencies/config/Tailwind, responsive authoring, semantic gestures, editable Code UI, durable/multi-file history, imported HMR, hosted ownership/resource isolation and the full experience/navigation/seller/footer/Docs plan. No landing/auth/marketplace redesign or main merge occurred.

Implementation/validation checkpoint `4a6520f795e52bff2ccebabd1ea13274dfe85466` was normally pushed and verified at `origin/phase-2-compatible-editor`; main is unchanged. The documentation-only publication receipt is recorded in the report. No further runtime work or speculative WebRTC workaround follows this checkpoint.

## Historical Phase 2B handoff (retained)

# Current handoff — Phase 2B

Working copy: `~/Developer/WebCanBe-recovery`.
Branch: `phase-2-compatible-editor`.
Verified remote: `https://github.com/Webcanbe/webcanbe-real.git`.

## Checkpoint and publication

- Starting checkpoint verified clean at `d1683f6`, descending from `68666d6`
  and Phase 1 `6f3582a`; original report copied verbatim into
  `reports/phase2-recovery-report.md`. Original report and iCloud repo untouched.
- Both recovery commits were pushed and their remote ancestry verified.
- Phase 2B implementation: `e39d73e871efdb7687c0ee14df0ce60e1933fb4c`
  (`feat: validate dedicated React Vite runtime profiles and routed imports`).
  Pushed and remote HEAD verified at this commit before this documentation commit.
- This accompanying documentation is published on the same branch. Verify current
  tip with `git rev-parse HEAD` and `git ls-remote origin refs/heads/phase-2-compatible-editor`.
- Main remains `dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. No merge, force push,
  history rewrite, deployment, public import service or purchase occurred.
- Tracked/staged credential/private-runtime scans and diff whitespace checks passed.

## Results and boundaries

PHASE 2B TARGETED CHECKPOINT: PASS (the explicit profile only).
OVERALL PHASE 2: NOT YET.
PUBLIC HOSTED IMPORT READY: NO.

See `phase2b-runtime.md` for the full stage-specific audit, exact supported versions,
commands/results, changed modules, test environment and remaining limitations.

Dedicated profile: React/DOM 19.3.0, Router 7.18.3 (HashRouter), Tailwind 4.3.3,
Vite 6.4.3, React plugin 4.3.4, TypeScript 5.9.3, clsx 2.1.1, classnames 2.5.1.
Manifests and npm locks are data; versions and integrity must match. No fallback to
editor node_modules. Narrow static Vite/TypeScript aliases, local assets, CSS/Modules,
nested JSX/TSX and existing supported mutations are verified.

`npm test`: 69 passing tests. `npm run build`: TypeScript and production build pass.
No lint script configured. Both new, explicitly labelled fixtures pass browser ZIP
import → routes → mapped source edit → diff → reload → undo/redo → export.
The original Field Notes browser regression loop also passes.

Both final exports build independently in fresh macOS sandbox jobs and render as
standalone apps in Chromium, with working routes/assets/edits and no instrumentation.
Outside file reads/writes, shell execution and network are denied by tested probes.
Clean environment, copied dedicated dependency files, exact lock/profile checks,
45-second process-group timeout; uploaded config executes only inside this QA sandbox.
The local QA runner is not a hosted or universal configuration execution service.

Preview Blob transport retains sandbox="allow-scripts" without same-origin access;
Chromium verifies opaque document/message origins and denies parent DOM, storage and
tested fetch/resource requests, not all browser egress. WebRTC/RTC networking can
bypass CSP; HTTP stays disabled pending a tested defense-in-depth solution.
No key/capability is sent to preview. Ten-minute authority and source guards
remain unchanged. Auto-review initially rejected the Blob proposal; controlled
security probes established the retained isolation, and the action was then approved.

## Next bounded task

Add an isolated HTTP preview profile for unchanged BrowserRouter applications and
validate independently authored projects against explicit dependency versions.
Do not substitute routers/config/code to claim compatibility.

Still open: broader dependency/lock profiles, CSS cascade and Tailwind config,
universal responsive authoring, editable code UI, durable/multi-file history,
imported HMR, hosted ownership and resource isolation. The original remaining
requirements in `phase2.md` and the recovery report are not cancelled. Landing/auth/
marketplace redesign, AI editing and main merging remain out of scope.
