import { randomUUID } from "node:crypto"
import { WEB_CAN_BE_PLANS } from "./payments/contracts.js"

/**
 * AI owns reservations and consumption; Payments owns the immutable grant and
 * purchase rows. Repositories must run these methods in one DB transaction
 * with a per-user lock. Allocation retains every source row, so monthly grants
 * and non-expiring purchased credits can never be collapsed into one balance.
 */
export class AiUsageError extends Error { constructor(status, message) { super(message); this.status = status } }
const fail = (status, message) => { throw new AiUsageError(status, message) }
const actions = row => Number.isSafeInteger(row?.actions) && row.actions >= 0 ? row.actions : 0

export function allocateAiActions({ includedGrants, purchasedCredits, consumed, cost, now = new Date().toISOString() }) {
  if (!Number.isSafeInteger(cost) || cost < 1) fail(422, "Invalid AI Action cost.")
  const used = new Map()
  for (const item of consumed ?? []) {
    if (!item || !["reserved", "committed"].includes(item.status)) continue
    for (const allocation of item.allocations ?? []) used.set(`${allocation.kind}:${allocation.sourceId}`, (used.get(`${allocation.kind}:${allocation.sourceId}`) ?? 0) + actions(allocation))
  }
  const available = []
  for (const grant of includedGrants ?? []) {
    if (typeof grant?.grantId !== "string" || typeof grant?.expiresAt !== "string" || new Date(grant.expiresAt) <= new Date(now)) continue
    const remaining = actions({ actions: grant.includedActions }) - (used.get(`included:${grant.grantId}`) ?? 0)
    if (remaining > 0) available.push({ kind: "included", sourceId: grant.grantId, actions: remaining, expiresAt: grant.expiresAt })
  }
  // Included actions expire, so consume the nearest-expiring grant first.
  available.sort((a, b) => a.expiresAt.localeCompare(b.expiresAt) || a.sourceId.localeCompare(b.sourceId))
  for (const credit of purchasedCredits ?? []) {
    if (typeof credit?.creditId !== "string" || credit.revokedAt) continue
    const remaining = actions({ actions: credit.purchasedActions }) - (used.get(`purchased:${credit.creditId}`) ?? 0)
    if (remaining > 0) available.push({ kind: "purchased", sourceId: credit.creditId, actions: remaining })
  }
  let remaining = cost; const allocations = []
  for (const source of available) {
    if (!remaining) break
    const amount = Math.min(remaining, source.actions)
    allocations.push({ kind: source.kind, sourceId: source.sourceId, actions: amount })
    remaining -= amount
  }
  if (remaining) fail(402, "Not enough AI Actions available.")
  return allocations
}

/** Stable AI-owned repository contract. Payments provides read-only grant rows. */
export class AiUsageService {
  constructor(repository, clock = () => new Date().toISOString()) { this.repository = repository; this.clock = clock }
  async reserve({ userId, projectId, idempotencyKey, cost, expectedRevision }) {
    return this.repository.atomic(userId, async tx => {
      const existing = await tx.reservationByUserKeyForUpdate(userId, idempotencyKey)
      if (existing) {
        if (existing.projectId !== projectId || existing.cost !== cost || existing.expectedRevision !== expectedRevision) fail(409, "AI idempotency key belongs to another request.")
        return { ...existing, replayed: true }
      }
      const active = await tx.activeReservationsForUserForUpdate(userId)
      // A failed generation can outlive a transient ledger outage. Its server-
      // written marker is safe to release before allocating a new request.
      for (const item of active) if (item.status === "reserved" && item.outcome?.releasePending === true) await tx.settleReservationForUpdate(item.id, "released", this.clock())
      const availableActive = active.filter(item => !(item.status === "reserved" && item.outcome?.releasePending === true))
      const concurrency = await tx.concurrencyLimitForUserForUpdate(userId)
      if (availableActive.filter(item => item.status === "reserved").length >= concurrency) fail(429, "AI concurrency limit reached.")
      const allocations = allocateAiActions({
        includedGrants: await tx.includedGrantsForUserForUpdate(userId),
        purchasedCredits: await tx.purchasedCreditsForUserForUpdate(userId),
        consumed: availableActive, cost, now: this.clock(),
      })
      return { ...await tx.insertReservation({ userId, projectId, idempotencyKey, cost, expectedRevision, allocations, status: "reserved", createdAt: this.clock() }), replayed: false }
    })
  }
  async commit(id, outcome) { return this.repository.settleReservation(id, "committed", this.clock(), outcome) }
  async release(id) { return this.repository.settleReservation(id, "released", this.clock()) }
  async recordPending(id, outcome) { return this.repository.recordPendingReservation(id, outcome) }
}

const reservation = row => row && ({
  id: String(row.reservation_id), userId: String(row.user_id), projectId: String(row.project_id),
  idempotencyKey: String(row.idempotency_key), cost: Number(row.cost), expectedRevision: String(row.expected_revision),
  allocations: row.allocations, status: String(row.status), outcome: row.outcome ?? undefined,
})

/** PostgreSQL adapter. Every allocation decision is serialized per user. */
export class PostgresAiUsageRepository {
  constructor(db) { this.db = db }
  async atomic(userId, action) {
    await this.db.query("BEGIN")
    try {
      await this.db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,3))", [String(userId)])
      const result = await action(this)
      await this.db.query("COMMIT")
      return result
    } catch (error) {
      await this.db.query("ROLLBACK").catch(() => {})
      throw error
    }
  }
  async reservationByUserKeyForUpdate(userId, idempotencyKey) {
    const result = await this.db.query("SELECT * FROM wcb_ai_usage_reservations WHERE user_id=$1 AND idempotency_key=$2 FOR UPDATE", [userId, idempotencyKey])
    return reservation(result.rows[0])
  }
  async concurrencyLimitForUserForUpdate(userId) {
    const result = await this.db.query("SELECT plan_key FROM wcb_subscriptions WHERE user_id=$1 AND status='active' ORDER BY updated_at DESC LIMIT 1 FOR UPDATE", [userId])
    const key = result.rows[0]?.plan_key
    return key && WEB_CAN_BE_PLANS[key] ? WEB_CAN_BE_PLANS[key].aiConcurrency : WEB_CAN_BE_PLANS.free.aiConcurrency
  }
  async includedGrantsForUserForUpdate(userId) {
    const paid = await this.db.query("SELECT 1 FROM wcb_subscriptions WHERE user_id=$1 AND status='active' LIMIT 1 FOR UPDATE", [userId])
    if (!paid.rowCount) {
      const now = new Date(), month = now.toISOString().slice(0, 7)
      const expiresAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString()
      await this.db.query(
        "INSERT INTO wcb_ai_included_grants(grant_id,user_id,subscription_id,grant_month,included_actions,expires_at,idempotency_key,created_at) VALUES($1,$2,NULL,$3,$4,$5,$6,clock_timestamp()) ON CONFLICT(idempotency_key) DO NOTHING",
        [randomUUID(), userId, month, WEB_CAN_BE_PLANS.free.monthlyAiActions, expiresAt, `free-grant:${userId}:${month}`],
      )
    }
    const result = await this.db.query("SELECT grant_id,included_actions,expires_at FROM wcb_ai_included_grants WHERE user_id=$1 AND expires_at>clock_timestamp() ORDER BY expires_at,grant_id FOR UPDATE", [userId])
    return result.rows.map(row => ({ grantId: String(row.grant_id), includedActions: Number(row.included_actions), expiresAt: new Date(row.expires_at).toISOString() }))
  }
  async purchasedCreditsForUserForUpdate(userId) {
    const result = await this.db.query("SELECT credit_id,purchased_actions FROM wcb_ai_purchased_credits WHERE user_id=$1 AND revoked_at IS NULL ORDER BY created_at,credit_id FOR UPDATE", [userId])
    return result.rows.map(row => ({ creditId: String(row.credit_id), purchasedActions: Number(row.purchased_actions) }))
  }
  async activeReservationsForUserForUpdate(userId) {
    const result = await this.db.query("SELECT * FROM wcb_ai_usage_reservations WHERE user_id=$1 AND status IN ('reserved','committed') ORDER BY created_at,reservation_id FOR UPDATE", [userId])
    return result.rows.map(reservation)
  }
  async insertReservation(value) {
    const id = randomUUID()
    const result = await this.db.query(
      "INSERT INTO wcb_ai_usage_reservations(reservation_id,user_id,project_id,idempotency_key,cost,expected_revision,allocations,status,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,'reserved',$8) RETURNING *",
      [id, value.userId, value.projectId, value.idempotencyKey, value.cost, value.expectedRevision, JSON.stringify(value.allocations), value.createdAt],
    )
    return reservation(result.rows[0])
  }
  async settleReservation(id, status, settledAt, outcome) {
    const owner = await this.db.query("SELECT user_id FROM wcb_ai_usage_reservations WHERE reservation_id=$1", [id])
    if (!owner.rowCount) fail(409, "AI reservation is unavailable.")
    return this.atomic(String(owner.rows[0].user_id), tx => tx.settleReservationForUpdate(id, status, settledAt, outcome))
  }
  async recordPendingReservation(id, outcome) {
    const owner = await this.db.query("SELECT user_id FROM wcb_ai_usage_reservations WHERE reservation_id=$1", [id])
    if (!owner.rowCount) fail(409, "AI reservation is unavailable.")
    return this.atomic(String(owner.rows[0].user_id), async () => {
      const result = await this.db.query("UPDATE wcb_ai_usage_reservations SET outcome=$2::jsonb WHERE reservation_id=$1 AND status='reserved' RETURNING *", [id, JSON.stringify(outcome)])
      if (!result.rowCount) fail(409, "AI reservation is no longer pending.")
      return reservation(result.rows[0])
    })
  }
  async settleReservationForUpdate(id, status, settledAt, outcome) {
    const currentResult = await this.db.query("SELECT * FROM wcb_ai_usage_reservations WHERE reservation_id=$1 FOR UPDATE", [id])
    if (!currentResult.rowCount) fail(409, "AI reservation is unavailable.")
    const current = reservation(currentResult.rows[0])
    if (status === "committed" && current.status === "released") fail(409, "AI reservation was released.")
    if (status === "committed" && current.status === "reserved") {
      const revoked = await this.db.query(`SELECT 1
        FROM jsonb_array_elements($1::jsonb) allocation
        JOIN wcb_ai_purchased_credits credit ON credit.credit_id=(allocation->>'sourceId')::uuid
        WHERE allocation->>'kind'='purchased' AND credit.revoked_at IS NOT NULL
        LIMIT 1`, [JSON.stringify(current.allocations)])
      if (revoked.rowCount) fail(409, "AI Action source was revoked.")
    }
    const result = await this.db.query(
      `UPDATE wcb_ai_usage_reservations
          SET status=CASE WHEN status='reserved' THEN $2 ELSE status END,
              settled_at=CASE WHEN status='reserved' THEN $3 ELSE settled_at END,
              outcome=CASE WHEN $2='committed' AND status IN ('reserved','committed') AND $4::jsonb IS NOT NULL THEN $4::jsonb ELSE outcome END
        WHERE reservation_id=$1
        RETURNING *`,
      [id, status, settledAt, outcome === undefined ? null : JSON.stringify(outcome)],
    )
    return reservation(result.rows[0])
  }
}
