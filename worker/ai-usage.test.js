import { describe, expect, it } from "vitest"
import { AiUsageService, allocateAiActions } from "./ai-usage.js"

const month = { grantId: "month-1", includedActions: 20, expiresAt: "2026-10-01T00:00:00.000Z" }
const annualMonth = { grantId: "annual-september", includedActions: 300, expiresAt: "2026-10-01T00:00:00.000Z" }
const credit = { creditId: "pack-1", purchasedActions: 100 }

describe("AI Action usage", () => {
  it("uses unexpired included grants before separate purchased credit rows", () => {
    expect(allocateAiActions({ includedGrants: [month], purchasedCredits: [credit], consumed: [], cost: 21, now: "2026-09-21T00:00:00.000Z" })).toEqual([{ kind: "included", sourceId: "month-1", actions: 20 }, { kind: "purchased", sourceId: "pack-1", actions: 1 }])
  })
  it("treats annual subscribers as monthly grants and never expires purchased actions", () => {
    expect(allocateAiActions({ includedGrants: [annualMonth], purchasedCredits: [credit], consumed: [], cost: 3, now: "2026-09-21T00:00:00.000Z" })).toEqual([{ kind: "included", sourceId: "annual-september", actions: 3 }])
    expect(allocateAiActions({ includedGrants: [month], purchasedCredits: [credit], consumed: [], cost: 1, now: "2026-11-01T00:00:00.000Z" })).toEqual([{ kind: "purchased", sourceId: "pack-1", actions: 1 }])
  })
  it("prevents concurrent reservations from overdrawing the same grant", async () => {
    const reservations = []; let id = 0
    const repo = { async atomic(_user, action) { return action(this) }, async reservationByUserKeyForUpdate(_user, key) { return reservations.find(row => row.idempotencyKey === key) }, async includedGrantsForUserForUpdate() { return [month] }, async purchasedCreditsForUserForUpdate() { return [] }, async activeReservationsForUserForUpdate() { return reservations }, async insertReservation(row) { const value = { ...row, id: `r-${++id}` }; reservations.push(value); return value }, async settleReservation(reservationId, status) { const row = reservations.find(value => value.id === reservationId); row.status = status; return row } }
    const usage = new AiUsageService(repo, () => "2026-09-21T00:00:00.000Z")
    await usage.reserve({ userId: "u", projectId: "p", idempotencyKey: "request-one", cost: 20, expectedRevision: "rev_1" })
    await expect(usage.reserve({ userId: "u", projectId: "p", idempotencyKey: "request-two", cost: 1, expectedRevision: "rev_1" })).rejects.toThrow("Not enough")
  })
  it("reuses an idempotent reservation and release restores availability", async () => {
    const reservations = []; const repo = { async atomic(_user, action) { return action(this) }, async reservationByUserKeyForUpdate(_user, key) { return reservations.find(row => row.idempotencyKey === key) }, async includedGrantsForUserForUpdate() { return [month] }, async purchasedCreditsForUserForUpdate() { return [] }, async activeReservationsForUserForUpdate() { return reservations }, async insertReservation(row) { const value = { ...row, id: "r1" }; reservations.push(value); return value }, async settleReservation(id, status) { const row = reservations.find(value => value.id === id); row.status = status; return row } }
    const usage = new AiUsageService(repo, () => "2026-09-21T00:00:00.000Z"), input = { userId: "u", projectId: "p", idempotencyKey: "request-one", cost: 3, expectedRevision: "rev_1" }
    expect(await usage.reserve(input)).toBe(await usage.reserve(input)); await usage.release("r1")
    await expect(usage.reserve({ ...input, idempotencyKey: "request-two", cost: 20 })).resolves.toMatchObject({ allocations: [{ actions: 20 }] })
  })
})
