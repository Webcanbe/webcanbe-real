import type { SourceTarget } from "../core/types"

export type SourceReader = (file: string) => string | undefined

/**
 * Framework code stays behind this boundary. The editor core only consumes
 * source targets and never needs to know how JSX, SFCs, or HTML are parsed.
 */
export interface FrameworkAdapter {
  readonly id: string
  analyze(file: string, source: string, readSource: SourceReader): SourceTarget[]
  instrument?(file: string, source: string): string
}
