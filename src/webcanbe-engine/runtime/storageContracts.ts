import { DatabaseSync } from "node:sqlite"
import { createHash } from "node:crypto"
import type { DurableSource } from "../mutations/durableSource"
import type { ProjectRecord } from "./projectRegistry"
import type { ProjectGrant, MembershipStore } from "./hostedAuthority"
import { AuthorityDenied } from "./hostedAuthority"
import type { PreviewSnapshot } from "./controlledPreview"

/** The local adapter deliberately keeps source + journal + history in one commit
 * domain. A hosted adapter must supply the same CAS/recovery semantics, not split
 * a source write and a history write across independently committed services. */
export type ProjectSourceStore = Pick<DurableSource, "files" | "revision" | "head" | "assertBase" | "prepare" | "lease" | "commit">
export type RevisionHistoryStore = Pick<DurableSource, "history" | "retry" | "revertOperations" | "reject">
export type ProjectPersistence = ProjectSourceStore & RevisionHistoryStore
export type ProjectStoreFactory = (project: ProjectRecord) => ProjectPersistence
export type ArtifactReference = Readonly<{ workspaceId: string; projectId: string; revision: string; generation: string; digest: string }>
export interface ArtifactStore {
  put(grant: ProjectGrant, reference: ArtifactReference, snapshot: PreviewSnapshot): void
  get(grant: ProjectGrant, reference: ArtifactReference): PreviewSnapshot
  remove(grant: ProjectGrant, reference: ArtifactReference): void
  /** Trusted controller garbage collection, including after membership revocation. */
  retire(reference: ArtifactReference): void
}
const snapshotDigest = (snapshot: PreviewSnapshot) => createHash("sha256").update(JSON.stringify({ html: snapshot.html, files: snapshot.files })).digest("hex")
/** Actual local blob backend, keyed by the complete ownership tuple. No bucket
 * key, filesystem path or digest alone is a read capability. */
export class SqliteArtifactStore implements ArtifactStore {
  private readonly db: DatabaseSync
  constructor(file: string, private readonly memberships: MembershipStore) {
    this.db = new DatabaseSync(file)
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=1000;
      CREATE TABLE IF NOT EXISTS artifacts (workspace TEXT, project TEXT, revision TEXT, generation TEXT, digest TEXT, payload TEXT NOT NULL, PRIMARY KEY(workspace,project,revision,generation,digest));`)
  }
  close() { this.db.close() }
  private authorize(grant: ProjectGrant, ref: ArtifactReference) {
    if (!this.memberships.check(grant, "preview") || grant.workspaceId !== ref.workspaceId || grant.projectId !== ref.projectId || !/^[a-f0-9]{64}$/.test(ref.digest)) throw new AuthorityDenied()
  }
  private key(ref: ArtifactReference) { return [ref.workspaceId, ref.projectId, ref.revision, ref.generation, ref.digest] }
  put(grant: ProjectGrant, ref: ArtifactReference, snapshot: PreviewSnapshot) {
    this.authorize(grant, ref)
    const payload = JSON.stringify(snapshot)
    if (snapshot.digest !== ref.digest || snapshotDigest(snapshot) !== ref.digest || Buffer.byteLength(payload) > 48 * 1024 * 1024) throw new Error("Artifact digest or size mismatch.")
    this.db.exec("BEGIN IMMEDIATE")
    try {
      this.authorize(grant, ref)
      const existing = this.db.prepare("SELECT payload FROM artifacts WHERE workspace=? AND project=? AND revision=? AND generation=? AND digest=?").get(...this.key(ref))
      if (existing && existing.payload !== payload) throw new Error("Immutable artifact conflict.")
      if (!existing && Number(this.db.prepare("SELECT count(*) AS count FROM artifacts WHERE workspace=?").get(ref.workspaceId)!.count) >= 16) throw new Error("Workspace artifact capacity reached.")
      this.db.prepare("INSERT OR IGNORE INTO artifacts VALUES(?,?,?,?,?,?)").run(...this.key(ref), payload)
      this.db.exec("COMMIT")
    } catch (error) { this.db.exec("ROLLBACK"); throw error }
  }
  get(grant: ProjectGrant, ref: ArtifactReference): PreviewSnapshot {
    this.authorize(grant, ref)
    const row = this.db.prepare("SELECT payload FROM artifacts WHERE workspace=? AND project=? AND revision=? AND generation=? AND digest=?").get(...this.key(ref))
    if (!row) throw new AuthorityDenied()
    const snapshot: PreviewSnapshot = JSON.parse(String(row.payload))
    if (snapshot.digest !== ref.digest || snapshotDigest(snapshot) !== ref.digest) throw new Error("Stored artifact integrity failed.")
    this.authorize(grant, ref)
    return snapshot
  }
  retire(ref: ArtifactReference) { this.db.prepare("DELETE FROM artifacts WHERE workspace=? AND project=? AND revision=? AND generation=? AND digest=?").run(...this.key(ref)) }
  remove(grant: ProjectGrant, ref: ArtifactReference) { this.authorize(grant, ref); this.db.prepare("DELETE FROM artifacts WHERE workspace=? AND project=? AND revision=? AND generation=? AND digest=?").run(...this.key(ref)) }
}
