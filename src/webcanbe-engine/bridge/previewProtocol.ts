import type { PreviewElement } from "../core/types"

export const PREVIEW_CHANNEL = "webcanbe-compatible-v1"

export type PreviewReadyMessage = { channel: typeof PREVIEW_CHANNEL; type: "ready"; session: string }
export type PreviewElementMessage = { channel: typeof PREVIEW_CHANNEL; type: "hover" | "select"; session: string; element: PreviewElement }
export type PreviewMessage = PreviewReadyMessage | PreviewElementMessage

export function isPreviewMessage(value: unknown): value is PreviewMessage {
  if (!value || typeof value !== "object") return false
  const message = value as Record<string, unknown>
  if (message.channel !== PREVIEW_CHANNEL || typeof message.type !== "string" || typeof message.session !== "string") return false
  if (message.type === "ready") return true
  if (message.type !== "hover" && message.type !== "select") return false
  const element = message.element as Record<string, unknown> | undefined
  return Boolean(element && typeof element.tagName === "string" && typeof element.identity === "object" && typeof element.rect === "object")
}
