export type SourceRange = { start: number; end: number }

export type SourceIdentity = {
  file: string
  elementStart: number
}

export type LayoutContext = "block" | "flex" | "grid" | "positioned" | "unknown"

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

export type StyleOriginKind = "inline" | "css" | "css-module" | "tailwind" | "inherited" | "default" | "unknown"

export type StyleOrigin = {
  property: StyleProperty
  kind: StyleOriginKind
  editable: boolean
  file?: string
  range?: SourceRange
  value?: string
  reason?: string
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
  sourceRange: SourceRange
  textRange?: SourceRange
  text?: string
  styleOrigins: StyleOrigin[]
  capabilities: ElementCapabilities
  compatibility: CompatibilityKind
}

export type PreviewElement = {
  identity: SourceIdentity
  tagName: string
  rect: { top: number; left: number; width: number; height: number }
  computed: Record<string, string>
  parentIdentity?: SourceIdentity
  layoutContext: LayoutContext
}

export type MutationTransaction = {
  id: string
  timestamp: string
  file: string
  range: SourceRange
  editType: "text" | "style"
  before: string
  after: string
  target: SourceIdentity
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
