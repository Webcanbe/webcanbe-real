export function canonicalJson(value: unknown): string

export function releaseSnapshotHash(value: {
  projectId: string
  revisionId: string
  contentHash: string
  files: readonly (readonly [string, string])[]
  history: unknown
}): string
