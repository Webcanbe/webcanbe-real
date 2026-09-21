import { describe, expect, it } from "vitest"
import fs from "node:fs"
import { AiUsageService, PostgresAiUsageRepository, allocateAiActions } from "./ai-usage.js"

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
  it("never allocates a revoked purchased credit", () => {
    expect(() => allocateAiActions({ includedGrants: [], purchasedCredits: [{ ...credit, revokedAt: "2026-09-21T00:00:00.000Z" }], consumed: [], cost: 1 })).toThrow("Not enough AI Actions")
  })
  it("refuses to commit a reservation whose purchased source was revoked", async () => {
    const queries = []
    const db = { async query(sql) {
      queries.push(sql)
      if (sql.startsWith("SELECT user_id")) return { rowCount: 1, rows: [{ user_id: "user-1" }] }
      if (sql.startsWith("SELECT * FROM wcb_ai_usage_reservations")) return { rowCount: 1, rows: [{ reservation_id: "reservation-1", user_id: "user-1", project_id: "project-1", idempotency_key: "request-one", cost: 1, expected_revision: "rev_11111111-1111-4111-8111-111111111111", allocations: [{ kind: "purchased", sourceId: "11111111-1111-4111-8111-111111111111", actions: 1 }], status: "reserved" }] }
      if (sql.startsWith("SELECT 1\n        FROM jsonb_array_elements")) return { rowCount: 1, rows: [{ "?column?": 1 }] }
      return { rowCount: 0, rows: [] }
    } }
    const repo = new PostgresAiUsageRepository(db)
    await expect(repo.settleReservation("reservation-1", "committed", "2026-09-21T00:00:00.000Z")).rejects.toThrow("source was revoked")
    expect(queries).toContain("SELECT pg_advisory_xact_lock(hashtextextended($1,3))")
    expect(queries).toContain("ROLLBACK")
  })
  it("prevents concurrent reservations from overdrawing the same grant", async () => {
    const reservations = []; let id = 0
    const repo = { async atomic(_user, action) { return action(this) }, async reservationByUserKeyForUpdate(_user, key) { return reservations.find(row => row.idempotencyKey === key) }, async concurrencyLimitForUserForUpdate() { return 1 }, async includedGrantsForUserForUpdate() { return [month] }, async purchasedCreditsForUserForUpdate() { return [] }, async activeReservationsForUserForUpdate() { return reservations }, async insertReservation(row) { const value = { ...row, id: `r-${++id}` }; reservations.push(value); return value }, async settleReservation(reservationId, status) { const row = reservations.find(value => value.id === reservationId); row.status = status; return row } }
    const usage = new AiUsageService(repo, () => "2026-09-21T00:00:00.000Z")
    await usage.reserve({ userId: "u", projectId: "p", idempotencyKey: "request-one", cost: 20, expectedRevision: "rev_1" })
    await expect(usage.reserve({ userId: "u", projectId: "p", idempotencyKey: "request-two", cost: 1, expectedRevision: "rev_1" })).rejects.toThrow("concurrency")
  })
  it("reuses an idempotent reservation and release restores availability", async () => {
    const reservations = []; const repo = { async atomic(_user, action) { return action(this) }, async reservationByUserKeyForUpdate(_user, key) { return reservations.find(row => row.idempotencyKey === key) }, async concurrencyLimitForUserForUpdate() { return 1 }, async includedGrantsForUserForUpdate() { return [month] }, async purchasedCreditsForUserForUpdate() { return [] }, async activeReservationsForUserForUpdate() { return reservations }, async insertReservation(row) { const value = { ...row, id: "r1" }; reservations.push(value); return value }, async settleReservation(id, status) { const row = reservations.find(value => value.id === id); row.status = status; return row } }
    const usage = new AiUsageService(repo, () => "2026-09-21T00:00:00.000Z"), input = { userId: "u", projectId: "p", idempotencyKey: "request-one", cost: 3, expectedRevision: "rev_1" }
    const first = await usage.reserve(input), replay = await usage.reserve(input)
    expect(replay).toMatchObject({ id: first.id, replayed: true }); await usage.release("r1")
    await expect(usage.reserve({ ...input, idempotencyKey: "request-two", cost: 20 })).resolves.toMatchObject({ allocations: [{ actions: 20 }] })
  })
  it("declares durable server-only reservations and free monthly grants", () => {
    const migration = fs.readFileSync("deployment/hosted/migrations/20260922000100_wcb_ai_usage.sql", "utf8")
    expect(migration).toContain("wcb_ai_usage_reservations")
    expect(migration).toContain("UNIQUE(user_id,idempotency_key)")
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY")
    expect(migration).toContain("FROM PUBLIC, anon, authenticated")
    expect(migration).toContain("subscription_id DROP NOT NULL")
  })
  it("declares durable server-only purchased-credit revocation metadata", () => {
    const migration = fs.readFileSync("deployment/hosted/migrations/20260921152123_harden_payment_reversals.sql", "utf8")
    expect(migration).toContain("ai_pack_order_id uuid REFERENCES")
    expect(migration).toContain("revoked_at timestamptz")
    expect(migration).toContain("WHERE revoked_at IS NULL")
    expect(migration).toContain("wcb_payment_reversals")
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY")
  })
})
