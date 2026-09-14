import type { PreviewInput } from "./controlledPreview"
import { safePreviewRoute } from "../bridge/previewRoute"
import { previewResourcePath } from "./previewPaths"
export function routeAllowed(route: unknown): route is string {
  if (!safePreviewRoute(route)) return false
  const pathname = previewResourcePath(route.split("#")[0])
  return Boolean(pathname && !/^\/_wcb(?:\/|$)/i.test(pathname))
}
export function validPreviewInput(input: unknown): input is PreviewInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false
  const v = input as Record<string, unknown>, exact = (keys: string[]) => Object.keys(v).every(key => keys.includes(key))
  const number = (n: unknown, min: number, max: number) => typeof n === "number" && Number.isFinite(n) && n >= min && n <= max
  if (v.type === "text") return exact(["type", "text"]) && typeof v.text === "string" && v.text.length > 0 && v.text.length <= 4096 && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v.text) && !/[\uD800-\uDFFF]/u.test(v.text.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, ""))
  if (v.type === "key") return exact(["type", "key", "shift"]) && typeof v.shift === "boolean" && ["Tab", "Enter", "Escape", "Backspace", "Delete", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown", "SelectAll"].includes(String(v.key))
  if (v.type === "navigate") return exact(["type", "route"]) && routeAllowed(v.route)
  if (v.type === "pointer") return exact(["type", "action", "x", "y"]) && ["move", "click", "select"].includes(String(v.action)) && number(v.x, 0, 4095) && number(v.y, 0, 4095)
  if (v.type === "scroll") return exact(["type", "dx", "dy"]) && number(v.dx, -2000, 2000) && number(v.dy, -2000, 2000)
  if (v.type === "history") return exact(["type", "action"]) && ["back", "forward", "reload"].includes(String(v.action))
  return v.type === "viewport" && exact(["type", "width", "height"]) && number(v.width, 320, 1920) && number(v.height, 240, 1080) && Number.isInteger(v.width) && Number.isInteger(v.height)
}
