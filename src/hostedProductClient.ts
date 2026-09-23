import { startAuthentication, startRegistration } from "@simplewebauthn/browser"
import type { LicenseEntitlement, Listing, ProjectRelease, ReadyQualification, SellerApplication, SellerGitHubAdmission, SellerSubmission, SellerZipAdmission, WorkspaceProject } from "./webcanbe-engine/runtime/productDomain"

export type HostedListing = Listing & Readonly<{
  releaseVersion: string
  sourceRevisionId: string
  snapshotHash: string
}>

export type PaymentOrder = Readonly<{ orderId: string; listingId: string; releaseId: string; status: string; grossMinor: number; currency: "USD"; approvalUrl?: string; createdAt: string }>
export type PaymentSubscription = Readonly<{ subscriptionId: string; planKey: string; status: string; approvalUrl?: string; createdAt: string; currentPeriodEnd?: string; cancelledAt?: string; failedAt?: string }>
export type PaymentBilling = Readonly<{ currentPlanKey: string; subscription: PaymentSubscription | null; aiActions: Readonly<{ purchased: number }> }>
export type AiPackOrder = Readonly<{ aiPackOrderId: string; packKey: string; actions: number; grossMinor: number; currency: "USD"; status: string; approvalUrl?: string }>

export type HostedListingDetail = HostedListing & Readonly<{
  release: ProjectRelease
  publicMetadata: Record<string, unknown>
}>

export type SourceProjectSummary = Readonly<{ id: string; name: string }>

export type AccountData = Readonly<{
  userId: string
  displayName: string
  email: string
  emailVerified: boolean
  picture: string
  createdAt: string
  updatedAt: string
  providers: string[]
  activeSessions: number
}>

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

export type RequestCategory = "general_support" | "account_help" | "seller_support" | "billing" | "bug_report" | "sales" | "partnership" | "security_report" | "privacy_request" | "refund_request" | "payment_dispute" | "payout_issue"
export type RequestStatus = "open" | "triaged" | "in_progress" | "waiting_on_user" | "waiting_internal" | "resolved" | "closed" | "reopened"
export type RequestPriority = "low" | "normal" | "high" | "urgent"
export type RequestCase = Readonly<{ requestId: string; requestNumber: string; requesterUserId: string | null; requesterEmail: string | null; category: RequestCategory; subject: string; description: string; status: RequestStatus; priority: RequestPriority; assignedOperatorUserId: string | null; references: Record<string,string|null>; safeContext: Record<string,string>; createdAt: string; updatedAt: string; resolvedAt: string | null }>
export type RequestEvent = Readonly<{ eventId: string; requestId: string; actorUserId: string | null; actorKind: string; eventType: string; visibility: "requester" | "internal"; data: Record<string,unknown>; createdAt: string }>
export type CreatorFinance = Readonly<{
  summary: Readonly<{ grossPaidSalesMinor:number; refundsDisputesMinor:number; netCreatorEarningMinor:number; orderCount:number; currency:"USD" }>
  balances: Readonly<{ heldMinor:number; pendingMinor:number; availableMinor:number; paidMinor:number; negativeAdjustmentsMinor:number; currency:"USD" }>
  payoutPolicy: Readonly<{ minimumMinor:number; holdDays:number; windows:number[] }>
  feeState: Readonly<{ founding:boolean; foundingEligible:boolean; foundingDeadline:string|null; cumulativeGrossMinor:number; foundingCapMinor:number; standardIntroBasisPoints:number; standardBasisPoints:number; latestAppliedBasisPoints:number|null }>
  orders: Array<Readonly<{ orderId:string; listingId:string; listingTitle:string; grossMinor:number; platformFeeMinor:number; creatorEarningMinor:number; refundMinor:number; currency:string; status:string; createdAt:string; completedAt:string|null; refundedAt:string|null }>>
  ledger: Array<Readonly<{ entryId:string; orderId:string|null; kind:string; grossMinor:number; platformFeeMinor:number; creatorAmountMinor:number; currency:string; provider:string; providerReference:string; holdUntil:string; state:string; payoutBatchId:string|null; occurredAt:string; paidAt:string|null }>>
  payouts: Array<Readonly<{ batchId:string; batchKey:string; scheduledFor:string; status:string; providerReference:string|null; createdAt:string; updatedAt:string; paidAt:string|null }>>
}>

export type ControlData = Readonly<{
  authority: Readonly<{ role: "reviewer" | "admin" | "bigperson"; epoch: number }>
  sellerApplications: Array<Record<string, unknown>>
  submissions: Array<Record<string, unknown>>
  reviews: Array<Record<string, unknown>>
  assessments: Array<Record<string, unknown>>
  results: Array<Record<string, unknown>>
  catalogProjects: Array<Record<string, unknown>>
  promotions: Array<Record<string, unknown>>
  releases: Array<Record<string, unknown>>
  rights: Array<Record<string, unknown>>
  publications: Array<Record<string, unknown>>
  listings: Array<Record<string, unknown>>
  ready: Array<Record<string, unknown>>
  deployIntents: Array<Record<string, unknown>>
  users: Array<Record<string, unknown>>
  sessions: Array<Record<string, unknown>>
  workspaces: Array<Record<string, unknown>>
  operators: Array<Record<string, unknown>>
  entitlements: Array<Record<string, unknown>>
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
  constructor(private readonly request: FetchLike = (input, init) => globalThis.fetch(input, init)) {}

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

  async paymentStatus() {
    return (await this.post<{ billing: PaymentBilling }>("/__webcanbe/api/payments/status", {})).billing
  }

  async createPaymentOrder(listingId: string, idempotencyKey: string) {
    return (await this.post<{ order: PaymentOrder }>("/__webcanbe/api/payments/orders/create", { listingId, idempotencyKey })).order
  }

  async capturePaymentOrder(providerOrderId: string) {
    return (await this.post<{ order: PaymentOrder }>("/__webcanbe/api/payments/orders/capture", { providerOrderId })).order
  }

  async createSubscription(planKey: string, idempotencyKey: string) {
    return (await this.post<{ subscription: PaymentSubscription }>("/__webcanbe/api/payments/subscriptions/create", { planKey, idempotencyKey })).subscription
  }

  async inspectSubscription(subscriptionId: string) {
    return (await this.post<{ provider: { status: string; planMatches: boolean; referenceMatches: boolean; lastFailedReason?: string; message?: string } }>("/__webcanbe/api/payments/subscriptions/inspect", { subscriptionId })).provider
  }

  async cancelSubscription(subscriptionId: string) {
    return (await this.post<{ subscription: PaymentSubscription }>("/__webcanbe/api/payments/subscriptions/cancel", { subscriptionId })).subscription
  }

  async createAiPack(packKey: string, idempotencyKey: string) {
    return (await this.post<{ order: AiPackOrder }>("/__webcanbe/api/payments/ai-packs/create", { packKey, idempotencyKey })).order
  }

  async captureAiPack(providerOrderId: string) {
    return (await this.post<{ order: AiPackOrder }>("/__webcanbe/api/payments/ai-packs/capture", { providerOrderId })).order
  }

  async workspaceProjects() {
    return (await this.post<{ workspaceProjects: WorkspaceProject[] }>("/__webcanbe/api/product/workspace-projects/list", {})).workspaceProjects
  }

  async account() {
    return (await this.post<{ account: AccountData }>("/__webcanbe/api/account/get", {})).account
  }

  async updateAccount(displayName: string) {
    return (await this.post<{ account: AccountData }>("/__webcanbe/api/account/update", { displayName })).account
  }

  async linkFirebaseIdentity(idToken: string) {
    if (!idToken || idToken.length > 8192) throw new HostedProductError(400, "Firebase ID token is invalid.")
    const csrf = await this.session()
    const response = await this.request("/__webcanbe/api/account/identities/link/firebase", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-WCB-CSRF": csrf,
        "Authorization": "Bearer " + idToken,
      },
      body: "{}",
    })
    const value = await response.json().catch(() => ({})) as { linked?: unknown; provider?: unknown; alreadyLinked?: unknown; error?: unknown }
    if (!response.ok || value.linked !== true) throw new HostedProductError(response.status, typeof value.error === "string" ? value.error : "Identity linking was refused.")
    return {
      linked: true as const,
      provider: typeof value.provider === "string" ? value.provider : "Firebase Authentication",
      alreadyLinked: value.alreadyLinked === true,
    }
  }

  async revokeAllSessions() {
    const result = await this.post<{ ok: true; revokedSessions: number }>("/__webcanbe/api/account/sessions/revoke-all", {})
    this.csrf = undefined
    return result
  }

  async createWorkspace(workspaceId: string) {
    return (await this.post<{ workspaceId: string }>("/__webcanbe/api/workspaces/create", { workspaceId })).workspaceId
  }

  async createFirstPartyTemplate(slug: "aperture-north" | "stillform", workspaceId: string, idempotencyKey: string) {
    return (await this.post<{ projectId: string; replayed: boolean }>("/__webcanbe/api/templates/create", { slug, workspaceId, idempotencyKey })).projectId
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

  async firebaseExchange(idToken: string) {
    if (!idToken || idToken.length > 8192) throw new HostedProductError(400, "Firebase ID token is invalid.")
    const response = await this.request("/__webcanbe/auth/firebase-exchange", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + idToken,
      },
      body: "{}",
    })
    const value = await response.json().catch(() => ({})) as { error?: unknown }
    if (!response.ok) throw new HostedProductError(response.status, typeof value.error === "string" ? value.error : "Firebase sign-in could not be completed.")
    this.csrf = undefined
    await this.session()
  }

  async logout() {
    const csrf = await this.session()
    const response = await this.request("/__webcanbe/auth/logout", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-WCB-CSRF": csrf }, body: "{}" })
    if (!response.ok && response.status !== 204) throw new HostedProductError(response.status, "Sign out was refused.")
    this.csrf = undefined
  }

  async sellerApplication() {
    try { return (await this.post<{ application: SellerApplication }>("/__webcanbe/api/product/seller/applications/get", {})).application }
    catch (error) { if (error instanceof HostedProductError && error.status === 404) return undefined; throw error }
  }

  async applySeller(input: { contactEmail: string; githubUrl: string; archiveName: string; archiveBase64: string }) {
    return (await this.post<{ application: SellerApplication }>("/__webcanbe/api/product/seller/applications/apply", input)).application
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

  async creatorFinance() {
    return (await this.post<{ finance: CreatorFinance }>("/__webcanbe/api/product/seller/finance", {})).finance
  }

  async createPublicRequest(input: Record<string,unknown>) {
    return (await this.publicPost<{ request: RequestCase }>("/__webcanbe/api/requests/public/create", input)).request
  }

  async createRequest(input: Record<string,unknown>) {
    return (await this.post<{ request: RequestCase }>("/__webcanbe/api/requests/create", input)).request
  }

  async myRequests() {
    return (await this.post<{ requests: RequestCase[] }>("/__webcanbe/api/requests/mine", {})).requests
  }

  async myRequest(requestId: string) {
    return await this.post<{ request: RequestCase; events: RequestEvent[] }>("/__webcanbe/api/requests/detail", { requestId })
  }

  async controlRequestQueue(input: Record<string,unknown> = {}) {
    return await this.post<{ requests: RequestCase[]; selected: RequestCase|null; events: RequestEvent[]; operators:Array<{userId:string;role:string}> }>("/__webcanbe/api/ops/requests/queue", input)
  }

  async controlMutateRequest(action: "assign"|"status"|"priority"|"note"|"link-action", input: Record<string,unknown>) {
    return (await this.post<{ request: RequestCase }>(`/__webcanbe/api/ops/requests/${action}`, input)).request
  }

  async registerBigpersonPasskey(password: string) {
    if (!productionControlMode()) throw new HostedProductError(404, "Bigperson registration is available only on the production Control boundary.")
    const begin = await this.post<{ challengeId: string; options: Parameters<typeof startRegistration>[0]["optionsJSON"] }>("/__webcanbe/api/ops/bigperson/register/options", { password })
    const response = await startRegistration({ optionsJSON: begin.options })
    return await this.post<{ registered: boolean }>("/__webcanbe/api/ops/bigperson/register/verify", { challengeId: begin.challengeId, response })
  }

  private async privilegedMutation<T>(password: string, path: string, operationBody: Record<string, unknown>) {
    if (!productionControlMode()) throw new HostedProductError(404, "Privileged operations are not enabled.")
    const begin = await this.post<{ challengeId: string; options: Parameters<typeof startAuthentication>[0]["optionsJSON"] }>("/__webcanbe/api/ops/bigperson/operation/options", { password, operation: { method: "POST", path, body: operationBody } })
    const response = await startAuthentication({ optionsJSON: begin.options })
    return await this.post<T>(path, { challengeId: begin.challengeId, response, operationBody })
  }

  async controlRead(password: string) {
    return (await this.privilegedMutation<{ control: ControlData }>(password, "/__webcanbe/api/ops/control/read", {})).control
  }

  async controlTransitionOperator(password: string, input: { targetUserId: string; active: boolean; role: "reviewer" | "admin" | "bigperson" }) {
    return (await this.privilegedMutation<{ operator: Record<string, unknown> }>(password, "/__webcanbe/api/ops/operators/transition", { ...input, idempotencyKey: crypto.randomUUID() })).operator
  }

  async controlTransitionSellerApplication(password: string, input: { applicationId: string; status: "approved" | "rejected" }) {
    return (await this.privilegedMutation<{ application: Record<string, unknown> }>(password, "/__webcanbe/api/ops/seller-applications/transition", { ...input, idempotencyKey: crypto.randomUUID() })).application
  }

  async controlRevokeSession(password: string, sessionId: string) {
    return (await this.privilegedMutation<{ session: Record<string, unknown> }>(password, "/__webcanbe/api/ops/sessions/revoke", { sessionId, idempotencyKey: crypto.randomUUID() })).session
  }

  async controlReviewDecision(password: string, input: { submissionId: string; snapshotHash: string; decision: "approved_for_next_stage" | "rejected" }) {
    return (await this.privilegedMutation<{ review: Record<string, unknown> }>(password, "/__webcanbe/api/ops/reviews/decide", { ...input, idempotencyKey: crypto.randomUUID() })).review
  }

  async controlAdmitAssessment(password: string, input: { submissionId: string; sellerUserId: string; snapshotHash: string; reviewDecisionId: string }) {
    return (await this.privilegedMutation<{ assessment: Record<string, unknown> }>(password, "/__webcanbe/api/ops/assessments/admit", { ...input, idempotencyKey: crypto.randomUUID() })).assessment
  }

  async controlPromoteAssessmentRelease(password: string, input: { resultId: string; catalogProjectId: string; version: string }) {
    return await this.privilegedMutation<{ promotion: Record<string, unknown>; release: Record<string, unknown> }>(password, "/__webcanbe/api/ops/releases/promote", { ...input, idempotencyKey: crypto.randomUUID() })
  }

  async controlVerifyReleaseRights(password: string, input: {
    releaseId: string
    rightsBasis: "first_party_original" | "seller_rights_reviewed" | "open_source_compatible"
    licenseExpression: string
    sourceEvidence: Record<string, unknown>
    dependencyEvidence: Record<string, unknown>
    assetEvidence: Record<string, unknown>
  }) {
    return (await this.privilegedMutation<{ rightsVerification: Record<string, unknown> }>(
      password,
      "/__webcanbe/api/ops/releases/rights/verify",
      { ...input, idempotencyKey: crypto.randomUUID() },
    )).rightsVerification
  }

  async controlPublishPromotedListing(password: string, input: { promotionId: string; slug: string; title: string; summary: string; tags?: string[]; demoMetadata?: Record<string, unknown> }) {
    return await this.privilegedMutation<{ publication: Record<string, unknown>; listing: Record<string, unknown> }>(password, "/__webcanbe/api/ops/listings/publish", { ...input, idempotencyKey: crypto.randomUUID() })
  }

  async controlQualifyReleaseReady(password: string, input: { releaseId: string; assessmentResultId: string; qualificationVersion: string }) {
    return (await this.privilegedMutation<{ qualification: Record<string, unknown> }>(password, "/__webcanbe/api/ops/releases/ready/qualify", { ...input, idempotencyKey: crypto.randomUUID() })).qualification
  }

  async controlGrantTestEntitlement(password: string, input: { beneficiaryUserId: string; releaseId: string }) {
    return (await this.privilegedMutation<{ entitlement: Record<string, unknown> }>(password, "/__webcanbe/api/ops/entitlements/test/grant", { ...input, idempotencyKey: crypto.randomUUID() })).entitlement
  }

  async controlTransitionTestEntitlement(password: string, input: { entitlementId: string; status: "revoked" | "invalid" }) {
    return (await this.privilegedMutation<{ entitlement: Record<string, unknown> }>(password, "/__webcanbe/api/ops/entitlements/test/transition", { ...input, idempotencyKey: crypto.randomUUID() })).entitlement
  }

}

export const hostedProductMode = () => typeof document !== "undefined" && document.querySelector('meta[name="wcb-editor-mode"]')?.getAttribute("content") === "hosted"
export const productionReadProductMode = () => typeof window !== "undefined" && window.location.origin === "https://webcanbe.com" && document.querySelector('meta[name="wcb-product-read-mode"]')?.getAttribute("content") === "hosted"
export const productReadMode = () => hostedProductMode() || productionReadProductMode()
export const productionMutationProductMode = () => typeof window !== "undefined" && window.location.origin === "https://webcanbe.com" && document.querySelector('meta[name="wcb-product-mutation-mode"]')?.getAttribute("content") === "hosted"
export const productMutationMode = () => hostedProductMode() || productionMutationProductMode()
export const productionControlMode = () => typeof window !== "undefined" && window.location.origin === "https://webcanbe.com" && document.querySelector('meta[name="wcb-control-mode"]')?.getAttribute("content") === "hosted"
export const controlMode = () => hostedProductMode() || productionControlMode()
export const productionAuthMode = () => typeof window !== "undefined" && window.location.origin === "https://webcanbe.com" && document.querySelector('meta[name="wcb-auth-mode"]')?.getAttribute("content") === "google"
export const hostedProductClient = new HostedProductClient()
