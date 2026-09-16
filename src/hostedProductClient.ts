import type { LicenseEntitlement, Listing, ProjectRelease, WorkspaceProject } from "./webcanbe-engine/runtime/productDomain"

export type HostedListing = Listing & Readonly<{
  releaseVersion: string
  sourceRevisionId: string
  snapshotHash: string
}>

export type HostedListingDetail = HostedListing & Readonly<{
  release: ProjectRelease
  publicMetadata: Record<string, unknown>
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

  private async post<T>(path: string, body: Record<string, unknown>, retry = true): Promise<T> {
    const csrf = await this.session()
    const response = await this.request(path, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-WCB-CSRF": csrf }, body: JSON.stringify(body) })
    if (response.status === 403 && retry) { await this.session(true); return this.post<T>(path, body, false) }
    const value = await response.json().catch(() => ({})) as Record<string, unknown>
    if (!response.ok) throw new HostedProductError(response.status, typeof value.error === "string" ? value.error : "The product request was refused.")
    return value as T
  }

  async browse(input: { query?: string; tags?: string[]; limit?: number } = {}) {
    return (await this.post<{ listings: HostedListing[] }>("/__webcanbe/api/product/catalog/browse", input)).listings
  }

  async detail(reference: string) {
    return (await this.post<{ listing: HostedListingDetail }>("/__webcanbe/api/product/catalog/detail", { reference })).listing
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
}

export const hostedProductMode = () => typeof document !== "undefined" && document.querySelector('meta[name="wcb-editor-mode"]')?.getAttribute("content") === "hosted"
export const hostedProductClient = new HostedProductClient()
