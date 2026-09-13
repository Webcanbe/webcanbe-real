import { ControlledPreviewTransport, type RunnerProvider, type PreviewInput } from "./controlledPreview"
import { RasterViewerServer } from "./rasterViewer"
import { randomBytes, timingSafeEqual } from "node:crypto"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { Plugin } from "vite"
import { analyzeReactSource } from "../adapters/react/reactSourceAdapter"
import { summarizeCompatibility } from "../core/compatibility"
import type { SourceIdentity, StyleProperty, ViewportPreset } from "../core/types"
import { formatTransactionDiff, patchResponsiveStyle, patchSemanticLayout, patchStyle, patchText } from "../mutations/sourceMutations"
import { ProjectRegistry, type SessionOperation } from "./projectRegistry"
import { exportProjectZip } from "./projectExport"
import { inspectRuntime, RuntimeCompatibilityError } from "./runtimeCompatibility"
import { buildIsolatedPreview, requiresHttpPreview } from "./isolatedPreview"
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

/** Development-only single-operator authentication. Hosted accounts are intentionally not implied. */
export function webCanBeFixturePlugin(projectRoot: string, options: { editorKey?: string; registry?: ProjectRegistry; runner?: RunnerProvider } = {}): Plugin {
  const registry = options.registry ?? new ProjectRegistry(projectRoot)
  const editorKey = options.editorKey ?? randomBytes(32).toString("base64url")
  const controlled = options.runner ? new ControlledPreviewTransport(registry, projectRoot, options.runner) : undefined
  const viewer = new RasterViewerServer()
  let busy = false
  return {
    name: "webcanbe-compatible-preview-runtime",
    apply: "serve",
    configureServer(server) {
      server.httpServer?.once("close", () => { void controlled?.close(); void viewer.close() })
      if (!options.editorKey) server.config.logger.info(`WebCanBe local editor access key (this server run only): ${editorKey}`)
      // Imported source must never reach Vite transforms or the application origin as executable code.
      server.middlewares.use((request, response, next) => {
        let url: string
        try { url = decodeURIComponent((request.url ?? "").split("?")[0]).replace(/\\/g, "/") } catch { return json(response, 400, { error: "Invalid path." }) }
        if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(request.headers.host ?? "") || /(?:\.webcanbe|\/fixtures\/|\/__webcanbe\/(?:preview|fixture)\/)/i.test(url)) return json(response, 403, { error: "Project content is available only through the authorized sandbox preview." })
        next()
      })
      server.middlewares.use("/__webcanbe/api", async (request, response) => {
        if (!validEditorOrigin(request)) return json(response, 403, { error: "Editor request origin denied." })
        if (request.method !== "POST") return json(response, 405, { error: "Method not allowed." })
        if (!matchesKey(request.headers["x-wcb-editor-key"], editorKey)) return json(response, 403, { error: "Local editor access key required." })
        const previewIO = /^\/projects\/[a-z0-9-]{8,80}\/preview(?:\?|$)/i.test(request.url ?? "")
        if (!previewIO && busy) return json(response, 409, { error: "An engine operation is in progress. Retry when it completes." })
        if (!previewIO) busy = true
        try {
          const requestPath = request.url?.split("?")[0] ?? ""
          const body = await readBody(request, requestPath === "/projects/import" ? 36 * 1024 * 1024 : 64 * 1024)
          if (requestPath === "/projects/import") {
            if (typeof body.archive !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.archive)) return json(response, 400, { error: "A base64 ZIP archive is required." })
            const project = await registry.importZip(typeof body.name === "string" ? body.name.slice(0, 200) : "Imported project", Buffer.from(body.archive, "base64"))
            return json(response, 201, { project: publicProject(project) })
          }
          if (requestPath === "/projects") return json(response, 200, { projects: registry.list() })
          const route = /^\/projects\/([a-z0-9-]{8,80})\/(\w+)$/i.exec(requestPath)
          const project = route && registry.get(route[1])
          if (!route || !project) return json(response, 404, { error: "Project is unavailable." })
          const action = route[2] as SessionOperation | "session"
          if (action === "session") return json(response, 201, { session: registry.createSession(project.id), project: publicProject(project), runtime: inspectRuntime(project, projectRoot) })
          const previewId = typeof body.previewId === "string" ? body.previewId : ""
          const capability = typeof body.capability === "string" ? body.capability : ""
          if (!registry.authorize(project.id, previewId, capability, action)) return json(response, 403, { error: "Capability is invalid, expired, or outside its scope." })
          const store = registry.store(project.id, { previewId, capability, operation: action })
          if (!store) return json(response, 403, { error: "Project source root is unavailable or changed." })
          const targets = () => registry.sourceFiles(project.id).flatMap(file => analyzeReactSource(file, store.read(file) ?? "", store.read, { tailwind: project.detection.tailwind }))
          const revision = registry.revision(project.id)
          if (["inspect", "source"].includes(action) && typeof body.expectedRevision === "string" && body.expectedRevision !== revision) return json(response, 409, { error: "Selection belongs to stale source. Rebuild and select again." })
          if (action === "compatibility") return json(response, 200, { summary: summarizeCompatibility(targets()), targets: targets(), revision })
          if (action === "export") return json(response, 200, { archive: (await exportProjectZip(project)).toString("base64") })
          if (action === "preview") {
            try {
              if (body.command === "stop") { registry.revokeSession(project.id, previewId); await controlled?.sweep(); return json(response, 200, { state: "stopped" }) }
              if (controlled) {
                const authority = { previewId, capability, operation: "preview" as const }
                if (body.command === "status") return json(response, 200, { state: "available", transport: "raster", revision })
                if (body.command === "capture") {
                  const result = await controlled.capture(project.id, authority, String(body.generation ?? ""))
                  const { bytes, ...metadata } = result
                  return json(response, 200, { ...metadata, png: bytes.toString("base64") })
                }
                if (body.command === "input") {
                  if (!Number.isSafeInteger(body.sequence) || Number(body.sequence) < 1) throw new Error("A current preview frame is required.")
                  await controlled.input(project.id, authority, String(body.generation ?? ""), body.input as PreviewInput, Number(body.sequence))
                  return json(response, 200, { revision })
                }
                if (body.command !== undefined && body.command !== "start") throw new Error("Unknown controlled preview command.")
                const preview = await controlled.start(project.id, authority, { revision, route: typeof body.route === "string" ? body.route : "/" })
                return json(response, 200, { ...preview, viewerUrl: await viewer.start() })
              }
              if (body.command === "status") return json(response, 200, { state: "unavailable", transport: "http", reason: HTTP_PREVIEW_BLOCKER, requiredCapability: "Approved browser network-isolation runner" })
              // The HTTP compiler/server prototype is intentionally NOT reachable here.
              // Chromium CSP does not constrain WebRTC. See the Phase 2C report before
              // introducing any approved runner; a browser-supplied flag is not attestation.
              if (requiresHttpPreview(project)) throw new RuntimeCompatibilityError([{ code: "http-network-boundary", message: HTTP_PREVIEW_BLOCKER, requiredCapability: "OS-enforced preview browser network isolation with the native browser sandbox retained" }])
              const preview = { html: await buildIsolatedPreview(project, projectRoot), transport: "blob", generation: randomBytes(16).toString("hex") }
              if (revision !== registry.revision(project.id)) return json(response, 409, { error: "Source changed during compilation. Rebuild the preview." })
              return json(response, 200, { ...preview, revision })
            }
            catch (error) { return json(response, 422, { revision, error: error instanceof RuntimeCompatibilityError ? error.message : "Preview could not resolve the project: " + (error instanceof Error ? error.message.slice(0, 1500) : "Unsupported source"), runtime: inspectRuntime(project, projectRoot), requiredCapability: error instanceof RuntimeCompatibilityError ? error.issues.map(issue => issue.requiredCapability).join("; ") : "A compatible dependency profile or isolated HTTP/configuration runner" }) }
          }
          if (["mutate", "undo", "redo"].includes(action) && (typeof body.expectedRevision !== "string" || body.expectedRevision !== revision)) return json(response, 409, { error: "Source changed. Inspect it again before editing." })
          if (action === "undo" || action === "redo") {
            const transaction = action === "undo" ? project.history.undo(store) : project.history.redo(store)
            return transaction ? json(response, 200, { transaction, diff: formatTransactionDiff(transaction, action === "undo"), revision: registry.revision(project.id) }) : json(response, 422, { error: `Nothing safe to ${action}.` })
          }
          const identity = body.identity as SourceIdentity | undefined
          if (!identity || typeof identity.file !== "string" || !Number.isInteger(identity.elementStart) || identity.elementStart < 0) return json(response, 400, { error: "Invalid source identity." })
          const target = targets().find(item => item.identity.file === identity.file && item.identity.elementStart === identity.elementStart)
          if (!target) return json(response, 404, { error: "Unknown source identity." })
          if (action === "inspect" || action === "source") return json(response, 200, { target, source: store.read(identity.file), revision })
          if (action !== "mutate") return json(response, 404, { error: "Unknown operation." })
          const edit = body.edit as Record<string, unknown> | undefined
          if (typeof edit?.value !== "string" || edit.value.length > 4096) return json(response, 400, { error: "Invalid edit value." })
          const mutation = edit.type === "text" ? patchText(store, identity, edit.value)
            : edit.type === "style" ? patchStyle(store, identity, edit.property as StyleProperty, edit.value)
            : edit.type === "responsive" ? patchResponsiveStyle(store, identity, edit.property as StyleProperty, edit.value, edit.viewport as ViewportPreset)
            : edit.type === "layout" ? patchSemanticLayout(store, identity, edit.property as StyleProperty, edit.value) : undefined
          if (!mutation) return json(response, 400, { error: "Unsupported mutation." })
          if (mutation.success) project.history.record(mutation)
          return json(response, mutation.success ? 200 : 422, { transaction: mutation, diff: mutation.success ? formatTransactionDiff(mutation) : undefined, revision: registry.revision(project.id) })
        } catch { return json(response, 400, { error: "The project operation was rejected. Check the archive limits and source constraints." }) }
        finally { if (!previewIO) busy = false }
      })
    },
  }
}
