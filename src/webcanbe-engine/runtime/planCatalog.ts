/**
 * Public launch-plan facts. Keep payment adapters and public UI on this
 * single catalog; the catalog describes product policy, not entitlement state.
 */
export type PublicPlan = Readonly<{
  id: "free" | "pro" | "studio"
  name: string
  monthlyPriceUsd: number
  annualPriceUsd: number
  activeProjects: number
  includedAiActionsMonthly: number
  aiConcurrency: number
  deploySlots: number
}>

export const PUBLIC_PLAN_CATALOG: readonly PublicPlan[] = Object.freeze([
  Object.freeze({ id: "free", name: "Free", monthlyPriceUsd: 0, annualPriceUsd: 0, activeProjects: 3, includedAiActionsMonthly: 20, aiConcurrency: 1, deploySlots: 1 }),
  Object.freeze({ id: "pro", name: "Pro", monthlyPriceUsd: 12, annualPriceUsd: 120, activeProjects: 20, includedAiActionsMonthly: 300, aiConcurrency: 2, deploySlots: 5 }),
  Object.freeze({ id: "studio", name: "Studio", monthlyPriceUsd: 29, annualPriceUsd: 290, activeProjects: 100, includedAiActionsMonthly: 1000, aiConcurrency: 4, deploySlots: 20 }),
])

export const AI_ACTION_ADD_ONS = Object.freeze([
  Object.freeze({ actions: 100, priceUsd: 5 }),
  Object.freeze({ actions: 500, priceUsd: 15 }),
  Object.freeze({ actions: 1500, priceUsd: 35 }),
])

export const MARKETPLACE_POLICY = Object.freeze({ minimumPaidPriceUsd: 9, freeListingsAllowed: true })
