import type { CaptureResult, PostHog } from "posthog-js"

export const analyticsEvents = [
  "wcb_signup_completed",
  "wcb_login_completed",
  "wcb_marketplace_viewed",
  "wcb_project_viewed",
  "wcb_project_acquired",
  "wcb_working_copy_created",
  "wcb_workspace_opened",
  "wcb_visual_save_completed",
  "wcb_code_save_completed",
  "wcb_ai_proposal_generated",
  "wcb_ai_edit_applied",
  "wcb_export_started",
  "wcb_export_completed",
  "wcb_checkout_started",
  "wcb_marketplace_purchase_completed",
  "wcb_subscription_started",
  "wcb_ai_pack_purchased",
] as const

export type AnalyticsEvent = (typeof analyticsEvents)[number]
export type AnalyticsProperties = Partial<{
  plan_key: string
  listing_id: string
  release_id: string
  editor_mode: "visual" | "code" | "preview" | "history"
  ai_mode: "proposal" | "apply"
  source: "marketplace" | "dashboard" | "projects" | "workspace" | "plans" | "auth" | "direct"
  state: "success" | "failure"
}>
export type AnalyticsPersonProperties = Partial<{
  plan: string
  account_creation_state: "new" | "existing" | "complete"
  auth_provider_names: string[]
}>

type AnalyticsClient = Pick<PostHog, "capture" | "identify" | "reset">

const eventNames = new Set<string>(analyticsEvents)
const propertyNames = new Set(["plan_key", "listing_id", "release_id", "editor_mode", "ai_mode", "source", "state"])
const identifier = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/
const editorModes = new Set(["visual", "code", "preview", "history"])
const aiModes = new Set(["proposal", "apply"])
const sources = new Set(["marketplace", "dashboard", "projects", "workspace", "plans", "auth", "direct"])
const states = new Set(["success", "failure"])

function safeIdentifier(value: unknown): value is string {
  if (typeof value !== "string" || !identifier.test(value)) return false
  if (/^(?:bearer|sk_|pk_|phc_|phx_)/i.test(value)) return false
  return !/^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)
}

export function isSafeAnalyticsPayload(properties: unknown): properties is AnalyticsProperties {
  if (properties === undefined) return true
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) return false
  for (const [key, value] of Object.entries(properties)) {
    if (!propertyNames.has(key)) return false
    if ((key === "plan_key" || key === "listing_id" || key === "release_id") && !safeIdentifier(value)) return false
    if (key === "editor_mode" && !editorModes.has(String(value))) return false
    if (key === "ai_mode" && !aiModes.has(String(value))) return false
    if (key === "source" && !sources.has(String(value))) return false
    if (key === "state" && !states.has(String(value))) return false
  }
  return true
}

function safePersonProperties(properties: unknown): properties is AnalyticsPersonProperties {
  if (properties === undefined) return true
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) return false
  for (const [key, value] of Object.entries(properties)) {
    if (key === "plan" && safeIdentifier(value)) continue
    if (key === "account_creation_state" && ["new", "existing", "complete"].includes(String(value))) continue
    if (key === "auth_provider_names" && Array.isArray(value) && value.length <= 8 && value.every(safeIdentifier)) continue
    return false
  }
  return true
}

export function createAnalytics(initialClient: AnalyticsClient | null = null) {
  let client = initialClient
  let pending: Array<[AnalyticsEvent, AnalyticsProperties]> = []
  return {
    setClient(next: AnalyticsClient | null) {
      client = next
      if (client) for (const [event, properties] of pending) {
        try { client.capture(event, properties) } catch { /* Never block product behavior. */ }
      }
      pending = []
    },
    capture(event: AnalyticsEvent, properties: AnalyticsProperties = {}) {
      if (!eventNames.has(event) || !isSafeAnalyticsPayload(properties)) return
      if (!client) { if (pending.length < 20) pending.push([event, properties]); return }
      try { client.capture(event, properties) } catch { /* Analytics must never interrupt product behavior. */ }
    },
    identify(distinctId: string, properties: AnalyticsPersonProperties = {}) {
      if (!client || !safeIdentifier(distinctId) || !safePersonProperties(properties)) return
      try { client.identify(distinctId, properties) } catch { /* Authentication remains authoritative. */ }
    },
    reset() {
      if (!client) return
      try { client.reset() } catch { /* Sign-out must complete even if analytics is unavailable. */ }
    },
  }
}

export const analytics = createAnalytics()

function normalizedPath(pathname: string) {
  if (/^\/project\/[^/]+/.test(pathname)) return "/project/:project"
  if (/^\/workspace\/[^/]+/.test(pathname)) return "/workspace/:project"
  return pathname
}

function safeUrl(value: unknown) {
  if (typeof value !== "string") return undefined
  try {
    const origin = typeof window === "undefined" ? "https://webcanbe.invalid" : window.location.origin
    const url = new URL(value, origin)
    url.pathname = normalizedPath(url.pathname)
    url.search = ""
    url.hash = ""
    return url.toString()
  } catch { return undefined }
}

export function sanitizePostHogEvent(event: CaptureResult | null): CaptureResult | null {
  if (!event) return null
  const properties = { ...event.properties }
  const currentUrl = safeUrl(properties.$current_url)
  if (currentUrl) properties.$current_url = currentUrl
  else delete properties.$current_url
  if (typeof properties.$pathname === "string") properties.$pathname = normalizedPath(properties.$pathname)
  delete properties.$search_engine
  delete properties.$referrer
  delete properties.$referring_domain
  if (typeof event.event === "string" && eventNames.has(event.event)) {
    // The SDK adds non-$ transport fields to captured events. They are not
    // product payload, so strip unknown fields rather than dropping the event.
    const sdkFields = new Set(["token", "distinct_id", "uuid", "timestamp", "lib", "lib_version"])
    for (const key of Object.keys(properties)) {
      if (!key.startsWith("$") && !propertyNames.has(key) && !sdkFields.has(key)) delete properties[key]
    }
    const supplied = Object.fromEntries(Object.entries(properties).filter(([key]) => propertyNames.has(key)))
    if (!isSafeAnalyticsPayload(supplied)) return null
  }
  return { ...event, properties }
}

const DEFAULT_POSTHOG_PROJECT_TOKEN = "phc_qUNb8jnbKrpCLAmrSrMA26rF9p9WMb38qDYAJqEqAYu2"
const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com"

export async function initializeAnalytics(
  token = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN || DEFAULT_POSTHOG_PROJECT_TOKEN,
  host = import.meta.env.VITE_POSTHOG_HOST || DEFAULT_POSTHOG_HOST,
): Promise<PostHog | null> {
  if (!token?.trim() || !host?.trim()) { analytics.setClient(null); return null }
  try {
    const endpoint = new URL(host.trim())
    if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password) { analytics.setClient(null); return null }
    const { default: posthog } = await import("posthog-js")
    posthog.init(token.trim(), {
      api_host: endpoint.toString().replace(/\/$/, ""),
      defaults: "2026-05-30",
      capture_pageview: "history_change",
      capture_pageleave: false,
      autocapture: false,
      disable_session_recording: true,
      mask_all_text: true,
      mask_all_element_attributes: true,
      person_profiles: "identified_only",
      disable_surveys: true,
      advanced_disable_feature_flags: true,
      before_send: sanitizePostHogEvent,
    })
    analytics.setClient(posthog)
    return posthog
  } catch {
    analytics.setClient(null)
    return null
  }
}
