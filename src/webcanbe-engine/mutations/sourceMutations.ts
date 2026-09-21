import ts from "typescript"
import { analyzeProjectStyles, mutationOrigin, viewportWidths } from "../adapters/react/projectStyles"
import { createHash } from "node:crypto"
import { analyzeReactSource, cssDeclaration, tailwindProperty, supportedProperties } from "../adapters/react/reactSourceAdapter"
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
  const originFile = target.textFile ?? identity.file, originSource = store.read(originFile)
  if (originSource === undefined) return failed(identity, "text", "Text origin is unavailable.")
  const before = originSource.slice(target.textRange.start, target.textRange.end), after = target.textEncoding === "js-string" ? JSON.stringify(text) : text.replace(/&/g, "&amp;")
  const patch = sourcePatch(originFile, target.textRange, before, after)
  try { const versions = applyPatches(store, [patch], "forward"); return transaction({ file: originFile, range: target.textRange, editType: "text", before, after, target: identity, success: true, patches: [patch], versions }) } catch (error) { return failed(identity, "text", error instanceof Error ? error.message : "Unable to save text.", text) }
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
  if (["minWidth", "minHeight", "maxHeight"].includes(property)) { const prefix = { minWidth: "min-w", minHeight: "min-h", maxHeight: "max-h" }[property as "minWidth"]; return sizeScale[normalized] ? `${prefix}-${sizeScale[normalized]}` : undefined }
  if (property === "flexDirection") return ({ row: "flex-row", column: "flex-col", "row-reverse": "flex-row-reverse", "column-reverse": "flex-col-reverse" } as Record<string, string>)[normalized]
  if (property === "display") return ({ none: "hidden", block: "block", inline: "inline", "inline-block": "inline-block", flex: "flex", "inline-flex": "inline-flex", grid: "grid", "inline-grid": "inline-grid", contents: "contents" } as Record<string, string>)[normalized]
  if (property === "lineHeight") return ({ "1": "leading-none", "1.25": "leading-tight", "1.375": "leading-snug", "1.5": "leading-normal", "1.625": "leading-relaxed", "2": "leading-loose" } as Record<string, string>)[normalized]
  if (property === "letterSpacing") return ({ "-0.05em": "tracking-tighter", "-0.025em": "tracking-tight", "0em": "tracking-normal", "0.025em": "tracking-wide", "0.05em": "tracking-wider", "0.1em": "tracking-widest" } as Record<string, string>)[normalized]
  if (property === "maxWidth") return sizeScale[normalized] ? `max-w-${sizeScale[normalized]}` : undefined
  if (property === "backgroundColor") return colorScale[normalized] ? `bg-${colorScale[normalized]}` : undefined
  if (property === "color") return colorScale[normalized] ? `text-${colorScale[normalized]}` : undefined
  if (property === "fontSize") return ({ "12px": "text-xs", "14px": "text-sm", "16px": "text-base", "18px": "text-lg", "20px": "text-xl", "24px": "text-2xl" } as Record<string, string>)[normalized]
  if (property === "fontWeight") return ({ "400": "font-normal", "500": "font-medium", "600": "font-semibold", "700": "font-bold" } as Record<string, string>)[normalized]
  if (property === "boxShadow") return normalized === "none" ? "shadow-none" : undefined
  if (property === "border") return ({ "0px": "border-0", "1px": "border", "2px": "border-2", "4px": "border-4", "8px": "border-8" } as Record<string, string>)[normalized]
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
  const origin = target?.styleOrigins.find((candidate) => candidate.property === property && candidate.editable && !candidate.prefix && !candidate.media)
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

/** The authorized API supplies the complete revision snapshot. No live DOM value
 * or client-provided offset can choose the declaration being written. */
export function patchProjectStyle(store: SourceStore, files: Map<string, string>, identity: SourceIdentity, property: StyleProperty, value: string, options: { breakpoint?: string; viewport?: ViewportPreset; scope?: string; semantic?: boolean } = {}) {
  if (!safeStyleValue(value) && !/^[a-z0-9:./-]{1,200}$/.test(value)) return failed(identity, "style", "Unsupported style value.", value)
  if (options.viewport !== undefined && !Object.prototype.hasOwnProperty.call(viewportWidths, options.viewport)) return failed(identity, "responsive", "Unsupported viewport.")
  const width = viewportWidths[options.viewport ?? "desktop"]
  const analysis = analyzeProjectStyles(files, Boolean(store.tailwind), width)
  const target = analysis.targets.find(item => item.identity.file === identity.file && item.identity.elementStart === identity.elementStart)
  if (!target || target.nodeKind !== "native" || target.reasonCodes?.includes("jsx-spread-props") || target.reasonCodes?.includes("dynamic-class-expression")) return failed(identity, "style", "Dynamic or unsafe source; use Code.")
  let breakpoint = options.breakpoint ?? "base"
  if (!options.breakpoint && options.viewport) {
    const tw = options.viewport === "mobile" ? "base" : options.viewport === "tablet" ? "tw:md" : "tw:lg"
    if (target.styleOrigins.some(item => item.property === property && item.kind === "tailwind")) breakpoint = tw
    else {
      const effective = target.styleOrigins.find(item => item.property === property && item.effective)
      breakpoint = effective?.media ? `css:${effective.media}` : "base"
    }
  }
  const origin = mutationOrigin(target, property, breakpoint, analysis.breakpoints)
  if (!origin?.range || !origin.file) {
    const unavailable=target.styleOrigins.find(item=>item.property===property&&!item.editable)
    return failed(identity,"responsive",unavailable?.reason ?? `No unique editable ${property} declaration at breakpoint ${breakpoint} in ${identity.file}:${identity.elementStart}.`)
  }
  if (origin.kind !== "tailwind" && !safeStyleValue(value)) return failed(identity, "style", "Invalid CSS or inline value.")
  if ((origin.shared || target.repeated) && options.scope !== "source") return failed(identity, "style", `Choose source scope before editing: ${origin.scope}.`)
  if (options.semantic && !["display", "flexDirection", "gap", "padding", "paddingX", "paddingY", "margin", "width", "minWidth", "maxWidth", "height", "alignItems", "justifyContent", "alignSelf", "justifySelf", "order", "flexGrow", "flexShrink", "flexBasis", "gridTemplateColumns", "gridTemplateRows", "gridColumn", "gridRow"].includes(property)) return failed(identity, "layout", "Unsupported semantic layout property.")
  // Accept the existing semantic CSS value or a single recognized utility token.
  // Literal tokens are useful for config-defined scales and never rebuild className.
  const requestedToken = value.startsWith(origin.prefix ?? "") ? value.slice((origin.prefix ?? "").length) : value
  if (origin.kind === "tailwind" && !tailwindPropertySafe(property, requestedToken) && [...files.values()].some(code => /--(?:spacing|text-|font-|radius-|color-)/.test(code))) return failed(identity, "style", "Custom theme scale: supply an explicit supported utility token or use Code.")
  const replacement = origin.kind === "tailwind" && tailwindPropertySafe(property, requestedToken) ? (origin.prefix ?? "") + requestedToken : patchStyleValue(origin, value)
  if (!replacement || origin.kind === "tailwind" && !tailwindPropertySafe(property, replacement.slice((origin.prefix ?? "").length))) return failed(identity, "style", "Unsupported value for the identified source origin.")
  const original = files.get(origin.file)
  if (original === undefined) return failed(identity, "style", "Source unavailable.")
  const patch = sourcePatch(origin.file, origin.range, original.slice(origin.range.start, origin.range.end), replacement)
  try { const versions = applyPatches(store, [patch], "forward"); return transaction({ file: origin.file, range: origin.range, editType: options.semantic ? "layout" : breakpoint === "base" ? "style" : "responsive", before: patch.before, after: patch.after, target: identity, success: true, patches: [patch], versions, viewport: options.viewport }) } catch (error) { return failed(identity, "style", String(error)) }
}

/** Construct only an explicit missing override of an existing safe origin.
 * Appends real CSS or one variant token. No new selector, coordinate model,
 * arbitrary media text, or inferred per-instance source is introduced. */
export function patchResponsiveConstruct(store: SourceStore, files: Map<string,string>, identity: SourceIdentity, property: StyleProperty, value: string, breakpointId: string, scope?: string) {
  const analysis=analyzeProjectStyles(files,Boolean(store.tailwind)),target=analysis.targets.find(t=>t.identity.file===identity.file&&t.identity.elementStart===identity.elementStart)
  if(!target||target.nodeKind!=="native"||target.reasonCodes?.some(c=>["jsx-spread-props","dynamic-class-expression"].includes(c))||scope!=="source"||!supportedProperties.includes(property))return failed(identity,"responsive","Choose an unambiguous existing source origin and source scope.")
  const origin=mutationOrigin(target,property,"base",analysis.breakpoints)
  if(!origin?.editable||!origin.range||!origin.file||!["css","css-module","tailwind"].includes(origin.kind))return failed(identity,"responsive","Responsive construction requires an existing static CSS selector or Tailwind token.")
  const preset=breakpointId.startsWith("new:")?breakpointId.slice(4) as ViewportPreset:undefined
  const breakpoint=analysis.breakpoints.find(b=>b.id===breakpointId)
  const media=preset&&Object.prototype.hasOwnProperty.call(breakpointQuery,preset)?breakpointQuery[preset]:breakpoint?.media
  const prefix=breakpoint?.prefix
  let patch:SourcePatch
  const source=files.get(origin.file)!
  if(origin.kind==="tailwind"){
    if(!prefix||!breakpointId.startsWith("tw:")||target.styleOrigins.some(o=>o.property===property&&o.prefix===prefix))return failed(identity,"responsive","Select a supported missing Tailwind variant; existing or ambiguous variants must use their original declaration.")
    const token=tailwindPropertySafe(property,value)?value:tailwindToken(property,value)
    if(!token||!tailwindPropertySafe(property,token))return failed(identity,"responsive","Unsupported responsive utility value.")
    patch=sourcePatch(origin.file,origin.range,source.slice(origin.range.start,origin.range.end),source.slice(origin.range.start,origin.range.end)+" "+prefix+token)
  }else{
    if(!media||!origin.selector||!/^\.[a-zA-Z_][a-zA-Z0-9_-]*$/.test(origin.selector)||!safeStyleValue(value)||["paddingX","paddingY"].includes(property)||target.styleOrigins.some(o=>o.property===property&&o.media===media))return failed(identity,"responsive","Select a supported missing media override of a single class selector; ambiguous or existing declarations must use Code or their origin.")
    const name=property.replace(/[A-Z]/g,c=>"-"+c.toLowerCase())
    patch=sourcePatch(origin.file,{start:source.length,end:source.length},"",`\n@media ${media} {\n  ${origin.selector} { ${name}: ${value}; }\n}\n`)
  }
  try{const versions=applyPatches(store,[patch],"forward");return transaction({file:origin.file,range:patch.range,editType:"responsive",before:patch.before,after:patch.after,target:identity,success:true,patches:[patch],versions})}catch{return failed(identity,"responsive","Source changed before responsive construction.")}
}

function tailwindPropertySafe(property: StyleProperty, token: string) {
  // Numeric/named standard tokens only; unknown/custom/arbitrary/state values stay untouched.
  return !/[:!\[\]\s]/.test(token) && /^[a-z0-9./-]+$/.test(token) && tailwindProperty(token) === property
}

export function patchSiblingReorder(store: SourceStore, files: Map<string, string>, identity: SourceIdentity, direction: string, viewport: ViewportPreset = "desktop", scope?: string) {
  if (!Object.prototype.hasOwnProperty.call(viewportWidths, viewport)) return failed(identity, "layout", "Unsupported viewport.")
  const analysis = analyzeProjectStyles(files, Boolean(store.tailwind), viewportWidths[viewport])
  const target = analysis.targets.find(item => item.identity.file === identity.file && item.identity.elementStart === identity.elementStart)
  const neighbor = direction === "previous" ? target?.reorder?.previous : direction === "next" ? target?.reorder?.next : undefined
  if (neighbor === undefined || !target?.reorder) return failed(identity, "layout", "A static adjacent JSX sibling in an explicit Flex/Grid parent is required.")
  const parent = analysis.targets.find(item => item.identity.file === identity.file && item.identity.elementStart === target.reorder!.parentStart)
  if (parent?.styleOrigins.some(item => item.shared) && scope !== "source") return failed(identity, "layout", "Choose source scope: reordering changes this component definition.")
  const code = files.get(identity.file)!, source = ts.createSourceFile(identity.file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const nodes: ts.Node[] = []
  const visit = (node: ts.Node) => { if ((ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) && [identity.elementStart, neighbor].includes(node.getStart(source))) nodes.push(node); ts.forEachChild(node, visit) }; visit(source)
  nodes.sort((a, b) => a.getStart(source) - b.getStart(source))
  if (nodes.length !== 2 || nodes[0].parent !== nodes[1].parent) return failed(identity, "layout", "Sibling source changed.")
  const [first, second] = nodes, start = first.getStart(source), end = second.getEnd(), between = code.slice(first.getEnd(), second.getStart(source))
  if (between.trim()) return failed(identity, "layout", "Comments/expressions between siblings require Code to preserve intent.")
  const before = code.slice(start, end), after = second.getText(source) + between + first.getText(source), patch = sourcePatch(identity.file, { start, end }, before, after)
  try { const versions = applyPatches(store, [patch], "forward"); return transaction({ file: identity.file, range: patch.range, editType: "layout", before, after, target: identity, success: true, patches: [patch], versions }) } catch (error) { return failed(identity, "layout", String(error)) }
}
