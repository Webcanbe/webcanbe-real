import { LocalDraftStore } from "./draftStore"
import { executeSourceOperation } from "./sourceApi"
import type { HostedLoginBoundary } from "./hostedIdentity"
import { AuthorityDenied, roleOperations, type HostedSessionBoundary, type ServerSession } from "./hostedAuthority"
import { ScheduledRunnerProvider, type SessionLeaseStore } from "./runnerScheduler"
import type { ArtifactStore } from "./storageContracts"
import { redactSecrets } from "./previewSecrets"
import { analyzeProjectStyles, viewportWidths } from "../adapters/react/projectStyles"
import { ControlledPreviewTransport, type RunnerProvider, type PreviewInput } from "./controlledPreview"
import { RasterViewerServer } from "./rasterViewer"
import { randomBytes, timingSafeEqual } from "node:crypto"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { Plugin } from "vite"
import fs from "node:fs"
import path from "node:path"
import { summarizeCompatibility } from "../core/compatibility"
import type { FileOperation, SourceIdentity, StyleProperty, ViewportPreset } from "../core/types"
import { formatTransactionDiff, patchProjectStyle, patchSiblingReorder, patchText } from "../mutations/sourceMutations"
import { ProjectRegistry, type SessionOperation } from "./projectRegistry"
import { exportProjectZip } from "./projectExport"
import { inspectRuntime, RuntimeCompatibilityError } from "./runtimeCompatibility"
import { buildIsolatedPreview, requiresHttpPreview } from "./isolatedPreview"
import { contentHash, SourceConflict, transactionEntry } from "../mutations/durableSource"
import { validateSource, validateStagedProject } from "../mutations/sourceValidation"
import type { SourceStore } from "../mutations/sourceMutations"
import { HTTP_PREVIEW_BLOCKER } from "../bridge/previewSecurity"

function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" })
  response.end(JSON.stringify(value))
}
async function readBody(request: IncomingMessage, limit: number) {
  const chunks: Buffer[] = []; let size = 0
  for await (const raw of request) { const chunk = Buffer.from(raw); size += chunk.length; if (size > limit) throw new Error("Request is too large."); chunks.push(chunk) }
  const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"))
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid request object.")
  return body as Record<string, unknown>
}
function publicProject(project: NonNullable<ReturnType<ProjectRegistry["get"]>>) {
  const { history: _history, root: _root, sourceRoot: _sourceRoot, ...safe } = project
  return safe
}
export function validEditorOrigin(request: IncomingMessage) {
  try { const origin = new URL(request.headers.origin ?? ""); return ["localhost", "127.0.0.1"].includes(origin.hostname) && origin.protocol === "http:" && origin.host === request.headers.host } catch { return false }
}
function matchesKey(supplied: unknown, expected: string) { return typeof supplied === "string" && Buffer.byteLength(supplied) === Buffer.byteLength(expected) && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected)) }

/** Local development adapter with an explicitly injected hosted session boundary.
 * The default remains single-operator; injection is not a deployed login service. */
export function webCanBeFixturePlugin(projectRoot: string, options: { editorKey?: string; registry?: ProjectRegistry; runner?: RunnerProvider; hosted?: HostedSessionBoundary; leases?: SessionLeaseStore; artifacts?: ArtifactStore; fastRefresh?: boolean; login?: HostedLoginBoundary } = {}): Plugin {
  if (options.login && !options.hosted) throw new Error("Login requires the hosted cookie/session boundary.")
  const registry = options.registry ?? new ProjectRegistry(projectRoot)
  const editorKey = options.editorKey ?? randomBytes(32).toString("base64url")
  if (options.hosted && (!options.runner || !options.leases || !options.artifacts)) throw new Error("Hosted foundation requires a controlled provider, durable leases and authorized artifacts.")
  const scheduled = options.hosted ? new ScheduledRunnerProvider(options.runner!, options.leases!, owner => registry.runnerAuthorized(owner)) : undefined
  const controlled = options.runner ? new ControlledPreviewTransport(registry, projectRoot, scheduled ?? options.runner, Date.now, options.artifacts, { fastRefresh: options.fastRefresh }) : undefined
  const viewer = new RasterViewerServer()
  const drafts = new LocalDraftStore(path.join(registry.importedRoot, "..", "drafts"))
  let importBusy = false
  return {
    name: "webcanbe-compatible-preview-runtime",
    apply: "serve",
    configureServer(server) {
      server.httpServer?.once("close", () => {
        void (async () => {
          try { try { await controlled?.close() } finally { await scheduled?.close() } }
          catch { server.config.logger.error("WebCanBe runner cleanup is uncertain; admission remains closed and operator recovery is required.") }
          finally { await viewer.close() }
        })()
      })
      if (!options.hosted && !options.editorKey) server.config.logger.info(`WebCanBe local editor access key (this server run only): ${editorKey}`)
      // Imported source must never reach Vite transforms or the application origin as executable code.
      server.middlewares.use((request, response, next) => {
        let url: string
        try { url = decodeURIComponent((request.url ?? "").split("?")[0]).replace(/\\/g, "/") } catch { return json(response, 400, { error: "Invalid path." }) }
        if (!(options.hosted ? request.headers.host === new URL(options.hosted.origins.editorOrigin).host : /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(request.headers.host ?? "")) || /(?:\.webcanbe|\/fixtures\/|\/__webcanbe\/(?:preview|fixture)\/)/i.test(url)) return json(response, 403, { error: "Project content is available only through the authorized sandbox preview." })
        next()
      })
      if (options.login) server.middlewares.use((request, response, next) => {
        void options.login!.handle(request, response).then(handled => { if (!handled) next() }).catch(() => { if (response.headersSent) response.destroy(); else json(response, 403, { error: "Identity is unavailable." }) })
      })
      server.middlewares.use("/__webcanbe/api", async (request, response) => {
        if (!options.hosted && !validEditorOrigin(request)) return json(response, 403, { error: "Editor request origin denied." })
        if (request.method !== "POST") return json(response, 405, { error: "Method not allowed." })
        if (!options.hosted && !matchesKey(request.headers["x-wcb-editor-key"], editorKey)) return json(response, 403, { error: "Local editor access key required." })
        let release: (() => void) | undefined
        let account: ServerSession | undefined
        let assertAccess = () => {}
        // Reauthorize every response after asynchronous work, including exports,
        // compilation and history; stale membership must not release bytes.
        const send = (status: number, value: unknown) => { assertAccess(); return json(response, status, value) }
        try {
          if (options.hosted) { account = options.hosted.authenticate(request); assertAccess = () => { if (!options.hosted!.sessions.active(account!)) throw new AuthorityDenied() } }
          const requestPath = request.url?.split("?")[0] ?? ""
          const body = await readBody(request, requestPath === "/projects/import" ? 36 * 1024 * 1024 : 8 * 1024 * 1024)
          if (options.hosted && ["userId", "root", "sourceRoot", "role"].some(key => key in body)) throw new AuthorityDenied()
          if (requestPath === "/projects/import") {
            const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : ""
            if (account) { options.hosted!.memberships.requireWorkspace(account, workspaceId); assertAccess = () => options.hosted!.memberships.requireWorkspace(account!, workspaceId) }
            if (importBusy) return send(409, { error: "A project import is in progress. Retry when it completes." })
            importBusy = true; release = () => { importBusy = false }
            if (typeof body.archive !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.archive)) return send(400, { error: "A base64 ZIP archive is required." })
            const project = await registry.importZip(typeof body.name === "string" ? body.name.slice(0, 200) : "Imported project", Buffer.from(body.archive, "base64"))
            if (account) { try { options.hosted!.memberships.registerProject(account, workspaceId, project.id) } catch (error) { await registry.discardImport(project.id); throw error } }
            return send(201, { project: publicProject(project) })
          }
          if (requestPath === "/projects") return send(200, { projects: registry.list().filter(project => !account || options.hosted!.memberships.projects(account).includes(project.id)) })
          const route = /^\/projects\/([a-z0-9-]{8,80})\/(\w+)$/i.exec(requestPath)
          const project = route && registry.get(route[1])
          if (!route || !project) return send(account ? 403 : 404, { error: "Project is unavailable." })
          const action = route[2] as SessionOperation | "session"
          const grant = account && options.hosted!.memberships.grant(account, project.id, action === "session" ? "inspect" : action)
          if (grant) {
            if (body.workspaceId !== undefined && body.workspaceId !== grant.workspaceId) throw new AuthorityDenied()
            assertAccess = () => { if (!options.hosted!.memberships.check(grant, action === "session" ? "inspect" : action)) throw new AuthorityDenied() }
          }
          release = await registry.lock(project.id)
          assertAccess()
          if (action === "session") return send(201, { session: registry.createSession(project.id, grant ? roleOperations(grant.role) : undefined, grant ? { grant, check: operation => options.hosted!.memberships.check(grant, operation) } : undefined), project: publicProject(project), runtime: inspectRuntime(project, projectRoot), compatibilityDimensions: {
            runtimeExecution: { admitted: inspectRuntime(project, projectRoot).supported, transport: controlled ? "controlled-raster" : "legacy-local" },
            visualEditability: { status: "per-element-analysis", scoreIsVisualOnly: true },
            codeEditing: { scope: "src", role: grant?.role ?? "local-operator" },
            configurationSupport: inspectRuntime(project, projectRoot).configuration,
            securityAdmission: { controlledRunnerRequired: Boolean(options.hosted), importedNodeExecution: false },
            exportBuild: { status: "validation-required", originalSourcePreserved: true },
            hostedReadiness: { status: "UNPROVEN", publicImportReady: false }
          }, role: grant?.role, hostedReadiness: "UNPROVEN" })
          const previewId = typeof body.previewId === "string" ? body.previewId : ""
          const capability = typeof body.capability === "string" ? body.capability : ""
          if (account && registry.sessionBinding(project.id, previewId)?.grant.sessionId !== account.sessionId) throw new AuthorityDenied()
          if (!registry.authorize(project.id, previewId, capability, action)) return send(403, { error: "Capability is invalid, expired, or outside its scope." })
          const store = registry.store(project.id, { previewId, capability, operation: action })
          if (!store) return send(403, { error: "Project source root is unavailable or changed." })
          const durable = registry.durable(project.id)
          const revision = registry.revision(project.id)
          if (action === "drafts") {
            const actor = account?.userId ?? "local-operator"
            assertAccess()
            if (body.command !== undefined && body.command !== "save") return send(400, { error: "Unknown draft operation." })
            return send(200, { draftState: body.command === "save" ? drafts.write(project.id, actor, body.version, body.drafts) : drafts.read(project.id, actor) })
          }
          if (action === "preview") {
            if (["capture", "input", "update"].includes(String(body.command)) && body.expectedRevision !== undefined && body.expectedRevision !== revision) return send(409, { error: "Preview frame belongs to stale source." })
            try {
              if (body.command === "stop") { registry.revokeSession(project.id, previewId); await controlled?.sweep(); return send(200, { state: "stopped" }) }
              if (controlled) {
                const authority = { previewId, capability, operation: "preview" as const }
                if (body.command === "update") {
                  const preview = await controlled.update(project.id, authority, String(body.generation ?? ""), revision)
                  return send(200, { ...preview, viewerUrl: options.hosted && !options.hosted.localQa ? options.hosted.origins.viewerOrigin + "/" : await viewer.start() })
                }
                if (body.command === "status") return send(200, { state: "available", transport: "raster", revision })
                if (body.command === "capture") {
                  const result = await controlled.capture(project.id, authority, String(body.generation ?? ""))
                  const { bytes, ...metadata } = result
                  return send(200, { ...metadata, png: bytes.toString("base64") })
                }
                if (body.command === "input") {
                  if (!Number.isSafeInteger(body.sequence) || Number(body.sequence) < 1) throw new Error("A current preview frame is required.")
                  await controlled.input(project.id, authority, String(body.generation ?? ""), body.input as PreviewInput, Number(body.sequence))
                  return send(200, { revision })
                }
                if (body.command !== undefined && body.command !== "start") throw new Error("Unknown controlled preview command.")
                const preview = await controlled.start(project.id, authority, { revision, route: typeof body.route === "string" ? body.route : "/" })
                return send(200, { ...preview, viewerUrl: options.hosted && !options.hosted.localQa ? options.hosted.origins.viewerOrigin + "/" : await viewer.start() })
              }
              if (body.command === "status") return send(200, { state: "unavailable", transport: "http", reason: HTTP_PREVIEW_BLOCKER, requiredCapability: "Approved browser network-isolation runner" })
              // The HTTP compiler/server prototype is intentionally NOT reachable here.
              // Chromium CSP does not constrain WebRTC. See the Phase 2C report before
              // introducing any approved runner; a browser-supplied flag is not attestation.
              if (requiresHttpPreview(project)) throw new RuntimeCompatibilityError([{ code: "http-network-boundary", message: HTTP_PREVIEW_BLOCKER, requiredCapability: "OS-enforced preview browser network isolation with the native browser sandbox retained" }])
              const preview = { html: await buildIsolatedPreview(project, projectRoot), transport: "blob", generation: randomBytes(16).toString("hex") }
              if (revision !== registry.revision(project.id)) return send(409, { error: "Source changed during compilation. Rebuild the preview." })
              return send(200, { ...preview, revision })
            }
            catch (error) { assertAccess(); return send(422, { revision, error: error instanceof RuntimeCompatibilityError ? error.message : "Preview could not resolve the project: " + (error instanceof Error ? redactSecrets(error.message, [editorKey, capability, project.root, projectRoot]).slice(0, 1500) : "Unsupported source"), runtime: inspectRuntime(project, projectRoot), requiredCapability: error instanceof RuntimeCompatibilityError ? error.issues.map(issue => issue.requiredCapability).join("; ") : "A compatible dependency profile or isolated HTTP/configuration runner" }) }
          }
          const authorize = () => {
            assertAccess()
            if (!registry.authorize(project.id, previewId, capability, action) || !registry.store(project.id, { previewId, capability, operation: action })) throw new Error("Source commit authority expired or changed.")
          }
          const result = await executeSourceOperation({ project, projectRoot, durable, store, action, body, actor: account?.userId ?? "local-operator", assertAccess, authorize,
            beforeCommit: structural => controlled?.holdForSourceCommit(project.id, previewId, structural) })
          return send(result.status, result.value)
        } catch (error) { return json(response, error instanceof AuthorityDenied ? 403 : error instanceof SourceConflict ? 409 : 400, { error: error instanceof Error ? redactSecrets(error.message, [editorKey, projectRoot, registry.importedRoot, String(request.headers.cookie ?? ""), String(request.headers["x-wcb-csrf"] ?? "")]).slice(0, 1500) : "The project operation was rejected." }) }
        finally { release?.() }
      })
    },
  }
}
