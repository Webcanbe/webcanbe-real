import { Buffer } from "node:buffer"
import { sourceContentHash } from "./editor-projects.js"
import { releaseSnapshotHash } from "./snapshot-integrity.js"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export class CreatorDomainError extends Error { constructor(status, message) { super(message); this.status = status } }
const iso = value => new Date(value).toISOString()
function id(value, label) { if (typeof value !== "string" || !UUID.test(value)) throw new CreatorDomainError(422, `Invalid ${label}.`); return value }
function exact(input, allowed) { if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(key => !allowed.includes(key))) throw new CreatorDomainError(422, "Invalid creator request.") }
function text(value, label, max) { if (typeof value !== "string" || !value.trim() || value.trim().length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) throw new CreatorDomainError(422, `Invalid ${label}.`); return value.trim() }
function application(row) { return { applicationId: String(row.application_id), userId: String(row.user_id), status: String(row.status), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at), ...(row.decided_at ? { decidedAt: iso(row.decided_at) } : {}), ...(row.decision_by ? { decidedBy: String(row.decision_by) } : {}) } }
function submission(row) { return { submissionId: String(row.submission_id), sellerApplicationId: String(row.seller_application_id), sellerUserId: String(row.seller_user_id), workspaceId: String(row.workspace_id), sourceProjectId: String(row.source_project_id), sourceRevisionId: String(row.source_revision_id), sourceContentHash: String(row.source_content_hash), snapshotHash: String(row.snapshot_hash), status: String(row.status), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) } }
function listing(row) { return { listingId: String(row.listing_id), catalogProjectId: String(row.catalog_project_id), releaseId: String(row.release_id), slug: String(row.slug), title: String(row.title), summary: String(row.summary), status: String(row.status), availability: String(row.availability), tags: row.tags ?? [], demoMetadata: row.demo_metadata ?? {}, updatedAt: iso(row.updated_at) } }
async function approved(db, session) { return (await db.query("SELECT * FROM wcb_seller_applications WHERE user_id=$1 AND status='approved' FOR SHARE", [session.userId])).rows[0] }

export async function sellerApplication(db, session) {
  const row = (await db.query("SELECT * FROM wcb_seller_applications WHERE user_id=$1", [session.userId])).rows[0]
  return row ? application(row) : undefined
}
export async function applySeller(db, session, input) {
  exact(input, [])
  const existing = (await db.query("SELECT * FROM wcb_seller_applications WHERE user_id=$1 FOR UPDATE", [session.userId])).rows[0]
  if (existing) return application(existing)
  const row = (await db.query("INSERT INTO wcb_seller_applications(application_id,user_id,status,created_at,updated_at) VALUES($1,$2,'pending',clock_timestamp(),clock_timestamp()) RETURNING *", [crypto.randomUUID(), session.userId])).rows[0]
  return application(row)
}
export async function creatorStudio(db, session) {
  const app = await approved(db, session); if (!app) throw new CreatorDomainError(403, "Approved creator access required.")
  const [submissions, reviews, assessments, releases, listings, ready] = await Promise.all([
    db.query("SELECT s.*,st.status,st.updated_at FROM wcb_seller_submissions s JOIN wcb_seller_submission_states st USING(submission_id) WHERE s.seller_user_id=$1 ORDER BY s.created_at DESC", [session.userId]),
    db.query("SELECT decision_id,submission_id,decision,created_at FROM wcb_seller_review_decisions WHERE seller_user_id=$1 ORDER BY created_at DESC", [session.userId]),
    db.query("SELECT req.assessment_request_id,req.submission_id,req.status,req.created_at,ar.result_id,ar.result_status,ar.assessment_metadata,ar.completed_at FROM wcb_seller_assessment_requests req LEFT JOIN wcb_seller_assessment_results ar ON ar.assessment_request_id=req.assessment_request_id WHERE req.seller_user_id=$1 ORDER BY req.created_at DESC", [session.userId]),
    db.query("SELECT p.promotion_id,p.result_id,r.release_id,r.catalog_project_id,r.version,r.status,r.source_project_id,r.source_revision_id,r.source_content_hash,r.snapshot_hash,r.created_at FROM wcb_seller_release_promotions p JOIN wcb_project_releases r ON r.release_id=p.release_id WHERE p.seller_user_id=$1 ORDER BY p.created_at DESC", [session.userId]),
    db.query("SELECT l.* FROM wcb_listing_publications p JOIN wcb_listings l ON l.listing_id=p.listing_id WHERE p.seller_user_id=$1 ORDER BY l.updated_at DESC", [session.userId]),
    db.query("SELECT q.qualification_id,q.release_id,q.qualification_status,q.qualification_version,q.reasons,q.qualified_at FROM wcb_ready_qualifications q JOIN wcb_seller_release_promotions p ON p.promotion_id=q.promotion_id WHERE p.seller_user_id=$1 ORDER BY q.qualified_at DESC", [session.userId]),
  ])
  return { application: application(app), submissions: submissions.rows.map(submission), imports: { zip: [], github: [] }, reviews: reviews.rows.map(row => ({ decisionId: String(row.decision_id), submissionId: String(row.submission_id), decision: String(row.decision), createdAt: iso(row.created_at) })), assessments: assessments.rows.map(row => ({ assessmentRequestId: String(row.assessment_request_id), submissionId: String(row.submission_id), status: String(row.status), createdAt: iso(row.created_at), ...(row.result_id ? { result: { resultId: String(row.result_id), status: String(row.result_status), metadata: row.assessment_metadata ?? {}, completedAt: iso(row.completed_at) } } : {}) })), releases: releases.rows.map(row => ({ promotionId: String(row.promotion_id), assessmentResultId: String(row.result_id), release: { releaseId: String(row.release_id), catalogProjectId: String(row.catalog_project_id), version: String(row.version), status: String(row.status), sourceProjectId: String(row.source_project_id), sourceRevisionId: String(row.source_revision_id), sourceContentHash: String(row.source_content_hash), snapshotHash: String(row.snapshot_hash), createdAt: iso(row.created_at) } })), listings: listings.rows.map(listing), ready: ready.rows.map(row => ({ qualificationId: String(row.qualification_id), releaseId: String(row.release_id), status: String(row.qualification_status), version: String(row.qualification_version), reasons: row.reasons ?? [], qualifiedAt: iso(row.qualified_at) })) }
}
export async function updateCreatorListing(db, session, input) {
  exact(input, ["listingId", "title", "summary", "availability", "tags", "demoMetadata"])
  const listingId = id(input.listingId, "listing"), availability = String(input.availability || "")
  if (!await approved(db, session) || !["available", "unavailable"].includes(availability)) throw new CreatorDomainError(403, "Creator listing update refused.")
  if (!Array.isArray(input.tags) || input.tags.length > 20 || input.tags.some(tag => typeof tag !== "string" || !tag.trim() || tag.trim().length > 40)) throw new CreatorDomainError(422, "Invalid listing tags.")
  const metadata = input.demoMetadata ?? {}, encoded = JSON.stringify(metadata)
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata) || encoded.length > 8192) throw new CreatorDomainError(422, "Invalid listing metadata.")
  const owned = (await db.query("SELECT l.listing_id FROM wcb_listings l JOIN wcb_listing_publications p ON p.listing_id=l.listing_id WHERE l.listing_id=$1 AND p.seller_user_id=$2 AND l.status='published' FOR UPDATE", [listingId, session.userId])).rows[0]
  if (!owned) throw new CreatorDomainError(403, "Creator listing update refused.")
  const row = (await db.query("UPDATE wcb_listings SET title=$2,summary=$3,availability=$4,tags=$5,demo_metadata=$6,updated_at=clock_timestamp() WHERE listing_id=$1 RETURNING *", [listingId, text(input.title, "listing title", 200), text(input.summary, "listing summary", 2000), availability, JSON.stringify([...new Set(input.tags.map(tag => tag.trim().toLowerCase()))].sort()), encoded])).rows[0]
  return listing(row)
}
export async function createSellerSubmission(db, session, input) {
  exact(input, ["sellerApplicationId", "workspaceId", "sourceProjectId"])
  const applicationId = id(input.sellerApplicationId, "seller application"), workspaceId = id(input.workspaceId, "workspace"), projectId = id(input.sourceProjectId, "source project")
  const seller = (await db.query("SELECT application_id FROM wcb_seller_applications WHERE application_id=$1 AND user_id=$2 AND status='approved' FOR SHARE", [applicationId, session.userId])).rows[0]
  if (!seller) throw new CreatorDomainError(403, "Approved creator access required.")
  const row = (await db.query(`SELECT p.revision,p.files,p.history FROM wcb_projects p
    JOIN wcb_project_members pm ON pm.project_id=p.project_id AND pm.user_id=$3 AND pm.active AND pm.role IN ('owner','editor')
    JOIN wcb_workspace_members wm ON wm.workspace_id=p.workspace_id AND wm.user_id=$3 AND wm.active AND wm.role IN ('owner','editor')
    WHERE p.project_id=$1 AND p.workspace_id=$2 AND NOT p.deleted FOR SHARE`, [projectId, workspaceId, session.userId])).rows[0]
  if (!row?.revision || !row.files || !row.history || row.history.projectId !== projectId || row.history.revisions?.at(-1)?.revisionId !== row.revision) throw new CreatorDomainError(409, "Stored source is not eligible for submission.")
  const files = new Map(Object.entries(row.files).map(([path, encoded]) => [path, Buffer.from(String(encoded), "base64")]))
  const contentHash = sourceContentHash(files, row.history)
  if (row.history.revisions.at(-1)?.contentHash !== contentHash) throw new CreatorDomainError(409, "Stored source integrity failed.")
  const snapshotHash = releaseSnapshotHash({ projectId, revisionId: String(row.revision), contentHash, files: row.files, history: row.history })
  const existing = (await db.query("SELECT s.*,st.status,st.updated_at FROM wcb_seller_submissions s JOIN wcb_seller_submission_states st USING(submission_id) WHERE s.seller_application_id=$1 AND s.source_project_id=$2 AND s.source_revision_id=$3", [applicationId, projectId, row.revision])).rows[0]
  if (existing) return submission(existing)
  const submissionId = crypto.randomUUID()
  const inserted = (await db.query("INSERT INTO wcb_seller_submissions(submission_id,seller_application_id,seller_user_id,workspace_id,source_project_id,source_revision_id,source_content_hash,snapshot_hash,files,history,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,clock_timestamp()) RETURNING *", [submissionId, applicationId, session.userId, workspaceId, projectId, row.revision, contentHash, snapshotHash, JSON.stringify(row.files), JSON.stringify(row.history)])).rows[0]
  const state = (await db.query("INSERT INTO wcb_seller_submission_states(submission_id,status,updated_at) VALUES($1,'pending_review',clock_timestamp()) RETURNING status,updated_at", [submissionId])).rows[0]
  return submission({ ...inserted, ...state })
}
