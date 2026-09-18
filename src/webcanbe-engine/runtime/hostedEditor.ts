import { readPublicRuntimeValues, type PublicRuntimeValueProvider } from "./publicRuntimeValues"
import { TrustedStaticAssets } from "./staticAssets"
import { ManagedSecretRunnerProvider, type ManagedPreviewSecrets } from "./managedPreviewSecrets"
import { sourceReference, type ExternalSourceProvider } from "./externalSource"
import { PostgresDraftStore } from "./draftStore"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { Pool } from "pg"
import type { Plugin } from "vite"
import { AuthorityDenied, writeOperations, type HostedOriginPolicy } from "./hostedAuthority"
import { HostedLoginBoundary, type IdentityProvider } from "./hostedIdentity"
import { PostgresIdentityStore, PostgresSessionBoundary } from "./postgresIdentity"
import { PostgresAccess, PostgresArtifactStore, PostgresProjectStore } from "./postgresStores"
import { PostgresLeaseStore } from "./postgresFencing"
import { HostedLinuxRunnerProvider, type HostedRunnerHost } from "./hostedLinuxRunner"
import { HostedProjectRegistry } from "./hostedProjectRegistry"
import { ControlledPreviewTransport, type PreviewInput } from "./controlledPreview"
import { withHostedSource } from "./postgresSourceCheckout"
import { executeSourceOperation, type SourceResponse } from "./sourceApi"
import { inspectRuntime } from "./runtimeCompatibility"
import { SourceConflict } from "../mutations/durableSource"
import type { SessionOperation } from "./projectRegistry"
import { PostgresProductDomainStore } from "./postgresProductDomain"
import { HostedProductController } from "./hostedProductController"
import { hostedIsolatedAssessmentWorker, type IsolatedAssessmentWorker } from "./isolatedAssessmentWorker"

function json(response: ServerResponse, result: SourceResponse) {
  response.writeHead(result.status, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" })
  response.end(JSON.stringify(result.value))
}
async function bodyOf(request: IncomingMessage, limit: number) {
  const chunks: Buffer[] = []; let size = 0
  for await (const value of request) { const bytes = Buffer.from(value); size += bytes.length; if (size > limit) throw new Error("Request too large."); chunks.push(bytes) }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"))
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid request.")
  return value as Record<string, unknown>
}

/** Complete async HTTP composition. Shares source authoring semantics with the
 * local editor, but never constructs its local registry or SQLite scheduler.
 * Infrastructure is server configured; request IDs only reference scoped state. */
export class HostedEditor {
  readonly identity: PostgresIdentityStore
  readonly access: PostgresAccess
  readonly drafts: PostgresDraftStore
  readonly source: PostgresProjectStore
  readonly artifacts: PostgresArtifactStore
  readonly registry: HostedProjectRegistry
  readonly leases: PostgresLeaseStore
  readonly provider: HostedLinuxRunnerProvider
  readonly controlled: ControlledPreviewTransport
  readonly boundary: PostgresSessionBoundary
  readonly login: HostedLoginBoundary
  readonly products: PostgresProductDomainStore
  readonly productController: HostedProductController
  readonly assessmentWorker: IsolatedAssessmentWorker
  private recoveryTimer: ReturnType<typeof setInterval>
  private recovery?: Promise<void>
  private productRecovery?: Promise<void>
  constructor(readonly applicationRoot: string, readonly options: { pool: Pool; origins: HostedOriginPolicy; hosts: readonly HostedRunnerHost[]; identityProvider: IdentityProvider; allowSelfRegistration?: boolean; fastRefresh?: boolean; publicRuntimeValueProvider?: PublicRuntimeValueProvider; staticAssets?: TrustedStaticAssets; externalSourceProvider?: ExternalSourceProvider; managedSecrets?: ManagedPreviewSecrets; onError?: (error: unknown) => void }) {
    this.identity = new PostgresIdentityStore(options.pool, { allowSelfRegistration: options.allowSelfRegistration === true })
    this.access = new PostgresAccess(options.pool)
    this.source = new PostgresProjectStore(this.access)
    this.drafts = new PostgresDraftStore(this.access)
    this.artifacts = new PostgresArtifactStore(this.access)
    this.registry = new HostedProjectRegistry(this.access, this.source, applicationRoot)
    this.leases = new PostgresLeaseStore(options.pool)
    this.provider = new HostedLinuxRunnerProvider(this.leases, options.hosts, owner => this.registry.runnerAuthorized(owner))
    this.controlled = new ControlledPreviewTransport(this.registry, applicationRoot, options.managedSecrets ? new ManagedSecretRunnerProvider(this.provider, options.managedSecrets) : this.provider, Date.now, this.artifacts, { fastRefresh: options.fastRefresh, publicRuntimeValueProvider: options.publicRuntimeValueProvider, staticAssets: options.staticAssets })
    this.boundary = new PostgresSessionBoundary(this.identity, options.origins)
    this.login = new HostedLoginBoundary(options.origins.editorOrigin, options.identityProvider, this.identity, this.identity)
    this.products = new PostgresProductDomainStore(options.pool, this.access, this.source)
    this.productController = new HostedProductController(this.products, this.boundary, options.onError)
    this.assessmentWorker = hostedIsolatedAssessmentWorker(this.products, applicationRoot, options.pool, options.hosts)
    this.startProductRecovery()
    // Recover idle orphans even if no new editor request arrives. Failed cleanup
    // remains in PostgreSQL accounting/quarantine for the next bounded attempt.
    this.recoveryTimer = setInterval(() => {
      if (!this.recovery) this.recovery = this.provider.recover().catch(() => {}).finally(() => { this.recovery = undefined })
      this.startProductRecovery()
    }, 5000)
    this.recoveryTimer.unref()
  }
  async close() {
    clearInterval(this.recoveryTimer)
    await Promise.all([this.recovery, this.productRecovery])
    try { await this.controlled.close() } finally { await this.provider.close() }
  }
  async handle(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
    const pathname = request.url?.split("?")[0] ?? ""
    if (pathname.startsWith("/__webcanbe/auth/")) return this.login.handle(request, response)
    if (pathname.startsWith("/__webcanbe/api/product/")) return this.productController.handle(request, response)
    if (!pathname.startsWith("/__webcanbe/api/")) return false
    try {
      const account = await this.boundary.authenticate(request)
      const actionPath = pathname.slice("/__webcanbe/api".length)
      const body = await bodyOf(request, actionPath === "/projects/import" ? 36 * 1024 * 1024 : 8 * 1024 * 1024)
      // These are never client authority or storage locators. Unknown runner IDs
      // cannot substitute for a server-owned project capability/generation.
      if (["accountId", "userId", "root", "sourceRoot", "role", "projectId", "runnerId", "revisionId", "generationId", "artifactId"].some(key => key in body)) throw new AuthorityDenied()
      let assertAccess = async () => { const current = await this.boundary.authenticate(request); if (current.sessionId !== account.sessionId) throw new AuthorityDenied() }
      const send = async (status: number, value: Record<string, unknown>) => { await assertAccess(); json(response, { status, value }); return true }
      if (actionPath === "/projects/import-source") {
        if (typeof body.workspaceId !== "string" || !this.options.externalSourceProvider) throw new AuthorityDenied()
        const workspaceId = body.workspaceId, reference = sourceReference(body.source)
        if (body.archive !== undefined || Object.keys(body).some(key => !["workspaceId", "name", "source"].includes(key))) throw new AuthorityDenied()
        assertAccess = async () => { await this.boundary.authenticate(request); await this.access.requireWorkspace(account, workspaceId) }
        await assertAccess()
        const controller = new AbortController(), abort = () => controller.abort()
        response.once("close", abort)
        try {
          const project = await this.registry.importSource(account, workspaceId, typeof body.name === "string" ? body.name.slice(0,200) : reference.repository, async () => {
            await assertAccess()
            const source = await this.options.externalSourceProvider!.fetch(reference, controller.signal)
            await assertAccess(); if (controller.signal.aborted) throw new AuthorityDenied()
            return source
          })
          return send(201, { project })
        } finally { response.removeListener("close", abort); controller.abort() }
      }
      if (actionPath === "/projects/import") {
        if (typeof body.workspaceId !== "string") throw new AuthorityDenied()
        const workspaceId = body.workspaceId
        assertAccess = async () => { await this.boundary.authenticate(request); await this.access.requireWorkspace(account, workspaceId) }
        if (typeof body.archive !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.archive)) return send(400, { error: "A base64 ZIP is required." })
        const project = await this.registry.importZip(account, workspaceId, typeof body.name === "string" ? body.name.slice(0,200) : "Imported project", Buffer.from(body.archive, "base64"))
        return send(201, { project })
      }
      if (actionPath === "/workspaces") return send(200, { workspaces: await this.access.workspaces(account) })
      if (actionPath === "/projects") {
        const projects = await this.registry.list(account)
        // A list can have taken time to compile. Recheck every returned project.
        for (const project of projects) await this.access.grant(account, project.id)
        return send(200, { projects })
      }
      const route = /^\/projects\/([a-f0-9-]{36})\/(\w+)$/.exec(actionPath)
      if (!route) throw new AuthorityDenied()
      const [, projectId, action] = route, operation = (action === "session" ? "inspect" : action) as SessionOperation
      const grant = await this.access.grant(account, projectId, operation)
      if (body.workspaceId !== undefined && body.workspaceId !== grant.workspaceId) throw new AuthorityDenied()
      assertAccess = async () => { await this.boundary.authenticate(request); if (!await this.access.check(grant, operation)) throw new AuthorityDenied() }
      if (action === "session") {
        const { value } = await withHostedSource(this.source, grant, this.applicationRoot, async (project, source) => {
          const revision=source.revision(),assertCurrent=async()=>{await assertAccess();if((await this.source.read(grant)).revision!==revision)throw new AuthorityDenied()}
          const values=await readPublicRuntimeValues(this.options.publicRuntimeValueProvider,{userId:grant.userId,sessionId:grant.sessionId,workspaceId:grant.workspaceId,projectId,revision},AbortSignal.timeout(5000),assertCurrent)
          return {project:await this.registry.publicProject(grant,project),runtime:inspectRuntime(project,this.applicationRoot,values)}
        })
        const session = await this.registry.createSession(grant)
        return send(201, { ...value, session, role: grant.role, hostedReadiness: "UNPROVEN", compatibilityDimensions: {
          runtimeExecution: { admitted: value.runtime.supported, transport: "controlled-raster" }, securityAdmission: { controlledRunnerRequired: true, importedNodeExecution: false }, hostedReadiness: { status: "UNPROVEN", publicImportReady: false }
        } })
      }
      const previewId = typeof body.previewId === "string" ? body.previewId : "", capability = typeof body.capability === "string" ? body.capability : ""
      const binding = await this.registry.sessionBinding(projectId, previewId)
      if (binding?.grant.sessionId !== account.sessionId || !await this.registry.authorize(projectId, previewId, capability, operation)) throw new AuthorityDenied()
      const checkProject = assertAccess
      assertAccess = async () => { await checkProject(); if (!await this.registry.authorize(projectId, previewId, capability, operation)) throw new AuthorityDenied() }
      if (action === "drafts") {
        if (body.command !== undefined && body.command !== "save") throw new Error("Unknown draft operation.")
        return send(200, { draftState: body.command === "save" ? await this.drafts.write(grant, body.version, body.drafts) : await this.drafts.read(grant) })
      }
      if (action === "preview") {
        const revision = await this.registry.revision(projectId, previewId), authority = { previewId, capability, operation: "preview" as const }
        if (body.expectedRevision !== undefined && body.expectedRevision !== revision) throw new SourceConflict("Preview belongs to stale source.")
        if (body.command === "stop") { await this.registry.revokeSession(projectId, previewId); await this.controlled.sweep(); assertAccess = checkProject; return send(200, { state: "stopped" }) }
        if (body.command === "status") return send(200, { state: "available", transport: "raster", revision })
        if (body.command === "capture") {
          const { bytes, ...metadata } = await this.controlled.capture(projectId, authority, String(body.generation ?? ""))
          return send(200, { ...metadata, png: bytes.toString("base64") })
        }
        if (body.command === "input") {
          if (!Number.isSafeInteger(body.sequence) || Number(body.sequence) < 1) throw new SourceConflict("A current preview frame is required.")
          await this.controlled.input(projectId, authority, String(body.generation ?? ""), body.input as PreviewInput, Number(body.sequence))
          return send(200, { revision })
        }
        const preview = body.command === "update" ? await this.controlled.update(projectId, authority, String(body.generation ?? ""), revision)
          : body.command === undefined || body.command === "start" ? await this.controlled.start(projectId, authority, { revision, route: typeof body.route === "string" ? body.route : "/" })
          : undefined
        if (!preview) throw new Error("Unknown preview command.")
        return send(200, { ...preview, viewerUrl: this.options.origins.viewerOrigin + "/" })
      }
      const perform = () => withHostedSource(this.source, grant, this.applicationRoot, async (project, staging) => {
        const files = staging.files()
        return executeSourceOperation({ project, projectRoot: this.applicationRoot, durable: staging, store: { tailwind: project.detection.tailwind, read: file => files.get(file), write: () => { throw new Error("Use source transactions.") } }, action: operation, body, actor: account.userId,
          semanticCheck: (files,revision) => this.controlled.typecheck(projectId,{previewId,capability,operation:"preview"},revision,files),
          assertAccess, authorize: () => {}, // provisional checkout only; PostgreSQL authorizes the actual commit
          beforeCommit: async structural => { await assertAccess(); await this.controlled.holdForSourceCommit(projectId, previewId, structural) } })
      }, writeOperations.includes(operation))
      let completed
      try { completed = await perform() }
      catch (error) {
        // A concurrent identical request may have committed while this checkout
        // compiled. Re-read once: shared retry logic verifies key/hash/actor.
        if (!(error instanceof SourceConflict) || !writeOperations.includes(operation)) throw error
        completed = await perform()
      }
      // No HTTP headers or success escapes before PostgreSQL source+history COMMIT.
      return send(completed.value.status, completed.value.value)
    } catch (error) {
      this.options.onError?.(error)
      if (response.headersSent) response.destroy()
      else json(response, { status: error instanceof AuthorityDenied ? 403 : error instanceof SourceConflict ? 409 : 422, value: { error: error instanceof AuthorityDenied ? "Project authority is unavailable." : error instanceof SourceConflict ? "Source or preview changed; reload and retry." : "The hosted operation failed. Accepted source and history remain authoritative." } })
      return true
    }
  }

  private startProductRecovery() {
    if (!this.productRecovery) this.productRecovery = this.products.reconcilePending(20).then(() => {}).catch(error => { this.options.onError?.(error) }).finally(() => { this.productRecovery = undefined })
  }
}

/** Explicit hosted mode for the existing editor application. TLS terminates on
 * this listener; forwarded headers cannot manufacture transport authority. */
export function webCanBeHostedPlugin(editor: HostedEditor): Plugin {
  return { name: "webcanbe-hosted-editor", apply: "serve", transformIndexHtml: () => [{ tag: "meta", attrs: { name: "wcb-editor-mode", content: "hosted" }, injectTo: "head" }], configureServer(server) {
    server.httpServer?.once("close", () => { void editor.close().catch(() => server.config.logger.error("Hosted cleanup unverified; inspect durable quarantine.")) })
    server.middlewares.use((request, response, next) => {
      let url: string
      try { url = decodeURIComponent((request.url ?? "").split("?")[0]).replace(/\\/g, "/") } catch { json(response, { status: 400, value: { error: "Invalid path." } }); return }
      if (request.headers.host !== new URL(editor.options.origins.editorOrigin).host || /(?:\.webcanbe|\/fixtures\/|\/__webcanbe\/(?:preview|fixture)\/)/i.test(url)) { json(response, { status: 403, value: { error: "Project source is private." } }); return }
      void editor.handle(request, response).then(handled => { if (!handled) next() }).catch(() => response.destroy())
    })
  } }
}
