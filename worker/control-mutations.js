import { verifyReleaseSnapshot } from "./materialization.js"
import { deriveReleaseReadiness } from "./ready-qualification.js"

const ROLE_RANK=Object.freeze({reviewer:1,admin:2,bigperson:3})
async function role(db,session,minimum){
  const row=(await db.query("SELECT role,active,epoch FROM wcb_product_operators WHERE user_id=$1 AND active FOR SHARE",[session.userId])).rows[0]
  if(!row||!ROLE_RANK[String(row.role)]||ROLE_RANK[String(row.role)]<ROLE_RANK[minimum]) throw new Error(minimum+" authority required.")
  return row
}
function id(value, label) {
  const text = String(value || "")
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) throw new Error("Invalid " + label + ".")
  return text
}
function key(value) {
  const text = String(value || "")
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(text)) throw new Error("Invalid idempotency key.")
  return text
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]"
  return "{" + Object.keys(value).sort().map(k => JSON.stringify(k) + ":" + canonicalJson(value[k])).join(",") + "}"
}

function cleanText(value, label, maximum) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maximum || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) throw new Error("Invalid " + label + ".")
  return value.trim()
}
function cleanSlug(value) {
  const slug = cleanText(value, "listing slug", 100).toLowerCase()
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Invalid listing slug.")
  return slug
}
function cleanTags(value) {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 20) throw new Error("Invalid listing tags.")
  return [...new Set(value.map(item => cleanText(item, "listing tag", 40).toLowerCase()))].sort()
}
function jsonObject(value, label) {
  const encoded = JSON.stringify(value ?? {})
  if (encoded.length > 8192) throw new Error(label + " exceeds its limit.")
  const parsed = JSON.parse(encoded)
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("Invalid " + label + ".")
  return parsed
}
async function evidence(db, session, evidenceId) {
  const row = (await db.query("SELECT evidence_id FROM wcb_operator_step_up_evidence WHERE evidence_id=$1 AND operator_user_id=$2 AND session_id=$3 AND authority='control_high_risk' AND active AND verified_at>=clock_timestamp()-interval '5 minutes' AND expires_at>clock_timestamp() FOR SHARE", [id(evidenceId,"step-up evidence"), session.userId, session.sessionId])).rows[0]
  if (!row) throw new Error("Fresh three-factor evidence required.")
}
async function audit(db, session, evidenceId, action, targetType, targetId, transition, idempotencyKey) {
  const k=key(idempotencyKey)
  const prior=(await db.query("SELECT action,target_type,target_id,transition,step_up_evidence_id FROM wcb_control_audit WHERE actor_user_id=$1 AND idempotency_key=$2 FOR SHARE",[session.userId,k])).rows[0]
  if(prior){
    if(prior.action!==action||prior.target_type!==targetType||String(prior.target_id)!==targetId||String(prior.step_up_evidence_id)!==evidenceId||canonicalJson(prior.transition)!==canonicalJson(transition)) throw new Error("Idempotency key already records another privileged mutation.")
    return false
  }
  await db.query("INSERT INTO wcb_control_audit(audit_id,actor_user_id,actor_authority,action,target_type,target_id,transition,step_up_evidence_id,idempotency_key,created_at) VALUES($1,$2,'product_operator',$3,$4,$5,$6,$7,$8,clock_timestamp())",[crypto.randomUUID(),session.userId,action,targetType,targetId,JSON.stringify(transition),evidenceId,k])
  return true
}
export async function transitionOperator(db,session,input,evidenceId){
  const target=id(input?.targetUserId,"target user"), active=input?.active, role=String(input?.role||"")
  if(typeof active!=="boolean"||!["reviewer","admin","bigperson"].includes(role)) throw new Error("Invalid operator transition.")
  await role(db,session,"bigperson")
  await evidence(db,session,evidenceId)
  const known=(await db.query("SELECT user_id FROM wcb_identity_accounts WHERE user_id=$1 LIMIT 1",[target])).rows[0]
  if(!known) throw new Error("Target user is unavailable.")
  const before=(await db.query("SELECT active,epoch,role FROM wcb_product_operators WHERE user_id=$1 FOR UPDATE",[target])).rows[0]
  const transition={before:before?{active:Boolean(before.active),role:String(before.role)}:{active:false,role:null},after:{active,role},previousEpoch:before?Number(before.epoch):0,nextEpoch:before?Number(before.epoch)+1:1}
  const inserted=await audit(db,session,evidenceId,"operator.authority.transition","user",target,transition,input?.idempotencyKey)
  if(!inserted) return (await db.query("SELECT user_id,active,epoch,role FROM wcb_product_operators WHERE user_id=$1",[target])).rows[0]
  return (await db.query("INSERT INTO wcb_product_operators(user_id,active,epoch,role) VALUES($1,$2,1,$3) ON CONFLICT(user_id) DO UPDATE SET active=excluded.active,role=excluded.role,epoch=wcb_product_operators.epoch+1 RETURNING user_id,active,epoch,role",[target,active,role])).rows[0]
}
export async function transitionSellerApplication(db,session,input,evidenceId){
  const application=id(input?.applicationId,"seller application"), status=String(input?.status||"")
  if(!["approved","rejected"].includes(status)) throw new Error("Invalid seller application transition.")
  await role(db,session,"admin")
  await evidence(db,session,evidenceId)
  const current=(await db.query("SELECT * FROM wcb_seller_applications WHERE application_id=$1 FOR UPDATE",[application])).rows[0]
  if(!current) throw new Error("Seller application is unavailable.")
  if(current.status==="rejected"&&status!=="rejected") throw new Error("Rejected seller application cannot be reopened.")
  const transition={before:String(current.status),after:status}
  const inserted=await audit(db,session,evidenceId,"seller.application.transition","seller_application",application,transition,input?.idempotencyKey)
  if(!inserted||current.status===status) return current
  return (await db.query("UPDATE wcb_seller_applications SET status=$2,decision_by=$3,decided_at=clock_timestamp(),updated_at=clock_timestamp() WHERE application_id=$1 RETURNING *",[application,status,session.userId])).rows[0]
}

export async function revokeSession(db,session,input,evidenceId){
  const target=id(input?.sessionId,"session")
  await role(db,session,"admin")
  await evidence(db,session,evidenceId)
  const current=(await db.query("SELECT session_id,user_id,active,expires_at FROM wcb_sessions WHERE session_id=$1 FOR UPDATE",[target])).rows[0]
  if(!current) throw new Error("Session is unavailable.")
  const transition={before:{active:Boolean(current.active)},after:{active:false}}
  const inserted=await audit(db,session,evidenceId,"session.revoke","session",target,transition,input?.idempotencyKey)
  if(inserted&&current.active) await db.query("UPDATE wcb_sessions SET active=false WHERE session_id=$1",[target])
  return {session_id:target,user_id:String(current.user_id),active:false,expires_at:current.expires_at}
}

export async function decideSubmissionReview(db,session,input,evidenceId){
  const submissionId=id(input?.submissionId,"submission"), snapshot=String(input?.snapshotHash||""), decision=String(input?.decision||"")
  if(!/^[a-f0-9]{64}$/.test(snapshot)||!["approved_for_next_stage","rejected"].includes(decision)) throw new Error("Invalid review decision.")
  await role(db,session,"reviewer")
  await evidence(db,session,evidenceId)
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,93))",[submissionId])
  const submission=(await db.query("SELECT s.*,st.status AS submission_status FROM wcb_seller_submissions s JOIN wcb_seller_submission_states st USING(submission_id) WHERE s.submission_id=$1 FOR SHARE",[submissionId])).rows[0]
  if(!submission||String(submission.snapshot_hash)!==snapshot||submission.submission_status!=="pending_review") throw new Error("Review provenance does not match the pending immutable submission.")
  const existing=(await db.query("SELECT * FROM wcb_seller_review_decisions WHERE submission_id=$1",[submissionId])).rows[0]
  if(existing){
    if(String(existing.submission_snapshot_hash)!==snapshot||existing.decision!==decision) throw new Error("Submission already has another immutable review decision.")
    return existing
  }
  const auditKey=key(input?.idempotencyKey), transition={before:"pending_review",after:decision,snapshotHash:snapshot}
  await audit(db,session,evidenceId,"submission.review.decision","submission",submissionId,transition,auditKey)
  return (await db.query("INSERT INTO wcb_seller_review_decisions(decision_id,submission_id,seller_application_id,seller_user_id,source_project_id,source_revision_id,source_content_hash,submission_snapshot_hash,decision,reviewer_user_id,idempotency_key,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,clock_timestamp()) RETURNING *",[crypto.randomUUID(),submissionId,submission.seller_application_id,submission.seller_user_id,submission.source_project_id,submission.source_revision_id,submission.source_content_hash,snapshot,decision,session.userId,auditKey])).rows[0]
}
export async function admitAssessment(db,session,input,evidenceId){
  const submissionId=id(input?.submissionId,"submission"), snapshot=String(input?.snapshotHash||""), seller=id(input?.sellerUserId,"seller"), decisionId=id(input?.reviewDecisionId,"review decision")
  if(!/^[a-f0-9]{64}$/.test(snapshot)) throw new Error("Invalid assessment admission.")
  await role(db,session,"reviewer")
  await evidence(db,session,evidenceId)
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,94))",[submissionId])
  const submission=(await db.query("SELECT s.*,st.status AS submission_status FROM wcb_seller_submissions s JOIN wcb_seller_submission_states st USING(submission_id) WHERE s.submission_id=$1 FOR SHARE",[submissionId])).rows[0]
  const decision=(await db.query("SELECT * FROM wcb_seller_review_decisions WHERE submission_id=$1",[submissionId])).rows[0]
  if(!submission||!decision||decision.decision!=="approved_for_next_stage"||String(submission.seller_user_id)!==seller||String(submission.snapshot_hash)!==snapshot||String(decision.decision_id)!==decisionId) throw new Error("Assessment admission does not match the approved immutable submission.")
  const existing=(await db.query("SELECT * FROM wcb_seller_assessment_requests WHERE submission_id=$1",[submissionId])).rows[0]
  if(existing)return existing
  const auditKey=key(input?.idempotencyKey), transition={before:"review_approved",after:"assessment_requested",snapshotHash:snapshot,reviewDecisionId:decisionId}
  await audit(db,session,evidenceId,"submission.assessment.admit","submission",submissionId,transition,auditKey)
  return (await db.query("INSERT INTO wcb_seller_assessment_requests(assessment_request_id,submission_id,seller_user_id,source_project_id,source_revision_id,source_content_hash,submission_snapshot_hash,review_decision_id,status,admitted_by,idempotency_key,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'requested',$9,$10,clock_timestamp()) RETURNING *",[crypto.randomUUID(),submissionId,submission.seller_user_id,submission.source_project_id,submission.source_revision_id,submission.source_content_hash,submission.snapshot_hash,decisionId,session.userId,auditKey])).rows[0]
}


export async function promoteAssessmentRelease(db,session,input,evidenceId){
  const resultId=id(input?.resultId,"assessment result"), catalogProjectId=id(input?.catalogProjectId,"catalog project"), version=cleanText(input?.version,"release version",100), auditKey=key(input?.idempotencyKey)
  await role(db,session,"admin")
  await evidence(db,session,evidenceId)
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,96))",[resultId])
  const row=(await db.query(`SELECT ar.*,req.status AS request_status,req.submission_id AS request_submission_id,req.seller_user_id AS request_seller_user_id,
    req.source_project_id AS request_source_project_id,req.source_revision_id AS request_source_revision_id,req.source_content_hash AS request_source_content_hash,
    req.submission_snapshot_hash AS request_snapshot_hash,req.review_decision_id AS request_review_decision_id,
    s.workspace_id,s.files AS submission_files,s.history AS submission_history,s.snapshot_hash AS immutable_snapshot_hash,
    d.decision,d.submission_id AS decision_submission_id,d.seller_user_id AS decision_seller_user_id,d.source_project_id AS decision_source_project_id,
    d.source_revision_id AS decision_source_revision_id,d.source_content_hash AS decision_source_content_hash,d.submission_snapshot_hash AS decision_snapshot_hash,
    l.state AS lease_state,l.worker_id AS lease_worker_id,l.generation AS current_generation
    FROM wcb_seller_assessment_results ar
    JOIN wcb_seller_assessment_requests req ON req.assessment_request_id=ar.assessment_request_id
    JOIN wcb_seller_submissions s ON s.submission_id=ar.submission_id
    JOIN wcb_seller_review_decisions d ON d.decision_id=ar.review_decision_id
    JOIN wcb_seller_assessment_leases l ON l.assessment_request_id=ar.assessment_request_id
    WHERE ar.result_id=$1 FOR SHARE`,[resultId])).rows[0]
  const exact=row&&row.result_status==="passed"
    &&String(row.request_submission_id)===String(row.submission_id)&&String(row.request_seller_user_id)===String(row.seller_user_id)
    &&String(row.request_source_project_id)===String(row.source_project_id)&&String(row.request_source_revision_id)===String(row.source_revision_id)
    &&String(row.request_source_content_hash)===String(row.source_content_hash)&&String(row.request_snapshot_hash)===String(row.submission_snapshot_hash)
    &&String(row.request_review_decision_id)===String(row.review_decision_id)&&row.request_status==="requested"
    &&String(row.immutable_snapshot_hash)===String(row.submission_snapshot_hash)
    &&row.decision==="approved_for_next_stage"&&String(row.decision_submission_id)===String(row.submission_id)
    &&String(row.decision_seller_user_id)===String(row.seller_user_id)&&String(row.decision_source_project_id)===String(row.source_project_id)
    &&String(row.decision_source_revision_id)===String(row.source_revision_id)&&String(row.decision_source_content_hash)===String(row.source_content_hash)
    &&String(row.decision_snapshot_hash)===String(row.submission_snapshot_hash)
    &&row.lease_state==="completed"&&String(row.lease_worker_id)===String(row.worker_id)&&String(row.current_generation)===String(row.lease_generation)
  if(!exact) throw new Error("Release promotion does not match one passed immutable assessment result.")

  const byKey=(await db.query("SELECT * FROM wcb_seller_release_promotions WHERE promoted_by=$1 AND idempotency_key=$2 FOR SHARE",[session.userId,auditKey])).rows[0]
  const existing=(await db.query("SELECT * FROM wcb_seller_release_promotions WHERE result_id=$1 FOR SHARE",[resultId])).rows[0]
  const transition={before:"assessment_passed",after:"release_promoted",resultId,catalogProjectId,version}
  if(byKey||existing){
    if(!byKey||!existing||String(byKey.promotion_id)!==String(existing.promotion_id)||String(existing.catalog_project_id)!==catalogProjectId||String(existing.version)!==version||String(existing.idempotency_key)!==auditKey) throw new Error("Assessment result already has a conflicting release promotion.")
    const release=(await db.query("SELECT * FROM wcb_project_releases WHERE release_id=$1 AND catalog_project_id=$2 FOR SHARE",[existing.release_id,catalogProjectId])).rows[0]
    if(!release||String(release.source_project_id)!==String(existing.source_project_id)||String(release.source_revision_id)!==String(existing.source_revision_id)||String(release.source_content_hash)!==String(existing.source_content_hash)||String(release.snapshot_hash)!==String(existing.submission_snapshot_hash)) throw new Error("Promoted release provenance is inconsistent.")
    await audit(db,session,evidenceId,"assessment.release.promote","assessment_result",resultId,transition,auditKey)
    return {promotion:existing,release}
  }

  const catalog=(await db.query("SELECT * FROM wcb_catalog_projects WHERE catalog_project_id=$1 AND status='active' FOR UPDATE",[catalogProjectId])).rows[0]
  if(!catalog||String(catalog.source_project_id)!==String(row.source_project_id)||String(catalog.owner_workspace_id)!==String(row.workspace_id)||String(catalog.created_by)!==String(row.seller_user_id)) throw new Error("Promotion catalog does not belong to the assessed seller snapshot.")
  verifyReleaseSnapshot({source_project_id:row.source_project_id,source_revision_id:row.source_revision_id,source_content_hash:row.source_content_hash,snapshot_hash:row.submission_snapshot_hash,files:row.submission_files,history:row.submission_history})
  if((await db.query("SELECT release_id FROM wcb_project_releases WHERE catalog_project_id=$1 AND version=$2 FOR SHARE",[catalogProjectId,version])).rowCount) throw new Error("Release version already exists.")
  await audit(db,session,evidenceId,"assessment.release.promote","assessment_result",resultId,transition,auditKey)
  const releaseId=crypto.randomUUID(), promotionId=crypto.randomUUID()
  const release=(await db.query(`INSERT INTO wcb_project_releases(release_id,catalog_project_id,version,status,source_project_id,source_revision_id,source_content_hash,snapshot_hash,files,history,created_by,created_at)
    VALUES($1,$2,$3,'published',$4,$5,$6,$7,$8,$9,$10,clock_timestamp()) RETURNING *`,[releaseId,catalogProjectId,version,row.source_project_id,row.source_revision_id,row.source_content_hash,row.submission_snapshot_hash,JSON.stringify(row.submission_files),JSON.stringify(row.submission_history),session.userId])).rows[0]
  const promotion=(await db.query(`INSERT INTO wcb_seller_release_promotions(promotion_id,result_id,assessment_request_id,submission_id,seller_user_id,source_project_id,source_revision_id,source_content_hash,submission_snapshot_hash,review_decision_id,catalog_project_id,release_id,version,promoted_by,idempotency_key,created_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,clock_timestamp()) RETURNING *`,[promotionId,resultId,row.assessment_request_id,row.submission_id,row.seller_user_id,row.source_project_id,row.source_revision_id,row.source_content_hash,row.submission_snapshot_hash,row.review_decision_id,catalogProjectId,releaseId,version,session.userId,auditKey])).rows[0]
  return {promotion,release}
}

export async function publishPromotedListing(db,session,input,evidenceId){
  const promotionId=id(input?.promotionId,"release promotion"), auditKey=key(input?.idempotencyKey)
  const listing={slug:cleanSlug(input?.slug),title:cleanText(input?.title,"listing title",200),summary:cleanText(input?.summary,"listing summary",2000),tags:cleanTags(input?.tags),demoMetadata:jsonObject(input?.demoMetadata,"demo metadata")}
  await role(db,session,"admin")
  await evidence(db,session,evidenceId)
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,97))",[promotionId])
  const lineage=(await db.query(`SELECT p.*,r.status AS release_status,r.source_project_id AS release_source_project_id,r.source_revision_id AS release_source_revision_id,
    r.source_content_hash AS release_source_content_hash,r.snapshot_hash AS release_snapshot_hash,c.source_project_id AS catalog_source_project_id,c.created_by,c.status AS catalog_status
    FROM wcb_seller_release_promotions p
    JOIN wcb_project_releases r ON r.release_id=p.release_id AND r.catalog_project_id=p.catalog_project_id
    JOIN wcb_catalog_projects c ON c.catalog_project_id=p.catalog_project_id
    WHERE p.promotion_id=$1 FOR SHARE`,[promotionId])).rows[0]
  const exact=lineage&&lineage.release_status==="published"&&lineage.catalog_status==="active"
    &&String(lineage.release_source_project_id)===String(lineage.source_project_id)&&String(lineage.release_source_revision_id)===String(lineage.source_revision_id)
    &&String(lineage.release_source_content_hash)===String(lineage.source_content_hash)&&String(lineage.release_snapshot_hash)===String(lineage.submission_snapshot_hash)
    &&String(lineage.catalog_source_project_id)===String(lineage.source_project_id)&&String(lineage.created_by)===String(lineage.seller_user_id)
  if(!exact) throw new Error("Listing publication does not match one promoted immutable release.")
  const byKey=(await db.query("SELECT * FROM wcb_listing_publications WHERE published_by=$1 AND idempotency_key=$2 FOR SHARE",[session.userId,auditKey])).rows[0]
  const existing=(await db.query("SELECT * FROM wcb_listing_publications WHERE promotion_id=$1 FOR SHARE",[promotionId])).rows[0]
  const transition={before:"release_promoted",after:"listing_published",promotionId,releaseId:String(lineage.release_id),catalogProjectId:String(lineage.catalog_project_id)}
  if(byKey||existing){
    if(!byKey||!existing||String(byKey.publication_id)!==String(existing.publication_id)||String(existing.idempotency_key)!==auditKey) throw new Error("Promoted release already has a conflicting Listing publication.")
    const row=(await db.query("SELECT * FROM wcb_listings WHERE listing_id=$1 AND release_id=$2 AND catalog_project_id=$3 AND status='published' FOR SHARE",[existing.listing_id,lineage.release_id,lineage.catalog_project_id])).rows[0]
    if(!row) throw new Error("Published Listing binding is inconsistent.")
    await audit(db,session,evidenceId,"release.listing.publish","release_promotion",promotionId,transition,auditKey)
    return {publication:existing,listing:row}
  }
  if((await db.query("SELECT listing_id FROM wcb_listings WHERE catalog_project_id=$1 OR slug=$2 FOR SHARE",[lineage.catalog_project_id,listing.slug])).rowCount) throw new Error("Catalog project or slug already has a Listing.")
  await audit(db,session,evidenceId,"release.listing.publish","release_promotion",promotionId,transition,auditKey)
  const listingId=crypto.randomUUID(), publicationId=crypto.randomUUID()
  const listingRow=(await db.query(`INSERT INTO wcb_listings(listing_id,catalog_project_id,release_id,slug,title,summary,status,availability,tags,demo_metadata,updated_at)
    VALUES($1,$2,$3,$4,$5,$6,'published','available',$7,$8,clock_timestamp()) RETURNING *`,[listingId,lineage.catalog_project_id,lineage.release_id,listing.slug,listing.title,listing.summary,JSON.stringify(listing.tags),JSON.stringify(listing.demoMetadata)])).rows[0]
  const publication=(await db.query(`INSERT INTO wcb_listing_publications(publication_id,promotion_id,result_id,seller_user_id,catalog_project_id,release_id,listing_id,status,published_by,idempotency_key,published_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,'published',$8,$9,clock_timestamp()) RETURNING *`,[publicationId,promotionId,lineage.result_id,lineage.seller_user_id,lineage.catalog_project_id,lineage.release_id,listingId,session.userId,auditKey])).rows[0]
  return {publication,listing:listingRow}
}

export async function grantTestEntitlement(db,session,input,evidenceId){
  const beneficiary=id(input?.beneficiaryUserId,"beneficiary user"), releaseId=id(input?.releaseId,"release"), auditKey=key(input?.idempotencyKey)
  await role(db,session,"admin")
  await evidence(db,session,evidenceId)
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,92))",[beneficiary+":"+releaseId])
  const known=await db.query("SELECT user_id FROM wcb_sessions WHERE user_id=$1 UNION SELECT user_id FROM wcb_identity_accounts WHERE user_id=$1",[beneficiary])
  if(!known.rowCount) throw new Error("Beneficiary user is unavailable.")
  const available=await db.query(`SELECT r.release_id FROM wcb_project_releases r JOIN wcb_listings l ON l.release_id=r.release_id
    WHERE r.release_id=$1 AND r.status='published' AND l.status='published' AND l.availability='available'`,[releaseId])
  if(!available.rowCount) throw new Error("Release is not currently available.")
  const providerReference="test:"+beneficiary+":"+auditKey
  const byReference=(await db.query("SELECT * FROM wcb_license_entitlements WHERE provider_reference=$1 FOR UPDATE",[providerReference])).rows[0]
  const existing=(await db.query("SELECT * FROM wcb_license_entitlements WHERE user_id=$1 AND release_id=$2 AND provider='test' FOR UPDATE",[beneficiary,releaseId])).rows[0]
  const transition={before:existing?String(existing.status):null,after:"active",beneficiaryUserId:beneficiary,releaseId}
  if(byReference){
    if(String(byReference.user_id)!==beneficiary||String(byReference.release_id)!==releaseId||byReference.status!=="active") throw new Error("TEST entitlement idempotency key conflicts with existing authority.")
    await audit(db,session,evidenceId,"entitlement.test.grant","release",releaseId,transition,auditKey)
    return byReference
  }
  if(existing){
    if(existing.status!=="active") throw new Error("A terminal TEST entitlement cannot be re-granted.")
    await audit(db,session,evidenceId,"entitlement.test.grant","release",releaseId,{before:"active",after:"active",beneficiaryUserId:beneficiary,releaseId},auditKey)
    return existing
  }
  await audit(db,session,evidenceId,"entitlement.test.grant","release",releaseId,transition,auditKey)
  return (await db.query("INSERT INTO wcb_license_entitlements(entitlement_id,user_id,release_id,provider,provider_reference,status,granted_at) VALUES($1,$2,$3,'test',$4,'active',clock_timestamp()) RETURNING *",[crypto.randomUUID(),beneficiary,releaseId,providerReference])).rows[0]
}

export async function transitionTestEntitlement(db,session,input,evidenceId){
  const entitlementId=id(input?.entitlementId,"entitlement"), status=String(input?.status||""), auditKey=key(input?.idempotencyKey)
  if(!["revoked","invalid"].includes(status)) throw new Error("Invalid TEST entitlement transition.")
  await role(db,session,"admin")
  await evidence(db,session,evidenceId)
  const current=(await db.query("SELECT * FROM wcb_license_entitlements WHERE entitlement_id=$1 AND provider='test' FOR UPDATE",[entitlementId])).rows[0]
  if(!current) throw new Error("TEST entitlement is unavailable.")
  const transition={before:String(current.status),after:status}
  await audit(db,session,evidenceId,"entitlement.test.transition","entitlement",entitlementId,transition,auditKey)
  if(current.status===status) return current
  if(current.status!=="active") throw new Error("TEST entitlement is already terminal.")
  return (await db.query("UPDATE wcb_license_entitlements SET status=$2,revoked_at=clock_timestamp() WHERE entitlement_id=$1 RETURNING *",[entitlementId,status])).rows[0]
}


export async function qualifyReleaseReady(db,session,input,evidenceId){
  const releaseId=id(input?.releaseId,"release"), resultId=id(input?.assessmentResultId,"assessment result"), version=cleanText(input?.qualificationVersion,"qualification version",100), auditKey=key(input?.idempotencyKey)
  await role(db,session,"admin")
  await evidence(db,session,evidenceId)
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,95))",[releaseId])
  const lineage=(await db.query(`SELECT r.*,p.promotion_id,p.result_id,p.catalog_project_id AS promotion_catalog_id,p.source_project_id AS promotion_project_id,
    p.source_revision_id AS promotion_revision_id,p.source_content_hash AS promotion_content_hash,p.submission_snapshot_hash AS promotion_snapshot_hash,
    ar.source_project_id AS result_project_id,ar.source_revision_id AS result_revision_id,ar.source_content_hash AS result_content_hash,
    ar.submission_snapshot_hash AS result_snapshot_hash,ar.result_status,ar.result_digest
    FROM wcb_project_releases r
    JOIN wcb_seller_release_promotions p ON p.release_id=r.release_id
    JOIN wcb_seller_assessment_results ar ON ar.result_id=p.result_id
    WHERE r.release_id=$1 AND ar.result_id=$2 FOR SHARE`,[releaseId,resultId])).rows[0]
  if(!lineage||lineage.result_status!=="passed"||String(lineage.catalog_project_id)!==String(lineage.promotion_catalog_id)
    ||String(lineage.source_project_id)!==String(lineage.promotion_project_id)||String(lineage.source_revision_id)!==String(lineage.promotion_revision_id)
    ||String(lineage.source_content_hash)!==String(lineage.promotion_content_hash)||String(lineage.snapshot_hash)!==String(lineage.promotion_snapshot_hash)
    ||String(lineage.source_project_id)!==String(lineage.result_project_id)||String(lineage.source_revision_id)!==String(lineage.result_revision_id)
    ||String(lineage.source_content_hash)!==String(lineage.result_content_hash)||String(lineage.snapshot_hash)!==String(lineage.result_snapshot_hash)) throw new Error("Ready qualification does not match one promoted passed assessment snapshot.")

  const existing=(await db.query("SELECT * FROM wcb_ready_qualifications WHERE release_id=$1 OR (qualified_by=$2 AND idempotency_key=$3) FOR SHARE",[releaseId,session.userId,auditKey])).rows
  if(existing.length){
    const row=existing[0]
    if(existing.some(item=>String(item.qualification_id)!==String(row.qualification_id))||String(row.release_id)!==releaseId||String(row.assessment_result_id)!==resultId||String(row.qualification_version)!==version||String(row.idempotency_key)!==auditKey) throw new Error("Ready qualification already exists with different immutable evidence.")
    const transition={before:null,after:String(row.qualification_status),releaseId,assessmentResultId:resultId,qualificationVersion:version}
    await audit(db,session,evidenceId,"release.ready.qualify","release",releaseId,transition,auditKey)
    return row
  }

  const derived=deriveReleaseReadiness(lineage)
  const transition={before:null,after:derived.status,releaseId,assessmentResultId:resultId,qualificationVersion:version}
  await audit(db,session,evidenceId,"release.ready.qualify","release",releaseId,transition,auditKey)
  return (await db.query(`INSERT INTO wcb_ready_qualifications(qualification_id,release_id,catalog_project_id,promotion_id,assessment_result_id,source_project_id,source_revision_id,source_content_hash,snapshot_hash,assessment_result_digest,qualification_status,compatibility_evidence,reasons,qualification_version,qualified_by,idempotency_key,qualified_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,clock_timestamp()) RETURNING *`,[crypto.randomUUID(),releaseId,lineage.catalog_project_id,lineage.promotion_id,resultId,lineage.source_project_id,lineage.source_revision_id,lineage.source_content_hash,lineage.snapshot_hash,lineage.result_digest,derived.status,JSON.stringify(derived.compatibility),JSON.stringify(derived.reasons),version,session.userId,auditKey])).rows[0]
}
