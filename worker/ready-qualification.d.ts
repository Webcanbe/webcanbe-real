export type ReadyCompatibility = Readonly<{
  total: number
  full: number
  partial: number
  codeOnly: number
  score: number
}>

export type DerivedReleaseReadiness = Readonly<{
  compatibility: ReadyCompatibility
  status: "ready" | "partial" | "code_only"
  reasons: string[]
}>

export function deriveReleaseReadiness(row: Record<string, unknown>): DerivedReleaseReadiness
