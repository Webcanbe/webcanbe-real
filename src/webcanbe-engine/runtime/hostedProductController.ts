import type { IncomingMessage, ServerResponse } from "node:http"
import { AuthorityDenied, type ServerSession } from "./hostedAuthority"
import { PostgresSessionBoundary } from "./postgresIdentity"
import { EntitlementUnavailable, ProductConflict, type Listing } from "./productDomain"
import { PostgresProductDomainStore } from "./postgresProductDomain"

async function bodyOf(request: IncomingMessage, maximum = 256 * 1024) {
  const chunks: Buffer[] = []; let size = 0
  for await (const value of request) { const bytes = Buffer.from(value); size += bytes.length; if (size > maximum) throw new Error("Request too large."); chunks.push(bytes) }
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
function archiveBytes(body: Record<string, unknown>) {
  const encoded = text(body, "archiveBase64")
  if (!encoded.length || encoded.length % 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) throw new Error("Invalid archive encoding.")
  return Buffer.from(encoded, "base64")
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
      const action = pathname.slice(prefix.length), session = await this.boundary.authenticate(request)
      const body = await bodyOf(request, action === "/seller/imports/zip/admit" ? 36 * 1024 * 1024 : undefined)
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
      if (action === "/workspace-projects/shares/create") {
        exact(body, ["projectId", "recipientUserId", "permission", "idempotencyKey"]); const permission = text(body, "permission")
        if (!["view", "edit"].includes(permission)) throw new Error("Invalid share permission.")
        return send(201, { share: await this.store.createProjectShare(session, text(body, "projectId"), text(body, "recipientUserId"), permission as "view" | "edit", text(body, "idempotencyKey")) })
      }
      if (action === "/workspace-projects/shares/revoke") {
        exact(body, ["shareId"]); return send(200, { share: await this.store.revokeProjectShare(session, text(body, "shareId")) })
      }
      if (action === "/workspace-projects/shares/get") {
        exact(body, ["shareId"]); return send(200, { share: await this.store.projectShare(session, text(body, "shareId")) })
      }
      if (action === "/workspace-projects/export") {
        exact(body, ["projectId", "expectedRevision"]); return send(200, { export: await this.store.exportWorkspaceProject(session, text(body, "projectId"), text(body, "expectedRevision")) })
      }
      if (action === "/workspace-projects/deploy-intents/create") {
        exact(body, ["projectId", "expectedRevision", "idempotencyKey"]); return send(201, { deployIntent: await this.store.createDeployIntent(session, text(body, "projectId"), text(body, "expectedRevision"), text(body, "idempotencyKey")) })
      }
      if (action === "/seller/applications/apply") { exact(body, []); return send(201, { application: await this.store.applySeller(session) }) }
      if (action === "/seller/applications/get") { exact(body, []); const application = await this.store.sellerApplication(session); return send(application ? 200 : 404, application ? { application } : { error: "Seller application not found." }) }
      if (action === "/seller/applications/transition") {
        exact(body, ["applicationId", "status", "stepUpEvidenceId", "idempotencyKey"]); const status = text(body, "status")
        if (!["approved", "rejected"].includes(status)) throw new Error("Invalid seller application state.")
        return send(200, { application: await this.store.controlTransitionSellerApplication(session, text(body, "stepUpEvidenceId"), text(body, "applicationId"), status as "approved" | "rejected", text(body, "idempotencyKey")) })
      }
      if (action === "/seller/submissions/create") {
        exact(body, ["sellerApplicationId", "workspaceId", "sourceProjectId"])
        return send(201, { submission: await this.store.createSellerSubmission(session, text(body, "sellerApplicationId"), text(body, "workspaceId"), text(body, "sourceProjectId")) })
      }
      if (action === "/seller/imports/zip/admit") {
        exact(body, ["sellerApplicationId", "workspaceId", "archiveName", "projectName", "archiveBase64", "idempotencyKey"])
        return send(201, { admission: await this.store.admitSellerZip(session, { sellerApplicationId: text(body, "sellerApplicationId"), workspaceId: text(body, "workspaceId"), archiveName: text(body, "archiveName"), projectName: text(body, "projectName"), archive: archiveBytes(body), idempotencyKey: text(body, "idempotencyKey") }) })
      }
      if (action === "/seller/imports/github/admit") {
        exact(body, ["sellerApplicationId", "workspaceId", "repository", "commit", "expectedArchiveSha256", "projectName", "idempotencyKey"])
        return send(201, { admission: await this.store.admitSellerGitHub(session, { sellerApplicationId: text(body, "sellerApplicationId"), workspaceId: text(body, "workspaceId"), repository: text(body, "repository"), commit: text(body, "commit"), expectedArchiveSha256: text(body, "expectedArchiveSha256"), projectName: text(body, "projectName"), idempotencyKey: text(body, "idempotencyKey") }) })
      }
      if (action === "/seller/submissions/list") { exact(body, []); return send(200, { submissions: await this.store.sellerSubmissions(session) }) }
      if (action === "/seller/review/queue") { exact(body, []); return send(200, { submissions: await this.store.sellerQuarantineQueue(session) }) }
      if (action === "/seller/review/inspect") {
        exact(body, ["submissionId"]); const submission = await this.store.sellerQuarantineSubmission(session, text(body, "submissionId"))
        return send(submission ? 200 : 404, submission ? { submission } : { error: "Seller submission not found." })
      }
      if (action === "/seller/review/decisions/create") {
        exact(body, ["submissionId", "snapshotHash", "decision", "idempotencyKey"]); const decision = text(body, "decision")
        if (!["approved_for_next_stage", "rejected"].includes(decision)) throw new Error("Invalid seller review decision.")
        return send(201, { decision: await this.store.createSellerReviewDecision(session, text(body, "submissionId"), text(body, "snapshotHash"), decision as "approved_for_next_stage" | "rejected", text(body, "idempotencyKey")) })
      }
      if (action === "/seller/assessment/requests/admit") {
        exact(body, ["submissionId", "sellerUserId", "snapshotHash", "reviewDecisionId", "idempotencyKey"])
        return send(201, { assessmentRequest: await this.store.admitSellerAssessment(session, text(body, "submissionId"), text(body, "sellerUserId"), text(body, "snapshotHash"), text(body, "reviewDecisionId"), text(body, "idempotencyKey")) })
      }
      if (action === "/seller/assessment/results/promote") {
        exact(body, ["resultId", "assessmentJobId", "submissionId", "sellerUserId", "snapshotHash", "catalogProjectId", "version", "idempotencyKey"])
        return send(201, await this.store.promoteAssessmentResult(session, { resultId: text(body, "resultId"), assessmentJobId: text(body, "assessmentJobId"), submissionId: text(body, "submissionId"), sellerUserId: text(body, "sellerUserId"), snapshotHash: text(body, "snapshotHash"), catalogProjectId: text(body, "catalogProjectId"), version: text(body, "version"), idempotencyKey: text(body, "idempotencyKey") }))
      }
      if (action === "/seller/releases/listings/publish") {
        exact(body, ["promotionId", "sellerUserId", "catalogProjectId", "releaseId", "idempotencyKey", "slug", "title", "summary", "tags", "demoMetadata"])
        return send(201, await this.store.publishPromotedListing(session, { promotionId: text(body, "promotionId"), sellerUserId: text(body, "sellerUserId"), catalogProjectId: text(body, "catalogProjectId"), releaseId: text(body, "releaseId"), idempotencyKey: text(body, "idempotencyKey"), slug: text(body, "slug"), title: text(body, "title"), summary: text(body, "summary"), tags: body.tags as string[] | undefined, demoMetadata: body.demoMetadata as Record<string, unknown> | undefined }))
      }
      if (action === "/seller/releases/ready/qualify") {
        exact(body, ["releaseId", "assessmentResultId", "qualificationVersion", "idempotencyKey"])
        return send(201, { qualification: await this.store.qualifyReleaseReady(session, { releaseId: text(body, "releaseId"), assessmentResultId: text(body, "assessmentResultId"), qualificationVersion: text(body, "qualificationVersion"), idempotencyKey: text(body, "idempotencyKey") }) })
      }
      if (action === "/seller/studio/get") { exact(body, []); return send(200, { studio: await this.store.creatorStudio(session) }) }
      if (action === "/seller/studio/listings/update") {
        exact(body, ["listingId", "title", "summary", "availability", "tags", "demoMetadata"])
        return send(200, { listing: await this.store.updateCreatorListing(session, text(body, "listingId"), { title: text(body, "title"), summary: text(body, "summary"), availability: text(body, "availability") as Listing["availability"], tags: body.tags as string[] | undefined, demoMetadata: body.demoMetadata as Record<string, unknown> | undefined }) })
      }
      if (action === "/control/read") { exact(body, []); return send(200, { control: await this.store.controlRead(session) }) }
      if (action === "/control/operators/transition") {
        exact(body, ["stepUpEvidenceId", "targetUserId", "active", "idempotencyKey"])
        if (typeof body.active !== "boolean") throw new Error("Invalid operator state.")
        return send(200, { operator: await this.store.controlSetOperatorAuthority(session, text(body, "stepUpEvidenceId"), text(body, "targetUserId"), body.active, text(body, "idempotencyKey")) })
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
