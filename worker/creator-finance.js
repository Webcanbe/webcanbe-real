import { CREATOR_EARNING_HOLD_DAYS, MINIMUM_PAYOUT_MINOR } from "./payments/contracts.js"

const iso = value => value ? new Date(value).toISOString() : null
const money = value => Number(value || 0)

export async function databaseCreatorFinance(db, session) {
  const approved = (await db.query("SELECT application_id FROM wcb_seller_applications WHERE user_id=$1 AND status='approved' LIMIT 1", [session.userId])).rows[0]
  if (!approved) return undefined
  const [ordersResult, ledgerResult, termsResult, payoutResult] = await Promise.all([
    db.query(`SELECT o.order_id,o.listing_id,l.title,o.gross_minor,o.platform_fee_minor,o.creator_earning_minor,o.fee_rate_basis_points,o.currency,o.status,o.created_at,o.completed_at,o.refunded_at,
      COALESCE((SELECT sum(r.refund_minor) FROM wcb_refunds r WHERE r.order_id=o.order_id),0)::bigint AS refund_minor
      FROM wcb_orders o JOIN wcb_listings l ON l.listing_id=o.listing_id WHERE o.seller_user_id=$1 ORDER BY o.created_at DESC LIMIT 200`, [session.userId]),
    db.query("SELECT entry_id,order_id,kind,gross_minor,platform_fee_minor,creator_amount_minor,currency,provider,provider_reference,hold_until,state,payout_batch_id,occurred_at,paid_at FROM wcb_creator_ledger WHERE seller_user_id=$1 ORDER BY occurred_at DESC LIMIT 500", [session.userId]),
    db.query("SELECT founding,first_paid_listing_at FROM wcb_creator_terms WHERE seller_user_id=$1", [session.userId]),
    db.query(`SELECT batch_id,batch_key,scheduled_for,status,provider_reference,created_at,updated_at,paid_at
      FROM wcb_payout_batches b WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(b.members) m WHERE m->>'sellerUserId'=$1 OR m->>'seller_user_id'=$1) ORDER BY scheduled_for DESC LIMIT 100`, [session.userId]),
  ])
  const orders = ordersResult.rows.map(row => ({ orderId: String(row.order_id), listingId: String(row.listing_id), listingTitle: String(row.title), grossMinor: money(row.gross_minor), platformFeeMinor: money(row.platform_fee_minor), creatorEarningMinor: money(row.creator_earning_minor), feeRateBasisPoints: Number.isInteger(Number(row.fee_rate_basis_points)) ? Number(row.fee_rate_basis_points) : null, refundMinor: money(row.refund_minor), currency: String(row.currency), status: String(row.status), createdAt: iso(row.created_at), completedAt: iso(row.completed_at), refundedAt: iso(row.refunded_at) }))
  const ledger = ledgerResult.rows.map(row => ({ entryId: String(row.entry_id), orderId: row.order_id ? String(row.order_id) : null, kind: String(row.kind), grossMinor: money(row.gross_minor), platformFeeMinor: money(row.platform_fee_minor), creatorAmountMinor: money(row.creator_amount_minor), currency: String(row.currency), provider: String(row.provider), providerReference: String(row.provider_reference), holdUntil: iso(row.hold_until), state: String(row.state), payoutBatchId: row.payout_batch_id ? String(row.payout_batch_id) : null, occurredAt: iso(row.occurred_at), paidAt: iso(row.paid_at) }))
  const now = Date.now(), sum = predicate => ledger.filter(predicate).reduce((total, entry) => total + entry.creatorAmountMinor, 0)
  const completed = orders.filter(order => ["completed", "partially_refunded", "refunded", "disputed"].includes(order.status))
  const cumulativeGrossMinor = completed.reduce((total, order) => total + order.grossMinor, 0)
  const terms = termsResult.rows[0]
  const foundingDeadline = terms?.first_paid_listing_at ? new Date(new Date(terms.first_paid_listing_at).setUTCFullYear(new Date(terms.first_paid_listing_at).getUTCFullYear() + 1)).toISOString() : null
  const foundingEligible = terms?.founding === true && cumulativeGrossMinor < 10_000_000 && (!foundingDeadline || now < Date.parse(foundingDeadline))
  return Object.freeze({
    summary: { grossPaidSalesMinor: completed.reduce((total, order) => total + order.grossMinor, 0), refundsDisputesMinor: ledger.filter(entry => ["refund", "dispute"].includes(entry.kind)).reduce((total, entry) => total + Math.abs(entry.grossMinor), 0), netCreatorEarningMinor: sum(() => true), orderCount: completed.length, currency: "USD" },
    balances: { heldMinor: sum(entry => entry.state !== "paid" && !entry.payoutBatchId && Date.parse(entry.holdUntil) > now), pendingMinor: sum(entry => entry.state !== "paid" && Boolean(entry.payoutBatchId)), availableMinor: sum(entry => entry.state !== "paid" && !entry.payoutBatchId && Date.parse(entry.holdUntil) <= now), paidMinor: sum(entry => entry.state === "paid"), negativeAdjustmentsMinor: Math.abs(sum(entry => entry.creatorAmountMinor < 0)), currency: "USD" },
    payoutPolicy: { minimumMinor: MINIMUM_PAYOUT_MINOR, holdDays: CREATOR_EARNING_HOLD_DAYS, windows: [1, 15] },
    feeState: { founding: terms?.founding === true, foundingEligible, foundingDeadline, cumulativeGrossMinor, foundingCapMinor: 10_000_000, standardIntroBasisPoints: 500, standardBasisPoints: 800, latestAppliedBasisPoints: completed[0]?.feeRateBasisPoints ?? null },
    orders, ledger,
    payouts: payoutResult.rows.map(row => ({ batchId: String(row.batch_id), batchKey: String(row.batch_key), scheduledFor: String(row.scheduled_for), status: String(row.status), providerReference: row.provider_reference ? String(row.provider_reference) : null, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at), paidAt: iso(row.paid_at) })),
  })
}
