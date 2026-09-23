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
  "wcb_build_league_viewed",
  "wcb_build_league_intro_dismissed",
  "wcb_build_league_share_created",
  "wcb_build_league_referral_visit",
  "wcb_build_league_submission_completed",
] as const

export type AnalyticsEvent = (typeof analyticsEvents)[number]
export type AnalyticsProperties = Partial<{
  plan_key: string
  listing_id: string
  release_id: string
  editor_mode: "visual" | "code" | "split" | "history"
  ai_mode: "proposal" | "apply"
  source: "marketplace" | "dashboard" | "projects" | "purchases" | "workspace" | "plans" | "auth" | "settings" | "creator" | "public" | "direct"
  state: "success" | "failure"
  link_kind: "internal" | "external"
  target_route: string
  target_host: string
}>
export type AnalyticsPersonProperties = Partial<{
  plan: string
  account_creation_state: "new" | "existing" | "complete"
  auth_provider_names: string[]
}>

type AnalyticsClient = Pick<PostHog, "capture" | "identify" | "reset">
type CaptureOptions = { transport: "sendBeacon"; send_instantly: true }

const eventNames = new Set<string>(analyticsEvents)
const propertyNames = new Set(["plan_key", "listing_id", "release_id", "editor_mode", "ai_mode", "source", "state", "link_kind", "target_route", "target_host"])
const identifier = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/
const editorModes = new Set(["visual", "code", "split", "history"])
const aiModes = new Set(["proposal", "apply"])
const sources = new Set(["marketplace", "dashboard", "projects", "purchases", "workspace", "plans", "auth", "settings", "creator", "public", "direct"])
const states = new Set(["success", "failure"])
const linkKinds = new Set(["internal", "external"])
const routePattern = /^\/[A-Za-z0-9/_:.-]{0,180}$/
const hostPattern = /^(?=.{1,253}$)[a-z0-9]+(?:[.-][a-z0-9]+)*$/

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
    if (key === "link_kind" && !linkKinds.has(String(value))) return false
    if (key === "target_route" && (typeof value !== "string" || !routePattern.test(value))) return false
    if (key === "target_host" && (typeof value !== "string" || !hostPattern.test(value))) return false
  }
  return true
}

function safeEventPayload(event: AnalyticsEvent, properties: AnalyticsProperties) {
  if (!isSafeAnalyticsPayload(properties)) return false
  if (event !== "wcb_link_clicked") return true
  return Boolean(properties.source) && (
    properties.link_kind === "internal" && Boolean(properties.target_route) && !properties.target_host ||
    properties.link_kind === "external" && Boolean(properties.target_host) && !properties.target_route
  )
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
  let pending: Array<[AnalyticsEvent, AnalyticsProperties, CaptureOptions | undefined]> = []
  let pendingIdentity: [string, AnalyticsPersonProperties] | null = null
  return {
    setClient(next: AnalyticsClient | null) {
      client = next
      if (client) {
        if (pendingIdentity) {
          try { client.identify(...pendingIdentity) } catch { /* Authentication remains authoritative. */ }
        }
        for (const [event, properties, options] of pending) {
          try {
            if (options) client.capture(event, properties, options)
            else client.capture(event, properties)
          } catch { /* Never block product behavior. */ }
        }
      }
      pendingIdentity = null
      pending = []
    },
    capture(event: AnalyticsEvent, properties: AnalyticsProperties = {}, options?: CaptureOptions) {
      if (!eventNames.has(event) || !safeEventPayload(event, properties)) return
      if (!client) { if (pending.length < 20) pending.push([event, properties, options]); return }
      try {
        if (options) client.capture(event, properties, options)
        else client.capture(event, properties)
      } catch { /* Analytics must never interrupt product behavior. */ }
    },
    identify(distinctId: string, properties: AnalyticsPersonProperties = {}) {
      if (!safeIdentifier(distinctId) || !safePersonProperties(properties)) return
      if (!client) { pendingIdentity = [distinctId, properties]; return }
      try { client.identify(distinctId, properties) } catch { /* Authentication remains authoritative. */ }
    },
    reset() {
      pending = []
      pendingIdentity = null
      if (!client) return
      try { client.reset() } catch { /* Sign-out must complete even if analytics is unavailable. */ }
    },
  }
}

export const analytics = createAnalytics()

function normalizedPath(pathname: string) {
  if (/^\/project\/[^/]+\/preview\/?$/.test(pathname)) return "/project/:project/preview"
  if (/^\/project\/[^/]+/.test(pathname)) return "/project/:project"
  if (/^\/workspace\/[^/]+/.test(pathname)) return "/workspace/:project"
  if (/^\/checkout\/[^/]+/.test(pathname)) return "/checkout/:project"
  if (/^\/creators\/[^/]+/.test(pathname)) return "/creators/:creator"
  return pathname
}

function sourceForPath(pathname: string): AnalyticsProperties["source"] {
  if (["/browse", "/marketplace"].includes(pathname) || pathname.startsWith("/project/")) return "marketplace"
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

export function safeLinkClickPayload(href: string, currentUrl: string): AnalyticsProperties | null {
  try {
    const current = new URL(currentUrl)
    const target = new URL(href, current)
    if (!["https:", "http:"].includes(target.protocol)) return null
    const source = sourceForPath(current.pathname)
    const properties: AnalyticsProperties = target.origin === current.origin
      ? { source, link_kind: "internal", target_route: normalizedPath(target.pathname) }
      : { source, link_kind: "external", target_host: target.hostname.toLowerCase() }
    return safeEventPayload("wcb_link_clicked", properties) ? properties : null
  } catch { return null }
}

let linkTrackingInstalled = false
export function installLinkTracking() {
  if (linkTrackingInstalled || typeof document === "undefined" || typeof window === "undefined") return
  linkTrackingInstalled = true
  document.addEventListener("click", event => {
    if (!(event.target instanceof Element)) return
    const anchor = event.target.closest("a[href]")
    if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute("download")) return
    const properties = safeLinkClickPayload(anchor.href, window.location.href)
    if (properties) analytics.capture("wcb_link_clicked", properties, properties.link_kind === "external" ? { transport: "sendBeacon", send_instantly: true } : undefined)
  }, { capture: true })
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
    // PostHog injects non-$ transport fields such as token and distinct_id.
    // Validate only Webcanbe-owned fields; retain required SDK fields and strip
    // other non-$ fields so arbitrary caller data never reaches ingestion.
    const sdkFields = new Set(["token", "distinct_id", "uuid", "timestamp", "lib", "lib_version"])
    for (const key of Object.keys(properties)) {
      if (!key.startsWith("$") && !propertyNames.has(key) && !sdkFields.has(key)) delete properties[key]
    }
    const supplied = Object.fromEntries(Object.entries(properties).filter(([key]) => propertyNames.has(key)))
    if (!safeEventPayload(event.event as AnalyticsEvent, supplied)) return null
  }
  return { ...event, properties }
}

export const DEFAULT_POSTHOG_PROJECT_TOKEN = "phc_qUNb8jnbKrpCLAmrSrMA26rF9p9WMb38qDYAJqEqAYu2"
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
