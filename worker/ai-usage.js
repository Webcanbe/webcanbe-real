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
    if (typeof credit?.creditId !== "string") continue
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
        return existing
      }
      const allocations = allocateAiActions({
        includedGrants: await tx.includedGrantsForUserForUpdate(userId),
        purchasedCredits: await tx.purchasedCreditsForUserForUpdate(userId),
        consumed: await tx.activeReservationsForUserForUpdate(userId), cost, now: this.clock(),
      })
      return tx.insertReservation({ userId, projectId, idempotencyKey, cost, expectedRevision, allocations, status: "reserved", createdAt: this.clock() })
    })
  }
  async commit(id) { return this.repository.settleReservation(id, "committed", this.clock()) }
  async release(id) { return this.repository.settleReservation(id, "released", this.clock()) }
}
