import { decodeSourceIdentity } from "../core/sourceIdentity"
import type { LayoutContext, PreviewElement } from "../core/types"
import { PREVIEW_CHANNEL } from "../bridge/previewProtocol"

let session = ""
let parentOrigin = ""
let active = false
let lastHover = ""
let selected: Element | undefined

function safeParentOrigin(origin: string) {
  try {
    const url = new URL(origin)
    return url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)
  } catch {
    return false
  }
}

function layoutContext(style: CSSStyleDeclaration): LayoutContext {
  if (style.position !== "static") return "positioned"
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
  return {
    identity,
    tagName: element.tagName.toLowerCase(),
    rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
    computed: Object.fromEntries(["display", "position", "backgroundColor", "color", "fontSize", "fontWeight", "padding", "margin", "gap", "width", "height", "border", "borderRadius"].map((property) => [property, style.getPropertyValue(property.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`))])),
    parentIdentity: parent ? decodeSourceIdentity(parent.dataset.wcbId ?? "") ?? undefined : undefined,
    layoutContext: layoutContext(style),
  }
}

function send(type: "hover" | "select", element: PreviewElement) {
  if (!session || !parentOrigin) return
  window.parent.postMessage({ channel: PREVIEW_CHANNEL, type, session, element }, parentOrigin)
}

function refreshSelection() {
  if (!active || !selected) return
  const element = describe(selected)
  if (element) send("select", element)
}

window.addEventListener("message", (event) => {
  if (event.source !== window.parent || !safeParentOrigin(event.origin) || !event.data || typeof event.data !== "object") return
  const message = event.data as { channel?: string; type?: string; session?: string; active?: boolean }
  if (message.channel !== PREVIEW_CHANNEL || message.type !== "configure" || typeof message.session !== "string") return
  session = message.session
  parentOrigin = event.origin
  active = Boolean(message.active)
  window.parent.postMessage({ channel: PREVIEW_CHANNEL, type: "ready", session }, parentOrigin)
})

document.addEventListener("pointermove", (event) => {
  if (!active) return
  const element = describe(event.target as Element)
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

window.addEventListener("scroll", refreshSelection, true)
window.addEventListener("resize", refreshSelection)
new ResizeObserver(refreshSelection).observe(document.documentElement)
