import { PostgresIdentityStore, PostgresSessionBoundary } from "./runtime/postgresIdentity"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { spawn } from "node:child_process"
import { afterEach, describe, expect, it } from "vitest"
import { Pool } from "pg"
import { PostgresAccess, PostgresProjectStore, PostgresArtifactStore } from "./runtime/postgresStores"
import { PostgresLeaseStore, hostedPostgresPool } from "./runtime/postgresFencing"
import { withHostedSource } from "./runtime/postgresSourceCheckout"
import { DurableSource, contentHash, transactionEntry } from "./mutations/durableSource"
import { MutationHistory } from "./mutations/sourceMutations"
import { detectProject, type ProjectRecord } from "./runtime/projectRegistry"
import { snapshotPreview, type ControlledJob } from "./runtime/controlledPreview"
import { LOCAL_RESOURCE_BUDGET } from "./runtime/runnerScheduler"
const run = process.env.WCB_PG_TEST === "1" ? describe : describe.skip
const clean: Array<() => unknown> = []
afterEach(async () => { for (const close of clean.splice(0).reverse()) await close() })
const configFile = path.resolve(".webcanbe/runner/qa-phase2g2/postgres.json")
async function setup() {
  const config = JSON.parse(fs.readFileSync(configFile, "utf8")), schema = "test_" + randomUUID().replace(/-/g, ""), admin = new Pool(config)
  await admin.query(`CREATE SCHEMA ${schema}`)
  clean.push(async () => { await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end() })
  const pool = new Pool({ ...config, options: `-c search_path=${schema}` }); clean.push(() => pool.end())
  await pool.query(fs.readFileSync("deployment/hosted/postgres.sql", "utf8"))
  const access = new PostgresAccess(pool), project = randomUUID(), workspace = randomUUID(), session = { sessionId: randomUUID(), userId: randomUUID(), expiresAt: Date.now() + 600000 }
  await access.registerSession(session); await access.workspace(workspace, session.userId, "owner"); await access.project(project, workspace); await access.member(project, session.userId, "owner")
  const grant = await access.grant(session, project), store = new PostgresProjectStore(access), artifacts = new PostgresArtifactStore(access)
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "wcb-pg-source-"))); clean.push(() => fs.rmSync(dir, { recursive: true, force: true }))
  const root = path.join(dir, "project"); fs.cpSync("fixtures/compatible-react-vite", root, { recursive: true })
  const record: ProjectRecord = { id: project, name: "QA", root, sourceRoot: path.join(root, "src"), imported: true, detection: detectProject(root, process.cwd()), history: new MutationHistory() }
  const source = new DurableSource(record, path.join(dir, "history"))
  const files = () => new Map(fs.readdirSync(root, { recursive: true, withFileTypes: true }).filter(e => e.isFile()).map(e => { const f = path.join(e.parentPath, e.name); return [path.relative(root, f), fs.readFileSync(f)] }))
  await store.accept(grant, { revision: null, epoch: "0" }, files(), source.history())
  const edit = () => { const before = source.files().get("src/App.tsx")!, base = source.revision(); return source.commit({ expectedRevision: base, operations: [{ kind: "update", file: "src/App.tsx", expectedHash: contentHash(before), content: before + "\n// postgres transaction\n" }], entry: transactionEntry(project, base, "code", randomUUID(), "request", "PG edit", { passed: true, level: "parse", diagnostics: [] }), authorize: () => {} }) }
  const job = (): ControlledJob => { const generation = randomUUID(), expiresAt = Date.now() + 60000; return { generation, origin: `http://wcb-${generation}.preview.invalid`, revision: source.revision(), expiresAt, route: "/", network: { external: "deny" }, snapshot: snapshotPreview({ html: "<p>QA</p>", files: new Map() }), allocation: { owner: { userId: session.userId, workspaceId: workspace, projectId: project, sessionId: randomUUID() }, idempotencyKey: generation, startupDeadline: Date.now() + 15000, executionDeadline: expiresAt, idleMs: 60000, budget: LOCAL_RESOURCE_BUDGET } } }
  return { pool, config, schema, access, project, workspace, session, grant, store, artifacts, source, files, edit, job }
}
run("real PostgreSQL integration — local VM, not managed cloud", () => {
  it("uses one durable PostgreSQL login/session authority and cannot reissue a revoked user", async () => {
    const d = await setup(), identity = new PostgresIdentityStore(d.pool), peer = new PostgresIdentityStore(d.pool), subject = { issuer: "https://test-issuer.invalid", subject: "local-test-subject" }
    await identity.provision(subject, d.session.userId)
    await expect(peer.provision(subject, randomUUID())).rejects.toThrow()
    const attempt = await identity.create(); expect((await peer.consume(attempt.state, attempt.binding)).nonce).toBe(attempt.nonce)
    await expect(identity.consume(attempt.state, attempt.binding)).rejects.toThrow()
    const issued = await identity.issueVerifiedIdentity(subject)
    await peer.disable(subject); await expect(identity.issueVerifiedIdentity(subject)).rejects.toThrow(); await identity.provision(subject, d.session.userId)
    expect(await peer.resolve(issued.token)).toEqual(issued.session); expect(await d.access.grant(issued.session, d.project)).toMatchObject({ userId: d.session.userId })
    const csrf = await peer.rotateCsrf(issued.session); expect(await identity.csrf(issued.session, issued.csrf)).toBe(false); expect(await identity.csrf(issued.session, csrf)).toBe(true)
    const origins = { editorOrigin: "https://app.wcb-app.test", viewerOrigin: "https://viewer.wcb-preview.test", editorSite: "wcb-app.test", viewerSite: "wcb-preview.test" }, boundary = new PostgresSessionBoundary(identity, origins)
    const request: any = { method: "POST", socket: { encrypted: true }, headers: { host: "app.wcb-app.test", origin: origins.editorOrigin, "content-type": "application/json", cookie: issued.cookie.split(";")[0], "x-wcb-csrf": csrf } }
    expect(await boundary.authenticate(request)).toEqual(issued.session)
    await expect(boundary.authenticate({ ...request, headers: { ...request.headers, origin: origins.viewerOrigin } })).rejects.toThrow()
    await identity.revokeUser(d.session.userId)
    expect(await peer.resolve(issued.token)).toBeUndefined(); await expect(boundary.authenticate(request)).rejects.toThrow()
    await expect(identity.issueVerifiedSession(d.session.userId)).rejects.toThrow(); await expect(d.access.registerSession({ ...d.session, sessionId: randomUUID() })).rejects.toThrow()
    await expect(d.store.read(d.grant)).rejects.toThrow()
    const row = (await d.pool.query("SELECT token_hash,csrf_hash FROM wcb_sessions WHERE session_id=$1", [issued.session.sessionId])).rows[0]
    expect(row.token_hash).not.toBe(issued.token); expect(row.csrf_hash).not.toBe(csrf)
  })
  it("denies an artifact put already queued behind a project-delete transaction", async () => {
    const d = await setup(), client = await d.pool.connect(), snapshot = snapshotPreview({ html: "<p>late</p>", files: new Map() }), ref = { workspaceId: d.workspace, projectId: d.project, generation: randomUUID(), revision: d.source.revision(), digest: snapshot.digest }
    await client.query("BEGIN"); await client.query("UPDATE wcb_projects SET deleted=true,files=NULL,history=NULL WHERE project_id=$1", [d.project])
    const pending = d.artifacts.put(d.grant, ref, snapshot).then(() => "accepted", () => "rejected")
    try {
      let waiting = false
      for (let i=0;i<100;i++) { const row = await d.pool.query("SELECT pid FROM pg_stat_activity WHERE query LIKE 'SELECT project_id FROM wcb_projects%' AND wait_event_type='Lock'"); if(row.rowCount){waiting=true;break} await new Promise(r=>setTimeout(r,10)) }
      expect(waiting).toBe(true); await client.query("COMMIT"); expect(await pending).toBe("rejected")
      expect((await d.pool.query("SELECT count(*) AS n FROM wcb_artifacts WHERE project_id=$1 AND NOT retired", [d.project])).rows[0].n).toBe("0")
    } finally { await client.query("ROLLBACK"); client.release() }
  })
  it.each(["sslmode=disable", "sslmode=no-verify", "sslrootcert=untrusted"])("cannot override verified PostgreSQL TLS through a connection URL: %s", parameter => {
    expect(() => hostedPostgresPool({ connectionString: "postgresql://server.invalid/db?"+parameter, ssl: { ca: "configured-ca", rejectUnauthorized: true } })).toThrow("TLS")
  })

  it("commits canonical source/history atomically and rejects stale CAS/digest/revision reuse", async () => {
    const d = await setup(), before = await d.store.read(d.grant); d.edit()
    const accepted = await d.store.accept(d.grant, before, d.files(), d.source.history())
    expect(accepted.epoch).toBe("2"); expect((await d.store.read(d.grant)).files.get("src/App.tsx")?.toString()).toContain("postgres transaction")
    expect(await d.store.accept(d.grant, before, d.files(), d.source.history())).toMatchObject({ replayed: true })
    d.edit(); await expect(d.store.accept(d.grant, before, d.files(), d.source.history())).rejects.toThrow("Stale")
    const bad = d.files(); bad.set("src/App.tsx", Buffer.from("forged")); await expect(d.store.accept(d.grant, accepted, bad, d.source.history())).rejects.toThrow("digest")
  })
  it("uses the existing source transaction/history/export interfaces through a private checkout", async () => {
    const d = await setup(), initial = await d.store.read(d.grant)
    const result = await withHostedSource(d.store, d.grant, process.cwd(), async (_project, source) => {
      const before = source.files().get("src/App.tsx")!, base = source.revision()
      return source.commit({ expectedRevision: base, operations: [{ kind: "update", file: "src/App.tsx", expectedHash: contentHash(before), content: before + "\n// checkout\n" }], entry: transactionEntry(d.project, base, "code", randomUUID(), "checkout", "checkout", { passed: true, level: "parse", diagnostics: [] }), authorize: () => {} })
    }, true)
    expect(result.value.success).toBe(true); expect(result.state.revision).not.toBe(initial.revision)
    expect(result.state.files.get("src/App.tsx")?.toString()).toContain("checkout")
  })
  it("durably appends rejected history receipts without changing source, and refuses old-history rewrites", async () => {
    const d=await setup(), before=await d.store.read(d.grant)
    const result=await withHostedSource(d.store,d.grant,process.cwd(),async(_project,source)=>{
      source.reject(transactionEntry(d.project,source.revision(),"code",randomUUID(),"invalid-draft","Invalid draft",{passed:false,level:"parse",diagnostics:[]}))
    },true)
    expect(result.state.revision).toBe(before.revision);expect(result.state.files).toEqual(before.files);expect(result.state.epoch).toBe("2");expect(result.state.history.transactions.at(-1)?.status).toBe("rejected")
    const forged=structuredClone(result.state.history);forged.transactions[0].summary="rewritten"
    await expect(d.store.accept(d.grant,result.state,result.state.files,forged)).rejects.toThrow("Immutable")
  })
  it("rolls back a storage error and permits an exact retry after a new client starts", async () => {
    const d = await setup(), before = await d.store.read(d.grant); d.edit()
    await expect(d.store.accept(d.grant, before, d.files(), d.source.history(), async () => { throw Error("injected storage failure") })).rejects.toThrow("storage failure")
    expect((await d.store.read(d.grant)).revision).toBe(before.revision)
    const peer = new Pool({ ...d.config, options: `-c search_path=${d.schema}` }); clean.push(() => peer.end())
    const other = new PostgresProjectStore(new PostgresAccess(peer)); await other.accept(d.grant, before, d.files(), d.source.history())
    expect((await d.store.read(d.grant)).revision).toBe(d.source.revision())
  })
  it("rolls back an actual source transaction when its client is SIGKILLed", async () => {
    const d = await setup(), before = await d.store.read(d.grant)
    const code = `const {Pool}=require('pg');const fs=require('node:fs');(async()=>{const p=new Pool({...JSON.parse(fs.readFileSync(process.argv[1])),options:'-c search_path='+process.argv[2]});const c=await p.connect();await c.query('BEGIN');await c.query("UPDATE wcb_projects SET revision='killed-uncommitted'");process.kill(process.pid,'SIGKILL')})();`
    const child = spawn(process.execPath, ["-e", code, configFile, d.schema], { stdio: "ignore" })
    const status = await new Promise(resolve => child.on("exit", (code, signal) => resolve({ code, signal })))
    expect(status).toEqual({ code: null, signal: "SIGKILL" }); expect((await d.store.read(d.grant)).revision).toBe(before.revision)
  })
  it("serializes concurrent acceptance from two clients without losing a revision", async () => {
    const d = await setup(), before = await d.store.read(d.grant); d.edit()
    const history = d.source.history(), other = structuredClone(history); other.revisions.at(-1)!.revisionId = "rev_" + randomUUID()
    const results = await Promise.allSettled([d.store.accept(d.grant, before, d.files(), history), d.store.accept(d.grant, before, d.files(), other)])
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1); expect(results.filter(r => r.status === "rejected")).toHaveLength(1)
  })
  it("denies tenant prefix/project/session/epoch forgery, viewer writes and revoked grants", async () => {
    const d = await setup()
    for (const grant of [{ ...d.grant, workspaceId: randomUUID() }, { ...d.grant, projectId: randomUUID() }, { ...d.grant, userId: randomUUID() }, { ...d.grant, sessionId: randomUUID() }, { ...d.grant, membershipVersion: d.grant.membershipVersion + 1 }]) await expect(d.store.read(grant)).rejects.toThrow()
    await d.access.member(d.project, d.session.userId, "viewer"); const viewer = await d.access.grant(d.session, d.project)
    await expect(d.store.read(d.grant)).rejects.toThrow(); expect((await d.store.read(viewer)).revision).toBe(d.source.revision())
    await expect(d.store.accept(viewer, { revision: null, epoch: "0" }, d.files(), d.source.history())).rejects.toThrow()
    await d.access.revokeUser(d.session.userId); await expect(d.store.read(viewer)).rejects.toThrow()
  })
  it("keeps digest-bound artifacts tenant-scoped and tombstones revoke/delete against late puts", async () => {
    const d = await setup(), snapshot = snapshotPreview({ html: "<p>immutable</p>", files: new Map([["/a.css", { contentType: "text/css", body: Buffer.from("p{color:red}") }]]) }), ref = { workspaceId: d.workspace, projectId: d.project, generation: randomUUID(), revision: d.source.revision(), digest: snapshot.digest }
    await d.artifacts.put(d.grant, ref, snapshot); expect((await d.artifacts.get(d.grant, ref)).digest).toBe(snapshot.digest)
    await d.artifacts.put(d.grant, ref, snapshot)
    await expect(d.artifacts.get(d.grant, { ...ref, workspaceId: randomUUID() })).rejects.toThrow()
    await expect(d.artifacts.put(d.grant, ref, { ...snapshot, html: "forged" })).rejects.toThrow("digest")
    await d.artifacts.remove(d.grant, ref); await expect(d.artifacts.get(d.grant, ref)).rejects.toThrow(); await expect(d.artifacts.put(d.grant, ref, snapshot)).rejects.toThrow("retired")
    const state = await d.store.read(d.grant); await expect(d.store.remove(d.grant, "0")).rejects.toThrow("Stale")
    await d.store.remove(d.grant, state.epoch); await expect(d.store.read(d.grant)).rejects.toThrow(); await expect(d.store.accept(d.grant, { revision: null, epoch: "0" }, d.files(), d.source.history())).rejects.toThrow()
  })
  it("requires TLS for a production pool configuration", () => { expect(() => hostedPostgresPool({ ssl: false })).toThrow("TLS"); expect(() => hostedPostgresPool({ ssl: { rejectUnauthorized: false } })).toThrow("TLS") })
  it("uses epochs to reject late controller A after B takes over; uncertain cleanup retains capacity", async () => {
    const d = await setup(), a = new PostgresLeaseStore(d.pool, { global: 1, tenant: 1, project: 1 }, 150), b = new PostgresLeaseStore(d.pool, { global: 1, tenant: 1, project: 1 }, 150), controllerA = randomUUID(), controllerB = randomUUID(), job = d.job()
    const owned = await a.reserve(job, controllerA, "test-host-a"); await a.running(owned)
    await expect(b.takeOver(job.generation, controllerB)).rejects.toThrow("Live")
    await new Promise(r => setTimeout(r, 180))
    const taken = await b.takeOver(job.generation, controllerB); expect(BigInt(taken.epoch)).toBe(BigInt(owned.epoch) + 1n)
    await expect(a.heartbeat(owned)).rejects.toThrow("Stale"); await expect(a.guard(owned, async () => "late result")).rejects.toThrow("Stale"); await expect(a.beginStop(owned)).rejects.toThrow("Stale")
    await b.stopped(taken, false); await expect(b.reserve(d.job(), controllerB, "test-host-b")).rejects.toThrow("capacity")
    await b.beginStop(taken); await b.stopped(taken, true); expect(await b.beginStop(taken)).toBe(false)
    expect(await b.accounting()).toEqual([]); expect((await b.reserve(d.job(), controllerB, "test-host-b")).epoch).toBe("1")
  })
  it("enforces per-host capacity across project/session allocations", async () => {
    const d=await setup(),leases=new PostgresLeaseStore(d.pool,{global:4,tenant:4,project:4,host:1})
    await leases.reserve(d.job(),randomUUID(),"host-a")
    await expect(leases.reserve(d.job(),randomUUID(),"host-a")).rejects.toThrow("capacity")
    expect((await leases.reserve(d.job(),randomUUID(),"host-b")).hostId).toBe("host-b")
  })
  it("prevents concurrent duplicate starts and admission races, never resurrects stopped generations", async () => {
    const d = await setup(), leases = new PostgresLeaseStore(d.pool, { global: 1, tenant: 1, project: 1 }), job = d.job(), controller = randomUUID()
    const both = await Promise.allSettled([leases.reserve(job, controller, "test-host-a"), leases.reserve(d.job(), randomUUID(), "test-host-b")])
    expect(both.filter(x => x.status === "fulfilled")).toHaveLength(1)
    const fence = (both.find(x => x.status === "fulfilled") as PromiseFulfilledResult<any>).value
    await leases.beginStop(fence); await leases.stopped(fence, true)
    await expect(leases.reserve(job, controller, "test-host-a")).rejects.toThrow()
  })
  it("rejects a result whose lease expired during the operation", async () => {
    const d = await setup(), leases = new PostgresLeaseStore(d.pool, undefined, 100), owned = await leases.reserve(d.job(), randomUUID(), "test-host-a")
    await expect(leases.guard(owned, async () => { await new Promise(r => setTimeout(r, 150)); return "late" })).rejects.toThrow("Stale")
    expect(await leases.expired()).toHaveLength(1)
  })
})
