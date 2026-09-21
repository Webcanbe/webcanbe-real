export const PAYMENT_CURRENCY = "USD"

export const WEB_CAN_BE_PLANS = Object.freeze({
  free: Object.freeze({ key: "free", priceMinor: 0, cadence: "none", activeProjects: 3, monthlyAiActions: 20 }),
  pro_monthly: Object.freeze({ key: "pro_monthly", tier: "pro", priceMinor: 1200, cadence: "month", activeProjects: 20, monthlyAiActions: 300 }),
  pro_annual: Object.freeze({ key: "pro_annual", tier: "pro", priceMinor: 12000, cadence: "year", activeProjects: 20, monthlyAiActions: 300 }),
  studio_monthly: Object.freeze({ key: "studio_monthly", tier: "studio", priceMinor: 2900, cadence: "month", activeProjects: 100, monthlyAiActions: 1000 }),
  studio_annual: Object.freeze({ key: "studio_annual", tier: "studio", priceMinor: 29000, cadence: "year", activeProjects: 100, monthlyAiActions: 1000 }),
})

export const AI_ACTION_PACKS = Object.freeze({
  actions_100: Object.freeze({ key: "actions_100", actions: 100, priceMinor: 500 }),
  actions_500: Object.freeze({ key: "actions_500", actions: 500, priceMinor: 1500 }),
  actions_1500: Object.freeze({ key: "actions_1500", actions: 1500, priceMinor: 3500 }),
})

export const AI_ACTION_COST = Object.freeze({ standard: 1, deep: 3 })
export const MINIMUM_PAID_LISTING_MINOR = 900
export const MINIMUM_PAYOUT_MINOR = 2500
export const CREATOR_EARNING_HOLD_DAYS = 14
export const FOUNDING_CREATOR_SALES_CAP_MINOR = 10_000_000

export const PAYPAL_WEBHOOK_EVENTS = Object.freeze([
  "CHECKOUT.ORDER.APPROVED",
  "PAYMENT.CAPTURE.COMPLETED",
  "PAYMENT.CAPTURE.DENIED",
  "PAYMENT.CAPTURE.REFUNDED",
  "PAYMENT.CAPTURE.REVERSED",
  "CUSTOMER.DISPUTE.CREATED",
  "CUSTOMER.DISPUTE.RESOLVED",
  "BILLING.SUBSCRIPTION.ACTIVATED",
  "BILLING.SUBSCRIPTION.CANCELLED",
  "BILLING.SUBSCRIPTION.EXPIRED",
  "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
  "BILLING.SUBSCRIPTION.SUSPENDED",
  "PAYMENT.SALE.COMPLETED",
  "PAYMENT.SALE.REFUNDED",
  "PAYMENT.SALE.REVERSED",
])

export class PaymentError extends Error {
  constructor(status, code, message) {
    super(message)
    this.name = "PaymentError"
    this.status = status
    this.code = code
  }
}

export function exactObject(input, allowed, message = "Invalid payment request.") {
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(key => !allowed.includes(key))) {
    throw new PaymentError(422, "invalid_request", message)
  }
  return input
}

export function paymentKey(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value)) {
    throw new PaymentError(422, "invalid_idempotency_key", "Invalid payment request.")
  }
  return value
}

export function domainId(value, label = "payment") {
  if (typeof value !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value)) {
    throw new PaymentError(422, "invalid_identifier", `Invalid ${label} request.`)
  }
  return value
}

export function moneyMinor(value, label = "amount") {
  if (!Number.isSafeInteger(value) || value < 0) throw new PaymentError(422, "invalid_amount", `Invalid ${label}.`)
  return value
}

export function moneyString(minor) {
  moneyMinor(minor)
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, "0")}`
}

export function parseMoney(value) {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)(?:\.[0-9]{2})$/.test(value)) throw new PaymentError(409, "provider_amount_invalid", "Payment provider amount is invalid.")
  const [whole, fraction] = value.split(".")
  const minor = Number(whole) * 100 + Number(fraction)
  if (!Number.isSafeInteger(minor)) throw new PaymentError(409, "provider_amount_invalid", "Payment provider amount is invalid.")
  return minor
}

export function addDays(iso, days) {
  return new Date(new Date(iso).getTime() + days * 86_400_000).toISOString()
}

export function grantMonth(instant) {
  const date = new Date(instant)
  if (!Number.isFinite(date.getTime())) throw new PaymentError(422, "invalid_time", "Invalid payment time.")
  return date.toISOString().slice(0, 7)
}

export function paypalPlanMapping(env) {
  const mapping = {
    pro_monthly: env?.PAYPAL_PLAN_PRO_MONTHLY,
    pro_annual: env?.PAYPAL_PLAN_PRO_ANNUAL,
    studio_monthly: env?.PAYPAL_PLAN_STUDIO_MONTHLY,
    studio_annual: env?.PAYPAL_PLAN_STUDIO_ANNUAL,
  }
  for (const [key, value] of Object.entries(mapping)) {
    if (typeof value !== "string" || !value.trim()) throw new PaymentError(503, "plan_not_configured", `${key} is not configured.`)
  }
  return Object.freeze(mapping)
}

export function creatorFeeRate({ founding, firstPaidListingAt, cumulativeSalesMinor, soldAt, publicPaidLaunchAt }) {
  if (founding) {
    const deadline = firstPaidListingAt ? new Date(firstPaidListingAt) : undefined
    if (deadline) deadline.setUTCFullYear(deadline.getUTCFullYear() + 1)
    if ((!deadline || new Date(soldAt) < deadline) && cumulativeSalesMinor < FOUNDING_CREATOR_SALES_CAP_MINOR) return 0
  }
  const launch = new Date(publicPaidLaunchAt), sale = new Date(soldAt)
  if (!Number.isFinite(launch.getTime()) || !Number.isFinite(sale.getTime())) throw new PaymentError(500, "fee_clock_invalid", "Creator fee clock is unavailable.")
  launch.setUTCMonth(launch.getUTCMonth() + 3)
  return sale < launch ? 500 : 800
}

export function creatorAmounts(grossMinor, rateBasisPoints) {
  moneyMinor(grossMinor, "gross amount")
  const platformFeeMinor = Math.floor(grossMinor * rateBasisPoints / 10_000)
  return Object.freeze({ grossMinor, platformFeeMinor, creatorEarningMinor: grossMinor - platformFeeMinor })
}

export function payoutDateKey(instant, offsetMinutes = 540) {
  const shifted = new Date(new Date(instant).getTime() + offsetMinutes * 60_000)
  if (!Number.isFinite(shifted.getTime())) throw new PaymentError(422, "invalid_time", "Invalid payout time.")
  const day = shifted.getUTCDate()
  if (day !== 1 && day !== 15) throw new PaymentError(409, "payout_window_closed", "Payout batches can only be created on the 1st or 15th.")
  return shifted.toISOString().slice(0, 10)
}
