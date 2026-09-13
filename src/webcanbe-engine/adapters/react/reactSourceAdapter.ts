import ts from "typescript"
import postcss from "postcss"
import { deriveCompatibility } from "../../core/compatibility"
import { encodeSourceIdentity } from "../../core/sourceIdentity"
import type { ElementCapabilities, SourceIdentity, SourceRange, SourceTarget, StyleOrigin, StyleProperty } from "../../core/types"

export const supportedProperties: StyleProperty[] = [
  "backgroundColor", "color", "fontSize", "fontWeight", "padding", "paddingX", "paddingY", "margin", "gap", "width", "height", "border", "borderRadius", "alignItems", "justifyContent", "alignSelf", "justifySelf", "order", "flexGrow", "flexShrink", "flexBasis", "gridTemplateColumns", "gridTemplateRows", "gridColumn", "gridRow", "maxWidth", "minWidth", "minHeight", "maxHeight", "flexDirection", "display", "lineHeight", "letterSpacing",
]

const astCache = new Map<string, ts.SourceFile>()
const cssCache = new Map<string, ReturnType<typeof postcss.parse>>()
export function parsedSource(file: string, code: string) {
  const key = file + "\0" + code
  let value = astCache.get(key)
  if (!value) { value = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); if (astCache.size >= 64) astCache.delete(astCache.keys().next().value!); astCache.set(key, value) }
  return value
}
export function parsedCSS(code: string) {
  let value = cssCache.get(code)
  if (!value) { value = postcss.parse(code); if (cssCache.size >= 64) cssCache.delete(cssCache.keys().next().value!); cssCache.set(code, value) }
  return value
}
type ReadSource = (file: string) => string | undefined
type ClassInfo = { classNames: string[]; cssModule?: { namespace: string; name: string }; tailwind: string[]; static: boolean }

function cssName(property: StyleProperty) { return property.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`) }
function jsxName(node: ts.JsxOpeningLikeElement) { return node.tagName.getText() }
function isNative(name: string) { return /^[a-z][a-zA-Z0-9-]*$/.test(name) }

function getAttribute(node: ts.JsxOpeningLikeElement, name: string) {
  return node.attributes.properties.find((attribute): attribute is ts.JsxAttribute => ts.isJsxAttribute(attribute) && ts.isIdentifier(attribute.name) && attribute.name.text === name)
}

function hasShadowedBinding(source: ts.SourceFile, name: string) {
  const contains = (binding: ts.BindingName): boolean => ts.isIdentifier(binding) ? binding.text === name : binding.elements.some(element => ts.isBindingElement(element) && contains(element.name))
  let shadowed = false
  const visit = (node: ts.Node) => {
    if ((ts.isParameter(node) || ts.isVariableDeclaration(node)) && contains(node.name)) shadowed = true
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name?.text === name) shadowed = true
    ts.forEachChild(node, visit)
  }
  visit(source)
  return shadowed
}

function staticValue(expression: ts.Expression, seen = new Set<string>()): ts.Expression | undefined {
  const source = expression.getSourceFile()
  if (ts.isIdentifier(expression)) {
    if (seen.has(expression.text)) return undefined
    const declarations: ts.VariableDeclaration[] = []
    let unsafe = false
    const mentions = (node: ts.Node): boolean => ts.isIdentifier(node) && node.text === expression.text || Boolean(ts.forEachChild(node, child => mentions(child) || undefined))
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node)) {
        if (ts.isIdentifier(node.name) && node.name.text === expression.text) declarations.push(node)
        else if (mentions(node.name) || node.initializer && !ts.isArrowFunction(node.initializer) && !ts.isFunctionExpression(node.initializer) && !ts.isJsxElement(node.initializer) && !ts.isJsxSelfClosingElement(node.initializer) && mentions(node.initializer)) unsafe = true
      }
      if (ts.isParameter(node) && mentions(node.name)) unsafe = true
      if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name?.text === expression.text) unsafe = true
      // Refuse writes, deletion, escaping aliases and calls. Const does not make
      // an object immutable, and no uploaded JavaScript is evaluated here.
      if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment && mentions(node.left)) unsafe = true
      if ((ts.isCallExpression(node) || ts.isPostfixUnaryExpression(node) || ts.isPrefixUnaryExpression(node) || ts.isDeleteExpression(node)) && mentions(node)) unsafe = true
      ts.forEachChild(node, visit)
    }
    visit(source)
    const declaration = declarations[0]
    if (unsafe || declarations.length !== 1 || !declaration.initializer || !ts.isVariableDeclarationList(declaration.parent) || !(declaration.parent.flags & ts.NodeFlags.Const) || !ts.isVariableStatement(declaration.parent.parent) || declaration.parent.parent.parent !== source) return undefined
    if (declaration.parent.parent.modifiers?.some(item => item.kind === ts.SyntaxKind.ExportKeyword) && (ts.isObjectLiteralExpression(declaration.initializer) || ts.isArrayLiteralExpression(declaration.initializer))) return undefined
    return staticValue(declaration.initializer, new Set([...seen, expression.text]))
  }
  if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
    const object = staticValue(expression.expression, seen)
    const key = ts.isPropertyAccessExpression(expression) ? expression.name.text : expression.argumentExpression && (ts.isStringLiteral(expression.argumentExpression) || ts.isNumericLiteral(expression.argumentExpression)) ? expression.argumentExpression.text : undefined
    if (!object || key === undefined) return undefined
    if (ts.isObjectLiteralExpression(object)) {
      if (object.properties.some(item => !ts.isPropertyAssignment(item) || ts.isComputedPropertyName(item.name))) return undefined
      const matches = object.properties.filter(ts.isPropertyAssignment).filter(item => item.name.getText(source).replace(/^['"]|['"]$/g, "") === key)
      return matches.length === 1 ? staticValue(matches[0].initializer, seen) : undefined
    }
    if (ts.isArrayLiteralExpression(object) && /^\d+$/.test(key) && object.elements.every(item => !ts.isSpreadElement(item))) {
      const value = object.elements[Number(key)]; return value && ts.isExpression(value) ? staticValue(value, seen) : undefined
    }
    return undefined
  }
  return expression
}

function staticStrings(expression: ts.Expression): string[] | undefined {
  const resolved = staticValue(expression)
  if (!resolved) return undefined
  if (resolved !== expression) return staticStrings(resolved)
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return [expression.text]
  if (ts.isArrayLiteralExpression(expression)) {
    const values = expression.elements.map((item) => ts.isExpression(item) ? staticStrings(item) : undefined)
    return values.every(Boolean) ? values.flat() as string[] : undefined
  }
  if (ts.isCallExpression(expression) && ts.isIdentifier(expression.expression) && ["clsx", "cn", "classnames"].includes(expression.expression.text)) {
    const source = expression.getSourceFile()
    const helper = expression.expression.text
    const binding = source.statements.filter(ts.isImportDeclaration).some(item => ts.isStringLiteral(item.moduleSpecifier) && ["clsx", "classnames"].includes(item.moduleSpecifier.text) && (item.importClause?.name?.text === helper || item.importClause?.namedBindings && ts.isNamedImports(item.importClause.namedBindings) && item.importClause.namedBindings.elements.some(element => element.name.text === helper && ["clsx", "default"].includes(element.propertyName?.text ?? element.name.text))))
    if (!binding || hasShadowedBinding(source, helper)) return undefined
    const values = expression.arguments.map(staticStrings)
    return values.every(Boolean) ? values.flat() as string[] : undefined
  }
  return undefined
}

function staticClassInfo(node: ts.JsxOpeningLikeElement): ClassInfo {
  const attribute = getAttribute(node, "className")
  if (!attribute?.initializer) return { classNames: [], tailwind: [], static: false }
  if (ts.isStringLiteral(attribute.initializer)) {
    const tokens = attribute.initializer.text.split(/\s+/).filter(Boolean)
    return { classNames: tokens, tailwind: tokens, static: true }
  }
  if (ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression) {
    const expression = attribute.initializer.expression
    if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression) && !hasShadowedBinding(expression.getSourceFile(), expression.expression.text) && expression.getSourceFile().statements.filter(ts.isImportDeclaration).some(item => item.importClause?.name?.text === expression.expression.getText() && ts.isStringLiteral(item.moduleSpecifier) && item.moduleSpecifier.text.endsWith(".module.css"))) return { classNames: [], tailwind: [], static: true, cssModule: { namespace: expression.expression.text, name: expression.name.text } }
    const strings = staticStrings(expression)
    if (strings) {
      const tokens = strings.flatMap((value) => value.split(/\s+/)).filter(Boolean)
      return { classNames: tokens, tailwind: tokens, static: true }
    }
  }
  return { classNames: [], tailwind: [], static: false }
}

function findImportPaths(source: string, suffix: string, namespace?: string) {
  const parsed = ts.createSourceFile("source.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  return parsed.statements.filter(ts.isImportDeclaration).flatMap(statement => {
    if (!ts.isStringLiteral(statement.moduleSpecifier)) return []
    const request = statement.moduleSpecifier.text
    if (!request.startsWith(".")) return []
    return request.endsWith(suffix) && (!namespace || statement.importClause?.name?.text === namespace) ? [request] : []
  })
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

export function cssDeclaration(source: string, selector: string, property: StyleProperty, media?: string): SourceRange | undefined {
  try {
    const root = parsedCSS(source)
    const matches: SourceRange[] = []
    let ambiguous = false
    root.walkRules(rule => {
      if (!rule.selector.includes(selector)) return
      // Complex selectors/cascade interactions are deliberately not inferred.
      if (rule.selector !== selector) {
        const lastPart = rule.selector.split(/[ >+~]+/).at(-1) ?? ""
        if (lastPart.includes(selector) && !lastPart.startsWith(selector + "-")) ambiguous = true
        return
      }
      const parent = rule.parent
      const inScope = media ? parent?.type === "atrule" && parent.name === "media" && parent.parent?.type === "root" && parent.params === media : parent?.type === "root"
      if (!inScope) return
      const declarations = rule.nodes.filter(node => node.type === "decl" && node.prop === cssName(property))
      if (declarations.length !== 1) { if (declarations.length > 1) ambiguous = true; return }
      const declaration = declarations[0]
      if (declaration.type !== "decl" || declaration.important || declaration.source?.start?.offset === undefined) { ambiguous = true; return }
      if (declaration.raws.value && declaration.raws.value.raw !== declaration.value) { ambiguous = true; return }
      const start = declaration.source.start.offset + declaration.prop.length + (declaration.raws.between ?? ":").length
      matches.push({ start, end: start + declaration.value.length })
    })
    return !ambiguous && matches.length === 1 ? matches[0] : undefined
  } catch { return undefined }
}

export function tailwindProperty(token: string): StyleProperty | undefined {
  const bare = token.split(":").at(-1)!
  if (/[:!\[\]]/.test(bare)) return undefined
  if (/^bg-(?:white|black|transparent|[a-z]+-\d+)$/.test(bare)) return "backgroundColor"
  if (/^text-(?:white|black|[a-z]+-\d+)$/.test(bare)) return "color"
  if (/^text-(xs|sm|base|lg|xl|\d+xl)$/.test(bare)) return "fontSize"
  if (/^font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/.test(bare)) return "fontWeight"
  if (/^p-(?:\d+(?:\.\d+)?|px)$/.test(bare)) return "padding"
  if (/^px-(?:\d+(?:\.\d+)?|px)$/.test(bare)) return "paddingX"
  if (/^py-(?:\d+(?:\.\d+)?|px)$/.test(bare)) return "paddingY"
  if (/^m-(?:\d+(?:\.\d+)?|px|auto)$/.test(bare)) return "margin"
  if (/^gap-(?:\d+(?:\.\d+)?|px)$/.test(bare)) return "gap"
  if (/^w-(?:\d+(?:\.\d+)?(?:\/\d+)?|px|full|auto|screen|min|max|fit|none|xs|sm|md|lg|xl|[2-7]xl)$/.test(bare)) return "width"
  if (/^h-(?:\d+(?:\.\d+)?(?:\/\d+)?|px|full|auto|screen|min|max|fit|none|xs|sm|md|lg|xl|[2-7]xl)$/.test(bare)) return "height"
  if (/^max-w-(?:\d+(?:\.\d+)?(?:\/\d+)?|px|full|auto|screen|min|max|fit|none|xs|sm|md|lg|xl|[2-7]xl)$/.test(bare)) return "maxWidth"
  if (/^min-w-(?:\d+(?:\.\d+)?(?:\/\d+)?|px|full|auto|screen|min|max|fit|none|xs|sm|md|lg|xl|[2-7]xl)$/.test(bare)) return "minWidth"
  if (/^min-h-(?:\d+(?:\.\d+)?(?:\/\d+)?|px|full|auto|screen|min|max|fit|none|xs|sm|md|lg|xl|[2-7]xl)$/.test(bare)) return "minHeight"
  if (/^max-h-(?:\d+(?:\.\d+)?(?:\/\d+)?|px|full|auto|screen|min|max|fit|none|xs|sm|md|lg|xl|[2-7]xl)$/.test(bare)) return "maxHeight"
  if (/^flex-(row|col)(-reverse)?$/.test(bare)) return "flexDirection"
  if (/^(block|inline-block|inline|flex|inline-flex|grid|inline-grid|hidden|contents)$/.test(bare)) return "display"
  if (/^leading-(none|tight|snug|normal|relaxed|loose|\d+)$/.test(bare)) return "lineHeight"
  if (/^tracking-(tighter|tight|normal|wide|wider|widest)$/.test(bare)) return "letterSpacing"
  if (/^rounded(?:-(?:none|sm|md|lg|xl|2xl|3xl|full))?$/.test(bare)) return "borderRadius"
  if (/^border(?:-\d+)?$/.test(bare)) return "border"
  // Border color/style and directional radius remain separate unsupported origins.
  if (/^items-(?:start|end|center|baseline|stretch)$/.test(bare)) return "alignItems"
  if (/^justify-(?:start|end|center|between|around|evenly)$/.test(bare)) return "justifyContent"
  if (/^self-(?:auto|start|end|center|stretch|baseline)$/.test(bare)) return "alignSelf"
  if (/^justify-self-(?:auto|start|end|center|stretch)$/.test(bare)) return "justifySelf"
  if (/^-?order-(?:\d+|first|last|none)$/.test(bare)) return "order"
  if (/^grow(?:-\d+)?$/.test(bare)) return "flexGrow"
  if (/^shrink(?:-\d+)?$/.test(bare)) return "flexShrink"
  if (/^basis-(?:\d+(?:\.\d+)?(?:\/\d+)?|px|full|auto|screen|min|max|fit|none|xs|sm|md|lg|xl|[2-7]xl)$/.test(bare)) return "flexBasis"
  if (/^grid-cols-(?:[1-9]\d*|none|subgrid)$/.test(bare)) return "gridTemplateColumns"
  if (/^grid-rows-(?:[1-9]\d*|none|subgrid)$/.test(bare)) return "gridTemplateRows"
  if (/^col-start-(?:[1-9]\d*|auto)$/.test(bare)) return "gridColumn"
  if (/^row-start-(?:[1-9]\d*|auto)$/.test(bare)) return "gridRow"
  return undefined
}

function staticTextRange(node: ts.JsxOpeningElement, source: ts.SourceFile) {
  const element = node.parent
  if (!ts.isJsxElement(element)) return undefined
  const meaningful = element.children.filter(child => !ts.isJsxText(child) || child.getText(source).trim())
  if (meaningful.length === 1 && ts.isJsxExpression(meaningful[0]) && meaningful[0].expression && ts.isStringLiteral(meaningful[0].expression)) {
    const literal = meaningful[0].expression
    return { text: literal.text, range: { start: literal.getStart(source), end: literal.getEnd() }, encoding: "js-string" as const }
  }
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
  if (attribute.initializer.expression.properties.some(ts.isSpreadAssignment)) return []
  const names = attribute.initializer.expression.properties.map(property => property.name?.getText(source))
  if (new Set(names).size !== names.length) return []
  return attribute.initializer.expression.properties.flatMap((property) => {
    if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) return []
    const name = property.name.text as StyleProperty
    if (!supportedProperties.includes(name)) return []
    return [{ property: name, kind: "inline" as const, editable: ts.isStringLiteral(property.initializer) || ts.isNumericLiteral(property.initializer), range: { start: property.initializer.getStart(source), end: property.initializer.getEnd() }, value: property.initializer.getText(source) }]
  })
}

function stylesheetOrigins(file: string, source: string, classInfo: ClassInfo, readSource: ReadSource): StyleOrigin[] {
  const requests = classInfo.cssModule ? findImportPaths(source, ".module.css", classInfo.cssModule.namespace) : findImportPaths(source, ".css")
  const classNames = classInfo.cssModule ? [classInfo.cssModule.name] : classInfo.classNames
  const origins: StyleOrigin[] = []
  for (const request of requests) {
    const cssFile = resolveRelative(file, request)
    const css = readSource(cssFile)
    if (!css) continue
    for (const className of classNames) for (const property of supportedProperties) {
      const mediaQueries = new Set<string | undefined>([undefined])
      try { parsedCSS(css).walkAtRules("media", rule => { mediaQueries.add(rule.params) }) } catch { /* Invalid CSS remains code-only. */ }
      for (const media of mediaQueries) {
        const range = cssDeclaration(css, `.${className}`, property, media)
        if (range) origins.push({ property, kind: classInfo.cssModule ? "css-module" : "css", editable: true, file: cssFile, selector: `.${className}`, range, media, value: css.slice(range.start, range.end).trim() })
      }
    }
  }
  return origins
}

function tailwindOrigins(node: ts.JsxOpeningLikeElement, source: ts.SourceFile, classInfo: ClassInfo): StyleOrigin[] {
  const attribute = getAttribute(node, "className")
  if (!attribute?.initializer || !classInfo.tailwind.length || !classInfo.static) return []
  const literals: Array<ts.StringLiteral | ts.NoSubstitutionTemplateLiteral> = []
  const visited = new Set<ts.Node>()
  const visit = (node: ts.Node) => { if (visited.has(node)) return; visited.add(node); if (ts.isExpression(node)) { const resolved = staticValue(node); if (!resolved) return; if (resolved !== node) { visit(resolved); return } } if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) literals.push(node); else ts.forEachChild(node, visit) }
  visit(attribute.initializer)
  return literals.flatMap(literal => {
    if (literal.getText(source).slice(1, -1) !== literal.text) return []
    return [...literal.text.matchAll(/\S+/g)].flatMap(match => {
      const token = match[0], property = tailwindProperty(token)
      if (!property) return []
      const start = literal.getStart(source) + 1 + match.index!
      return [{ property, kind: "tailwind" as const, editable: !token.includes(":") || /^(sm|md|lg|xl|2xl):[^:]+$/.test(token), range: { start, end: start + token.length }, value: token, prefix: token.includes(":") ? token.slice(0, token.lastIndexOf(":") + 1) : "", valueOrigin: literal.getStart(source) < attribute.initializer!.getStart(source) || literal.getEnd() > attribute.initializer!.getEnd() ? "local const/object/array literal" : "literal/static composition" }]
    })
  })
}

function capabilitySet(origins: StyleOrigin[], text: boolean, nodeKind: SourceTarget["nodeKind"], dynamicClass: boolean): ElementCapabilities {
  const editable = origins.filter((origin) => origin.editable).map((origin) => origin.property)
  const layoutProperties = ["alignItems", "justifyContent", "alignSelf", "justifySelf", "gap", "order", "flexGrow", "flexShrink", "flexBasis", "gridTemplateColumns", "gridTemplateRows", "gridColumn", "gridRow"]
  return {
    preview: true,
    codeEdit: nodeKind !== "unknown",
    visualEdit: nodeKind === "native" && (text || editable.length > 0),
    text: nodeKind === "native" && text,
    spacing: editable.some((property) => ["padding", "paddingX", "paddingY", "margin", "gap"].includes(property)),
    color: editable.some((property) => ["backgroundColor", "color", "border"].includes(property)),
    typography: editable.some((property) => ["fontSize", "fontWeight"].includes(property)),
    size: editable.some((property) => ["width", "height", "maxWidth", "borderRadius"].includes(property)),
    layout: editable.some((property) => layoutProperties.includes(property)),
    reorder: editable.includes("order"),
  }
}

function componentFor(node: ts.JsxOpeningLikeElement, file: string, source: ts.SourceFile) {
  const name = jsxName(node)
  return isNative(name) ? undefined : { name, file, range: { start: node.getStart(source), end: node.getEnd() } }
}

export function analyzeReactSource(file: string, code: string, readSource: ReadSource, options: { tailwind?: boolean } = {}): SourceTarget[] {
  const source = parsedSource(file, code)
  const targets: SourceTarget[] = []
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const name = jsxName(node)
      const nodeKind = isNative(name) ? "native" as const : "component" as const
      const identity: SourceIdentity = { file, elementStart: node.getStart(source) }
      const classInfo = staticClassInfo(node)
      const text = ts.isJsxOpeningElement(node) && nodeKind === "native" ? staticTextRange(node, source) : undefined
      let origins = nodeKind === "native" ? [...inlineStyleOrigins(node, source), ...(options.tailwind === false ? [] : tailwindOrigins(node, source, classInfo)), ...stylesheetOrigins(file, code, classInfo, readSource)] : []
      const dynamicClass = Boolean(getAttribute(node, "className") && !classInfo.static)
      const attributeNames = node.attributes.properties.filter(ts.isJsxAttribute).map(attribute => attribute.name.getText(source))
      const spread = node.attributes.properties.some(ts.isJsxSpreadAttribute) || new Set(attributeNames).size !== attributeNames.length
      if (spread) origins = []
      // Multiple candidates for one property/prefix are ambiguous; do not pick the first.
      origins = origins.map(origin => ({ ...origin, editable: origin.editable && origins.filter(other => other.property === origin.property && other.prefix === origin.prefix && other.media === origin.media).length === 1 }))
      const capabilities = capabilitySet(origins, Boolean(text) && !spread, nodeKind, dynamicClass)
      const unavailableReasons: SourceTarget["unavailableReasons"] = {}
      if (dynamicClass) { unavailableReasons.visualEdit = "Dynamic className expressions are preview and code-only until their branches can be proven static."; unavailableReasons.spacing = unavailableReasons.visualEdit }
      if (nodeKind === "component") unavailableReasons.visualEdit = "This is a component boundary. Select rendered child DOM inside it to edit a safe source target."
      if (nodeKind === "native" && !text && !origins.length && !dynamicClass) unavailableReasons.visualEdit = "No static text or style origin was found for this rendered element."
      let ownerComponent: string | undefined, repeated = false
      for (let parent: ts.Node | undefined = node.parent; parent; parent = parent.parent) {
        if (ts.isCallExpression(parent) && parent.arguments.some(argument => (ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)) && argument.pos <= node.pos && argument.end >= node.end)) repeated = true
        if (ts.isFunctionDeclaration(parent) && parent.name) ownerComponent = parent.name.text
        if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) ownerComponent = parent.name.text
      }
      const target: SourceTarget = { classNames: classInfo.classNames, ownerComponent, repeated, identity, elementName: name, nodeKind, sourceRange: { start: node.getStart(source), end: node.getEnd() }, textRange: text?.range, text: text?.text, textEncoding: text && "encoding" in text ? text.encoding : undefined, styleOrigins: origins, capabilities, compatibility: "partial", unavailableReasons, component: componentFor(node, file, source) }
      const dynamicChildren = !text && ts.isJsxOpeningElement(node) && ts.isJsxElement(node.parent) && node.parent.children.some(child => ts.isJsxExpression(child) && child.expression)
      target.reasonCodes = [
        ...(dynamicClass ? ["dynamic-class-expression"] : []),
        ...(dynamicChildren ? ["runtime-generated-children"] : []),
        ...(nodeKind === "component" ? ["component-boundary"] : []),
        ...(spread ? ["jsx-spread-props"] : []),
        ...(nodeKind === "native" && getAttribute(node, "className") && !origins.length ? ["unresolved-style-source"] : []),
        ...(origins.some(origin => !origin.editable) ? ["ambiguous-style-source"] : []),
      ]
      if (spread) unavailableReasons.visualEdit = "JSX spread props can override source properties."
      if (dynamicChildren) unavailableReasons.text = "Runtime-generated children cannot be edited as static JSX text."
      target.compatibility = deriveCompatibility(target.capabilities)
      if (target.capabilities.visualEdit && (target.reasonCodes.length > 0)) target.compatibility = "partial"
      targets.push(target)
    }
    // Fragments are intentionally traversed, not emitted as targets: they do not
    // render a selectable DOM box. Their children retain their real source ids.
    ts.forEachChild(node, visit)
  }
  visit(source)
  return targets
}

export function instrumentReactSource(file: string, code: string) {
  const source = parsedSource(file, code)
  const insertions: Array<{ position: number; value: string }> = []
  const visit = (node: ts.Node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && isNative(jsxName(node)) && !getAttribute(node, "data-wcb-id")) {
      insertions.push({ position: node.tagName.end, value: ` data-wcb-id="${encodeSourceIdentity({ file, elementStart: node.getStart(source) })}"` })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return insertions.sort((a, b) => b.position - a.position).reduce((output, insertion) => `${output.slice(0, insertion.position)}${insertion.value}${output.slice(insertion.position)}`, code)
}
