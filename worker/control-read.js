const ROLE_RANK = Object.freeze({ reviewer: 1, admin: 2, bigperson: 3 })

async function rows(db, text, values = []) {
  const result = await db.query(text, values)
  return result.rows
}

export async function databaseControlRead(db, session) {
  const operator = (await rows(db,
    "SELECT user_id,role,active,epoch FROM wcb_product_operators WHERE user_id=$1 AND active FOR SHARE",
    [session.userId]))[0]
  if (!operator || !ROLE_RANK[String(operator.role)]) return undefined

  const [
    sellerApplications, submissions, reviews, assessments, results, releases,
    listings, ready, deployIntents, users, sessions, workspaces, operators,
    entitlements, audit,
  ] = await Promise.all([
    rows(db, "SELECT application_id,user_id,status,decision_by,decided_at,created_at,updated_at FROM wcb_seller_applications ORDER BY created_at DESC LIMIT 200"),
    rows(db, "SELECT s.submission_id,s.seller_application_id,s.seller_user_id,s.workspace_id,s.source_project_id,s.source_revision_id,s.source_content_hash,s.snapshot_hash,s.created_at,st.status,st.updated_at FROM wcb_seller_submissions s JOIN wcb_seller_submission_states st ON st.submission_id=s.submission_id ORDER BY s.created_at DESC LIMIT 200"),
    rows(db, "SELECT decision_id,submission_id,seller_user_id,source_revision_id,submission_snapshot_hash,decision,reviewer_user_id,created_at FROM wcb_seller_review_decisions ORDER BY created_at DESC LIMIT 200"),
    rows(db, "SELECT assessment_request_id,submission_id,seller_user_id,source_revision_id,source_content_hash,submission_snapshot_hash,review_decision_id,status,admitted_by,created_at FROM wcb_seller_assessment_requests ORDER BY created_at DESC LIMIT 200"),
    rows(db, "SELECT result_id,assessment_request_id,submission_id,seller_user_id,source_revision_id,source_content_hash,submission_snapshot_hash,result_status,assessment_metadata,result_digest,completed_at FROM wcb_seller_assessment_results ORDER BY completed_at DESC LIMIT 200"),
    rows(db, "SELECT release_id,catalog_project_id,version,status,source_project_id,source_revision_id,source_content_hash,snapshot_hash,created_by,created_at FROM wcb_project_releases ORDER BY created_at DESC LIMIT 200"),
    rows(db, "SELECT listing_id,catalog_project_id,release_id,slug,title,summary,status,availability,tags,demo_metadata,updated_at FROM wcb_listings ORDER BY updated_at DESC LIMIT 200"),
    rows(db, "SELECT qualification_id,release_id,catalog_project_id,promotion_id,assessment_result_id,source_revision_id,source_content_hash,snapshot_hash,qualification_status,compatibility_evidence,reasons,qualification_version,qualified_by,qualified_at FROM wcb_ready_qualifications ORDER BY qualified_at DESC LIMIT 200"),
    rows(db, "SELECT deploy_intent_id,project_id,workspace_id,requested_by,source_revision_id,source_content_hash,status,created_at,updated_at FROM wcb_deploy_intents ORDER BY created_at DESC LIMIT 200"),
    rows(db, "SELECT user_id,count(*)::int AS identity_count,bool_or(active) AS has_active_identity FROM wcb_identity_accounts GROUP BY user_id ORDER BY user_id LIMIT 500"),
    rows(db, "SELECT session_id,user_id,created_at,expires_at,active,auth_provider FROM wcb_sessions WHERE active AND expires_at>clock_timestamp() ORDER BY created_at DESC LIMIT 500"),
    rows(db, "SELECT workspace_id,count(*) FILTER (WHERE active)::int AS active_members,count(*) FILTER (WHERE active AND role='owner')::int AS owners FROM wcb_workspace_members GROUP BY workspace_id ORDER BY workspace_id LIMIT 500"),
    rows(db, "SELECT user_id,role,active,epoch FROM wcb_product_operators ORDER BY CASE role WHEN 'bigperson' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END,user_id LIMIT 200"),
    rows(db, "SELECT entitlement_id,user_id,release_id,provider,status,granted_at,revoked_at FROM wcb_license_entitlements ORDER BY granted_at DESC LIMIT 200"),
    rows(db, "SELECT audit_id,actor_user_id,actor_authority,action,target_type,target_id,transition,created_at FROM wcb_control_audit ORDER BY created_at DESC LIMIT 500"),
  ])

  const current = (await rows(db,
    "SELECT role,active,epoch FROM wcb_product_operators WHERE user_id=$1 FOR SHARE",
    [session.userId]))[0]
  if (!current?.active || current.role !== operator.role || Number(current.epoch) !== Number(operator.epoch)) return undefined

  return Object.freeze({
    authority: Object.freeze({ role: String(operator.role), epoch: Number(operator.epoch) }),
    sellerApplications, submissions, reviews, assessments, results, releases,
    listings, ready, deployIntents, users, sessions, workspaces, operators,
    entitlements, audit,
  })
}
