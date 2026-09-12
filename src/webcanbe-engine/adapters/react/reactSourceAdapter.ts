import ts from "typescript"
import { deriveCompatibility } from "../../core/compatibility"
import { encodeSourceIdentity } from "../../core/sourceIdentity"
import type { ElementCapabilities, SourceIdentity, SourceRange, SourceTarget, StyleOrigin, StyleProperty } from "../../core/types"

const supportedProperties: StyleProperty[] = ["backgroundColor", "color", "fontSize", "fontWeight", "padding", "paddingX", "paddingY", "margin", "gap", "width", "height", "border", "borderRadius", "alignItems", "justifyContent"]

type ReadSource = (file: string) => string | undefined

type ClassInfo = { className?: string; cssModule?: { namespace: string; name: string }; tailwind?: string[] }

function cssName(property: StyleProperty) {
  return property.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)
}

function jsxName(node: ts.JsxOpeningLikeElement) {
  return node.tagName.getText()
}

function getAttribute(node: ts.JsxOpeningLikeElement, name: string) {
  return node.attributes.properties.find((attribute): attribute is ts.JsxAttribute => ts.isJsxAttribute(attribute) && ts.isIdentifier(attribute.name) && attribute.name.text === name)
}

function staticClassInfo(node: ts.JsxOpeningLikeElement): ClassInfo {
  const attribute = getAttribute(node, "className")
  if (!attribute?.initializer) return {}
  if (ts.isStringLiteral(attribute.initializer)) {
    const value = attribute.initializer.text
    return { className: value, tailwind: value.split(/\s+/).filter(Boolean) }
  }
  if (ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression && ts.isPropertyAccessExpression(attribute.initializer.expression)) {
    const expression = attribute.initializer.expression
    if (ts.isIdentifier(expression.expression)) return { cssModule: { namespace: expression.expression.text, name: expression.name.text } }
  }
  return {}
}

function findImportPath(source: string, suffix: string, namespace?: string) {
  const expressions = source.matchAll(/import\s+(?:(\w+)\s+from\s+)?["']([^"']+)["']/g)
  for (const expression of expressions) {
    const [, imported, path] = expression
    if (namespace && imported !== namespace) continue
    if (path.endsWith(suffix)) return path
  }
  return undefined
}

function resolveRelative(file: string, request: string) {
  const base = file.split("/").slice(0, -1)
  for (const segment of request.split("/")) {
    if (!segment || segment === ".") continue
    if (segment === "..") base.pop()
    else base.push(segment)
  }
  return base.join("/")
}

function findCssDeclaration(source: string, selector: string, property: StyleProperty): SourceRange | undefined {
  const selectorIndex = source.indexOf(selector)
  if (selectorIndex < 0) return undefined
  const open = source.indexOf("{", selectorIndex)
  const close = source.indexOf("}", open)
  if (open < 0 || close < 0) return undefined
  const name = cssName(property)
  const declaration = new RegExp(`(^|\\n|;)\\s*${name.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\s*:\\s*([^;\\n}]+)`, "g")
  const body = source.slice(open + 1, close)
  const found = declaration.exec(body)
  if (!found) return undefined
  const valueStart = open + 1 + found.index + found[0].lastIndexOf(found[2])
  return { start: valueStart, end: valueStart + found[2].length }
}

function tailwindProperty(token: string): StyleProperty | undefined {
  if (/^bg-/.test(token)) return "backgroundColor"
  if (/^text-(?:white|black|[a-z]+-\d+)/.test(token)) return "color"
  if (/^text-(xs|sm|base|lg|xl|\d+xl)$/.test(token)) return "fontSize"
  if (/^font-/.test(token)) return "fontWeight"
  if (/^p-/.test(token)) return "padding"
  if (/^px-/.test(token)) return "paddingX"
  if (/^py-/.test(token)) return "paddingY"
  if (/^m-/.test(token)) return "margin"
  if (/^gap-/.test(token)) return "gap"
  if (/^w-/.test(token)) return "width"
  if (/^h-/.test(token)) return "height"
  if (/^rounded/.test(token)) return "borderRadius"
  if (/^items-/.test(token)) return "alignItems"
  if (/^justify-/.test(token)) return "justifyContent"
  return undefined
}

function staticTextRange(node: ts.JsxOpeningElement, source: ts.SourceFile): { range: SourceRange; text: string } | undefined {
  const element = node.parent
  if (!ts.isJsxElement(element)) return undefined
  const texts = element.children.filter(ts.isJsxText).filter((child) => child.getText(source).trim())
  if (texts.length !== 1 || element.children.some((child) => ts.isJsxExpression(child) && child.expression)) return undefined
  const child = texts[0]
  const raw = child.getText(source)
  const leading = raw.length - raw.trimStart().length
  const text = raw.trim()
  return { text, range: { start: child.getStart(source) + leading, end: child.getStart(source) + leading + text.length } }
}

function inlineStyleOrigins(node: ts.JsxOpeningLikeElement, source: ts.SourceFile): StyleOrigin[] {
  const attribute = getAttribute(node, "style")
  if (!attribute?.initializer || !ts.isJsxExpression(attribute.initializer) || !attribute.initializer.expression || !ts.isObjectLiteralExpression(attribute.initializer.expression)) return []
  return attribute.initializer.expression.properties.flatMap((property) => {
    if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) return []
    const name = property.name.text as StyleProperty
    if (!supportedProperties.includes(name)) return []
    return [{ property: name, kind: "inline" as const, editable: ts.isStringLiteral(property.initializer) || ts.isNumericLiteral(property.initializer), range: { start: property.initializer.getStart(source), end: property.initializer.getEnd() }, value: property.initializer.getText(source) }]
  })
}

function stylesheetOrigins(file: string, source: string, classInfo: ClassInfo, readSource: ReadSource): StyleOrigin[] {
  const request = classInfo.cssModule ? findImportPath(source, ".module.css", classInfo.cssModule.namespace) : findImportPath(source, ".css")
  const className = classInfo.cssModule?.name ?? classInfo.className?.split(/\s+/)[0]
  if (!request || !className) return []
  const cssFile = resolveRelative(file, request)
  const css = readSource(cssFile)
  if (!css) return []
  const selector = `.${className}`
  return supportedProperties.flatMap((property) => {
    const range = findCssDeclaration(css, selector, property)
    return range ? [{ property, kind: classInfo.cssModule ? "css-module" as const : "css" as const, editable: true, file: cssFile, range, value: css.slice(range.start, range.end).trim() }] : []
  })
}

function tailwindOrigins(node: ts.JsxOpeningLikeElement, source: ts.SourceFile, classInfo: ClassInfo): StyleOrigin[] {
  const attribute = getAttribute(node, "className")
  if (!attribute?.initializer || !ts.isStringLiteral(attribute.initializer) || !classInfo.tailwind) return []
  const literal = attribute.initializer
  const literalStart = literal.getStart(source) + 1
  return classInfo.tailwind.flatMap((token) => {
    const property = tailwindProperty(token)
    if (!property) return []
    const index = literal.text.indexOf(token)
    return [{ property, kind: "tailwind" as const, editable: true, range: { start: literalStart + index, end: literalStart + index + token.length }, value: token }]
  })
}

function capabilities(origins: StyleOrigin[], text: boolean): ElementCapabilities {
  const editable = origins.filter((origin) => origin.editable).map((origin) => origin.property)
  return {
    preview: true,
    codeEdit: true,
    visualEdit: text || editable.length > 0,
    text,
    spacing: editable.some((property) => ["padding", "paddingX", "paddingY", "margin", "gap"].includes(property)),
    color: editable.some((property) => ["backgroundColor", "color", "border"].includes(property)),
    typography: editable.some((property) => ["fontSize", "fontWeight"].includes(property)),
    size: editable.some((property) => ["width", "height", "borderRadius"].includes(property)),
    layout: editable.some((property) => ["alignItems", "justifyContent", "gap"].includes(property)),
    reorder: false,
  }
}

export function analyzeReactSource(file: string, code: string, readSource: ReadSource): SourceTarget[] {
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const targets: SourceTarget[] = []
  const visit = (node: ts.Node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && /^[a-z]/.test(jsxName(node))) {
      const identity: SourceIdentity = { file, elementStart: node.getStart(source) }
      const classInfo = staticClassInfo(node)
      const text = ts.isJsxOpeningElement(node) ? staticTextRange(node, source) : undefined
      const origins = [...inlineStyleOrigins(node, source), ...tailwindOrigins(node, source, classInfo), ...stylesheetOrigins(file, code, classInfo, readSource)]
      const target: SourceTarget = { identity, elementName: jsxName(node), sourceRange: { start: node.getStart(source), end: node.getEnd() }, textRange: text?.range, text: text?.text, styleOrigins: origins, capabilities: capabilities(origins, Boolean(text)), compatibility: "partial" }
      target.compatibility = deriveCompatibility(target.capabilities)
      targets.push(target)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return targets
}

export function instrumentReactSource(file: string, code: string) {
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const insertions: Array<{ position: number; value: string }> = []
  const visit = (node: ts.Node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && /^[a-z]/.test(jsxName(node)) && !getAttribute(node, "data-wcb-id")) {
      insertions.push({ position: node.tagName.end, value: ` data-wcb-id="${encodeSourceIdentity({ file, elementStart: node.getStart(source) })}"` })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return insertions.sort((a, b) => b.position - a.position).reduce((output, insertion) => `${output.slice(0, insertion.position)}${insertion.value}${output.slice(insertion.position)}`, code)
}
