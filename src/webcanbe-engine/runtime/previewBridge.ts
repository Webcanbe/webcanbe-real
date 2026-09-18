import { decodeSourceIdentity } from "../core/sourceIdentity"
import type { LayoutContext, PreviewElement } from "../core/types"
import { PREVIEW_CHANNEL } from "../bridge/previewProtocol"

declare const __WCB_HTTP_PREVIEW__: boolean
let generation = ""
let session = ""
let parentOrigin = ""
let active = false
let lastHover = ""
let selected: Element | undefined
let hovered: Element | undefined
let lastRoute = ""
let dragStart: { element: Element; x: number; y: number } | undefined

function safeParentOrigin(origin: string) {
  if (__WCB_HTTP_PREVIEW__) return origin === "null"
  try {
    const url = new URL(origin)
    return url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)
  } catch {
    return false
  }
}

function layoutContext(style: CSSStyleDeclaration): LayoutContext {
  if (["absolute", "fixed"].includes(style.position)) return "positioned"
  if (style.display.includes("flex")) return "flex"
  if (style.display.includes("grid")) return "grid"
  if (["block", "inline-block", "inline"].includes(style.display)) return "block"
  return "unknown"
}

function describe(target: Element): PreviewElement | null {
  const element = target.closest<HTMLElement>("[data-wcb-id]")
  if (!element) return null
  const identity = decodeSourceIdentity(element.dataset.wcbId ?? "")
  if (!identity) return null
  const rect = element.getBoundingClientRect()
  const style = getComputedStyle(element)
  const parent = element.parentElement?.closest<HTMLElement>("[data-wcb-id]")
  const parentStyle = parent ? getComputedStyle(parent) : undefined
  return {
    identity,
    tagName: element.tagName.toLowerCase(),
    rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
    computed: Object.fromEntries(["display", "position", "backgroundColor", "color", "fontSize", "fontWeight", "padding", "margin", "gap", "width", "height", "border", "borderRadius"].map((property) => [property, style.getPropertyValue(property.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`))])),
    parentIdentity: parent ? decodeSourceIdentity(parent.dataset.wcbId ?? "") ?? undefined : undefined,
    layoutContext: layoutContext(style),
    parentLayoutContext: parentStyle ? layoutContext(parentStyle) : undefined,
  }
}

function send(type: "hover" | "select" | "drag", element: PreviewElement, delta?: { x: number; y: number }) {
  if (!session || !parentOrigin) return
  window.parent.postMessage({ channel: PREVIEW_CHANNEL, type, session, generation, element, delta }, parentOrigin === "null" ? "*" : parentOrigin)
}

function reportRoute() {
  if (!session || !parentOrigin) return
  const route = window.location.pathname + window.location.search + window.location.hash
  if (lastRoute === route) return
  if (lastRoute) {
    selected = undefined; hovered = undefined; lastHover = ""; dragStart = undefined
    window.parent.postMessage({ channel: PREVIEW_CHANNEL, type: "clear", session, generation }, parentOrigin === "null" ? "*" : parentOrigin)
  }
  lastRoute = route
  window.parent.postMessage({ channel: PREVIEW_CHANNEL, type: "route", session, generation, ...(__WCB_HTTP_PREVIEW__ ? { route } : { hash: window.location.hash || "#/" }) }, parentOrigin === "null" ? "*" : parentOrigin)
}
function refreshSelection() {
  reportRoute()
  if (!active) return
  if (selected && !selected.isConnected) {
    selected = undefined
    window.parent.postMessage({ channel: PREVIEW_CHANNEL, type: "clear", session, generation }, parentOrigin === "null" ? "*" : parentOrigin)
  }
  if (selected) { const element = describe(selected); if (element) send("select", element) }
  if (hovered?.isConnected) { const element = describe(hovered); if (element) send("hover", element) }
}


window.addEventListener("message", (event) => {
  if (event.source !== window.parent || !safeParentOrigin(event.origin) || !event.data || typeof event.data !== "object") return
  const message = event.data as { channel?: string; type?: string; session?: string; generation?: string; active?: boolean; hash?: string }
  if (message.channel !== PREVIEW_CHANNEL || message.type !== "configure" || typeof message.session !== "string" || message.session.length > 128 || typeof message.generation !== "string" || !/^[a-zA-Z0-9-]{1,128}$/.test(message.generation) || typeof message.active !== "boolean") return
  generation = message.generation
  session = message.session
  parentOrigin = event.origin
  active = Boolean(message.active)
  if (!__WCB_HTTP_PREVIEW__ && typeof message.hash === "string" && /^#\/[\x20-\x7e]{0,2048}$/.test(message.hash) && window.location.hash !== message.hash) window.location.hash = message.hash
  window.parent.postMessage({ channel: PREVIEW_CHANNEL, type: "ready", session, generation }, parentOrigin === "null" ? "*" : parentOrigin)
  reportRoute()
})

document.addEventListener("pointermove", (event) => {
  if (!active) return
  hovered = event.target as Element
  const element = describe(hovered)
  const key = element ? `${element.identity.file}:${element.identity.elementStart}` : ""
  if (element && key !== lastHover) send("hover", element)
  lastHover = key
}, true)

document.addEventListener("click", (event) => {
  if (!active) return
  const element = describe(event.target as Element)
  if (!element) return
  event.preventDefault()
  event.stopPropagation()
  selected = event.target as Element
  send("select", element)
}, true)

document.addEventListener("pointerdown", (event) => {
  if (!active) return
  const element = (event.target as Element).closest<HTMLElement>("[data-wcb-id]")
  if (element) dragStart = { element, x: event.clientX, y: event.clientY }
}, true)

document.addEventListener("pointerup", (event) => {
  if (!active || !dragStart) return
  const current = describe(dragStart.element)
  const delta = { x: event.clientX - dragStart.x, y: event.clientY - dragStart.y }
  dragStart = undefined
  if (current && (Math.abs(delta.x) > 24 || Math.abs(delta.y) > 24)) send("drag", current, delta)
}, true)

window.addEventListener("scroll", refreshSelection, true)
window.addEventListener("resize", refreshSelection)
new ResizeObserver(refreshSelection).observe(document.documentElement)

window.addEventListener("hashchange", reportRoute)
window.addEventListener("popstate", reportRoute)
new MutationObserver(refreshSelection).observe(document.documentElement, { childList: true, subtree: true })
// Observe native push/replace changes without replacing window/history or router behavior.
setInterval(reportRoute, 100)
