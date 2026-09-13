import { ControlledPreviewTransport, type RunnerProvider, type PreviewInput } from "./controlledPreview"
import { RasterViewerServer } from "./rasterViewer"
import { randomBytes, timingSafeEqual } from "node:crypto"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { Plugin } from "vite"
import { analyzeReactSource } from "../adapters/react/reactSourceAdapter"
import { summarizeCompatibility } from "../core/compatibility"
import type { FileOperation, SourceIdentity, StyleProperty, ViewportPreset } from "../core/types"
import { formatTransactionDiff, patchResponsiveStyle, patchSemanticLayout, patchStyle, patchText } from "../mutations/sourceMutations"
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

/** Development-only single-operator authentication. Hosted accounts are intentionally not implied. */
export function webCanBeFixturePlugin(projectRoot: string, options: { editorKey?: string; registry?: ProjectRegistry; runner?: RunnerProvider } = {}): Plugin {
  const registry = options.registry ?? new ProjectRegistry(projectRoot)
  const editorKey = options.editorKey ?? randomBytes(32).toString("base64url")
  const controlled = options.runner ? new ControlledPreviewTransport(registry, projectRoot, options.runner) : undefined
  const viewer = new RasterViewerServer()
  let importBusy = false
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
        let release: (() => void) | undefined
        try {
          const requestPath = request.url?.split("?")[0] ?? ""
          const body = await readBody(request, requestPath === "/projects/import" ? 36 * 1024 * 1024 : 8 * 1024 * 1024)
          if (requestPath === "/projects/import") {
            if (importBusy) return json(response, 409, { error: "A project import is in progress. Retry when it completes." })
            importBusy = true; release = () => { importBusy = false }
            if (typeof body.archive !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.archive)) return json(response, 400, { error: "A base64 ZIP archive is required." })
            const project = await registry.importZip(typeof body.name === "string" ? body.name.slice(0, 200) : "Imported project", Buffer.from(body.archive, "base64"))
            return json(response, 201, { project: publicProject(project) })
          }
          if (requestPath === "/projects") return json(response, 200, { projects: registry.list() })
          const route = /^\/projects\/([a-z0-9-]{8,80})\/(\w+)$/i.exec(requestPath)
          const project = route && registry.get(route[1])
          if (!route || !project) return json(response, 404, { error: "Project is unavailable." })
          release = await registry.lock(project.id)
          const action = route[2] as SessionOperation | "session"
          if (action === "session") return json(response, 201, { session: registry.createSession(project.id), project: publicProject(project), runtime: inspectRuntime(project, projectRoot) })
          const previewId = typeof body.previewId === "string" ? body.previewId : ""
          const capability = typeof body.capability === "string" ? body.capability : ""
          if (!registry.authorize(project.id, previewId, capability, action)) return json(response, 403, { error: "Capability is invalid, expired, or outside its scope." })
          const store = registry.store(project.id, { previewId, capability, operation: action })
          if (!store) return json(response, 403, { error: "Project source root is unavailable or changed." })
          const durable = registry.durable(project.id)
          const revision = registry.revision(project.id)
          const targets = () => registry.sourceFiles(project.id).flatMap(file => analyzeReactSource(file, store.read(file) ?? "", store.read, { tailwind: project.detection.tailwind }).map(target => ({ ...target, identity: { ...target.identity, revisionId: revision, contentHash: contentHash(store.read(file) ?? "") }, effectScope: target.component ? `Source definition in ${file}; all rendered instances of this definition may change.` : "Source location; shared styles may affect every matching element." })))
          if (["inspect", "source"].includes(action) && typeof body.expectedRevision === "string" && body.expectedRevision !== revision) return json(response, 409, { error: "Selection belongs to stale source. Rebuild and select again." })
          if (action === "compatibility") { const analyzed = targets(); return json(response, 200, { summary: summarizeCompatibility(analyzed), targets: analyzed, revision }) }
          if (action === "files") {
            const files = durable.files()
            if (body.file !== undefined && (typeof body.file !== "string" || !files.has(body.file))) return json(response, 404, { error: "Source file is unavailable." })
            return json(response, 200, { files: [...files].map(([file, source]) => ({ file, hash: contentHash(source) })), source: typeof body.file === "string" ? files.get(body.file) : undefined, revision })
          }
          if (action === "history") return json(response, 200, { history: durable.history(), revision })
          if (action === "validate") {
            if (typeof body.file !== "string" || typeof body.content !== "string" || !durable.files().has(body.file)) return json(response, 400, { error: "Select an authorized source file." })
            return json(response, 200, { validation: await validateSource(new Map([[body.file, body.content]])), revision })
          }
          if (action === "export") {
            durable.assertBase(body.expectedRevision ?? revision)
            const validation = await validateStagedProject(project, projectRoot, durable.files(), "checkpoint")
            if (!validation.passed) return json(response, 422, { error: "Export validation failed.", validation })
            durable.assertBase(revision)
            return json(response, 200, { archive: (await exportProjectZip(project)).toString("base64"), revision, validation })
          }
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
          const mutating = ["mutate", "code", "undo", "redo", "revert", "checkpoint"].includes(action)
          // Old visual clients get a deterministic request identity. New clients
          // supply a UUID and retain it for transport retries.
          const requestHash = contentHash(JSON.stringify({ action, base: body.expectedRevision, identity: body.identity, edit: body.edit, operations: body.operations, transactionId: body.transactionId }))
          const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : `legacy_${requestHash}`
          if (mutating && (!/^[a-zA-Z0-9_-]{8,160}$/.test(idempotencyKey))) return json(response, 400, { error: "A bounded idempotency key is required." })
          const result = (transaction: NonNullable<ReturnType<typeof durable.retry>>, replayed = false) => json(response, transaction.success ? 200 : 422, { transaction, replayed, validation: transaction.validation, error: transaction.error, diff: transaction.success ? formatTransactionDiff(transaction) : undefined, revision: registry.revision(project.id) })
          if (mutating) {
            const retried = durable.retry(idempotencyKey, requestHash)
            if (retried) return result(retried, true)
            durable.assertBase(body.expectedRevision)
          }
          const authorize = () => {
            if (!registry.authorize(project.id, previewId, capability, action) || !registry.store(project.id, { previewId, capability, operation: action })) throw new Error("Source commit authority expired or changed.")
          }
          if (["code", "undo", "redo", "revert", "checkpoint"].includes(action)) {
            const inverse = ["undo", "redo", "revert"].includes(action) ? durable.revertOperations(typeof body.transactionId === "string" ? body.transactionId : undefined, action === "redo") : undefined
            const operations = inverse?.operations ?? (action === "checkpoint" ? [] : body.operations as FileOperation[])
            const staged = action === "checkpoint" ? durable.files() : durable.prepare(operations).after
            const validation = await validateStagedProject(project, projectRoot, staged, action === "checkpoint" ? "checkpoint" : "compile")
            const entry = transactionEntry(project.id, revision, action === "code" ? "code" : "system", idempotencyKey, requestHash, action === "code" ? `Code save: ${operations.map(op => op.file).join(", ")}` : `${action}: ${inverse?.transactionId ?? "validated source"}`, validation)
            entry.file = operations[0]?.file ?? ""
            entry.operations = operations
            entry.editType = action === "code" ? "code" : action === "checkpoint" ? "checkpoint" : action === "redo" ? "redo" : "revert"
            authorize(); durable.assertBase(revision)
            if (!validation.passed) { durable.reject(entry); return result(entry) }
            return result(durable.commit({ expectedRevision: revision, operations, entry, authorize, reverts: inverse?.transactionId, redo: action === "redo", checkpoint: action === "checkpoint" }))
          }
          const identity = body.identity as SourceIdentity | undefined
          if (!identity || typeof identity.file !== "string" || !Number.isInteger(identity.elementStart) || identity.elementStart < 0) return json(response, 400, { error: "Invalid source identity." })
          if ((identity.revisionId && identity.revisionId !== revision) || (identity.contentHash && identity.contentHash !== contentHash(store.read(identity.file) ?? ""))) return json(response, 409, { error: "Stale SourceAnchor. Rebuild and select again." })
          const target = targets().find(item => item.identity.file === identity.file && item.identity.elementStart === identity.elementStart)
          if (!target) return json(response, 404, { error: "Unknown source identity." })
          if (action === "inspect" || action === "source") return json(response, 200, { target, source: store.read(identity.file), revision })
          if (action !== "mutate") return json(response, 404, { error: "Unknown operation." })
          const edit = body.edit as Record<string, unknown> | undefined
          if (typeof edit?.value !== "string" || edit.value.length > 4096) return json(response, 400, { error: "Invalid edit value." })
          const stagedFiles = durable.files(), originalFiles = new Map(stagedFiles)
          const draftStore: SourceStore = { tailwind: store.tailwind, read: file => stagedFiles.get(file), write: (file, content, expected) => { if (stagedFiles.get(file) !== expected) throw new SourceConflict("Draft source changed."); stagedFiles.set(file, content) } }
          const mutation = edit.type === "text" ? patchText(draftStore, identity, edit.value)
            : edit.type === "style" ? patchStyle(draftStore, identity, edit.property as StyleProperty, edit.value)
            : edit.type === "responsive" ? patchResponsiveStyle(draftStore, identity, edit.property as StyleProperty, edit.value, edit.viewport as ViewportPreset)
            : edit.type === "layout" ? patchSemanticLayout(draftStore, identity, edit.property as StyleProperty, edit.value) : undefined
          if (!mutation) return json(response, 400, { error: "Unsupported mutation." })
          if (!mutation.success) return json(response, 422, { transaction: mutation, error: mutation.error, revision })
          const operations: FileOperation[] = [...stagedFiles].filter(([file, source]) => source !== originalFiles.get(file)).map(([file, content]) => ({ kind: "update", file, content, expectedHash: contentHash(originalFiles.get(file)!) }))
          const validation = await validateSource(new Map(operations.map(op => [op.file, stagedFiles.get(op.file)!])))
          const entry = transactionEntry(project.id, revision, "visual", idempotencyKey, requestHash, `Visual ${edit.type}: ${mutation.file}`, validation, mutation)
          authorize(); durable.assertBase(revision)
          if (!validation.passed) { durable.reject(entry); return result(entry) }
          return result(durable.commit({ expectedRevision: revision, operations, entry, authorize }))
        } catch (error) { return json(response, error instanceof SourceConflict ? 409 : 400, { error: error instanceof Error ? error.message.slice(0, 1500) : "The project operation was rejected." }) }
        finally { release?.() }
      })
    },
  }
}
