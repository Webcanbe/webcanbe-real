export type SourceRange = { start: number; end: number }

export type SourceIdentity = {
  file: string
  elementStart: number
  revisionId?: string
  contentHash?: string
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
  | "boxShadow"
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
  | "minWidth"
  | "minHeight"
  | "maxHeight"
  | "flexDirection"
  | "display"
  | "lineHeight"
  | "letterSpacing"

export type StyleOriginKind = "inline" | "css" | "css-module" | "tailwind" | "inherited" | "default" | "unknown"

export type StyleOrigin = {
  property: StyleProperty
  kind: StyleOriginKind
  editable: boolean
  file?: string
  range?: SourceRange
  value?: string
  /** Optional parsed scalar metadata; value remains the authoritative source text. */
  numericValue?: number | null
  /** Parsed unit, or "number" for unitless; null/absent for tokens and expressions. */
  unit?: string | null
  reason?: string
  selector?: string
  prefix?: string
  media?: string
  active?: boolean
  effective?: boolean
  scope?: string
  usageCount?: number
  shared?: boolean
  valueOrigin?: string
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
  classNames?: string[]
  ownerComponent?: string
  repeated?: boolean
  effectScope?: string
  reorder?: { previous?: number; next?: number; parentStart: number }
  elementName: string
  nodeKind: SourceNodeKind
  sourceRange: SourceRange
  textFile?: string
  textShared?: boolean
  textRange?: SourceRange
  textEncoding?: "js-string"
  reasonCodes?: string[]
  text?: string
  styleOrigins: StyleOrigin[]
  capabilities: ElementCapabilities
  compatibility: CompatibilityKind
  unavailableReasons: Partial<Record<keyof ElementCapabilities, string>>
  component?: { name: string; file: string; range: SourceRange; definitionName?: string; resolved?: boolean }
  propOrigin?: {name:string;localName:string;file:string;range:SourceRange}
  invocationOrigins?: Array<{file:string;range:SourceRange}>
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
  editType: "text" | "style" | "layout" | "responsive" | "code" | "ai" | "revert" | "redo" | "checkpoint"
  before: string
  after: string
  target: SourceIdentity
  patches: SourcePatch[]
  versions?: Record<string, { before: string; after: string }>
  groupId?: string
  viewport?: ViewportPreset
  success: boolean
  error?: string
  projectId?: string
  baseRevisionId?: string
  newRevisionId?: string
  idempotencyKey?: string
  requestHash?: string
  producer?: "visual" | "code" | "ai" | "system"
  actor?: string
  summary?: string
  status?: "accepted" | "rejected"
  operations?: FileOperation[]
  fileStates?: Array<{ file: string; before: string | null; after: string | null }>
  validation?: SourceValidation
  restoresRevisionId?: string
  reverts?: string
}

export type FileOperation =
  | { kind: "update"; file: string; expectedHash: string; content: string }
  | { kind: "create"; file: string; expectedHash: null; content: string }
  | { kind: "delete"; file: string; expectedHash: string }
  | { kind: "rename"; file: string; to: string; expectedHash: string; content?: string }

export type SourceValidation = { level: "parse" | "compile" | "checkpoint" | "semantic"; passed: boolean; diagnostics: Array<{ file: string; message: string; line?: number; column?: number }> }
export type SourceRevision = { revisionId: string; projectId: string; parentRevisionId: string | null; createdAt: string; actor: string; producer: "visual" | "code" | "ai" | "system"; contentHash: string; transactionId?: string }
export type SourceImportOrigin = Readonly<{ provider: "github"; repository: string; commit: string; archiveSha256: string }>
export type ReleaseOrigin = Readonly<{
  entitlementId: string
  releaseId: string
  catalogProjectId: string
  sourceProjectId: string
  sourceRevisionId: string
  sourceContentHash: string
  releaseSnapshotHash: string
}>
export type HistoryArchive = Readonly<{ schema: 1; digest: string; rawBytes: number; revisions: number; transactions: number; data: string }>
export type RevisionLedger = { schema: 1; archives?: HistoryArchive[]; importOrigin?: SourceImportOrigin; releaseOrigin?: ReleaseOrigin; sourceScope?: 2; sourceDirectory?: string; projectId: string; revisions: SourceRevision[]; transactions: MutationTransaction[]; past: string[]; future: string[] }

export type CompatibilitySummary = {
  total: number
  full: number
  partial: number
  codeOnly: number
  score: number
}
