import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto"
import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http"
import { buildIsolatedHttpPreview, type HttpPreviewBuild } from "./isolatedPreview"
import { ProjectRegistry, type ProjectRecord } from "./projectRegistry"
import { previewEnvelope } from "./previewEnvelope"
import { safePreviewRoute } from "../bridge/previewRoute"

type State = "starting" | "ready" | "failed" | "stopped" | "expired"
type Entry = { projectId: string; session: string; generation: string; state: State; expiresAt: number; origin: string; host: string; ticketHash: string; ticketUntil: number; cookieHash: string; route: string; build?: HttpPreviewBuild }
const hash = (value: string) => createHash("sha256").update(value).digest("hex")
const matches = (value: string, expected: string) => expected.length === 64 && timingSafeEqual(Buffer.from(hash(value)), Buffer.from(expected))
const cookieName = "__Host-wcb-preview"

export function previewResourcePath(raw: string) {
  if (raw.length > 4096 || !raw.startsWith("/") || raw.startsWith("//") || /[\\\x00-\x20\x7f#]/.test(raw)) return undefined
  try {
    const pathname = decodeURIComponent(raw.split("?")[0])
    if (/[\\%\x00-\x20\x7f]/.test(pathname) || pathname.includes("//") || pathname.split("/").some(part => part.startsWith("."))) return undefined
    if (/^\/(?:api|__webcanbe|src|node_modules)(?:\/|$)/i.test(pathname)) return undefined
    if (/(?:^|\/)(?:package(?:-lock)?\.json|.*\.map|.*\.[cm]?[jt]sx?|vite\.config[^/]*|tsconfig[^/]*)$/i.test(pathname) && !/^\/_wcb\/(?:app|bridge)\.js$/.test(pathname)) return undefined
    return pathname
  } catch { return undefined }
}

/** PROTOTYPE ONLY: not registered by the editor API until an approved browser runner exists.
 * Read-only artifacts: no proxy, filesystem handler, uploaded Node or WebSockets.
 * CSP alone cannot block WebRTC; this listener does not claim browser network isolation. */
export class HttpPreviewServer {
  private server?: Server
  private listening?: Promise<number>
  private closed = false
  private readonly entries = new Map<string, Entry>()
  private readonly hosts = new Map<string, Entry>()
  private readonly sweep: ReturnType<typeof setInterval>
  constructor(private readonly registry: ProjectRegistry, private readonly applicationRoot: string, private readonly now = Date.now) {
    this.sweep = setInterval(() => this.expire(), 1000)
    this.sweep.unref()
  }
  private async port() {
    if (!this.listening) this.listening = new Promise<number>((resolve, reject) => {
      const server = createServer((request, response) => this.serve(request, response))
      this.server = server
      server.maxConnections = 32; server.maxHeadersCount = 32
      server.headersTimeout = 5000; server.requestTimeout = 5000; server.keepAliveTimeout = 1000
      server.on("upgrade", (_request, socket) => socket.destroy())
      server.once("error", reject)
      server.listen(0, "127.0.0.1", () => resolve((server.address() as { port: number }).port))
    })
    return this.listening
  }
  private remove(entry: Entry, state: State) {
    this.hosts.delete(entry.host); entry.build = undefined; entry.ticketHash = ""; entry.cookieHash = ""; entry.state = state
  }
  expire() {
    for (const entry of this.entries.values()) if (entry.expiresAt <= this.now() || !this.registry.sessionActive(entry.projectId, entry.session)) this.remove(entry, "expired")
    for (const [id, entry] of this.entries) if (entry.expiresAt + 60_000 < this.now()) this.entries.delete(id)
  }
  stop(session: string) { const entry = this.entries.get(session); if (entry) this.remove(entry, "stopped") }
  status(session: string) { this.expire(); const entry = this.entries.get(session); return entry ? { state: entry.state, generation: entry.generation, expiresAt: entry.expiresAt } : { state: "stopped" as const } }
  async start(project: ProjectRecord, session: string, route: string, editorOrigin: string) {
    if (this.closed) throw new Error("HTTP preview registry is closed.")
    this.expire()
    const expiresAt = this.registry.sessionExpiry(project.id, session)
    if (!expiresAt || !this.registry.sessionActive(project.id, session)) throw new Error("HTTP preview session is unauthorized or expired.")
    if (!safePreviewRoute(route) || !previewResourcePath(route.split('#')[0]) || /^\/_wcb(?:\/|$)/.test(route)) throw new Error("Invalid preview entry route.")
    const editor = new URL(editorOrigin)
    if (editor.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(editor.hostname) || editor.origin !== editorOrigin) throw new Error("Invalid editor origin.")
    this.stop(session)
    if (this.hosts.size >= 4 || [...this.entries.values()].filter(entry => entry.state === "starting").length >= 1) throw new Error("HTTP preview capacity reached (four active previews, one compiler).")
    if (this.entries.size >= 100 && !this.entries.has(session)) throw new Error("HTTP preview session limit reached.")
    const generation = randomUUID()
    const ticket = randomBytes(32).toString("base64url")
    const entry: Entry = { projectId: project.id, session, generation, state: "starting", expiresAt, origin: "", host: "", ticketHash: hash(ticket), ticketUntil: this.now() + 30_000, cookieHash: "", route }
    this.entries.set(session, entry)
    try {
      const port = await this.port()
      if (this.closed || entry.state !== "starting") throw new Error("Preview stopped during startup.")
      const host = "wcb-" + generation + ".localhost:" + port, origin = "http://" + host
      entry.host = host; entry.origin = origin
      const build = await buildIsolatedHttpPreview(project, this.applicationRoot)
      if (entry.state !== "starting" || !this.registry.sessionActive(project.id, session) || this.now() >= expiresAt) throw new Error("Preview expired or stopped during compilation.")
      entry.build = build; entry.state = "ready"; entry.ticketUntil = this.now() + 30_000; this.hosts.set(host, entry)
      return { transport: "http" as const, generation, origin, expiresAt, state: entry.state, html: previewEnvelope({ origin, bootstrap: origin + '/_wcb/start?ticket=' + ticket, editorOrigin, session, generation, expiresAt }) }
    } catch (error) { this.remove(entry, "failed"); throw error }
  }
  private serve(request: IncomingMessage, response: ServerResponse) {
    const deny = (status: number) => { response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox", "Referrer-Policy": "no-referrer" }); response.end("Preview resource unavailable.") }
    this.expire()
    const entry = this.hosts.get(request.headers.host ?? "")
    if (!entry || entry.state !== "ready" || !entry.build) return deny(403)
    if (!["GET", "HEAD"].includes(request.method ?? "") || request.headers['transfer-encoding'] || Number(request.headers['content-length'] ?? 0) > 0) return deny(405)
    const resource = previewResourcePath(request.url ?? "")
    if (!resource) return deny(404)
    if (resource === "/_wcb/start") {
      const ticket = new URL(request.url!, entry.origin).searchParams.get("ticket") ?? ""
      if (request.method !== "GET" || this.now() >= entry.ticketUntil || !matches(ticket, entry.ticketHash)) return deny(403)
      // The ticket grants this preview's reads only. It is single-use and never a mutation capability.
      const cookie = randomBytes(32).toString("base64url")
      entry.ticketHash = ""; entry.cookieHash = hash(cookie)
      response.writeHead(303, { "Location": entry.route, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'", "Set-Cookie": cookieName + '=' + cookie + '; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=' + Math.max(0, Math.floor((entry.expiresAt - this.now()) / 1000)) })
      return response.end()
    }
    const cookies = (request.headers.cookie ?? "").split(';').map(part => part.trim()).filter(part => part.startsWith(cookieName + '='))
    if (cookies.length !== 1 || !matches(cookies[0].slice(cookieName.length + 1), entry.cookieHash)) return deny(403)
    const artifact = entry.build.files.get(resource)
    const navigation = request.headers['sec-fetch-mode'] === 'navigate' && request.headers['sec-fetch-dest'] === 'iframe' && /(?:^|,)\s*text\/html(?:\s*;[^,]*)?(?:,|$)/i.test(request.headers.accept ?? '')
    const spa = !artifact && navigation && !resource.startsWith('/_wcb') && !resource.split('/').at(-1)?.includes('.')
    if (!artifact && !spa) return deny(404)
    // Imported HTML executes only inside the editor's confinement envelope.
    if (artifact && request.headers['sec-fetch-dest'] === 'document') return deny(403)
    const csp = "default-src 'none'; script-src " + entry.origin + "/_wcb/; style-src " + entry.origin + " 'unsafe-inline'; img-src " + entry.origin + " data:; font-src " + entry.origin + " data:; connect-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; sandbox allow-scripts;"
    response.writeHead(200, { "Content-Type": artifact?.contentType ?? "text/html; charset=utf-8", "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Content-Security-Policy": csp, "X-DNS-Prefetch-Control": "off", "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=()" })
    response.end(request.method === "HEAD" ? undefined : artifact?.body ?? entry.build.html)
  }
  async close() {
    this.closed = true
    clearInterval(this.sweep)
    for (const entry of this.entries.values()) this.remove(entry, "stopped")
    this.entries.clear(); this.hosts.clear()
    if (this.server) { this.server.closeAllConnections(); await new Promise<void>(resolve => this.server!.close(() => resolve())) }
    this.server = undefined; this.listening = undefined
  }
}
