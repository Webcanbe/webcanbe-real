import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createHash, randomBytes, randomUUID } from "node:crypto"
import { Readable } from "node:stream"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { Pool } from "pg"
import { DataType, newDb } from "pg-mem"
import { afterEach, describe, expect, it } from "vitest"
import { contentHash, transactionEntry } from "./mutations/durableSource"
import { DurableSource } from "./mutations/durableSource"
import { MutationHistory } from "./mutations/sourceMutations"
import { AuthorityDenied } from "./runtime/hostedAuthority"
import { HostedProductController } from "./runtime/hostedProductController"
import { PostgresIdentityStore, PostgresSessionBoundary } from "./runtime/postgresIdentity"
import { EntitlementUnavailable, ProductConflict } from "./runtime/productDomain"
import { PostgresProductDomainStore } from "./runtime/postgresProductDomain"
import { detectProject, type ProjectRecord } from "./runtime/projectRegistry"
import { withHostedSource } from "./runtime/postgresSourceCheckout"
import { PostgresAccess, PostgresProjectStore } from "./runtime/postgresStores"

const clean: Array<() => unknown | Promise<unknown>> = []
afterEach(async () => { for (const close of clean.splice(0).reverse()) await close() })

const schema = `
CREATE TABLE wcb_sessions(session_id uuid PRIMARY KEY,user_id uuid NOT NULL,expires_at timestamptz NOT NULL,active boolean NOT NULL DEFAULT true,token_hash text UNIQUE,csrf_hash text);
CREATE TABLE wcb_disabled_users(user_id uuid PRIMARY KEY);
CREATE TABLE wcb_identity_accounts(issuer text NOT NULL,subject text NOT NULL,user_id uuid NOT NULL,active boolean NOT NULL DEFAULT true,PRIMARY KEY(issuer,subject));
CREATE TABLE wcb_identity_lock(id integer PRIMARY KEY); INSERT INTO wcb_identity_lock VALUES(1);
CREATE TABLE wcb_workspace_members(workspace_id uuid NOT NULL,user_id uuid NOT NULL,role text NOT NULL,epoch bigint NOT NULL DEFAULT 1,active boolean NOT NULL DEFAULT true,PRIMARY KEY(workspace_id,user_id));
CREATE TABLE wcb_projects(project_id uuid PRIMARY KEY,workspace_id uuid NOT NULL,deleted boolean NOT NULL DEFAULT false,revision text,files jsonb,history jsonb,source_epoch bigint NOT NULL DEFAULT 0,name text NOT NULL DEFAULT 'Hosted project');
CREATE TABLE wcb_project_members(project_id uuid NOT NULL REFERENCES wcb_projects(project_id),user_id uuid NOT NULL,role text NOT NULL,epoch bigint NOT NULL DEFAULT 1,active boolean NOT NULL DEFAULT true,PRIMARY KEY(project_id,user_id));
CREATE TABLE wcb_catalog_projects(catalog_project_id uuid PRIMARY KEY,source_project_id uuid NOT NULL,owner_workspace_id uuid NOT NULL,created_by uuid NOT NULL,slug text NOT NULL UNIQUE,title text NOT NULL,summary text NOT NULL,status text NOT NULL,public_metadata jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE wcb_project_releases(release_id uuid PRIMARY KEY,catalog_project_id uuid NOT NULL REFERENCES wcb_catalog_projects(catalog_project_id),version text NOT NULL,status text NOT NULL,source_project_id uuid NOT NULL,source_revision_id text NOT NULL,source_content_hash text NOT NULL,snapshot_hash text NOT NULL,files jsonb NOT NULL,history jsonb NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(catalog_project_id,version),UNIQUE(catalog_project_id,release_id));
CREATE TABLE wcb_listings(listing_id uuid PRIMARY KEY,catalog_project_id uuid NOT NULL,release_id uuid NOT NULL,slug text NOT NULL UNIQUE,title text NOT NULL,summary text NOT NULL,status text NOT NULL,availability text NOT NULL,tags jsonb NOT NULL DEFAULT '[]',demo_metadata jsonb NOT NULL DEFAULT '{}',updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(catalog_project_id),FOREIGN KEY(catalog_project_id,release_id) REFERENCES wcb_project_releases(catalog_project_id,release_id));
CREATE TABLE wcb_license_entitlements(entitlement_id uuid PRIMARY KEY,user_id uuid NOT NULL,release_id uuid NOT NULL REFERENCES wcb_project_releases(release_id),provider text NOT NULL,provider_reference text NOT NULL UNIQUE,status text NOT NULL,granted_at timestamptz NOT NULL DEFAULT now(),revoked_at timestamptz,UNIQUE(user_id,release_id,provider));
CREATE TABLE wcb_product_operators(user_id uuid PRIMARY KEY,active boolean NOT NULL DEFAULT true,epoch bigint NOT NULL DEFAULT 1);
CREATE TABLE wcb_entitlement_materializations(entitlement_id uuid PRIMARY KEY REFERENCES wcb_license_entitlements(entitlement_id),workspace_id uuid NOT NULL,user_id uuid NOT NULL,workspace_project_id uuid NOT NULL UNIQUE,idempotency_key text NOT NULL,project_name text NOT NULL,status text NOT NULL,attempts integer NOT NULL DEFAULT 0,last_error text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,idempotency_key));
`

type User = { id: string; session: Readonly<{ sessionId: string; userId: string; expiresAt: number }>; token: string; csrf: string; cookie: string }
async function setup(faults: { afterMaterializationReservation?: () => Promise<void> } = {}) {
  const db = newDb({ autoCreateForeignKeyIndices: true })
  db.public.registerFunction({ name: "clock_timestamp", returns: DataType.timestamptz, impure: true, implementation: () => new Date() })
  db.public.registerFunction({ name: "date_trunc", args: [DataType.text, DataType.timestamptz], returns: DataType.timestamptz, implementation: (_part: string, value: Date) => new Date(Math.trunc(value.getTime())) })
  db.public.registerFunction({ name: "to_timestamp", args: [DataType.float], returns: DataType.timestamptz, implementation: (seconds: number) => new Date(seconds * 1000) })
  db.public.registerFunction({ name: "hashtextextended", args: [DataType.text, DataType.integer], returns: DataType.bigint, implementation: (value: string) => BigInt([...value].reduce((n, character) => (n * 31 + character.charCodeAt(0)) | 0, 7)) })
  db.public.registerFunction({ name: "pg_advisory_xact_lock", args: [DataType.bigint], returns: DataType.bool, impure: true, implementation: () => true })
  db.public.none(schema)
  const adapter = db.adapters.createPg(), pool = new adapter.Pool() as unknown as Pool
  clean.push(() => pool.end())
  const access = new PostgresAccess(pool), source = new PostgresProjectStore(access), identity = new PostgresIdentityStore(pool)
  const makeUser = async (): Promise<User> => {
    const id = randomUUID(), token = randomBytes(32).toString("base64url"), csrf = randomBytes(32).toString("base64url"), session = Object.freeze({ sessionId: randomUUID(), userId: id, expiresAt: Date.now() + 600_000 })
    await access.registerSession(session)
    const hash = (value: string) => createHash("sha256").update(value).digest("hex")
    await pool.query("UPDATE wcb_sessions SET token_hash=$2,csrf_hash=$3 WHERE session_id=$1", [session.sessionId, hash(token), hash(csrf)])
    return { id, session, token, csrf, cookie: `__Host-wcb-session=${token}` }
  }
  const operator = await makeUser(), a = await makeUser(), b = await makeUser()
  const workspaceA = randomUUID(), workspaceA2 = randomUUID(), workspaceB = randomUUID()
  await access.workspace(workspaceA, a.id, "owner"); await access.workspace(workspaceA2, a.id, "owner"); await access.workspace(workspaceB, b.id, "owner")
  const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "wcb-phase3-hosted-"))); clean.push(() => fs.rmSync(temporary, { recursive: true, force: true }))
  const projectRoot = path.join(temporary, "source"); fs.cpSync("fixtures/compatible-react-vite", projectRoot, { recursive: true })
  const sourceProjectId = randomUUID(), record: ProjectRecord = { id: sourceProjectId, name: "Hosted source", root: projectRoot, sourceRoot: path.join(projectRoot, "src"), imported: true, detection: detectProject(projectRoot, process.cwd()), history: new MutationHistory() }
  const durable = new DurableSource(record, path.join(temporary, "history"), { actor: a.id })
  const files = new Map<string, Buffer>(fs.readdirSync(projectRoot, { recursive: true, withFileTypes: true }).filter(entry => entry.isFile()).map(entry => { const full = path.join(entry.parentPath, entry.name); return [path.relative(projectRoot, full).split(path.sep).join("/"), fs.readFileSync(full)] }))
  await source.create(a.session, workspaceA, sourceProjectId, "Hosted source", files, durable.history())
  const product = new PostgresProductDomainStore(pool, access, source, faults); await product.provisionOperator(operator.id)
  const catalog = await product.createCatalogProject(a.session, workspaceA, sourceProjectId, { slug: "hosted-foundation", title: "Hosted Foundation", summary: "Immutable hosted source.", publicMetadata: { framework: "react-vite" } })
  const release = await product.publishRelease(a.session, catalog.catalogProjectId, "1.0.0")
  const listing = await product.saveListing(a.session, catalog.catalogProjectId, release.releaseId, { slug: "hosted-foundation", title: "Hosted Foundation", summary: "A real hosted project.", status: "published", availability: "available", tags: ["React", "Portfolio"], demoMetadata: { route: "/" } })
  return { db, pool, access, source, identity, operator, a, b, workspaceA, workspaceA2, workspaceB, sourceProjectId, product, catalog, release, listing }
}

const origins = { editorOrigin: "https://app.wcb-app.test", viewerOrigin: "https://viewer.wcb-preview.test", editorSite: "wcb-app.test", viewerSite: "wcb-preview.test" }
function httpRequest(user: Partial<User>, url: string, body: Record<string, unknown>) {
  const request = Readable.from([JSON.stringify(body)]) as IncomingMessage
  Object.assign(request, { method: "POST", url, headers: { host: "app.wcb-app.test", origin: origins.editorOrigin, "content-type": "application/json", ...(user.cookie ? { cookie: user.cookie } : {}), ...(user.csrf ? { "x-wcb-csrf": user.csrf } : {}) }, socket: { encrypted: true } })
  let status = 0, payload = ""
  const rawResponse: { headersSent: boolean; writeHead: (code: number) => unknown; end: (value?: string) => void; destroy: () => void } = { headersSent: false, writeHead: () => rawResponse, end: () => {}, destroy() {} }
  rawResponse.writeHead = (code: number) => { status = code; rawResponse.headersSent = true; return rawResponse }
  rawResponse.end = (value?: string) => { payload = value ?? ""; rawResponse.headersSent = true }
  const response = rawResponse as unknown as ServerResponse
  return { request, response, result: () => ({ status, body: payload ? JSON.parse(payload) : {} }) }
}

describe("Phase 3 hosted product persistence and HTTP controller", () => {
  it("persists catalog/listing/release lineage across store restart and declares release immutability in the hosted migration", async () => {
    const f = await setup(), restarted = new PostgresProductDomainStore(f.pool, f.access, f.source)
    expect((await restarted.browse({ query: "real hosted", tags: ["react"] }))[0]).toMatchObject({ listingId: f.listing.listingId, releaseId: f.release.releaseId, sourceRevisionId: f.release.sourceRevisionId, snapshotHash: f.release.snapshotHash })
    const detail = await restarted.listingDetail(f.listing.listingId); expect(detail?.release).toEqual(f.release)
    await restarted.saveListing(f.a.session, f.catalog.catalogProjectId, f.release.releaseId, { slug: "hosted-foundation", title: "Changed metadata", summary: "Listing-only change.", status: "published", availability: "available" })
    expect((await restarted.listingDetail(f.listing.listingId))?.release).toEqual(f.release)
    const migration = fs.readFileSync("deployment/hosted/postgres.sql", "utf8")
    expect(migration).toContain("wcb_immutable_project_release"); expect(migration).toContain("BEFORE UPDATE OR DELETE ON wcb_project_releases")
  })

  it("requires authenticated HTTP and ignores client attempts to self-assert operator authority", async () => {
    const f = await setup(), boundary = new PostgresSessionBoundary(f.identity, origins), controller = new HostedProductController(f.product, boundary)
    const unauthenticated = httpRequest({}, "/__webcanbe/api/product/catalog/browse", {})
    await controller.handle(unauthenticated.request, unauthenticated.response); expect(unauthenticated.result().status).toBe(403)
    const forged = httpRequest(f.a, "/__webcanbe/api/product/entitlements/test/grant", { beneficiaryUserId: f.a.id, releaseId: f.release.releaseId, idempotencyKey: "forged", operator: true })
    await controller.handle(forged.request, forged.response); expect(forged.result().status).toBe(403)
    const granted = httpRequest(f.operator, "/__webcanbe/api/product/entitlements/test/grant", { beneficiaryUserId: f.a.id, releaseId: f.release.releaseId, idempotencyKey: "http-grant" })
    await controller.handle(granted.request, granted.response); expect(granted.result()).toMatchObject({ status: 201, body: { entitlement: { userId: f.a.id, releaseId: f.release.releaseId, status: "active" } } })
  })

  it("makes TEST grant and transitions operator-only, unique, and idempotent", async () => {
    const f = await setup()
    await expect(f.product.grantTestEntitlement(f.a.session, f.a.id, f.release.releaseId, "self-grant")).rejects.toThrow(AuthorityDenied)
    const first = await f.product.grantTestEntitlement(f.operator.session, f.a.id, f.release.releaseId, "order-1"), replay = await f.product.grantTestEntitlement(f.operator.session, f.a.id, f.release.releaseId, "order-1"), duplicate = await f.product.grantTestEntitlement(f.operator.session, f.a.id, f.release.releaseId, "order-2")
    expect(replay).toEqual(first); expect(duplicate.entitlementId).toBe(first.entitlementId); expect(await f.product.purchases(f.a.session)).toEqual([first])
    await expect(f.product.transitionTestEntitlement(f.a.session, first.entitlementId, "revoked")).rejects.toThrow(AuthorityDenied)
    expect(await f.product.transitionTestEntitlement(f.operator.session, first.entitlementId, "revoked")).toMatchObject({ status: "revoked" })
    await expect(f.product.materialize(f.a.session, f.workspaceA, first.entitlementId, "revoked-copy")).rejects.toThrow(EntitlementUnavailable)
  })

  it("materializes one entitlement idempotently with exact provenance and cross-tenant refusal", async () => {
    const f = await setup(), entitlement = await f.product.grantTestEntitlement(f.operator.session, f.a.id, f.release.releaseId, "order-copy")
    const first = await f.product.materialize(f.a.session, f.workspaceA, entitlement.entitlementId, "copy-1", "Owned hosted project"), replay = await f.product.materialize(f.a.session, f.workspaceA, entitlement.entitlementId, "copy-1"), alternate = await f.product.materialize(f.a.session, f.workspaceA, entitlement.entitlementId, "copy-2")
    expect(replay.workspaceProjectId).toBe(first.workspaceProjectId); expect(alternate.workspaceProjectId).toBe(first.workspaceProjectId)
    await expect(f.product.materialize(f.b.session, f.workspaceB, entitlement.entitlementId, "stolen")).rejects.toThrow(AuthorityDenied)
    await expect(f.product.materialize(f.a.session, f.workspaceA2, entitlement.entitlementId, "other-workspace")).rejects.toThrow(ProductConflict)
    await expect(f.product.workspaceProject(f.b.session, first.workspaceProjectId)).rejects.toThrow(AuthorityDenied)
    const state = await f.source.read(await f.access.grant(f.a.session, first.workspaceProjectId, "source"))
    expect(state.history.releaseOrigin).toEqual({ entitlementId: entitlement.entitlementId, releaseId: f.release.releaseId, catalogProjectId: f.catalog.catalogProjectId, sourceProjectId: f.sourceProjectId, sourceRevisionId: f.release.sourceRevisionId, sourceContentHash: f.release.sourceContentHash, releaseSnapshotHash: f.release.snapshotHash })
  })

  it("keeps the immutable release unchanged after editing the hosted working copy", async () => {
    const f = await setup(), entitlement = await f.product.grantTestEntitlement(f.operator.session, f.a.id, f.release.releaseId, "order-edit"), workspace = await f.product.materialize(f.a.session, f.workspaceA, entitlement.entitlementId, "copy-edit")
    const releaseBefore = (await f.product.listingDetail(f.listing.listingId))!.release, grant = await f.access.grant(f.a.session, workspace.workspaceProjectId, "code")
    await withHostedSource(f.source, grant, process.cwd(), async (_project, source) => {
      const before = source.files().get("src/App.tsx")!, base = source.revision(), entry = transactionEntry(workspace.workspaceProjectId, base, "code", randomUUID(), "hosted-edit", "Edit working copy", { level: "parse", passed: true, diagnostics: [] }); entry.actor = f.a.id
      source.commit({ expectedRevision: base, operations: [{ kind: "update", file: "src/App.tsx", expectedHash: contentHash(before), content: before + "\n// hosted working edit\n" }], entry, authorize: () => {} })
    }, true)
    const edited = await f.source.read(grant); expect(edited.files.get("src/App.tsx")!.toString()).toContain("hosted working edit"); expect(edited.history.releaseOrigin?.sourceRevisionId).toBe(f.release.sourceRevisionId)
    expect((await f.product.listingDetail(f.listing.listingId))!.release).toEqual(releaseBefore)
    const releaseRow = (await f.pool.query("SELECT source_revision_id,snapshot_hash FROM wcb_project_releases WHERE release_id=$1", [f.release.releaseId])).rows[0]
    expect(releaseRow).toMatchObject({ source_revision_id: f.release.sourceRevisionId, snapshot_hash: f.release.snapshotHash })
  })

  it("reconciles a restart-stranded pending materialization exactly once", async () => {
    let fail = true
    const f = await setup({ afterMaterializationReservation: async () => { if (fail) { fail = false; throw new Error("simulated process stop") } } }), entitlement = await f.product.grantTestEntitlement(f.operator.session, f.a.id, f.release.releaseId, "order-restart")
    await expect(f.product.materialize(f.a.session, f.workspaceA, entitlement.entitlementId, "copy-restart")).rejects.toThrow("simulated process stop")
    const pending = (await f.pool.query("SELECT workspace_project_id,status FROM wcb_entitlement_materializations WHERE entitlement_id=$1", [entitlement.entitlementId])).rows[0]
    expect(pending.status).toBe("pending"); expect((await f.pool.query("SELECT project_id FROM wcb_projects WHERE project_id=$1", [pending.workspace_project_id])).rowCount).toBe(0)
    const restarted = new PostgresProductDomainStore(f.pool, f.access, f.source), reconciled = await restarted.reconcilePending(5)
    expect(reconciled).toMatchObject({ examined: 1, ready: 1, failed: 0, pending: 0 })
    const ready = await restarted.materialize(f.a.session, f.workspaceA, entitlement.entitlementId, "copy-restart")
    expect(ready.workspaceProjectId).toBe(String(pending.workspace_project_id)); expect((await f.pool.query("SELECT project_id FROM wcb_projects WHERE project_id=$1", [pending.workspace_project_id])).rowCount).toBe(1)
    expect(await restarted.reconcilePending(5)).toMatchObject({ examined: 0, pending: 0 })
  })

  it("fails reconciliation explicitly when workspace authority is revoked and allows a bounded same-request retry after restoration", async () => {
    let stop = true
    const f = await setup({ afterMaterializationReservation: async () => { if (stop) { stop = false; throw new Error("restart") } } }), entitlement = await f.product.grantTestEntitlement(f.operator.session, f.a.id, f.release.releaseId, "order-revoke-workspace")
    await expect(f.product.materialize(f.a.session, f.workspaceA, entitlement.entitlementId, "copy-authority")).rejects.toThrow("restart")
    await f.access.workspace(f.workspaceA, f.a.id, null)
    const restarted = new PostgresProductDomainStore(f.pool, f.access, f.source); expect(await restarted.reconcilePending()).toMatchObject({ failed: 1, pending: 0 })
    expect((await f.pool.query("SELECT status,last_error FROM wcb_entitlement_materializations WHERE entitlement_id=$1", [entitlement.entitlementId])).rows[0]).toMatchObject({ status: "failed", last_error: "workspace-authority-unavailable" })
    await f.access.workspace(f.workspaceA, f.a.id, "owner")
    const retried = await restarted.materialize(f.a.session, f.workspaceA, entitlement.entitlementId, "copy-authority")
    expect(retried.entitlementId).toBe(entitlement.entitlementId)
  })
})
