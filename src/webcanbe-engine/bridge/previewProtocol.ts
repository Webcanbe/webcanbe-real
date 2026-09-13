import type { PreviewElement } from "../core/types"
import { safePreviewRoute } from "./previewRoute"
export const PREVIEW_CHANNEL = "webcanbe-compatible-v1"
type Envelope = { channel: typeof PREVIEW_CHANNEL; session: string; generation?: string }
export type PreviewReadyMessage = Envelope & { type: "ready" | "clear" | "failed" | "expired" }
export type PreviewElementMessage = Envelope & { type: "hover" | "select" | "drag"; element: PreviewElement; delta?: { x: number; y: number } }
export type PreviewMessage = PreviewReadyMessage | PreviewElementMessage | (Envelope & { type: "route"; hash?: string; route?: string })

export function isPreviewMessage(value: unknown): value is PreviewMessage {
  if (!value || typeof value !== "object") return false
  const message = value as Record<string, unknown>
  if (message.channel !== PREVIEW_CHANNEL || typeof message.type !== "string" || typeof message.session !== "string" || message.session.length < 1 || message.session.length > 128) return false
  // Legacy shape checks remain available; every live editor connection also requires its exact generation.
  if (message.generation !== undefined && (typeof message.generation !== "string" || !/^[a-zA-Z0-9-]{1,128}$/.test(message.generation))) return false
  if (["ready", "clear", "failed", "expired"].includes(message.type)) return true
  if (message.type === "route") return safePreviewRoute(message.route) || typeof message.hash === "string" && /^#\/[\x20-\x7e]{0,2048}$/.test(message.hash)
  if (!["hover", "select", "drag"].includes(message.type)) return false
  const element = message.element as Record<string, unknown> | undefined
  const identity = element?.identity as Record<string, unknown> | undefined
  const rect = element?.rect as Record<string, unknown> | undefined
  const finite = (number: unknown) => typeof number === "number" && Number.isFinite(number) && Math.abs(number) <= 1_000_000
  if (!element || typeof element.tagName !== "string" || !/^[a-z][a-z0-9-]{0,63}$/.test(element.tagName)
    || !identity || typeof identity.file !== "string" || identity.file.length > 512 || !/^src\/.+\.[jt]sx?$/.test(identity.file) || /[\x00-\x1f\x7f\\]/.test(identity.file) || identity.file.split('/').some(part => !part || part === '.' || part === '..') || !Number.isInteger(identity.elementStart) || Number(identity.elementStart) < 0 || Number(identity.elementStart) > 2 * 1024 * 1024
    || !rect || !finite(rect.top) || !finite(rect.left) || !finite(rect.width) || !finite(rect.height) || Number(rect.width) < 0 || Number(rect.height) < 0) return false
  if (element.computed !== undefined && (!element.computed || typeof element.computed !== 'object' || Array.isArray(element.computed) || Object.keys(element.computed).length > 40 || Object.values(element.computed).some(value => typeof value !== 'string' || value.length > 512))) return false
  if (message.type !== "drag") return true
  const delta = message.delta as Record<string, unknown> | undefined
  return Boolean(delta && finite(delta.x) && finite(delta.y))
}
