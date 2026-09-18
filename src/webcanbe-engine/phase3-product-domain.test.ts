import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { DatabaseSync } from "node:sqlite"
import { afterEach, describe, expect, it } from "vitest"
import { ZipFile } from "yazl"
import { contentHash, transactionEntry } from "./mutations/durableSource"
import { AuthorityDenied, SqliteAuthorityStore } from "./runtime/hostedAuthority"
import { ProductConflict, EntitlementUnavailable, ProductDomainStore } from "./runtime/productDomain"
import { ProjectRegistry } from "./runtime/projectRegistry"

const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }) })

async function archive(directory: string) {
  const zip = new ZipFile()
  for (const entry of fs.readdirSync(directory, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue
    const full = path.join(entry.parentPath, entry.name), name = path.relative(directory, full).split(path.sep).join("/")
    zip.addBuffer(fs.readFileSync(full), name)
  }
  zip.end()
  const chunks: Buffer[] = []
  for await (const chunk of zip.outputStream) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

async function foundation() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "wcb-phase3-"))); roots.push(root)
  const fixture = path.join(root, "fixtures", "compatible-react-vite")
  fs.mkdirSync(path.dirname(fixture), { recursive: true }); fs.cpSync("fixtures/compatible-react-vite", fixture, { recursive: true })
  const projects = new ProjectRegistry(root), authorityFile = path.join(root, "authority.sqlite"), productFile = path.join(root, "product.sqlite")
  const authority = new SqliteAuthorityStore(authorityFile), product = new ProductDomainStore(productFile, authority, projects)
  const userA = randomUUID(), userB = randomUUID(), workspaceA = randomUUID(), workspaceA2 = randomUUID(), workspaceB = randomUUID()
  authority.setWorkspaceMember(workspaceA, userA, "owner"); authority.setWorkspaceMember(workspaceA2, userA, "owner"); authority.setWorkspaceMember(workspaceB, userB, "owner")
  const a = authority.issueVerifiedSession(userA).session, b = authority.issueVerifiedSession(userB).session
  const source = await projects.importZip("Foundation source.zip", await archive(fixture)); authority.registerProject(a, workspaceA, source.id)
  const catalog = product.createCatalogProject(a, workspaceA, source.id, { slug: "studio-foundation", title: "Studio Foundation", summary: "An immutable editable project.", publicMetadata: { framework: "react-vite", demo: true } })
  const release = product.publishRelease(a, catalog.catalogProjectId, "1.0.0")
  const listing = product.saveListing(a, catalog.catalogProjectId, release.releaseId, { slug: "studio-foundation", title: "Studio Foundation", summary: "A real source project.", status: "published", availability: "available", tags: ["React", "Portfolio"], demoMetadata: { route: "/", viewport: "desktop" } })
  return { root, productFile, projects, authority, product, a, b, userA, userB, workspaceA, workspaceA2, workspaceB, source, catalog, release, listing }
}

describe("Phase 3 product-domain foundation", () => {
  it("browses and filters authoritative listings with exact listing -> release -> source lineage", async () => {
    const f = await foundation()
    expect(f.product.browse()).toHaveLength(1)
    expect(f.product.browse({ query: "real source", tags: ["react"] })[0]).toMatchObject({ listingId: f.listing.listingId, catalogProjectId: f.catalog.catalogProjectId, releaseId: f.release.releaseId, sourceRevisionId: f.release.sourceRevisionId, snapshotHash: f.release.snapshotHash })
    expect(f.product.browse({ tags: ["dashboard"] })).toEqual([])
    expect(f.product.listingDetail("studio-foundation")?.release).toEqual(f.release)
  })

  it("keeps ProjectRelease immutable while listing metadata changes independently", async () => {
    const f = await foundation(), before = f.product.listingDetail(f.listing.listingId)!.release
    f.product.saveListing(f.a, f.catalog.catalogProjectId, f.release.releaseId, { slug: "studio-foundation", title: "Renamed listing", summary: "Metadata changed without source mutation.", status: "published", availability: "available", tags: ["react"], demoMetadata: { route: "/demo" } })
    expect(f.product.listingDetail(f.listing.listingId)!.release).toEqual(before)
    const db = new DatabaseSync(f.productFile)
    try { expect(() => db.prepare("UPDATE project_releases SET version='forged' WHERE release_id=?").run(f.release.releaseId)).toThrow("ProjectRelease is immutable") } finally { db.close() }
  })

  it("requires a new release identity for a newly accepted source revision", async () => {
    const f = await foundation(), source = f.projects.durable(f.source.id), before = source.files().get("src/App.tsx")!, base = source.revision()
    const entry = transactionEntry(f.source.id, base, "code", randomUUID(), "release-v2", "Prepare release 2", { level: "parse", passed: true, diagnostics: [] }); entry.actor = f.userA
    source.commit({ expectedRevision: base, operations: [{ kind: "update", file: "src/App.tsx", expectedHash: contentHash(before), content: before + "\n// release two\n" }], entry, authorize: () => f.authority.grant(f.a, f.source.id, "code") })
    const next = f.product.publishRelease(f.a, f.catalog.catalogProjectId, "2.0.0")
    expect(next.releaseId).not.toBe(f.release.releaseId); expect(next.sourceRevisionId).not.toBe(f.release.sourceRevisionId); expect(next.snapshotHash).not.toBe(f.release.snapshotHash)
  })

  it("rechecks source and workspace authority after release snapshot capture", async () => {
    const f = await foundation(), capture = f.projects.immutableSnapshot.bind(f.projects)
    f.projects.immutableSnapshot = projectId => { const snapshot = capture(projectId); f.authority.setProjectMember(projectId, f.userA, null); return snapshot }
    expect(() => f.product.publishRelease(f.a, f.catalog.catalogProjectId, "revoked-during-capture")).toThrow(AuthorityDenied)
    const db = new DatabaseSync(f.productFile)
    try { expect((db.prepare("SELECT count(*) AS count FROM project_releases WHERE catalog_project_id=?").get(f.catalog.catalogProjectId) as { count: number }).count).toBe(1) } finally { db.close() }
  })

  it("creates one provider-agnostic entitlement idempotently and keeps Purchases separate from My Projects", async () => {
    const f = await foundation(), first = f.product.grantTestEntitlement(f.a, f.release.releaseId, "order-1"), replay = f.product.grantTestEntitlement(f.a, f.release.releaseId, "order-1"), duplicate = f.product.grantTestEntitlement(f.a, f.release.releaseId, "order-2")
    expect(replay).toEqual(first); expect(duplicate.entitlementId).toBe(first.entitlementId)
    expect(f.product.purchases(f.a)).toEqual([first]); expect(f.authority.projects(f.a)).toEqual([f.source.id])
  })

  it("materializes one entitlement into one owned editable WorkspaceProject idempotently", async () => {
    const f = await foundation(), entitlement = f.product.grantTestEntitlement(f.a, f.release.releaseId, "order-copy")
    const first = f.product.materialize(f.a, f.workspaceA, entitlement.entitlementId, "copy-1", "Owned studio"), repeated = f.product.materialize(f.a, f.workspaceA, entitlement.entitlementId, "copy-1", "Owned studio"), alternateRetry = f.product.materialize(f.a, f.workspaceA, entitlement.entitlementId, "copy-2", "Owned studio")
    expect(repeated).toEqual(first); expect(alternateRetry.workspaceProjectId).toBe(first.workspaceProjectId)
    expect(f.authority.grant(f.a, first.workspaceProjectId, "code")).toMatchObject({ userId: f.userA, workspaceId: f.workspaceA, role: "owner" })
    expect(f.product.purchases(f.a)).toHaveLength(1); expect(f.authority.projects(f.a)).toEqual(expect.arrayContaining([f.source.id, first.workspaceProjectId]))
  })

  it("retains exact release/source provenance and does not mutate the release after workspace edits", async () => {
    const f = await foundation(), entitlement = f.product.grantTestEntitlement(f.a, f.release.releaseId, "order-edit"), workspace = f.product.materialize(f.a, f.workspaceA, entitlement.entitlementId, "copy-edit")
    const sourceBefore = f.projects.immutableSnapshot(f.source.id), releaseBefore = f.product.listingDetail(f.listing.listingId)!.release, copy = f.projects.durable(workspace.workspaceProjectId), originBefore = copy.history().releaseOrigin
    expect(originBefore).toEqual({ entitlementId: entitlement.entitlementId, releaseId: f.release.releaseId, catalogProjectId: f.catalog.catalogProjectId, sourceProjectId: f.source.id, sourceRevisionId: f.release.sourceRevisionId, sourceContentHash: f.release.sourceContentHash, releaseSnapshotHash: f.release.snapshotHash })
    const before = copy.files().get("src/App.tsx")!, base = copy.revision(), entry = transactionEntry(workspace.workspaceProjectId, base, "code", randomUUID(), "workspace-edit", "Edit owned copy", { level: "parse", passed: true, diagnostics: [] }); entry.actor = f.userA
    copy.commit({ expectedRevision: base, operations: [{ kind: "update", file: "src/App.tsx", expectedHash: contentHash(before), content: before + "\n// owned edit\n" }], entry, authorize: () => f.authority.grant(f.a, workspace.workspaceProjectId, "code") })
    expect(copy.files().get("src/App.tsx")).toContain("owned edit")
    expect(copy.history().releaseOrigin).toEqual(originBefore)
    expect(f.projects.immutableSnapshot(f.source.id).files).toEqual(sourceBefore.files)
    expect(f.product.listingDetail(f.listing.listingId)!.release).toEqual(releaseBefore)
    expect(f.product.workspaceProject(f.a, workspace.workspaceProjectId)).toMatchObject({ sourceRevisionId: f.release.sourceRevisionId, releaseSnapshotHash: f.release.snapshotHash })
    expect(f.product.materialize(f.a, f.workspaceA, entitlement.entitlementId, "copy-after-edit").workspaceProjectId).toBe(workspace.workspaceProjectId)
  })

  it("denies a second user, an unowned workspace, guessed entitlement IDs and copied project IDs", async () => {
    const f = await foundation(), entitlement = f.product.grantTestEntitlement(f.a, f.release.releaseId, "order-authority"), workspace = f.product.materialize(f.a, f.workspaceA, entitlement.entitlementId, "copy-authority")
    expect(() => f.product.materialize(f.b, f.workspaceB, entitlement.entitlementId, "stolen-copy")).toThrow(AuthorityDenied)
    expect(() => f.product.materialize(f.a, f.workspaceB, entitlement.entitlementId, "cross-workspace")).toThrow(AuthorityDenied)
    expect(() => f.product.materialize(f.a, f.workspaceA2, entitlement.entitlementId, "other-owned-workspace")).toThrow(ProductConflict)
    expect(() => f.product.materialize(f.b, f.workspaceB, randomUUID(), "guessed-entitlement")).toThrow(AuthorityDenied)
    expect(() => f.authority.grant(f.b, workspace.workspaceProjectId, "inspect")).toThrow(AuthorityDenied)
    expect(() => f.product.workspaceProject(f.b, workspace.workspaceProjectId)).toThrow(AuthorityDenied)
  })

  it("refuses invalid or revoked entitlements explicitly", async () => {
    const revoked = await foundation(), revokedEntitlement = revoked.product.grantTestEntitlement(revoked.a, revoked.release.releaseId, "order-revoke")
    expect(() => revoked.product.revokeEntitlement(revoked.b, revokedEntitlement.entitlementId)).toThrow(EntitlementUnavailable)
    revoked.product.revokeEntitlement(revoked.a, revokedEntitlement.entitlementId)
    expect(revoked.product.purchases(revoked.a)[0]).toMatchObject({ entitlementId: revokedEntitlement.entitlementId, status: "revoked" })
    expect(() => revoked.product.materialize(revoked.a, revoked.workspaceA2, revokedEntitlement.entitlementId, "copy-revoked")).toThrow(EntitlementUnavailable)
    expect(() => revoked.product.revokeEntitlement(revoked.a, revokedEntitlement.entitlementId)).toThrow(EntitlementUnavailable)

    const invalid = await foundation(), invalidEntitlement = invalid.product.grantTestEntitlement(invalid.a, invalid.release.releaseId, "order-invalid")
    invalid.product.invalidateEntitlement(invalid.a, invalidEntitlement.entitlementId)
    expect(invalid.product.purchases(invalid.a)[0]).toMatchObject({ entitlementId: invalidEntitlement.entitlementId, status: "invalid" })
    expect(() => invalid.product.materialize(invalid.a, invalid.workspaceA2, invalidEntitlement.entitlementId, "copy-invalid")).toThrow(EntitlementUnavailable)
  })

  it("binds idempotency keys to one materialization request instead of treating them as authority", async () => {
    const f = await foundation(), entitlement = f.product.grantTestEntitlement(f.a, f.release.releaseId, "order-key")
    f.product.materialize(f.a, f.workspaceA, entitlement.entitlementId, "copy-key")
    expect(() => f.product.materialize(f.a, f.workspaceA2, entitlement.entitlementId, "copy-key")).toThrow(ProductConflict)
    expect(() => f.product.materialize(f.b, f.workspaceB, entitlement.entitlementId, "copy-key")).toThrow(AuthorityDenied)
  })
})
