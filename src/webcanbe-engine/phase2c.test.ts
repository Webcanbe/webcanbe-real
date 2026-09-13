import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { request as httpRequest } from "node:http"
import { afterEach, describe, expect, it } from "vitest"
import { createServer } from "vite"
import { webCanBeFixturePlugin } from "./runtime/viteFixturePlugin"
import { ProjectRegistry, extractSafeZip } from "./runtime/projectRegistry"
import { exportProjectZip } from "./runtime/projectExport"
import { buildIsolatedHttpPreview, buildIsolatedPreview, requiresHttpPreview } from "./runtime/isolatedPreview"
import { HttpPreviewServer, previewResourcePath } from "./runtime/httpPreviewServer"
import { previewEnvelope } from "./runtime/previewEnvelope"
import { safePreviewRoute } from "./bridge/previewRoute"
import { PREVIEW_SECURITY_NOTICE, HTTP_PREVIEW_BLOCKER } from "./bridge/previewSecurity"
import { isPreviewMessage, PREVIEW_CHANNEL } from "./bridge/previewProtocol"
import { analyzeReactSource } from "./adapters/react/reactSourceAdapter"
import { patchText, patchStyle, formatTransactionDiff } from "./mutations/sourceMutations"

const temporary: string[] = [], listeners: HttpPreviewServer[] = []
afterEach(async () => { for (const listener of listeners.splice(0)) await listener.close(); for (const directory of temporary.splice(0)) fs.rmSync(directory, { recursive: true, force: true }) })
function temp() { const directory = fs.mkdtempSync(path.join(os.tmpdir(), "wcb-2c-")); temporary.push(directory); return directory }
async function setup(name = "coast-paths", clock = Date.now) {
  const root = temp()
  fs.cpSync(path.join(process.cwd(), "fixtures/compatible-react-vite"), path.join(root, "fixtures/compatible-react-vite"), { recursive: true })
  const registry = new ProjectRegistry(root, clock)
  const source = { ...registry.get("phase1-fixture")!, root: path.join(process.cwd(), "fixtures", name) }
  const project = await registry.importZip(name, await exportProjectZip(source))
  const session = registry.createSession(project.id)!
  const server = new HttpPreviewServer(registry, process.cwd(), clock); listeners.push(server)
  return { registry, project, session, server }
}
function get(origin: string, resource: string, headers: Record<string, string> = {}, method = "GET") {
  const url = new URL(origin)
  return new Promise<{ status: number; headers: import("node:http").IncomingHttpHeaders; body: string }>((resolve, reject) => {
    const req = httpRequest({ hostname: "127.0.0.1", port: url.port, path: resource, method, headers: { Host: url.host, ...headers } }, response => { const chunks: Buffer[] = []; response.on("data", chunk => chunks.push(chunk)); response.on("end", () => resolve({ status: response.statusCode!, headers: response.headers, body: Buffer.concat(chunks).toString() })) })
    req.on("error", reject); req.end()
  })
}
const navigation = { Accept: "text/html,application/xhtml+xml", "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Dest": "iframe" }
async function start(setup: Awaited<ReturnType<typeof importSetup>>, route = "/") { return setup.server.start(setup.project, setup.session.previewId, route, "http://127.0.0.1:5183") }
// Named alias avoids shadowing the helper's parameter in ReturnType.
const importSetup = setup
async function bootstrap(result: Awaited<ReturnType<typeof start>>) {
  const url = result.html.match(/http:\/\/wcb-[^" ]+\/_wcb\/start\?ticket=[\w-]+/)![0]
  const response = await get(result.origin, new URL(url).pathname + new URL(url).search)
  expect(response.status).toBe(303)
  return { cookie: response.headers["set-cookie"]![0].split(";")[0], ticketPath: new URL(url).pathname + new URL(url).search, response }
}

describe("HTTP compiler transport and unchanged source", () => {
  it.each(["coast-paths", "harbor-desk"])("compiles %s, retaining its router/config and real text/style/history/export", async name => {
    const { registry, project, session } = await setup(name)
    const canonical = ["src/App.jsx", "package.json", "package-lock.json", "vite.config.js"].map(file => [file, fs.readFileSync(path.join(project.root, file), "utf8")] as const)
    expect(requiresHttpPreview(project)).toBe(true)
    await expect(buildIsolatedPreview(project, process.cwd())).rejects.toThrow("HTTP preview runner")
    const built = await buildIsolatedHttpPreview(project, process.cwd())
    expect(built.files.get("/_wcb/app.js")?.contentType).toContain("javascript")
    expect(built.files.has(name === "coast-paths" ? "/compass.svg" : "/badge.svg")).toBe(true)
    expect(built.html.indexOf('id="root"')).toBeLessThan(built.html.indexOf('src="/_wcb/app.js"'))
    for (const [file, content] of canonical) expect(fs.readFileSync(path.join(project.root, file), "utf8")).toBe(content)
    const store = registry.store(project.id, { ...session, operation: "mutate" })!
    const file = name === "coast-paths" ? "src/pages/Place.jsx" : "src/App.jsx"
    const targets = () => analyzeReactSource(file, store.read(file)!, store.read)
    const target = targets().find(item => item.elementName === "h1" && item.text?.includes(name === "coast-paths" ? "closer" : "Project notes"))!
    const transaction = patchText(store, target.identity, "A real nested-route source change.")
    expect(transaction.success).toBe(true); project.history.record(transaction)
    expect(formatTransactionDiff(transaction)).toContain("+A real nested-route")
    expect(project.history.undo(store)).toBeDefined(); expect(project.history.redo(store)).toBeDefined()
    const main = targets().find(item => item.elementName === "main")!
    const style = patchStyle(store, main.identity, "padding", "40px")
    expect(style.success).toBe(true); project.history.record(style)
    expect(project.history.undo(store)).toBeDefined(); expect(project.history.redo(store)).toBeDefined()
    const destination = path.join(temp(), "export")
    await extractSafeZip(await exportProjectZip(project), destination)
    expect(fs.readFileSync(path.join(destination, file), "utf8")).toContain("A real nested-route source change.")
    expect(fs.readFileSync(path.join(destination, file), "utf8")).not.toMatch(/data-wcb-id|__webcanbe|generation/)
    for (const file of ["package.json", "package-lock.json", "vite.config.js"]) expect(fs.readFileSync(path.join(destination, file), "utf8")).toBe(canonical.find(item => item[0] === file)![1])
  })
  it("recognizes nested and aliased router imports without weakening the Blob guard", async () => {
    const data = await setup()
    fs.writeFileSync(path.join(data.project.sourceRoot, "App.jsx"), "export { App } from './pages/Router'")
    fs.writeFileSync(path.join(data.project.sourceRoot, "pages/Router.jsx"), "import * as Routing from 'react-router-dom'; export const App=()=> <Routing.BrowserRouter><h1>Nested router</h1></Routing.BrowserRouter>")
    expect(requiresHttpPreview(data.project)).toBe(true)
    await expect(buildIsolatedPreview(data.project, process.cwd())).rejects.toThrow("HTTP preview runner")
  })
  it("never publishes source maps, config, private files or linked public assets", async () => {
    const { project } = await setup()
    for (const file of [".hidden.svg", "app.js", "bundle.js.map", "package.json"]) fs.writeFileSync(path.join(project.root, "public", file), "private metadata")
    const built = await buildIsolatedHttpPreview(project, process.cwd())
    for (const file of ["/.hidden.svg", "/app.js", "/bundle.js.map", "/package.json"]) expect(built.files.has(file)).toBe(false)
    fs.symlinkSync(path.join(project.root, "package.json"), path.join(project.root, "public/escape.svg"))
    await expect(buildIsolatedHttpPreview(project, process.cwd())).rejects.toThrow("links")
  })
})

describe("authorized HTTP artifacts, isolation and lifecycle", () => {
  it("requires a live server session; bootstrap is single-use, host-only and read-only", async () => {
    const data = await setup()
    await expect(data.server.start(data.project, "forged", "/", "http://127.0.0.1:5183")).rejects.toThrow("unauthorized")
    const result = await start(data, "/places/42?mode=quiet#details")
    expect(result.html).not.toContain(data.session.capability)
    expect((await get(result.origin, "/", navigation)).status).toBe(403)
    expect((await get(result.origin, "/_wcb/start?ticket=forged")).status).toBe(403)
    const { cookie, ticketPath, response } = await bootstrap(result)
    expect(response.headers.location).toBe("/places/42?mode=quiet#details")
    expect(response.headers["set-cookie"]![0]).toMatch(/HttpOnly; Secure; SameSite=None; Partitioned/)
    expect(response.headers["set-cookie"]![0]).not.toMatch(/Domain=/i)
    expect((await get(result.origin, ticketPath)).status).toBe(403)
    expect(data.registry.authorize(data.project.id, data.session.previewId, cookie.split("=")[1], "mutate")).toBe(false)
    expect((await get(result.origin, "/", { ...navigation, Cookie: cookie })).headers["content-type"]).toContain("text/html")
  })
  it("serves permitted HTML navigation but returns typed 404s for missing resources and reserved paths", async () => {
    const data = await setup(), result = await start(data), { cookie } = await bootstrap(result)
    for (const route of ["/", "/places/42?mode=quiet", "/application-owned-unknown", "/deep/nested/path/"]) {
      const response = await get(result.origin, route, { ...navigation, Cookie: cookie })
      expect(response.status).toBe(200); expect(response.headers["content-type"]).toContain("text/html"); expect(response.body).toContain('id="root"')
      expect(response.headers["cache-control"]).toContain("no-store")
    }
    for (const file of ["/missing.js", "/missing.css", "/missing.png", "/api", "/api/users", "/__webcanbe/api", "/.env", "/.git/config", "/package.json", "/vite.config.js", "/src/App.jsx", "/_wcb/nope", "/bundle.js.map"]) {
      const response = await get(result.origin, file, { ...navigation, Cookie: cookie })
      expect(response.status, file).toBe(404); expect(response.headers["content-type"]).toContain("text/plain"); expect(response.body).not.toContain('id="root"')
    }
    expect((await get(result.origin, "/extensionless-image", { Cookie: cookie, Accept: "*/*", "Sec-Fetch-Dest": "image" })).status).toBe(404)
    const script = await get(result.origin, "/_wcb/app.js", { Cookie: cookie })
    expect(script.status).toBe(200); expect(script.headers["content-type"]).toContain("javascript"); expect(script.body).toContain("data-wcb-id")
    const image = await get(result.origin, "/compass.svg", { Cookie: cookie })
    expect(image.status).toBe(200); expect(image.headers["content-type"]).toBe("image/svg+xml"); expect(image.body).toContain("<svg")
    expect((await get(result.origin, "/_wcb/app.js", { Cookie: cookie }, "HEAD")).body).toBe("")
    expect(script.headers).not.toHaveProperty("access-control-allow-origin")
  })
  it("denies preview A's credential at B and rejects forged hosts, methods and duplicate cookies", async () => {
    const data = await setup(), a = await start(data), authA = await bootstrap(a)
    const otherProject = await data.registry.importZip("other-project", await exportProjectZip({ ...data.project, root: path.join(process.cwd(), "fixtures/harbor-desk") }))
    const second = data.registry.createSession(otherProject.id)!
    const b = await data.server.start(otherProject, second.previewId, "/desk/", "http://127.0.0.1:5183")
    await bootstrap(b)
    expect(new URL(a.origin).hostname).not.toBe(new URL(b.origin).hostname)
    expect((await get(b.origin, "/_wcb/app.js", { Cookie: authA.cookie })).status).toBe(403)
    expect((await get(a.origin, "/_wcb/app.js", { Cookie: authA.cookie, Host: "forged.localhost" })).status).toBe(403)
    expect((await get(a.origin, "/_wcb/app.js", { Cookie: authA.cookie + "; " + authA.cookie })).status).toBe(403)
    expect((await get(a.origin, "/_wcb/app.js", { Cookie: authA.cookie }, "POST")).status).toBe(405)
  })
  it("expires, revokes, stops and rebuilds without retaining readable stale artifacts", async () => {
    let now = Date.now()
    const data = await setup("coast-paths", () => now), a = await start(data), authA = await bootstrap(a)
    expect(data.server.status(data.session.previewId).state).toBe("ready")
    const b = await start(data), authB = await bootstrap(b)
    expect(a.origin).not.toBe(b.origin)
    expect((await get(a.origin, "/_wcb/app.js", { Cookie: authA.cookie })).status).toBe(403)
    data.server.stop(data.session.previewId)
    expect(data.server.status(data.session.previewId).state).toBe("stopped")
    expect((await get(b.origin, "/_wcb/app.js", { Cookie: authB.cookie })).status).toBe(403)
    const c = await start(data), authC = await bootstrap(c)
    now += 600_000
    expect((await get(c.origin, "/_wcb/app.js", { Cookie: authC.cookie })).status).toBe(403)
    expect(data.server.status(data.session.previewId).state).toBe("expired")
    await expect(start(data)).rejects.toThrow("expired")
    const renewed = data.registry.createSession(data.project.id)!
    const d = await data.server.start(data.project, renewed.previewId, "/", "http://127.0.0.1:5183"), authD = await bootstrap(d)
    data.registry.revokeSession(data.project.id, renewed.previewId)
    expect((await get(d.origin, "/_wcb/app.js", { Cookie: authD.cookie })).status).toBe(403)
    expect(data.registry.authorize(data.project.id, renewed.previewId, renewed.capability, "mutate")).toBe(false)
  })
  it("cleans failed starts and limits active resources", async () => {
    const data = await setup()
    const source = path.join(data.project.sourceRoot, "main.jsx"), original = fs.readFileSync(source, "utf8")
    fs.writeFileSync(source, 'import "unknown-package"')
    await expect(start(data)).rejects.toThrow()
    expect(data.server.status(data.session.previewId).state).toBe("failed")
    fs.writeFileSync(source, original)
    await start(data)
    for (let i = 0; i < 3; ++i) await data.server.start(data.project, data.registry.createSession(data.project.id)!.previewId, "/", "http://127.0.0.1:5183")
    await expect(data.server.start(data.project, data.registry.createSession(data.project.id)!.previewId, "/", "http://127.0.0.1:5183")).rejects.toThrow("capacity")
  })
})

describe("path, confinement envelope and bridge inputs", () => {
  it.each(["/../private", "/%2e%2e/private", "/%252e%252e/private", "/a/%2f../private", "/a\\b", "//outside/x", "http://outside/x", "/a/%00", "/a/%5c", "/%2eenv"])("rejects raw or encoded escape %s", value => expect(previewResourcePath(value)).toBeUndefined())
  it("does not accept upstream URLs or malformed bridge observations", () => {
    for (const value of ["//evil.example", "https://evil.example/", "/\\evil", "/x\n", "/x%0aheader"]) expect(safePreviewRoute(value)).toBe(false)
    expect(safePreviewRoute("/desk/projects/23?tab=notes#summary")).toBe(true)
    const base = { channel: PREVIEW_CHANNEL, type: "route", session: "session", generation: "generation" }
    expect(isPreviewMessage({ ...base, route: "https://evil.example" })).toBe(false)
    expect(isPreviewMessage({ ...base, route: "/x?query#anchor" })).toBe(true)
    expect(isPreviewMessage({ ...base, type: "mutate", identity: { file: "src/App.jsx", elementStart: 1 } })).toBe(false)
    expect(isPreviewMessage({ ...base, type: "select", element: { tagName: "h1", identity: { file: "../secret", elementStart: -1 }, rect: { top: 0, left: 0, width: Infinity, height: 1 } } })).toBe(false)
    const html = previewEnvelope({ origin: "http://wcb-example.localhost:1234", bootstrap: "http://wcb-example.localhost:1234/_wcb/start?ticket=readonly", editorOrigin: "http://127.0.0.1:5183", session: "session", generation: "generation", expiresAt: Date.now() + 10_000 })
    expect(html).toContain("frame-src http://wcb-example.localhost:1234;")
    expect(html).not.toContain("allow-same-origin"); expect(html).not.toContain("allow-top-navigation")
  })
})


describe("fail-closed editor admission", () => {
  it("refuses HTTP even with client-supplied enable flags, while keeping revision-bound source inspection and export", async () => {
    const data = await setup()
    const server = await createServer({ configFile: false, root: process.cwd(), cacheDir: path.join(temp(), "vite-cache"), plugins: [webCanBeFixturePlugin(process.cwd(), { registry: data.registry, editorKey: "synthetic-operator" })], server: { host: "127.0.0.1", port: 0 }, logLevel: "silent" })
    await server.listen()
    try {
      const origin = 'http://127.0.0.1:' + (server.httpServer!.address() as { port: number }).port
      const request = async (action: string, body: object = {}, key = "synthetic-operator", requestOrigin = origin) => {
        const response = await fetch(origin + '/__webcanbe/api/projects/' + data.project.id + '/' + action, { method: 'POST', headers: { Origin: requestOrigin, 'Content-Type': 'application/json', 'X-WCB-Editor-Key': key }, body: JSON.stringify({ ...data.session, ...body }) })
        return { status: response.status, data: await response.json() }
      }
      expect((await request("preview", {}, "")).status).toBe(403)
      expect((await request("preview", {}, "synthetic-operator", "null")).status).toBe(403)
      const blocked = await request("preview", { transport: "http", allowUnsafe: true, runnerApproved: true })
      expect(blocked.status).toBe(422)
      expect(blocked.data.error).toBe(HTTP_PREVIEW_BLOCKER)
      const status = await request("preview", { command: "status" })
      expect(status.data).toMatchObject({ state: "unavailable", transport: "http", reason: HTTP_PREVIEW_BLOCKER })
      expect(status.data.html).toBeUndefined()
      expect(blocked.data.requiredCapability).toContain("native browser sandbox")
      expect(blocked.data.revision).toBe(data.registry.revision(data.project.id))
      expect(blocked.data.html).toBeUndefined(); expect(blocked.data.origin).toBeUndefined()
      const file = "src/pages/Place.jsx", store = data.registry.store(data.project.id)!
      const identity = analyzeReactSource(file, store.read(file)!, store.read).find(item => item.elementName === "h1")!.identity
      expect((await request("inspect", { identity, expectedRevision: blocked.data.revision })).status).toBe(200)
      expect((await request("inspect", { identity, expectedRevision: "stale" })).status).toBe(409)
      expect((await request("export")).status).toBe(200)
      expect((await request("preview", { command: "stop" })).status).toBe(200)
      expect((await request("mutate", { identity, expectedRevision: blocked.data.revision, edit: { type: "text", value: "Revoked" } })).status).toBe(403)
    } finally { await server.close() }
  })
  it("reserves compiler capacity before asynchronous startup and cannot restart a closed registry", async () => {
    const data = await setup(), second = data.registry.createSession(data.project.id)!
    const first = start(data)
    await expect(data.server.start(data.project, second.previewId, "/", "http://127.0.0.1:5183")).rejects.toThrow("capacity")
    await first
    await data.server.close()
    await expect(start(data)).rejects.toThrow("closed")
  })
  it("expires unused bootstrap tickets before the underlying source session", async () => {
    let now = Date.now()
    const data = await setup("coast-paths", () => now), result = await start(data)
    const url = new URL(result.html.match(/http:\/\/wcb-[^" ]+\/_wcb\/start\?ticket=[\w-]+/)![0])
    now += 30_000
    expect((await get(result.origin, url.pathname + url.search)).status).toBe(403)
    expect(data.registry.sessionActive(data.project.id, data.session.previewId)).toBe(true)
  })
})


it("preserves safe Unicode source identities but rejects malformed computed payloads", () => {
  const message = { channel: PREVIEW_CHANNEL, type: "hover", session: "session", generation: "generation", element: { tagName: "h1", identity: { file: "src/\u00e9dition/Title.jsx", elementStart: 1 }, rect: { top: 0, left: 0, width: 100, height: 20 }, computed: { color: "red" } } }
  expect(isPreviewMessage(message)).toBe(true)
  expect(isPreviewMessage({ ...message, element: { ...message.element, computed: [] } })).toBe(false)
})


describe("verified preview security messaging", () => {
  it("qualifies CSP rather than claiming complete browser egress containment", () => {
    expect(PREVIEW_SECURITY_NOTICE).toContain("parent DOM and storage access are denied")
    expect(PREVIEW_SECURITY_NOTICE).toContain("CSP restricts fetch and resource loads")
    expect(PREVIEW_SECURITY_NOTICE).toContain("CSP does not block all browser egress, including WebRTC/RTC networking")
    expect(PREVIEW_SECURITY_NOTICE).toContain("HTTP previews remain disabled pending a tested defense-in-depth solution")
    expect(PREVIEW_SECURITY_NOTICE).not.toMatch(/network calls are disabled|all networking disabled|previews run offline/i)
  })
  it("states the concrete disabled-HTTP blocker without suggesting a sandbox relaxation", () => {
    expect(HTTP_PREVIEW_BLOCKER).toContain("HTTP preview is disabled")
    expect(HTTP_PREVIEW_BLOCKER).toContain("WebRTC/RTC networking can bypass CSP network restrictions")
    expect(HTTP_PREVIEW_BLOCKER).toContain("tested defense-in-depth solution")
    expect(HTTP_PREVIEW_BLOCKER).not.toMatch(/allow-same-origin|disable.*sandbox|allowUnsafe/)
  })
})
