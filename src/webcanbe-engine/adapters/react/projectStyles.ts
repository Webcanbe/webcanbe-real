import ts from "typescript"
import { analyzeReactSource, cssDeclaration, parsedCSS, parsedSource, supportedProperties } from "./reactSourceAdapter"
import type { SourceTarget, StyleOrigin, StyleProperty, ViewportPreset } from "../../core/types"

export type Breakpoint = { id: string; label: string; min?: number; max?: number; prefix?: string; media?: string; source: string }
export type StyleAnalysis = { targets: SourceTarget[]; breakpoints: Breakpoint[]; diagnostics: string[] }
export const viewportWidths: Record<ViewportPreset, number> = { mobile: 390, tablet: 768, desktop: 1280 }
const pixels = (value: string) => { const match = /^(\d+(?:\.\d+)?)(px|rem|em)$/.exec(value.trim()); return match ? Number(match[1]) * (match[2] === "px" ? 1 : 16) : undefined }
export function mediaBounds(query: string): { min?: number; max?: number } | undefined {
  const parts = query.replace(/^screen\s+and\s+/i, "").split(/\s+and\s+/i), result: { min?: number; max?: number } = {}
  for (const part of parts) {
    const match = /^\(\s*(min|max)-width\s*:\s*([\d.]+(?:px|rem|em))\s*\)$/.exec(part.trim())
    if (!match || result[match[1] as "min" | "max"] !== undefined) return undefined
    result[match[1] as "min" | "max"] = pixels(match[2])
  }
  return result
}
export function applies(breakpoint: { min?: number; max?: number }, width: number) { return width >= (breakpoint.min ?? 0) && width <= (breakpoint.max ?? Infinity) }

export function breakpointRegistry(files: Map<string, string>, tailwind: boolean) {
  const breakpoints: Breakpoint[] = [{ id: "base", label: "Base / default", prefix: "", source: "unprefixed source" }], diagnostics: string[] = []
  const defaults: Record<string, number> = { sm: 640, md: 768, lg: 1024, xl: 1280, "2xl": 1536 }
  let unsafeTheme = false
  for (const [file, code] of files) {
    if (/tailwind\.config\./.test(file)) { unsafeTheme = true; diagnostics.push(`${file}: config evaluation is unsupported; responsive Tailwind editing is read-only.`) }
    if (!file.endsWith(".css")) continue
    try {
      const root = parsedCSS(code)
      root.walkAtRules(rule => {
        if (["config", "plugin"].includes(rule.name)) unsafeTheme = true
        if (rule.name === "media") {
          const bounds = mediaBounds(rule.params)
          if (bounds && !breakpoints.some(item => item.media === rule.params)) breakpoints.push({ id: `css:${rule.params}`, label: rule.params, media: rule.params, ...bounds, source: file })
          else if (!bounds) diagnostics.push(`${file}: unsupported media condition ${rule.params}; affected properties are read-only.`)
        }
        if (rule.name === "theme") rule.walkDecls(decl => {
          if (decl.prop === "--breakpoint-*") { if (decl.value === "initial") for (const key of Object.keys(defaults)) delete defaults[key]; else unsafeTheme = true }
          else if (decl.prop.startsWith("--breakpoint-")) {
            const key = decl.prop.slice(13), value = pixels(decl.value)
            if (value === undefined) unsafeTheme = true; else defaults[key] = value
          }
        })
      })
    } catch { diagnostics.push(`${file}: invalid CSS; source editing remains available.`) }
  }
  if (tailwind && !unsafeTheme) for (const [prefix, min] of Object.entries(defaults).sort((a, b) => a[1] - b[1])) breakpoints.push({ id: `tw:${prefix}`, label: prefix, prefix: `${prefix}:`, min, source: "Tailwind v4 defaults / static CSS @theme" })
  if (unsafeTheme) diagnostics.push("Unsupported Tailwind configuration: variant mutations fail closed.")
  return { breakpoints, diagnostics }
}

// Per-source analysis records its actual stylesheet dependencies. Unrelated edits
// reuse the AST/style result; revisions are attached by the authorized API only.
const cache = new Map<string, { code: string; tailwind: boolean; dependencies: Map<string, string | undefined>; targets: SourceTarget[] }>()
function analyzedFile(file: string, code: string, files: Map<string, string>, tailwind: boolean) {
  const key = `${file}\0${tailwind}\0${code}`, hit = cache.get(key)
  if (hit && [...hit.dependencies].every(([path, content]) => files.get(path) === content)) return structuredClone(hit.targets)
  const dependencies = new Map<string, string | undefined>()
  const targets = analyzeReactSource(file, code, path => { const value = files.get(path); dependencies.set(path, value); return value }, { tailwind })
  if (cache.size >= 64) cache.delete(cache.keys().next().value!)
  cache.set(key, { code, tailwind, dependencies, targets })
  return structuredClone(targets)
}
function overlap(a: StyleProperty, b: StyleProperty) { return a === b || [a, b].every(item => ["padding", "paddingX", "paddingY"].includes(item)) && (a === "padding" || b === "padding") }
export function analyzeProjectStyles(files: Map<string, string>, tailwind: boolean, width = 1280): StyleAnalysis {
  const registry = breakpointRegistry(files, tailwind)
  const targets = [...files].filter(([file]) => /\.[jt]sx?$/.test(file)).flatMap(([file, code]) => analyzedFile(file, code, files, tailwind))
  const componentCounts = new Map<string, number>()
  for (const target of targets) if (target.nodeKind === "component") componentCounts.set(target.elementName, (componentCounts.get(target.elementName) ?? 0) + 1)
  const importedCSS = new Set<string>()
  for (const [file, code] of files) if (/\.[jt]sx?$/.test(file)) {
    for (const statement of parsedSource(file, code).statements) if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text.endsWith(".css")) {
      const request = statement.moduleSpecifier.text
      const parts = request.startsWith("@/") ? ["src"] : file.split("/").slice(0, -1)
      if (!request.startsWith(".") && !request.startsWith("@/")) continue
      for (const part of request.replace(/^@\//, "").split("/")) { if (part === "..") parts.pop(); else if (part && part !== ".") parts.push(part) }
      importedCSS.add(parts.join("/"))
    }
  }
  // Global simple class rules are source matches, never computed-value guesses.
  // All normal project CSS is conservatively considered, including entry imports.
  for (const target of targets) {
    if (targets.some(item => item.nodeKind === "component" && item.elementName === target.ownerComponent && item.repeated)) target.repeated = true
    if (target.nodeKind !== "native") continue
    for (const [file, code] of files) {
      if (!file.endsWith(".css") || file.endsWith(".module.css") || !importedCSS.has(file)) continue
      for (const name of target.classNames ?? []) for (const property of supportedProperties) {
        for (const media of [undefined, ...registry.breakpoints.filter(item => item.media).map(item => item.media)]) {
          if (target.styleOrigins.some(item => item.file === file && item.selector === `.${name}` && item.property === property && item.media === media)) continue
          const range = cssDeclaration(code, `.${name}`, property, media)
          if (range) target.styleOrigins.push({ file, range, selector: `.${name}`, media, property, kind: "css", value: code.slice(range.start, range.end), editable: true })
        }
      }
    }
    for (const origin of target.styleOrigins) {
      origin.file ??= target.identity.file
      const variants = origin.prefix?.split(":").filter(Boolean) ?? []
      const breakpoint = origin.kind === "tailwind" && variants.length ? registry.breakpoints.find(item => item.prefix === origin.prefix) : undefined
      const bounds = origin.media ? mediaBounds(origin.media) : breakpoint
      origin.active = origin.media ? Boolean(bounds && applies(bounds, width)) : variants.length ? Boolean(breakpoint && applies(breakpoint, width)) : true
      if (variants.length && !breakpoint || origin.media && !bounds) { origin.editable = false; origin.reason = "State, custom or complex responsive variant is analysis-only." }
      if (breakpoint && origin.reason === undefined) origin.editable = true
      if ((target.classNames ?? []).some(token => /[!\[\]]/.test(token))) { origin.editable = false; origin.reason = "Arbitrary or important utilities may overlap; use Code." }
      if (target.reasonCodes?.some(reason => ["jsx-spread-props", "dynamic-class-expression"].includes(reason))) { origin.editable = false; origin.reason = "Dynamic or spread attributes can override the source value; use Code." }
      const unsupportedOverlap = (target.classNames ?? []).some(token => {
        const bare = token.split(":").at(-1)!
        return ["padding", "paddingX", "paddingY"].includes(origin.property) && /^p[trblse]-/.test(bare) || origin.property === "margin" && /^m[xytrblse]-/.test(bare) || origin.property === "gap" && /^gap-[xy]-/.test(bare) || ["flexGrow", "flexShrink", "flexBasis"].includes(origin.property) && /^flex-(1|auto|initial|none)$/.test(bare)
      })
      if (unsupportedOverlap) { origin.editable = false; origin.reason = "An unsupported directional/shorthand utility overlaps this property; use Code." }
      const peers = target.styleOrigins.filter(other => other !== origin && overlap(other.property, origin.property) && (other.prefix ?? "") === (origin.prefix ?? "") && other.media === origin.media)
      if (peers.length) { origin.editable = false; origin.reason = "Overlapping declarations/utilities require an explicit Code edit." }
      // Unknown selectors, !important, animation and unsupported conditional rules
      // can defeat the simple-class proof. Refuse those properties conservatively.
      for (const [file, code] of files) if (file.endsWith(".css") && (!file.endsWith(".module.css") || file === origin.file)) {
        try { parsedCSS(code).walkRules(rule => {
          const exact = target.classNames?.some(name => rule.selector === `.${name}`) || rule.selector === origin.selector && file === origin.file
          const related = exact || (target.classNames ?? []).some(name => new RegExp(`\\.${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`).test(rule.selector)) || /^(\*|html|body)$/.test(rule.selector) || rule.selector === target.elementName
          if (!related) return
          rule.walkDecls(decl => {
            const prop = origin.property.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)
            const relatedProperty = decl.prop === prop || decl.prop === "all" || decl.prop.startsWith("animation") || prop === "gap" && ["row-gap", "column-gap"].includes(decl.prop) || prop === "border" && decl.prop.startsWith("border-") && !decl.prop.endsWith("radius") || prop === "border-radius" && decl.prop.startsWith("border-") && decl.prop.endsWith("-radius") || prop.startsWith("padding") && decl.prop.startsWith("padding") || prop.startsWith("margin") && decl.prop.startsWith("margin") || ["font-size", "font-weight", "line-height"].includes(prop) && decl.prop === "font" || ["flex-grow", "flex-shrink", "flex-basis"].includes(prop) && decl.prop === "flex" || prop.startsWith("grid-") && ["grid", "grid-template"].includes(decl.prop)
            if (!relatedProperty) return
            const parent = rule.parent
            const simple = parent?.type === "root" || parent?.type === "atrule" && parent.name === "media" && parent.parent?.type === "root" && mediaBounds(parent.params)
            const lowerSpecificity = ["*", "html", "body", target.elementName].includes(rule.selector)
            if (decl.prop !== prop || decl.important || !simple || !exact && !lowerSpecificity && origin.kind !== "inline" || rule.selector !== origin.selector && origin.kind === "tailwind" && decl.prop === prop) { origin.editable = false; origin.reason = "Potential global, conditional, important or complex selector override; use Code." }
          })
        }) } catch { origin.editable = false; origin.reason = "Invalid project CSS." }
      }
    }
    for (const property of supportedProperties) {
      const candidates = target.styleOrigins.filter(item => item.property === property && item.active)
      const inline = candidates.filter(item => item.kind === "inline")
      let effective: StyleOrigin | undefined
      if (inline.length === 1) effective = inline[0]
      else if (candidates.every(item => item.kind === "tailwind")) effective = candidates.sort((a, b) => (registry.breakpoints.find(item => item.prefix === a.prefix)?.min ?? 0) - (registry.breakpoints.find(item => item.prefix === b.prefix)?.min ?? 0)).at(-1)
      else if (new Set(candidates.map(item => `${item.file}:${item.selector}`)).size === 1) effective = candidates.sort((a, b) => (a.range?.start ?? 0) - (b.range?.start ?? 0)).at(-1)
      if (effective) effective.effective = true
      else for (const item of candidates) { item.editable = false; item.reason = "Effective cascade origin cannot be proven." }
    }
  }
  for (const target of targets) {
    const instances = Math.max(1, componentCounts.get(target.ownerComponent ?? "") ?? 0)
    target.effectScope = `Source definition ${target.ownerComponent ?? target.identity.file}; ${target.repeated ? "runtime repetition (count unknown)" : `${instances} statically known component use(s)`}. Definition edits affect all its rendered instances.`
    for (const origin of target.styleOrigins) {
      const matches = targets.filter(other => other.styleOrigins.some(item => item.file === origin.file && item.range?.start === origin.range?.start && item.property === origin.property))
      origin.usageCount = matches.reduce((count, other) => count + Math.max(1, componentCounts.get(other.ownerComponent ?? "") ?? 0), 0)
      origin.shared = origin.valueOrigin?.startsWith("local const") || origin.kind === "css" || origin.usageCount > 1 || matches.some(other => other.repeated)
      origin.scope = origin.kind === "css" ? `Global class rule; ${origin.usageCount} known source use(s), additional runtime matches possible` : `${origin.usageCount} known source use(s)${matches.some(other => other.repeated) ? "; runtime repetition unknown" : ""}; all rendered instances of these source locations`
    }
    if (target.styleOrigins.some(item => !item.editable)) { target.compatibility = "partial"; target.reasonCodes = [...new Set([...(target.reasonCodes ?? []), "style-analysis-partial"])] }
  }
  attachReorder(files, targets)
  return { targets, ...registry }
}

function attachReorder(files: Map<string, string>, targets: SourceTarget[]) {
  for (const [file, code] of files) {
    if (!/\.[jt]sx?$/.test(file)) continue
    const source = parsedSource(file, code)
    const visit = (node: ts.Node) => {
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
        const own = targets.find(item => item.identity.file === file && item.identity.elementStart === node.getStart(source))
        if (own?.nodeKind === "native" && ts.isJsxElement(node.parent)) {
          const ancestor = targets.find(item => item.identity.file === file && item.identity.elementStart === (node.parent as ts.JsxElement).openingElement.getStart(source))
          for (const property of ["color", "fontSize", "fontWeight", "lineHeight", "letterSpacing"] as StyleProperty[]) {
            const inherited = ancestor?.styleOrigins.find(item => item.property === property && item.effective && (item.editable || item.kind === "inherited"))
            if (inherited && !own.styleOrigins.some(item => item.property === property && item.active)) own.styleOrigins.push({ ...inherited, kind: "inherited", editable: false, range: undefined, reason: `Inherited from parent source at ${file}:${ancestor!.identity.elementStart}; edit the parent explicitly.`, scope: inherited.scope })
          }
        }
      }
      if (ts.isJsxElement(node)) {
        const parent = targets.find(item => item.identity.file === file && item.identity.elementStart === node.openingElement.getStart(source))
        const display = parent?.styleOrigins.find(item => item.property === "display" && item.effective && item.editable)?.value?.replace(/^['"]|['"]$/g, "").split(":").at(-1)
        const children = node.children.filter(child => !ts.isJsxText(child) || child.getText(source).trim())
        if (parent && ["flex", "grid", "inline-flex", "inline-grid"].includes(display ?? "") && children.every(child => ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) && !parent.repeated) {
          children.forEach((child, index) => {
            const start = child.getStart(source), target = targets.find(item => item.identity.file === file && item.identity.elementStart === start)
            if (target?.nodeKind === "native" && !target.repeated && !target.reasonCodes?.includes("jsx-spread-props")) { target.reorder = { previous: children[index - 1]?.getStart(source), next: children[index + 1]?.getStart(source), parentStart: parent.identity.elementStart }; target.capabilities.reorder = true }
          })
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
}

export function mutationOrigin(target: SourceTarget, property: StyleProperty, breakpoint: string, registry: Breakpoint[]) {
  const selected = registry.find(item => item.id === breakpoint)
  if (!selected) return undefined
  const matches = target.styleOrigins.filter(item => item.property === property && item.editable && (selected.id === "base" ? !item.prefix && !item.media : selected.media ? item.media === selected.media : item.kind === "tailwind" && item.prefix === selected.prefix))
  return matches.length === 1 ? matches[0] : undefined
}
