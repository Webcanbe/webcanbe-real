import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { request as httpRequest, type IncomingMessage } from "node:http"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createServer } from "vite"
import { AuthorityDenied, HostedSessionBoundary, SqliteAuthorityStore, roleOperations, validateHostedOrigins } from "./runtime/hostedAuthority"
import { SqliteArtifactStore } from "./runtime/storageContracts"
import { resolvePreviewSecrets, redactSecrets } from "./runtime/previewSecrets"
import { LOCAL_RESOURCE_BUDGET, ScheduledRunnerProvider, SqliteLeaseStore, type RunnerOwner } from "./runtime/runnerScheduler"
import { snapshotPreview, type ControlledExecution, type ControlledJob, type RunnerProvider } from "./runtime/controlledPreview"
import { ProjectRegistry } from "./runtime/projectRegistry"
import { webCanBeFixturePlugin } from "./runtime/viteFixturePlugin"
import { exportProjectZip } from "./runtime/projectExport"
import { contentHash } from "./mutations/durableSource"
import * as sourceValidation from "./mutations/sourceValidation"
const cleanups: Array<() => unknown> = []
afterEach(async () => { for (const close of cleanups.splice(0).reverse()) await close() })
const policy = { editorOrigin: "https://app.webcanbe.example", editorSite: "webcanbe.example", viewerOrigin: "https://viewer.webcanbe-view.example", viewerSite: "webcanbe-view.example" }
function setup() {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "wcb-2g-authority-")))
  cleanups.push(() => fs.rmSync(directory, { recursive: true, force: true }))
  let clock = Date.now()
  const store = new SqliteAuthorityStore(path.join(directory, "authority.sqlite"), () => clock); cleanups.push(() => store.close())
  const userA = randomUUID(), userB = randomUUID(), workspaceA = randomUUID(), workspaceB = randomUUID(), projectA = randomUUID(), projectB = randomUUID(), projectC = randomUUID()
  store.setWorkspaceMember(workspaceA, userA, "owner"); store.setWorkspaceMember(workspaceA, userB, "editor"); store.setWorkspaceMember(workspaceB, userB, "owner")
  const a = store.issueVerifiedSession(userA), b = store.issueVerifiedSession(userB)
  store.registerProject(a.session, workspaceA, projectA); store.registerProject(b.session, workspaceA, projectB); store.registerProject(b.session, workspaceB, projectC)
  const boundary = new HostedSessionBoundary(store, store, policy, true)
  const request = (headers: Record<string, string | undefined> = {}, changes: object = {}) => ({ method: "POST", socket: {}, headers: { host: "app.webcanbe.example", origin: policy.editorOrigin, "content-type": "application/json", cookie: "__Host-wcb-session=" + a.token, "x-wcb-csrf": a.csrf, ...headers }, ...changes }) as unknown as IncomingMessage
  return { directory, store, userA, userB, workspaceA, workspaceB, projectA, projectB, projectC, a, b, boundary, request, advance: (ms: number) => { clock += ms }, now: () => clock }
}
describe("hosted session and project authority (real SQLite, local HTTP QA)", () => {
  it("uses opaque host-only short-lived cookies and survives a store reopen", () => {
    const d = setup()
    expect(d.a.cookie).toContain("Secure; HttpOnly; SameSite=Strict"); expect(d.a.cookie).not.toContain("Domain=")
    expect(d.boundary.authenticate(d.request())).toEqual(d.a.session)
    const peer = new SqliteAuthorityStore(path.join(d.directory, "authority.sqlite")); cleanups.push(() => peer.close())
    expect(peer.resolve(d.a.token)).toEqual(d.a.session)
    peer.revokeSession(d.a.session.sessionId)
    expect(() => d.boundary.authenticate(d.request())).toThrow(AuthorityDenied)
  })
  it.each([
    { cookie: "" }, { cookie: "__Host-wcb-session=forged" }, { cookie: "wcb-session=forged" }, { "x-wcb-csrf": "" }, { "x-wcb-csrf": "forged" },
    { origin: "https://viewer.webcanbe-view.example" }, { origin: "null" }, { origin: "https://app.webcanbe.example.attacker.invalid" }, { host: "evil.invalid" }, { "x-wcb-editor-key": "local-key" }, { "content-type": "text/plain" },
  ])("rejects cookie/CSRF/origin confusion %j", headers => {
    const d = setup(); expect(() => d.boundary.authenticate(d.request(headers))).toThrow(AuthorityDenied)
  })
  it("rejects duplicated cookies, cross-session CSRF and preview credentials", () => {
    const d = setup()
    for (const headers of [{ cookie: `__Host-wcb-session=${d.a.token}; __Host-wcb-session=${d.a.token}` }, { "x-wcb-csrf": d.b.csrf }, { cookie: `__Host-wcb-session=${d.a.token}; __Host-wcb-preview=synthetic` }]) expect(() => d.boundary.authenticate(d.request(headers))).toThrow(AuthorityDenied)
    expect(() => new HostedSessionBoundary(d.store, d.store, policy).authenticate(d.request())).toThrow(AuthorityDenied)
    expect(() => d.boundary.authenticate(d.request({}, { method: "GET" }))).toThrow(AuthorityDenied)
  })
  it("rejects same-cookie-site origins and expires sessions without browser cooperation", () => {
    const d = setup(); expect(() => validateHostedOrigins({ ...policy, viewerOrigin: "https://preview.webcanbe.example", viewerSite: "webcanbe.example" })).toThrow("Separate HTTPS")
    d.advance(600001); expect(d.store.resolve(d.a.token)).toBeUndefined(); expect(() => d.store.grant(d.a.session, d.projectA)).toThrow(AuthorityDenied)
  })
  it("requires project AND workspace membership, prevents regrant capability revival", () => {
    const d = setup(); const grant = d.store.grant(d.a.session, d.projectA, "code")
    for (const project of [d.projectB, d.projectC, randomUUID(), "../../private"]) expect(() => d.store.grant(d.a.session, project, "files")).toThrow(AuthorityDenied)
    d.store.setProjectMember(d.projectA, d.userA, null); expect(d.store.check(grant)).toBe(false)
    d.store.setProjectMember(d.projectA, d.userA, "owner"); expect(d.store.check(grant)).toBe(false)
    const fresh = d.store.grant(d.a.session, d.projectA)
    d.store.setWorkspaceMember(d.workspaceA, d.userA, null); expect(d.store.check(fresh)).toBe(false)
    d.store.setWorkspaceMember(d.workspaceA, d.userA, "owner"); expect(d.store.check(fresh)).toBe(false)
  })
  it("viewer can read but cannot mutate or import, and platform roles are not project roles", () => {
    const d = setup(); d.store.setProjectMember(d.projectA, d.userB, "viewer")
    expect(d.store.grant(d.b.session, d.projectA, "source").role).toBe("viewer")
    expect(d.store.grant(d.b.session, d.projectA, "search").role).toBe("viewer")
    for (const op of ["code", "mutate", "undo", "redo", "revert", "checkpoint"] as const) expect(() => d.store.grant(d.b.session, d.projectA, op)).toThrow(AuthorityDenied)
    expect(() => d.store.setProjectMember(d.projectA, d.userB, "admin" as any)).toThrow(AuthorityDenied)
    d.store.setWorkspaceMember(d.workspaceA, d.userB, "viewer"); expect(() => d.store.registerProject(d.b.session, d.workspaceA, randomUUID())).toThrow(AuthorityDenied)
  })
  it("artifact storage checks full ownership tuple, integrity, revoked grants and guessed keys", () => {
    const d = setup(), artifacts = new SqliteArtifactStore(path.join(d.directory, "artifacts.sqlite"), d.store); cleanups.push(() => artifacts.close())
    const grant = d.store.grant(d.a.session, d.projectA), snapshot = snapshotPreview({ html: "<h1>A</h1>", files: new Map() })
    const ref = { workspaceId: d.workspaceA, projectId: d.projectA, revision: "rev_A", generation: randomUUID(), digest: snapshot.digest }
    artifacts.put(grant, ref, snapshot); artifacts.put(grant, ref, snapshot); expect(artifacts.get(grant, ref)).toEqual(snapshot)
    for (const patch of [{ projectId: d.projectB }, { workspaceId: d.workspaceB }, { generation: randomUUID() }, { revision: "rev_B" }, { digest: "a".repeat(64) }]) expect(() => artifacts.get(grant, { ...ref, ...patch })).toThrow()
    expect(() => artifacts.get(d.store.grant(d.b.session, d.projectB), ref)).toThrow(AuthorityDenied)
    expect(() => artifacts.put(grant, ref, { ...snapshot, html: "forged" })).toThrow("digest")
    d.store.revokeSession(d.a.session.sessionId); expect(() => artifacts.get(grant, ref)).toThrow(AuthorityDenied)
  })
  it("separates secret environments and redacts raw/encoded known values before logging", () => {
    const d = setup(), calls: string[] = [], secret = "synthetic-preview-only", source = { read: (project: string, environment: string, name: string) => { calls.push(`${project}/${environment}/${name}`); return secret } }
    const principal = d.store.grant(d.a.session, d.projectA), grant = { projectId: d.projectA, sessionId: d.a.session.sessionId, names: ["WCB_PREVIEW_DEMO"] }
    const values = resolvePreviewSecrets(source, d.store, principal, grant)
    expect(values.WCB_PREVIEW_DEMO).toBe(secret); expect(calls).toEqual([`${d.projectA}/preview/WCB_PREVIEW_DEMO`])
    for (const name of ["DATABASE_ADMIN_PASSWORD", "STRIPE_SECRET_KEY", "EDITOR_TOKEN"]) expect(() => resolvePreviewSecrets(source, d.store, principal, { ...grant, names: [name] })).toThrow("preview")
    expect(() => resolvePreviewSecrets(source, d.store, principal, { ...grant, projectId: d.projectB })).toThrow(AuthorityDenied)
    expect(redactSecrets(secret + Buffer.from(secret).toString("base64") + encodeURIComponent(secret), [secret])).toBe("[REDACTED][REDACTED][REDACTED]")
  })
})

async function apiSetup() {
  const d = setup()
  fs.cpSync(path.join(process.cwd(), "fixtures/compatible-react-vite"), path.join(d.directory, "fixtures/compatible-react-vite"), { recursive: true })
  const registry = new ProjectRegistry(d.directory)
  const archive = await exportProjectZip(registry.get("phase1-fixture")!)
  const project = await registry.importZip("A", archive), other = await registry.importZip("B", archive), cross = await registry.importZip("C", archive)
  d.store.registerProject(d.a.session, d.workspaceA, project.id); d.store.registerProject(d.b.session, d.workspaceA, other.id); d.store.registerProject(d.b.session, d.workspaceB, cross.id)
  const artifacts = new SqliteArtifactStore(path.join(d.directory, "artifacts.sqlite"), d.store); cleanups.push(() => artifacts.close())
  // Deliberately a provider double: these tests prove HTTP/SQLite authorization,
  // not process/network isolation. Real Lima acceptance is a separate script.
  const runner: RunnerProvider = { open: async () => { throw new Error("No fake runtime execution") }, revoke: async () => {} }
  const leases = new SqliteLeaseStore(path.join(d.directory, "leases.sqlite"))
  const server = await createServer({ configFile: false, root: process.cwd(), cacheDir: path.join(d.directory, "cache"), plugins: [webCanBeFixturePlugin(process.cwd(), { registry, hosted: d.boundary, artifacts, leases, runner })], server: { host: "127.0.0.1", port: 0 }, logLevel: "silent" })
  await server.listen(); cleanups.push(async () => { await server.close(); await new Promise(resolve => setTimeout(resolve, 20)) })
  const origin = "http://127.0.0.1:" + (server.httpServer!.address() as { port: number }).port
  const call = async (route: string, body: object = {}, actor = d.a) => {
    return new Promise<{ status: number; body: any }>((resolve, reject) => {
      const request = httpRequest(origin + "/__webcanbe/api" + route, { method: "POST", headers: { Host: "app.webcanbe.example", Origin: policy.editorOrigin, "Content-Type": "application/json", Cookie: "__Host-wcb-session=" + actor.token, "X-WCB-CSRF": actor.csrf } }, response => {
        let data = ""; response.setEncoding("utf8"); response.on("data", chunk => { data += chunk }); response.on("end", () => { try { resolve({ status: response.statusCode!, body: JSON.parse(data) }) } catch (error) { reject(error) } })
      }); request.on("error", reject); request.end(JSON.stringify(body))
    })
  }
  return { ...d, registry, project, other, cross, call }
}
describe("hosted actual API source/history boundary", () => {
  it.each(["files", "source", "search", "inspect", "history", "preview", "export", "code", "mutate", "undo", "redo", "revert", "checkpoint", "session"])("denies another user's %s across both workspace cases", async action => {
    const d = await apiSetup()
    for (const target of [d.other, d.cross]) expect((await d.call(`/projects/${target.id}/${action}`)).status).toBe(403)
  })
  it("filters project listing, binds capabilities to accounts, rejects forged workspace and revoked active sessions", async () => {
    const d = await apiSetup()
    const listing = await d.call("/projects"); expect(listing.status, JSON.stringify(listing.body)).toBe(200)
    expect(listing.body.projects.map((p: { id: string }) => p.id)).toEqual([d.project.id])
    const connected = await d.call(`/projects/${d.project.id}/session`), session = connected.body.session
    expect(connected.status).toBe(201); expect(JSON.stringify(connected.body)).not.toContain(d.directory)
    const source = await d.call(`/projects/${d.project.id}/files`, session); expect(source.status).toBe(200)
    expect((await d.call(`/projects/${d.project.id}/files`, { ...session, workspaceId: d.workspaceB })).status).toBe(403)
    const second = d.store.issueVerifiedSession(d.userA)
    expect((await d.call(`/projects/${d.project.id}/history`, session, second)).status).toBe(403)
    d.store.setProjectMember(d.project.id, d.userA, null)
    expect(d.registry.sessionActive(d.project.id, session.previewId)).toBe(false)
    expect((await d.call(`/projects/${d.project.id}/files`, session)).status).toBe(403)
  })
  it("withholds rejected export diagnostics if membership is revoked during validation", async () => {
    const d = await apiSetup(), session = (await d.call(`/projects/${d.project.id}/session`)).body.session
    const validation = vi.spyOn(sourceValidation, "validateStagedProject").mockImplementation(async () => {
      d.store.setProjectMember(d.project.id, d.userA, null)
      return { level: "checkpoint", passed: false, diagnostics: [{ file: "src/App.tsx", message: "synthetic private project diagnostic" }] }
    })
    try {
      const result = await d.call(`/projects/${d.project.id}/export`, session)
      expect(result.status).toBe(403); expect(JSON.stringify(result.body)).not.toContain("private project diagnostic")
    } finally { validation.mockRestore() }
  })
  it("searches accepted project source through read authority without changing source or history", async () => {
    const d = await apiSetup()
    const session = (await d.call(`/projects/${d.project.id}/session`)).body.session
    const beforeFiles = await d.call(`/projects/${d.project.id}/files`, { ...session, file: "src/App.tsx" })
    const beforeHistory = await d.call(`/projects/${d.project.id}/history`, session)
    const found = await d.call(`/projects/${d.project.id}/search`, { ...session, expectedRevision: beforeFiles.body.revision, query: "FeatureGrid", caseSensitive: true, limit: 10 })
    expect(found.status, JSON.stringify(found.body)).toBe(200)
    expect(found.body.searchResults.some((item: any) => item.file === "src/App.tsx" && item.line > 0 && item.column > 0 && item.preview.includes("FeatureGrid"))).toBe(true)
    expect(found.body.searchMeta.scannedFiles).toBeGreaterThan(0)
    expect(found.body.searchMeta.totalFiles).toBeGreaterThanOrEqual(found.body.searchMeta.scannedFiles)
    expect(found.body.searchResults.length).toBeLessThanOrEqual(10)
    expect((await d.call(`/projects/${d.project.id}/search`, { ...session, query: "x".repeat(161) })).status).toBe(400)
    expect((await d.call(`/projects/${d.project.id}/search`, { ...session, query: "FeatureGrid", limit: 101 })).status).toBe(400)
    const afterFiles = await d.call(`/projects/${d.project.id}/files`, { ...session, file: "src/App.tsx" })
    const afterHistory = await d.call(`/projects/${d.project.id}/history`, session)
    expect(afterFiles.body.revision).toBe(beforeFiles.body.revision)
    expect(afterFiles.body.source).toBe(beforeFiles.body.source)
    expect(afterHistory.body.history).toEqual(beforeHistory.body.history)

    d.store.setProjectMember(d.project.id, d.userB, "viewer")
    const viewer = (await d.call(`/projects/${d.project.id}/session`, {}, d.b)).body.session
    expect((await d.call(`/projects/${d.project.id}/search`, { ...viewer, query: "FeatureGrid" }, d.b)).status).toBe(200)
  })
  it("enforces viewer writes through HTTP and records the authenticated actor on real source transactions", async () => {
    const d = await apiSetup(); d.store.setProjectMember(d.project.id, d.userB, "viewer")
    const reader = (await d.call(`/projects/${d.project.id}/session`, {}, d.b)).body.session
    expect((await d.call(`/projects/${d.project.id}/history`, reader, d.b)).status).toBe(200)
    expect((await d.call(`/projects/${d.project.id}/code`, reader, d.b)).status).toBe(403)
    const editor = (await d.call(`/projects/${d.project.id}/session`)).body.session
    const files = await d.call(`/projects/${d.project.id}/files`, { ...editor, file: "src/App.css" })
    const body = { ...editor, expectedRevision: files.body.revision, idempotencyKey: randomUUID(), operations: [{ kind: "update", file: "src/App.css", expectedHash: contentHash(files.body.source), content: files.body.source + "\n/* hosted accepted */" }] }
    const result = await d.call(`/projects/${d.project.id}/code`, body)
    expect(result.status, JSON.stringify(result.body)).toBe(200); expect(result.body.transaction.actor).toBe(d.userA)
    expect((await d.call(`/projects/${d.project.id}/code`, body)).body.replayed).toBe(true)
    expect((await d.call(`/projects/${d.project.id}/code`, { ...body, operations: [] })).status).toBe(409)
    const persisted = new ProjectRegistry(d.directory).durable(d.project.id)
    expect(persisted.revision()).toBe(result.body.revision); expect(persisted.files().get("src/App.css")).toContain("hosted accepted")
  })
})

function schedulerSetup() {
  const d = setup(), owner: RunnerOwner = { userId: d.userA, workspaceId: d.workspaceA, projectId: d.projectA, sessionId: randomUUID() }
  const executions: ControlledExecution[] = []
  const provider: RunnerProvider = { revoke: vi.fn(async () => {}), open: vi.fn(async () => { const e = { capture: vi.fn(async () => new Uint8Array([1])), input: vi.fn(async () => {}), close: vi.fn(async () => {}) }; executions.push(e); return e }) }
  let allowed = true
  const store = new SqliteLeaseStore(path.join(d.directory, "leases.sqlite"))
  const scheduler = new ScheduledRunnerProvider(provider, store, () => allowed, d.now)
  cleanups.push(() => scheduler.close().catch(() => {}))
  const makeJob = (who = owner): ControlledJob => {
    const generation = randomUUID(), expiresAt = d.now() + 60000
    return { generation, origin: `http://wcb-${generation}.preview.invalid`, revision: "rev_A", expiresAt, route: "/", network: { external: "deny" }, snapshot: snapshotPreview({ html: "<p>test</p>", files: new Map() }), allocation: { owner: who, idempotencyKey: generation, startupDeadline: d.now() + 15000, executionDeadline: expiresAt, idleMs: 60000, budget: LOCAL_RESOURCE_BUDGET } }
  }
  return { ...d, owner, provider, scheduler, store, executions, makeJob, deny: () => { allowed = false } }
}
describe("durable hosted scheduler semantics (provider doubles, not OS proof)", () => {
  it("deduplicates identical allocations and rejects stolen or changed allocations", async () => {
    const d = schedulerSetup(), job = d.makeJob(), signal = new AbortController().signal
    const [a, b] = await Promise.all([d.scheduler.open(job, signal), d.scheduler.open(job, signal)])
    expect(a).toBe(b); expect(d.provider.open).toHaveBeenCalledTimes(1)
    await expect(d.scheduler.open({ ...job, revision: "rev_other" }, signal)).rejects.toThrow("conflict")
    await expect(d.scheduler.open({ ...job, allocation: { ...job.allocation!, owner: { ...d.owner, workspaceId: d.workspaceB } } }, signal)).rejects.toThrow("conflict")
    await a.close(); await expect(d.scheduler.open(job, signal)).rejects.toThrow()
  })
  it("enforces tenant and global admission independently", async () => {
    const d = schedulerSetup(), signal = new AbortController().signal
    await d.scheduler.open(d.makeJob(), signal); await d.scheduler.open(d.makeJob({ ...d.owner, projectId: randomUUID() }), signal)
    await expect(d.scheduler.open(d.makeJob({ ...d.owner, projectId: randomUUID() }), signal)).rejects.toThrow("capacity")
    for (let i = 0; i < 2; i++) await d.scheduler.open(d.makeJob({ ...d.owner, workspaceId: randomUUID(), projectId: randomUUID() }), signal)
    await expect(d.scheduler.open(d.makeJob({ ...d.owner, workspaceId: randomUUID() }), signal)).rejects.toThrow("capacity")
  })
  it("rejects stale worker output when membership disappears during capture", async () => {
    const d = schedulerSetup(); const execution = await d.scheduler.open(d.makeJob(), new AbortController().signal)
    d.executions[0].capture = async () => { d.deny(); return new Uint8Array([1]) }
    await expect(execution.capture()).rejects.toThrow("Stale worker"); expect(d.provider.revoke).toHaveBeenCalled()
  })
  it("tombstones cancelled startup and reaps a late worker result", async () => {
    const d = schedulerSetup(), abort = new AbortController(); let complete!: (value: ControlledExecution) => void
    d.provider.open = () => new Promise(resolve => { complete = resolve })
    const started = d.scheduler.open(d.makeJob(), abort.signal); await new Promise(resolve => setTimeout(resolve, 5)); abort.abort()
    const late = { capture: async () => new Uint8Array(), input: async () => {}, close: vi.fn(async () => {}) }; complete(late)
    await expect(started).rejects.toThrow("cancellation"); expect(late.close).toHaveBeenCalledOnce(); expect(d.provider.revoke).toHaveBeenCalled()
  })
  it("quarantines stop failure and does not grant new authority", async () => {
    const d = schedulerSetup(), e = await d.scheduler.open(d.makeJob(), new AbortController().signal)
    d.provider.revoke = async () => { throw new Error("synthetic stop failure") }
    await expect(e.close()).rejects.toThrow("quarantined")
    await expect(d.scheduler.open(d.makeJob(), new AbortController().signal)).rejects.toThrow("quarantined")
    expect(d.store.unsettled()[0].state).toBe("quarantined")
  })
  it("recovers a durable orphan before allocating and locks out a competing controller", async () => {
    const d = setup(), file = path.join(d.directory, "recovery.sqlite"), first = new SqliteLeaseStore(file)
    const generation = randomUUID(), owner = { userId: d.userA, workspaceId: d.workspaceA, projectId: d.projectA, sessionId: randomUUID() }
    first.reserve({ generation, requestHash: "orphan", state: "allocating", allocation: { owner, idempotencyKey: generation, startupDeadline: d.now() + 15000, executionDeadline: d.now() + 60000, idleMs: 60000, budget: LOCAL_RESOURCE_BUDGET } }, { global: 4, tenant: 2, project: 2 })
    expect(() => new SqliteLeaseStore(file)).toThrow("already owns"); first.close()
    const second = new SqliteLeaseStore(file), revoke = vi.fn(async () => {})
    const scheduler = new ScheduledRunnerProvider({ revoke, open: async () => { throw new Error("intentional no launch") } }, second, () => true, d.now); cleanups.push(() => scheduler.close())
    await expect(scheduler.open({ generation } as ControlledJob, new AbortController().signal)).rejects.toThrow("ownership")
    expect(revoke).toHaveBeenCalledWith(generation); expect(second.unsettled()).toHaveLength(0)
  })
  it("expires idle and startup deadlines and refuses unapproved resource budgets", async () => {
    const d = schedulerSetup(), job = d.makeJob(), e = await d.scheduler.open(job, new AbortController().signal)
    d.advance(60001); await expect(e.capture()).rejects.toThrow("unavailable")
    const idleJob = d.makeJob(), idle = await d.scheduler.open({ ...idleJob, allocation: { ...idleJob.allocation!, idleMs: 100 } }, new AbortController().signal)
    d.advance(101); await expect(idle.capture()).rejects.toThrow("unavailable")
    const lateStartup = d.makeJob(); await expect(d.scheduler.open({ ...lateStartup, allocation: { ...lateStartup.allocation!, startupDeadline: d.now() - 1 } }, new AbortController().signal)).rejects.toThrow("deadline")
    const fresh = d.makeJob(); await expect(d.scheduler.open({ ...fresh, allocation: { ...fresh.allocation!, budget: { ...LOCAL_RESOURCE_BUDGET, memoryMiB: 99999 } } }, new AbortController().signal)).rejects.toThrow("resource")
  })
})
