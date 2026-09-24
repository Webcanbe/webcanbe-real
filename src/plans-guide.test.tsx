import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { PlansGuide } from "./plans-guide"
import type { PublicPaymentConfiguration } from "./webcanbe-engine/runtime/planCatalog"

const configuration: PublicPaymentConfiguration = {
  currency: "USD",
  plans: [
    { key: "pro_monthly", priceMinor: 1200, cadence: "month", activeProjects: 20, monthlyAiActions: 300, aiConcurrency: 2, deploySlots: 5 },
    { key: "pro_annual", priceMinor: 12000, cadence: "year", activeProjects: 20, monthlyAiActions: 300, aiConcurrency: 2, deploySlots: 5 },
    { key: "studio_monthly", priceMinor: 2900, cadence: "month", activeProjects: 100, monthlyAiActions: 1000, aiConcurrency: 4, deploySlots: 20 },
    { key: "studio_annual", priceMinor: 29000, cadence: "year", activeProjects: 100, monthlyAiActions: 1000, aiConcurrency: 4, deploySlots: 20 },
  ],
  aiActionPacks: [], aiActionCost: { standard: 1, deep: 3 },
  marketplace: { minimumPaidListingMinor: 900, freeListingsAllowed: true },
  checkoutAvailable: true, subscriptionCheckoutAvailable: true, aiPackCheckoutAvailable: true, environment: "live",
}

describe("PlansGuide", () => {
  it("keeps supporting prices in sync with the selected billing period", () => {
    const monthly = renderToStaticMarkup(<PlansGuide configuration={configuration} annual={false} />)
    const annual = renderToStaticMarkup(<PlansGuide configuration={configuration} annual />)
    expect(monthly).toContain("Current monthly price: $12.00.")
    expect(monthly).toContain("Current monthly price: $29.00.")
    expect(annual).toContain("Current annual price: $120.00.")
    expect(annual).toContain("Current annual price: $290.00.")
    expect(annual).not.toContain("Current monthly price")
  })
})
