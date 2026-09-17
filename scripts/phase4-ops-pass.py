from pathlib import Path


def replace_between(text: str, start: str, end: str, replacement: str) -> str:
    i = text.find(start)
    if i < 0:
        raise SystemExit(f"missing start marker: {start}")
    j = text.find(end, i)
    if j < 0:
        raise SystemExit(f"missing end marker: {end}")
    return text[:i] + replacement.rstrip() + "\n\n" + text[j:]

app_path = Path("src/App.tsx")
client_path = Path("src/hostedProductClient.ts")
main_path = Path("src/main.tsx")
app = app_path.read_text()
client = client_path.read_text()
main = main_path.read_text()

client = client.replace(
    'import type { LicenseEntitlement, Listing, ProjectRelease, WorkspaceProject } from "./webcanbe-engine/runtime/productDomain"',
    'import type { LicenseEntitlement, Listing, ProjectRelease, ReadyQualification, SellerApplication, SellerGitHubAdmission, SellerSubmission, SellerZipAdmission, WorkspaceProject } from "./webcanbe-engine/runtime/productDomain"',
)

type_marker = 'type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>'
if type_marker not in client:
    raise SystemExit("hosted client type marker missing")
client_types = r'''export type SourceProjectSummary = Readonly<{ id: string; name: string }>

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
'''
client = client.replace(type_marker, client_types + "\n" + type_marker, 1)

method_marker = '\n}\n\nexport const hostedProductMode'
if method_marker not in client:
    raise SystemExit("hosted client class end marker missing")
client_methods = r'''

  async authStart() {
    const response = await this.request("/__webcanbe/auth/start", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}" })
    const value = await response.json().catch(() => ({})) as { authorizationUrl?: unknown; error?: unknown }
    if (!response.ok || typeof value.authorizationUrl !== "string") throw new HostedProductError(response.status, typeof value.error === "string" ? value.error : "Sign-in is unavailable.")
    return value.authorizationUrl
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
'''
client = client.replace(method_marker, client_methods + method_marker, 1)

app = app.replace(
    'import { hostedProductClient, hostedProductMode, type HostedListing, type HostedListingDetail } from "./hostedProductClient"',
    'import { hostedProductClient, hostedProductMode, type ControlData, type CreatorStudioData, type HostedListing, type HostedListingDetail, type SourceProjectSummary } from "./hostedProductClient"',
)

auth = r'''function authNext() {
  const value = new URLSearchParams(window.location.search).get("next")
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/browse"
}

function Auth({ signup = false }: { signup?: boolean }) {
  const hosted = hostedProductMode(), next = authNext()
  const [busy, setBusy] = useState(false), [error, setError] = useState("")
  const begin = async () => {
    if (busy) return
    if (!hosted) { go(next); return }
    setBusy(true); setError("")
    try {
      sessionStorage.setItem("wcb-auth-next", next)
      window.location.assign(await hostedProductClient.authStart())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign-in is unavailable.")
      setBusy(false)
    }
  }
  return <main className="auth"><Link to="/" className="brand auth-brand"><Mark/><span>WebCanBe</span></Link><section><span className="signal">{signup ? "Create your WebCanBe account" : "Welcome back"}</span><h1>{signup ? <>Build on code<br/>you can keep.</> : <>Return to your<br/>real projects.</>}</h1><p>{signup ? "Create an account through the configured identity provider, then start from a working project." : "Sign in through the configured provider to return to your projects and workspace."}</p><button className="google-button provider-button" disabled={busy} onClick={() => void begin()}><b>↗</b>{busy ? "Opening sign-in…" : signup ? "Continue to create account" : "Continue to sign in"}</button>{error && <p className="auth-error" role="alert">{error}</p>}<div className="auth-provider-note"><span>Email sign-in</span><p>Email/password is not enabled by the current hosted identity boundary. This screen does not fake a second authentication system.</p></div>{next !== "/browse" && <p className="auth-return">After sign-in, continue to <code>{next}</code>.</p>}<p className="auth-switch">{signup ? "Already have an account?" : "New to WebCanBe?"} <Link to={`${signup ? "/login" : "/signup"}?next=${encodeURIComponent(next)}`}>{signup ? "Log in" : "Create an account"}</Link></p></section><aside><div className="auth-quote"><div className="quote-mark">“</div><p>One account. One working copy. The visual editor and source stay attached to the same project.</p><span>WebCanBe</span></div></aside></main>
}'''
app = replace_between(app, 'function Auth(', 'function Workspace()', auth)

seller_control = r'''function CreatorListingEditor({ listing, onSaved }: { listing: CreatorStudioData["listings"][number]; onSaved: (listing: CreatorStudioData["listings"][number]) => void }) {
  const [title, setTitle] = useState(listing.title), [summary, setSummary] = useState(listing.summary), [availability, setAvailability] = useState(listing.availability), [tags, setTags] = useState(listing.tags.join(", "))
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("")
  const save = async () => {
    if (busy) return
    setBusy(true); setMessage("")
    try {
      const updated = await hostedProductClient.updateCreatorListing(listing.listingId, { title, summary, availability, tags: tags.split(",").map(value => value.trim()).filter(Boolean), demoMetadata: listing.demoMetadata })
      onSaved(updated); setMessage("Listing metadata saved.")
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Listing could not be updated.") }
    finally { setBusy(false) }
  }
  return <article className="creator-listing-editor"><div className="creator-listing-head"><div><span>{listing.status}</span><h3>{listing.title}</h3><small>Release {listing.releaseId}</small></div><span className={`listing-availability ${availability}`}>{availability}</span></div><label>Title<input value={title} onChange={event => setTitle(event.target.value)}/></label><label>Summary<textarea value={summary} onChange={event => setSummary(event.target.value)}/></label><div className="creator-listing-fields"><label>Availability<select value={availability} onChange={event => setAvailability(event.target.value as typeof availability)}><option value="available">Available</option><option value="unavailable">Unavailable</option></select></label><label>Tags<input value={tags} onChange={event => setTags(event.target.value)} placeholder="react, editorial"/></label></div><button className="button" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save listing"}</button>{message && <p className="creator-message" role="status">{message}</p>}</article>
}

function Seller({ page = "home" }: { page?: "home" | "projects" | "new" }) {
  const hosted = hostedProductMode()
  const [application, setApplication] = useState<CreatorStudioData["application"]>(), [studio, setStudio] = useState<CreatorStudioData>()
  const [workspaces, setWorkspaces] = useState<string[]>([]), [sourceProjects, setSourceProjects] = useState<SourceProjectSummary[]>([])
  const [workspaceId, setWorkspaceId] = useState(""), [sourceProjectId, setSourceProjectId] = useState("")
  const [loading, setLoading] = useState(hosted), [busy, setBusy] = useState(false), [error, setError] = useState("")
  const refresh = async () => {
    if (!hosted) return
    setLoading(true); setError("")
    try {
      const current = await hostedProductClient.sellerApplication(); setApplication(current)
      if (current?.status === "approved") {
        const [nextStudio, nextWorkspaces, nextSources] = await Promise.all([hostedProductClient.creatorStudio(), hostedProductClient.workspaces(), hostedProductClient.sourceProjects()])
        setStudio(nextStudio); setWorkspaces(nextWorkspaces); setSourceProjects(nextSources)
        setWorkspaceId(value => value || nextWorkspaces[0] || ""); setSourceProjectId(value => value || nextSources[0]?.id || "")
      } else { setStudio(undefined); setWorkspaces([]); setSourceProjects([]) }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Creator Studio is unavailable.") }
    finally { setLoading(false) }
  }
  useEffect(() => { void refresh() }, [hosted])
  const apply = async () => {
    setBusy(true); setError("")
    try { setApplication(await hostedProductClient.applySeller()) }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Creator application could not be created.") }
    finally { setBusy(false) }
  }
  const submit = async () => {
    if (!application || !workspaceId || !sourceProjectId || busy) return
    setBusy(true); setError("")
    try { await hostedProductClient.createSellerSubmission(application.applicationId, workspaceId, sourceProjectId); await refresh(); go("/seller/projects") }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Submission could not be created.") }
    finally { setBusy(false) }
  }
  const updateListing = (updated: CreatorStudioData["listings"][number]) => setStudio(current => current ? { ...current, listings: current.listings.map(item => item.listingId === updated.listingId ? updated : item) } : current)

  if (!hosted) return <AppShell><main className="seller creator-studio"><header className="seller-head"><div><span className="signal">Creator Studio preview</span><h1>Prepare real projects for the marketplace.</h1><p>The hosted product connects this surface to application, review, assessment, release, Ready, and Listing state.</p></div></header><section className="creator-local-note"><b>Local UI preview</b><p>Connect the hosted product boundary to see real seller state. No fake sales or review data is generated here.</p></section></main></AppShell>
  if (loading) return <AppShell><main className="seller creator-studio"><header className="seller-head"><div><span className="signal">Creator Studio</span><h1>Loading creator state…</h1></div></header><HubState kind="loading" title="Loading Creator Studio" body=""/></main></AppShell>
  if (error) return <AppShell><main className="seller creator-studio"><header className="seller-head"><div><span className="signal">Creator Studio</span><h1>Creator Studio needs attention.</h1></div></header><HubState kind="error" title="Creator Studio unavailable" body={error} action={<button className="button" onClick={() => void refresh()}>Try again</button>}/></main></AppShell>
  if (!application) return <AppShell><main className="seller creator-studio"><header className="seller-head"><div><span className="signal">Become a creator</span><h1>Sell working projects, not flattened files.</h1><p>Apply once. Approved creators can submit source-backed projects into the review and assessment pipeline.</p></div></header><section className="creator-application"><span>No application yet</span><h2>Start your creator application.</h2><p>The application starts as pending and does not grant publication authority.</p><button className="button primary" disabled={busy} onClick={() => void apply()}>{busy ? "Applying…" : "Apply to become a creator"} <Arrow/></button></section></main></AppShell>
  if (application.status !== "approved") return <AppShell><main className="seller creator-studio"><header className="seller-head"><div><span className="signal">Creator application</span><h1>{application.status === "pending" ? "Your application is in review." : "Your application was not approved."}</h1><p>Creator Studio unlocks only after server-side approval.</p></div></header><section className="creator-application"><span className={`creator-status ${application.status}`}>{application.status}</span><h2>Application {application.applicationId}</h2><p>Submitted {new Date(application.createdAt).toLocaleDateString()} · last updated {new Date(application.updatedAt).toLocaleDateString()}.</p></section></main></AppShell>
  if (!studio) return <AppShell><main className="seller creator-studio"><HubState kind="error" title="Studio data unavailable" body="The approved application exists, but the seller-scoped aggregate was not returned."/></main></AppShell>

  const readyCount = studio.ready.filter(item => item.status === "ready").length
  return <AppShell><main className="seller creator-studio"><header className="seller-head"><div><span className="signal">Creator Studio</span><h1>{page === "new" ? "Submit a project" : page === "projects" ? "Projects and listings" : "Your marketplace pipeline"}</h1><p>Seller-scoped product state from submission through immutable release and Listing.</p></div>{page !== "new" && <Link to="/seller/projects/new" className="button primary">Submit project <Arrow/></Link>}</header><nav className="creator-nav"><Link className={page === "home" ? "active" : ""} to="/seller">Overview</Link><Link className={page === "projects" ? "active" : ""} to="/seller/projects">Projects</Link><Link className={page === "new" ? "active" : ""} to="/seller/projects/new">New submission</Link></nav>{page === "home" && <><section className="creator-metrics"><div><span>Submissions</span><strong>{studio.submissions.length}</strong></div><div><span>Published listings</span><strong>{studio.listings.length}</strong></div><div><span>WebCanBe Ready</span><strong>{readyCount}</strong></div></section><section className="creator-pipeline"><div className="hub-section-head"><div><h2>Recent pipeline</h2><p>Review and assessment state is read from seller-safe server data.</p></div></div>{studio.submissions.length ? studio.submissions.slice(0,6).map(item => { const assessment = studio.assessments.find(value => value.submissionId === item.submissionId), review = studio.reviews.find(value => value.submissionId === item.submissionId); return <article key={item.submissionId}><div><span>Submission</span><b>{item.sourceProjectId}</b></div><div><span>Review</span><b>{review?.decision ?? item.status}</b></div><div><span>Assessment</span><b>{assessment?.result?.status ?? assessment?.status ?? "Not started"}</b></div><small>{new Date(item.createdAt).toLocaleDateString()}</small></article> }) : <p className="muted-copy">No submissions yet.</p>}</section></>}{page === "projects" && <><section className="creator-project-section"><div className="hub-section-head"><div><h2>Published listings</h2><p>Only bounded Listing metadata is editable here. Release binding stays immutable.</p></div><span>{studio.listings.length}</span></div>{studio.listings.length ? <div className="creator-listing-grid">{studio.listings.map(listing => <CreatorListingEditor key={listing.listingId} listing={listing} onSaved={updateListing}/>)}</div> : <HubState kind="empty" title="No published listings" body="Submitted projects appear here after review, assessment, promotion and publication."/>}</section><section className="creator-project-section"><div className="hub-section-head"><div><h2>Submission history</h2><p>Exact source revision and review state remain attached.</p></div><span>{studio.submissions.length}</span></div><div className="creator-submission-list">{studio.submissions.map(item => <article key={item.submissionId}><div><b>{item.sourceProjectId}</b><span>{item.status}</span></div><code>{item.sourceRevisionId}</code><small>{new Date(item.createdAt).toLocaleString()}</small></article>)}</div></section></>}{page === "new" && <section className="creator-submit"><div className="creator-submit-copy"><span className="signal">Source-backed submission</span><h2>Choose an existing project.</h2><p>The server captures its current accepted source revision and places that immutable snapshot into quarantine. This does not publish a Listing.</p></div><div className="creator-submit-form"><label>Workspace<select value={workspaceId} onChange={event => setWorkspaceId(event.target.value)}>{workspaces.map(value => <option value={value} key={value}>{value}</option>)}</select></label><label>Source project<select value={sourceProjectId} onChange={event => setSourceProjectId(event.target.value)}>{sourceProjects.map(value => <option value={value.id} key={value.id}>{value.name} · {value.id}</option>)}</select></label><button className="button primary" disabled={busy || !workspaceId || !sourceProjectId} onClick={() => void submit()}>{busy ? "Submitting…" : "Submit for review"} <Arrow/></button>{(!workspaces.length || !sourceProjects.length) && <p className="creator-message">Create an editable workspace project before submitting.</p>}</div></section>}</main></AppShell>
}

const field = (row: Record<string, unknown>, ...keys: string[]) => keys.map(key => row[key]).find(value => value !== undefined && value !== null)
const displayField = (value: unknown) => typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : value ? JSON.stringify(value) : "—"
function ControlRows({ rows, columns }: { rows: Array<Record<string, unknown>>; columns: Array<{ label: string; keys: string[] }> }) {
  return <div className="control-table"><div className="control-table-head">{columns.map(column => <span key={column.label}>{column.label}</span>)}</div>{rows.length ? rows.slice(0,20).map((row,index) => <div className="control-table-row" key={String(field(row,"audit_id","application_id","submission_id","release_id","listing_id") ?? index)}>{columns.map(column => <span key={column.label}>{displayField(field(row, ...column.keys))}</span>)}</div>) : <p>No records.</p>}</div>
}

function Control() {
  const hosted = hostedProductMode(), [control, setControl] = useState<ControlData>(), [loading, setLoading] = useState(hosted), [error, setError] = useState("")
  useEffect(() => {
    if (!hosted) return
    let current = true
    void hostedProductClient.controlRead().then(value => { if (current) { setControl(value); setLoading(false) } }, reason => { if (current) { setError(reason instanceof Error ? reason.message : "Control is unavailable."); setLoading(false) } })
    return () => { current = false }
  }, [hosted])
  if (!hosted) return <AppShell><main className="control"><header className="control-head"><span className="signal">Control</span><h1>Hosted operator session required.</h1><p>The local product preview does not fabricate privileged records.</p></header></main></AppShell>
  if (loading) return <AppShell><main className="control"><header className="control-head"><span className="signal">Control</span><h1>Loading operational state…</h1></header><HubState kind="loading" title="Loading Control" body=""/></main></AppShell>
  if (error || !control) return <AppShell><main className="control"><header className="control-head"><span className="signal">Control</span><h1>Control access unavailable.</h1><p>Only an active server-authorized product operator can read this surface.</p></header><HubState kind="error" title="Privileged read refused" body={error || "Control data was not returned."}/></main></AppShell>
  const metrics = [["Seller applications", control.sellerApplications.length], ["Submissions", control.submissions.length], ["Assessment results", control.results.length], ["Releases", control.releases.length], ["Listings", control.listings.length], ["Audit events", control.audit.length]] as const
  return <AppShell><main className="control"><header className="control-head"><span className="signal">Control</span><h1>Operational product state.</h1><p>Read-only Phase 4 view over existing authoritative records. IDs remain references; this screen does not mint authority.</p></header><section className="control-metrics">{metrics.map(([label,value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</section><aside className="control-stepup"><b>High-risk changes require fresh step-up.</b><p>The backend already enforces server-minted, session-bound, expiring step-up evidence. Phase 4 does not fake a passkey ceremony or expose a client-side bypass.</p></aside><section className="control-section"><div className="hub-section-head"><div><h2>Seller applications</h2><p>Application state across tenants for authorized operators.</p></div></div><ControlRows rows={control.sellerApplications} columns={[{label:"Application",keys:["application_id"]},{label:"User",keys:["user_id"]},{label:"Status",keys:["status"]},{label:"Updated",keys:["updated_at","created_at"]}]}/></section><section className="control-section"><div className="hub-section-head"><div><h2>Submission pipeline</h2><p>Quarantine/review state without source bodies or worker credentials.</p></div></div><ControlRows rows={control.submissions} columns={[{label:"Submission",keys:["submission_id"]},{label:"Seller",keys:["seller_user_id"]},{label:"Status",keys:["status"]},{label:"Revision",keys:["source_revision_id"]}]}/></section><section className="control-split"><div><div className="hub-section-head"><div><h2>Listings</h2><p>Published product records.</p></div></div><ControlRows rows={control.listings} columns={[{label:"Listing",keys:["listing_id"]},{label:"Title",keys:["title"]},{label:"Status",keys:["status"]},{label:"Availability",keys:["availability"]}]}/></div><div><div className="hub-section-head"><div><h2>Ready</h2><p>Server-authoritative qualification.</p></div></div><ControlRows rows={control.ready} columns={[{label:"Release",keys:["release_id"]},{label:"Status",keys:["qualification_status"]},{label:"Version",keys:["qualification_version"]}]}/></div></section><section className="control-section"><div className="hub-section-head"><div><h2>Privileged audit</h2><p>Append-only evidence for Control mutations.</p></div></div><ControlRows rows={control.audit} columns={[{label:"Actor",keys:["actor_user_id"]},{label:"Action",keys:["action"]},{label:"Target",keys:["target_id"]},{label:"Created",keys:["created_at"]}]}/></section></main></AppShell>
}'''
app = replace_between(app, 'function Seller(', 'export default function App()', seller_control)

old_route = 'if (path === "/seller") return <Seller/>; return <Browse/> }'
new_route = 'if (path === "/seller") return <Seller/>; if (path === "/control") return <Control/>; return <Browse/> }'
if old_route not in app:
    raise SystemExit("app route marker missing")
app = app.replace(old_route, new_route, 1)

import_marker = 'import "./phase4-product-hub.css"\n'
if import_marker not in main:
    raise SystemExit("main import marker missing")
main = main.replace(import_marker, import_marker + 'import "./phase4-operations.css"\n', 1)

css = r'''/* Phase 4 authenticated product operations surfaces. */
.auth .provider-button { gap:12px; }
.auth .provider-button b { color:#111; font-weight:500; }
.auth-error { margin:14px 0 0!important; padding:10px 12px; border:1px solid #eadada; border-radius:8px; background:#fcf7f7; color:#7b3f3f!important; font-size:12px!important; }
.auth-provider-note { margin-top:24px; padding:18px 0; border-top:1px solid #e8e8e8; border-bottom:1px solid #e8e8e8; }
.auth-provider-note span { font-size:12px; font-weight:600; }.auth-provider-note p { margin:6px 0 0; color:#777; font-size:12px; line-height:1.5; }
.auth-return { margin-top:16px!important; color:#777!important; font-size:12px!important; }.auth-return code { color:#222; }
.creator-studio,.control { max-width:1240px; margin:0 auto; padding:0 32px 110px; }
.creator-local-note,.creator-application { max-width:720px; padding:46px 0; border-top:1px solid #e8e8e8; }.creator-local-note p,.creator-application p { color:#6f6f6f; line-height:1.55; }
.creator-status { display:inline-flex; padding:5px 8px; border-radius:999px; background:#f2f2f2; text-transform:uppercase; font-size:10px; letter-spacing:.08em; }.creator-status.pending { color:#7a611b; background:#faf5e7; }.creator-status.rejected { color:#8a4040; background:#faeeee; }
.creator-nav { display:flex; gap:4px; padding:18px 0; border-bottom:1px solid #e8e8e8; }.creator-nav a { text-decoration:none; color:#6d6d6d; font-size:13px; padding:9px 12px; border-radius:8px; }.creator-nav a:hover { background:#f5f5f5; color:#111; }.creator-nav a.active { background:#111; color:#fff; }
.creator-metrics,.control-metrics { display:grid; grid-template-columns:repeat(3,1fr); border-bottom:1px solid #e8e8e8; }.creator-metrics>div,.control-metrics>div { padding:26px 0; }.creator-metrics>div+div,.control-metrics>div+div { border-left:1px solid #e8e8e8; padding-left:26px; }.creator-metrics span,.control-metrics span { display:block; color:#777; font-size:11px; }.creator-metrics strong,.control-metrics strong { display:block; margin-top:6px; font-size:29px; font-weight:520; letter-spacing:-.045em; }
.creator-pipeline,.creator-project-section { padding-top:44px; }.creator-pipeline>article { display:grid; grid-template-columns:1.1fr 1fr 1fr auto; gap:24px; padding:16px 0; border-top:1px solid #ededed; align-items:center; }.creator-pipeline>article span { display:block; color:#898989; font-size:10px; text-transform:uppercase; letter-spacing:.07em; }.creator-pipeline>article b { display:block; margin-top:5px; font-size:12px; font-weight:520; overflow-wrap:anywhere; }.creator-pipeline>article small { color:#858585; }
.creator-listing-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:18px; }.creator-listing-editor { border:1px solid #e5e5e5; border-radius:12px; padding:20px; }.creator-listing-head { display:flex; justify-content:space-between; gap:20px; margin-bottom:20px; }.creator-listing-head h3 { margin:5px 0; font-size:20px; }.creator-listing-head span,.creator-listing-head small { color:#777; font-size:10px; text-transform:uppercase; letter-spacing:.07em; }.listing-availability { height:max-content; padding:5px 7px; border-radius:999px; background:#f0f0f0; }.listing-availability.available { color:#16745e!important; background:#edf7f3; }.creator-listing-editor label,.creator-submit-form label { display:flex; flex-direction:column; gap:7px; margin-bottom:14px; color:#555; font-size:11px; }.creator-listing-editor input,.creator-listing-editor textarea,.creator-listing-editor select,.creator-submit-form select { width:100%; border:1px solid #ddd; background:#fff; color:#111; border-radius:8px; padding:10px; font:inherit; }.creator-listing-editor textarea { min-height:90px; resize:vertical; }.creator-listing-fields { display:grid; grid-template-columns:1fr 1fr; gap:12px; }.creator-message { color:#6f6f6f; font-size:12px; }
.creator-submission-list { border-top:1px solid #e8e8e8; }.creator-submission-list article { display:grid; grid-template-columns:1fr 1fr auto; gap:20px; align-items:center; padding:16px 0; border-bottom:1px solid #e8e8e8; }.creator-submission-list article div { display:flex; align-items:center; gap:12px; }.creator-submission-list span { color:#777; font-size:11px; }.creator-submission-list code,.creator-submission-list small { color:#777; font-size:11px; overflow-wrap:anywhere; }
.creator-submit { display:grid; grid-template-columns:1fr 1fr; gap:70px; padding:54px 0; }.creator-submit-copy h2 { margin:10px 0 12px; font-size:36px; letter-spacing:-.05em; }.creator-submit-copy p { color:#6d6d6d; line-height:1.55; }.creator-submit-form { border-top:1px solid #d8d8d8; padding-top:18px; }
.control { padding-top:64px; }.control-head { max-width:780px; padding-bottom:36px; }.control-head h1 { margin:10px 0 12px; font-size:clamp(46px,5.2vw,72px); line-height:.98; letter-spacing:-.065em; font-weight:520; }.control-head p { color:#6b6b6b; font-size:15px; line-height:1.55; }.control-metrics { grid-template-columns:repeat(6,1fr); border-top:1px solid #e8e8e8; }.control-stepup { margin:30px 0 48px; padding:18px 20px; border:1px solid #e4e4e4; border-radius:10px; background:#fafafa; }.control-stepup p { margin:6px 0 0; color:#6f6f6f; font-size:12px; line-height:1.5; }.control-section { margin-top:46px; }.control-split { display:grid; grid-template-columns:1fr 1fr; gap:42px; margin-top:46px; }.control-table { border-top:1px solid #e5e5e5; overflow:auto; }.control-table-head,.control-table-row { min-width:620px; display:grid; grid-auto-flow:column; grid-auto-columns:minmax(130px,1fr); gap:16px; padding:11px 0; border-bottom:1px solid #ededed; }.control-table-head { color:#878787; font-size:10px; text-transform:uppercase; letter-spacing:.07em; }.control-table-row { color:#333; font-size:11px; }.control-table-row span { overflow-wrap:anywhere; }.control-table>p { color:#777; font-size:12px; }
@media(max-width:960px){.creator-listing-grid,.creator-submit,.control-split{grid-template-columns:1fr}.control-metrics{grid-template-columns:repeat(3,1fr)}.control-metrics>div:nth-child(4){border-left:0}.creator-pipeline>article{grid-template-columns:1fr 1fr}.creator-pipeline>article small{grid-column:1 / -1}}
@media(max-width:720px){.creator-studio,.control{padding-left:20px;padding-right:20px}.creator-metrics,.control-metrics{grid-template-columns:1fr}.creator-metrics>div+div,.control-metrics>div+div{border-left:0;border-top:1px solid #e8e8e8;padding-left:0}.creator-listing-fields{grid-template-columns:1fr}.creator-submission-list article{grid-template-columns:1fr}.creator-pipeline>article{grid-template-columns:1fr}.creator-pipeline>article small{grid-column:auto}}
'''

test = r'''import { describe, expect, it } from "vitest"
import fs from "node:fs"

describe("Phase 4 authenticated operations surfaces", () => {
  const app = fs.readFileSync("src/App.tsx", "utf8")
  const client = fs.readFileSync("src/hostedProductClient.ts", "utf8")
  const main = fs.readFileSync("src/main.tsx", "utf8")

  it("uses the real hosted sign-in start boundary instead of a fake successful login", () => {
    expect(app).toContain("hostedProductClient.authStart()")
    expect(client).toContain('this.request("/__webcanbe/auth/start"')
    expect(app).toContain("Email/password is not enabled")
    expect(app).not.toContain("Continue with Google</button>")
  })

  it("connects Creator Studio to seller-scoped application, studio, listing and submission APIs", () => {
    for (const token of ["sellerApplication()", "applySeller()", "creatorStudio()", "updateCreatorListing(", "createSellerSubmission("]) expect(client).toContain(token)
    expect(app).toContain("Creator Studio")
    expect(app).toContain("Submit for review")
    expect(app).toContain("Release binding stays immutable")
    expect(app).not.toContain("UI-only preview")
  })

  it("adds an operator-only read surface without inventing client-side authority", () => {
    expect(client).toContain('"/__webcanbe/api/product/control/read"')
    expect(app).toContain('if (path === "/control") return <Control/>')
    expect(app).toContain("High-risk changes require fresh step-up")
    expect(app).toContain("does not fake a passkey ceremony")
  })

  it("loads the Phase 4 operations style layer after the product hub styles", () => {
    expect(main.indexOf('import "./phase4-product-hub.css"')).toBeLessThan(main.indexOf('import "./phase4-operations.css"'))
  })
})
'''

app_path.write_text(app)
client_path.write_text(client)
main_path.write_text(main)
Path("src/phase4-operations.css").write_text(css)
Path("src/phase4-operations.test.ts").write_text(test)
