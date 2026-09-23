import { randomUUID } from "node:crypto"

const iso = value => value == null ? undefined : new Date(value).toISOString()
const camelOrder = row => row && ({
  orderId: String(row.order_id), buyerUserId: String(row.buyer_user_id), sellerUserId: String(row.seller_user_id), listingId: String(row.listing_id), releaseId: String(row.release_id), title: String(row.title),
  grossMinor: Number(row.gross_minor), platformFeeMinor: Number(row.platform_fee_minor), creatorEarningMinor: Number(row.creator_earning_minor), feeRateBasisPoints: Number(row.fee_rate_basis_points), currency: String(row.currency),
  provider: String(row.provider), providerRequestId: String(row.provider_request_id), ...(row.provider_order_id ? { providerOrderId: String(row.provider_order_id) } : {}), ...(row.provider_capture_id ? { providerCaptureId: String(row.provider_capture_id) } : {}),
  idempotencyKey: String(row.idempotency_key), status: String(row.status), ...(row.approval_url ? { approvalUrl: String(row.approval_url) } : {}), createdAt: iso(row.created_at), ...(row.completed_at ? { completedAt: iso(row.completed_at) } : {}), ...(row.refunded_at ? { refundedAt: iso(row.refunded_at) } : {}),
})
const camelSubscription = row => row && ({
  subscriptionId: String(row.subscription_id), userId: String(row.user_id), planKey: String(row.plan_key), provider: String(row.provider), providerPlanId: String(row.provider_plan_id),
  ...(row.provider_subscription_id ? { providerSubscriptionId: String(row.provider_subscription_id) } : {}), idempotencyKey: String(row.idempotency_key), status: String(row.status),
  ...(row.approval_url ? { approvalUrl: String(row.approval_url) } : {}), createdAt: iso(row.created_at), ...(row.active_at ? { activeAt: iso(row.active_at) } : {}),
  ...(row.current_period_end ? { currentPeriodEnd: iso(row.current_period_end) } : {}), ...(row.cancelled_at ? { cancelledAt: iso(row.cancelled_at) } : {}), ...(row.expired_at ? { expiredAt: iso(row.expired_at) } : {}),
  ...(row.failed_at ? { failedAt: iso(row.failed_at) } : {}), ...(row.last_provider_event_at ? { lastProviderEventAt: iso(row.last_provider_event_at) } : {}),
})
const camelRefund = row => row && ({ refundId: String(row.refund_id), orderId: String(row.order_id), providerRefundId: String(row.provider_refund_id), refundMinor: Number(row.refund_minor), currency: String(row.currency), idempotencyKey: String(row.idempotency_key), status: String(row.status), occurredAt: iso(row.occurred_at) })
const camelLedger = row => row && ({ entryId: String(row.entry_id), orderId: row.order_id ? String(row.order_id) : undefined, sellerUserId: String(row.seller_user_id), kind: String(row.kind), grossMinor: Number(row.gross_minor), platformFeeMinor: Number(row.platform_fee_minor), creatorAmountMinor: Number(row.creator_amount_minor), currency: String(row.currency), provider: String(row.provider), providerReference: String(row.provider_reference), holdUntil: iso(row.hold_until), state: String(row.state), payoutBatchId: row.payout_batch_id ? String(row.payout_batch_id) : undefined, occurredAt: iso(row.occurred_at) })
const camelBatch = row => row && ({ batchId: String(row.batch_id), batchKey: String(row.batch_key), scheduledFor: String(row.scheduled_for).slice(0, 10), status: String(row.status), members: typeof row.members === "string" ? JSON.parse(row.members) : structuredClone(row.members), createdAt: iso(row.created_at), ...(row.provider_reference ? { providerReference: String(row.provider_reference) } : {}), ...(row.paid_at ? { paidAt: iso(row.paid_at) } : {}) })
const camelAiPackOrder = row => row && ({ aiPackOrderId: String(row.ai_pack_order_id), userId: String(row.user_id), packKey: String(row.pack_key), actions: Number(row.actions), grossMinor: Number(row.gross_minor), currency: String(row.currency), provider: String(row.provider), providerRequestId: String(row.provider_request_id), ...(row.provider_order_id ? { providerOrderId: String(row.provider_order_id) } : {}), ...(row.provider_capture_id ? { providerCaptureId: String(row.provider_capture_id) } : {}), idempotencyKey: String(row.idempotency_key), status: String(row.status), ...(row.approval_url ? { approvalUrl: String(row.approval_url) } : {}), createdAt: iso(row.created_at), ...(row.completed_at ? { completedAt: iso(row.completed_at) } : {}) })

export class PostgresPaymentRepository {
  constructor(db, uuidFactory) { this.db = db; this.uuid = uuidFactory }

  async atomic(action) {
    await this.db.query("BEGIN")
    try { const value = await action(this); await this.db.query("COMMIT"); return value }
    catch (error) { try { await this.db.query("ROLLBACK") } catch {}; throw error }
  }

  async checkoutListing(listingId) {
    const row = (await this.db.query(`SELECT l.listing_id,l.release_id,l.title,l.status,l.availability,l.price_minor,l.currency,r.status AS release_status,p.seller_user_id,
      COALESCE(t.founding,false) AS founding,t.first_paid_listing_at
      FROM wcb_listings l JOIN wcb_project_releases r ON r.release_id=l.release_id
      JOIN wcb_listing_publications p ON p.listing_id=l.listing_id
      LEFT JOIN wcb_creator_terms t ON t.seller_user_id=p.seller_user_id
      WHERE l.listing_id=$1`, [listingId])).rows[0]
    return row && { listingId: String(row.listing_id), releaseId: String(row.release_id), sellerUserId: String(row.seller_user_id), title: String(row.title), status: String(row.status), availability: String(row.availability), releaseStatus: String(row.release_status), priceMinor: Number(row.price_minor), currency: String(row.currency), creatorTerms: { founding: row.founding === true, ...(row.first_paid_listing_at ? { firstPaidListingAt: iso(row.first_paid_listing_at) } : {}) } }
  }
  async creatorPaidSalesMinor(sellerUserId, before) { return Number((await this.db.query("SELECT COALESCE(sum(gross_minor),0) AS total FROM wcb_creator_ledger WHERE seller_user_id=$1 AND kind='sale' AND occurred_at<$2", [sellerUserId, before])).rows[0].total) }
  async markCreatorFirstPaidListing(sellerUserId, at) { await this.db.query("INSERT INTO wcb_creator_terms(seller_user_id,founding,first_paid_listing_at) VALUES($1,false,$2) ON CONFLICT(seller_user_id) DO UPDATE SET first_paid_listing_at=COALESCE(wcb_creator_terms.first_paid_listing_at,EXCLUDED.first_paid_listing_at),updated_at=clock_timestamp()", [sellerUserId,at]) }
  async orderByBuyerKey(userId, key) { return camelOrder((await this.db.query("SELECT * FROM wcb_orders WHERE buyer_user_id=$1 AND idempotency_key=$2", [userId, key])).rows[0]) }
  async orderById(id) { return camelOrder((await this.db.query("SELECT * FROM wcb_orders WHERE order_id=$1", [id])).rows[0]) }
  async orderForUpdate(id) { return camelOrder((await this.db.query("SELECT * FROM wcb_orders WHERE order_id=$1 FOR UPDATE", [id])).rows[0]) }
  async orderByProviderOrder(id) { return camelOrder((await this.db.query("SELECT * FROM wcb_orders WHERE provider='paypal' AND provider_order_id=$1", [id])).rows[0]) }
  async orderByCapture(id) { return camelOrder((await this.db.query("SELECT * FROM wcb_orders WHERE provider='paypal' AND provider_capture_id=$1", [id])).rows[0]) }
  async orderByCaptureForUpdate(id) { return camelOrder((await this.db.query("SELECT * FROM wcb_orders WHERE provider='paypal' AND provider_capture_id=$1 FOR UPDATE", [id])).rows[0]) }
  async aiPackOrderByUserKey(userId,key) { return camelAiPackOrder((await this.db.query("SELECT * FROM wcb_ai_pack_orders WHERE user_id=$1 AND idempotency_key=$2",[userId,key])).rows[0]) }
  async aiPackOrderById(id) { return camelAiPackOrder((await this.db.query("SELECT * FROM wcb_ai_pack_orders WHERE ai_pack_order_id=$1",[id])).rows[0]) }
  async aiPackOrderForUpdate(id) { return camelAiPackOrder((await this.db.query("SELECT * FROM wcb_ai_pack_orders WHERE ai_pack_order_id=$1 FOR UPDATE",[id])).rows[0]) }
  async aiPackOrderByProviderOrder(id) { return camelAiPackOrder((await this.db.query("SELECT * FROM wcb_ai_pack_orders WHERE provider='paypal' AND provider_order_id=$1",[id])).rows[0]) }
  async aiPackOrderByCapture(id) { return camelAiPackOrder((await this.db.query("SELECT * FROM wcb_ai_pack_orders WHERE provider='paypal' AND provider_capture_id=$1",[id])).rows[0]) }
  async aiPackOrderByCaptureForUpdate(id) { return camelAiPackOrder((await this.db.query("SELECT * FROM wcb_ai_pack_orders WHERE provider='paypal' AND provider_capture_id=$1 FOR UPDATE",[id])).rows[0]) }
  async insertAiPackOrder(row) { return camelAiPackOrder((await this.db.query(`INSERT INTO wcb_ai_pack_orders(ai_pack_order_id,user_id,pack_key,actions,gross_minor,currency,provider,provider_request_id,idempotency_key,status,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,[row.aiPackOrderId,row.userId,row.packKey,row.actions,row.grossMinor,row.currency,row.provider,row.providerRequestId,row.idempotencyKey,row.status,row.createdAt])).rows[0]) }
  async updateAiPackOrder(id,patch) { const columns={providerOrderId:"provider_order_id",providerCaptureId:"provider_capture_id",approvalUrl:"approval_url",status:"status",completedAt:"completed_at"}, entries=Object.entries(patch).filter(([key])=>columns[key]), params=[id,...entries.map(([,value])=>value)], sets=entries.map(([key],index)=>`${columns[key]}=$${index+2}`).join(","); return camelAiPackOrder((await this.db.query(`UPDATE wcb_ai_pack_orders SET ${sets},updated_at=clock_timestamp() WHERE ai_pack_order_id=$1 RETURNING *`,params)).rows[0]) }
  async ensurePurchasedAiCredit(row) { return (await this.db.query(`INSERT INTO wcb_ai_purchased_credits(credit_id,user_id,ai_pack_order_id,purchased_actions,provider_reference,idempotency_key,created_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(ai_pack_order_id) DO UPDATE SET ai_pack_order_id=EXCLUDED.ai_pack_order_id RETURNING *`,[row.creditId,row.userId,row.aiPackOrderId,row.purchasedActions,row.providerReference,row.idempotencyKey,row.createdAt])).rows[0] }
  async lockPaymentCapture(providerCaptureId) { await this.db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,4))", [String(providerCaptureId)]) }
  async lockAiUsageUser(userId) { await this.db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,3))", [String(userId)]) }
  async recordPaymentReversal(row) { return (await this.db.query(`INSERT INTO wcb_payment_reversals(provider,kind,provider_id,provider_capture_id,currency,occurred_at)
    VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(provider,kind,provider_id) DO NOTHING RETURNING provider_id`, [row.provider,row.kind,row.providerId,row.providerCaptureId,row.currency||null,row.occurredAt])).rowCount === 1 }
  async paymentReversalForCaptureForUpdate(providerCaptureId, currency) { const row=(await this.db.query(`SELECT kind,occurred_at FROM wcb_payment_reversals
    WHERE provider='paypal' AND provider_capture_id=$1 AND (currency IS NULL OR currency=$2)
    ORDER BY CASE kind WHEN 'refund' THEN 0 ELSE 1 END,occurred_at LIMIT 1 FOR UPDATE`,[providerCaptureId,currency])).rows[0]; return row&&{kind:String(row.kind),occurredAt:iso(row.occurred_at)} }
  async revokePurchasedAiCredit(aiPackOrderId, revokedAt, reason) {
    const credit = (await this.db.query("UPDATE wcb_ai_purchased_credits SET revoked_at=$2,revocation_reason=$3 WHERE ai_pack_order_id=$1 AND revoked_at IS NULL RETURNING *",[aiPackOrderId,revokedAt,reason])).rows[0]
    if (credit) await this.db.query(`UPDATE wcb_ai_usage_reservations
      SET status='released',settled_at=$2
      WHERE user_id=$1 AND status='reserved' AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(allocations) allocation
        WHERE allocation->>'kind'='purchased' AND allocation->>'sourceId'=$3
      )`, [String(credit.user_id), revokedAt, String(credit.credit_id)])
    return credit
  }
  async insertOrder(row) {
    const result = await this.db.query(`INSERT INTO wcb_orders(order_id,buyer_user_id,seller_user_id,listing_id,release_id,title,gross_minor,platform_fee_minor,creator_earning_minor,fee_rate_basis_points,currency,provider,provider_request_id,idempotency_key,status,created_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`, [row.orderId,row.buyerUserId,row.sellerUserId,row.listingId,row.releaseId,row.title,row.grossMinor,row.platformFeeMinor,row.creatorEarningMinor,row.feeRateBasisPoints,row.currency,row.provider,row.providerRequestId,row.idempotencyKey,row.status,row.createdAt])
    return camelOrder(result.rows[0])
  }
  async updateOrder(id, patch) {
    const columns = { status:"status",providerOrderId:"provider_order_id",providerCaptureId:"provider_capture_id",approvalUrl:"approval_url",completedAt:"completed_at",refundedAt:"refunded_at" }
    const entries = Object.entries(patch).filter(([key]) => columns[key])
    const params = [id, ...entries.map(([, value]) => value)]
    const sets = entries.map(([key], index) => `${columns[key]}=$${index + 2}`).join(",")
    return camelOrder((await this.db.query(`UPDATE wcb_orders SET ${sets},updated_at=clock_timestamp() WHERE order_id=$1 RETURNING *`, params)).rows[0])
  }
  async insertPaymentIdentity(row) { return (await this.db.query(`INSERT INTO wcb_payment_identities(provider,kind,provider_id,order_id,subscription_id,ai_pack_order_id,occurred_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(provider,kind,provider_id) DO NOTHING RETURNING provider_id`, [row.provider,row.kind,row.providerId,row.orderId||null,row.subscriptionId||null,row.aiPackOrderId||null,row.occurredAt])).rowCount === 1 }
  async ensureEntitlement(row) {
    const result = await this.db.query(`INSERT INTO wcb_license_entitlements(entitlement_id,user_id,release_id,provider,provider_reference,status,granted_at,order_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT(order_id) DO UPDATE SET order_id=EXCLUDED.order_id RETURNING *`, [row.entitlementId,row.userId,row.releaseId,row.provider,row.providerReference,row.status,row.grantedAt,row.orderId])
    return result.rows[0]
  }
  async revokeEntitlementForOrder(orderId, at, reason) { return (await this.db.query("UPDATE wcb_license_entitlements SET status='revoked',revoked_at=$2,revocation_reason=$3 WHERE order_id=$1 AND status='active' RETURNING *", [orderId,at,reason])).rows[0] }
  async insertLedgerEntry(row) {
    const result = await this.db.query(`INSERT INTO wcb_creator_ledger(entry_id,idempotency_key,order_id,seller_user_id,kind,gross_minor,platform_fee_minor,creator_amount_minor,currency,provider,provider_reference,hold_until,state,occurred_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT(idempotency_key) DO UPDATE SET idempotency_key=EXCLUDED.idempotency_key RETURNING *`, [row.entryId,row.idempotencyKey,row.orderId||null,row.sellerUserId,row.kind,row.grossMinor,row.platformFeeMinor,row.creatorAmountMinor,row.currency,row.provider,row.providerReference,row.holdUntil,row.state,row.occurredAt])
    return camelLedger(result.rows[0])
  }
  async creatorReversedMinor(orderId) { return Number((await this.db.query("SELECT COALESCE(-sum(creator_amount_minor),0) AS total FROM wcb_creator_ledger WHERE order_id=$1 AND creator_amount_minor<0", [orderId])).rows[0].total) }
  async platformReversedMinor(orderId) { return Number((await this.db.query("SELECT COALESCE(-sum(platform_fee_minor),0) AS total FROM wcb_creator_ledger WHERE order_id=$1 AND platform_fee_minor<0", [orderId])).rows[0].total) }
  async refundedMinor(orderId) { return Number((await this.db.query("SELECT COALESCE(sum(refund_minor),0) AS total FROM wcb_refunds WHERE order_id=$1 AND status='completed'", [orderId])).rows[0].total) }
  async refundByKey(key) { return camelRefund((await this.db.query("SELECT * FROM wcb_refunds WHERE idempotency_key=$1", [key])).rows[0]) }
  async refundByProviderId(id) { return camelRefund((await this.db.query("SELECT * FROM wcb_refunds WHERE provider_refund_id=$1", [id])).rows[0]) }
  async insertRefund(row) { return camelRefund((await this.db.query(`INSERT INTO wcb_refunds(refund_id,order_id,provider_refund_id,refund_minor,currency,idempotency_key,status,occurred_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [row.refundId,row.orderId,row.providerRefundId,row.refundMinor,row.currency,row.idempotencyKey,row.status,row.occurredAt])).rows[0]) }
  async flagReconciliation(row) { await this.db.query("INSERT INTO wcb_payment_reconciliation(item_id,kind,provider_id,payload,status,created_at) VALUES($1,$2,$3,$4,'pending',clock_timestamp()) ON CONFLICT(kind,provider_id) DO UPDATE SET payload=EXCLUDED.payload", [(this.uuid || randomUUID)(),row.kind,row.providerId,JSON.stringify(row.payload)]); return row }
  async subscriptionByUserKey(userId, key) { return camelSubscription((await this.db.query("SELECT * FROM wcb_subscriptions WHERE user_id=$1 AND idempotency_key=$2", [userId,key])).rows[0]) }
  async currentSubscriptionForUser(userId) { return camelSubscription((await this.db.query("SELECT * FROM wcb_subscriptions WHERE user_id=$1 AND status IN ('creating','approval_pending','active','past_due','cancelled','reconciliation_required') ORDER BY created_at DESC LIMIT 1", [userId])).rows[0]) }
  async aiActionBalanceForUser(userId) {
    const purchased = await this.db.query(`SELECT COALESCE(sum(credit.purchased_actions),0) AS granted,
      COALESCE((SELECT sum((allocation->>'actions')::integer) FROM wcb_ai_usage_reservations usage
        CROSS JOIN LATERAL jsonb_array_elements(usage.allocations) allocation
        JOIN wcb_ai_purchased_credits source ON source.credit_id=(allocation->>'sourceId')::uuid
        WHERE usage.user_id=$1 AND usage.status IN ('reserved','committed') AND allocation->>'kind'='purchased' AND source.revoked_at IS NULL),0) AS used
      FROM wcb_ai_purchased_credits credit WHERE credit.user_id=$1 AND credit.revoked_at IS NULL`, [userId])
    const row=purchased.rows[0]
    return { purchased: Math.max(0,Number(row.granted)-Number(row.used)) }
  }
  async subscriptionByProviderId(id) { return camelSubscription((await this.db.query("SELECT * FROM wcb_subscriptions WHERE provider='paypal' AND provider_subscription_id=$1", [id])).rows[0]) }
  async subscriptionByProviderIdForUpdate(id) { return camelSubscription((await this.db.query("SELECT * FROM wcb_subscriptions WHERE provider='paypal' AND provider_subscription_id=$1 FOR UPDATE", [id])).rows[0]) }
  async subscriptionForUpdate(id) { return camelSubscription((await this.db.query("SELECT * FROM wcb_subscriptions WHERE subscription_id=$1 FOR UPDATE", [id])).rows[0]) }
  async insertSubscription(row) { return camelSubscription((await this.db.query(`INSERT INTO wcb_subscriptions(subscription_id,user_id,plan_key,provider,provider_plan_id,idempotency_key,status,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [row.subscriptionId,row.userId,row.planKey,row.provider,row.providerPlanId,row.idempotencyKey,row.status,row.createdAt])).rows[0]) }
  async updateSubscription(id, patch) {
    const columns={providerSubscriptionId:"provider_subscription_id",approvalUrl:"approval_url",status:"status",activeAt:"active_at",currentPeriodEnd:"current_period_end",cancelledAt:"cancelled_at",expiredAt:"expired_at",failedAt:"failed_at",lastProviderEventAt:"last_provider_event_at"}
    const entries=Object.entries(patch).filter(([key])=>columns[key]), params=[id,...entries.map(([,value])=>value)], sets=entries.map(([key],index)=>`${columns[key]}=$${index+2}`).join(",")
    return camelSubscription((await this.db.query(`UPDATE wcb_subscriptions SET ${sets},updated_at=clock_timestamp() WHERE subscription_id=$1 RETURNING *`,params)).rows[0])
  }
  async markSubscriptionForReconciliation(id, providerSubscriptionId) { return camelSubscription((await this.db.query("UPDATE wcb_subscriptions SET status='reconciliation_required',approval_url=NULL,updated_at=clock_timestamp() WHERE subscription_id=$1 AND provider_subscription_id=$2 AND status IN ('creating','approval_pending') RETURNING *",[id,providerSubscriptionId])).rows[0]) }
  async markSubscriptionApprovalPending(id, providerSubscriptionId) { return camelSubscription((await this.db.query("UPDATE wcb_subscriptions SET status='approval_pending',updated_at=clock_timestamp() WHERE subscription_id=$1 AND provider_subscription_id=$2 AND status='creating' RETURNING *",[id,providerSubscriptionId])).rows[0]) }
  async insertSubscriptionPayment(row) { return (await this.db.query("INSERT INTO wcb_subscription_payments(subscription_id,provider_payment_id,gross_minor,currency,occurred_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(provider_payment_id) DO NOTHING", [row.subscriptionId,row.providerPaymentId,row.grossMinor,row.currency,row.occurredAt])).rowCount === 1 }
  async ensureAiGrant(row) { return (await this.db.query(`INSERT INTO wcb_ai_included_grants(grant_id,user_id,subscription_id,grant_month,included_actions,expires_at,idempotency_key,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(subscription_id,grant_month) DO UPDATE SET subscription_id=EXCLUDED.subscription_id RETURNING *`, [row.grantId,row.userId,row.subscriptionId,row.grantMonth,row.includedActions,row.expiresAt,row.idempotencyKey,row.createdAt])).rows[0] }
  async insertProviderEvent(row) { return (await this.db.query("INSERT INTO wcb_provider_events(provider,provider_event_id,event_type,occurred_at,payload,status,received_at) VALUES($1,$2,$3,$4,$5,'received',clock_timestamp()) ON CONFLICT(provider,provider_event_id) DO UPDATE SET status='received',last_error=NULL,received_at=clock_timestamp() WHERE wcb_provider_events.status='failed' RETURNING provider_event_id", [row.provider,row.providerEventId,row.eventType,row.occurredAt,JSON.stringify(row.payload)])).rowCount === 1 }
  async markProviderEventProcessed(id) { await this.db.query("UPDATE wcb_provider_events SET status='processed',processed_at=clock_timestamp(),last_error=NULL WHERE provider='paypal' AND provider_event_id=$1", [id]) }
  async markProviderEventFailed(id,error) { await this.db.query("UPDATE wcb_provider_events SET status='failed',last_error=$2 WHERE provider='paypal' AND provider_event_id=$1", [id,error.slice(0,500)]) }
  async availableLedgerEntries(instant) { return (await this.db.query("SELECT * FROM wcb_creator_ledger WHERE payout_batch_id IS NULL AND hold_until<=$1 ORDER BY seller_user_id,occurred_at,entry_id FOR UPDATE", [instant])).rows.map(camelLedger) }
  async payoutBatchByKey(key) { return camelBatch((await this.db.query("SELECT * FROM wcb_payout_batches WHERE batch_key=$1", [key])).rows[0]) }
  async payoutBatchForUpdate(id) { return camelBatch((await this.db.query("SELECT * FROM wcb_payout_batches WHERE batch_id=$1 FOR UPDATE", [id])).rows[0]) }
  async insertPayoutBatch(row) {
    const batch = camelBatch((await this.db.query("INSERT INTO wcb_payout_batches(batch_id,batch_key,scheduled_for,status,members,created_at) VALUES($1,$2,$3,$4,$5,$6) RETURNING *", [row.batchId,row.batchKey,row.scheduledFor,row.status,JSON.stringify(row.members),row.createdAt])).rows[0])
    for (const member of row.members) await this.db.query("UPDATE wcb_creator_ledger SET payout_batch_id=$1 WHERE entry_id=ANY($2::uuid[]) AND payout_batch_id IS NULL", [row.batchId,member.ledgerEntryIds])
    return batch
  }
  async updatePayoutBatch(id,patch) { return camelBatch((await this.db.query("UPDATE wcb_payout_batches SET status=$2,provider_reference=$3,paid_at=$4,updated_at=clock_timestamp() WHERE batch_id=$1 RETURNING *", [id,patch.status,patch.providerReference,patch.paidAt])).rows[0]) }
  async markPayoutEntriesPaid(batch,paidAt) { const ids=batch.members.flatMap(member=>member.ledgerEntryIds); await this.db.query("UPDATE wcb_creator_ledger SET state='paid',paid_at=$2 WHERE entry_id=ANY($1::uuid[]) AND payout_batch_id=$3", [ids,paidAt,batch.batchId]) }
}
