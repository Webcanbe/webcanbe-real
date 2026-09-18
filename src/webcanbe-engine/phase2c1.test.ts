import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ControlledPreviewTransport, snapshotPreview, STRICT_PREVIEW_BLOCKER, type ControlledJob, type ProjectRunner, type ControlledExecution, type PreviewInput } from "./runtime/controlledPreview"
import { ProjectRegistry, type SessionAuthority } from "./runtime/projectRegistry"
import { exportProjectZip } from "./runtime/projectExport"

const temporary: string[] = [], transports: ControlledPreviewTransport[] = []
afterEach(async () => { for (const transport of transports.splice(0)) await transport.close().catch(() => {}); for (const root of temporary.splice(0)) fs.rmSync(root, { recursive: true, force: true }) })
// In-memory orchestration double. These tests do NOT launch a browser or prove
// network isolation, native sandbox retention, process death, or PNG encoding.
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jv9sAAAAASUVORK5CYII=", "base64")
function fake() {
  const jobs: ControlledJob[] = [], executions: ControlledExecution[] = [], signals: AbortSignal[] = []
  const runner: ProjectRunner = { open: vi.fn(async (job, signal) => {
    jobs.push(job); signals.push(signal)
    const execution = { capture: vi.fn(async () => png), input: vi.fn(async () => {}), close: vi.fn(async () => {}) }
    executions.push(execution); return execution
  }) }
  return { runner, jobs, executions, signals }
}
async function setup(runner?: ProjectRunner, now = Date.now) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wcb-2c1-")); temporary.push(root)
  fs.cpSync(path.join(process.cwd(), "fixtures/compatible-react-vite"), path.join(root, "fixtures/compatible-react-vite"), { recursive: true })
  const registry = new ProjectRegistry(root, now)
  const project = await registry.importZip("coast", await exportProjectZip({ ...registry.get("phase1-fixture")!, root: path.join(process.cwd(), "fixtures/coast-paths") }))
  const session = registry.createSession(project.id)!
  const authority: SessionAuthority = { ...session, operation: "preview" }
  const transport = new ControlledPreviewTransport(registry, process.cwd(), runner, now); transports.push(transport)
  const request = () => ({ revision: registry.revision(project.id), route: "/places/42?mode=quiet#details" })
  return { registry, project, session, authority, transport, request, start: () => transport.start(project.id, authority, request()) }
}

describe("controlled preview foundation (not a network isolation proof)", () => {
  it("fails closed without a provider; flags and URLs cannot grant execution or networking", async () => {
    const d = await setup()
    await expect(d.start()).rejects.toThrow(STRICT_PREVIEW_BLOCKER)
    for (const flag of ["runnerApproved", "allowUnsafe", "transport", "network", "proof"]) {
      await expect(d.transport.start(d.project.id, d.authority, { ...d.request(), [flag]: true })).rejects.toThrow("Invalid controlled")
    }
    for (const route of ["https://example.invalid/", "//example.invalid/", "/_wcb/app.js", "/%5fwcb/app.js", "/_wcb?x=1", "/_wcb#details", "/api/write", "/%2e%2e/private"]) await expect(d.transport.start(d.project.id, d.authority, { ...d.request(), route })).rejects.toThrow("Invalid controlled")
  })
  it("binds all compiled bytes, MIME types and paths, including public assets; snapshots cannot be mutated", () => {
    const file = { body: Buffer.from("original"), contentType: "image/png" }
    const build = { html: "<h1>app</h1>", files: new Map([["/picture.png", file]]) }
    const original = snapshotPreview(build)
    file.body.fill(0); build.files.clear(); build.html = "changed"
    expect(original.html).toBe("<h1>app</h1>")
    expect(Buffer.from(original.files[0].base64, "base64").toString()).toBe("original")
    expect(Object.isFrozen(original.files[0]) && Object.isFrozen(original.files) && Object.isFrozen(original)).toBe(true)
    expect(snapshotPreview(build).digest).not.toBe(original.digest)
    expect(() => snapshotPreview({ html: "", files: new Map([["/../private", file]]) })).toThrow("artifact")
    expect(snapshotPreview({ html: "", files: new Map([["/hero image.svg", file]]) }).files[0].path).toBe("/hero image.svg")
  })
  it("keeps capabilities and executable artifacts out of the display descriptor; input confers no source authority", async () => {
    const f = fake(), d = await setup(f.runner), view = await d.start()
    expect(Object.keys(view).sort()).toEqual(["expiresAt", "generation", "revision", "transport"])
    expect(JSON.stringify(f.jobs[0])).not.toContain(d.session.capability)
    expect(JSON.stringify(f.jobs[0])).not.toContain(d.project.root)
    expect(f.jobs[0].network).toEqual({ external: "deny" })
    expect(f.jobs[0].origin).toMatch(/^http:\/\/wcb-[\w-]+\.preview\.invalid$/)
    const before = d.registry.revision(d.project.id)
    await d.transport.input(d.project.id, d.authority, view.generation, { type: "pointer", action: "click", x: 12, y: 15 })
    await d.transport.input(d.project.id, d.authority, view.generation, { type: "navigate", route: "/places/7?q=two#details" })
    const frame = await d.transport.capture(d.project.id, d.authority, view.generation)
    expect(frame.contentType).toBe("image/png"); expect(frame.bytes).toEqual(png)
    expect(d.registry.revision(d.project.id)).toBe(before)
    expect(d.registry.authorize(d.project.id, d.session.previewId, view.generation, "mutate")).toBe(false)
    expect(() => d.registry.store(d.project.id, d.authority)!.write("src/App.jsx", "poison", "original")).toThrow("not authorized")
    for (const input of [{ type: "mutate", content: "poison" }, { type: "pointer", action: "click", x: NaN, y: 1 }, { type: "navigate", route: "http://example.invalid" }, { type: "navigate", route: "/", capability: "fake" }]) await expect(d.transport.input(d.project.id, d.authority, view.generation, input as PreviewInput)).rejects.toThrow("Invalid controlled")
    for (const route of ["/%5fwcb/bridge.js", "/_wcb?x=1", "/_wcb#details"]) await expect(d.transport.input(d.project.id, d.authority, view.generation, { type: "navigate", route })).rejects.toThrow("Invalid controlled")
  })
  it("denies wrong/inspect-only capabilities and cross-project or sibling-session generation access", async () => {
    const f = fake(), d = await setup(f.runner), view = await d.start()
    const other = d.registry.createSession("phase1-fixture")!, sibling = d.registry.createSession(d.project.id)!
    for (const authority of [{ ...d.authority, capability: "forged" }, { ...d.authority, operation: "inspect" as const }, { ...other, operation: "preview" as const }, { ...sibling, operation: "preview" as const }]) {
      await expect(d.transport.capture(d.project.id, authority, view.generation)).rejects.toThrow()
      await expect(d.transport.stop(d.project.id, authority, view.generation)).rejects.toThrow()
    }
    expect(f.executions[0].close).not.toHaveBeenCalled()
    expect((await d.transport.capture(d.project.id, d.authority, view.generation)).bytes).toEqual(png)
  })
  it.each(["revoke", "expire", "source"])("invalidates %s independently of browser cleanup and rejects subsequent reads", async mode => {
    let clock = Date.now(); const f = fake(), d = await setup(f.runner, () => clock), view = await d.start()
    if (mode === "revoke") d.registry.revokeSession(d.project.id, d.session.previewId)
    if (mode === "expire") clock += 600_001
    if (mode === "source") fs.appendFileSync(path.join(d.project.sourceRoot, "App.jsx"), "\n// changed")
    await d.transport.sweep()
    expect(f.executions[0].close).toHaveBeenCalledOnce(); expect(f.signals[0].aborted).toBe(true)
    await expect(d.transport.capture(d.project.id, d.authority, view.generation)).rejects.toThrow()
    await expect(d.transport.input(d.project.id, d.authority, view.generation, { type: "navigate", route: "/" })).rejects.toThrow()
  })
  it("retires old generations on replacement, stop and transport restart", async () => {
    const f = fake(), d = await setup(f.runner), first = await d.start()
    fs.appendFileSync(path.join(d.project.root, "public/compass.svg"), "\n<!-- public snapshot changed -->")
    fs.writeFileSync(path.join(d.project.root, "public/unused asset.svg"), '<svg xmlns="http://www.w3.org/2000/svg"/>')
    const second = await d.start()
    expect(second.generation).not.toBe(first.generation)
    expect(second.revision).toBe(first.revision)
    expect(f.jobs[1].snapshot.digest).not.toBe(f.jobs[0].snapshot.digest)
    expect(f.jobs[1].snapshot.files.some(file => file.path === "/unused asset.svg")).toBe(true)
    expect(f.jobs[1].origin).not.toBe(f.jobs[0].origin); expect(f.executions[0].close).toHaveBeenCalledOnce()
    await expect(d.transport.capture(d.project.id, d.authority, first.generation)).rejects.toThrow()
    await d.transport.stop(d.project.id, d.authority, second.generation)
    await expect(d.transport.capture(d.project.id, d.authority, second.generation)).rejects.toThrow()
    await d.transport.close(); await expect(d.start()).rejects.toThrow("closed")
    const restarted = new ControlledPreviewTransport(d.registry, process.cwd(), f.runner); transports.push(restarted)
    await expect(restarted.capture(d.project.id, d.authority, second.generation)).rejects.toThrow()
  })
  it("closes a late startup after shutdown; an abort is never counted as a running preview", async () => {
    const f = fake(); let release!: (execution: ControlledExecution) => void
    f.runner.open = vi.fn((_job, signal) => { f.signals.push(signal); return new Promise<ControlledExecution>(resolve => { release = resolve }) })
    const d = await setup(f.runner), pending = d.start(); const rejected = expect(pending).rejects.toThrow("stale")
    await vi.waitFor(() => expect(release).toBeTypeOf("function"))
    const sibling = d.registry.createSession(d.project.id)!
    await expect(d.transport.start(d.project.id, { ...sibling, operation: "preview" }, d.request())).rejects.toThrow("capacity")
    await d.transport.close(); expect(f.signals[0].aborted).toBe(true)
    const execution = { capture: async () => png, input: async () => {}, close: vi.fn(async () => {}) }
    release(execution); await rejected; expect(execution.close).toHaveBeenCalledOnce()
  })
  it("discards a revoked in-flight raster and serializes runner operations", async () => {
    const f = fake(), d = await setup(f.runner), view = await d.start()
    let release!: (bytes: Uint8Array) => void
    f.executions[0].capture = () => new Promise(resolve => { release = resolve })
    const pending = d.transport.capture(d.project.id, d.authority, view.generation)
    const rejected = expect(pending).rejects.toThrow("expired")
    await vi.waitFor(() => expect(release).toBeTypeOf("function"))
    await expect(d.transport.capture(d.project.id, d.authority, view.generation)).rejects.toThrow("not ready")
    d.registry.revokeSession(d.project.id, d.session.previewId); release(png); await rejected
    expect(f.executions[0].close).toHaveBeenCalledOnce()
  })
  it("quarantines after failed cleanup and rejects executable/malformed output", async () => {
    const f = fake(), d = await setup(f.runner), view = await d.start()
    f.executions[0].capture = async () => Buffer.from('<script>fetch("https://example.invalid")</script>')
    f.executions[0].close = async () => { throw Error("supervisor failed") }
    await expect(d.transport.capture(d.project.id, d.authority, view.generation)).rejects.toThrow("quarantined")
    await expect(d.start()).rejects.toThrow("quarantined")
  })
  it("rejects stale source before launch and failed startup never returns an HTML fallback", async () => {
    const runner = { open: vi.fn(async () => { throw Error("native sandbox unavailable") }) }, d = await setup(runner)
    await expect(d.transport.start(d.project.id, d.authority, { ...d.request(), revision: "old" })).rejects.toThrow("stale")
    expect(runner.open).not.toHaveBeenCalled()
    await expect(d.start()).rejects.toThrow("native sandbox unavailable")
    await expect(d.start()).rejects.toThrow("native sandbox unavailable")
    expect(runner.open).toHaveBeenCalledTimes(2)
  })
  it("copies validated routes before asynchronous boundaries and sweeps revocation without a browser callback", async () => {
    const f = fake(), d = await setup(f.runner), request = d.request()
    const pending = d.transport.start(d.project.id, d.authority, request)
    request.route = "https://example.invalid/poison"
    const view = await pending
    expect(f.jobs[0].route).toBe("/places/42?mode=quiet#details")
    const input = { type: "navigate" as const, route: "/places/7" }
    const dispatched = d.transport.input(d.project.id, d.authority, view.generation, input)
    input.route = "https://example.invalid/poison"
    await dispatched
    expect(f.executions[0].input).toHaveBeenCalledWith({ type: "navigate", route: "/places/7" })
    d.registry.revokeSession(d.project.id, d.session.previewId)
    await vi.waitFor(() => expect(f.executions[0].close).toHaveBeenCalledOnce())
  })
})
