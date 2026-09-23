import { describe, expect, it, vi } from "vitest"
import { createAnalytics, initializeAnalytics, isSafeAnalyticsPayload, sanitizePostHogEvent } from "./analytics"

function client() {
  return { capture: vi.fn(), identify: vi.fn(), reset: vi.fn() }
}

describe("analytics", () => {
  it("is a no-op when disabled", () => {
    const analytics = createAnalytics()
    expect(initializeAnalytics("", "")).toBeNull()
    expect(() => {
      analytics.capture("wcb_marketplace_viewed", { source: "marketplace" })
      analytics.identify("internal-user-1", { plan: "free" })
      analytics.reset()
    }).not.toThrow()
  })

  it("captures approved events and minimal properties", () => {
    const posthog = client()
    const analytics = createAnalytics(posthog as never)
    analytics.capture("wcb_project_viewed", { listing_id: "listing-1", source: "marketplace" })
    expect(posthog.capture).toHaveBeenCalledWith("wcb_project_viewed", { listing_id: "listing-1", source: "marketplace" })
  })

  it("identifies by stable internal ID and resets", () => {
    const posthog = client()
    const analytics = createAnalytics(posthog as never)
    analytics.identify("wcb-user-123", { plan: "pro", account_creation_state: "complete", auth_provider_names: ["google"] })
    analytics.reset()
    expect(posthog.identify).toHaveBeenCalledWith("wcb-user-123", { plan: "pro", account_creation_state: "complete", auth_provider_names: ["google"] })
    expect(posthog.reset).toHaveBeenCalledOnce()
  })

  it("rejects sensitive or arbitrary payloads", () => {
    const posthog = client()
    const analytics = createAnalytics(posthog as never)
    analytics.capture("wcb_ai_proposal_generated", { prompt: "rewrite my private project" } as never)
    analytics.capture("wcb_code_save_completed", { source_code: "const token = 'secret'" } as never)
    analytics.identify("eyJhbGciOiJIUzI1NiJ9.payload.signature", { plan: "pro" })
    analytics.identify("internal-user-1", { email: "person@example.com" } as never)
    expect(posthog.capture).not.toHaveBeenCalled()
    expect(posthog.identify).not.toHaveBeenCalled()
    expect(isSafeAnalyticsPayload({ access_token: "secret" })).toBe(false)
  })

  it("redacts route identifiers, query strings, hashes, and referrers", () => {
    const result = sanitizePostHogEvent({
      event: "$pageview",
      properties: {
        $current_url: "https://webcanbe.com/workspace/personal-project?token=secret#private",
        $pathname: "/workspace/personal-project",
        $referrer: "https://example.com/private",
      },
    } as never)
    expect(result?.properties.$current_url).toBe("https://webcanbe.com/workspace/:project")
    expect(result?.properties.$pathname).toBe("/workspace/:project")
    expect(result?.properties.$referrer).toBeUndefined()
  })
})
