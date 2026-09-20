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
async function evidence(db, session, evidenceId) {
  const row = (await db.query("SELECT evidence_id FROM wcb_operator_step_up_evidence WHERE evidence_id=$1 AND operator_user_id=$2 AND session_id=$3 AND authority='control_high_risk' AND active AND verified_at>=clock_timestamp()-interval '5 minutes' AND expires_at>clock_timestamp() FOR SHARE", [id(evidenceId,"step-up evidence"), session.userId, session.sessionId])).rows[0]
  if (!row) throw new Error("Fresh three-factor evidence required.")
}
async function audit(db, session, evidenceId, action, targetType, targetId, transition, idempotencyKey) {
  const k=key(idempotencyKey)
  const prior=(await db.query("SELECT action,target_type,target_id,transition,step_up_evidence_id FROM wcb_control_audit WHERE actor_user_id=$1 AND idempotency_key=$2 FOR SHARE",[session.userId,k])).rows[0]
  if(prior){
    if(prior.action!==action||prior.target_type!==targetType||String(prior.target_id)!==targetId||String(prior.step_up_evidence_id)!==evidenceId||JSON.stringify(prior.transition)!==JSON.stringify(transition)) throw new Error("Idempotency key already records another privileged mutation.")
    return false
  }
  await db.query("INSERT INTO wcb_control_audit(audit_id,actor_user_id,actor_authority,action,target_type,target_id,transition,step_up_evidence_id,idempotency_key,created_at) VALUES($1,$2,'product_operator',$3,$4,$5,$6,$7,$8,clock_timestamp())",[crypto.randomUUID(),session.userId,action,targetType,targetId,JSON.stringify(transition),evidenceId,k])
  return true
}
export async function transitionOperator(db,session,input,evidenceId){
  const target=id(input?.targetUserId,"target user"), active=input?.active, role=String(input?.role||"")
  if(typeof active!=="boolean"||!["reviewer","admin","bigperson"].includes(role)) throw new Error("Invalid operator transition.")
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
