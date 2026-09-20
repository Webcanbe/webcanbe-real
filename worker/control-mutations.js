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
