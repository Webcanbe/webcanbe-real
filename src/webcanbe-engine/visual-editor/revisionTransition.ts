export type RevisionState = { revision: string; connection: number; baseRevision?: string }

/** Revision IDs are opaque. Only the initiating state can accept this response. */
export function acceptsRevisionTransition(current: RevisionState, initiated: RevisionState | undefined) {
  return Boolean(initiated && current.connection === initiated.connection &&
    (current.revision === initiated.revision || current.revision === initiated.baseRevision))
}
