import type { IncomingMessage, ServerResponse } from "node:http"
import { AuthorityDenied, type ServerSession } from "./hostedAuthority"
import { PostgresSessionBoundary } from "./postgresIdentity"
import { EntitlementUnavailable, ProductConflict, type Listing } from "./productDomain"
import { PostgresProductDomainStore } from "./postgresProductDomain"

async function bodyOf(request: IncomingMessage) {
  const chunks: Buffer[] = []; let size = 0
  for await (const value of request) { const bytes = Buffer.from(value); size += bytes.length; if (size > 256 * 1024) throw new Error("Request too large."); chunks.push(bytes) }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid request.")
  return value as Record<string, unknown>
}
function exact(body: Record<string, unknown>, allowed: readonly string[]) {
  if (Object.keys(body).some(key => !allowed.includes(key))) throw new AuthorityDenied()
}
function text(body: Record<string, unknown>, key: string) {
  if (typeof body[key] !== "string") throw new Error(`Invalid ${key}.`)
  return body[key]
}
function json(response: ServerResponse, status: number, value: Record<string, unknown>) {
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" })
  response.end(JSON.stringify(value))
}

/** Authenticated Phase-3 product controller. Authentication, CSRF, TLS, exact
 * editor origin and fresh session resolution are delegated to the same hosted
 * boundary as source editing. Request identifiers only select records; every
 * private operation rechecks durable server authority. */
export class HostedProductController {
  constructor(readonly store: PostgresProductDomainStore, readonly boundary: PostgresSessionBoundary, private readonly onError?: (error: unknown) => void) {}

  async handle(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
    const pathname = request.url?.split("?")[0] ?? ""
    const prefix = "/__webcanbe/api/product"
    if (!pathname.startsWith(prefix + "/")) return false
    try {
      const session = await this.boundary.authenticate(request), body = await bodyOf(request), action = pathname.slice(prefix.length)
      const assertSession = async (expected: ServerSession = session) => {
        const current = await this.boundary.authenticate(request)
        if (current.sessionId !== expected.sessionId || current.userId !== expected.userId || current.expiresAt !== expected.expiresAt) throw new AuthorityDenied()
      }
      const send = async (status: number, value: Record<string, unknown>) => { await assertSession(); json(response, status, value); return true }

      if (action === "/catalog/browse") {
        exact(body, ["query", "tags", "limit"])
        if (body.query !== undefined && typeof body.query !== "string" || body.tags !== undefined && (!Array.isArray(body.tags) || body.tags.some(tag => typeof tag !== "string")) || body.limit !== undefined && !Number.isSafeInteger(body.limit)) throw new Error("Invalid catalog filter.")
        return send(200, { listings: await this.store.browse({ query: body.query as string | undefined, tags: body.tags as string[] | undefined, limit: body.limit as number | undefined }) })
      }
      if (action === "/catalog/detail") {
        exact(body, ["reference"]); const listing = await this.store.listingDetail(text(body, "reference"))
        return send(listing ? 200 : 404, listing ? { listing } : { error: "Listing not found." })
      }
      if (action === "/catalog/projects/create") {
        exact(body, ["workspaceId", "sourceProjectId", "slug", "title", "summary", "publicMetadata"])
        const catalogProject = await this.store.createCatalogProject(session, text(body, "workspaceId"), text(body, "sourceProjectId"), { slug: text(body, "slug"), title: text(body, "title"), summary: text(body, "summary"), publicMetadata: body.publicMetadata as Record<string, unknown> | undefined })
        return send(201, { catalogProject })
      }
      if (action === "/catalog/releases/publish") {
        exact(body, ["catalogProjectId", "version"])
        return send(201, { release: await this.store.publishRelease(session, text(body, "catalogProjectId"), text(body, "version")) })
      }
      if (action === "/catalog/listings/save") {
        exact(body, ["catalogProjectId", "releaseId", "slug", "title", "summary", "status", "availability", "tags", "demoMetadata"])
        const listing = await this.store.saveListing(session, text(body, "catalogProjectId"), text(body, "releaseId"), { slug: text(body, "slug"), title: text(body, "title"), summary: text(body, "summary"), status: text(body, "status") as Listing["status"], availability: text(body, "availability") as Listing["availability"], tags: body.tags as string[] | undefined, demoMetadata: body.demoMetadata as Record<string, unknown> | undefined })
        return send(200, { listing })
      }
      if (action === "/entitlements/test/grant") {
        exact(body, ["beneficiaryUserId", "releaseId", "idempotencyKey"])
        const entitlement = await this.store.grantTestEntitlement(session, text(body, "beneficiaryUserId"), text(body, "releaseId"), text(body, "idempotencyKey"))
        return send(201, { entitlement })
      }
      if (action === "/entitlements/test/grant-self") {
        exact(body, ["releaseId", "idempotencyKey"])
        return send(201, { entitlement: await this.store.grantTestEntitlementForSelf(session, text(body, "releaseId"), text(body, "idempotencyKey")) })
      }
      if (action === "/entitlements/test/transition") {
        exact(body, ["entitlementId", "status"]); const status = text(body, "status")
        if (!["revoked", "invalid"].includes(status)) throw new Error("Invalid entitlement state.")
        return send(200, { entitlement: await this.store.transitionTestEntitlement(session, text(body, "entitlementId"), status as "revoked" | "invalid") })
      }
      if (action === "/purchases") { exact(body, []); return send(200, { entitlements: await this.store.purchases(session) }) }
      if (action === "/workspace-projects/list") { exact(body, []); return send(200, { workspaceProjects: await this.store.workspaceProjects(session) }) }
      if (action === "/workspace-projects/materialize") {
        exact(body, ["workspaceId", "entitlementId", "idempotencyKey", "name"])
        const workspaceProject = await this.store.materialize(session, text(body, "workspaceId"), text(body, "entitlementId"), text(body, "idempotencyKey"), body.name === undefined ? undefined : text(body, "name"))
        return send(201, { workspaceProject })
      }
      if (action === "/workspace-projects/get") {
        exact(body, ["workspaceProjectId"]); const workspaceProject = await this.store.workspaceProject(session, text(body, "workspaceProjectId"))
        return send(workspaceProject ? 200 : 404, workspaceProject ? { workspaceProject } : { error: "Workspace project not found." })
      }
      throw new AuthorityDenied()
    } catch (error) {
      this.onError?.(error)
      if (response.headersSent) response.destroy()
      else if (error instanceof AuthorityDenied) json(response, 403, { error: "Product authority is unavailable." })
      else if (error instanceof ProductConflict) json(response, 409, { error: error.message })
      else if (error instanceof EntitlementUnavailable) json(response, 422, { error: error.message })
      else json(response, 422, { error: "The product operation failed without changing authoritative source." })
      return true
    }
  }
}
