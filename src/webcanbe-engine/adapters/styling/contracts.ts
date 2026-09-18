import type { SourceIdentity, StyleProperty } from "../../core/types"

export interface StylingAdapter {
  readonly id: string
  supports(property: StyleProperty): boolean
  canMutate(identity: SourceIdentity, property: StyleProperty): boolean
}
