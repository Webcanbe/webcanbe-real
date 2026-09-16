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
CREATE TABLE wcb_seller_applications(application_id uuid PRIMARY KEY,user_id uuid NOT NULL UNIQUE,status text NOT NULL,decision_by uuid,decided_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE wcb_seller_submissions(submission_id uuid PRIMARY KEY,seller_application_id uuid NOT NULL REFERENCES wcb_seller_applications(application_id),seller_user_id uuid NOT NULL,workspace_id uuid NOT NULL,source_project_id uuid NOT NULL REFERENCES wcb_projects(project_id),source_revision_id text NOT NULL,source_content_hash text NOT NULL,snapshot_hash text NOT NULL,files jsonb NOT NULL,history jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(seller_application_id,source_project_id,source_revision_id));
CREATE TABLE wcb_seller_submission_states(submission_id uuid PRIMARY KEY REFERENCES wcb_seller_submissions(submission_id),status text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE wcb_seller_review_decisions(decision_id uuid PRIMARY KEY,submission_id uuid NOT NULL UNIQUE REFERENCES wcb_seller_submissions(submission_id),seller_application_id uuid NOT NULL,seller_user_id uuid NOT NULL,source_project_id uuid NOT NULL,source_revision_id text NOT NULL,source_content_hash text NOT NULL,submission_snapshot_hash text NOT NULL,decision text NOT NULL,reviewer_user_id uuid NOT NULL,idempotency_key text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(reviewer_user_id,idempotency_key));
CREATE TABLE wcb_seller_assessment_requests(assessment_request_id uuid PRIMARY KEY,submission_id uuid NOT NULL UNIQUE REFERENCES wcb_seller_submissions(submission_id),seller_user_id uuid NOT NULL,source_project_id uuid NOT NULL,source_revision_id text NOT NULL,source_content_hash text NOT NULL,submission_snapshot_hash text NOT NULL,review_decision_id uuid NOT NULL UNIQUE REFERENCES wcb_seller_review_decisions(decision_id),status text NOT NULL,admitted_by uuid NOT NULL,idempotency_key text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(admitted_by,idempotency_key));
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
  it("wires authenticated catalog, operator TEST purchase, idempotent materialization, My Projects, and tenant isolation", async () => {
    const f = await setup(), boundary = new PostgresSessionBoundary(f.identity, origins), controller = new HostedProductController(f.product, boundary)
    const call = async (user: Partial<User>, action: string, body: Record<string, unknown>) => {
      const exchange = httpRequest(user, `/__webcanbe/api/product${action}`, body)
      await controller.handle(exchange.request, exchange.response)
      return exchange.result()
    }

    expect(await call({}, "/catalog/browse", {})).toMatchObject({ status: 403 })
    expect(await call(f.a, "/catalog/browse", { query: "hosted", tags: ["react"] })).toMatchObject({ status: 200, body: { listings: [{ listingId: f.listing.listingId, releaseId: f.release.releaseId }] } })
    expect(await call(f.a, "/entitlements/test/grant-self", { releaseId: f.release.releaseId, idempotencyKey: "route-grant" })).toMatchObject({ status: 403 })

    await f.product.provisionOperator(f.a.id)
    const grant = await call(f.a, "/entitlements/test/grant-self", { releaseId: f.release.releaseId, idempotencyKey: "route-grant" })
    expect(grant).toMatchObject({ status: 201, body: { entitlement: { userId: f.a.id, releaseId: f.release.releaseId, status: "active" } } })
    const entitlementId = grant.body.entitlement.entitlementId as string
    const input = { workspaceId: f.workspaceA, entitlementId, idempotencyKey: "route-copy", name: "Route copy" }
    const first = await call(f.a, "/workspace-projects/materialize", input), replay = await call(f.a, "/workspace-projects/materialize", input)
    expect(replay.body.workspaceProject.workspaceProjectId).toBe(first.body.workspaceProject.workspaceProjectId)
    expect(first.body.workspaceProject).toMatchObject({ entitlementId, releaseId: f.release.releaseId, sourceProjectId: f.sourceProjectId, sourceRevisionId: f.release.sourceRevisionId, sourceContentHash: f.release.sourceContentHash, releaseSnapshotHash: f.release.snapshotHash })
    expect(await call(f.a, "/workspace-projects/list", {})).toMatchObject({ status: 200, body: { workspaceProjects: [{ workspaceProjectId: first.body.workspaceProject.workspaceProjectId }] } })
    expect(await call(f.b, "/workspace-projects/list", {})).toEqual({ status: 200, body: { workspaceProjects: [] } })
    expect(await call(f.b, "/workspace-projects/get", { workspaceProjectId: first.body.workspaceProject.workspaceProjectId })).toMatchObject({ status: 403 })
    expect(await call(f.b, "/workspace-projects/materialize", { ...input, workspaceId: f.workspaceB, idempotencyKey: "stolen-copy" })).toMatchObject({ status: 403 })
  })

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

describe("Phase 3 seller intake", () => {
  const controllerFor = async () => {
    const f = await setup(), controller = new HostedProductController(f.product, new PostgresSessionBoundary(f.identity, origins))
    const call = async (user: Partial<User>, action: string, body: Record<string, unknown> = {}) => {
      const exchange = httpRequest(user, `/__webcanbe/api/product${action}`, body)
      await controller.handle(exchange.request, exchange.response)
      return exchange.result()
    }
    return { ...f, call }
  }

  it("keeps seller application pending until an operator explicitly approves or rejects it", async () => {
    const f = await controllerFor()
    expect(await f.call({}, "/seller/applications/apply")).toMatchObject({ status: 403 })
    const pending = await f.call(f.a, "/seller/applications/apply")
    expect(pending).toMatchObject({ status: 201, body: { application: { userId: f.a.id, status: "pending" } } })
    const applicationId = pending.body.application.applicationId as string
    expect(await f.call(f.a, "/seller/applications/transition", { applicationId, status: "approved" })).toMatchObject({ status: 403 })
    expect(await f.call(f.operator, "/seller/applications/transition", { applicationId, status: "approved" })).toMatchObject({ status: 200, body: { application: { userId: f.a.id, status: "approved", decidedBy: f.operator.id } } })
    const rejected = await f.call(f.b, "/seller/applications/apply"), rejectedId = rejected.body.application.applicationId as string
    expect(await f.call(f.operator, "/seller/applications/transition", { applicationId: rejectedId, status: "rejected" })).toMatchObject({ status: 200, body: { application: { userId: f.b.id, status: "rejected" } } })
    expect(await f.call(f.b, "/seller/applications/get")).toMatchObject({ status: 200, body: { application: { status: "rejected" } } })
  })

  it("allows only the approved application owner to submit and refuses rejected sellers", async () => {
    const f = await controllerFor(), aPending = await f.call(f.a, "/seller/applications/apply"), bPending = await f.call(f.b, "/seller/applications/apply")
    const aId = aPending.body.application.applicationId as string, bId = bPending.body.application.applicationId as string
    const input = { sellerApplicationId: aId, workspaceId: f.workspaceA, sourceProjectId: f.sourceProjectId }
    expect(await f.call(f.a, "/seller/submissions/create", input)).toMatchObject({ status: 403 })
    await f.call(f.operator, "/seller/applications/transition", { applicationId: aId, status: "approved" })
    await f.call(f.operator, "/seller/applications/transition", { applicationId: bId, status: "approved" })
    expect(await f.call(f.a, "/seller/submissions/create", { ...input, sellerApplicationId: bId })).toMatchObject({ status: 403 })
    expect(await f.call(f.b, "/seller/submissions/create", { ...input, sellerApplicationId: aId, workspaceId: f.workspaceB })).toMatchObject({ status: 403 })
    const submitted = await f.call(f.a, "/seller/submissions/create", input)
    expect(submitted).toMatchObject({ status: 201, body: { submission: { sellerApplicationId: aId, sellerUserId: f.a.id, sourceProjectId: f.sourceProjectId, status: "pending_review" } } })
    expect(await f.call(f.a, "/seller/submissions/list")).toMatchObject({ status: 200, body: { submissions: [{ submissionId: submitted.body.submission.submissionId }] } })
    expect(await f.call(f.b, "/seller/submissions/list")).toEqual({ status: 200, body: { submissions: [] } })
    await f.call(f.operator, "/seller/applications/transition", { applicationId: aId, status: "rejected" })
    expect(await f.call(f.a, "/seller/submissions/create", input)).toMatchObject({ status: 403 })
  })

  it("freezes exact submitted source provenance and requires a new submission for a later revision", async () => {
    const f = await controllerFor(), pending = await f.product.applySeller(f.a.session)
    await f.product.transitionSellerApplication(f.operator.session, pending.applicationId, "approved")
    const first = await f.product.createSellerSubmission(f.a.session, pending.applicationId, f.workspaceA, f.sourceProjectId)
    const storedBefore = (await f.pool.query("SELECT source_revision_id,source_content_hash,snapshot_hash,files,history FROM wcb_seller_submissions WHERE submission_id=$1", [first.submissionId])).rows[0]
    expect(first).toMatchObject({ sourceRevisionId: f.release.sourceRevisionId, sourceContentHash: f.release.sourceContentHash, snapshotHash: f.release.snapshotHash, status: "pending_review" })
    const grant = await f.access.grant(f.a.session, f.sourceProjectId, "code")
    await withHostedSource(f.source, grant, process.cwd(), async (_project, source) => {
      const before = source.files().get("src/App.tsx")!, base = source.revision(), entry = transactionEntry(f.sourceProjectId, base, "code", randomUUID(), "seller-edit", "Edit after submission", { level: "parse", passed: true, diagnostics: [] }); entry.actor = f.a.id
      source.commit({ expectedRevision: base, operations: [{ kind: "update", file: "src/App.tsx", expectedHash: contentHash(before), content: `${before}\n// later seller revision\n` }], entry, authorize: () => {} })
    }, true)
    const storedAfter = (await f.pool.query("SELECT source_revision_id,source_content_hash,snapshot_hash,files,history FROM wcb_seller_submissions WHERE submission_id=$1", [first.submissionId])).rows[0]
    expect(storedAfter).toEqual(storedBefore)
    const second = await f.product.createSellerSubmission(f.a.session, pending.applicationId, f.workspaceA, f.sourceProjectId)
    expect(second.submissionId).not.toBe(first.submissionId); expect(second.sourceRevisionId).not.toBe(first.sourceRevisionId); expect(second.snapshotHash).not.toBe(first.snapshotHash)
    const migration = fs.readFileSync("deployment/hosted/postgres.sql", "utf8")
    expect(migration).toContain("wcb_immutable_seller_submission"); expect(migration).toContain("BEFORE UPDATE OR DELETE ON wcb_seller_submissions")
  })

  it("keeps submissions quarantined and creates no public product or entitlement implicitly", async () => {
    const f = await controllerFor(), pending = await f.product.applySeller(f.a.session)
    await f.product.transitionSellerApplication(f.operator.session, pending.applicationId, "approved")
    const count = async (table: string) => Number((await f.pool.query(`SELECT count(*) AS n FROM ${table}`)).rows[0].n)
    const before = { catalog: await count("wcb_catalog_projects"), releases: await count("wcb_project_releases"), listings: await count("wcb_listings"), entitlements: await count("wcb_license_entitlements") }
    const submission = await f.product.createSellerSubmission(f.a.session, pending.applicationId, f.workspaceA, f.sourceProjectId)
    expect(submission.status).toBe("pending_review")
    expect(await f.product.browse()).toHaveLength(1)
    expect({ catalog: await count("wcb_catalog_projects"), releases: await count("wcb_project_releases"), listings: await count("wcb_listings"), entitlements: await count("wcb_license_entitlements") }).toEqual(before)
    expect((await f.pool.query("SELECT status FROM wcb_seller_submission_states WHERE submission_id=$1", [submission.submissionId])).rows[0].status).toBe("pending_review")
  })
})

describe("Phase 3 seller quarantine review", () => {
  const reviewedFixture = async () => {
    const f = await setup(), controller = new HostedProductController(f.product, new PostgresSessionBoundary(f.identity, origins))
    const call = async (user: Partial<User>, action: string, body: Record<string, unknown> = {}) => {
      const exchange = httpRequest(user, `/__webcanbe/api/product${action}`, body)
      await controller.handle(exchange.request, exchange.response)
      return exchange.result()
    }
    const application = await f.product.applySeller(f.a.session)
    await f.product.transitionSellerApplication(f.operator.session, application.applicationId, "approved")
    const submission = await f.product.createSellerSubmission(f.a.session, application.applicationId, f.workspaceA, f.sourceProjectId)
    return { ...f, call, application, submission }
  }

  const advanceSource = async (f: Awaited<ReturnType<typeof reviewedFixture>>, label: string) => {
    const grant = await f.access.grant(f.a.session, f.sourceProjectId, "code")
    await withHostedSource(f.source, grant, process.cwd(), async (_project, source) => {
      const before = source.files().get("src/App.tsx")!, base = source.revision(), entry = transactionEntry(f.sourceProjectId, base, "code", randomUUID(), `review-${label}`, `Review ${label}`, { level: "parse", passed: true, diagnostics: [] }); entry.actor = f.a.id
      source.commit({ expectedRevision: base, operations: [{ kind: "update", file: "src/App.tsx", expectedHash: contentHash(before), content: `${before}\n// ${label}\n` }], entry, authorize: () => {} })
    }, true)
    return f.product.createSellerSubmission(f.a.session, f.application.applicationId, f.workspaceA, f.sourceProjectId)
  }

  it("exposes metadata-only quarantine list and inspect paths only to active operators", async () => {
    const f = await reviewedFixture()
    expect(await f.call(f.a, "/seller/review/queue")).toMatchObject({ status: 403 })
    expect(await f.call(f.b, "/seller/review/inspect", { submissionId: f.submission.submissionId })).toMatchObject({ status: 403 })
    const queued = await f.call(f.operator, "/seller/review/queue")
    expect(queued).toMatchObject({ status: 200, body: { submissions: [{ submissionId: f.submission.submissionId, sellerUserId: f.a.id, sourceRevisionId: f.submission.sourceRevisionId, snapshotHash: f.submission.snapshotHash, status: "pending_review" }] } })
    expect(queued.body.submissions[0]).not.toHaveProperty("files"); expect(queued.body.submissions[0]).not.toHaveProperty("history"); expect(queued.body.submissions[0]).not.toHaveProperty("workspaceId")
    expect(await f.call(f.operator, "/seller/review/inspect", { submissionId: f.submission.submissionId })).toMatchObject({ status: 200, body: { submission: { sourceContentHash: f.submission.sourceContentHash, status: "pending_review" } } })
    await f.product.provisionOperator(f.operator.id, false)
    expect(await f.call(f.operator, "/seller/review/queue")).toMatchObject({ status: 403 })
  })

  it("requires operator authority and binds each immutable decision to the exact submitted snapshot", async () => {
    const f = await reviewedFixture(), input = { submissionId: f.submission.submissionId, snapshotHash: f.submission.snapshotHash, decision: "approved_for_next_stage", idempotencyKey: "decision-a" }
    expect(await f.call(f.a, "/seller/review/decisions/create", input)).toMatchObject({ status: 403 })
    expect(await f.call(f.b, "/seller/review/decisions/create", { ...input, reviewer: true })).toMatchObject({ status: 403 })
    expect(await f.call(f.operator, "/seller/review/decisions/create", { ...input, snapshotHash: "0".repeat(64) })).toMatchObject({ status: 409 })
    const decided = await f.call(f.operator, "/seller/review/decisions/create", input)
    expect(decided).toMatchObject({ status: 201, body: { decision: { submissionId: f.submission.submissionId, sellerApplicationId: f.application.applicationId, sellerUserId: f.a.id, sourceRevisionId: f.submission.sourceRevisionId, sourceContentHash: f.submission.sourceContentHash, snapshotHash: f.submission.snapshotHash, decision: "approved_for_next_stage", decidedBy: f.operator.id } } })
  })

  it("handles identical decisions idempotently and refuses rewrite or cross-submission reuse", async () => {
    const f = await reviewedFixture(), input = { submissionId: f.submission.submissionId, snapshotHash: f.submission.snapshotHash, decision: "approved_for_next_stage" as const, idempotencyKey: "immutable-a" }
    const first = await f.product.createSellerReviewDecision(f.operator.session, input.submissionId, input.snapshotHash, input.decision, input.idempotencyKey)
    expect(await f.product.createSellerReviewDecision(f.operator.session, input.submissionId, input.snapshotHash, input.decision, input.idempotencyKey)).toEqual(first)
    expect(await f.product.createSellerReviewDecision(f.operator.session, input.submissionId, input.snapshotHash, input.decision, "same-decision-new-key")).toEqual(first)
    await expect(f.product.createSellerReviewDecision(f.operator.session, input.submissionId, input.snapshotHash, "rejected", "rewrite")).rejects.toThrow(ProductConflict)
    const second = await advanceSource(f, "second submitted snapshot")
    await expect(f.product.createSellerReviewDecision(f.operator.session, second.submissionId, f.submission.snapshotHash, "rejected", "wrong-snapshot")).rejects.toThrow(ProductConflict)
    await expect(f.product.createSellerReviewDecision(f.operator.session, second.submissionId, second.snapshotHash, "rejected", input.idempotencyKey)).rejects.toThrow(ProductConflict)
    const migration = fs.readFileSync("deployment/hosted/postgres.sql", "utf8")
    expect(migration).toContain("wcb_immutable_seller_review_decision"); expect(migration).toContain("BEFORE UPDATE OR DELETE ON wcb_seller_review_decisions")
  })

  it("records approved/rejected status without publishing, entitling, materializing, or leaving quarantine", async () => {
    const f = await reviewedFixture(), second = await advanceSource(f, "rejected submitted snapshot")
    const count = async (table: string) => Number((await f.pool.query(`SELECT count(*) AS n FROM ${table}`)).rows[0].n)
    const before = { catalog: await count("wcb_catalog_projects"), releases: await count("wcb_project_releases"), listings: await count("wcb_listings"), entitlements: await count("wcb_license_entitlements"), copies: await count("wcb_entitlement_materializations") }
    await f.product.createSellerReviewDecision(f.operator.session, f.submission.submissionId, f.submission.snapshotHash, "approved_for_next_stage", "approve-only")
    await f.product.createSellerReviewDecision(f.operator.session, second.submissionId, second.snapshotHash, "rejected", "reject-only")
    const queue = await f.product.sellerQuarantineQueue(f.operator.session)
    expect(queue.find(item => item.submissionId === f.submission.submissionId)).toMatchObject({ status: "approved_for_next_stage", decision: { snapshotHash: f.submission.snapshotHash } })
    expect(queue.find(item => item.submissionId === second.submissionId)).toMatchObject({ status: "rejected", decision: { snapshotHash: second.snapshotHash } })
    expect({ catalog: await count("wcb_catalog_projects"), releases: await count("wcb_project_releases"), listings: await count("wcb_listings"), entitlements: await count("wcb_license_entitlements"), copies: await count("wcb_entitlement_materializations") }).toEqual(before)
    expect(await f.product.browse()).toHaveLength(1)
    expect((await f.pool.query("SELECT status FROM wcb_seller_submission_states ORDER BY updated_at")).rows.map(row => row.status)).toEqual(["pending_review", "pending_review"])
  })
})

describe("Phase 3 seller assessment admission", () => {
  const admissionFixture = async () => {
    const f = await setup(), controller = new HostedProductController(f.product, new PostgresSessionBoundary(f.identity, origins))
    const call = async (user: Partial<User>, body: Record<string, unknown>) => {
      const exchange = httpRequest(user, "/__webcanbe/api/product/seller/assessment/requests/admit", body)
      await controller.handle(exchange.request, exchange.response)
      return exchange.result()
    }
    const application = await f.product.applySeller(f.a.session)
    await f.product.transitionSellerApplication(f.operator.session, application.applicationId, "approved")
    const submission = await f.product.createSellerSubmission(f.a.session, application.applicationId, f.workspaceA, f.sourceProjectId)
    return { ...f, call, application, submission }
  }

  const approve = (f: Awaited<ReturnType<typeof admissionFixture>>, submission = f.submission, key = "assessment-approval") =>
    f.product.createSellerReviewDecision(f.operator.session, submission.submissionId, submission.snapshotHash, "approved_for_next_stage", key)

  it("admits only an operator-authorized approved snapshot with exact immutable provenance", async () => {
    const f = await admissionFixture(), decision = await approve(f)
    const input = { submissionId: f.submission.submissionId, sellerUserId: f.a.id, snapshotHash: f.submission.snapshotHash, reviewDecisionId: decision.decisionId, idempotencyKey: "assessment-a" }
    expect(await f.call(f.a, input)).toMatchObject({ status: 403 })
    expect(await f.call(f.b, { ...input, operator: true })).toMatchObject({ status: 403 })
    expect(await f.call(f.operator, input)).toMatchObject({ status: 201, body: { assessmentRequest: { submissionId: f.submission.submissionId, sellerUserId: f.a.id, sourceProjectId: f.sourceProjectId, sourceRevisionId: f.submission.sourceRevisionId, sourceContentHash: f.submission.sourceContentHash, snapshotHash: f.submission.snapshotHash, reviewDecisionId: decision.decisionId, status: "requested" } } })
  })

  it("refuses pending and rejected submissions", async () => {
    const f = await admissionFixture()
    await expect(f.product.admitSellerAssessment(f.operator.session, f.submission.submissionId, f.a.id, f.submission.snapshotHash, randomUUID(), "pending-refused")).rejects.toThrow(ProductConflict)
    const rejected = await f.product.createSellerReviewDecision(f.operator.session, f.submission.submissionId, f.submission.snapshotHash, "rejected", "assessment-rejected")
    await expect(f.product.admitSellerAssessment(f.operator.session, f.submission.submissionId, f.a.id, f.submission.snapshotHash, rejected.decisionId, "rejected-refused")).rejects.toThrow(ProductConflict)
    expect(Number((await f.pool.query("SELECT count(*) AS n FROM wcb_seller_assessment_requests")).rows[0].n)).toBe(0)
  })

  it("is idempotent and refuses cross-seller, cross-submission, decision, or snapshot substitution", async () => {
    const f = await admissionFixture(), decisionA = await approve(f)
    const input = { submissionId: f.submission.submissionId, sellerUserId: f.a.id, snapshotHash: f.submission.snapshotHash, reviewDecisionId: decisionA.decisionId, idempotencyKey: "admit-once" }
    const first = await f.product.admitSellerAssessment(f.operator.session, input.submissionId, input.sellerUserId, input.snapshotHash, input.reviewDecisionId, input.idempotencyKey)
    expect(await f.product.admitSellerAssessment(f.operator.session, input.submissionId, input.sellerUserId, input.snapshotHash, input.reviewDecisionId, input.idempotencyKey)).toEqual(first)
    expect(await f.product.admitSellerAssessment(f.operator.session, input.submissionId, input.sellerUserId, input.snapshotHash, input.reviewDecisionId, "admit-again")).toEqual(first)

    await f.access.workspace(f.workspaceA, f.b.id, "editor"); await f.access.member(f.sourceProjectId, f.b.id, "editor")
    const applicationB = await f.product.applySeller(f.b.session); await f.product.transitionSellerApplication(f.operator.session, applicationB.applicationId, "approved")
    const submissionB = await f.product.createSellerSubmission(f.b.session, applicationB.applicationId, f.workspaceA, f.sourceProjectId)
    const decisionB = await f.product.createSellerReviewDecision(f.operator.session, submissionB.submissionId, submissionB.snapshotHash, "approved_for_next_stage", "assessment-approval-b")
    await expect(f.product.admitSellerAssessment(f.operator.session, submissionB.submissionId, f.a.id, submissionB.snapshotHash, decisionB.decisionId, "wrong-seller")).rejects.toThrow(ProductConflict)
    await expect(f.product.admitSellerAssessment(f.operator.session, f.submission.submissionId, f.a.id, f.submission.snapshotHash, decisionB.decisionId, "wrong-decision")).rejects.toThrow(ProductConflict)
    await expect(f.product.admitSellerAssessment(f.operator.session, submissionB.submissionId, f.b.id, "0".repeat(64), decisionB.decisionId, "wrong-snapshot")).rejects.toThrow(ProductConflict)
    await expect(f.product.admitSellerAssessment(f.operator.session, submissionB.submissionId, f.b.id, submissionB.snapshotHash, decisionB.decisionId, input.idempotencyKey)).rejects.toThrow(ProductConflict)
    expect(Number((await f.pool.query("SELECT count(*) AS n FROM wcb_seller_assessment_requests")).rows[0].n)).toBe(1)
    const migration = fs.readFileSync("deployment/hosted/postgres.sql", "utf8")
    expect(migration).toContain("wcb_immutable_seller_assessment_request"); expect(migration).toContain("BEFORE UPDATE OR DELETE ON wcb_seller_assessment_requests")
  })

  it("creates only a non-executing request and no public product, entitlement, or working copy", async () => {
    const f = await admissionFixture(), decision = await approve(f), count = async (table: string) => Number((await f.pool.query(`SELECT count(*) AS n FROM ${table}`)).rows[0].n)
    const before = { projects: await count("wcb_projects"), catalog: await count("wcb_catalog_projects"), releases: await count("wcb_project_releases"), listings: await count("wcb_listings"), entitlements: await count("wcb_license_entitlements"), copies: await count("wcb_entitlement_materializations") }
    await f.product.admitSellerAssessment(f.operator.session, f.submission.submissionId, f.a.id, f.submission.snapshotHash, decision.decisionId, "request-only")
    expect({ projects: await count("wcb_projects"), catalog: await count("wcb_catalog_projects"), releases: await count("wcb_project_releases"), listings: await count("wcb_listings"), entitlements: await count("wcb_license_entitlements"), copies: await count("wcb_entitlement_materializations") }).toEqual(before)
    expect((await f.pool.query("SELECT status,submission_snapshot_hash,review_decision_id FROM wcb_seller_assessment_requests")).rows[0]).toEqual({ status: "requested", submission_snapshot_hash: f.submission.snapshotHash, review_decision_id: decision.decisionId })
    const implementation = fs.readFileSync("src/webcanbe-engine/runtime/postgresProductDomain.ts", "utf8").split("async admitSellerAssessment", 2)[1].split("async createCatalogProject", 1)[0]
    expect(implementation).not.toMatch(/child_process|\b(?:npm|pnpm|yarn|bun)\b|fetch\(|https?:\/\//)
  })
})
