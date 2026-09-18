import type { LicenseEntitlement, Listing, ProjectRelease, ReadyQualification, SellerApplication, SellerGitHubAdmission, SellerSubmission, SellerZipAdmission, WorkspaceProject } from "./webcanbe-engine/runtime/productDomain"

export type HostedListing = Listing & Readonly<{
  releaseVersion: string
  sourceRevisionId: string
  snapshotHash: string
}>

export type HostedListingDetail = HostedListing & Readonly<{
  release: ProjectRelease
  publicMetadata: Record<string, unknown>
}>

export type SourceProjectSummary = Readonly<{ id: string; name: string }>

export type CreatorStudioData = Readonly<{
  application: SellerApplication
  submissions: SellerSubmission[]
  imports: Readonly<{ zip: SellerZipAdmission[]; github: SellerGitHubAdmission[] }>
  reviews: Array<Readonly<{ decisionId: string; submissionId: string; decision: string; createdAt: string }>>
  assessments: Array<Readonly<{ assessmentRequestId: string; submissionId: string; status: string; createdAt: string; result?: Readonly<{ resultId: string; status: string; metadata: Record<string, unknown>; completedAt: string }> }>>
  releases: Array<Readonly<{ promotionId: string; assessmentResultId: string; release: ProjectRelease }>>
  listings: Listing[]
  ready: ReadyQualification[]
}>

export type ControlData = Readonly<{
  sellerApplications: Array<Record<string, unknown>>
  submissions: Array<Record<string, unknown>>
  reviews: Array<Record<string, unknown>>
  assessments: Array<Record<string, unknown>>
  results: Array<Record<string, unknown>>
  releases: Array<Record<string, unknown>>
  listings: Array<Record<string, unknown>>
  ready: Array<Record<string, unknown>>
  deployIntents: Array<Record<string, unknown>>
  audit: Array<Record<string, unknown>>
}>

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export class HostedProductError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

/** Browser adapter for the existing authenticated hosted boundary. It never
 * accepts identity, membership, or operator flags from route state. */
export class HostedProductClient {
  private csrf?: Promise<string>
  constructor(private readonly request: FetchLike = fetch) {}

  private session(force = false) {
    if (force) this.csrf = undefined
    if (!this.csrf) this.csrf = this.request("/__webcanbe/auth/session", {
      method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}"
    }).then(async response => {
      const body = await response.json().catch(() => ({})) as { csrf?: unknown; error?: unknown }
      if (!response.ok || typeof body.csrf !== "string") throw new HostedProductError(response.status, typeof body.error === "string" ? body.error : "Sign in to continue.")
      return body.csrf
    }).catch(error => { this.csrf = undefined; throw error })
    return this.csrf
  }

  private async publicPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const response = await this.request(path, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const value = await response.json().catch(() => ({})) as Record<string, unknown>
    if (!response.ok) throw new HostedProductError(response.status, typeof value.error === "string" ? value.error : "The public product request was refused.")
    return value as T
  }

  private async post<T>(path: string, body: Record<string, unknown>, retry = true): Promise<T> {
    const csrf = await this.session()
    const response = await this.request(path, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-WCB-CSRF": csrf }, body: JSON.stringify(body) })
    if (response.status === 403 && retry) { await this.session(true); return this.post<T>(path, body, false) }
    const value = await response.json().catch(() => ({})) as Record<string, unknown>
    if (!response.ok) throw new HostedProductError(response.status, typeof value.error === "string" ? value.error : "The product request was refused.")
    return value as T
  }

  async browse(input: { query?: string; tags?: string[]; limit?: number } = {}) {
    return (await this.publicPost<{ listings: HostedListing[] }>("/__webcanbe/api/product/catalog/browse", input)).listings
  }

  async detail(reference: string) {
    return (await this.publicPost<{ listing: HostedListingDetail }>("/__webcanbe/api/product/catalog/detail", { reference })).listing
  }

  async purchases() {
    return (await this.post<{ entitlements: LicenseEntitlement[] }>("/__webcanbe/api/product/purchases", {})).entitlements
  }

  async workspaceProjects() {
    return (await this.post<{ workspaceProjects: WorkspaceProject[] }>("/__webcanbe/api/product/workspace-projects/list", {})).workspaceProjects
  }

  async workspaces() {
    return (await this.post<{ workspaces: string[] }>("/__webcanbe/api/workspaces", {})).workspaces
  }

  async grantTestEntitlementForSelf(releaseId: string) {
    return (await this.post<{ entitlement: LicenseEntitlement }>("/__webcanbe/api/product/entitlements/test/grant-self", { releaseId, idempotencyKey: `route-grant:${releaseId}` })).entitlement
  }

  async materialize(workspaceId: string, entitlementId: string, name: string) {
    return (await this.post<{ workspaceProject: WorkspaceProject }>("/__webcanbe/api/product/workspace-projects/materialize", { workspaceId, entitlementId, idempotencyKey: `route-copy:${entitlementId}`, name })).workspaceProject
  }

  async purchaseAndMaterialize(releaseId: string, name: string) {
    const existing = (await this.purchases()).find(item => item.releaseId === releaseId && item.status === "active")
    const entitlement = existing ?? await this.grantTestEntitlementForSelf(releaseId)
    const workspaceId = (await this.workspaces())[0]
    if (!workspaceId) throw new HostedProductError(403, "An editable workspace is required.")
    return this.materialize(workspaceId, entitlement.entitlementId, name)
  }

  async authenticated() {
    try { await this.session(); return true }
    catch { return false }
  }

  async authStart() {
    const response = await this.request("/__webcanbe/auth/start", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}" })
    const value = await response.json().catch(() => ({})) as { authorizationUrl?: unknown; error?: unknown }
    if (!response.ok || typeof value.authorizationUrl !== "string") throw new HostedProductError(response.status, typeof value.error === "string" ? value.error : "Sign-in is unavailable.")
    return value.authorizationUrl
  }

  async logout() {
    this.csrf = undefined
    const response = await this.request("/__webcanbe/auth/logout", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}" })
    if (!response.ok && response.status !== 204) throw new HostedProductError(response.status, "Sign out was refused.")
    this.csrf = undefined
  }

  async sellerApplication() {
    try { return (await this.post<{ application: SellerApplication }>("/__webcanbe/api/product/seller/applications/get", {})).application }
    catch (error) { if (error instanceof HostedProductError && error.status === 404) return undefined; throw error }
  }

  async applySeller() {
    return (await this.post<{ application: SellerApplication }>("/__webcanbe/api/product/seller/applications/apply", {})).application
  }

  async creatorStudio() {
    return (await this.post<{ studio: CreatorStudioData }>("/__webcanbe/api/product/seller/studio/get", {})).studio
  }

  async updateCreatorListing(listingId: string, input: { title: string; summary: string; availability: Listing["availability"]; tags: string[]; demoMetadata: Record<string, unknown> }) {
    return (await this.post<{ listing: Listing }>("/__webcanbe/api/product/seller/studio/listings/update", { listingId, ...input })).listing
  }

  async sourceProjects() {
    return (await this.post<{ projects: SourceProjectSummary[] }>("/__webcanbe/api/projects", {})).projects
  }

  async createSellerSubmission(sellerApplicationId: string, workspaceId: string, sourceProjectId: string) {
    return (await this.post<{ submission: SellerSubmission }>("/__webcanbe/api/product/seller/submissions/create", { sellerApplicationId, workspaceId, sourceProjectId })).submission
  }

  async controlRead() {
    return (await this.post<{ control: ControlData }>("/__webcanbe/api/product/control/read", {})).control
  }

}

export const hostedProductMode = () => typeof document !== "undefined" && document.querySelector('meta[name="wcb-editor-mode"]')?.getAttribute("content") === "hosted"
export const hostedProductClient = new HostedProductClient()
