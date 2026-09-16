import { createHash, randomBytes, randomUUID } from "node:crypto"
import type { Pool, PoolClient } from "pg"
import type { ReleaseOrigin, RevisionLedger } from "../core/types"
import { boundedHistory, treeHash } from "../mutations/durableSource"
import { sourceMember } from "./sourceDirectory"
import { AuthorityDenied, requireOpaqueId, type ServerSession } from "./hostedAuthority"
import { EntitlementUnavailable, ProductConflict, type AssessmentJobCancellation, type AssessmentJobFence, type AssessmentJobLease, type AssessmentResult, type AssessmentResultInput, type AssessmentResultStatus, type AssessmentWorkerAuthority, type CatalogProject, type LicenseEntitlement, type Listing, type ListingPublication, type ProjectRelease, type SellerApplication, type SellerAssessmentRequest, type SellerQuarantineItem, type SellerReleasePromotion, type SellerReviewDecision, type SellerSubmission, type WorkspaceProject } from "./productDomain"
import { pgTransaction } from "./postgresTransaction"
import { PostgresAccess, PostgresProjectStore, verifyHistory } from "./postgresStores"
import { safeArchivePath, ZIP_LIMITS } from "./projectRegistry"

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex")
const identifier = (value: string) => { requireOpaqueId(value); return value }
const cleanText = (value: string, label: string, maximum: number) => {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maximum || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) throw new Error(`Invalid ${label}.`)
  return value.trim()
}
const cleanSlug = (value: string) => {
  const slug = cleanText(value, "slug", 100).toLowerCase()
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Invalid slug.")
  return slug
}
const cleanKey = (value: string) => {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value)) throw new Error("Invalid idempotency key.")
  return value
}
const assessmentCredential = (value: string) => {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value)) throw new AuthorityDenied()
  return value
}
const jsonObject = (value: Record<string, unknown> | undefined, label: string) => {
  const encoded = JSON.stringify(value ?? {})
  if (encoded.length > 8192) throw new Error(`${label} exceeds its limit.`)
  const parsed: unknown = JSON.parse(encoded)
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error(`Invalid ${label}.`)
  return parsed as Record<string, unknown>
}
const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  const object = value as Record<string, unknown>
  return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`
}
const assessmentArtifactRefs = (values: string[] | undefined) => {
  if (values === undefined) return []
  if (!Array.isArray(values) || values.length > 20) throw new Error("Invalid assessment artifact references.")
  const refs = values.map(value => identifier(value))
  if (new Set(refs).size !== refs.length) throw new Error("Invalid assessment artifact references.")
  return refs.sort()
}
const cleanTags = (values: string[] | undefined) => {
  if (!values) return []
  if (!Array.isArray(values) || values.length > 20) throw new Error("Invalid listing tags.")
  return [...new Set(values.map(value => cleanText(value, "tag", 40).toLowerCase()))].sort()
}
const iso = (value: unknown) => new Date(String(value)).toISOString()
const encodeFiles = (files: Map<string, Buffer>) => [...files].sort(([a], [b]) => a.localeCompare(b)).map(([file, bytes]) => [file, bytes.toString("base64")] as const)
const snapshotHash = (snapshot: { projectId: string; revisionId: string; contentHash: string; files: Map<string, Buffer>; history: RevisionLedger }) => sha256(JSON.stringify({ projectId: snapshot.projectId, revisionId: snapshot.revisionId, contentHash: snapshot.contentHash, files: encodeFiles(snapshot.files), history: snapshot.history }))
const filesFrom = (value: unknown) => {
  if (!Array.isArray(value)) throw new Error("Stored release files are invalid.")
  const files = new Map<string, Buffer>(), seen = new Set<string>(); let total = 0
  for (const entry of value) {
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== "string" || typeof entry[1] !== "string" || safeArchivePath(entry[0]) !== entry[0] || seen.has(entry[0].toLowerCase()) || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(entry[1])) throw new Error("Stored release files are invalid.")
    const bytes = Buffer.from(entry[1], "base64"); total += bytes.length
    if (bytes.length > ZIP_LIMITS.fileBytes || total > ZIP_LIMITS.totalBytes || files.size >= ZIP_LIMITS.entries) throw new Error("Stored release exceeds source limits.")
    seen.add(entry[0].toLowerCase()); files.set(entry[0], bytes)
  }
  return files
}

type ReleaseRow = Record<string, unknown> & {
  release_id: string; catalog_project_id: string; version: string; release_status?: "published"; status?: "published"
  source_project_id: string; source_revision_id: string; source_content_hash: string; snapshot_hash: string; files: unknown; history: RevisionLedger; created_at: unknown
}

const releaseFrom = (row: ReleaseRow): ProjectRelease => Object.freeze({
  releaseId: String(row.release_id), catalogProjectId: String(row.catalog_project_id), version: String(row.version), status: "published",
  sourceProjectId: String(row.source_project_id), sourceRevisionId: String(row.source_revision_id), sourceContentHash: String(row.source_content_hash), snapshotHash: String(row.snapshot_hash), createdAt: iso(row.created_at)
})

export type MaterializationReconciliation = Readonly<{ examined: number; ready: number; failed: number; pending: number }>
export type AssessmentExecutionSnapshot = Readonly<{
  assessmentJobId: string
  submissionId: string
  sellerUserId: string
  workspaceId: string
  sourceProjectId: string
  sourceRevisionId: string
  sourceContentHash: string
  snapshotHash: string
  files: ReadonlyMap<string, Buffer>
  history: RevisionLedger
}>

/** Hosted Phase-3 product persistence. PostgreSQL stores both immutable release
 * snapshots and materialization intent. Editable working copies are created in
 * the existing wcb_projects source/history tables; no parallel project system
 * exists. */
export class PostgresProductDomainStore {
  constructor(readonly pool: Pool, readonly access: PostgresAccess, readonly source: PostgresProjectStore, private readonly faults: { afterMaterializationReservation?: () => Promise<void> } = {}) {}

  private async requireSessionIn(client: PoolClient, session: ServerSession) {
    const row = await client.query(`SELECT s.session_id FROM wcb_sessions s WHERE s.session_id=$1 AND s.user_id=$2 AND active
      AND expires_at=to_timestamp($3/1000.0) AND expires_at>clock_timestamp()
      AND NOT EXISTS(SELECT 1 FROM wcb_disabled_users d WHERE d.user_id=$2) FOR SHARE`, [session.sessionId, session.userId, session.expiresAt])
    if (!row.rowCount) throw new AuthorityDenied()
  }

  private async requireOperatorIn(client: PoolClient, session: ServerSession) {
    await this.requireSessionIn(client, session)
    const row = await client.query("SELECT user_id FROM wcb_product_operators WHERE user_id=$1 AND active FOR SHARE", [session.userId])
    if (!row.rowCount) throw new AuthorityDenied()
  }

  /** Trusted provisioning seam. It is intentionally absent from the HTTP
   * controller; authenticated clients cannot assert operator authority. */
  async provisionOperator(userId: string, active = true) {
    identifier(userId)
    await this.pool.query("INSERT INTO wcb_product_operators(user_id,active,epoch) VALUES($1,$2,1) ON CONFLICT(user_id) DO UPDATE SET active=excluded.active,epoch=wcb_product_operators.epoch+1", [userId, active])
  }

  async applySeller(session: ServerSession): Promise<SellerApplication> {
    return pgTransaction(this.pool, async client => {
      await this.requireSessionIn(client, session)
      const existing = (await client.query("SELECT * FROM wcb_seller_applications WHERE user_id=$1 FOR UPDATE", [session.userId])).rows[0]
      if (existing) { await this.requireSessionIn(client, session); return this.sellerApplicationFrom(existing) }
      const row = (await client.query(`INSERT INTO wcb_seller_applications(application_id,user_id,status,created_at,updated_at)
        VALUES($1,$2,'pending',clock_timestamp(),clock_timestamp()) RETURNING *`, [randomUUID(), session.userId])).rows[0]
      await this.requireSessionIn(client, session)
      return this.sellerApplicationFrom(row)
    })
  }

  async sellerApplication(session: ServerSession): Promise<SellerApplication | undefined> {
    return pgTransaction(this.pool, async client => {
      await this.requireSessionIn(client, session)
      const row = (await client.query("SELECT * FROM wcb_seller_applications WHERE user_id=$1", [session.userId])).rows[0]
      await this.requireSessionIn(client, session)
      return row ? this.sellerApplicationFrom(row) : undefined
    })
  }

  async transitionSellerApplication(operator: ServerSession, applicationId: string, status: "approved" | "rejected"): Promise<SellerApplication> {
    identifier(applicationId)
    if (!["approved", "rejected"].includes(status)) throw new Error("Invalid seller application state.")
    return pgTransaction(this.pool, async client => {
      await this.requireOperatorIn(client, operator)
      const current = (await client.query("SELECT * FROM wcb_seller_applications WHERE application_id=$1 FOR UPDATE", [applicationId])).rows[0]
      if (!current) throw new AuthorityDenied()
      if (current.status === status) { await this.requireOperatorIn(client, operator); return this.sellerApplicationFrom(current) }
      if (current.status === "rejected") throw new ProductConflict("Rejected seller application cannot be reopened by this intake workflow.")
      const row = (await client.query(`UPDATE wcb_seller_applications SET status=$2,decision_by=$3,decided_at=clock_timestamp(),updated_at=clock_timestamp()
        WHERE application_id=$1 RETURNING *`, [applicationId, status, operator.userId])).rows[0]
      await this.requireOperatorIn(client, operator)
      return this.sellerApplicationFrom(row)
    })
  }

  async createSellerSubmission(session: ServerSession, sellerApplicationId: string, workspaceId: string, sourceProjectId: string): Promise<SellerSubmission> {
    identifier(sellerApplicationId); identifier(workspaceId); identifier(sourceProjectId)
    const grant = await this.access.grant(session, sourceProjectId, "source")
    if (grant.workspaceId !== workspaceId) throw new AuthorityDenied()
    return pgTransaction(this.pool, async client => {
      const seller = (await client.query("SELECT application_id FROM wcb_seller_applications WHERE application_id=$1 AND user_id=$2 AND status='approved' FOR SHARE", [sellerApplicationId, session.userId])).rows[0]
      if (!seller) throw new AuthorityDenied()
      await this.access.requireWorkspaceIn(client, session, workspaceId); await this.access.authorize(client, grant, "source")
      const row = (await client.query("SELECT revision,files,history FROM wcb_projects WHERE project_id=$1 AND workspace_id=$2 AND NOT deleted FOR SHARE", [sourceProjectId, workspaceId])).rows[0]
      if (!row?.revision || !row.files || !row.history) throw new AuthorityDenied()
      const files = new Map<string, Buffer>(Object.entries(row.files as Record<string, unknown>).map(([file, base64]) => [file, Buffer.from(String(base64), "base64")]))
      const history = structuredClone(row.history) as RevisionLedger; boundedHistory(history)
      if (verifyHistory(sourceProjectId, files, history) !== row.revision) throw new Error("Stored source integrity failed.")
      const head = history.revisions.at(-1)!
      const immutable = snapshotHash({ projectId: sourceProjectId, revisionId: String(row.revision), contentHash: head.contentHash, files, history })
      const existing = (await client.query(`SELECT s.*,st.status,st.updated_at FROM wcb_seller_submissions s JOIN wcb_seller_submission_states st USING(submission_id)
        WHERE s.seller_application_id=$1 AND s.source_project_id=$2 AND s.source_revision_id=$3`, [sellerApplicationId, sourceProjectId, row.revision])).rows[0]
      if (existing) { await this.access.authorize(client, grant, "source"); return this.sellerSubmissionFrom(existing) }
      await this.access.authorize(client, grant, "source"); await this.access.requireWorkspaceIn(client, session, workspaceId)
      const submissionId = randomUUID()
      const inserted = (await client.query(`INSERT INTO wcb_seller_submissions(submission_id,seller_application_id,seller_user_id,workspace_id,source_project_id,source_revision_id,source_content_hash,snapshot_hash,files,history,created_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,clock_timestamp()) RETURNING *`, [submissionId, sellerApplicationId, session.userId, workspaceId, sourceProjectId, row.revision, head.contentHash, immutable, JSON.stringify(encodeFiles(files)), JSON.stringify(history)])).rows[0]
      const state = (await client.query("INSERT INTO wcb_seller_submission_states(submission_id,status,updated_at) VALUES($1,'pending_review',clock_timestamp()) RETURNING status,updated_at", [submissionId])).rows[0]
      await this.access.authorize(client, grant, "source"); await this.access.requireWorkspaceIn(client, session, workspaceId)
      return this.sellerSubmissionFrom({ ...inserted, ...state })
    })
  }

  async sellerSubmissions(session: ServerSession): Promise<SellerSubmission[]> {
    return pgTransaction(this.pool, async client => {
      await this.requireSessionIn(client, session)
      const rows = (await client.query(`SELECT s.*,st.status,st.updated_at FROM wcb_seller_submissions s JOIN wcb_seller_submission_states st USING(submission_id)
        WHERE s.seller_user_id=$1 ORDER BY s.created_at DESC LIMIT 100`, [session.userId])).rows
      await this.requireSessionIn(client, session)
      return rows.map(row => this.sellerSubmissionFrom(row))
    })
  }

  async sellerQuarantineQueue(operator: ServerSession): Promise<SellerQuarantineItem[]> {
    return pgTransaction(this.pool, async client => {
      await this.requireOperatorIn(client, operator)
      const rows = (await client.query(`${this.sellerReviewSelect()} ORDER BY s.created_at ASC LIMIT 100`)).rows
      await this.requireOperatorIn(client, operator)
      return rows.map(row => this.sellerQuarantineItemFrom(row))
    })
  }

  async sellerQuarantineSubmission(operator: ServerSession, submissionId: string): Promise<SellerQuarantineItem | undefined> {
    identifier(submissionId)
    return pgTransaction(this.pool, async client => {
      await this.requireOperatorIn(client, operator)
      const row = (await client.query(`${this.sellerReviewSelect()} WHERE s.submission_id=$1`, [submissionId])).rows[0]
      await this.requireOperatorIn(client, operator)
      return row ? this.sellerQuarantineItemFrom(row) : undefined
    })
  }

  async createSellerReviewDecision(operator: ServerSession, submissionId: string, expectedSnapshotHash: string, decision: "approved_for_next_stage" | "rejected", idempotencyKey: string): Promise<SellerReviewDecision> {
    identifier(submissionId); const key = cleanKey(idempotencyKey)
    if (!/^[a-f0-9]{64}$/.test(expectedSnapshotHash) || !["approved_for_next_stage", "rejected"].includes(decision)) throw new Error("Invalid seller review decision.")
    return pgTransaction(this.pool, async client => {
      await this.requireOperatorIn(client, operator)
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,93))", [submissionId])
      const submission = (await client.query(`SELECT s.*,st.status AS submission_status FROM wcb_seller_submissions s
        JOIN wcb_seller_submission_states st USING(submission_id) WHERE s.submission_id=$1 FOR SHARE`, [submissionId])).rows[0]
      if (!submission) throw new AuthorityDenied()
      if (String(submission.snapshot_hash) !== expectedSnapshotHash) throw new ProductConflict("Review decision snapshot does not match the immutable submission.")
      const byKey = (await client.query("SELECT * FROM wcb_seller_review_decisions WHERE reviewer_user_id=$1 AND idempotency_key=$2", [operator.userId, key])).rows[0]
      if (byKey) {
        if (String(byKey.submission_id) !== submissionId || String(byKey.submission_snapshot_hash) !== expectedSnapshotHash || byKey.decision !== decision) throw new ProductConflict("Review idempotency key was already used for a different decision.")
        await this.requireOperatorIn(client, operator); return this.sellerReviewDecisionFrom(byKey)
      }
      const existing = (await client.query("SELECT * FROM wcb_seller_review_decisions WHERE submission_id=$1", [submissionId])).rows[0]
      if (existing) {
        if (String(existing.submission_snapshot_hash) !== expectedSnapshotHash || existing.decision !== decision) throw new ProductConflict("Submission already has an immutable review decision.")
        await this.requireOperatorIn(client, operator); return this.sellerReviewDecisionFrom(existing)
      }
      if (submission.submission_status !== "pending_review") throw new ProductConflict("Submission is not pending review.")
      const row = (await client.query(`INSERT INTO wcb_seller_review_decisions(decision_id,submission_id,seller_application_id,seller_user_id,source_project_id,source_revision_id,source_content_hash,submission_snapshot_hash,decision,reviewer_user_id,idempotency_key,created_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,clock_timestamp()) RETURNING *`, [randomUUID(), submissionId, submission.seller_application_id, submission.seller_user_id, submission.source_project_id, submission.source_revision_id, submission.source_content_hash, expectedSnapshotHash, decision, operator.userId, key])).rows[0]
      await this.requireOperatorIn(client, operator)
      return this.sellerReviewDecisionFrom(row)
    })
  }

  async admitSellerAssessment(operator: ServerSession, submissionId: string, expectedSellerUserId: string, expectedSnapshotHash: string, reviewDecisionId: string, idempotencyKey: string): Promise<SellerAssessmentRequest> {
    identifier(submissionId); identifier(expectedSellerUserId); identifier(reviewDecisionId); const key = cleanKey(idempotencyKey)
    if (!/^[a-f0-9]{64}$/.test(expectedSnapshotHash)) throw new Error("Invalid seller assessment admission.")
    return pgTransaction(this.pool, async client => {
      await this.requireOperatorIn(client, operator)
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,94))", [submissionId])
      const submission = (await client.query(`SELECT s.*,st.status AS submission_status FROM wcb_seller_submissions s
        JOIN wcb_seller_submission_states st ON st.submission_id=s.submission_id WHERE s.submission_id=$1 FOR SHARE`, [submissionId])).rows[0]
      if (!submission) throw new AuthorityDenied()
      const decision = (await client.query("SELECT * FROM wcb_seller_review_decisions WHERE submission_id=$1", [submissionId])).rows[0]
      if (!decision || decision.decision !== "approved_for_next_stage") throw new ProductConflict("Submission is not approved for assessment admission.")
      if (submission.submission_status !== "pending_review" || String(submission.seller_user_id) !== expectedSellerUserId || String(submission.snapshot_hash) !== expectedSnapshotHash || String(decision.decision_id) !== reviewDecisionId) throw new ProductConflict("Assessment admission references do not match the approved submission.")
      if (String(decision.seller_application_id) !== String(submission.seller_application_id) || String(decision.seller_user_id) !== String(submission.seller_user_id) || String(decision.source_project_id) !== String(submission.source_project_id) || String(decision.source_revision_id) !== String(submission.source_revision_id) || String(decision.source_content_hash) !== String(submission.source_content_hash) || String(decision.submission_snapshot_hash) !== String(submission.snapshot_hash)) throw new Error("Stored review provenance does not match its immutable submission.")
      const byKey = (await client.query("SELECT * FROM wcb_seller_assessment_requests WHERE admitted_by=$1 AND idempotency_key=$2", [operator.userId, key])).rows[0]
      if (byKey) {
        if (String(byKey.submission_id) !== submissionId || String(byKey.seller_user_id) !== expectedSellerUserId || String(byKey.submission_snapshot_hash) !== expectedSnapshotHash || String(byKey.review_decision_id) !== reviewDecisionId) throw new ProductConflict("Assessment idempotency key was already used for a different admission.")
        await this.requireOperatorIn(client, operator); return this.sellerAssessmentRequestFrom(byKey)
      }
      const existing = (await client.query("SELECT * FROM wcb_seller_assessment_requests WHERE submission_id=$1", [submissionId])).rows[0]
      if (existing) {
        if (String(existing.seller_user_id) !== expectedSellerUserId || String(existing.submission_snapshot_hash) !== expectedSnapshotHash || String(existing.review_decision_id) !== reviewDecisionId) throw new ProductConflict("Submission already has a conflicting assessment request.")
        await this.requireOperatorIn(client, operator); return this.sellerAssessmentRequestFrom(existing)
      }
      const row = (await client.query(`INSERT INTO wcb_seller_assessment_requests(assessment_request_id,submission_id,seller_user_id,source_project_id,source_revision_id,source_content_hash,submission_snapshot_hash,review_decision_id,status,admitted_by,idempotency_key,created_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,'requested',$9,$10,clock_timestamp()) RETURNING *`, [randomUUID(), submissionId, submission.seller_user_id, submission.source_project_id, submission.source_revision_id, submission.source_content_hash, submission.snapshot_hash, reviewDecisionId, operator.userId, key])).rows[0]
      await this.requireOperatorIn(client, operator)
      return this.sellerAssessmentRequestFrom(row)
    })
  }

  /** Trusted server provisioning seam. Worker credentials are never accepted by
   * the browser product controller and only their digest is persisted. */
  async provisionAssessmentWorker(workerId: string, active = true): Promise<AssessmentWorkerAuthority> {
    identifier(workerId); const credential = randomBytes(32).toString("base64url")
    await this.pool.query(`INSERT INTO wcb_assessment_workers(worker_id,credential_hash,active,epoch) VALUES($1,$2,$3,1)
      ON CONFLICT(worker_id) DO UPDATE SET credential_hash=excluded.credential_hash,active=excluded.active,epoch=wcb_assessment_workers.epoch+1`, [workerId, sha256(credential), active])
    return Object.freeze({ workerId, credential })
  }

  async claimAssessmentJob(worker: AssessmentWorkerAuthority, assessmentJobId: string, expectedSubmissionId: string, expectedSellerUserId: string, expectedSnapshotHash: string): Promise<AssessmentJobLease> {
    identifier(assessmentJobId); identifier(expectedSubmissionId); identifier(expectedSellerUserId); identifier(worker.workerId); assessmentCredential(worker.credential)
    if (!/^[a-f0-9]{64}$/.test(expectedSnapshotHash)) throw new Error("Invalid assessment claim.")
    return pgTransaction(this.pool, async client => {
      await this.requireAssessmentWorkerIn(client, worker)
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,95))", [assessmentJobId])
      const request = await this.assessmentRequestForClaim(client, assessmentJobId)
      if (!request) throw new AuthorityDenied()
      this.assertAssessmentRequestBinding(request, expectedSubmissionId, expectedSellerUserId, expectedSnapshotHash)
      const current = (await client.query("SELECT *,lease_until>clock_timestamp() AS live FROM wcb_seller_assessment_leases WHERE assessment_request_id=$1 FOR UPDATE", [assessmentJobId])).rows[0]
      if (current) {
        this.assertAssessmentLeaseBinding(current, request)
        if (current.state !== "leased") throw new ProductConflict("Assessment job is terminal.")
        if (current.live) {
          if (String(current.worker_id) !== worker.workerId) throw new ProductConflict("Assessment job already has a live worker lease.")
          await this.requireAssessmentWorkerIn(client, worker); return this.assessmentJobLeaseFrom(current)
        }
        const reclaimed = (await client.query(`UPDATE wcb_seller_assessment_leases SET worker_id=$2,generation=generation+1,claimed_at=clock_timestamp(),lease_until=clock_timestamp()+interval '5 seconds',state='leased'
          WHERE assessment_request_id=$1 RETURNING *`, [assessmentJobId, worker.workerId])).rows[0]
        await this.requireAssessmentWorkerIn(client, worker); return this.assessmentJobLeaseFrom(reclaimed)
      }
      const row = (await client.query(`INSERT INTO wcb_seller_assessment_leases(assessment_request_id,submission_id,seller_user_id,source_project_id,source_revision_id,source_content_hash,submission_snapshot_hash,worker_id,generation,claimed_at,lease_until,state)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,1,clock_timestamp(),clock_timestamp()+interval '5 seconds','leased') RETURNING *`, [assessmentJobId, request.submission_id, request.seller_user_id, request.source_project_id, request.source_revision_id, request.source_content_hash, request.submission_snapshot_hash, worker.workerId])).rows[0]
      await this.requireAssessmentWorkerIn(client, worker)
      return this.assessmentJobLeaseFrom(row)
    })
  }

  /** Mandatory fence check for any future heartbeat or result boundary. */
  async assertAssessmentLease(worker: AssessmentWorkerAuthority, fence: AssessmentJobFence): Promise<AssessmentJobLease> {
    this.validateAssessmentFence(worker, fence)
    return pgTransaction(this.pool, async client => {
      await this.requireAssessmentWorkerIn(client, worker)
      const row = (await client.query("SELECT *,lease_until>clock_timestamp() AS live FROM wcb_seller_assessment_leases WHERE assessment_request_id=$1 FOR UPDATE", [fence.assessmentJobId])).rows[0]
      if (!row || !row.live || row.state !== "leased" || String(row.worker_id) !== worker.workerId || String(row.generation) !== fence.generation || String(row.submission_id) !== fence.submissionId || String(row.submission_snapshot_hash) !== fence.snapshotHash) throw new AuthorityDenied()
      const request = await this.assessmentRequestForClaim(client, fence.assessmentJobId)
      if (!request) throw new AuthorityDenied()
      this.assertAssessmentLeaseBinding(row, request)
      await this.requireAssessmentWorkerIn(client, worker)
      const final = (await client.query("SELECT *,lease_until>clock_timestamp() AS live FROM wcb_seller_assessment_leases WHERE assessment_request_id=$1 FOR UPDATE", [fence.assessmentJobId])).rows[0]
      if (!final?.live || String(final.worker_id) !== worker.workerId || String(final.generation) !== fence.generation) throw new AuthorityDenied()
      return this.assessmentJobLeaseFrom(final)
    })
  }

  /** Returns only the immutable submitted bytes bound to the current live fence.
   * Current project HEAD is deliberately not consulted. */
  async assessmentExecutionSnapshot(worker: AssessmentWorkerAuthority, fence: AssessmentJobFence): Promise<AssessmentExecutionSnapshot> {
    this.validateAssessmentFence(worker, fence)
    return pgTransaction(this.pool, async client => {
      await this.requireAssessmentWorkerIn(client, worker)
      const lease = (await client.query("SELECT *,lease_until>clock_timestamp() AS live FROM wcb_seller_assessment_leases WHERE assessment_request_id=$1 FOR UPDATE", [fence.assessmentJobId])).rows[0]
      if (!lease || !lease.live || lease.state !== "leased" || String(lease.worker_id) !== worker.workerId || String(lease.generation) !== fence.generation || String(lease.submission_id) !== fence.submissionId || String(lease.submission_snapshot_hash) !== fence.snapshotHash) throw new AuthorityDenied()
      const request = await this.assessmentRequestForClaim(client, fence.assessmentJobId)
      if (!request) throw new AuthorityDenied()
      this.assertAssessmentLeaseBinding(lease, request)
      const submission = (await client.query("SELECT * FROM wcb_seller_submissions WHERE submission_id=$1 FOR SHARE", [fence.submissionId])).rows[0]
      if (!submission) throw new AuthorityDenied()
      const files = filesFrom(submission.files), history = structuredClone(submission.history) as RevisionLedger
      const projectId = String(submission.source_project_id), revisionId = String(submission.source_revision_id), contentHash = String(submission.source_content_hash)
      if (verifyHistory(projectId, files, history) !== revisionId) throw new Error("Stored assessment source/history integrity failed.")
      const head = history.revisions.find(item => item.revisionId === revisionId)
      if (!head || head.contentHash !== contentHash || snapshotHash({ projectId, revisionId, contentHash, files, history }) !== fence.snapshotHash) throw new Error("Stored assessment snapshot integrity failed.")
      if (String(submission.submission_id) !== fence.submissionId || String(submission.seller_user_id) !== String(request.seller_user_id) || projectId !== String(request.source_project_id) || revisionId !== String(request.source_revision_id) || contentHash !== String(request.source_content_hash) || String(submission.snapshot_hash) !== fence.snapshotHash) throw new ProductConflict("Assessment snapshot does not match its immutable request.")
      await this.requireAssessmentWorkerIn(client, worker)
      const final = (await client.query("SELECT worker_id,generation,state,lease_until>clock_timestamp() AS live FROM wcb_seller_assessment_leases WHERE assessment_request_id=$1 FOR UPDATE", [fence.assessmentJobId])).rows[0]
      if (!final?.live || final.state !== "leased" || String(final.worker_id) !== worker.workerId || String(final.generation) !== fence.generation) throw new AuthorityDenied()
      return Object.freeze({ assessmentJobId: fence.assessmentJobId, submissionId: fence.submissionId, sellerUserId: String(submission.seller_user_id), workspaceId: String(submission.workspace_id), sourceProjectId: projectId, sourceRevisionId: revisionId, sourceContentHash: contentHash, snapshotHash: fence.snapshotHash, files: new Map(files), history })
    })
  }

  async renewAssessmentJobLease(worker: AssessmentWorkerAuthority, fence: AssessmentJobFence): Promise<AssessmentJobLease> {
    this.validateAssessmentFence(worker, fence)
    return pgTransaction(this.pool, async client => {
      await this.requireAssessmentWorkerIn(client, worker)
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,95))", [fence.assessmentJobId])
      const request = await this.assessmentRequestForClaim(client, fence.assessmentJobId)
      if (!request) throw new AuthorityDenied()
      const current = (await client.query("SELECT *,lease_until>clock_timestamp() AS live FROM wcb_seller_assessment_leases WHERE assessment_request_id=$1 FOR UPDATE", [fence.assessmentJobId])).rows[0]
      if (!current || current.state !== "leased" || !current.live || String(current.worker_id) !== worker.workerId || String(current.generation) !== fence.generation || String(current.submission_id) !== fence.submissionId || String(current.submission_snapshot_hash) !== fence.snapshotHash) throw new AuthorityDenied()
      this.assertAssessmentLeaseBinding(current, request)
      const renewed = (await client.query(`UPDATE wcb_seller_assessment_leases SET lease_until=lease_until+interval '5 seconds'
        WHERE assessment_request_id=$1 AND worker_id=$2 AND generation=$3 AND state='leased' AND lease_until>clock_timestamp() RETURNING *`, [fence.assessmentJobId, worker.workerId, fence.generation])).rows[0]
      if (!renewed) throw new AuthorityDenied()
      this.assertAssessmentLeaseBinding(renewed, request)
      await this.requireAssessmentWorkerIn(client, worker)
      return this.assessmentJobLeaseFrom(renewed)
    })
  }

  async cancelAssessmentJob(worker: AssessmentWorkerAuthority, fence: AssessmentJobFence): Promise<AssessmentJobCancellation> {
    this.validateAssessmentFence(worker, fence)
    return pgTransaction(this.pool, async client => {
      await this.requireAssessmentWorkerIn(client, worker)
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,95))", [fence.assessmentJobId])
      const request = await this.assessmentRequestForClaim(client, fence.assessmentJobId)
      if (!request) throw new AuthorityDenied()
      const current = (await client.query("SELECT *,lease_until>clock_timestamp() AS live FROM wcb_seller_assessment_leases WHERE assessment_request_id=$1 FOR UPDATE", [fence.assessmentJobId])).rows[0]
      if (!current || String(current.worker_id) !== worker.workerId || String(current.generation) !== fence.generation || String(current.submission_id) !== fence.submissionId || String(current.submission_snapshot_hash) !== fence.snapshotHash) throw new AuthorityDenied()
      this.assertAssessmentLeaseBinding(current, request)
      if (current.state === "cancelled" && current.cancelled_at) {
        await this.requireAssessmentWorkerIn(client, worker)
        return this.assessmentJobCancellationFrom(current)
      }
      if (current.state !== "leased" || !current.live) throw new AuthorityDenied()
      const cancelled = (await client.query(`UPDATE wcb_seller_assessment_leases SET state='cancelled',cancelled_at=clock_timestamp()
        WHERE assessment_request_id=$1 AND worker_id=$2 AND generation=$3 AND state='leased' AND lease_until>clock_timestamp() RETURNING *`, [fence.assessmentJobId, worker.workerId, fence.generation])).rows[0]
      if (!cancelled) throw new AuthorityDenied()
      this.assertAssessmentLeaseBinding(cancelled, request)
      await this.requireAssessmentWorkerIn(client, worker)
      return this.assessmentJobCancellationFrom(cancelled)
    })
  }

  async acceptAssessmentResult(worker: AssessmentWorkerAuthority, fence: AssessmentJobFence, input: AssessmentResultInput): Promise<AssessmentResult> {
    this.validateAssessmentFence(worker, fence)
    const status = input.status as AssessmentResultStatus
    if (!( ["passed", "failed", "errored"] as string[]).includes(status)) throw new Error("Invalid assessment result status.")
    const normalized = { idempotencyKey: cleanKey(input.idempotencyKey), status, metadata: jsonObject(input.metadata, "assessment metadata"), artifactRefs: assessmentArtifactRefs(input.artifactRefs) }
    const digest = sha256(canonicalJson({ status: normalized.status, metadata: normalized.metadata, artifactRefs: normalized.artifactRefs }))
    return pgTransaction(this.pool, async client => {
      await this.requireAssessmentWorkerIn(client, worker)
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,95))", [fence.assessmentJobId])
      const request = await this.assessmentRequestForClaim(client, fence.assessmentJobId)
      if (!request) throw new AuthorityDenied()
      const lease = (await client.query("SELECT *,lease_until>clock_timestamp() AS live FROM wcb_seller_assessment_leases WHERE assessment_request_id=$1 FOR UPDATE", [fence.assessmentJobId])).rows[0]
      if (!lease || String(lease.worker_id) !== worker.workerId || String(lease.generation) !== fence.generation || String(lease.submission_id) !== fence.submissionId || String(lease.submission_snapshot_hash) !== fence.snapshotHash) throw new AuthorityDenied()
      this.assertAssessmentLeaseBinding(lease, request)
      const existing = (await client.query("SELECT * FROM wcb_seller_assessment_results WHERE assessment_request_id=$1 AND lease_generation=$2 FOR SHARE", [fence.assessmentJobId, fence.generation])).rows[0]
      const keyed = (await client.query("SELECT * FROM wcb_seller_assessment_results WHERE worker_id=$1 AND idempotency_key=$2 FOR SHARE", [worker.workerId, normalized.idempotencyKey])).rows[0]
      if (lease.state === "completed") {
        if (existing && (!keyed || String(keyed.result_id) === String(existing.result_id)) && this.assessmentResultMatches(existing, worker, fence, normalized.idempotencyKey, digest)) {
          await this.requireAssessmentWorkerIn(client, worker)
          return this.assessmentResultFrom(existing)
        }
        throw new ProductConflict("Assessment result is already final.")
      }
      if (lease.state !== "leased" || !lease.live) throw new AuthorityDenied()
      if (existing || keyed) throw new ProductConflict("Assessment result conflicts with an existing result or idempotency key.")
      const resultId = randomUUID()
      const row = (await client.query(`INSERT INTO wcb_seller_assessment_results(result_id,assessment_request_id,submission_id,seller_user_id,source_project_id,source_revision_id,source_content_hash,submission_snapshot_hash,review_decision_id,admitted_by,admission_created_at,worker_id,lease_generation,result_status,assessment_metadata,artifact_refs,result_digest,idempotency_key,completed_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,clock_timestamp()) RETURNING *`, [resultId, fence.assessmentJobId, request.submission_id, request.seller_user_id, request.source_project_id, request.source_revision_id, request.source_content_hash, request.submission_snapshot_hash, request.review_decision_id, request.admitted_by, request.created_at, worker.workerId, fence.generation, normalized.status, JSON.stringify(normalized.metadata), JSON.stringify(normalized.artifactRefs), digest, normalized.idempotencyKey])).rows[0]
      const completed = await client.query(`UPDATE wcb_seller_assessment_leases SET state='completed',completed_at=$4
        WHERE assessment_request_id=$1 AND worker_id=$2 AND generation=$3 AND state='leased' AND lease_until>clock_timestamp()`, [fence.assessmentJobId, worker.workerId, fence.generation, row.completed_at])
      if (!completed.rowCount) throw new AuthorityDenied()
      await this.requireAssessmentWorkerIn(client, worker)
      return this.assessmentResultFrom(row)
    })
  }

  async promoteAssessmentResult(operator: ServerSession, input: { resultId: string; assessmentJobId: string; submissionId: string; sellerUserId: string; snapshotHash: string; catalogProjectId: string; version: string; idempotencyKey: string }): Promise<Readonly<{ promotion: SellerReleasePromotion; release: ProjectRelease }>> {
    identifier(input.resultId); identifier(input.assessmentJobId); identifier(input.submissionId); identifier(input.sellerUserId); identifier(input.catalogProjectId)
    if (!/^[a-f0-9]{64}$/.test(input.snapshotHash)) throw new Error("Invalid promotion snapshot.")
    const version = cleanText(input.version, "release version", 100), key = cleanKey(input.idempotencyKey)
    return pgTransaction(this.pool, async client => {
      await this.requireOperatorIn(client, operator)
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,96))", [input.resultId])
      const row = (await client.query(`SELECT ar.*,req.status AS request_status,req.submission_id AS request_submission_id,req.seller_user_id AS request_seller_user_id,
        req.source_project_id AS request_source_project_id,req.source_revision_id AS request_source_revision_id,req.source_content_hash AS request_source_content_hash,
        req.submission_snapshot_hash AS request_snapshot_hash,req.review_decision_id AS request_review_decision_id,
        s.seller_application_id,s.workspace_id,s.source_project_id AS submission_source_project_id,s.source_revision_id AS submission_source_revision_id,
        s.source_content_hash AS submission_source_content_hash,s.snapshot_hash AS immutable_snapshot_hash,s.files AS submission_files,s.history AS submission_history,
        d.decision,d.submission_id AS decision_submission_id,d.seller_user_id AS decision_seller_user_id,d.source_project_id AS decision_source_project_id,
        d.source_revision_id AS decision_source_revision_id,d.source_content_hash AS decision_source_content_hash,d.submission_snapshot_hash AS decision_snapshot_hash,
        l.state AS lease_state,l.worker_id AS lease_worker_id,l.generation AS current_generation
        FROM wcb_seller_assessment_results ar JOIN wcb_seller_assessment_requests req ON req.assessment_request_id=ar.assessment_request_id
        JOIN wcb_seller_submissions s ON s.submission_id=ar.submission_id JOIN wcb_seller_review_decisions d ON d.decision_id=ar.review_decision_id
        JOIN wcb_seller_assessment_leases l ON l.assessment_request_id=ar.assessment_request_id WHERE ar.result_id=$1 FOR SHARE`, [input.resultId])).rows[0]
      if (!row) throw new AuthorityDenied()
      const exact = row.result_status === "passed" && String(row.assessment_request_id) === input.assessmentJobId && String(row.submission_id) === input.submissionId && String(row.seller_user_id) === input.sellerUserId && String(row.submission_snapshot_hash) === input.snapshotHash
        && row.request_status === "requested" && String(row.request_submission_id) === input.submissionId && String(row.request_seller_user_id) === input.sellerUserId && String(row.request_source_project_id) === String(row.source_project_id) && String(row.request_source_revision_id) === String(row.source_revision_id) && String(row.request_source_content_hash) === String(row.source_content_hash) && String(row.request_snapshot_hash) === input.snapshotHash && String(row.request_review_decision_id) === String(row.review_decision_id)
        && String(row.submission_source_project_id) === String(row.source_project_id) && String(row.submission_source_revision_id) === String(row.source_revision_id) && String(row.submission_source_content_hash) === String(row.source_content_hash) && String(row.immutable_snapshot_hash) === input.snapshotHash
        && row.decision === "approved_for_next_stage" && String(row.decision_submission_id) === input.submissionId && String(row.decision_seller_user_id) === input.sellerUserId && String(row.decision_source_project_id) === String(row.source_project_id) && String(row.decision_source_revision_id) === String(row.source_revision_id) && String(row.decision_source_content_hash) === String(row.source_content_hash) && String(row.decision_snapshot_hash) === input.snapshotHash
        && row.lease_state === "completed" && String(row.lease_worker_id) === String(row.worker_id) && String(row.current_generation) === String(row.lease_generation)
      if (!exact) throw new ProductConflict("Promotion references do not match one passed immutable assessment result.")

      const byKey = (await client.query("SELECT * FROM wcb_seller_release_promotions WHERE promoted_by=$1 AND idempotency_key=$2 FOR SHARE", [operator.userId, key])).rows[0]
      const existing = (await client.query("SELECT * FROM wcb_seller_release_promotions WHERE result_id=$1 FOR SHARE", [input.resultId])).rows[0]
      if (byKey || existing) {
        if (!byKey || !existing || String(byKey.promotion_id) !== String(existing.promotion_id) || String(existing.assessment_request_id) !== input.assessmentJobId || String(existing.submission_id) !== input.submissionId || String(existing.seller_user_id) !== input.sellerUserId || String(existing.submission_snapshot_hash) !== input.snapshotHash || String(existing.catalog_project_id) !== input.catalogProjectId || String(existing.version) !== version || String(existing.idempotency_key) !== key) throw new ProductConflict("Assessment result already has a conflicting promotion.")
        const releaseRow = (await client.query("SELECT * FROM wcb_project_releases WHERE release_id=$1 AND catalog_project_id=$2 FOR SHARE", [existing.release_id, existing.catalog_project_id])).rows[0]
        if (!releaseRow || String(releaseRow.source_project_id) !== String(existing.source_project_id) || String(releaseRow.source_revision_id) !== String(existing.source_revision_id) || String(releaseRow.source_content_hash) !== String(existing.source_content_hash) || String(releaseRow.snapshot_hash) !== String(existing.submission_snapshot_hash)) throw new Error("Promoted release provenance is inconsistent.")
        await this.requireOperatorIn(client, operator)
        return Object.freeze({ promotion: this.sellerReleasePromotionFrom(existing), release: releaseFrom(releaseRow as ReleaseRow) })
      }

      const catalog = (await client.query("SELECT * FROM wcb_catalog_projects WHERE catalog_project_id=$1 AND status='active' FOR UPDATE", [input.catalogProjectId])).rows[0]
      if (!catalog || String(catalog.source_project_id) !== String(row.source_project_id) || String(catalog.owner_workspace_id) !== String(row.workspace_id) || String(catalog.created_by) !== input.sellerUserId) throw new ProductConflict("Promotion catalog does not belong to the assessed seller snapshot.")
      const files = filesFrom(row.submission_files), history = structuredClone(row.submission_history) as RevisionLedger
      if (verifyHistory(String(row.source_project_id), files, history) !== String(row.source_revision_id)) throw new Error("Promoted submission history integrity failed.")
      const head = history.revisions.find(item => item.revisionId === String(row.source_revision_id))
      if (!head || head.contentHash !== String(row.source_content_hash) || snapshotHash({ projectId: String(row.source_project_id), revisionId: String(row.source_revision_id), contentHash: String(row.source_content_hash), files, history }) !== input.snapshotHash) throw new Error("Promoted submission snapshot integrity failed.")
      if ((await client.query("SELECT release_id FROM wcb_project_releases WHERE catalog_project_id=$1 AND version=$2 FOR SHARE", [input.catalogProjectId, version])).rowCount) throw new ProductConflict("Release version already exists.")

      const releaseId = randomUUID(), promotionId = randomUUID()
      const releaseRow = (await client.query(`INSERT INTO wcb_project_releases(release_id,catalog_project_id,version,status,source_project_id,source_revision_id,source_content_hash,snapshot_hash,files,history,created_by,created_at)
        VALUES($1,$2,$3,'published',$4,$5,$6,$7,$8,$9,$10,clock_timestamp()) RETURNING *`, [releaseId, input.catalogProjectId, version, row.source_project_id, row.source_revision_id, row.source_content_hash, input.snapshotHash, JSON.stringify(encodeFiles(files)), JSON.stringify(history), operator.userId])).rows[0]
      const promotionRow = (await client.query(`INSERT INTO wcb_seller_release_promotions(promotion_id,result_id,assessment_request_id,submission_id,seller_user_id,source_project_id,source_revision_id,source_content_hash,submission_snapshot_hash,review_decision_id,catalog_project_id,release_id,version,promoted_by,idempotency_key,created_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,clock_timestamp()) RETURNING *`, [promotionId, input.resultId, input.assessmentJobId, input.submissionId, input.sellerUserId, row.source_project_id, row.source_revision_id, row.source_content_hash, input.snapshotHash, row.review_decision_id, input.catalogProjectId, releaseId, version, operator.userId, key])).rows[0]
      await this.requireOperatorIn(client, operator)
      return Object.freeze({ promotion: this.sellerReleasePromotionFrom(promotionRow), release: releaseFrom(releaseRow as ReleaseRow) })
    })
  }

  async createCatalogProject(session: ServerSession, workspaceId: string, sourceProjectId: string, input: { slug: string; title: string; summary: string; publicMetadata?: Record<string, unknown> }): Promise<CatalogProject> {
    identifier(workspaceId); identifier(sourceProjectId)
    const grant = await this.access.grant(session, sourceProjectId, "source")
    if (grant.workspaceId !== workspaceId) throw new AuthorityDenied()
    const record: CatalogProject = Object.freeze({ catalogProjectId: randomUUID(), sourceProjectId, ownerWorkspaceId: workspaceId, slug: cleanSlug(input.slug), title: cleanText(input.title, "title", 200), summary: cleanText(input.summary, "summary", 2000), status: "active", publicMetadata: jsonObject(input.publicMetadata, "public metadata") })
    await pgTransaction(this.pool, async client => {
      await this.access.requireWorkspaceIn(client, session, workspaceId); await this.access.authorize(client, grant, "source")
      await client.query("INSERT INTO wcb_catalog_projects(catalog_project_id,source_project_id,owner_workspace_id,created_by,slug,title,summary,status,public_metadata) VALUES($1,$2,$3,$4,$5,$6,$7,'active',$8)", [record.catalogProjectId, sourceProjectId, workspaceId, session.userId, record.slug, record.title, record.summary, JSON.stringify(record.publicMetadata)])
      await this.access.authorize(client, grant, "source"); await this.access.requireWorkspaceIn(client, session, workspaceId)
    })
    return record
  }

  async publishRelease(session: ServerSession, catalogProjectId: string, version: string): Promise<ProjectRelease> {
    identifier(catalogProjectId); const cleanVersion = cleanText(version, "release version", 100)
    const catalog = (await this.pool.query("SELECT source_project_id,owner_workspace_id FROM wcb_catalog_projects WHERE catalog_project_id=$1 AND status='active'", [catalogProjectId])).rows[0]
    if (!catalog) throw new AuthorityDenied()
    const sourceProjectId = String(catalog.source_project_id), workspaceId = String(catalog.owner_workspace_id), grant = await this.access.grant(session, sourceProjectId, "source")
    if (grant.workspaceId !== workspaceId) throw new AuthorityDenied()
    return pgTransaction(this.pool, async client => {
      const locked = (await client.query("SELECT source_project_id,owner_workspace_id FROM wcb_catalog_projects WHERE catalog_project_id=$1 AND status='active' FOR UPDATE", [catalogProjectId])).rows[0]
      if (!locked || locked.source_project_id !== sourceProjectId || locked.owner_workspace_id !== workspaceId) throw new AuthorityDenied()
      await this.access.requireWorkspaceIn(client, session, workspaceId); await this.access.authorize(client, grant, "source")
      const row = (await client.query("SELECT revision,files,history FROM wcb_projects WHERE project_id=$1 AND workspace_id=$2 AND NOT deleted FOR SHARE", [sourceProjectId, workspaceId])).rows[0]
      if (!row?.revision || !row.files || !row.history) throw new AuthorityDenied()
      const files = new Map<string, Buffer>(Object.entries(row.files as Record<string, unknown>).map(([file, base64]) => [file, Buffer.from(String(base64), "base64")]))
      const history = structuredClone(row.history) as RevisionLedger; boundedHistory(history)
      if (verifyHistory(sourceProjectId, files, history) !== row.revision) throw new Error("Stored source integrity failed.")
      const head = history.revisions.at(-1)!, releaseId = randomUUID(), created = new Date()
      const immutable = snapshotHash({ projectId: sourceProjectId, revisionId: row.revision, contentHash: head.contentHash, files, history })
      await this.access.authorize(client, grant, "source"); await this.access.requireWorkspaceIn(client, session, workspaceId)
      const inserted = (await client.query(`INSERT INTO wcb_project_releases(release_id,catalog_project_id,version,status,source_project_id,source_revision_id,source_content_hash,snapshot_hash,files,history,created_by,created_at)
        VALUES($1,$2,$3,'published',$4,$5,$6,$7,$8,$9,$10,$11) RETURNING created_at`, [releaseId, catalogProjectId, cleanVersion, sourceProjectId, row.revision, head.contentHash, immutable, JSON.stringify(encodeFiles(files)), JSON.stringify(history), session.userId, created])).rows[0]
      return Object.freeze({ releaseId, catalogProjectId, version: cleanVersion, status: "published", sourceProjectId, sourceRevisionId: String(row.revision), sourceContentHash: head.contentHash, snapshotHash: immutable, createdAt: iso(inserted.created_at) })
    })
  }

  async saveListing(session: ServerSession, catalogProjectId: string, releaseId: string, input: { slug: string; title: string; summary: string; status: Listing["status"]; availability: Listing["availability"]; tags?: string[]; demoMetadata?: Record<string, unknown> }): Promise<Listing> {
    identifier(catalogProjectId); identifier(releaseId)
    if (!( ["draft", "published", "archived"] as string[]).includes(input.status) || !( ["available", "unavailable"] as string[]).includes(input.availability)) throw new Error("Invalid listing state.")
    const listing = { slug: cleanSlug(input.slug), title: cleanText(input.title, "listing title", 200), summary: cleanText(input.summary, "listing summary", 2000), status: input.status, availability: input.availability, tags: cleanTags(input.tags), demoMetadata: jsonObject(input.demoMetadata, "demo metadata") }
    return pgTransaction(this.pool, async client => {
      const catalog = (await client.query("SELECT owner_workspace_id FROM wcb_catalog_projects WHERE catalog_project_id=$1 FOR UPDATE", [catalogProjectId])).rows[0]
      if (!catalog) throw new AuthorityDenied()
      await this.access.requireWorkspaceIn(client, session, String(catalog.owner_workspace_id))
      if (!(await client.query("SELECT release_id FROM wcb_project_releases WHERE release_id=$1 AND catalog_project_id=$2", [releaseId, catalogProjectId])).rowCount) throw new ProductConflict("Listing release does not belong to its catalog project.")
      const prior = (await client.query("SELECT listing_id,release_id,status FROM wcb_listings WHERE catalog_project_id=$1 FOR UPDATE", [catalogProjectId])).rows[0]
      if (!prior && listing.status === "published") throw new AuthorityDenied()
      if (prior && (String(prior.release_id) !== releaseId || listing.status === "published" && prior.status !== "published" || prior.status === "published" && listing.status !== "published")) throw new ProductConflict("Listing release/publication state requires an explicit operator decision.")
      const listingId = prior ? String(prior.listing_id) : randomUUID()
      const row = (await client.query(`INSERT INTO wcb_listings(listing_id,catalog_project_id,release_id,slug,title,summary,status,availability,tags,demo_metadata,updated_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,clock_timestamp()) ON CONFLICT(catalog_project_id) DO UPDATE SET release_id=excluded.release_id,slug=excluded.slug,title=excluded.title,summary=excluded.summary,status=excluded.status,availability=excluded.availability,tags=excluded.tags,demo_metadata=excluded.demo_metadata,updated_at=excluded.updated_at RETURNING updated_at`, [listingId, catalogProjectId, releaseId, listing.slug, listing.title, listing.summary, listing.status, listing.availability, JSON.stringify(listing.tags), JSON.stringify(listing.demoMetadata)])).rows[0]
      await this.access.requireWorkspaceIn(client, session, String(catalog.owner_workspace_id))
      return Object.freeze({ listingId, catalogProjectId, releaseId, ...listing, updatedAt: iso(row.updated_at) })
    })
  }

  async publishPromotedListing(operator: ServerSession, input: { promotionId: string; sellerUserId: string; catalogProjectId: string; releaseId: string; idempotencyKey: string; slug: string; title: string; summary: string; tags?: string[]; demoMetadata?: Record<string, unknown> }): Promise<Readonly<{ publication: ListingPublication; listing: Listing }>> {
    identifier(input.promotionId); identifier(input.sellerUserId); identifier(input.catalogProjectId); identifier(input.releaseId)
    const key = cleanKey(input.idempotencyKey), listing = { slug: cleanSlug(input.slug), title: cleanText(input.title, "listing title", 200), summary: cleanText(input.summary, "listing summary", 2000), tags: cleanTags(input.tags), demoMetadata: jsonObject(input.demoMetadata, "demo metadata") }
    return pgTransaction(this.pool, async client => {
      await this.requireOperatorIn(client, operator)
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,97))", [input.catalogProjectId])
      const lineage = (await client.query(`SELECT p.*,r.status AS release_status,r.source_project_id AS release_source_project_id,r.source_revision_id AS release_source_revision_id,
        r.source_content_hash AS release_source_content_hash,r.snapshot_hash AS release_snapshot_hash,c.source_project_id AS catalog_source_project_id,
        c.created_by,c.status AS catalog_status
        FROM wcb_seller_release_promotions p JOIN wcb_project_releases r ON r.release_id=p.release_id AND r.catalog_project_id=p.catalog_project_id
        JOIN wcb_catalog_projects c ON c.catalog_project_id=p.catalog_project_id WHERE p.promotion_id=$1 FOR SHARE`, [input.promotionId])).rows[0]
      const exact = lineage && String(lineage.seller_user_id) === input.sellerUserId && String(lineage.catalog_project_id) === input.catalogProjectId && String(lineage.release_id) === input.releaseId
        && lineage.release_status === "published" && lineage.catalog_status === "active" && String(lineage.release_source_project_id) === String(lineage.source_project_id)
        && String(lineage.release_source_revision_id) === String(lineage.source_revision_id) && String(lineage.release_source_content_hash) === String(lineage.source_content_hash)
        && String(lineage.release_snapshot_hash) === String(lineage.submission_snapshot_hash) && String(lineage.catalog_source_project_id) === String(lineage.source_project_id)
        && String(lineage.created_by) === input.sellerUserId
      if (!exact) throw new ProductConflict("Listing publication does not match one promoted immutable release.")

      const byKey = (await client.query("SELECT * FROM wcb_listing_publications WHERE published_by=$1 AND idempotency_key=$2 FOR SHARE", [operator.userId, key])).rows[0]
      const existing = (await client.query("SELECT * FROM wcb_listing_publications WHERE promotion_id=$1 FOR SHARE", [input.promotionId])).rows[0]
      if (byKey || existing) {
        if (!byKey || !existing || String(byKey.publication_id) !== String(existing.publication_id) || String(existing.seller_user_id) !== input.sellerUserId || String(existing.catalog_project_id) !== input.catalogProjectId || String(existing.release_id) !== input.releaseId || String(existing.idempotency_key) !== key) throw new ProductConflict("Promoted release already has a conflicting Listing publication.")
        const listingRow = (await client.query("SELECT * FROM wcb_listings WHERE listing_id=$1 AND catalog_project_id=$2 AND release_id=$3 AND status='published' FOR SHARE", [existing.listing_id, input.catalogProjectId, input.releaseId])).rows[0]
        if (!listingRow) throw new ProductConflict("Published Listing binding is inconsistent.")
        await this.requireOperatorIn(client, operator)
        return Object.freeze({ publication: this.listingPublicationFrom(existing), listing: this.listingFrom(listingRow) })
      }
      if ((await client.query("SELECT listing_id FROM wcb_listings WHERE catalog_project_id=$1 OR slug=$2 FOR SHARE", [input.catalogProjectId, listing.slug])).rowCount) throw new ProductConflict("Catalog project or slug already has a Listing.")

      const listingId = randomUUID(), publicationId = randomUUID()
      const listingRow = (await client.query(`INSERT INTO wcb_listings(listing_id,catalog_project_id,release_id,slug,title,summary,status,availability,tags,demo_metadata,updated_at)
        VALUES($1,$2,$3,$4,$5,$6,'published','available',$7,$8,clock_timestamp()) RETURNING *`, [listingId, input.catalogProjectId, input.releaseId, listing.slug, listing.title, listing.summary, JSON.stringify(listing.tags), JSON.stringify(listing.demoMetadata)])).rows[0]
      const publicationRow = (await client.query(`INSERT INTO wcb_listing_publications(publication_id,promotion_id,result_id,seller_user_id,catalog_project_id,release_id,listing_id,status,published_by,idempotency_key,published_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,'published',$8,$9,clock_timestamp()) RETURNING *`, [publicationId, input.promotionId, lineage.result_id, input.sellerUserId, input.catalogProjectId, input.releaseId, listingId, operator.userId, key])).rows[0]
      await this.requireOperatorIn(client, operator)
      return Object.freeze({ publication: this.listingPublicationFrom(publicationRow), listing: this.listingFrom(listingRow) })
    })
  }

  async browse(input: { query?: string; tags?: string[]; limit?: number } = {}) {
    const query = input.query?.trim().toLowerCase() ?? "", tags = cleanTags(input.tags), limit = Math.min(Math.max(input.limit ?? 24, 1), 100)
    if (query.length > 100) throw new Error("Search query is too long.")
    const rows = (await this.pool.query(`SELECT l.*,r.version,r.source_revision_id,r.snapshot_hash,c.public_metadata FROM wcb_listings l
      JOIN wcb_project_releases r ON r.release_id=l.release_id JOIN wcb_catalog_projects c ON c.catalog_project_id=l.catalog_project_id
      WHERE l.status='published' AND l.availability='available' AND c.status='active' ORDER BY l.updated_at DESC`)).rows
    return rows.map(row => this.publicListing(row)).filter(item => (!query || `${item.title} ${item.summary} ${item.slug} ${item.tags.join(" ")}`.toLowerCase().includes(query)) && tags.every(tag => item.tags.includes(tag))).slice(0, limit)
  }

  async listingDetail(reference: string) {
    if (typeof reference !== "string" || !reference || reference.length > 100) throw new Error("Invalid listing reference.")
    const row = (await this.pool.query(`SELECT l.*,r.version,r.status AS release_status,r.source_project_id,r.source_revision_id,r.source_content_hash,r.snapshot_hash,r.created_at AS release_created_at,c.public_metadata
      FROM wcb_listings l JOIN wcb_project_releases r ON r.release_id=l.release_id JOIN wcb_catalog_projects c ON c.catalog_project_id=l.catalog_project_id
      WHERE (l.listing_id::text=$1 OR l.slug=$1) AND l.status='published' AND c.status='active'`, [reference])).rows[0]
    if (!row) return undefined
    return Object.freeze({ ...this.publicListing(row), release: releaseFrom({ ...row, created_at: row.release_created_at } as ReleaseRow), publicMetadata: structuredClone(row.public_metadata) as Record<string, unknown> })
  }

  private publicListing(row: Record<string, unknown>): Listing & { releaseVersion: string; sourceRevisionId: string; snapshotHash: string } {
    return Object.freeze({ listingId: String(row.listing_id), catalogProjectId: String(row.catalog_project_id), releaseId: String(row.release_id), slug: String(row.slug), title: String(row.title), summary: String(row.summary), status: row.status as Listing["status"], availability: row.availability as Listing["availability"], tags: structuredClone(row.tags) as string[], demoMetadata: structuredClone(row.demo_metadata) as Record<string, unknown>, updatedAt: iso(row.updated_at), releaseVersion: String(row.version), sourceRevisionId: String(row.source_revision_id), snapshotHash: String(row.snapshot_hash) })
  }

  private listingFrom(row: Record<string, unknown>): Listing {
    const tags = typeof row.tags === "string" ? JSON.parse(row.tags) : structuredClone(row.tags ?? [])
    const demoMetadata = typeof row.demo_metadata === "string" ? JSON.parse(row.demo_metadata) : structuredClone(row.demo_metadata ?? {})
    return Object.freeze({ listingId: String(row.listing_id), catalogProjectId: String(row.catalog_project_id), releaseId: String(row.release_id), slug: String(row.slug), title: String(row.title), summary: String(row.summary), status: row.status as Listing["status"], availability: row.availability as Listing["availability"], tags, demoMetadata, updatedAt: iso(row.updated_at) })
  }

  async grantTestEntitlement(operator: ServerSession, beneficiaryUserId: string, releaseId: string, idempotencyKey: string): Promise<LicenseEntitlement> {
    identifier(beneficiaryUserId); identifier(releaseId); const key = cleanKey(idempotencyKey), providerReference = `test:${beneficiaryUserId}:${key}`
    return pgTransaction(this.pool, async client => {
      await this.requireOperatorIn(client, operator)
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,92))", [`${beneficiaryUserId}:${releaseId}`])
      const known = await client.query("SELECT user_id FROM wcb_sessions WHERE user_id=$1 UNION SELECT user_id FROM wcb_identity_accounts WHERE user_id=$1", [beneficiaryUserId])
      if (!known.rowCount) throw new AuthorityDenied()
      const available = await client.query(`SELECT r.release_id FROM wcb_project_releases r JOIN wcb_listings l ON l.release_id=r.release_id
        WHERE r.release_id=$1 AND r.status='published' AND l.status='published' AND l.availability='available'`, [releaseId])
      if (!available.rowCount) throw new EntitlementUnavailable("Release is not currently available.")
      const byReference = (await client.query("SELECT * FROM wcb_license_entitlements WHERE provider_reference=$1 FOR UPDATE", [providerReference])).rows[0]
      if (byReference) {
        if (String(byReference.user_id) !== beneficiaryUserId || String(byReference.release_id) !== releaseId) throw new ProductConflict("Idempotency key was already used for a different entitlement.")
        await this.requireOperatorIn(client, operator); return this.entitlement(byReference)
      }
      const existing = (await client.query("SELECT * FROM wcb_license_entitlements WHERE user_id=$1 AND release_id=$2 AND provider='test' FOR UPDATE", [beneficiaryUserId, releaseId])).rows[0]
      if (existing) { await this.requireOperatorIn(client, operator); return this.entitlement(existing) }
      const entitlementId = randomUUID()
      const row = (await client.query(`INSERT INTO wcb_license_entitlements(entitlement_id,user_id,release_id,provider,provider_reference,status,granted_at)
        VALUES($1,$2,$3,'test',$4,'active',clock_timestamp()) RETURNING *`, [entitlementId, beneficiaryUserId, releaseId, providerReference])).rows[0]
      await this.requireOperatorIn(client, operator); return this.entitlement(row)
    })
  }

  async grantTestEntitlementForSelf(operator: ServerSession, releaseId: string, idempotencyKey: string) {
    return this.grantTestEntitlement(operator, operator.userId, releaseId, idempotencyKey)
  }

  async transitionTestEntitlement(operator: ServerSession, entitlementId: string, status: "revoked" | "invalid"): Promise<LicenseEntitlement> {
    identifier(entitlementId)
    if (!["revoked", "invalid"].includes(status)) throw new Error("Invalid entitlement state.")
    return pgTransaction(this.pool, async client => {
      await this.requireOperatorIn(client, operator)
      const current = (await client.query("SELECT * FROM wcb_license_entitlements WHERE entitlement_id=$1 AND provider='test' FOR UPDATE", [entitlementId])).rows[0]
      if (!current) throw new EntitlementUnavailable("TEST entitlement is unavailable.")
      if (current.status === status) return this.entitlement(current)
      if (current.status !== "active") throw new EntitlementUnavailable(`Entitlement is ${String(current.status)}.`)
      const row = (await client.query("UPDATE wcb_license_entitlements SET status=$2,revoked_at=clock_timestamp() WHERE entitlement_id=$1 RETURNING *", [entitlementId, status])).rows[0]
      await this.requireOperatorIn(client, operator); return this.entitlement(row)
    })
  }

  async purchases(session: ServerSession) {
    return pgTransaction(this.pool, async client => {
      await this.requireSessionIn(client, session)
      const rows = (await client.query("SELECT * FROM wcb_license_entitlements WHERE user_id=$1 ORDER BY granted_at DESC", [session.userId])).rows
      await this.requireSessionIn(client, session); return rows.map(row => this.entitlement(row))
    })
  }

  async materialize(session: ServerSession, workspaceId: string, entitlementId: string, idempotencyKey: string, name = "Purchased project"): Promise<WorkspaceProject> {
    identifier(workspaceId); identifier(entitlementId); const key = cleanKey(idempotencyKey), projectName = cleanText(name, "workspace project name", 200)
    const reservation = await pgTransaction(this.pool, async client => {
      await this.access.requireWorkspaceIn(client, session, workspaceId)
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,91))", [`${session.userId}:${entitlementId}`])
      const byKey = (await client.query("SELECT * FROM wcb_entitlement_materializations WHERE user_id=$1 AND idempotency_key=$2 FOR UPDATE", [session.userId, key])).rows[0]
      if (byKey && (String(byKey.entitlement_id) !== entitlementId || String(byKey.workspace_id) !== workspaceId)) throw new ProductConflict("Idempotency key was already used for a different materialization.")
      const entitlement = (await client.query("SELECT entitlement_id,status FROM wcb_license_entitlements WHERE entitlement_id=$1 AND user_id=$2 FOR SHARE", [entitlementId, session.userId])).rows[0]
      if (!entitlement) throw new AuthorityDenied()
      if (entitlement.status !== "active") throw new EntitlementUnavailable(`Entitlement is ${String(entitlement.status)}.`)
      let row = byKey ?? (await client.query("SELECT * FROM wcb_entitlement_materializations WHERE entitlement_id=$1 FOR UPDATE", [entitlementId])).rows[0]
      if (row && String(row.user_id) !== session.userId) throw new AuthorityDenied()
      if (row && String(row.workspace_id) !== workspaceId) throw new ProductConflict("Entitlement was already materialized into a different workspace.")
      if (!row) row = (await client.query(`INSERT INTO wcb_entitlement_materializations(entitlement_id,workspace_id,user_id,workspace_project_id,idempotency_key,project_name,status,created_at,updated_at)
        VALUES($1,$2,$3,$4,$5,$6,'pending',clock_timestamp(),clock_timestamp()) RETURNING *`, [entitlementId, workspaceId, session.userId, randomUUID(), key, projectName])).rows[0]
      else if (row.status === "failed") row = (await client.query("UPDATE wcb_entitlement_materializations SET status='pending',last_error=NULL,project_name=$2,updated_at=clock_timestamp() WHERE entitlement_id=$1 RETURNING *", [entitlementId, projectName])).rows[0]
      await this.access.requireWorkspaceIn(client, session, workspaceId)
      return row
    })
    if (reservation.status !== "ready") {
      await this.faults.afterMaterializationReservation?.()
      await this.reconcileOne(entitlementId)
    }
    const workspace = await this.workspaceProject(session, String(reservation.workspace_project_id))
    if (!workspace) throw new EntitlementUnavailable("Materialization did not reach a ready state.")
    return workspace
  }

  async reconcilePending(limit = 20): Promise<MaterializationReconciliation> {
    const bounded = Math.min(Math.max(Math.trunc(limit), 1), 50)
    const ids = (await this.pool.query("SELECT entitlement_id FROM wcb_entitlement_materializations WHERE status='pending' ORDER BY created_at LIMIT $1", [bounded])).rows.map(row => String(row.entitlement_id))
    let ready = 0, failed = 0
    for (const id of ids) {
      try { const state = await this.reconcileOne(id); if (state === "ready") ready++; else if (state === "failed") failed++ }
      catch { await this.markFailed(id, "reconciliation-failed"); failed++ }
    }
    const pending = Number((await this.pool.query("SELECT count(*) AS n FROM wcb_entitlement_materializations WHERE status='pending'")).rows[0].n)
    return Object.freeze({ examined: ids.length, ready, failed, pending })
  }

  private async reconcileOne(entitlementId: string): Promise<"ready" | "failed" | "unchanged"> {
    return pgTransaction(this.pool, async client => {
      const row = (await client.query(`SELECT m.*,m.status AS materialization_status,e.release_id,e.status AS entitlement_status,r.catalog_project_id,r.version,r.source_project_id,r.source_revision_id,r.source_content_hash,r.snapshot_hash,r.files,r.history,r.created_at AS release_created_at
        FROM wcb_entitlement_materializations m JOIN wcb_license_entitlements e ON e.entitlement_id=m.entitlement_id JOIN wcb_project_releases r ON r.release_id=e.release_id
        WHERE m.entitlement_id=$1 FOR UPDATE`, [entitlementId])).rows[0] as ReleaseRow & Record<string, unknown> | undefined
      if (!row || row.materialization_status === "ready" || row.materialization_status === "failed") return "unchanged"
      await client.query("UPDATE wcb_entitlement_materializations SET attempts=attempts+1,updated_at=clock_timestamp() WHERE entitlement_id=$1", [entitlementId])
      if (row.entitlement_status !== "active") { await client.query("UPDATE wcb_entitlement_materializations SET status='failed',last_error='entitlement-not-active',updated_at=clock_timestamp() WHERE entitlement_id=$1", [entitlementId]); return "failed" }
      const membership = await client.query("SELECT workspace_id FROM wcb_workspace_members WHERE workspace_id=$1 AND user_id=$2 AND active AND role IN ('owner','editor') FOR SHARE", [row.workspace_id, row.user_id])
      if (!membership.rowCount) { await client.query("UPDATE wcb_entitlement_materializations SET status='failed',last_error='workspace-authority-unavailable',updated_at=clock_timestamp() WHERE entitlement_id=$1", [entitlementId]); return "failed" }
      const snapshot = this.decodeRelease({ ...row, created_at: row.release_created_at } as ReleaseRow), release = releaseFrom({ ...row, created_at: row.release_created_at } as ReleaseRow)
      const origin: ReleaseOrigin = Object.freeze({ entitlementId, releaseId: release.releaseId, catalogProjectId: release.catalogProjectId, sourceProjectId: release.sourceProjectId, sourceRevisionId: release.sourceRevisionId, sourceContentHash: release.sourceContentHash, releaseSnapshotHash: release.snapshotHash })
      const workspaceProjectId = String(row.workspace_project_id), canonical = snapshot.history.sourceDirectory ?? "src", editable = new Map<string, string>()
      for (const [file, bytes] of snapshot.files) if (sourceMember(file, canonical, snapshot.history.sourceScope)) editable.set(file, new TextDecoder("utf-8", { fatal: true }).decode(bytes))
      const contentHash = treeHash(editable)
      if (contentHash !== snapshot.contentHash || origin.sourceContentHash !== snapshot.contentHash || origin.sourceRevisionId !== snapshot.revisionId || origin.sourceProjectId !== snapshot.projectId) throw new Error("Release source provenance does not match its immutable snapshot.")
      const history: RevisionLedger = { schema: 1, ...(snapshot.history.importOrigin ? { importOrigin: structuredClone(snapshot.history.importOrigin) } : {}), releaseOrigin: structuredClone(origin), sourceScope: snapshot.history.sourceScope ?? 2, ...(canonical === "src" ? {} : { sourceDirectory: canonical }), projectId: workspaceProjectId, revisions: [{ revisionId: `rev_${randomUUID()}`, projectId: workspaceProjectId, parentRevisionId: null, createdAt: new Date().toISOString(), actor: String(row.user_id), producer: "system", contentHash }], transactions: [], past: [], future: [] }
      boundedHistory(history)
      await this.source.createMaterializedIn(client, { userId: String(row.user_id), workspaceId: String(row.workspace_id) }, workspaceProjectId, String(row.project_name), snapshot.files, history)
      await client.query("UPDATE wcb_entitlement_materializations SET status='ready',last_error=NULL,updated_at=clock_timestamp() WHERE entitlement_id=$1", [entitlementId])
      return "ready"
    })
  }

  private async markFailed(entitlementId: string, reason: string) {
    await this.pool.query("UPDATE wcb_entitlement_materializations SET status='failed',last_error=$2,updated_at=clock_timestamp() WHERE entitlement_id=$1 AND status='pending'", [entitlementId, reason])
  }

  async workspaceProject(session: ServerSession, workspaceProjectId: string): Promise<WorkspaceProject | undefined> {
    identifier(workspaceProjectId); const grant = await this.access.grant(session, workspaceProjectId, "inspect")
    const row = (await this.pool.query(`SELECT m.*,e.release_id,r.source_project_id,r.source_revision_id,r.source_content_hash,r.snapshot_hash
      FROM wcb_entitlement_materializations m JOIN wcb_license_entitlements e ON e.entitlement_id=m.entitlement_id JOIN wcb_project_releases r ON r.release_id=e.release_id
      WHERE m.workspace_project_id=$1 AND m.workspace_id=$2 AND m.status='ready'`, [workspaceProjectId, grant.workspaceId])).rows[0]
    if (!row || !await this.access.check(grant, "inspect")) return undefined
    return Object.freeze({ workspaceProjectId, workspaceId: String(row.workspace_id), entitlementId: String(row.entitlement_id), releaseId: String(row.release_id), sourceProjectId: String(row.source_project_id), sourceRevisionId: String(row.source_revision_id), sourceContentHash: String(row.source_content_hash), releaseSnapshotHash: String(row.snapshot_hash), createdAt: iso(row.created_at) })
  }

  async workspaceProjects(session: ServerSession): Promise<WorkspaceProject[]> {
    const ids = await pgTransaction(this.pool, async client => {
      await this.requireSessionIn(client, session)
      const rows = (await client.query("SELECT workspace_project_id FROM wcb_entitlement_materializations WHERE user_id=$1 AND status='ready' ORDER BY updated_at DESC LIMIT 100", [session.userId])).rows
      await this.requireSessionIn(client, session)
      return rows.map(row => String(row.workspace_project_id))
    })
    const result: WorkspaceProject[] = []
    for (const id of ids) {
      try { const project = await this.workspaceProject(session, id); if (project) result.push(project) }
      catch (error) { if (!(error instanceof AuthorityDenied)) throw error }
    }
    return result
  }

  private decodeRelease(row: ReleaseRow) {
    const history = structuredClone(row.history) as RevisionLedger; boundedHistory(history)
    const files = filesFrom(row.files), projectId = String(row.source_project_id), revisionId = String(row.source_revision_id), contentHash = String(row.source_content_hash)
    if (verifyHistory(projectId, files, history) !== revisionId) throw new Error("Stored release source/history integrity failed.")
    const snapshot = Object.freeze({ projectId, revisionId, contentHash, files, history })
    if (snapshotHash(snapshot) !== String(row.snapshot_hash)) throw new Error("Stored release snapshot integrity failed.")
    return snapshot
  }

  private entitlement(row: Record<string, unknown>): LicenseEntitlement {
    return Object.freeze({ entitlementId: String(row.entitlement_id), userId: String(row.user_id), releaseId: String(row.release_id), provider: String(row.provider), providerReference: String(row.provider_reference), status: row.status as LicenseEntitlement["status"], grantedAt: iso(row.granted_at), ...(row.revoked_at ? { revokedAt: iso(row.revoked_at) } : {}) })
  }

  private sellerApplicationFrom(row: Record<string, unknown>): SellerApplication {
    return Object.freeze({ applicationId: String(row.application_id), userId: String(row.user_id), status: row.status as SellerApplication["status"], createdAt: iso(row.created_at), updatedAt: iso(row.updated_at), ...(row.decided_at ? { decidedAt: iso(row.decided_at) } : {}), ...(row.decision_by ? { decidedBy: String(row.decision_by) } : {}) })
  }

  private sellerSubmissionFrom(row: Record<string, unknown>): SellerSubmission {
    return Object.freeze({ submissionId: String(row.submission_id), sellerApplicationId: String(row.seller_application_id), sellerUserId: String(row.seller_user_id), workspaceId: String(row.workspace_id), sourceProjectId: String(row.source_project_id), sourceRevisionId: String(row.source_revision_id), sourceContentHash: String(row.source_content_hash), snapshotHash: String(row.snapshot_hash), status: row.status as "pending_review", createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) })
  }

  private sellerReviewSelect() {
    return `SELECT s.submission_id,s.seller_application_id,s.seller_user_id,s.source_project_id,s.source_revision_id,s.source_content_hash,s.snapshot_hash,s.created_at,
      st.status AS submission_status,st.updated_at AS submission_updated_at,d.decision_id,d.decision,d.reviewer_user_id,d.idempotency_key,d.created_at AS decision_created_at,
      d.seller_application_id AS decision_seller_application_id,d.seller_user_id AS decision_seller_user_id,d.source_project_id AS decision_source_project_id,
      d.source_revision_id AS decision_source_revision_id,d.source_content_hash AS decision_source_content_hash,d.submission_snapshot_hash
      FROM wcb_seller_submissions s JOIN wcb_seller_submission_states st ON st.submission_id=s.submission_id
      LEFT JOIN wcb_seller_review_decisions d ON d.submission_id=s.submission_id`
  }

  private sellerReviewDecisionFrom(row: Record<string, unknown>): SellerReviewDecision {
    return Object.freeze({ decisionId: String(row.decision_id), submissionId: String(row.submission_id), sellerApplicationId: String(row.seller_application_id), sellerUserId: String(row.seller_user_id), sourceProjectId: String(row.source_project_id), sourceRevisionId: String(row.source_revision_id), sourceContentHash: String(row.source_content_hash), snapshotHash: String(row.submission_snapshot_hash), decision: row.decision as SellerReviewDecision["decision"], decidedBy: String(row.reviewer_user_id), createdAt: iso(row.created_at) })
  }

  private sellerAssessmentRequestFrom(row: Record<string, unknown>): SellerAssessmentRequest {
    return Object.freeze({ assessmentRequestId: String(row.assessment_request_id), submissionId: String(row.submission_id), sellerUserId: String(row.seller_user_id), sourceProjectId: String(row.source_project_id), sourceRevisionId: String(row.source_revision_id), sourceContentHash: String(row.source_content_hash), snapshotHash: String(row.submission_snapshot_hash), reviewDecisionId: String(row.review_decision_id), status: "requested", createdAt: iso(row.created_at) })
  }

  private async requireAssessmentWorkerIn(client: PoolClient, worker: AssessmentWorkerAuthority) {
    const row = await client.query("SELECT worker_id FROM wcb_assessment_workers WHERE worker_id=$1 AND credential_hash=$2 AND active FOR SHARE", [worker.workerId, sha256(worker.credential)])
    if (!row.rowCount) throw new AuthorityDenied()
  }

  private validateAssessmentFence(worker: AssessmentWorkerAuthority, fence: AssessmentJobFence) {
    identifier(fence.assessmentJobId); identifier(fence.submissionId); identifier(worker.workerId); assessmentCredential(worker.credential)
    if (!/^[a-f0-9]{64}$/.test(fence.snapshotHash) || !/^[1-9]\d{0,18}$/.test(fence.generation)) throw new AuthorityDenied()
  }

  private async assessmentRequestForClaim(client: PoolClient, assessmentJobId: string) {
    return (await client.query(`SELECT r.*,s.submission_id AS immutable_submission_id,s.seller_user_id AS immutable_seller_user_id,s.source_project_id AS immutable_source_project_id,
      s.source_revision_id AS immutable_source_revision_id,s.source_content_hash AS immutable_source_content_hash,s.snapshot_hash AS immutable_snapshot_hash,
      d.decision_id AS immutable_decision_id,d.submission_id AS decision_submission_id,d.seller_user_id AS decision_seller_user_id,d.source_project_id AS decision_source_project_id,
      d.source_revision_id AS decision_source_revision_id,d.source_content_hash AS decision_source_content_hash,d.submission_snapshot_hash AS decision_snapshot_hash,d.decision
      FROM wcb_seller_assessment_requests r JOIN wcb_seller_submissions s ON s.submission_id=r.submission_id
      JOIN wcb_seller_review_decisions d ON d.decision_id=r.review_decision_id WHERE r.assessment_request_id=$1`, [assessmentJobId])).rows[0]
  }

  private assertAssessmentRequestBinding(row: Record<string, unknown>, submissionId: string, sellerUserId: string, snapshot: string) {
    if (row.status !== "requested" || String(row.submission_id) !== submissionId || String(row.seller_user_id) !== sellerUserId || String(row.submission_snapshot_hash) !== snapshot || String(row.immutable_submission_id) !== submissionId || String(row.immutable_seller_user_id) !== sellerUserId || String(row.immutable_source_project_id) !== String(row.source_project_id) || String(row.immutable_source_revision_id) !== String(row.source_revision_id) || String(row.immutable_source_content_hash) !== String(row.source_content_hash) || String(row.immutable_snapshot_hash) !== snapshot || row.decision !== "approved_for_next_stage" || String(row.immutable_decision_id) !== String(row.review_decision_id) || String(row.decision_submission_id) !== submissionId || String(row.decision_seller_user_id) !== sellerUserId || String(row.decision_source_project_id) !== String(row.source_project_id) || String(row.decision_source_revision_id) !== String(row.source_revision_id) || String(row.decision_source_content_hash) !== String(row.source_content_hash) || String(row.decision_snapshot_hash) !== snapshot) throw new ProductConflict("Assessment job provenance does not match its immutable approved snapshot.")
  }

  private assertAssessmentLeaseBinding(lease: Record<string, unknown>, request: Record<string, unknown>) {
    if (String(lease.submission_id) !== String(request.submission_id) || String(lease.seller_user_id) !== String(request.seller_user_id) || String(lease.source_project_id) !== String(request.source_project_id) || String(lease.source_revision_id) !== String(request.source_revision_id) || String(lease.source_content_hash) !== String(request.source_content_hash) || String(lease.submission_snapshot_hash) !== String(request.submission_snapshot_hash)) throw new ProductConflict("Assessment lease provenance does not match its immutable request.")
  }

  private assessmentJobLeaseFrom(row: Record<string, unknown>): AssessmentJobLease {
    return Object.freeze({ assessmentJobId: String(row.assessment_request_id), submissionId: String(row.submission_id), sellerUserId: String(row.seller_user_id), sourceProjectId: String(row.source_project_id), sourceRevisionId: String(row.source_revision_id), sourceContentHash: String(row.source_content_hash), snapshotHash: String(row.submission_snapshot_hash), workerId: String(row.worker_id), generation: String(row.generation), claimedAt: iso(row.claimed_at), leaseExpiresAt: iso(row.lease_until), state: "leased" })
  }

  private assessmentJobCancellationFrom(row: Record<string, unknown>): AssessmentJobCancellation {
    return Object.freeze({ assessmentJobId: String(row.assessment_request_id), submissionId: String(row.submission_id), sellerUserId: String(row.seller_user_id), sourceProjectId: String(row.source_project_id), sourceRevisionId: String(row.source_revision_id), sourceContentHash: String(row.source_content_hash), snapshotHash: String(row.submission_snapshot_hash), workerId: String(row.worker_id), generation: String(row.generation), claimedAt: iso(row.claimed_at), leaseExpiresAt: iso(row.lease_until), cancelledAt: iso(row.cancelled_at), state: "cancelled" })
  }

  private assessmentResultMatches(row: Record<string, unknown>, worker: AssessmentWorkerAuthority, fence: AssessmentJobFence, key: string, digest: string) {
    return String(row.assessment_request_id) === fence.assessmentJobId && String(row.submission_id) === fence.submissionId && String(row.submission_snapshot_hash) === fence.snapshotHash && String(row.worker_id) === worker.workerId && String(row.lease_generation) === fence.generation && String(row.idempotency_key) === key && String(row.result_digest) === digest
  }

  private assessmentResultFrom(row: Record<string, unknown>): AssessmentResult {
    const metadata = typeof row.assessment_metadata === "string" ? JSON.parse(row.assessment_metadata) : structuredClone(row.assessment_metadata ?? {})
    const artifactRefs = typeof row.artifact_refs === "string" ? JSON.parse(row.artifact_refs) : structuredClone(row.artifact_refs ?? [])
    return Object.freeze({ resultId: String(row.result_id), assessmentJobId: String(row.assessment_request_id), submissionId: String(row.submission_id), sellerUserId: String(row.seller_user_id), sourceProjectId: String(row.source_project_id), sourceRevisionId: String(row.source_revision_id), sourceContentHash: String(row.source_content_hash), snapshotHash: String(row.submission_snapshot_hash), reviewDecisionId: String(row.review_decision_id), admittedBy: String(row.admitted_by), admissionCreatedAt: iso(row.admission_created_at), workerId: String(row.worker_id), leaseGeneration: String(row.lease_generation), status: row.result_status as AssessmentResultStatus, metadata: Object.freeze(metadata as Record<string, unknown>), artifactRefs: Object.freeze(artifactRefs as string[]), completedAt: iso(row.completed_at) })
  }

  private sellerReleasePromotionFrom(row: Record<string, unknown>): SellerReleasePromotion {
    return Object.freeze({ promotionId: String(row.promotion_id), resultId: String(row.result_id), assessmentJobId: String(row.assessment_request_id), submissionId: String(row.submission_id), sellerUserId: String(row.seller_user_id), sourceProjectId: String(row.source_project_id), sourceRevisionId: String(row.source_revision_id), sourceContentHash: String(row.source_content_hash), snapshotHash: String(row.submission_snapshot_hash), reviewDecisionId: String(row.review_decision_id), catalogProjectId: String(row.catalog_project_id), releaseId: String(row.release_id), version: String(row.version), promotedBy: String(row.promoted_by), createdAt: iso(row.created_at) })
  }

  private listingPublicationFrom(row: Record<string, unknown>): ListingPublication {
    return Object.freeze({ publicationId: String(row.publication_id), promotionId: String(row.promotion_id), resultId: String(row.result_id), sellerUserId: String(row.seller_user_id), catalogProjectId: String(row.catalog_project_id), releaseId: String(row.release_id), listingId: String(row.listing_id), status: "published", publishedBy: String(row.published_by), publishedAt: iso(row.published_at) })
  }

  private sellerQuarantineItemFrom(row: Record<string, unknown>): SellerQuarantineItem {
    const decision = row.decision_id ? this.sellerReviewDecisionFrom({ ...row, seller_application_id: row.decision_seller_application_id, seller_user_id: row.decision_seller_user_id, source_project_id: row.decision_source_project_id, source_revision_id: row.decision_source_revision_id, source_content_hash: row.decision_source_content_hash, created_at: row.decision_created_at }) : undefined
    return Object.freeze({ submissionId: String(row.submission_id), sellerApplicationId: String(row.seller_application_id), sellerUserId: String(row.seller_user_id), sourceProjectId: String(row.source_project_id), sourceRevisionId: String(row.source_revision_id), sourceContentHash: String(row.source_content_hash), snapshotHash: String(row.snapshot_hash), status: decision?.decision ?? "pending_review", submittedAt: iso(row.created_at), updatedAt: decision?.createdAt ?? iso(row.submission_updated_at), ...(decision ? { decision } : {}) })
  }
}
