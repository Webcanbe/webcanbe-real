import { createHash, randomUUID } from "node:crypto"
import { DatabaseSync } from "node:sqlite"
import type { ReleaseOrigin, RevisionLedger } from "../core/types"
import { boundedHistory } from "../mutations/durableSource"
import { AuthorityDenied, requireOpaqueId, type ServerSession, type SqliteAuthorityStore } from "./hostedAuthority"
import { type ImmutableProjectSnapshot, ProjectRegistry } from "./projectRegistry"

export type CatalogProject = Readonly<{
  catalogProjectId: string
  sourceProjectId: string
  ownerWorkspaceId: string
  slug: string
  title: string
  summary: string
  status: "active" | "archived"
  publicMetadata: Record<string, unknown>
}>

export type ProjectRelease = Readonly<{
  releaseId: string
  catalogProjectId: string
  version: string
  status: "published"
  sourceProjectId: string
  sourceRevisionId: string
  sourceContentHash: string
  snapshotHash: string
  createdAt: string
}>

export type Listing = Readonly<{
  listingId: string
  catalogProjectId: string
  releaseId: string
  slug: string
  title: string
  summary: string
  status: "draft" | "published" | "archived"
  availability: "available" | "unavailable"
  tags: string[]
  demoMetadata: Record<string, unknown>
  updatedAt: string
}>

export type LicenseEntitlement = Readonly<{
  entitlementId: string
  userId: string
  releaseId: string
  provider: string
  providerReference: string
  status: "active" | "revoked" | "invalid"
  grantedAt: string
  revokedAt?: string
}>

export type WorkspaceProject = Readonly<{
  workspaceProjectId: string
  workspaceId: string
  entitlementId: string
  releaseId: string
  sourceProjectId: string
  sourceRevisionId: string
  sourceContentHash: string
  releaseSnapshotHash: string
  createdAt: string
}>

export type SellerApplication = Readonly<{
  applicationId: string
  userId: string
  status: "pending" | "approved" | "rejected"
  createdAt: string
  updatedAt: string
  decidedAt?: string
  decidedBy?: string
}>

export type SellerSubmission = Readonly<{
  submissionId: string
  sellerApplicationId: string
  sellerUserId: string
  workspaceId: string
  sourceProjectId: string
  sourceRevisionId: string
  sourceContentHash: string
  snapshotHash: string
  status: "pending_review"
  createdAt: string
  updatedAt: string
}>

export type SellerReviewDecision = Readonly<{
  decisionId: string
  submissionId: string
  sellerApplicationId: string
  sellerUserId: string
  sourceProjectId: string
  sourceRevisionId: string
  sourceContentHash: string
  snapshotHash: string
  decision: "approved_for_next_stage" | "rejected"
  decidedBy: string
  createdAt: string
}>

export type SellerQuarantineItem = Readonly<{
  submissionId: string
  sellerApplicationId: string
  sellerUserId: string
  sourceProjectId: string
  sourceRevisionId: string
  sourceContentHash: string
  snapshotHash: string
  status: "pending_review" | SellerReviewDecision["decision"]
  submittedAt: string
  updatedAt: string
  decision?: SellerReviewDecision
}>

export type SellerAssessmentRequest = Readonly<{
  assessmentRequestId: string
  submissionId: string
  sellerUserId: string
  sourceProjectId: string
  sourceRevisionId: string
  sourceContentHash: string
  snapshotHash: string
  reviewDecisionId: string
  status: "requested"
  createdAt: string
}>

export type AssessmentWorkerAuthority = Readonly<{
  workerId: string
  credential: string
}>

export type AssessmentJobLease = Readonly<{
  assessmentJobId: string
  submissionId: string
  sellerUserId: string
  sourceProjectId: string
  sourceRevisionId: string
  sourceContentHash: string
  snapshotHash: string
  workerId: string
  generation: string
  claimedAt: string
  leaseExpiresAt: string
  state: "leased"
}>

export class ProductConflict extends Error {}
export class EntitlementUnavailable extends Error {}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex")
const identifier = (value: string, label: string) => { requireOpaqueId(value); return value }
const cleanText = (value: string, label: string, maximum: number) => {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maximum || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) throw new Error(`Invalid ${label}.`)
  return value.trim()
}
const cleanSlug = (value: string) => {
  const slug = cleanText(value, "slug", 100).toLowerCase()
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Invalid slug.")
  return slug
}
const cleanKey = (value: string) => {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value)) throw new Error("Invalid idempotency key.")
  return value
}
const jsonObject = (value: Record<string, unknown> | undefined, label: string) => {
  const encoded = JSON.stringify(value ?? {})
  if (encoded.length > 8192) throw new Error(`${label} exceeds its limit.`)
  const parsed = JSON.parse(encoded)
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error(`Invalid ${label}.`)
  return parsed as Record<string, unknown>
}
const cleanTags = (values: string[] | undefined) => {
  if (!values) return []
  if (!Array.isArray(values) || values.length > 20) throw new Error("Invalid listing tags.")
  const tags = [...new Set(values.map(value => cleanText(value, "tag", 40).toLowerCase()))]
  return tags.sort()
}
const encodeFiles = (files: Map<string, Buffer>) => [...files].sort(([a], [b]) => a.localeCompare(b)).map(([file, bytes]) => [file, bytes.toString("base64")] as const)
const immutableSnapshotHash = (snapshot: ImmutableProjectSnapshot) => sha256(JSON.stringify({
  projectId: snapshot.projectId,
  revisionId: snapshot.revisionId,
  contentHash: snapshot.contentHash,
  files: encodeFiles(snapshot.files),
  history: snapshot.history
}))

type ReleaseRow = Record<string, unknown> & {
  release_id: string; catalog_project_id: string; version: string; status: "published"; source_project_id: string
  source_revision_id: string; source_content_hash: string; snapshot_hash: string; files_json: string; history_json: string; created_at: string
}

const releaseFrom = (row: ReleaseRow): ProjectRelease => Object.freeze({
  releaseId: row.release_id, catalogProjectId: row.catalog_project_id, version: row.version, status: row.status,
  sourceProjectId: row.source_project_id, sourceRevisionId: row.source_revision_id,
  sourceContentHash: row.source_content_hash, snapshotHash: row.snapshot_hash, createdAt: row.created_at
})

/** First Phase-3 backend slice. SQLite is the retained single-host server store;
 * source bytes and editable revisions continue to use ProjectRegistry/DurableSource.
 * IDs are references only: every private operation rechecks the server session,
 * workspace membership and project membership through SqliteAuthorityStore. */
export class ProductDomainStore {
  private readonly db: DatabaseSync
  constructor(file: string, private readonly authority: SqliteAuthorityStore, private readonly projects: ProjectRegistry, private readonly now = () => new Date()) {
    this.db = new DatabaseSync(file)
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=1000;
      CREATE TABLE IF NOT EXISTS catalog_projects (
        catalog_project_id TEXT PRIMARY KEY, source_project_id TEXT NOT NULL, owner_workspace_id TEXT NOT NULL, created_by TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, summary TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('active','archived')),
        public_metadata TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS project_releases (
        release_id TEXT PRIMARY KEY, catalog_project_id TEXT NOT NULL REFERENCES catalog_projects, version TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status='published'), source_project_id TEXT NOT NULL, source_revision_id TEXT NOT NULL,
        source_content_hash TEXT NOT NULL CHECK(length(source_content_hash)=64), snapshot_hash TEXT NOT NULL CHECK(length(snapshot_hash)=64),
        files_json TEXT NOT NULL, history_json TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL,
        UNIQUE(catalog_project_id,version), UNIQUE(catalog_project_id,release_id)
      );
      CREATE TRIGGER IF NOT EXISTS immutable_project_release_update BEFORE UPDATE ON project_releases BEGIN SELECT RAISE(ABORT,'ProjectRelease is immutable'); END;
      CREATE TRIGGER IF NOT EXISTS immutable_project_release_delete BEFORE DELETE ON project_releases BEGIN SELECT RAISE(ABORT,'ProjectRelease is immutable'); END;
      CREATE TABLE IF NOT EXISTS listings (
        listing_id TEXT PRIMARY KEY, catalog_project_id TEXT NOT NULL, release_id TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL, summary TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('draft','published','archived')),
        availability TEXT NOT NULL CHECK(availability IN ('available','unavailable')), tags TEXT NOT NULL, demo_metadata TEXT NOT NULL,
        updated_at TEXT NOT NULL, UNIQUE(catalog_project_id), FOREIGN KEY(catalog_project_id,release_id) REFERENCES project_releases(catalog_project_id,release_id)
      );
      CREATE TABLE IF NOT EXISTS license_entitlements (
        entitlement_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, release_id TEXT NOT NULL REFERENCES project_releases,
        provider TEXT NOT NULL, provider_reference TEXT NOT NULL UNIQUE, status TEXT NOT NULL CHECK(status IN ('active','revoked','invalid')),
        granted_at TEXT NOT NULL, revoked_at TEXT, UNIQUE(user_id,release_id,provider)
      );
      CREATE TABLE IF NOT EXISTS entitlement_materializations (
        entitlement_id TEXT NOT NULL REFERENCES license_entitlements, workspace_id TEXT NOT NULL, user_id TEXT NOT NULL,
        workspace_project_id TEXT NOT NULL UNIQUE, idempotency_key TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','ready')),
        created_at TEXT NOT NULL, PRIMARY KEY(entitlement_id), UNIQUE(user_id,idempotency_key)
      );`)
  }

  close() { this.db.close() }
  private timestamp() { return this.now().toISOString() }
  private session(session: ServerSession) { if (!this.authority.active(session)) throw new AuthorityDenied(); return session }

  createCatalogProject(session: ServerSession, workspaceId: string, sourceProjectId: string, input: { slug: string; title: string; summary: string; publicMetadata?: Record<string, unknown> }): CatalogProject {
    this.session(session); identifier(workspaceId, "workspace"); identifier(sourceProjectId, "source project")
    this.authority.requireWorkspace(session, workspaceId)
    const grant = this.authority.grant(session, sourceProjectId, "source")
    if (grant.workspaceId !== workspaceId) throw new AuthorityDenied()
    const record: CatalogProject = Object.freeze({ catalogProjectId: randomUUID(), sourceProjectId, ownerWorkspaceId: workspaceId, slug: cleanSlug(input.slug), title: cleanText(input.title, "title", 200), summary: cleanText(input.summary, "summary", 2000), status: "active", publicMetadata: jsonObject(input.publicMetadata, "public metadata") })
    this.db.prepare("INSERT INTO catalog_projects VALUES(?,?,?,?,?,?,?,?,?,?)").run(record.catalogProjectId, sourceProjectId, workspaceId, session.userId, record.slug, record.title, record.summary, record.status, JSON.stringify(record.publicMetadata), this.timestamp())
    return record
  }

  publishRelease(session: ServerSession, catalogProjectId: string, version: string): ProjectRelease {
    this.session(session); identifier(catalogProjectId, "catalog project")
    const catalog = this.db.prepare("SELECT * FROM catalog_projects WHERE catalog_project_id=? AND status='active'").get(catalogProjectId)
    if (!catalog) throw new AuthorityDenied()
    this.authority.requireWorkspace(session, String(catalog.owner_workspace_id))
    const sourceProjectId = String(catalog.source_project_id), grant = this.authority.grant(session, sourceProjectId, "source")
    if (grant.workspaceId !== String(catalog.owner_workspace_id)) throw new AuthorityDenied()
    const snapshot = this.projects.immutableSnapshot(sourceProjectId), snapshotHash = immutableSnapshotHash(snapshot), createdAt = this.timestamp(), releaseId = randomUUID()
    const cleanVersion = cleanText(version, "release version", 100)
    if (!this.authority.check(grant, "source")) throw new AuthorityDenied()
    this.authority.requireWorkspace(session, String(catalog.owner_workspace_id))
    this.db.prepare("INSERT INTO project_releases VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run(releaseId, catalogProjectId, cleanVersion, "published", sourceProjectId, snapshot.revisionId, snapshot.contentHash, snapshotHash, JSON.stringify(encodeFiles(snapshot.files)), JSON.stringify(snapshot.history), session.userId, createdAt)
    return Object.freeze({ releaseId, catalogProjectId, version: cleanVersion, status: "published", sourceProjectId, sourceRevisionId: snapshot.revisionId, sourceContentHash: snapshot.contentHash, snapshotHash, createdAt })
  }

  saveListing(session: ServerSession, catalogProjectId: string, releaseId: string, input: { slug: string; title: string; summary: string; status: Listing["status"]; availability: Listing["availability"]; tags?: string[]; demoMetadata?: Record<string, unknown> }): Listing {
    this.session(session); identifier(catalogProjectId, "catalog project"); identifier(releaseId, "release")
    const catalog = this.db.prepare("SELECT owner_workspace_id FROM catalog_projects WHERE catalog_project_id=?").get(catalogProjectId)
    if (!catalog) throw new AuthorityDenied()
    this.authority.requireWorkspace(session, String(catalog.owner_workspace_id))
    const release = this.db.prepare("SELECT release_id FROM project_releases WHERE release_id=? AND catalog_project_id=?").get(releaseId, catalogProjectId)
    if (!release) throw new ProductConflict("Listing release does not belong to its catalog project.")
    if (!(["draft", "published", "archived"] as string[]).includes(input.status) || !(["available", "unavailable"] as string[]).includes(input.availability)) throw new Error("Invalid listing state.")
    const prior = this.db.prepare("SELECT listing_id FROM listings WHERE catalog_project_id=?").get(catalogProjectId)
    const listing: Listing = Object.freeze({ listingId: prior ? String(prior.listing_id) : randomUUID(), catalogProjectId, releaseId, slug: cleanSlug(input.slug), title: cleanText(input.title, "listing title", 200), summary: cleanText(input.summary, "listing summary", 2000), status: input.status, availability: input.availability, tags: cleanTags(input.tags), demoMetadata: jsonObject(input.demoMetadata, "demo metadata"), updatedAt: this.timestamp() })
    this.db.prepare(`INSERT INTO listings VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(catalog_project_id) DO UPDATE SET
      release_id=excluded.release_id,slug=excluded.slug,title=excluded.title,summary=excluded.summary,status=excluded.status,
      availability=excluded.availability,tags=excluded.tags,demo_metadata=excluded.demo_metadata,updated_at=excluded.updated_at`).run(listing.listingId, catalogProjectId, releaseId, listing.slug, listing.title, listing.summary, listing.status, listing.availability, JSON.stringify(listing.tags), JSON.stringify(listing.demoMetadata), listing.updatedAt)
    return listing
  }

  browse(input: { query?: string; tags?: string[]; limit?: number } = {}) {
    const query = input.query?.trim().toLowerCase() ?? "", tags = cleanTags(input.tags), limit = Math.min(Math.max(input.limit ?? 24, 1), 100)
    if (query.length > 100) throw new Error("Search query is too long.")
    const rows = this.db.prepare(`SELECT l.*,r.version,r.source_revision_id,r.snapshot_hash,c.public_metadata FROM listings l
      JOIN project_releases r ON r.release_id=l.release_id JOIN catalog_projects c ON c.catalog_project_id=l.catalog_project_id
      WHERE l.status='published' AND l.availability='available' AND c.status='active' ORDER BY l.updated_at DESC`).all()
    return rows.map(row => this.publicListing(row)).filter(item => (!query || `${item.title} ${item.summary} ${item.slug} ${item.tags.join(" ")}`.toLowerCase().includes(query)) && tags.every(tag => item.tags.includes(tag))).slice(0, limit)
  }

  listingDetail(reference: string) {
    const row = this.db.prepare(`SELECT l.*,r.version,r.status AS release_status,r.source_project_id,r.source_revision_id,r.source_content_hash,r.snapshot_hash,r.created_at AS release_created_at,c.public_metadata
      FROM listings l JOIN project_releases r ON r.release_id=l.release_id JOIN catalog_projects c ON c.catalog_project_id=l.catalog_project_id
      WHERE (l.listing_id=? OR l.slug=?) AND l.status='published' AND c.status='active'`).get(reference, reference)
    if (!row) return undefined
    return Object.freeze({ ...this.publicListing(row), release: Object.freeze({ releaseId: String(row.release_id), catalogProjectId: String(row.catalog_project_id), version: String(row.version), status: row.release_status, sourceProjectId: String(row.source_project_id), sourceRevisionId: String(row.source_revision_id), sourceContentHash: String(row.source_content_hash), snapshotHash: String(row.snapshot_hash), createdAt: String(row.release_created_at) }) as ProjectRelease, publicMetadata: JSON.parse(String(row.public_metadata)) as Record<string, unknown> })
  }

  private publicListing(row: Record<string, unknown>): Listing & { releaseVersion: string; sourceRevisionId: string; snapshotHash: string } {
    return Object.freeze({ listingId: String(row.listing_id), catalogProjectId: String(row.catalog_project_id), releaseId: String(row.release_id), slug: String(row.slug), title: String(row.title), summary: String(row.summary), status: row.status as Listing["status"], availability: row.availability as Listing["availability"], tags: JSON.parse(String(row.tags)) as string[], demoMetadata: JSON.parse(String(row.demo_metadata)) as Record<string, unknown>, updatedAt: String(row.updated_at), releaseVersion: String(row.version), sourceRevisionId: String(row.source_revision_id), snapshotHash: String(row.snapshot_hash) })
  }

  /** Trusted TEST-provider seam. A future payment adapter may call the same
   * provider/reference contract after verification; browsers must not choose userId. */
  grantTestEntitlement(session: ServerSession, releaseId: string, idempotencyKey: string): LicenseEntitlement {
    this.session(session); identifier(releaseId, "release"); const key = cleanKey(idempotencyKey), provider = "test", providerReference = `test:${session.userId}:${key}`
    const available = this.db.prepare(`SELECT r.release_id FROM project_releases r JOIN listings l ON l.release_id=r.release_id
      WHERE r.release_id=? AND r.status='published' AND l.status='published' AND l.availability='available'`).get(releaseId)
    if (!available) throw new EntitlementUnavailable("Release is not currently available.")
    const byReference = this.db.prepare("SELECT * FROM license_entitlements WHERE provider_reference=?").get(providerReference)
    if (byReference) {
      if (String(byReference.user_id) !== session.userId || String(byReference.release_id) !== releaseId) throw new ProductConflict("Idempotency key was already used for a different entitlement.")
      return this.entitlement(byReference)
    }
    const existing = this.db.prepare("SELECT * FROM license_entitlements WHERE user_id=? AND release_id=? AND provider=?").get(session.userId, releaseId, provider)
    if (existing) return this.entitlement(existing)
    const entitlementId = randomUUID(), grantedAt = this.timestamp()
    this.db.prepare("INSERT INTO license_entitlements VALUES(?,?,?,?,?,'active',?,NULL)").run(entitlementId, session.userId, releaseId, provider, providerReference, grantedAt)
    return Object.freeze({ entitlementId, userId: session.userId, releaseId, provider, providerReference, status: "active", grantedAt })
  }

  revokeEntitlement(session: ServerSession, entitlementId: string) {
    this.transitionEntitlement(session, entitlementId, "revoked")
  }

  invalidateEntitlement(session: ServerSession, entitlementId: string) {
    this.transitionEntitlement(session, entitlementId, "invalid")
  }

  private transitionEntitlement(session: ServerSession, entitlementId: string, status: "revoked" | "invalid") {
    this.session(session); identifier(entitlementId, "entitlement"); const revokedAt = this.timestamp()
    const result = this.db.prepare("UPDATE license_entitlements SET status=?,revoked_at=? WHERE entitlement_id=? AND user_id=? AND status='active'").run(status, revokedAt, entitlementId, session.userId)
    if (!result.changes) throw new EntitlementUnavailable("Entitlement is not active.")
  }

  purchases(session: ServerSession) {
    this.session(session)
    return this.db.prepare("SELECT * FROM license_entitlements WHERE user_id=? ORDER BY granted_at DESC").all(session.userId).map(row => this.entitlement(row))
  }

  materialize(session: ServerSession, workspaceId: string, entitlementId: string, idempotencyKey: string, name = "Purchased project"): WorkspaceProject {
    this.session(session); identifier(workspaceId, "workspace"); identifier(entitlementId, "entitlement"); const key = cleanKey(idempotencyKey)
    this.authority.requireWorkspace(session, workspaceId)
    const reused = this.db.prepare("SELECT * FROM entitlement_materializations WHERE user_id=? AND idempotency_key=?").get(session.userId, key)
    if (reused && (String(reused.entitlement_id) !== entitlementId || String(reused.workspace_id) !== workspaceId)) throw new ProductConflict("Idempotency key was already used for a different materialization.")
    const entitlement = this.db.prepare(`SELECT e.entitlement_id,e.user_id,e.release_id,e.provider,e.provider_reference,e.status AS entitlement_status,e.granted_at,e.revoked_at,
      r.catalog_project_id,r.version,r.status,r.source_project_id,r.source_revision_id,r.source_content_hash,r.snapshot_hash,r.files_json,r.history_json,r.created_at
      FROM license_entitlements e JOIN project_releases r ON r.release_id=e.release_id
      WHERE e.entitlement_id=? AND e.user_id=?`).get(entitlementId, session.userId) as ReleaseRow & Record<string, unknown> | undefined
    if (!entitlement) throw new AuthorityDenied()
    if (entitlement.entitlement_status !== "active") throw new EntitlementUnavailable(`Entitlement is ${String(entitlement.entitlement_status)}.`)
    let materialization = reused ?? this.db.prepare("SELECT * FROM entitlement_materializations WHERE entitlement_id=?").get(entitlementId)
    if (materialization && String(materialization.workspace_id) !== workspaceId) throw new ProductConflict("Entitlement was already materialized into a different workspace.")
    if (!materialization) {
      const workspaceProjectId = randomUUID(), createdAt = this.timestamp()
      this.db.prepare("INSERT INTO entitlement_materializations VALUES(?,?,?,?,?,'pending',?)").run(entitlementId, workspaceId, session.userId, workspaceProjectId, key, createdAt)
      materialization = this.db.prepare("SELECT * FROM entitlement_materializations WHERE entitlement_id=?").get(entitlementId)!
    }
    if (String(materialization.user_id) !== session.userId) throw new AuthorityDenied()
    const snapshot = this.decodeRelease(entitlement), release = releaseFrom(entitlement)
    const origin: ReleaseOrigin = Object.freeze({ entitlementId, releaseId: release.releaseId, catalogProjectId: release.catalogProjectId, sourceProjectId: release.sourceProjectId, sourceRevisionId: release.sourceRevisionId, sourceContentHash: release.sourceContentHash, releaseSnapshotHash: release.snapshotHash })
    const workspaceProjectId = String(materialization.workspace_project_id)
    if (materialization.status === "ready") {
      const grant = this.authority.grant(session, workspaceProjectId, "inspect")
      if (grant.workspaceId !== workspaceId) throw new AuthorityDenied()
      return Object.freeze({ workspaceProjectId, workspaceId, entitlementId, releaseId: release.releaseId, sourceProjectId: release.sourceProjectId, sourceRevisionId: release.sourceRevisionId, sourceContentHash: release.sourceContentHash, releaseSnapshotHash: release.snapshotHash, createdAt: String(materialization.created_at) })
    }
    this.projects.materializeRelease(workspaceProjectId, cleanText(name, "workspace project name", 200), snapshot, origin, session.userId)
    this.authority.registerProject(session, workspaceId, workspaceProjectId)
    this.db.prepare("UPDATE entitlement_materializations SET status='ready' WHERE entitlement_id=?").run(entitlementId)
    return Object.freeze({ workspaceProjectId, workspaceId, entitlementId, releaseId: release.releaseId, sourceProjectId: release.sourceProjectId, sourceRevisionId: release.sourceRevisionId, sourceContentHash: release.sourceContentHash, releaseSnapshotHash: release.snapshotHash, createdAt: String(materialization.created_at) })
  }

  workspaceProject(session: ServerSession, workspaceProjectId: string): WorkspaceProject | undefined {
    this.session(session); identifier(workspaceProjectId, "workspace project"); const grant = this.authority.grant(session, workspaceProjectId, "inspect")
    const row = this.db.prepare(`SELECT m.*,e.release_id,r.source_project_id,r.source_revision_id,r.source_content_hash,r.snapshot_hash
      FROM entitlement_materializations m JOIN license_entitlements e ON e.entitlement_id=m.entitlement_id JOIN project_releases r ON r.release_id=e.release_id
      WHERE m.workspace_project_id=? AND m.workspace_id=? AND m.status='ready'`).get(workspaceProjectId, grant.workspaceId)
    return row ? Object.freeze({ workspaceProjectId, workspaceId: String(row.workspace_id), entitlementId: String(row.entitlement_id), releaseId: String(row.release_id), sourceProjectId: String(row.source_project_id), sourceRevisionId: String(row.source_revision_id), sourceContentHash: String(row.source_content_hash), releaseSnapshotHash: String(row.snapshot_hash), createdAt: String(row.created_at) }) : undefined
  }

  private decodeRelease(row: ReleaseRow): ImmutableProjectSnapshot {
    const history = JSON.parse(row.history_json) as RevisionLedger; boundedHistory(history)
    const files = new Map<string, Buffer>((JSON.parse(row.files_json) as Array<[string, string]>).map(([file, encoded]) => [file, Buffer.from(encoded, "base64")]))
    const snapshot: ImmutableProjectSnapshot = Object.freeze({ projectId: row.source_project_id, revisionId: row.source_revision_id, contentHash: row.source_content_hash, files, history })
    if (history.projectId !== row.source_project_id || history.revisions.at(-1)?.revisionId !== row.source_revision_id || history.revisions.at(-1)?.contentHash !== row.source_content_hash || immutableSnapshotHash(snapshot) !== row.snapshot_hash) throw new Error("Stored release snapshot integrity failed.")
    return snapshot
  }

  private entitlement(row: Record<string, unknown>): LicenseEntitlement {
    return Object.freeze({ entitlementId: String(row.entitlement_id), userId: String(row.user_id), releaseId: String(row.release_id), provider: String(row.provider), providerReference: String(row.provider_reference), status: row.status as LicenseEntitlement["status"], grantedAt: String(row.granted_at), ...(row.revoked_at ? { revokedAt: String(row.revoked_at) } : {}) })
  }
}
