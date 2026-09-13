import { createHash } from "node:crypto"
import { analyzeReactSource, cssDeclaration } from "../adapters/react/reactSourceAdapter"
import type { MutationTransaction, SourceIdentity, SourcePatch, StyleOrigin, StyleProperty, ViewportPreset } from "../core/types"

export type SourceStore = { tailwind?: boolean; read(file: string): string | undefined; write(file: string, content: string, expected?: string): void }

function replaceRange(source: string, start: number, end: number, replacement: string) { return `${source.slice(0, start)}${replacement}${source.slice(end)}` }
function sourcePatch(file: string, range: { start: number; end: number }, before: string, after: string): SourcePatch { return { file, range, before, after } }

function transaction(input: Omit<MutationTransaction, "id" | "timestamp" | "patches"> & { patches?: SourcePatch[] }): MutationTransaction {
  return { ...input, patches: input.patches ?? [sourcePatch(input.file, input.range, input.before, input.after)], id: `wcb_${crypto.randomUUID()}`, timestamp: new Date().toISOString() }
}

function failed(identity: SourceIdentity, editType: MutationTransaction["editType"], error: string, after = ""): MutationTransaction {
  return transaction({ file: identity.file, range: { start: 0, end: 0 }, editType, before: "", after, target: identity, success: false, error, patches: [] })
}

export function applyPatches(store: SourceStore, patches: SourcePatch[], direction: "forward" | "reverse") {
  const grouped = new Map<string, SourcePatch[]>()
  for (const patch of patches) grouped.set(patch.file, [...(grouped.get(patch.file) ?? []), patch])
  if (grouped.size !== 1) throw new Error("Multi-file transactions require an atomic source store.")
  const next = new Map<string, string>()
  const originals = new Map<string, string>()
  const versions: Record<string, { before: string; after: string }> = {}
  for (const [file, entries] of grouped) {
    let source = store.read(file)
    if (source === undefined) throw new Error(`Source file is unavailable: ${file}`)
    const original = source
    originals.set(file, original)
    // Reverse ranges account for the length deltas of preceding patches.
    const ordered = [...entries].sort((a, b) => a.range.start - b.range.start)
    let delta = 0
    const adjusted = ordered.map((patch, index) => {
      if (index && patch.range.start < ordered[index - 1].range.end) throw new Error("Overlapping patches.")
      const start = patch.range.start + (direction === "reverse" ? delta : 0)
      delta += patch.after.length - patch.before.length
      return { ...patch, range: { ...patch.range, start } }
    })
    for (const patch of adjusted.sort((a, b) => b.range.start - a.range.start)) {
      const expected = direction === "forward" ? patch.before : patch.after
      const replacement = direction === "forward" ? patch.after : patch.before
      const end = patch.range.start + expected.length
      if (source.slice(patch.range.start, end) !== expected) throw new Error("Source changed since this transaction was prepared.")
      source = replaceRange(source, patch.range.start, end, replacement)
    }
    versions[file] = { before: digest(original), after: digest(source) }
    next.set(file, source)
  }
  for (const [file, source] of next) store.write(file, source, originals.get(file))
  return versions
}
function digest(source: string) { return createHash("sha256").update(source).digest("hex") }

export function undoTransaction(store: SourceStore, entry: MutationTransaction) {
  if (!entry.success) return false
  try { if (entry.versions && Object.entries(entry.versions).some(([file, version]) => digest(store.read(file) ?? "") !== version.after)) return false; applyPatches(store, entry.patches, "reverse"); return true } catch { return false }
}

export function redoTransaction(store: SourceStore, entry: MutationTransaction) {
  if (!entry.success) return false
  try { if (entry.versions && Object.entries(entry.versions).some(([file, version]) => digest(store.read(file) ?? "") !== version.before)) return false; applyPatches(store, entry.patches, "forward"); return true } catch { return false }
}

/** History keeps source patches, never browser state. It is reusable by visual and future AI edits. */
export class MutationHistory {
  private past: MutationTransaction[] = []
  private future: MutationTransaction[] = []

  record(entry: MutationTransaction) { if (entry.success) { this.past.push(entry); this.future = [] } }
  latest() { return this.past.at(-1) }
  undo(store: SourceStore) { const entry = this.past.at(-1); if (!entry || !undoTransaction(store, entry)) return undefined; this.past.pop(); this.future.push(entry); return entry }
  redo(store: SourceStore) { const entry = this.future.at(-1); if (!entry || !redoTransaction(store, entry)) return undefined; this.future.pop(); this.past.push(entry); return entry }

  /** The durable ledger hydrates the existing undo/redo projection on reopen. */
  hydrate(entries: MutationTransaction[], past: string[], future: string[]) {
    const byId = new Map(entries.map(entry => [entry.id, entry]))
    this.past = past.map(id => byId.get(id)!).filter(Boolean)
    this.future = future.map(id => byId.get(id)!).filter(Boolean)
  }
}

export function formatTransactionDiff(entry: MutationTransaction, reverse = false) {
  return `Transaction ${entry.id}${reverse ? " (undo)" : ""}\n` + entry.patches.map(patch => `${patch.file}\n@@ offset ${patch.range.start} @@\n${(reverse ? patch.after : patch.before).split("\n").map(line => "-" + line).join("\n")}\n${(reverse ? patch.before : patch.after).split("\n").map(line => "+" + line).join("\n")}`).join("\n\n")
}

export function patchText(store: SourceStore, identity: SourceIdentity, text: string): MutationTransaction {
  const source = store.read(identity.file)
  if (!source) return failed(identity, "text", "Source file is unavailable.")
  const target = analyzeReactSource(identity.file, source, store.read.bind(store), { tailwind: store.tailwind }).find((candidate) => candidate.identity.elementStart === identity.elementStart)
  if (!target?.capabilities.text || !target?.textRange || target.text === undefined) return failed(identity, "text", "This element does not have a safe static text range.")
  if (!text.trim()) return transaction({ file: identity.file, range: target.textRange, editType: "text", before: target.text, after: text, target: identity, success: false, error: "Text cannot be empty." })
  if (!target.textEncoding && /[<>{}]/.test(text)) return transaction({ file: identity.file, range: target.textRange, editType: "text", before: target.text, after: text, target: identity, success: false, error: "Text containing JSX syntax is not a safe visual mutation." })
  const before = source.slice(target.textRange.start, target.textRange.end), after = target.textEncoding === "js-string" ? JSON.stringify(text) : text.replace(/&/g, "&amp;")
  const patch = sourcePatch(identity.file, target.textRange, before, after)
  try { const versions = applyPatches(store, [patch], "forward"); return transaction({ file: identity.file, range: target.textRange, editType: "text", before, after, target: identity, success: true, patches: [patch], versions }) } catch (error) { return failed(identity, "text", error instanceof Error ? error.message : "Unable to save text.", text) }
}

const spacingScale: Record<string, string> = { "0px": "0", "2px": "0.5", "4px": "1", "8px": "2", "12px": "3", "16px": "4", "20px": "5", "24px": "6", "32px": "8", "40px": "10", "48px": "12", "64px": "16" }
const sizeScale: Record<string, string> = { "16px": "4", "20px": "5", "24px": "6", "32px": "8", "40px": "10", "48px": "12", "64px": "16", "100%": "full" }
const colorScale: Record<string, string> = { "#000": "black", "#000000": "black", "#fff": "white", "#ffffff": "white", "#0f172a": "slate-900", "#111827": "gray-900", "#22c55e": "green-500", "#84cc16": "lime-500" }

export function tailwindToken(property: StyleProperty, value: string) {
  const normalized = value.trim().toLowerCase()
  if (property === "padding") return spacingScale[normalized] ? `p-${spacingScale[normalized]}` : undefined
  if (property === "paddingX") return spacingScale[normalized] ? `px-${spacingScale[normalized]}` : undefined
  if (property === "paddingY") return spacingScale[normalized] ? `py-${spacingScale[normalized]}` : undefined
  if (property === "margin") return spacingScale[normalized] ? `m-${spacingScale[normalized]}` : undefined
  if (property === "gap") return spacingScale[normalized] ? `gap-${spacingScale[normalized]}` : undefined
  if (property === "width") return sizeScale[normalized] ? `w-${sizeScale[normalized]}` : undefined
  if (property === "height") return sizeScale[normalized] ? `h-${sizeScale[normalized]}` : undefined
  if (property === "flexBasis") return normalized === "auto" ? "basis-auto" : sizeScale[normalized] ? `basis-${sizeScale[normalized]}` : undefined
  if (property === "maxWidth") return sizeScale[normalized] ? `max-w-${sizeScale[normalized]}` : undefined
  if (property === "backgroundColor") return colorScale[normalized] ? `bg-${colorScale[normalized]}` : undefined
  if (property === "color") return colorScale[normalized] ? `text-${colorScale[normalized]}` : undefined
  if (property === "fontSize") return ({ "12px": "text-xs", "14px": "text-sm", "16px": "text-base", "18px": "text-lg", "20px": "text-xl", "24px": "text-2xl" } as Record<string, string>)[normalized]
  if (property === "fontWeight") return ({ "400": "font-normal", "500": "font-medium", "600": "font-semibold", "700": "font-bold" } as Record<string, string>)[normalized]
  if (property === "borderRadius") return ({ "0px": "rounded-none", "4px": "rounded-sm", "6px": "rounded-md", "8px": "rounded-lg", "12px": "rounded-xl", "9999px": "rounded-full" } as Record<string, string>)[normalized]
  if (property === "alignItems") return ({ center: "items-center", start: "items-start", end: "items-end", stretch: "items-stretch" } as Record<string, string>)[normalized]
  if (property === "justifyContent") return ({ center: "justify-center", start: "justify-start", end: "justify-end", "space-between": "justify-between" } as Record<string, string>)[normalized]
  if (property === "alignSelf") return ({ auto: "self-auto", center: "self-center", start: "self-start", end: "self-end", stretch: "self-stretch" } as Record<string, string>)[normalized]
  if (property === "justifySelf") return ({ auto: "justify-self-auto", center: "justify-self-center", start: "justify-self-start", end: "justify-self-end", stretch: "justify-self-stretch" } as Record<string, string>)[normalized]
  if (property === "order") return /^-?\d+$/.test(normalized) ? `${normalized.startsWith("-") ? "-" : ""}order-${normalized.replace(/^-/, "")}` : undefined
  if (property === "flexGrow") return normalized === "1" ? "grow" : normalized === "0" ? "grow-0" : undefined
  if (property === "flexShrink") return normalized === "1" ? "shrink" : normalized === "0" ? "shrink-0" : undefined
  if (property === "gridTemplateColumns") return /^\d+$/.test(normalized) ? `grid-cols-${normalized}` : undefined
  if (property === "gridTemplateRows") return /^\d+$/.test(normalized) ? `grid-rows-${normalized}` : undefined
  if (property === "gridColumn") return /^\d+$/.test(normalized) ? `col-start-${normalized}` : undefined
  if (property === "gridRow") return /^\d+$/.test(normalized) ? `row-start-${normalized}` : undefined
  return undefined
}

function patchStyleValue(origin: StyleOrigin, value: string) {
  if (origin.kind === "tailwind") return tailwindToken(origin.property, value) ? (origin.prefix ?? "") + tailwindToken(origin.property, value) : undefined
  if (origin.kind === "inline") return /^-?\d+(?:\.\d+)?$/.test(value) ? value : JSON.stringify(value)
  return value
}

export function patchStyle(store: SourceStore, identity: SourceIdentity, property: StyleProperty, value: string): MutationTransaction {
  if (!safeStyleValue(value)) return failed(identity, "style", "Unsupported style value.", value)
  const source = store.read(identity.file)
  if (!source) return failed(identity, "style", "Source file is unavailable.", value)
  const target = analyzeReactSource(identity.file, source, store.read.bind(store), { tailwind: store.tailwind }).find((candidate) => candidate.identity.elementStart === identity.elementStart)
  const origin = target?.styleOrigins.find((candidate) => candidate.property === property && candidate.editable && !candidate.prefix)
  const localOrigin = origin && (origin.kind === "inline" || origin.kind === "tailwind") ? { ...origin, file: identity.file } : origin
  if (!localOrigin?.range || !localOrigin.file) return failed(identity, "style", "The style origin is inherited, dynamic, or unsupported.", value)
  const replacement = patchStyleValue(localOrigin, value)
  const sourceForOrigin = store.read(localOrigin.file)
  if (!sourceForOrigin || !replacement) return failed(identity, "style", "The requested value is not a safe supported utility.", value)
  const before = sourceForOrigin.slice(localOrigin.range.start, localOrigin.range.end)
  const patch = sourcePatch(localOrigin.file, localOrigin.range, before, replacement)
  try { const versions = applyPatches(store, [patch], "forward"); return transaction({ file: localOrigin.file, range: localOrigin.range, editType: "style", before, after: replacement, target: identity, success: true, patches: [patch], versions }) } catch (error) { return failed(identity, "style", error instanceof Error ? error.message : "Unable to save style.", value) }
}

// Layout additions and helper rewriting are restricted until the adapter can prove intent.
function safeStyleValue(value: string) { return value.length <= 200 && /^[a-zA-Z0-9#.% ,()\-]+$/.test(value) && !/url|expression|javascript/i.test(value) }

const breakpointQuery: Record<ViewportPreset, string> = { mobile: "(max-width: 767px)", tablet: "(min-width: 768px) and (max-width: 1023px)", desktop: "(min-width: 1024px)" }

export function patchResponsiveStyle(store: SourceStore, identity: SourceIdentity, property: StyleProperty, value: string, viewport: ViewportPreset): MutationTransaction {
  if (!Object.prototype.hasOwnProperty.call(breakpointQuery, viewport) || !safeStyleValue(value)) return failed(identity, "responsive", "Unsupported viewport or value.", value)
  const source = store.read(identity.file)
  if (!source) return failed(identity, "responsive", "Source file is unavailable.", value)
  const target = analyzeReactSource(identity.file, source, store.read.bind(store), { tailwind: store.tailwind }).find((candidate) => candidate.identity.elementStart === identity.elementStart)
  const origin = target?.styleOrigins.find((candidate) => candidate.property === property && candidate.editable)
  if (origin?.kind === "tailwind") {
    const prefix = viewport === "mobile" ? "" : viewport === "tablet" ? "md:" : "lg:"
    const scoped = target?.styleOrigins.filter(item => item.property === property && item.kind === "tailwind" && item.prefix === prefix && item.editable)
    if (scoped?.length !== 1 || !scoped[0].range) return failed(identity, "responsive", "An existing unambiguous utility at this breakpoint is required.", value)
    const utility = tailwindToken(property, value)
    if (!utility) return failed(identity, "responsive", "Unsupported Tailwind value.", value)
    const item = scoped[0], patch = sourcePatch(identity.file, item.range!, item.value!, prefix + utility)
    try { const versions = applyPatches(store, [patch], "forward"); return transaction({ file: identity.file, range: patch.range, editType: "responsive", before: patch.before, after: patch.after, target: identity, success: true, patches: [patch], versions, viewport }) } catch { return failed(identity, "responsive", "Source changed.") }
  }
  if (!origin || !origin.file || !origin.range || (origin.kind !== "css" && origin.kind !== "css-module")) return failed(identity, "responsive", "Responsive edits need a static CSS selector or Tailwind className.", value)
  const css = store.read(origin.file)
  if (css === undefined) return failed(identity, "responsive", "The stylesheet is unavailable.", value)
  if (!origin.selector) return failed(identity, "responsive", "The CSS selector could not be safely identified.", value)
  const existing = cssDeclaration(css, origin.selector, property, breakpointQuery[viewport])
  // Only edit an existing responsive construct. Never guess selectors or duplicate rules.
  if (!existing) return failed(identity, "responsive", "An existing unambiguous media-query declaration is required.", value)
  const addition = value
  const patch = sourcePatch(origin.file, existing, css.slice(existing.start, existing.end), value)
  try { const versions = applyPatches(store, [patch], "forward"); return transaction({ file: origin.file, range: patch.range, editType: "responsive", before: patch.before, after: addition, target: identity, success: true, patches: [patch], versions, viewport }) } catch (error) { return failed(identity, "responsive", error instanceof Error ? error.message : "Unable to save responsive edit.", value) }
}

/** Semantic layout only changes an explicit layout primitive; never absolute coordinates. */
export function patchSemanticLayout(store: SourceStore, identity: SourceIdentity, property: StyleProperty, value: string) {
  if (!["gap", "alignItems", "justifyContent", "alignSelf", "justifySelf", "order", "flexGrow", "flexShrink", "flexBasis", "gridTemplateColumns", "gridTemplateRows", "gridColumn", "gridRow"].includes(property)) return failed(identity, "layout", "Unsupported semantic operation.", value)
  const result = patchStyle(store, identity, property, value)
  if (result.success) return { ...result, editType: "layout" as const }
  return failed(identity, "layout", "An existing explicit layout declaration is required.", value)
}
