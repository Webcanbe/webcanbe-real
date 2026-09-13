export type SourceRange = { start: number; end: number }

export type SourceIdentity = {
  file: string
  elementStart: number
}

export type LayoutContext = "block" | "flex" | "grid" | "positioned" | "unknown"

export type SourceNodeKind = "native" | "component" | "fragment" | "dynamic" | "unknown"
export type ViewportPreset = "mobile" | "tablet" | "desktop"

export type StyleProperty =
  | "backgroundColor"
  | "color"
  | "fontSize"
  | "fontWeight"
  | "padding"
  | "paddingX"
  | "paddingY"
  | "margin"
  | "gap"
  | "width"
  | "height"
  | "border"
  | "borderRadius"
  | "alignItems"
  | "justifyContent"
  | "alignSelf"
  | "justifySelf"
  | "order"
  | "flexGrow"
  | "flexShrink"
  | "flexBasis"
  | "gridTemplateColumns"
  | "gridTemplateRows"
  | "gridColumn"
  | "gridRow"
  | "maxWidth"

export type StyleOriginKind = "inline" | "css" | "css-module" | "tailwind" | "inherited" | "default" | "unknown"

export type StyleOrigin = {
  property: StyleProperty
  kind: StyleOriginKind
  editable: boolean
  file?: string
  range?: SourceRange
  value?: string
  reason?: string
  selector?: string
  prefix?: string
}

export type ElementCapabilities = {
  preview: boolean
  codeEdit: boolean
  visualEdit: boolean
  text: boolean
  spacing: boolean
  color: boolean
  typography: boolean
  size: boolean
  layout: boolean
  reorder: boolean
}

export type CompatibilityKind = "full" | "partial" | "code-only"

export type SourceTarget = {
  identity: SourceIdentity
  elementName: string
  nodeKind: SourceNodeKind
  sourceRange: SourceRange
  textRange?: SourceRange
  textEncoding?: "js-string"
  reasonCodes?: string[]
  text?: string
  styleOrigins: StyleOrigin[]
  capabilities: ElementCapabilities
  compatibility: CompatibilityKind
  unavailableReasons: Partial<Record<keyof ElementCapabilities, string>>
  component?: { name: string; file: string; range: SourceRange }
}

export type PreviewElement = {
  identity: SourceIdentity
  tagName: string
  rect: { top: number; left: number; width: number; height: number }
  computed: Record<string, string>
  parentIdentity?: SourceIdentity
  layoutContext: LayoutContext
  parentLayoutContext?: LayoutContext
}

export type SourcePatch = {
  file: string
  range: SourceRange
  before: string
  after: string
}

export type MutationTransaction = {
  id: string
  timestamp: string
  file: string
  range: SourceRange
  editType: "text" | "style" | "layout" | "responsive"
  before: string
  after: string
  target: SourceIdentity
  patches: SourcePatch[]
  versions?: Record<string, { before: string; after: string }>
  groupId?: string
  viewport?: ViewportPreset
  success: boolean
  error?: string
}

export type CompatibilitySummary = {
  total: number
  full: number
  partial: number
  codeOnly: number
  score: number
}
