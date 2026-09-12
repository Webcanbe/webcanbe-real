import { analyzeReactSource } from "../adapters/react/reactSourceAdapter"
import type { MutationTransaction, SourceIdentity, StyleOrigin, StyleProperty } from "../core/types"

export type SourceStore = { read(file: string): string | undefined; write(file: string, content: string): void }

function replaceRange(source: string, start: number, end: number, replacement: string) {
  return `${source.slice(0, start)}${replacement}${source.slice(end)}`
}

function transaction(input: Omit<MutationTransaction, "id" | "timestamp">): MutationTransaction {
  return { ...input, id: `wcb_${crypto.randomUUID()}`, timestamp: new Date().toISOString() }
}

export function patchText(store: SourceStore, identity: SourceIdentity, text: string): MutationTransaction {
  const source = store.read(identity.file)
  if (!source) return transaction({ file: identity.file, range: { start: 0, end: 0 }, editType: "text", before: "", after: "", target: identity, success: false, error: "Source file is unavailable." })
  const target = analyzeReactSource(identity.file, source, store.read.bind(store)).find((candidate) => candidate.identity.elementStart === identity.elementStart)
  if (!target?.textRange || target.text === undefined) return transaction({ file: identity.file, range: { start: 0, end: 0 }, editType: "text", before: "", after: "", target: identity, success: false, error: "This element does not have a safe static text range." })
  if (!text.trim()) return transaction({ file: identity.file, range: target.textRange, editType: "text", before: target.text, after: text, target: identity, success: false, error: "Text cannot be empty in Phase 1." })
  store.write(identity.file, replaceRange(source, target.textRange.start, target.textRange.end, text))
  return transaction({ file: identity.file, range: target.textRange, editType: "text", before: target.text, after: text, target: identity, success: true })
}

const spacingScale: Record<string, string> = { "0px": "0", "2px": "0.5", "4px": "1", "8px": "2", "12px": "3", "16px": "4", "20px": "5", "24px": "6", "32px": "8", "40px": "10", "48px": "12", "64px": "16" }
const sizeScale: Record<string, string> = { "16px": "4", "20px": "5", "24px": "6", "32px": "8", "40px": "10", "48px": "12", "64px": "16", "100%": "full" }
const colorScale: Record<string, string> = { "#000": "black", "#000000": "black", "#fff": "white", "#ffffff": "white", "#0f172a": "slate-900", "#111827": "gray-900", "#22c55e": "green-500", "#84cc16": "lime-500" }

function tailwindToken(property: StyleProperty, value: string) {
  const normalized = value.trim().toLowerCase()
  if (property === "padding") return spacingScale[normalized] ? `p-${spacingScale[normalized]}` : undefined
  if (property === "paddingX") return spacingScale[normalized] ? `px-${spacingScale[normalized]}` : undefined
  if (property === "paddingY") return spacingScale[normalized] ? `py-${spacingScale[normalized]}` : undefined
  if (property === "margin") return spacingScale[normalized] ? `m-${spacingScale[normalized]}` : undefined
  if (property === "gap") return spacingScale[normalized] ? `gap-${spacingScale[normalized]}` : undefined
  if (property === "width") return sizeScale[normalized] ? `w-${sizeScale[normalized]}` : undefined
  if (property === "height") return sizeScale[normalized] ? `h-${sizeScale[normalized]}` : undefined
  if (property === "backgroundColor") return colorScale[normalized] ? `bg-${colorScale[normalized]}` : undefined
  if (property === "color") return colorScale[normalized] ? `text-${colorScale[normalized]}` : undefined
  if (property === "fontSize") return ({ "12px": "text-xs", "14px": "text-sm", "16px": "text-base", "18px": "text-lg", "20px": "text-xl", "24px": "text-2xl" } as Record<string, string>)[normalized]
  if (property === "fontWeight") return ({ "400": "font-normal", "500": "font-medium", "600": "font-semibold", "700": "font-bold" } as Record<string, string>)[normalized]
  if (property === "borderRadius") return ({ "0px": "rounded-none", "4px": "rounded", "6px": "rounded-md", "8px": "rounded-lg", "12px": "rounded-xl", "9999px": "rounded-full" } as Record<string, string>)[normalized]
  if (property === "alignItems") return ({ center: "items-center", start: "items-start", end: "items-end", stretch: "items-stretch" } as Record<string, string>)[normalized]
  if (property === "justifyContent") return ({ center: "justify-center", start: "justify-start", end: "justify-end", "space-between": "justify-between" } as Record<string, string>)[normalized]
  return undefined
}

function patchStyleValue(origin: StyleOrigin, value: string) {
  if (origin.kind === "tailwind") return tailwindToken(origin.property, value)
  if (origin.kind === "inline") return origin.value?.startsWith("\"") || origin.value?.startsWith("'") ? JSON.stringify(value) : value
  return value
}

export function patchStyle(store: SourceStore, identity: SourceIdentity, property: StyleProperty, value: string): MutationTransaction {
  const source = store.read(identity.file)
  if (!source) return transaction({ file: identity.file, range: { start: 0, end: 0 }, editType: "style", before: "", after: value, target: identity, success: false, error: "Source file is unavailable." })
  const target = analyzeReactSource(identity.file, source, store.read.bind(store)).find((candidate) => candidate.identity.elementStart === identity.elementStart)
  const origin = target?.styleOrigins.find((candidate) => candidate.property === property && candidate.editable)
  if (!origin?.range || !origin.file) {
    const localOrigin = origin?.kind === "inline" || origin?.kind === "tailwind" ? { ...origin, file: identity.file } : origin
    if (!localOrigin?.range || !localOrigin.file) return transaction({ file: identity.file, range: { start: 0, end: 0 }, editType: "style", before: "", after: value, target: identity, success: false, error: "The style origin is inherited, dynamic, or unsupported." })
    return applyStylePatch(store, identity, localOrigin, value)
  }
  return applyStylePatch(store, identity, origin, value)
}

function applyStylePatch(store: SourceStore, identity: SourceIdentity, origin: StyleOrigin, value: string): MutationTransaction {
  const file = origin.file!
  const source = store.read(file)
  const replacement = patchStyleValue(origin, value)
  if (!source || !origin.range || !replacement) return transaction({ file, range: origin.range ?? { start: 0, end: 0 }, editType: "style", before: origin.value ?? "", after: value, target: identity, success: false, error: "The requested value is not a safe supported utility." })
  const before = source.slice(origin.range.start, origin.range.end)
  store.write(file, replaceRange(source, origin.range.start, origin.range.end, replacement))
  return transaction({ file, range: origin.range, editType: "style", before, after: replacement, target: identity, success: true })
}
