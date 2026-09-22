export type PaymentReturn = Readonly<{
  kind: "none" | "return" | "cancelled"
  providerOrderId?: string
}>

export function paymentReturn(search: string, parameter: "payment" | "subscription" | "ai-pack"): PaymentReturn {
  const params = new URLSearchParams(search)
  const value = params.get(parameter)
  if (value === "cancelled") return { kind: "cancelled" }
  if (value !== "return") return { kind: "none" }
  const token = params.get("token")
  return token && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(token)
    ? { kind: "return", providerOrderId: token }
    : { kind: "return" }
}

export function paymentIdempotencyKey(kind: "marketplace" | "subscription" | "ai-pack", subject: string, storage: Pick<Storage, "getItem" | "setItem"> = localStorage) {
  const storageKey = `wcb-payment:${kind}:${subject}`
  const existing = storage.getItem(storageKey)
  if (existing && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(existing)) return existing
  const generated = `${kind}:${crypto.randomUUID()}`
  storage.setItem(storageKey, generated)
  return generated
}

export function clearPaymentIdempotencyKey(kind: "marketplace" | "subscription" | "ai-pack", subject: string, storage: Pick<Storage, "removeItem"> = localStorage) {
  storage.removeItem(`wcb-payment:${kind}:${subject}`)
}
