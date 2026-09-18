import type { StyleOrigin, StyleProperty } from "../core/types"

/** Gestures can vary an existing literal pixel declaration, never infer authored
 * dimensions from raster geometry, percentages, auto values or a coordinate model. */
export function pixelGestureOrigin(origins: StyleOrigin[], property: StyleProperty) {
  const matches = origins.filter(origin => origin.property === property)
  if (matches.length !== 1) return undefined
  const origin = matches[0]
  if (!origin.editable || !origin.file || !origin.range || !["css", "css-module", "inline"].includes(origin.kind)) return undefined
  const value = origin.value ?? ""
  const literal = origin.kind === "inline" && /^["']/.test(value) ? value.slice(1, -1) : value
  const numericInline = origin.kind === "inline" && /^\d+(?:\.\d+)?$/.test(value)
  if (!numericInline && !/^\d+(?:\.\d+)?px$/.test(literal)) return undefined
  const pixels = Number.parseFloat(literal)
  if (!Number.isFinite(pixels) || pixels < 0 || pixels > 4096) return undefined
  return { origin, pixels, numericInline }
}

export function pixelGestureValue(start: NonNullable<ReturnType<typeof pixelGestureOrigin>>, screenDelta: number, scale: number) {
  if (!Number.isFinite(screenDelta) || !Number.isFinite(scale) || scale < 0.1 || scale > 1) return undefined
  const next = Math.round((start.pixels + screenDelta / scale) * 100) / 100
  if (next < 0 || next > 4096 || next === start.pixels) return undefined
  return String(next) + (start.numericInline ? "" : "px")
}

export function siblingGestureDirection(dx: number, dy: number, scale: number) {
  if (![dx, dy, scale].every(Number.isFinite) || scale < 0.1 || scale > 1 || Math.max(Math.abs(dx), Math.abs(dy)) / scale < 24) return undefined
  return (Math.abs(dx) >= Math.abs(dy) ? dx : dy) > 0 ? "next" : "previous"
}
