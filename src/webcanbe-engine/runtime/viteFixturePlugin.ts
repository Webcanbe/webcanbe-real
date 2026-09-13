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
export function webCanBeFixturePlugin(projectRoot: string, options: { editorKey?: string; registry?: ProjectRegistry; runner?: RunnerProvider; hosted?: HostedSessionBoundary; leases?: SessionLeaseStore; artifacts?: ArtifactStore } = {}): Plugin {
  const registry = options.registry ?? new ProjectRegistry(projectRoot)
  const editorKey = options.editorKey ?? randomBytes(32).toString("base64url")
  if (options.hosted && (!options.runner || !options.leases || !options.artifacts)) throw new Error("Hosted foundation requires a controlled provider, durable leases and authorized artifacts.")
  const scheduled = options.hosted ? new ScheduledRunnerProvider(options.runner!, options.leases!, owner => registry.runnerAuthorized(owner)) : undefined
  const controlled = options.runner ? new ControlledPreviewTransport(registry, projectRoot, scheduled ?? options.runner, Date.now, options.artifacts) : undefined
  const viewer = new RasterViewerServer()
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
          const styleFiles = () => { const files = durable.files(); for (const file of ["tailwind.config.js", "tailwind.config.ts", "tailwind.config.cjs"]) { if (fs.existsSync(path.join(project.root, file))) files.set(file, "unsupported configuration present (not evaluated)") } return files }
          const width = viewportWidths[body.viewport as ViewportPreset] ?? 1280
          let analysis: ReturnType<typeof analyzeProjectStyles> | undefined
          const styles = () => analysis ??= analyzeProjectStyles(styleFiles(), Boolean(store.tailwind), width)
          const targets = () => styles().targets.map(target => ({ ...target, identity: { ...target.identity, revisionId: revision, contentHash: contentHash(store.read(target.identity.file) ?? "") } }))
          if (["inspect", "source"].includes(action) && typeof body.expectedRevision === "string" && body.expectedRevision !== revision) return send(409, { error: "Selection belongs to stale source. Rebuild and select again." })
          if (action === "compatibility") { const analyzed = targets(); return send(200, { summary: summarizeCompatibility(analyzed), targets: analyzed, breakpoints: styles().breakpoints, styleDiagnostics: styles().diagnostics, revision }) }
          if (action === "files") {
            const files = durable.files()
            if (body.file !== undefined && (typeof body.file !== "string" || !files.has(body.file))) return send(404, { error: "Source file is unavailable." })
            return send(200, { files: [...files].map(([file, source]) => ({ file, hash: contentHash(source) })), source: typeof body.file === "string" ? files.get(body.file) : undefined, revision })
          }
          if (action === "history") return send(200, { history: durable.history(), revision })
          if (action === "validate") {
            if (typeof body.file !== "string" || typeof body.content !== "string" || !durable.files().has(body.file)) return send(400, { error: "Select an authorized source file." })
            return send(200, { validation: await validateSource(new Map([[body.file, body.content]])), revision })
          }
          if (action === "export") {
            durable.assertBase(body.expectedRevision ?? revision)
            const validation = await validateStagedProject(project, projectRoot, durable.files(), "checkpoint")
            if (!validation.passed) return send(422, { error: "Export validation failed.", validation })
            durable.assertBase(revision)
            return send(200, { archive: (await exportProjectZip(project)).toString("base64"), revision, validation })
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
          const mutating = ["mutate", "code", "undo", "redo", "revert", "checkpoint"].includes(action)
          // Old visual clients get a deterministic request identity. New clients
          // supply a UUID and retain it for transport retries.
          const requestHash = contentHash(JSON.stringify({ action, base: body.expectedRevision, identity: body.identity, edit: body.edit, operations: body.operations, transactionId: body.transactionId }))
          const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : `legacy_${requestHash}`
          if (mutating && (!/^[a-zA-Z0-9_-]{8,160}$/.test(idempotencyKey))) return send(400, { error: "A bounded idempotency key is required." })
          const result = (transaction: NonNullable<ReturnType<typeof durable.retry>>, replayed = false) => send(transaction.success ? 200 : 422, { transaction, replayed, validation: transaction.validation, error: transaction.error, diff: transaction.success ? formatTransactionDiff(transaction) : undefined, revision: registry.revision(project.id) })
          if (mutating) {
            const retried = durable.retry(idempotencyKey, requestHash)
            if (retried && account && retried.actor !== account.userId) throw new SourceConflict("Idempotency key belongs to another actor.")
            if (retried) return result(retried, true)
            durable.assertBase(body.expectedRevision)
          }
          const authorize = () => {
            assertAccess()
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
            entry.actor = account?.userId ?? "local-operator"
            authorize(); durable.assertBase(revision)
            if (!validation.passed) { durable.reject(entry); return result(entry) }
            controlled?.holdForSourceCommit(project.id, previewId, operations.some(op => op.kind !== "update"))
            return result(durable.commit({ expectedRevision: revision, operations, entry, authorize, reverts: inverse?.transactionId, redo: action === "redo", checkpoint: action === "checkpoint" }))
          }
          const identity = body.identity as SourceIdentity | undefined
          if (!identity || typeof identity.file !== "string" || !Number.isInteger(identity.elementStart) || identity.elementStart < 0) return send(400, { error: "Invalid source identity." })
          if ((identity.revisionId && identity.revisionId !== revision) || (identity.contentHash && identity.contentHash !== contentHash(store.read(identity.file) ?? ""))) return send(409, { error: "Stale SourceAnchor. Rebuild and select again." })
          const target = targets().find(item => item.identity.file === identity.file && item.identity.elementStart === identity.elementStart)
          if (!target) return send(404, { error: "Unknown source identity." })
          if (action === "inspect" || action === "source") return send(200, { target, breakpoints: styles().breakpoints, styleDiagnostics: styles().diagnostics, source: store.read(identity.file), revision })
          if (action !== "mutate") return send(404, { error: "Unknown operation." })
          const edit = body.edit as Record<string, unknown> | undefined
          if (typeof edit?.value !== "string" || edit.value.length > 4096) return send(400, { error: "Invalid edit value." })
          if (edit.type === "text" && (target.repeated || /; (?:[2-9]|[1-9]\d+) statically/.test(target.effectScope ?? "")) && edit.scope !== "source") return send(422, { error: "This source definition has repeated/shared uses. Choose source scope or edit the invocation in Code." })
          const stagedFiles = durable.files(), originalFiles = new Map(stagedFiles)
          const draftStore: SourceStore = { tailwind: store.tailwind, read: file => stagedFiles.get(file), write: (file, content, expected) => { if (stagedFiles.get(file) !== expected) throw new SourceConflict("Draft source changed."); stagedFiles.set(file, content) } }
          const mutation = edit.type === "text" ? patchText(draftStore, identity, edit.value)
            : ["style", "responsive", "layout"].includes(String(edit.type)) ? patchProjectStyle(draftStore, styleFiles(), identity, edit.property as StyleProperty, edit.value, { breakpoint: typeof edit.breakpoint === "string" ? edit.breakpoint : undefined, viewport: edit.type === "responsive" ? edit.viewport as ViewportPreset : undefined, scope: typeof edit.scope === "string" ? edit.scope : undefined, semantic: edit.type === "layout" })
            : edit.type === "reorder" ? patchSiblingReorder(draftStore, stagedFiles, identity, edit.value, body.viewport as ViewportPreset, typeof edit.scope === "string" ? edit.scope : undefined) : undefined
          if (!mutation) return send(400, { error: "Unsupported mutation." })
          if (!mutation.success) return send(422, { transaction: mutation, error: mutation.error, revision })
          const operations: FileOperation[] = [...stagedFiles].filter(([file, source]) => source !== originalFiles.get(file)).map(([file, content]) => ({ kind: "update", file, content, expectedHash: contentHash(originalFiles.get(file)!) }))
          const validation = edit.type === "reorder" ? await validateStagedProject(project, projectRoot, stagedFiles, "compile") : await validateSource(new Map(operations.map(op => [op.file, stagedFiles.get(op.file)!])))
          const entry = transactionEntry(project.id, revision, "visual", idempotencyKey, requestHash, `Visual ${edit.type}: ${mutation.file}`, validation, mutation)
          entry.actor = account?.userId ?? "local-operator"
          authorize(); durable.assertBase(revision)
          if (!validation.passed) { durable.reject(entry); return result(entry) }
          controlled?.holdForSourceCommit(project.id, previewId, operations.some(op => op.kind !== "update"))
          return result(durable.commit({ expectedRevision: revision, operations, entry, authorize }))
        } catch (error) { return json(response, error instanceof AuthorityDenied ? 403 : error instanceof SourceConflict ? 409 : 400, { error: error instanceof Error ? redactSecrets(error.message, [editorKey, projectRoot, registry.importedRoot, String(request.headers.cookie ?? ""), String(request.headers["x-wcb-csrf"] ?? "")]).slice(0, 1500) : "The project operation was rejected." }) }
        finally { release?.() }
      })
    },
  }
}
