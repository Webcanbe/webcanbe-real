import { describe, expect, it, vi } from "vitest"
import { createAnalytics, initializeAnalytics, isSafeAnalyticsPayload, safeLinkClickPayload, sanitizePostHogEvent } from "./analytics"

function client() {
  return { capture: vi.fn(), identify: vi.fn(), reset: vi.fn() }
}

describe("analytics", () => {
  it("is a no-op when disabled", async () => {
    const analytics = createAnalytics()
    expect(await initializeAnalytics("", "")).toBeNull()
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

  it("flushes safe events captured before asynchronous initialization", () => {
    const analytics = createAnalytics()
    analytics.capture("wcb_marketplace_viewed", { source: "marketplace" })
    const posthog = client()
    analytics.setClient(posthog as never)
    expect(posthog.capture).toHaveBeenCalledWith("wcb_marketplace_viewed", { source: "marketplace" })
  })

  it("queues internal identity until initialization and clears pending data on sign-out", () => {
    const analytics = createAnalytics()
    analytics.identify("wcb-user-123", { account_creation_state: "complete", auth_provider_names: ["google"] })
    analytics.capture("wcb_dashboard_viewed", { source: "dashboard" })
    const posthog = client()
    analytics.setClient(posthog as never)
    expect(posthog.identify).toHaveBeenCalledWith("wcb-user-123", { account_creation_state: "complete", auth_provider_names: ["google"] })
    expect(posthog.capture).toHaveBeenCalledWith("wcb_dashboard_viewed", { source: "dashboard" })
    analytics.setClient(null)
    analytics.identify("wcb-user-456")
    analytics.capture("wcb_projects_viewed", { source: "projects" })
    analytics.reset()
    const fresh = client()
    analytics.setClient(fresh as never)
    expect(fresh.identify).not.toHaveBeenCalled()
    expect(fresh.capture).not.toHaveBeenCalled()
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

  it("keeps a safe product event when the SDK supplies transport fields", () => {
    const result = sanitizePostHogEvent({
      event: "wcb_project_viewed",
      properties: { listing_id: "aperture-north", source: "marketplace", token: "project-token", distinct_id: "anonymous-1", $current_url: "https://webcanbe.com/project/aperture-north?private=yes", private_note: "do not send" },
    } as never)
    expect(result?.properties).toMatchObject({ listing_id: "aperture-north", source: "marketplace", token: "project-token", distinct_id: "anonymous-1", $current_url: "https://webcanbe.com/project/:project" })
    expect(result?.properties.private_note).toBeUndefined()
  })

  it("keeps custom events with PostHog-injected non-dollar fields", () => {
    const result = sanitizePostHogEvent({ event: "wcb_checkout_started", properties: {
      source: "marketplace", listing_id: "listing-1", distinct_id: "sdk-user", token: "sdk-token",
      $current_url: "https://webcanbe.com/checkout/listing-1?secret=value#private",
    } } as never)
    expect(result?.properties).toMatchObject({ source: "marketplace", listing_id: "listing-1", distinct_id: "sdk-user", token: "sdk-token", $current_url: "https://webcanbe.com/checkout/:project" })
  })

  it("tracks only a normalized internal route or an external host", () => {
    expect(safeLinkClickPayload("/project/aperture-north/preview?private=1#hero", "https://webcanbe.com/browse?search=private")).toEqual({ source: "marketplace", link_kind: "internal", target_route: "/project/:project/preview" })
    expect(safeLinkClickPayload("https://github.com/Webcanbe/webcanbe-real?token=private#code", "https://webcanbe.com/contact")).toEqual({ source: "public", link_kind: "external", target_host: "github.com" })
    expect(safeLinkClickPayload("mailto:secret@example.com", "https://webcanbe.com/")).toBeNull()
    expect(safeLinkClickPayload("/projects?token=private", "https://webcanbe.com/dashboard")).toEqual({ source: "dashboard", link_kind: "internal", target_route: "/projects" })
    expect(safeLinkClickPayload("/notes/name%40example.com", "https://webcanbe.com/browse")).toBeNull()
  })

  it("sends an external click immediately before navigation", () => {
    const posthog = client()
    const analytics = createAnalytics(posthog as never)
    const properties = safeLinkClickPayload("https://github.com/Webcanbe?private=yes", "https://webcanbe.com/github")
    expect(properties).toEqual({ source: "public", link_kind: "external", target_host: "github.com" })
    analytics.capture("wcb_link_clicked", properties!, { transport: "sendBeacon", send_instantly: true })
    expect(posthog.capture).toHaveBeenCalledWith("wcb_link_clicked", properties, { transport: "sendBeacon", send_instantly: true })
  })

  it("rejects mixed link targets, query-bearing routes, and arbitrary fields", () => {
    const posthog = client()
    const analytics = createAnalytics(posthog as never)
    analytics.capture("wcb_link_clicked", { source: "public", link_kind: "internal", target_route: "/projects", target_host: "github.com" })
    analytics.capture("wcb_link_clicked", { source: "public", link_kind: "internal", target_route: "/projects?secret=yes" })
    analytics.capture("wcb_link_clicked", { source: "public", link_kind: "external", target_host: "github.com", link_text: "Private" } as never)
    expect(posthog.capture).not.toHaveBeenCalled()
  })
})
