export type PublicPaymentPlan = Readonly<{
  key: "free" | "pro_monthly" | "pro_annual" | "studio_monthly" | "studio_annual"
  tier?: "pro" | "studio"
  priceMinor: number
  cadence: "none" | "month" | "year"
  activeProjects: number
  monthlyAiActions: number
  aiConcurrency: number
  deploySlots: number
}>

export type PublicAiActionPack = Readonly<{ key: string; actions: number; priceMinor: number }>

export type PublicPaymentConfiguration = Readonly<{
  currency: "USD"
  plans: readonly PublicPaymentPlan[]
  aiActionPacks: readonly PublicAiActionPack[]
  aiActionCost: Readonly<{ standard: number; deep: number }>
  marketplace: Readonly<{ minimumPaidListingMinor: number; freeListingsAllowed: boolean }>
  checkoutAvailable: boolean
  subscriptionCheckoutAvailable: boolean
  aiPackCheckoutAvailable: boolean
  environment: "sandbox" | "live" | null
}>

export async function loadPublicPaymentConfiguration(fetcher: typeof fetch = fetch): Promise<PublicPaymentConfiguration> {
  const response = await fetcher("/__webcanbe/api/payments/config", { headers: { Accept: "application/json" } })
  if (!response.ok) throw new Error("Billing configuration is unavailable.")
  const value = await response.json() as Partial<PublicPaymentConfiguration>
  if (value.currency !== "USD" || !Array.isArray(value.plans) || !Array.isArray(value.aiActionPacks) || !value.aiActionCost || !value.marketplace || typeof value.checkoutAvailable !== "boolean" || typeof value.subscriptionCheckoutAvailable !== "boolean" || typeof value.aiPackCheckoutAvailable !== "boolean") {
    throw new Error("Billing configuration is invalid.")
  }
  return value as PublicPaymentConfiguration
}
