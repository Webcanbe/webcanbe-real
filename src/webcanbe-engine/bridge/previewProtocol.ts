import type { PreviewElement } from "../core/types"

export const PREVIEW_CHANNEL = "webcanbe-compatible-v1"

export type PreviewReadyMessage = { channel: typeof PREVIEW_CHANNEL; type: "ready"; session: string }
export type PreviewElementMessage = { channel: typeof PREVIEW_CHANNEL; type: "hover" | "select" | "drag"; session: string; element: PreviewElement; delta?: { x: number; y: number } }
export type PreviewMessage = PreviewReadyMessage | PreviewElementMessage

export function isPreviewMessage(value: unknown): value is PreviewMessage {
  if (!value || typeof value !== "object") return false
  const message = value as Record<string, unknown>
  if (message.channel !== PREVIEW_CHANNEL || typeof message.type !== "string" || typeof message.session !== "string") return false
  if (message.type === "ready") return true
  if (message.type !== "hover" && message.type !== "select" && message.type !== "drag") return false
  const element = message.element as Record<string, unknown> | undefined
  const identity = element?.identity as Record<string, unknown> | undefined
  const rect = element?.rect as Record<string, unknown> | undefined
  const finite = (number: unknown) => typeof number === "number" && Number.isFinite(number)
  const validElement = Boolean(
    element && typeof element.tagName === "string"
    && identity && typeof identity.file === "string" && Number.isInteger(identity.elementStart)
    && rect && finite(rect.top) && finite(rect.left) && finite(rect.width) && finite(rect.height),
  )
  if (!validElement) return false
  if (message.type !== "drag") return true
  const delta = message.delta as Record<string, unknown> | undefined
  return Boolean(delta && finite(delta.x) && finite(delta.y))
}
