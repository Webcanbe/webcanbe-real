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
  "wcb_link_clicked",
  "wcb_dashboard_viewed",
  "wcb_projects_viewed",
  "wcb_purchases_viewed",
  "wcb_marketplace_preview_opened",
  "wcb_editor_mode_changed",
  "wcb_creator_application_submitted",
  "wcb_creator_submission_submitted",
] as const

export type AnalyticsEvent = (typeof analyticsEvents)[number]
export type AnalyticsProperties = Partial<{
  plan_key: string
  listing_id: string
  release_id: string
  editor_mode: "visual" | "code" | "split" | "preview" | "history"
  ai_mode: "proposal" | "apply"
  source: "marketplace" | "dashboard" | "projects" | "purchases" | "workspace" | "plans" | "auth" | "settings" | "creator" | "public" | "direct"
  state: "success" | "failure"
  target_route: string
  target_host: string
  link_kind: "internal" | "external"
}>
export type AnalyticsPersonProperties = Partial<{
  plan: string
  account_creation_state: "new" | "existing" | "complete"
  auth_provider_names: string[]
}>

type AnalyticsClient = Pick<PostHog, "capture" | "identify" | "reset">

const eventNames = new Set<string>(analyticsEvents)
const propertyNames = new Set(["plan_key", "listing_id", "release_id", "editor_mode", "ai_mode", "source", "state", "target_route", "target_host", "link_kind"])
const identifier = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/
const editorModes = new Set(["visual", "code", "split", "preview", "history"])
const aiModes = new Set(["proposal", "apply"])
const sources = new Set(["marketplace", "dashboard", "projects", "purchases", "workspace", "plans", "auth", "settings", "creator", "public", "direct"])
const states = new Set(["success", "failure"])
const linkKinds = new Set(["internal", "external"])
const safeRoutePattern = /^\/[A-Za-z0-9/_:.-]{0,180}$/
const safeHostPattern = /^[A-Za-z0-9.-]{1,253}$/

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
    if (key === "target_route" && (typeof value !== "string" || !safeRoutePattern.test(value))) return false
    if (key === "target_host" && (typeof value !== "string" || !safeHostPattern.test(value))) return false
    if (key === "link_kind" && !linkKinds.has(String(value))) return false
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
  return {
    setClient(next: AnalyticsClient | null) { client = next },
    capture(event: AnalyticsEvent, properties: AnalyticsProperties = {}) {
      if (!client || !eventNames.has(event) || !isSafeAnalyticsPayload(properties)) return
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
    // createAnalytics() already rejects arbitrary caller properties. PostHog adds its own
    // transport/context properties before before_send, including non-$ keys such as token
    // and distinct_id. Validate only Webcanbe-owned analytics keys here so those SDK fields
    // do not accidentally suppress every custom event.
    const supplied = Object.fromEntries(Object.entries(properties).filter(([key]) => propertyNames.has(key)))
    if (!isSafeAnalyticsPayload(supplied)) return null
  }
  return { ...event, properties }
}


function sourceForPath(pathname: string): AnalyticsProperties["source"] {
  if (pathname === "/browse" || pathname === "/marketplace" || pathname.startsWith("/project/")) return "marketplace"
  if (pathname === "/dashboard") return "dashboard"
  if (pathname === "/projects") return "projects"
  if (pathname === "/purchases") return "purchases"
  if (pathname.startsWith("/workspace/")) return "workspace"
  if (pathname === "/plans") return "plans"
  if (pathname === "/login" || pathname === "/signup") return "auth"
  if (pathname.startsWith("/settings")) return "settings"
  if (pathname.startsWith("/seller") || pathname.startsWith("/creator")) return "creator"
  return "public"
}

let linkTrackingInstalled = false
export function installLinkTracking() {
  if (linkTrackingInstalled || typeof document === "undefined" || typeof window === "undefined") return
  linkTrackingInstalled = true
  document.addEventListener("click", event => {
    if (!(event.target instanceof Element)) return
    const anchor = event.target.closest("a[href]")
    if (!(anchor instanceof HTMLAnchorElement)) return
    if (anchor.download || anchor.target === "_blank" && !anchor.href) return
    let url: URL
    try { url = new URL(anchor.href, window.location.href) } catch { return }
    if (url.protocol !== "http:" && url.protocol !== "https:") return
    const internal = url.origin === window.location.origin
    const properties: AnalyticsProperties = {
      source: sourceForPath(window.location.pathname),
      link_kind: internal ? "internal" : "external",
      ...(internal ? { target_route: normalizedPath(url.pathname) } : { target_host: url.hostname.toLowerCase() }),
    }
    analytics.capture("wcb_link_clicked", properties)
  }, { capture: true })
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
