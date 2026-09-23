import { DEFAULT_POSTHOG_PROJECT_TOKEN, safeLinkClickPayload } from "./analytics"

function anonymousSessionId() {
  try {
    const key = "wcb_public_analytics_id"
    const existing = sessionStorage.getItem(key)
    if (existing) return existing
    const created = crypto.randomUUID()
    sessionStorage.setItem(key, created)
    return created
  } catch {
    return crypto.randomUUID()
  }
}

document.addEventListener("click", event => {
  if (!(event.target instanceof Element)) return
  const anchor = event.target.closest("a[href]")
  if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute("download")) return
  const properties = safeLinkClickPayload(anchor.href, location.href)
  if (!properties) return
  const payload = JSON.stringify({
    api_key: DEFAULT_POSTHOG_PROJECT_TOKEN,
    event: "wcb_link_clicked",
    distinct_id: anonymousSessionId(),
    properties,
  })
  navigator.sendBeacon("https://us.i.posthog.com/i/v0/e", payload)
}, { capture: true })
