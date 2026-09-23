import { Component, Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react"
import { LayoutDashboard, Store, FolderKanban, ShoppingBag, PanelsTopLeft, BookOpen, Settings2, Settings as SettingsIcon, ChevronDown, ChevronRight, Search, Bell, Phone, X, FileCode2, History, PackageCheck, Sparkles, Plus, CircleHelp, ShieldCheck, ScrollText, LogOut, Command, CheckCircle2, ExternalLink, ListTodo, MessagesSquare, Users, Bug, HelpCircle, ChevronsUpDown, Download, CreditCard, BadgeCheck, UserCircle2 } from "lucide-react"
import Home from "./Home"
import { SharedCTA, SharedFooter } from "./public/SharedFooter"
import { PublicSite } from "./public/PublicSite"
const DocsShell = lazy(() => import("./public/DocsShell").then(m=>({default:m.DocsShell})))
import publicManifest from "./public/route-manifest.json"
const docPages = publicManifest.routes as Record<string,{title:string;description:string}>
import { ProductShell, OnboardingStrip, Avatar, useAccount, useWorkspaces, CreateWorkspaceDialog } from "./app-shell"
import { appRoutes, viewForPath, finishAuthIntent, readLocal, writeLocal, workspaceLabel, type DashboardView } from "./shellState"
import { safeAuthReturn } from "./authReturn"
import "./app.css"
const CompatibleWorkspace = lazy(() => import("./webcanbe-engine/visual-editor/CompatibleWorkspace"))
const PreviewRuntimeHost = lazy(() => import("./PreviewRuntimeHost"))
import { hostedProductClient, hostedProductMode, controlMode, productMutationMode, productReadMode, productionAuthMode, type ControlData, type CreatorStudioData, type HostedListing, type HostedListingDetail, type PaymentBilling, type RequestCase, type RequestEvent, type SourceProjectSummary } from "./hostedProductClient"
import { createEmailAccountFirebase, currentFirebaseIdToken, currentFirebaseProviderIds, firebaseAuthErrorMessage, signInWithEmailFirebase, signInWithGithubFirebase, signOutFirebase } from "./firebaseAuth"
import type { LicenseEntitlement, WorkspaceProject } from "./webcanbe-engine/runtime/productDomain"
import { loadPublicPaymentConfiguration, type PublicPaymentConfiguration, type PublicPaymentPlan } from "./webcanbe-engine/runtime/planCatalog"
import { clearPaymentIdempotencyKey, paymentIdempotencyKey, paymentReturn } from "./paymentFlow"
const CreatorEnvironment = lazy(() => import("./creator-shell").then(module=>({default:module.CreatorEnvironment})))
const ControlRequests = lazy(() => import("./control-requests").then(module=>({default:module.ControlRequests})))
import { analytics } from "./analytics"

type Project = { id: string; slug: string; title: string; tagline: string; price: number; priceMinor?: number; currency?: "USD"; stack: string[]; category: string; color: string; creator: string; updated: string; releaseId?: string }

export const projects: Project[] = [
  { id: "northstar", slug: "northstar-studio", title: "Northstar Studio", tagline: "A considered site for a small creative practice.", price: 79, stack: ["Next.js", "TypeScript", "Tailwind"], category: "Marketing", color: "lilac", creator: "Sora Kim", updated: "Updated 4 days ago" },
  { id: "fieldnotes", slug: "fieldnotes-journal", title: "Fieldnotes", tagline: "An editorial home for stories, guides, and dispatches.", price: 59, stack: ["React", "Vite", "CSS"], category: "Editorial", color: "sand", creator: "Mina Cole", updated: "Updated 2 weeks ago" },
  { id: "relay", slug: "relay-client-portal", title: "Relay", tagline: "A client portal with calm project handoff flows.", price: 99, stack: ["Next.js", "Supabase", "TypeScript"], category: "SaaS", color: "mint", creator: "Kai Williams", updated: "Updated 6 days ago" },
  { id: "morrow", slug: "morrow-shop", title: "Morrow", tagline: "A focused store for objects made in small runs.", price: 89, stack: ["React", "Stripe", "CSS"], category: "Commerce", color: "rose", creator: "Avery Singh", updated: "Updated yesterday" },
  { id: "suite", slug: "suite-property", title: "Suite", tagline: "A hospitality site built around place and atmosphere.", price: 69, stack: ["Next.js", "MDX", "TypeScript"], category: "Marketing", color: "ink", creator: "David Ren", updated: "Updated 3 weeks ago" },
  { id: "brief", slug: "brief-directory", title: "Brief", tagline: "A useful, searchable directory with an editorial point of view.", price: 49, stack: ["React", "Vite", "JSON"], category: "Directory", color: "orange", creator: "Leah Moss", updated: "Updated 5 days ago" },
]

const colors = ["lilac", "sand", "mint", "rose", "ink", "orange"]
const metadataText = (value: unknown, fallback: string) => typeof value === "string" && value.trim() ? value : fallback
function hostedProject(listing: HostedListing | HostedListingDetail, index = 0): Project {
  const detail = "publicMetadata" in listing ? listing.publicMetadata : {}, demo = listing.demoMetadata
  const priceMinor = typeof listing.priceMinor === "number" && Number.isSafeInteger(listing.priceMinor) ? listing.priceMinor : 0
  return { id: listing.listingId, slug: listing.slug, title: listing.title, tagline: listing.summary, price: priceMinor / 100, priceMinor, currency: listing.currency === "USD" ? "USD" : undefined, stack: listing.tags.length ? listing.tags : ["React", "Vite"], category: metadataText(detail.category ?? demo.category, "Project"), color: metadataText(demo.color, colors[index % colors.length]), creator: metadataText(detail.creator ?? demo.creator, "Webcanbe creator"), updated: `Release ${listing.releaseVersion}`, releaseId: listing.releaseId }
}

function usePath() {
  const [path, setPath] = useState(window.location.pathname + window.location.search)
  useEffect(() => { const update = () => setPath(window.location.pathname + window.location.search); window.addEventListener("popstate", update); return () => window.removeEventListener("popstate", update) }, [])
  return path.split("?")[0]
}

let routeTimer: number | undefined
function go(to: string) {
  const current = window.location.pathname + window.location.search
  if (to.startsWith("/login") || to.startsWith("/signup")) {
    const nextUrl = new URL(to, window.location.origin)
    const next = authNext(nextUrl.searchParams.get("next") || "/dashboard")
    window.dispatchEvent(new CustomEvent("wcb:open-auth", { detail: { signup: to.startsWith("/signup"), next } }))
    return
  }
  if (to === current) return
  if (publicManifest.routes[to as keyof typeof publicManifest.routes] || to.startsWith("/docs/") || to.startsWith("/contact/") || to.startsWith("/legal/")) { window.location.assign(to); return }
  if (routeTimer) window.clearTimeout(routeTimer)
  document.documentElement.classList.add("wcb-route-leaving")
  routeTimer = window.setTimeout(() => {
    window.history.pushState({}, "", to)
    window.dispatchEvent(new PopStateEvent("popstate"))
    window.scrollTo(0, 0)
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => document.documentElement.classList.remove("wcb-route-leaving")))
    routeTimer = undefined
  }, 120)
}
function Link({ to, children, className = "" }: { to: string; children: React.ReactNode; className?: string }) { return <a className={className} href={to} onClick={(e) => { if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); go(to) }}>{children}</a> }
function Mark({publicBrand=false}:{publicBrand?:boolean}={}) { return <span className="wcb-logo-wrap"><img className="wcb-logo-symbol" src={publicBrand?"/brand/webcanbe-mark.svg":"/favicon.png"} alt="" aria-hidden="true"/><span className="wcb-wordmark">Webcanbe</span></span> }
function Arrow() { return <span className="arrow">↗</span> }
function GoogleBrandMark() {
  return <svg className="auth-provider-brand auth-provider-google" viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.482h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.909c1.702-1.567 2.683-3.875 2.683-6.615Z"/><path fill="#34A853" d="M9 18c2.43 0 4.468-.806 5.957-2.18l-2.909-2.258c-.806.54-1.835.859-3.048.859-2.344 0-4.328-1.585-5.037-3.715H.956v2.332A9 9 0 0 0 9 18Z"/><path fill="#FBBC05" d="M3.963 10.706A5.41 5.41 0 0 1 3.682 9c0-.592.102-1.168.281-1.706V4.962H.956A9 9 0 0 0 0 9c0 1.452.347 2.827.956 4.038l3.007-2.332Z"/><path fill="#EA4335" d="M9 3.579c1.321 0 2.508.454 3.441 1.346l2.581-2.581C13.464.892 11.425 0 9 0A9 9 0 0 0 .956 4.962l3.007 2.332C4.672 5.164 6.656 3.579 9 3.579Z"/></svg>
}
function GitHubBrandMark() {
  return <svg className="auth-provider-brand auth-provider-github" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .7C5.76.7.7 5.76.7 12c0 4.99 3.24 9.22 7.73 10.72.56.1.77-.24.77-.54v-2.1c-3.14.68-3.8-1.33-3.8-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.03-.7.08-.69.08-.69 1.13.08 1.73 1.16 1.73 1.16 1.01 1.73 2.65 1.23 3.3.94.1-.73.4-1.23.72-1.51-2.51-.29-5.15-1.26-5.15-5.59 0-1.24.44-2.25 1.16-3.05-.12-.29-.5-1.44.11-3 0 0 .95-.3 3.11 1.16A10.8 10.8 0 0 1 12 6.13c.96 0 1.92.13 2.83.38 2.16-1.46 3.1-1.16 3.1-1.16.62 1.56.23 2.71.12 3 .72.8 1.16 1.81 1.16 3.05 0 4.34-2.65 5.3-5.17 5.58.4.35.76 1.04.76 2.1v3.1c0 .3.2.65.78.54A11.31 11.31 0 0 0 23.3 12C23.3 5.76 18.24.7 12 .7Z"/></svg>
}
function LoadingSpinner({ small=false }: { small?: boolean }) {
  return <span className={small?"wcb-spinner wcb-spinner-small":"wcb-spinner"} aria-hidden="true"/>
}

function Landing() { return <Home onNavigate={go} /> }

function CreatorIntroduction() {
  return <PublicShell><main className="standard creator-introduction"><header className="hub-title"><div><h1>Share projects people can make their own.</h1><p>Webcanbe Creator is for source-backed web projects that are ready to be reviewed, released, and supported as real starting points.</p></div></header><section className="hub-section"><div className="hub-section-head"><div><h2>A deliberate publishing path</h2><p>Your account is not automatically a creator account.</p></div></div><ol className="creator-intro-steps"><li><b>Sign in or create an account</b><span>Use your existing Webcanbe account to begin.</span></li><li><b>Submit your application</b><span>Applications enter review before creator tools become available.</span></li><li><b>Build and submit a source project</b><span>Approved creators submit an immutable revision through the release pipeline.</span></li></ol><div className="rd-page-actions"><Link className="button primary" to="/seller">Start creator application <Arrow/></Link><Link className="button" to="/docs/creators">Read the creator guide</Link></div></section></main></PublicShell>
}

const publicNav = [["Product", "/docs/visual-editor"], ["Marketplace", "/browse"], ["Learn", "/docs"], ["Resources", "/changelog"]] as const


function SiteFooter() { return <SharedFooter/> }
function localSignedIn(){try{return sessionStorage.getItem("wcb-demo-auth")==="1"}catch{return false}}
async function productionSignedIn(){
  if(await hostedProductClient.authenticated().catch(()=>false))return true
  const idToken=await currentFirebaseIdToken().catch(()=>undefined)
  if(!idToken)return false
  try{
    await hostedProductClient.firebaseExchange(idToken)
    return await hostedProductClient.authenticated()
  }catch{
    return false
  }
}
async function productionSignOut(){
  await Promise.allSettled([
    hostedProductClient.logout(),
    signOutFirebase(),
  ])
}
function PublicShell({ children, active }: { children: React.ReactNode; active?: string }) {
  const auth=productionAuthMode(), [menu,setMenu]=useState(false), [signedIn,setSignedIn]=useState(auth?false:localSignedIn())
  useEffect(()=>{let current=true;const refresh=()=>{if(!current)return;if(auth)void productionSignedIn().then(v=>{if(current)setSignedIn(v)});else setSignedIn(localSignedIn())};refresh();window.addEventListener("wcb:auth-changed",refresh);return()=>{current=false;window.removeEventListener("wcb:auth-changed",refresh)}},[auth])
  return <div className={"product public-product"+(active==="/docs"?" docs-public-page":"")}><header className="product-header public-header"><Link to="/" className="brand"><Mark publicBrand/></Link><nav>{publicNav.map(([n,p])=><Link key={p} to={p} className={active===p?"active":""}>{n}</Link>)}</nav><div className="header-actions">{signedIn?<Link to="/settings" className="quiet-link">Account</Link>:<><Link to="/login" className="quiet-link">Log in</Link><Link to="/signup" className="button primary compact">Get started</Link></>}<button className="mobile-menu" aria-expanded={menu} aria-label="Toggle navigation" onClick={()=>setMenu(!menu)}>Menu</button></div>{menu&&<div className="mobile-nav">{publicNav.map(([n,p])=><Link key={p} to={p}>{n}</Link>)}{signedIn?<Link to="/settings">Account</Link>:<><Link to="/login">Log in</Link><Link to="/signup">Get started</Link></>}</div>}</header>{children}<SharedCTA/><SiteFooter/></div>
}
function AppShell({ children, active }:{children:React.ReactNode;active?:string;footer?:boolean}) {
  return <RopeanDashboardShell view={viewForPath(active || window.location.pathname)}>{children}</RopeanDashboardShell>
}
function Protected({ children }: { children: React.ReactNode }) {
  const auth = productionAuthMode()
  const [state, setState] = useState<"checking" | "allowed" | "denied">(() => auth ? "checking" : localSignedIn() ? "allowed" : "checking")
  const requestSignIn = () => go("/login?next=" + encodeURIComponent(window.location.pathname + window.location.search))
  useEffect(() => {
    let current = true
    const refresh = async () => {
      const allowed = auth ? await productionSignedIn() : localSignedIn()
      if (!current) return
      setState(allowed ? "allowed" : "denied")
      if (!allowed) requestSignIn()
    }
    void refresh()
    window.addEventListener("wcb:auth-changed", refresh)
    return () => { current = false; window.removeEventListener("wcb:auth-changed", refresh) }
  }, [auth])
  if (state === "denied") return <main className="route-gate"><span className="signal">Account</span><h1>Sign in to continue.</h1><p>Your workspace will open after you sign in.</p><button type="button" className="button primary" onClick={requestSignIn}>Sign in</button></main>
  if (state === "checking") return <main className="route-gate" role="status" aria-live="polite" aria-busy="true"><LoadingSpinner/><span className="signal">Account</span><p>Checking your session…</p></main>
  return <>{children}</>
}
function Preview({ project, large = false }: { project: Project; large?: boolean }) {
  return <div className={`project-preview ${project.color} ${large ? "large" : ""}`}><div className="preview-nav"><span>{project.title}</span><span>Index&nbsp;&nbsp; About&nbsp;&nbsp; Contact</span></div><div className="preview-body"><p>{project.category}</p><h3>{project.title}<br/>made to be <em>used.</em></h3><div className="preview-orb"/></div><div className="preview-foot"><span>Scroll to explore</span><span>01 — 04</span></div></div>
}
const creatorPath=(creator:string)=>`/creators/${encodeURIComponent(creator.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,""))}`
function ProjectCard({ project }: { project: Project }) { return <article className="project-card"><Link to={`/project/${project.slug}`} aria-label={`View ${project.title}`}><Preview project={project}/></Link><div className="card-meta"><div><Link className="project-title" to={`/project/${project.slug}`}>{project.title}</Link><Link className="creator-link" to={creatorPath(project.creator)}>by {project.creator}</Link></div><strong>{project.price ? `$${project.price}` : "Free"}</strong></div></article> }

function Browse() {
  const catalogType=new URLSearchParams(window.location.search).get("type") || "templates"
  const [query,setQuery]=useState(""), [category,setCategory]=useState(()=>new URLSearchParams(window.location.search).get("category")||"All projects"), [sort,setSort]=useState<"recent"|"price-low"|"price-high"|"name">("recent"), [price,setPrice]=useState("all"), [style,setStyle]=useState("all")
  const hosted=productReadMode(), [catalog,setCatalog]=useState<Project[]>([]), [catalogMessage,setCatalogMessage]=useState(hosted?"Loading projects…":""), [catalogFailed,setCatalogFailed]=useState(false), [retry,setRetry]=useState(0)
  const categories=["All projects","Marketing","Commerce","SaaS","Editorial","Directory"]
  const local=useMemo(()=>projects.filter(p=>(category==="All projects"||p.category===category)&&(!price||price==="all"||(price==="free"?p.price===0:price==="under-75"?p.price<75:p.price>=75))&&(!style||style==="all"||p.category===style)&&(`${p.title} ${p.tagline} ${p.stack.join(" ")}`).toLowerCase().includes(query.toLowerCase())),[query,category,price,style])
  useEffect(()=>{if(!hosted)return;let current=true;setCatalogMessage("Loading projects…");setCatalogFailed(false);void hostedProductClient.browse({...(query.trim()?{query}:{}),...(category==="All projects"?{}:{tags:[category]}),limit:100}).then(v=>{if(current){setCatalog(v.map(hostedProject));setCatalogMessage("")}},e=>{if(current){setCatalog([]);setCatalogFailed(true);setCatalogMessage(e instanceof Error?e.message:"Catalog unavailable.")}});return()=>{current=false}},[hosted,query,category,retry])
  const filtered=hosted?catalog:local
  const visible=useMemo(()=>{const n=[...filtered];if(sort==="price-low")n.sort((a,b)=>a.price-b.price);else if(sort==="price-high")n.sort((a,b)=>b.price-a.price);else if(sort==="name")n.sort((a,b)=>a.title.localeCompare(b.title));return n},[filtered,sort])
  const state = catalogType !== "templates" ? <HubState kind="empty" title={`${catalogType[0].toUpperCase()+catalogType.slice(1)} are not published yet`} body="This catalog category is available to browse, but it has no public items at the moment." action={<Link className="button" to="/browse">Browse templates</Link>}/> : catalogMessage ? <HubState kind={catalogFailed ? "error" : "loading"} title={catalogFailed ? "Marketplace is unavailable" : "Loading marketplace"} body={catalogFailed ? catalogMessage : ""} action={catalogFailed ? <button className="button" onClick={()=>setRetry(value=>value+1)}>Try again</button> : undefined}/> : visible.length ? <section className="project-grid">{visible.map(p=><ProjectCard project={p} key={p.id}/>)}</section> : <HubState kind="empty" title="No matching projects" body="Try another search or filter." action={<button className="button" onClick={()=>{setQuery("");setCategory("All projects");setPrice("all");setStyle("all")}}>Clear filters</button>}/>
  return <PublicShell active="/browse"><main className="browse browse-enter"><section className="browse-hero"><div><span className="signal">Marketplace</span><h1>Find a better<br/>place to <em>start.</em></h1></div><p>Published web projects with source you can inspect, acquire, and make your own.</p></section><nav className="market-types" aria-label="Marketplace types">{[["Templates",""],["Components","components"],["Plugins","plugins"],["Vectors","vectors"]].map(([label,type])=><Link className={catalogType===(type||"templates")?"active":""} key={label} to={type?`/browse?type=${type}`:"/browse"}>{label}</Link>)}</nav><section className="browse-controls"><label className="search"><Search aria-hidden="true"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search projects"/></label><div className="filters" aria-label="Categories">{categories.map(c=><button type="button" onClick={()=>setCategory(c)} className={category===c?"selected":""} key={c}>{c}</button>)}</div><div className="market-selects"><label>Price<select value={price} onChange={e=>setPrice(e.target.value)}><option value="all">Any price</option><option value="free">Free</option><option value="under-75">Under $75</option><option value="75-plus">$75 and up</option></select></label><label>Style<select value={style} onChange={e=>setStyle(e.target.value)}><option value="all">Any style</option>{categories.slice(1).map(value=><option key={value} value={value}>{value}</option>)}</select></label></div></section><section className="browse-heading"><p>{catalogMessage||`${visible.length} projects`}</p><label className="sort">Sort<select value={sort} onChange={e=>setSort(e.target.value as typeof sort)}><option value="recent">Recent</option><option value="name">Best match</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></label></section>{state}</main></PublicShell>
}
function projectStructure(project:Project){const next=project.stack.some(v=>v.toLowerCase().includes("next"));return next?["app/","  page.tsx","  layout.tsx","components/","  Hero.tsx","styles/","  globals.css"]:["src/","  main.tsx","  App.tsx","  components/","    Hero.tsx","  styles.css","public/"]}
function Detail({ reference }: { reference: string }) {
  const hosted=productReadMode()
  const [project,setProject]=useState<Project|undefined>(),[tab,setTab]=useState("Overview"),[message,setMessage]=useState(hosted?"Loading project…":"Marketplace previews require the hosted catalog."),[failed,setFailed]=useState(!hosted),[retry,setRetry]=useState(0),[buying,setBuying]=useState(false)
  useEffect(()=>{if(!hosted)return;let current=true;setProject(undefined);setFailed(false);setMessage("Loading project…");void hostedProductClient.detail(reference).then(l=>{if(current){setProject(hostedProject(l));setMessage("")}},e=>{if(current){setFailed(true);setMessage(e instanceof Error?e.message:"Project unavailable.")}});return()=>{current=false}},[hosted,reference,retry])
  if(!project)return <PublicShell active="/browse"><main className="detail"><div className="crumb"><Link to="/browse">Marketplace</Link><span>/</span><span>{failed ? "Unavailable" : "Loading"}</span></div><HubState kind={failed ? "error" : "loading"} title={failed ? "This project is unavailable" : "Loading project"} body={failed ? message : ""} action={failed ? <><button className="button primary" onClick={()=>setRetry(value=>value+1)}>Try again</button><Link className="button" to="/browse">Back to marketplace</Link></> : undefined}/></main></PublicShell>
  const target=`/checkout/${encodeURIComponent(project.releaseId??project.id)}?project=${encodeURIComponent(project.slug)}`
  const buy=async()=>{if(buying)return;setBuying(true);if(!hosted){go("/login?next="+encodeURIComponent(target));return}go(await hostedProductClient.authenticated()?target:"/login?next="+encodeURIComponent(target))}
  return <PublicShell active="/browse"><main className="detail"><div className="crumb"><Link to="/browse">Marketplace</Link><span>/</span><span>{project.title}</span></div><section className="detail-top"><div><div className="project-eyebrow">{project.category} template</div><h1>{project.title}</h1><p>{project.tagline}</p><Link className="creator-link detail-creator" to={creatorPath(project.creator)}>By {project.creator}</Link><div className="detail-actions"><button className="button primary" disabled={buying} onClick={()=>void buy()}>{buying?"Continuing…":project.price?`Buy for $${project.price}`:"Acquire free project"} <Arrow/></button><Link className="button" to={`/project/${project.slug}/preview`}>Preview <ExternalLink/></Link></div></div><aside className="price-box"><span>{project.price ? "One-time project price" : "Free project"}</span><strong>{project.price ? `$${project.price}` : "Free"}</strong><p>Marketplace projects are separately priced from Webcanbe plans.</p></aside></section><Preview project={project} large/><section className="preview-gallery" aria-label="Project preview gallery"><Preview project={project}/><Preview project={project}/><Preview project={project}/></section><div className="detail-content"><section><div className="tabs">{["Product information","What’s included","Project structure"].map(t=><button className={tab===t?"active":""} onClick={()=>setTab(t)} key={t}>{t}</button>)}</div>{tab==="Product information"&&<div className="copy-block"><h2>Built to be adapted.</h2><p>{project.title} is a published source project. Review the preview and compatibility information before acquiring a working copy.</p></div>}{tab==="What’s included"&&<ul className="included"><li>Complete source code and project configuration</li><li>Responsive pages and reusable components</li><li>Visual editing compatibility</li><li>Release-specific terms shown during acquisition</li></ul>}{tab==="Project structure"&&<div className="file-tree">{projectStructure(project).map((x,i)=><span className={x.startsWith("    ")?"indent-2":x.startsWith("  ")?"indent":""} key={i}>{x.trim()}</span>)}</div>}</section><aside className="specs"><h3>Project details</h3><dl><div><dt>Compatibility</dt><dd>Visual + code editing</dd></div><div><dt>Release</dt><dd>{project.updated}</dd></div><div><dt>Tech stack</dt><dd>{project.stack.join(", ")}</dd></div><div><dt>Creator</dt><dd><Link to={creatorPath(project.creator)}>{project.creator}</Link></dd></div></dl></aside></div></main></PublicShell>
}
function CreatorProfile({handle}:{handle:string}) {
  const creator = projects.find(project=>creatorPath(project.creator).endsWith(`/${handle}`))?.creator
  const published = creator ? projects.filter(project=>project.creator===creator) : []
  return <PublicShell active="/browse"><main className="creator-profile"><Link className="back-link" to="/browse">← Marketplace</Link><header><span className="creator-avatar" aria-hidden="true">{creator?.split(" ").map(part=>part[0]).join("")}</span><div><h1>{creator || "Creator profile"}</h1><p>{creator ? "Published projects on Webcanbe." : "This creator profile is unavailable."}</p></div></header>{creator ? <section><h2>Published projects</h2>{published.length ? <div className="project-grid">{published.map(project=><ProjectCard key={project.id} project={project}/>)}</div> : <HubState kind="empty" title="No published projects" body="This creator does not have a public project available right now."/>}</section> : <HubState kind="error" title="Creator unavailable" body="This public profile could not be found." action={<Link className="button" to="/browse">Back to marketplace</Link>}/>}<Link className="button" to="/contact/sellers">Contact or request a project</Link></main></PublicShell>
}
function ProjectPreviewPage({reference}:{reference:string}) {
  const hosted=productReadMode(), fallback=projects.find(x=>x.slug===reference)
  const [project,setProject]=useState<Project|undefined>(hosted?undefined:fallback), [message,setMessage]=useState(hosted?"Loading preview…":"No project matches this address."), [failed,setFailed]=useState(!hosted&&!fallback)
  useEffect(()=>{if(!hosted){setProject(fallback);setFailed(!fallback);return}let current=true;setProject(undefined);setFailed(false);setMessage("Loading preview…");void hostedProductClient.detail(reference).then(listing=>{if(current){setProject(hostedProject(listing));setMessage("")}},reason=>{if(current){setFailed(true);setMessage(reason instanceof Error?reason.message:"Project preview is unavailable.")}});return()=>{current=false}},[hosted,reference])
  if(!project)return <PublicShell active="/browse"><main className="project-preview-page"><HubState kind={failed?"error":"loading"} title={failed?"This project preview is unavailable":"Loading preview"} body={failed?message:""} action={failed?<Link className="button" to="/browse">Back to marketplace</Link>:undefined}/></main></PublicShell>
  return <PublicShell active="/browse"><main className="project-preview-page"><div className="project-preview-toolbar"><Link to={`/project/${reference}`}>← Back to project</Link><span>Public preview</span></div><Preview project={project} large/><section className="project-preview-meta"><div><span>{project.category}</span><h1>{project.title}</h1><p>{project.tagline}</p></div><div><b>{project.stack.join(" · ")}</b><small>Editing stays inside an authenticated working copy.</small></div></section></main></PublicShell>
}
function authNext(raw: unknown = new URLSearchParams(window.location.search).get("next")) {
  return safeAuthReturn(raw, window.location.origin)
}

function Auth({signup=false,next="/dashboard",onClose}:{signup?:boolean;next?:string;onClose?:()=>void}) {
  const auth=productionAuthMode(),[busy,setBusy]=useState(false),[error,setError]=useState(""),[emailStep,setEmailStep]=useState(false),[email,setEmail]=useState(""),[password,setPassword]=useState("")
  const dialogRef = useRef<HTMLElement>(null)
  const startedAt = useRef(Date.now())
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogRef.current?.querySelector<HTMLElement>("button:not([disabled])")?.focus()
    return () => { if (previous?.isConnected) previous.focus() }
  }, [])
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy && onClose) { event.preventDefault(); onClose(); return }
      if (event.key !== "Tab") return
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),a[href],select:not([disabled]),textarea:not([disabled]),[tabindex="0"]') ?? []).filter(element => element.getClientRects().length > 0)
      const first = controls[0], last = controls.at(-1)
      if (!first || !last) return
      if (!dialogRef.current?.contains(document.activeElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      }
    }
    window.addEventListener("keydown", keyboard)
    return () => window.removeEventListener("keydown", keyboard)
  }, [busy, onClose])
  const finish=async()=>{const destination=await finishAuthIntent(signup,startedAt.current,next);window.dispatchEvent(new Event("wcb:auth-changed"));onClose?.();go(destination)}
  const establishFirebaseSession=async(credential:Awaited<ReturnType<typeof signInWithGithubFirebase>>)=>{
    const idToken=await credential.user.getIdToken(true)
    await hostedProductClient.firebaseExchange(idToken)
  }
  const runGoogle=async()=>{if(busy)return;setBusy(true);setError("");try{if(auth){try{sessionStorage.setItem("wcb-auth-next",next);sessionStorage.setItem("wcb-auth-intent",JSON.stringify({signup,startedAt:startedAt.current}))}catch{}window.location.assign(await hostedProductClient.authStart());return}try{sessionStorage.setItem("wcb-demo-auth","1")}catch{}finish()}catch(e){setError(e instanceof Error?e.message:"Sign-in is unavailable.");setBusy(false)}}
  const runGithub=async()=>{if(busy)return;setBusy(true);setError("");try{if(auth){const credential=await signInWithGithubFirebase();await establishFirebaseSession(credential);await finish();return}try{sessionStorage.setItem("wcb-demo-auth","1")}catch{}finish()}catch(e){if(auth)await signOutFirebase().catch(()=>{});setError(firebaseAuthErrorMessage(e));setBusy(false)}}
  const runEmail=async()=>{if(busy)return;setError("");if(!emailStep){if(!email.trim()){setError("Enter your email address.");return}setEmailStep(true);return}if(!password){setError("Enter your password.");return}setBusy(true);try{if(auth){const credential=signup?await createEmailAccountFirebase(email.trim(),password):await signInWithEmailFirebase(email.trim(),password);await establishFirebaseSession(credential);await finish();return}try{sessionStorage.setItem("wcb-demo-auth","1")}catch{}finish()}catch(e){if(auth)await signOutFirebase().catch(()=>{});setError(firebaseAuthErrorMessage(e));setBusy(false)}}
  return <div className="auth-demo-layer"><div className="auth-demo-backdrop"/><section ref={dialogRef} className="auth-demo-modal" role="dialog" aria-modal="true" aria-labelledby="wcb-auth-title" aria-busy={busy}><button className="auth-demo-close" aria-label="Close sign-in" onClick={onClose}><X/></button><h1 id="wcb-auth-title">{signup?"Create your Webcanbe account":"Log in to Webcanbe"}</h1><p>Open projects, keep source history, and continue from any workspace.</p><div className="auth-demo-actions"><button className="auth-demo-provider" disabled={busy} onClick={()=>void runGoogle()}><GoogleBrandMark/><span>Continue with Google</span></button><button className="auth-demo-provider" disabled={busy} onClick={()=>void runGithub()}><GitHubBrandMark/><span>Continue with GitHub</span></button><button className="auth-demo-provider" disabled title="Phone sign-in is not connected yet"><Phone/><span>Continue with phone</span></button></div><div className="auth-demo-divider"><span>OR</span></div><input className="auth-demo-email" aria-label={emailStep?"Password":"Email address"} type={emailStep?"password":"email"} placeholder={emailStep?"Password":"Email address"} value={emailStep?password:email} autoComplete={emailStep?(signup?"new-password":"current-password"):"email"} onChange={event=>emailStep?setPassword(event.target.value):setEmail(event.target.value)} onKeyDown={event=>{if(event.key==="Enter")void runEmail()}}/><button className="auth-demo-continue" disabled={busy} onClick={()=>void runEmail()}>{busy?<><LoadingSpinner small/><span>Continuing…</span></>:"Continue"}</button>{signup&&<p className="auth-demo-provider-note">By creating an account, you agree to the <a href="/legal/terms">Terms of Service</a> and acknowledge the <a href="/legal/privacy">Privacy Policy</a>.</p>}{auth&&<p className="auth-demo-provider-note">Google, GitHub, and email sign-in are available.</p>}{error&&<p className="auth-demo-error" role="alert">{error}</p>}</section></div>
}
function Documentation({path}:{path:string}) { return docPages[path] ? <PublicShell active="/docs"><DocsShell path={path}/></PublicShell> : <NotFound path={path}/> }
const infoPages: Record<string, { eyebrow: string; title: string; intro: string; items: { title: string; body: string }[] }> = {
  "/changelog": { eyebrow:"Resources", title:"Changelog", intro:"Product UI and platform changes for Webcanbe.", items:[{title:"Public experience",body:"Marketplace browsing, account sign-in, documentation, and source-first project workflows."},{title:"Phase 3",body:"Hosted product domain, marketplace, purchases, Creator Studio, releases, and control surfaces."}] },
  "/about": { eyebrow:"Company", title:"About Webcanbe", intro:"A source-first way to start from working web projects and keep the code.", items:[{title:"Principle",body:"Do not hide the code. Edit the code visually."},{title:"Ownership",body:"The source remains the product, not a proprietary canvas."}] },
  "/contact": { eyebrow:"Company", title:"Contact", intro:"Questions about Webcanbe, creator publishing, or the product.", items:[{title:"Email",body:"hello@webcanbe.com"},{title:"Repository",body:"github.com/Webcanbe/webcanbe-real"}] },
  "/updates": { eyebrow:"Resources", title:"Updates", intro:"Product changes and release notes.", items:[{title:"Current",body:"Launch closure is in progress: production reads are live, authentication is under final provider smoke, and materialization is staged behind an explicit production gate."}] },
  "/licenses": { eyebrow:"Legal", title:"Licenses", intro:"Open-source and third-party notices used by Webcanbe.", items:[{title:"Project dependencies",body:"Third-party packages retain their own licenses and notices."}] },
  "/terms": { eyebrow:"Legal", title:"Terms of Service", intro:"Effective September 18, 2026. These Terms govern access to and use of Webcanbe.", items:[
    {title:"1. The service",body:"Webcanbe is a source-first web project marketplace and browser workspace. The service may include project browsing, source-backed editing, export, creator tools, deployment integrations, AI-assisted changes, and purchase features as they become available. Pre-release features may change, be limited, or be unavailable."},
    {title:"2. Accounts",body:"You are responsible for activity under your account and for keeping access to your sign-in provider secure. You must provide accurate information when the service asks for it and use Webcanbe only where you are legally permitted to do so."},
    {title:"3. Your projects and content",body:"You retain ownership of source code, files, text, images, and other content you submit to Webcanbe. You grant Webcanbe a limited right to host, process, reproduce, and transmit that content only as needed to operate, secure, troubleshoot, and provide the service you request."},
    {title:"4. Marketplace and creator content",body:"Creators must have the rights needed to publish and license projects they submit. A published project release may be offered under the license and purchase terms shown with that release. Webcanbe does not silently replace the immutable release associated with a completed purchase."},
    {title:"5. Payments",body:"A charge occurs only when a checkout flow explicitly confirms a transaction through the enabled payment provider. Payment, refund, tax, and payout features may be unavailable during pre-release. Additional provider terms may apply when those features are enabled."},
    {title:"6. Acceptable use",body:"Do not use Webcanbe to violate law, infringe intellectual property, distribute malware, attack or probe systems without authorization, bypass access controls, interfere with the service, or upload content you do not have the right to use."},
    {title:"7. Availability and changes",body:"We may change, suspend, or discontinue features as the product develops. We may also restrict access when needed for security, abuse prevention, legal compliance, or maintenance."},
    {title:"8. Disclaimers and liability",body:"To the extent permitted by applicable law, Webcanbe is provided without a guarantee that every feature will be uninterrupted or error-free. Nothing in these Terms excludes rights or liabilities that cannot legally be excluded."},
    {title:"9. Contact",body:"Questions about these Terms can be sent to hello@webcanbe.com."}
  ] },
  "/policy": { eyebrow:"Legal", title:"Privacy Policy", intro:"Effective September 19, 2026. This policy explains how Webcanbe handles information when you use the service.", items:[
    {title:"1. Account sign-in",body:"Webcanbe currently supports Google sign-in and Firebase Authentication for GitHub and Email/Password sign-in. Google sign-in requests only the standard OpenID Connect scopes openid, email, and profile and does not request access to Gmail, Google Drive, Google Calendar, or other Google product data. GitHub identity is handled through the GitHub provider configured in Firebase Authentication."},
    {title:"2. Passwords, identity tokens, and Webcanbe sessions",body:"Email/Password credentials are handled by Firebase Authentication; Webcanbe does not send your plaintext password to its Cloudflare Worker. Firebase ID tokens are sent to the Webcanbe backend over HTTPS for verification and exchange into a first-party Webcanbe session. Google ID tokens are verified server-side. Webcanbe's Google sign-in flow does not persist Google access tokens or refresh tokens. First-party hosted sessions use Secure HttpOnly cookies rather than exposing the session token to application JavaScript."},
    {title:"3. Account profile information",body:"Verified identity providers may supply account identifiers and profile information such as email address, verification state, name, and profile picture. Webcanbe may store an internal account profile so your settings and workspace can persist across sessions. Provider email addresses are not treated by themselves as authority to silently merge otherwise separate provider identities."},
    {title:"4. Projects and product records",body:"Depending on the features you use, Webcanbe may process workspace and project source files, revision history, exported or imported project metadata, marketplace listings and releases, purchase or entitlement records when enabled, creator submissions and review state, and settings you choose to save."},
    {title:"5. How information is used",body:"We use information to authenticate users, operate workspaces and product features, preserve project and account state, enforce access controls, secure the service, prevent abuse, diagnose failures, provide support, and comply with legal obligations."},
    {title:"6. Infrastructure and service providers",body:"Webcanbe uses service providers to operate the service. Current infrastructure includes Cloudflare for web delivery and Worker execution, Firebase Authentication for GitHub and Email/Password authentication, and Supabase-hosted PostgreSQL for server-side Webcanbe data. Other providers, such as payment or deployment services, may process information only when the corresponding feature is enabled and used."},
    {title:"7. Sharing and advertising",body:"Webcanbe does not sell personal information or use sign-in data for third-party advertising. Information may be shared with infrastructure, authentication, payment, deployment, or other service providers only as needed to provide the feature you request, or when disclosure is required by law or necessary to protect users and the service."},
    {title:"8. Storage and security",body:"Hosted account and product operations use server-side authorization boundaries, secure transport, same-origin and CSRF checks where applicable, and first-party session controls. Production Webcanbe PostgreSQL tables are intended for server-side access; browser-facing Supabase roles are not granted direct Webcanbe table access."},
    {title:"9. Retention and deletion",body:"We retain information for as long as reasonably needed to provide the service, preserve legitimate project or transaction records, maintain security, and meet legal obligations. You may request deletion of your Webcanbe account or associated personal information by contacting hello@webcanbe.com. Some records may be retained when legally required or necessary to resolve security, fraud, payment, or ownership disputes."},
    {title:"10. Your choices",body:"You can sign out of Webcanbe and manage or revoke provider access through the relevant Google, GitHub, or Firebase-supported account controls. Revoking a provider authorization does not automatically delete information already stored by Webcanbe; use the deletion request process for that."},
    {title:"11. Changes and contact",body:"We may update this policy as Webcanbe adds or changes features. The effective date will be updated when the policy changes materially. Privacy questions and deletion requests can be sent to hello@webcanbe.com."}
  ] },
}

function InfoPage({ path }: { path: string }) {
  const canonicalPath = path === "/privacy" ? "/policy" : path
  const page = infoPages[canonicalPath] ?? infoPages["/about"]
  return <PublicShell><main className="info-page"><span className="signal">{page.eyebrow}</span><h1>{page.title}</h1><p className="info-lead">{page.intro}</p><section className="info-grid">{page.items.map(item => <article key={item.title}><h2>{item.title}</h2><p>{item.body}</p></article>)}</section></main></PublicShell>
}

const contactTopics: Record<string,{title:string;category:import("./hostedProductClient").RequestCategory}> = {
  support:{title:"General Support",category:"general_support"}, account:{title:"Account Help",category:"account_help"},
  sellers:{title:"Seller Support",category:"seller_support"}, billing:{title:"Billing",category:"billing"},
  issues:{title:"Report an Issue",category:"bug_report"}, sales:{title:"Talk to Sales",category:"sales"},
  partnerships:{title:"Partnerships",category:"partnership"}, security:{title:"Security Report",category:"security_report"},
  privacy:{title:"Privacy Request",category:"privacy_request"}, refunds:{title:"Refund Request",category:"refund_request"},
  payments:{title:"Payment Dispute",category:"payment_dispute"}, payouts:{title:"Payout Issue",category:"payout_issue"},
}
function RequestIntake({topic}:{topic:(typeof contactTopics)[string]}) {
  const [email,setEmail]=useState(""),[subject,setSubject]=useState(""),[description,setDescription]=useState(""),[includeContext,setIncludeContext]=useState(false),[busy,setBusy]=useState(false),[result,setResult]=useState(""),[error,setError]=useState("")
  const submit=async(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();if(busy)return;setBusy(true);setError("");setResult("")
    const safeContext=includeContext?{currentUrl:window.location.origin+window.location.pathname,appVersion:String(import.meta.env.VITE_APP_VERSION||"web").slice(0,100)}:{}
    try{
      const signedIn=productionAuthMode()&&await productionSignedIn()
      const input={category:topic.category,subject,description,safeContext,...(!signedIn&&email.trim()?{requesterEmail:email.trim()}:{})}
      const created=signedIn?await hostedProductClient.createRequest(input):await hostedProductClient.createPublicRequest(input)
      setResult(created.requestNumber);setSubject("");setDescription("")
    }catch(reason){setError(reason instanceof Error?reason.message:"Request could not be created.")}
    finally{setBusy(false)}
  }
  return <form className="support-form" onSubmit={submit}>
    <label>Email for replies<input type="email" autoComplete="email" maxLength={320} value={email} onChange={event=>setEmail(event.target.value)}/></label>
    <label>Subject<input required minLength={3} maxLength={160} value={subject} onChange={event=>setSubject(event.target.value)}/></label>
    <label>Description<textarea required minLength={10} maxLength={5000} rows={8} value={description} onChange={event=>setDescription(event.target.value)}/></label>
    <label className="support-context"><input type="checkbox" checked={includeContext} onChange={event=>setIncludeContext(event.target.checked)}/><span><b>Include safe technical context</b><small>Adds only this page path and the app version. It never includes browser details, your source, or the message you wrote.</small></span></label>
    <p>Do not include passwords, tokens, cookies, payment credentials, private source, or Bigperson factors. Attachments are not supported yet.</p>
    <button className="wcb-public-button" type="submit" disabled={busy}>{busy?"Creating request…":"Create request"}</button>
    {result?<p role="status"><strong>Request created: {result}</strong><br/>Save this reference. Email delivery is not configured or claimed.</p>:null}
    {error?<p role="alert">{error}</p>:null}
  </form>
}
function PublicInfo({path}:{path:string}) {
  const legalAliases:Record<string,string>={"/legal/terms":"/terms","/legal/privacy":"/policy","/legal/licenses":"/licenses"}
  if(legalAliases[path])return <InfoPage path={legalAliases[path]}/>
  const topic=contactTopics[path.split("/")[2]]
  if(path.startsWith("/contact/")&&topic)return <PublicShell><main className="info-page"><span className="signal">Contact</span><h1>{topic.title}</h1><p className="info-lead">Create a persisted Webcanbe request. Signed-in requests use the authenticated account identity; public intake is limited by category and abuse controls.</p><RequestIntake topic={topic}/><p><Link to="/requests">View My Requests</Link></p><a href="/docs">Explore the documentation</a></main></PublicShell>
  if(path==="/legal")return <PublicShell><main className="info-page"><span className="signal">Legal</span><h1>Clear terms. Real ownership.</h1><p className="info-lead">Read how Webcanbe handles your account, projects, and information.</p><div className="legal-links">{[["Terms of Service","terms"],["Privacy Policy","privacy"],["Licenses","licenses"],["Acceptable use","acceptable-use"],["Privacy requests","privacy-requests"]].map(([name,slug])=><a key={slug} href={"/legal/"+slug}>{name}<ChevronRight/></a>)}</div></main></PublicShell>
  if(path==="/legal/acceptable-use"||path==="/legal/privacy-requests")return <PublicShell><main className="info-page"><span className="signal">Legal</span><h1>{path.endsWith("acceptable-use")?"Acceptable use":"Privacy requests"}</h1><p className="info-lead">{path.endsWith("acceptable-use")?infoPages["/terms"].items[5].body:infoPages["/policy"].items[8].body}</p><a href={path.endsWith("acceptable-use")?"/legal/terms":"/legal/privacy"}>Read the full policy</a><p><a href={path.endsWith("acceptable-use")?"/contact/support":"/contact/privacy"}>Create a request</a></p></main></PublicShell>
  return <NotFound path={path}/>
}

function AuthComplete() {
  const [message, setMessage] = useState("Finishing sign-in…")
  useEffect(() => {
    let current = true
    void hostedProductClient.authenticated().then(async ok => {
      if (!current) return
      if (!ok) { setMessage("Your sign-in session could not be verified."); window.setTimeout(() => go("/login"), 300); return }
      let next = "/dashboard"
      try {
        const stored = sessionStorage.getItem("wcb-auth-next")
        sessionStorage.removeItem("wcb-auth-next")
        if (stored && stored.startsWith("/") && !stored.startsWith("//")) next = stored
      } catch { /* Session storage is convenience-only; safe dashboard fallback remains. */ }
      let intent={signup:false,startedAt:0}
      try { intent=JSON.parse(sessionStorage.getItem("wcb-auth-intent")||"null")||intent;sessionStorage.removeItem("wcb-auth-intent") } catch {}
      const destination=await finishAuthIntent(intent.signup,intent.startedAt,authNext(next))
      setMessage("Signed in. Continuing…")
      go(destination)
    }).catch(() => { if (current) { setMessage("Your sign-in session could not be verified."); window.setTimeout(() => go("/login"), 300) } })
    return () => { current = false }
  }, [])
  return <main className="auth-complete" role="status"><Mark/><span className="signal">Account</span><h1>{message}</h1></main>
}

const GATE2_AUTH_SMOKE_PATH = "/_ops/gate2-auth-smoke"
const GATE2_PROVIDER_KEY = "wcb-gate2-provider"
const GATE2_BASELINE_KEY = "wcb-gate2-baseline"
const GATE2_RELOAD_KEY = "wcb-gate2-reload-pending"
const GATE2_LINKED_KEY = "wcb-gate2-linked-providers"

type Gate2Check = Readonly<{ label: string; ok: boolean; detail: string }>

function Gate2AuthSmoke() {
  const auth=productionAuthMode(), live=productReadMode()
  const [signedIn,setSignedIn]=useState(false), [busy,setBusy]=useState(false), [message,setMessage]=useState("")
  const [checks,setChecks]=useState<Gate2Check[]>([]), [email,setEmail]=useState(""), [password,setPassword]=useState(""), [linkedProviders,setLinkedProviders]=useState<string[]>(()=>{try{const value=JSON.parse(sessionStorage.getItem(GATE2_LINKED_KEY)||"[]");return Array.isArray(value)?value.filter(item=>item==="GitHub"||item==="Email"):[]}catch{return[]}})
  const [provider,setProvider]=useState(()=>{try{return sessionStorage.getItem(GATE2_PROVIDER_KEY)||"existing session"}catch{return"existing session"}})

  const rememberProvider=(value:string)=>{setProvider(value);try{sessionStorage.setItem(GATE2_PROVIDER_KEY,value)}catch{}}

  const markLinked=(label:"GitHub"|"Email")=>setLinkedProviders(current=>{const next=current.includes(label)?current:[...current,label];try{sessionStorage.setItem(GATE2_LINKED_KEY,JSON.stringify(next))}catch{}return next})

  const linkGithub=async()=>{
    if(busy)return;setBusy(true);setMessage("")
    try{
      if(!await hostedProductClient.authenticated())throw new Error("Sign in with Google first before linking GitHub.")
      const providers=await currentFirebaseProviderIds()
      let idToken=providers.includes("github.com")?await currentFirebaseIdToken(true):undefined
      if(!idToken){
        await signOutFirebase().catch(()=>{})
        const credential=await signInWithGithubFirebase()
        idToken=await credential.user.getIdToken(true)
      }
      const result=await hostedProductClient.linkFirebaseIdentity(idToken)
      markLinked("GitHub")
      setMessage(result.alreadyLinked?"GitHub identity was already linked to this Webcanbe account.":"GitHub identity is now linked to this Webcanbe account.")
    }catch(error){
      setMessage(firebaseAuthErrorMessage(error))
    }finally{setBusy(false)}
  }

  const linkEmail=async(signup:boolean)=>{
    if(busy)return;setBusy(true);setMessage("")
    try{
      if(!await hostedProductClient.authenticated())throw new Error("Sign in with Google first before linking Email.")
      const credential=signup?await createEmailAccountFirebase(email,password):await signInWithEmailFirebase(email,password)
      const result=await hostedProductClient.linkFirebaseIdentity(await credential.user.getIdToken(true))
      markLinked("Email")
      setPassword("")
      setMessage(result.alreadyLinked?"Email identity was already linked to this Webcanbe account.":"Email identity is now linked to this Webcanbe account.")
    }catch(error){
      setMessage(error instanceof Error?error.message:firebaseAuthErrorMessage(error))
    }finally{setBusy(false)}
  }

  const collectReads=async(afterReload=false)=>{
    setBusy(true);setMessage("")
    try{
      if(!await hostedProductClient.authenticated())throw new Error("No first-party Webcanbe session is active.")
      const [account,workspaces,purchases,copies,catalog]=await Promise.all([
        hostedProductClient.account(),
        hostedProductClient.workspaces(),
        hostedProductClient.purchases(),
        hostedProductClient.workspaceProjects(),
        hostedProductClient.browse({limit:100}),
      ])
      const next:Gate2Check[]=[
        {label:"First-party session",ok:true,detail:"Authenticated Webcanbe session accepted."},
        {label:"Account",ok:Boolean(account.userId),detail:account.userId?"Account read succeeded.":"Account authority missing."},
        {label:"Workspace",ok:Array.isArray(workspaces)&&workspaces.length>0,detail:`${workspaces.length} editable workspace${workspaces.length===1?"":"s"}.`},
        {label:"Purchases",ok:Array.isArray(purchases),detail:`${purchases.length} entitlement${purchases.length===1?"":"s"}.`},
        {label:"Working copies",ok:Array.isArray(copies),detail:`${copies.length} working cop${copies.length===1?"y":"ies"}.`},
        {label:"Catalog",ok:Array.isArray(catalog),detail:`${catalog.length} published listing${catalog.length===1?"":"s"}.`},
      ]
      if(afterReload){
        let baseline:{userId?:string}|undefined
        try{baseline=JSON.parse(sessionStorage.getItem(GATE2_BASELINE_KEY)||"{}")}catch{}
        next.push({label:"Refresh persistence",ok:Boolean(baseline?.userId&&baseline.userId===account.userId),detail:baseline?.userId===account.userId?"Same first-party account survived a full reload.":"Reload did not preserve the same account authority."})
      }else{
        try{sessionStorage.setItem(GATE2_BASELINE_KEY,JSON.stringify({userId:account.userId,provider}))}catch{}
      }
      setChecks(next)
      setSignedIn(true)
      setMessage(next.every(item=>item.ok)?"Gate 2 read checks passed.":"One or more Gate 2 checks failed.")
    }catch(error){
      setChecks([{label:"Authenticated private reads",ok:false,detail:error instanceof Error?error.message:"Gate 2 read smoke failed."}])
      setMessage("Gate 2 read smoke failed.")
    }finally{setBusy(false)}
  }

  useEffect(()=>{let current=true;void hostedProductClient.authenticated().then(ok=>{if(current)setSignedIn(ok)}).catch(()=>{if(current)setSignedIn(false)});return()=>{current=false}},[])

  useEffect(()=>{
    if(!signedIn)return
    let pending=false
    try{pending=sessionStorage.getItem(GATE2_RELOAD_KEY)==="1";if(pending)sessionStorage.removeItem(GATE2_RELOAD_KEY)}catch{}
    if(pending)void collectReads(true)
  },[signedIn])

  const google=async()=>{
    if(busy)return;setBusy(true);setMessage("")
    try{
      rememberProvider("Google")
      try{sessionStorage.setItem("wcb-auth-next",GATE2_AUTH_SMOKE_PATH)}catch{}
      window.location.assign(await hostedProductClient.authStart())
    }catch(error){setMessage(error instanceof Error?error.message:"Google sign-in could not start.");setBusy(false)}
  }

  const github=async()=>{
    if(busy)return;setBusy(true);setMessage("")
    try{
      rememberProvider("GitHub via Firebase (linked)")
      const credential=await signInWithGithubFirebase()
      await hostedProductClient.firebaseExchange(await credential.user.getIdToken(true))
      setSignedIn(true);setMessage("Linked GitHub identity exchanged into the existing first-party Webcanbe account.")
    }catch(error){await signOutFirebase().catch(()=>{});setMessage(firebaseAuthErrorMessage(error))}
    finally{setBusy(false)}
  }

  const emailAuth=async(signup:boolean)=>{
    if(busy)return;setBusy(true);setMessage("")
    try{
      rememberProvider(signup?"Email signup via Firebase (linked)":"Email login via Firebase (linked)")
      const credential=signup?await createEmailAccountFirebase(email,password):await signInWithEmailFirebase(email,password)
      await hostedProductClient.firebaseExchange(await credential.user.getIdToken(true))
      setSignedIn(true);setPassword("");setMessage(signup?"Linked Email signup exchanged into the existing first-party Webcanbe account.":"Linked Email login exchanged into the existing first-party Webcanbe account.")
    }catch(error){setMessage(firebaseAuthErrorMessage(error))}
    finally{setBusy(false)}
  }

  const reloadCheck=()=>{
    try{sessionStorage.setItem(GATE2_RELOAD_KEY,"1")}catch{}
    window.location.reload()
  }

  const logoutCheck=async()=>{
    if(busy)return;setBusy(true);setMessage("")
    try{
      await productionSignOut()
      const remains=await hostedProductClient.authenticated().catch(()=>false)
      setChecks(current=>[...current,{label:"Logout invalidation",ok:!remains,detail:remains?"First-party session still answered after logout.":"First-party session is no longer accepted after logout."}])
      setSignedIn(remains)
      setMessage(remains?"Logout verification failed.":"Logout verification passed.")
    }finally{setBusy(false)}
  }

  return <PublicShell><main className="standard product-hub"><header className="hub-title"><div><span className="signal">Launch diagnostics</span><h1>Gate 2 authenticated read smoke</h1><p>Temporary noindex launch diagnostic. It exercises only your own first-party session and read APIs; product mutations remain closed.</p></div><Link className="button" to="/dashboard">Back to dashboard</Link></header>
    {!auth||!live?<section className="hub-section"><HubState kind="error" title="Production read boundary is not ready" body="This diagnostic requires production authentication and read-only product mode."/></section>:
    <section className="hub-section"><div className="hub-section-head"><div><h2>Session</h2><p>Current path: {provider}. No password or token is stored by this diagnostic.</p></div><span>{signedIn?"Signed in":"Signed out"}</span></div>
      {signedIn?<><div className="settings-action-row"><div><b>1. Verify current account reads</b><p>Start from the existing Google-backed Webcanbe session and establish the account baseline.</p></div><div><button className="button primary" disabled={busy} onClick={()=>void collectReads(false)}>Run private reads</button><button className="button" disabled={busy||!checks.some(item=>item.label==="Account"&&item.ok)} onClick={reloadCheck}>Verify refresh</button></div></div>
      <div className="settings-action-row"><div><b>2. Link GitHub to this account</b><p>Firebase GitHub proves the provider identity, then Webcanbe links it to the currently authenticated internal account. It does not replace the current first-party session.</p></div><button className="button" disabled={busy} onClick={()=>void linkGithub()}>{linkedProviders.includes("GitHub")?"GitHub linked":"Link GitHub"}</button></div>
      <label>Email for provider-link test<input value={email} onChange={event=>setEmail(event.target.value)} autoComplete="email"/></label><label>Password<input type="password" value={password} onChange={event=>setPassword(event.target.value)} autoComplete="current-password"/></label>
      <div className="settings-action-row"><div><b>3. Link Email identity to this account</b><p>Use an unused Firebase email for Link new Email, or existing Firebase credentials for Link existing Email. Linking is conflict-checked server-side.</p></div><div><button className="button" disabled={busy||!email||!password} onClick={()=>void linkEmail(true)}>{linkedProviders.includes("Email")?"Email linked":"Link new Email"}</button><button className="button" disabled={busy||!email||!password} onClick={()=>void linkEmail(false)}>Link existing Email</button></div></div>
      <div className="settings-action-row"><div><b>4. End the Google session</b><p>After the identities are linked, verify logout. Then use the signed-out provider buttons below to prove GitHub/Email returns to the same internal account.</p></div><button className="button" disabled={busy} onClick={()=>void logoutCheck()}>Verify logout</button></div></>:
      <div className="form-rows"><p className="settings-note">Provider login tests should be run only after that Firebase identity was linked from the Google-backed session above. This prevents accidental creation of a second Webcanbe internal account.</p><div className="settings-action-row"><div><b>Google baseline</b><p>Use this first when starting a fresh Gate 2 run.</p></div><button className="button" disabled={busy} onClick={()=>void google()}>Test Google</button></div><div className="settings-action-row"><div><b>GitHub — linked identity only</b><p>Use after Link GitHub succeeded during the Google-backed session.</p></div><button className="button" disabled={busy||!linkedProviders.includes("GitHub")} onClick={()=>void github()}>Test linked GitHub</button></div><label>Email<input value={email} onChange={event=>setEmail(event.target.value)} autoComplete="email"/></label><label>Password<input type="password" value={password} onChange={event=>setPassword(event.target.value)} autoComplete="current-password"/></label><div className="settings-action-row"><div><b>Email/password — linked identity only</b><p>Use after the same Firebase email identity was linked to the Google-backed Webcanbe account.</p></div><div><button className="button" disabled={busy||!email||!password||!linkedProviders.includes("Email")} onClick={()=>void emailAuth(false)}>Test linked Email login</button></div></div></div>}
      {message&&<p className="settings-save-status" role="status">{message}</p>}
    </section>}
    {checks.length>0&&<section className="hub-section"><div className="hub-section-head"><div><h2>Results</h2><p>Counts are shown; internal account identifiers are not rendered.</p></div></div><div className="hub-list">{checks.map(item=><article className="hub-row" key={item.label}><div className="hub-row-copy"><span>{item.ok?"PASS":"FAIL"}</span><h3>{item.label}</h3><p>{item.detail}</p></div></article>)}</div></section>}
  </main></PublicShell>
}

function Checkout() {
  const params = new URLSearchParams(window.location.search), reference = params.get("project") ?? "", hosted = productReadMode()
  const returned = paymentReturn(window.location.search, "payment")
  const fallback = projects.find(item => item.slug === reference)
  const [project, setProject] = useState<Project | undefined>(hosted ? undefined : fallback)
  const [configuration, setConfiguration] = useState<PublicPaymentConfiguration>()
  const [state, setState] = useState<"loading_order" | "ready" | "starting_checkout" | "redirecting" | "returning" | "capturing" | "success" | "cancelled" | "failed" | "reconciliation_required">(returned.kind === "cancelled" ? "cancelled" : returned.kind === "return" ? "returning" : "loading_order")
  const [message, setMessage] = useState("")
  const captureStarted = useRef(false)
  const checkoutStarted = useRef(false)
  useEffect(() => {
    if (returned.kind !== "return") return
    if (captureStarted.current) return
    captureStarted.current = true
    if (!returned.providerOrderId) { setState("failed"); setMessage("PayPal did not return an order token. Open Purchases to check whether the verified webhook completed the order."); return }
    setState("capturing")
    void hostedProductClient.capturePaymentOrder(returned.providerOrderId).then(order => {
      if (order.status === "completed") { setState("success"); clearPaymentIdempotencyKey("marketplace", order.listingId) }
      else if (order.status === "reconciliation_required") { setState("reconciliation_required"); setMessage("The captured payment needs reconciliation before an entitlement can be issued.") }
      else { setState("failed"); setMessage(`The order returned with status ${order.status}.`) }
    }, reason => { setState("failed"); setMessage(reason instanceof Error ? reason.message : "The payment could not be captured.") })
  }, [returned.kind, returned.providerOrderId])
  useEffect(() => {
    if (returned.kind !== "none") return
    let current = true
    const detail = hosted ? hostedProductClient.detail(reference) : Promise.resolve(fallback)
    void Promise.all([detail, loadPublicPaymentConfiguration()]).then(([listing, config]) => {
      if (!current) return
      const resolved = hosted && listing ? hostedProject(listing as HostedListingDetail) : listing as Project | undefined
      setProject(resolved); setConfiguration(config)
      if (!resolved || (hosted && (!resolved.releaseId || resolved.currency !== "USD"))) { setState("failed"); setMessage("This listing is missing or unavailable for checkout.") }
      else setState("ready")
    }, reason => { if (current) { setState("failed"); setMessage(reason instanceof Error ? reason.message : "Order details are unavailable.") } })
    return () => { current = false }
  }, [hosted, reference, returned.kind])
  const start = async () => {
    if (!project || checkoutStarted.current || !["ready","failed"].includes(state)) return
    if ((project.priceMinor ?? Math.round(project.price * 100)) > 0 && !configuration?.checkoutAvailable) { setState("failed"); setMessage("Paid checkout is not available right now."); return }
    checkoutStarted.current = true
    setState("starting_checkout"); setMessage("")
    try {
      const order = await hostedProductClient.createPaymentOrder(project.id, paymentIdempotencyKey("marketplace", project.id))
      if (order.status === "completed") { clearPaymentIdempotencyKey("marketplace", project.id); setState("success"); return }
      if (!order.approvalUrl) throw new Error("PayPal approval is unavailable for this order.")
      setState("redirecting"); window.location.assign(order.approvalUrl)
    } catch (reason) { checkoutStarted.current = false; setState("failed"); setMessage(reason instanceof Error ? reason.message : "Checkout could not be started.") }
  }
  const priceMinor = project?.priceMinor ?? (project ? Math.round(project.price * 100) : undefined)
  const total = priceMinor === undefined ? "—" : priceMinor === 0 ? "Free" : `$${(priceMinor / 100).toFixed(2)}`
  const titles = { loading_order:"Loading order…", ready:"Complete your purchase.", starting_checkout:"Starting checkout…", redirecting:"Redirecting to PayPal…", returning:"Returning from PayPal…", capturing:"Capturing your payment…", success:"Purchase complete.", cancelled:"Checkout cancelled.", failed:"Checkout needs attention.", reconciliation_required:"Reconciliation required." } as const
  const busy = ["loading_order","starting_checkout","redirecting","returning","capturing"].includes(state)
  return <main className="checkout-page"><header className="checkout-header"><Link to="/" className="brand"><Mark/></Link><Link to={project ? `/project/${project.slug}` : "/browse"}>Back to marketplace</Link></header><section className="checkout-layout"><div className="checkout-main"><span className="signal">Checkout</span><h1>{titles[state]}</h1><p>{message || (state === "success" ? "Your server-confirmed entitlement is now available in Purchases." : state === "cancelled" ? "PayPal approval was cancelled. Check Purchases for the server-confirmed payment status." : "Webcanbe verifies the listing, release, price, seller, fees, and entitlement on the server.")}</p><div className="checkout-provider-placeholder"><strong>{priceMinor === 0 ? "Free listing" : "PayPal checkout"}</strong><p>{priceMinor === 0 ? "No provider approval is required. Webcanbe will create the order and entitlement together." : "You will approve the server-created order in PayPal, then return here for idempotent capture."}</p><p className="checkout-legal">Continuing confirms the <a href="/legal/terms">Terms</a>, <a href="/legal/refunds">Refund Policy</a>, and release-specific <a href="/legal/buyer-license">Buyer License</a>.</p>{state === "success" ? <Link className="button primary" to="/purchases">View Purchases <Arrow/></Link> : state === "cancelled" ? <Link className="button" to="/browse">Return to marketplace</Link> : state === "reconciliation_required" ? <Link className="button" to="/purchases">Check Purchases</Link> : <button className="button primary" disabled={busy || !project || (Boolean(priceMinor) && !configuration?.checkoutAvailable)} onClick={()=>void start()}>{busy ? titles[state] : state === "failed" ? "Retry checkout" : priceMinor === 0 ? "Get this project" : `Pay ${total} with PayPal`}</button>}</div></div><aside className="checkout-summary"><span>Order summary</span><h2>{project?.title ?? "Selected project"}</h2><p>{project?.tagline ?? "The selected immutable release will be bound to the completed purchase."}</p><dl><div><dt>Project</dt><dd>{total}</dd></div><div><dt>Total</dt><dd>{total}</dd></div></dl><small>Completed order → entitlement → Purchases → working copy. Refreshing this return page cannot create a second entitlement.</small></aside></section></main>
}

function useProductLibrary() {
  const hosted = productReadMode()
  const [copies, setCopies] = useState<WorkspaceProject[]>([])
  const [entitlements, setEntitlements] = useState<LicenseEntitlement[]>([])
  const [catalog, setCatalog] = useState<Project[]>(hosted ? [] : projects)
  const [loading, setLoading] = useState(hosted)
  const [error, setError] = useState("")
  useEffect(() => {
    if (!hosted) return
    let current = true
    setLoading(true); setError("")
    void Promise.all([hostedProductClient.workspaceProjects(), hostedProductClient.purchases(), hostedProductClient.browse({ limit: 100 })]).then(([workspaceProjects, purchases, listings]) => {
      if (!current) return
      setCopies(workspaceProjects); setEntitlements(purchases); setCatalog(listings.map(hostedProject)); setLoading(false)
    }, reason => {
      if (!current) return
      setLoading(false); setError(reason instanceof Error ? reason.message : "Your product library is unavailable.")
    })
    return () => { current = false }
  }, [hosted])
  return { hosted, copies, setCopies, entitlements, catalog, loading, error }
}

function releaseProject(catalog: Project[], releaseId: string, fallbackId: string, title = "Workspace project") {
  const matched = catalog.find(project => project.releaseId === releaseId)
  return matched ?? { id: fallbackId, slug: fallbackId, title, tagline: "Release metadata is not available for this account yet.", price: 0, stack: ["Source-backed"], category: "Project", color: "ink", creator: "Webcanbe creator", updated: "Release metadata unavailable", releaseId }
}

function HubTabs({ active }: { active: "projects" | "purchases" }) {
  return <nav className="hub-tabs" aria-label="Project library"><Link className={active === "projects" ? "active" : ""} to="/projects">My projects</Link><Link className={active === "purchases" ? "active" : ""} to="/purchases">Purchases</Link></nav>
}

function HubState({ kind, title, body, action }: { kind: "loading" | "empty" | "error"; title: string; body: string; action?: React.ReactNode }) {
  if (kind === "loading") return <div className="hub-loading" aria-label={title}>{[0,1,2].map(item => <div className="hub-skeleton" key={item}><i/><span/><b/></div>)}</div>
  return <div className={`hub-state ${kind}`} role={kind === "error" ? "alert" : undefined}><span>{kind === "error" ? "Something needs attention" : "Nothing here yet"}</span><h2>{title}</h2><p>{body}</p>{action}</div>
}

function WorkingCopyRow({ project, href, note }: { project: Project; href: string; note: string }) {
  return <article className="hub-row"><Preview project={project}/><div className="hub-row-copy"><span>Working copy</span><h3>{project.title}</h3><p>{note}</p></div><div className="hub-row-meta"><small>{project.stack.slice(0,2).join(" · ")}</small><Link className="button compact" to={href}>Open workspace <Arrow/></Link></div></article>
}

function Projects() {
  const library = useProductLibrary()
  const localProjects = projects.slice(0, 3)
  const hostedProjects = library.copies.map(copy => ({ copy, project: releaseProject(library.catalog, copy.releaseId, copy.workspaceProjectId) }))
  const count = library.hosted ? hostedProjects.length : localProjects.length
  return <AppShell active="/projects"><main className="standard product-hub"><header className="hub-title"><div><span className="signal">Your work</span><h1>My projects</h1><p>Editable working copies live here. Purchases stay separate until you create a copy.</p></div><Link className="button primary" to="/browse">Browse marketplace <Arrow/></Link></header><HubTabs active="projects"/><section className="hub-section"><div className="hub-section-head"><div><h2>Working copies</h2><p>Projects you can edit visually or in code.</p></div><span>{count} {count === 1 ? "project" : "projects"}</span></div>{library.loading ? <HubState kind="loading" title="Loading your projects" body=""/> : library.error ? <HubState kind="error" title="Projects could not be loaded" body={library.error} action={<button className="button" onClick={() => window.location.reload()}>Try again</button>}/> : library.hosted ? hostedProjects.length ? <div className="hub-list">{hostedProjects.map(({copy, project}) => <WorkingCopyRow key={copy.workspaceProjectId} project={project} href={`/workspace/${copy.workspaceProjectId}`} note={`Created ${new Date(copy.createdAt).toLocaleDateString()}. Source lineage remains attached to this copy.`}/>)}</div> : <HubState kind="empty" title="No working copies yet" body="A purchase can exist without a working copy. Open Purchases when you are ready to start editing." action={<><Link className="button primary" to="/purchases">View purchases <Arrow/></Link><Link className="button" to="/browse">Browse projects</Link></>}/> : <div className="hub-list">{localProjects.map((project, index) => <WorkingCopyRow key={project.id} project={project} href={`/workspace/${project.id}`} note={index === 0 ? "Continue editing the same source-backed project." : "Ready to open in the source-first workspace."}/>)}</div>}</section></main></AppShell>
}

function Purchases() {
  const library = useProductLibrary()
  const mutationsEnabled = productMutationMode()
  const [working, setWorking] = useState("")
  const [actionError, setActionError] = useState("")
  const localPurchases = projects.slice(3)
  const copiesByEntitlement = new Map(library.copies.map(copy => [copy.entitlementId, copy]))
  const openPurchase = async (entitlement: LicenseEntitlement, project: Project) => {
    const existing = copiesByEntitlement.get(entitlement.entitlementId)
    if (existing) { go(`/workspace/${existing.workspaceProjectId}`); return }
    if (!mutationsEnabled) { setActionError("Creating a new working copy is not enabled in production yet."); return }
    if (entitlement.status !== "active" || working) return
    setWorking(entitlement.entitlementId); setActionError("")
    try {
      const availableWorkspaces = await hostedProductClient.workspaces()
      const preferredWorkspace = readLocal<string>("wcb-selected-workspace", "")
      const workspaceId = availableWorkspaces.includes(preferredWorkspace) ? preferredWorkspace : availableWorkspaces[0]
      if (!workspaceId) throw new Error("Create or join an editable workspace before making a working copy.")
      const copy = await hostedProductClient.materialize(workspaceId, entitlement.entitlementId, project.title)
      library.setCopies(current => [...current, copy]); go(`/workspace/${copy.workspaceProjectId}`)
    } catch (reason) { setActionError(reason instanceof Error ? reason.message : "A working copy could not be created.") }
    finally { setWorking("") }
  }
  const activeCount = library.hosted ? library.entitlements.filter(item => item.status === "active").length : localPurchases.length
  return <AppShell active="/purchases"><main className="standard product-hub"><header className="hub-title"><div><span className="signal">Your library</span><h1>Purchases</h1><p>Entitlements stay intact here even before you create an editable working copy.</p></div><Link className="button" to="/browse">Browse marketplace <Arrow/></Link></header><HubTabs active="purchases"/>{actionError && <div className="inline-error" role="alert">{actionError}</div>}<section className="hub-section"><div className="hub-section-head"><div><h2>Purchased releases</h2><p>Each purchase remains bound to its release.</p></div><span>{activeCount} active</span></div>{library.loading ? <HubState kind="loading" title="Loading purchases" body=""/> : library.error ? <HubState kind="error" title="Purchases could not be loaded" body={library.error} action={<button className="button" onClick={() => window.location.reload()}>Try again</button>}/> : library.hosted ? library.entitlements.length ? <div className="purchase-list">{library.entitlements.map(entitlement => { const project = releaseProject(library.catalog, entitlement.releaseId, entitlement.entitlementId, "Purchased project"), copy = copiesByEntitlement.get(entitlement.entitlementId), busy = working === entitlement.entitlementId, createDisabled = !copy && !mutationsEnabled; return <article className="purchase-row" key={entitlement.entitlementId}><Preview project={project}/><div className="purchase-copy"><span className={`entitlement-status ${entitlement.status}`}>{entitlement.status}</span><h3>{project.title}</h3><p>Release entitlement granted {new Date(entitlement.grantedAt).toLocaleDateString()}.</p><small>{project.stack.join(" · ")}</small></div><div className="purchase-action"><strong>{project.price ? `$${project.price}` : "—"}</strong><button className={copy ? "button" : "button primary"} disabled={busy || entitlement.status !== "active" || createDisabled} title={createDisabled ? "New working-copy creation stays disabled until the production materialization endpoint is activated." : undefined} onClick={() => void openPurchase(entitlement, project)}>{copy ? "Open working copy" : createDisabled ? "Creation not enabled" : busy ? "Creating copy…" : "Create working copy"} <Arrow/></button></div></article> })}</div> : <HubState kind="empty" title="No purchases yet" body="Browse the marketplace when you want a working project to start from." action={<Link className="button primary" to="/browse">Browse projects <Arrow/></Link>}/> : <div className="purchase-list">{localPurchases.map(project => <article className="purchase-row" key={project.id}><Preview project={project}/><div className="purchase-copy"><span className="entitlement-status active">active</span><h3>{project.title}</h3><p>This preview keeps the purchased release separate from editable working copies.</p><small>{project.stack.join(" · ")}</small></div><div className="purchase-action"><strong>$${project.price}</strong><Link className="button primary" to={`/workspace/${project.id}`}>Create working copy <Arrow/></Link></div></article>)}</div>}</section></main></AppShell>
}

function RopeanDashboardShell({ children, view }: { children: React.ReactNode; purchaseBadge?: number; view: DashboardView; onView?: (view: DashboardView) => void }) {
  const signOut = async () => {
    if (productionAuthMode()) await productionSignOut()
    else { try { sessionStorage.removeItem("wcb-demo-auth") } catch {} }
    try { sessionStorage.removeItem("wcb-onboarding-user") } catch {}
    window.dispatchEvent(new Event("wcb:auth-changed")); go("/")
  }
  return <ProductShell view={view} navigate={go} signOut={signOut}>{children}</ProductShell>
}

function PageHeading({title,description}:{title:string;description:string}) { return <header className="wcb-page-heading"><h1>{title}</h1><p>{description}</p></header> }
function WorkspacePage() {
  const workspaces=useWorkspaces(), [create,setCreate]=useState(false)
  return <><PageHeading title="Workspace" description="Choose where your next working copy belongs."/><section className="rd-panel"><header className="wcb-panel-heading"><div><h2>Your workspaces</h2><p>Each workspace keeps its own working copies.</p></div><button className="rd-primary-action" onClick={()=>setCreate(true)}><Plus/>Add workspace</button></header><div className="wcb-padded">{workspaces.loading?<p role="status">Loading workspaces…</p>:workspaces.error?<div role="alert"><p>{workspaces.error}</p><button className="button" onClick={()=>window.dispatchEvent(new Event('wcb:workspaces-updated'))}>Try again</button></div>:workspaces.ids.length?workspaces.ids.map((id,index)=><article className="wcb-workspace-row" key={id}><PanelsTopLeft/><div><h3>{workspaceLabel(id,index)}</h3><p>{id===workspaces.selected?"Selected for new working copies":"Available to your account"}</p></div><button className="button" disabled={id===workspaces.selected} onClick={()=>workspaces.select(id)}>{id===workspaces.selected?"Selected":"Use workspace"}</button></article>):<div className="rd-empty"><PanelsTopLeft/><b>Create your first workspace</b><p>A space for projects you can edit and export.</p></div>}</div></section><section className="wcb-quick-actions"><Link to="/projects"><FolderKanban/><b>Continue a project</b><p>Open your existing working copies.</p></Link><Link to="/purchases"><ShoppingBag/><b>Start from a purchase</b><p>Create a working copy in the selected workspace.</p></Link></section>{create&&<CreateWorkspaceDialog onClose={()=>setCreate(false)} navigate={go}/>}</>
}
function AccountPage({section}:{section:"settings"|"account"}) {
  const {account,error,setAccount}=useAccount(), [name,setName]=useState(''), [busy,setBusy]=useState(false), [message,setMessage]=useState('')
  useEffect(()=>setName(account.displayName||''),[account.displayName])
  const save=async()=>{if(busy)return;setBusy(true);setMessage('');try{if(!name.trim()||name.trim().length>120)throw new Error('Use a name between 1 and 120 characters.');if(productionAuthMode())setAccount(await hostedProductClient.updateAccount(name.trim()));else{const next={...account,displayName:name.trim()};writeLocal('wcb-demo-profile',next);setAccount(next)}window.dispatchEvent(new Event('wcb:profile-updated'));setMessage('Profile saved.')}catch(reason){setMessage(reason instanceof Error?reason.message:'Could not save profile.')}finally{setBusy(false)}}
  const signOut=async()=>{setBusy(true);if(productionAuthMode())await productionSignOut();else{try{sessionStorage.removeItem('wcb-demo-auth')}catch{}}try{sessionStorage.removeItem('wcb-onboarding-user')}catch{}window.dispatchEvent(new Event('wcb:auth-changed'));go('/')}
  return <><PageHeading title={section==='settings'?'Profile':'Account'} description={section==='settings'?'Your name and profile image across WebCanBe.':'Your verified identity and active sign-in session.'}/>{error&&<p role="alert">{error}</p>}<section className="rd-panel wcb-padded wcb-account-form">{section==='settings'?<form onSubmit={event=>{event.preventDefault();void save()}}><div className="wcb-profile-summary"><Avatar account={account}/><div><h2>{account.displayName||'Your profile'}</h2><p>{account.picture?'Profile image from your sign-in provider.':'Your initials appear when a profile image is unavailable.'}</p></div></div><label>Display name<input required maxLength={120} value={name} onChange={event=>setName(event.target.value)} autoComplete="name"/></label><p>Your name appears in the workspace and account menu.</p><button className="rd-primary-action" disabled={busy||!name.trim()||Boolean(error)}>{busy?'Saving…':'Save profile'}</button>{message&&<p role="status">{message}</p>}</form>:<><h2>Sign-in details</h2><label>Email address<input readOnly value={account.email||''} placeholder={productionAuthMode()?'Loading account…':'No email in demo mode'}/></label><dl className="wcb-detail-list"><div><dt>Email verification</dt><dd>{account.emailVerified?'Verified':account.email?'Not verified':'Not available'}</dd></div><div><dt>Sign-in providers</dt><dd>{account.providers?.join(', ')||(productionAuthMode()?'Loading provider details…':'Local demo session')}</dd></div><div><dt>Active sessions</dt><dd>{account.activeSessions??(productionAuthMode()?'Loading…':1)}</dd></div></dl><div className="wcb-session-action"><div><h3>Sign out of this browser</h3><p>You can sign back in to continue your projects.</p></div><button className="button" disabled={busy} onClick={()=>void signOut()}><LogOut/>Sign out</button></div></>}</section></>
}
function ReferencePage({help=false}:{help?:boolean}) {
  const [query,setQuery]=useState('')
  const topics=[['Getting started','Choose a project, create a working copy, and start editing.','/docs/getting-started'],['Visual editor','Change supported elements while preserving real source.','/docs/visual-editor'],['Code editor','Edit files and save accepted source revisions.','/docs/code-editor'],['Compatibility','Understand supported projects and import requirements.','/docs/compatibility'],['Export','Download a standalone project you can run elsewhere.','/docs/export'],['Security','Understand account, workspace, and source boundaries.','/docs/security']]
  const shown=topics.filter(item=>item.slice(0,2).join(' ').toLowerCase().includes(query.toLowerCase()))
  return <><PageHeading title={help?'Help Center':'Documentation'} description={help?'Find help for the next step in your project.':'Practical guides for building with your own source.'}/><label className="wcb-search-label"><Search/><input aria-label="Search guides" placeholder="Search guides" value={query} onChange={event=>setQuery(event.target.value)}/></label><section className="wcb-reference-grid">{shown.map(([title,description,path])=><Link key={path} to={path}><BookOpen/><h2>{title}</h2><p>{description}</p><span>Read guide <ChevronRight/></span></Link>)}</section>{!shown.length&&<div className="rd-empty"><b>No guides found</b><button className="button" onClick={()=>setQuery('')}>Clear search</button></div>}{help&&<section className="rd-panel wcb-padded"><h2>Still need a hand?</h2><p>Create a persisted support request and track its status from your account.</p><div className="rd-page-actions"><Link className="button primary" to="/contact/support">Create request</Link><Link className="button" to="/requests">My Requests</Link></div><details className="wcb-help-details"><summary>What should I include?</summary><p>The page URL, the action you tried, and any visible error message. Never include passwords, session tokens, payment details, or private source.</p></details></section>}</>
}

function MyRequests(){
 const [items,setItems]=useState<RequestCase[]>([]),[selected,setSelected]=useState<RequestCase>(),[events,setEvents]=useState<RequestEvent[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("")
 useEffect(()=>{let current=true;void hostedProductClient.myRequests().then(value=>{if(current){setItems(value);setLoading(false)}},reason=>{if(current){setError(reason instanceof Error?reason.message:"Requests are unavailable.");setLoading(false)}});return()=>{current=false}},[])
 const open=async(item:RequestCase)=>{setSelected(item);setError("");try{const detail=await hostedProductClient.myRequest(item.requestId);setSelected(detail.request);setEvents(detail.events)}catch(reason){setError(reason instanceof Error?reason.message:"Request detail is unavailable.")}}
 return <AppShell active="/help"><main className="standard request-account"><PageHeading title="My Requests" description="Cases created by your signed-in Webcanbe account."/><div className="request-account-actions"><Link className="button primary" to="/contact/support">Create request</Link></div>{error&&<div className="inline-error" role="alert">{error}</div>}{loading?<HubState kind="loading" title="Loading your requests" body=""/>:items.length?<div className="request-account-layout"><section className="request-account-list">{items.map(item=><button key={item.requestId} className={selected?.requestId===item.requestId?"active":""} onClick={()=>void open(item)}><span><b>{item.requestNumber}</b><small>{item.category.replace(/_/g," ")}</small></span><span><strong>{item.subject}</strong><small>Updated {new Date(item.updatedAt).toLocaleString()}</small></span><em>{item.status.replace(/_/g," ")}</em></button>)}</section><aside className="request-account-detail">{selected?<><span className="signal">{selected.requestNumber}</span><h2>{selected.subject}</h2><p>{selected.description}</p><dl><div><dt>Status</dt><dd>{selected.status.replace(/_/g," ")}</dd></div><div><dt>Priority</dt><dd>{selected.priority}</dd></div><div><dt>Created</dt><dd>{new Date(selected.createdAt).toLocaleString()}</dd></div></dl><h3>Visible history</h3>{events.map(event=><article key={event.eventId}><b>{event.eventType.replace(/_/g," ")}</b><time>{new Date(event.createdAt).toLocaleString()}</time>{typeof event.data.body==="string"&&<p>{event.data.body}</p>}</article>)}</>:<p>Select a request to see its requester-visible history.</p>}</aside></div>:<HubState kind="empty" title="No requests yet" body="Create a request when you need account, billing, seller, or product help." action={<Link className="button primary" to="/contact/support">Create request</Link>}/>}</main></AppShell>
}

function useBillingOverview(enabled = true) {
  const [configuration, setConfiguration] = useState<PublicPaymentConfiguration>()
  const [billing, setBilling] = useState<PaymentBilling>()
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState("")
  const [version, setVersion] = useState(0)
  useEffect(() => {
    if (!enabled) return
    let current = true
    setLoading(true); setError("")
    void Promise.all([loadPublicPaymentConfiguration(), hostedProductClient.paymentStatus()]).then(([config, status]) => {
      if (current) { setConfiguration(config); setBilling(status); setLoading(false) }
    }, reason => { if (current) { setError(reason instanceof Error ? reason.message : "Billing is unavailable."); setLoading(false) } })
    return () => { current = false }
  }, [enabled, version])
  return { configuration, billing, setBilling, loading, error, refresh: () => setVersion(value => value + 1) }
}

const planName = (key: string | undefined) => key ? key.split("_")[0].replace(/^./, value => value.toUpperCase()) : "Free"
const cadenceName = (key: string | undefined) => key?.endsWith("_annual") ? "Annual" : key?.endsWith("_monthly") ? "Monthly" : "No renewal"

function Dashboard({ initialView = "overview" }: { initialView?: DashboardView }) {
  const lib = useProductLibrary()
  const view = initialView
  const setView = (next: DashboardView) => go(appRoutes[next][0])
  const [projectQuery, setProjectQuery] = useState("")
  const working = lib.hosted
    ? lib.copies.map(copy => ({ project: releaseProject(lib.catalog, copy.releaseId, copy.workspaceProjectId), href: "/workspace/" + copy.workspaceProjectId }))
    : projects.slice(0,3).map(project => ({ project, href: "/workspace/" + project.id }))
  const purchaseCount = lib.hosted ? lib.entitlements.length : projects.slice(3).length
  const activePurchases = lib.hosted ? lib.entitlements.filter(item => item.status === "active").length : purchaseCount
  const attention = lib.hosted ? lib.entitlements.filter(item => item.status !== "active").length : 0
  const catalog = lib.hosted ? lib.catalog : projects
  const copiesByEntitlement = new Map(lib.copies.map(copy => [copy.entitlementId, copy]))
  const purchaseRows = lib.hosted
    ? lib.entitlements.map(entitlement => {
        const copy = copiesByEntitlement.get(entitlement.entitlementId)
        return { project: releaseProject(lib.catalog, entitlement.releaseId, entitlement.entitlementId, "Purchased project"), href: copy ? "/workspace/" + copy.workspaceProjectId : "/purchases" }
      })
    : projects.slice(3).map(project => ({ project, href: "/project/" + project.slug }))

  const projectRows = (items: Array<{ project: Project; href: string }>) => <div className="rd-project-list">
    {items.length ? items.filter(({project}) => project.title.toLowerCase().includes(projectQuery.toLowerCase())).slice(0,8).map(({project,href}) => <Link to={view.startsWith("source-") ? href + "?mode=" + view.replace("source-", "").replace("visual", "canvas") : href} key={href} className="rd-project-row">
      <span className="rd-project-thumb"><FileCode2/></span>
      <span className="rd-project-copy"><b>{project.title}</b><small>{project.stack.slice(0,2).join(" · ")}</small></span>
      <span className="rd-project-meta">{project.updated}</span>
    </Link>) : <div className="rd-empty"><FolderKanban/><b>No projects yet</b><p>Choose a template to start your first project.</p><Link className="rd-primary-action" to="/marketplace">Browse marketplace</Link></div>}
  </div>

  const secondaryView = () => {
    if (view === "workspace") return <WorkspacePage/>
    if (view === "settings" || view === "account") return <AccountPage section={view}/>
    if (view === "billing") return <><PageHeading title="Billing" description="Your plan, subscription, and purchased AI Actions."/><section className="rd-panel wcb-padded"><BillingSettings/></section></>
    if (view === "docs" || view === "help") return <ReferencePage help={view === "help"}/>
    if (view === "notifications") return <><PageHeading title="Notifications" description="Purchase issues that need your attention."/><section className="rd-panel"><header><h2>{attention ? `${attention} purchases need review` : "You’re all caught up"}</h2><p>Notices reflect your current purchase status.</p></header>{attention ? <div className="wcb-padded">{lib.entitlements.filter(item=>item.status!=="active").map(item=><div className="wcb-notice" key={item.entitlementId}><Bell/><div><b>{releaseProject(lib.catalog,item.releaseId,item.entitlementId).title}</b><p>Purchase status: {item.status}. Review your entitlement before editing.</p></div><Link to="/purchases">Review purchase</Link></div>)}</div> : <div className="rd-empty"><CheckCircle2/><b>No purchase issues</b><p>There are no blocked purchases to review.</p><Link className="button" to="/purchases">View purchases</Link></div>}</section></>
    const mode = view.replace("source-", ""), title = appRoutes[view][1]
    return <><PageHeading title={title} description={mode === "visual" ? "Select and edit elements directly. Every accepted change updates the source." : mode === "code" ? "Work with the actual files, with source history and precise controls." : "See the page and its source together, in one connected workspace."}/><nav className="wcb-mode-links" aria-label="Editing modes">{(["source-visual","source-code","source-split"] as DashboardView[]).map(key=><Link key={key} to={appRoutes[key][0]} className={key===view?"active":""}>{appRoutes[key][1]}</Link>)}</nav><section className="rd-panel"><header><h2>Choose a project</h2><p>Open a working copy in {mode === "visual" ? "Visual" : mode === "code" ? "Code" : "Split"}.</p></header><div className="wcb-padded"><label className="wcb-search-label"><Search/><input aria-label="Find a project" placeholder="Find a project" value={projectQuery} onChange={event=>setProjectQuery(event.target.value)}/></label></div>{projectRows(working)}{working.length > 0 && !working.some(({project})=>project.title.toLowerCase().includes(projectQuery.toLowerCase())) && <div className="rd-empty"><b>No matching projects</b><button className="button" onClick={()=>setProjectQuery("")}>Clear search</button></div>}</section></>
  }

  if (lib.loading && (view === "overview" || view.startsWith("source-") || view === "notifications")) return <RopeanDashboardShell purchaseBadge={0} view={view} onView={setView}><main className="rd-main"><div className="rd-main-heading"><h1>{appRoutes[view][1]}</h1></div><section className="rd-panel rd-dashboard-section"><HubState kind="loading" title="Loading your product state" body=""/></section></main></RopeanDashboardShell>
  if (lib.error && (view === "overview" || view.startsWith("source-") || view === "notifications")) return <RopeanDashboardShell purchaseBadge={0} view={view} onView={setView}><main className="rd-main"><div className="rd-main-heading"><h1>{appRoutes[view][1]}</h1></div><section className="rd-panel rd-dashboard-section"><HubState kind="error" title="Dashboard data could not be loaded" body={lib.error} action={<button className="button" onClick={() => window.location.reload()}>Try again</button>}/></section></main></RopeanDashboardShell>

  return <RopeanDashboardShell purchaseBadge={purchaseCount} view={view} onView={setView}>
    <main key={view} className="rd-main">
      {view === "overview" ? <>
        <div className="rd-main-heading">
          <h1>Dashboard</h1>
          <Link className="rd-primary-action" to="/marketplace">Browse templates <Plus/></Link>
        </div>


        <section className="rd-stat-grid">
          <article><div><span>Working copies</span><FolderKanban/></div><strong>{working.length}</strong><p>Projects ready to continue editing</p></article>
          <article><div><span>Purchases</span><ShoppingBag/></div><strong>{purchaseCount}</strong><p>{activePurchases} active release entitlements</p></article>


        </section>

        <section className="rd-dashboard-grid">
          <article className="rd-panel rd-continue-panel">
            <header><h2>Continue building</h2><p>Your source-backed working copies.</p></header>
            {projectRows(working)}
          </article>

          <article className="rd-panel rd-attention-panel"><header><h2>Needs attention</h2></header><div className="rd-empty"><CheckCircle2/><b>{attention ? `${attention} purchases need review` : "You’re all caught up"}</b><p>{attention ? "Review purchase status before starting a working copy." : "No blocked purchases."}</p>{attention > 0 && <Link className="button" to="/purchases">Review purchases</Link>}</div></article>
        </section>
        <section className="rd-panel rd-dashboard-section"><header><h2>Recent activity</h2><p>Your most recently created working copies.</p></header>{lib.hosted && lib.copies.length ? <div className="rd-project-list">{[...lib.copies].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)).slice(0,5).map(copy=><Link key={copy.workspaceProjectId} className="rd-project-row" to={"/workspace/"+copy.workspaceProjectId}><History/><span className="rd-project-copy"><b>{releaseProject(lib.catalog,copy.releaseId,copy.workspaceProjectId).title}</b><small>Working copy created</small></span><time>{new Date(copy.createdAt).toLocaleDateString()}</time></Link>)}</div> : <div className="rd-empty compact"><History/><b>No activity yet</b><p>Your working copies will appear here as you create them.</p></div>}</section>
      </> : secondaryView()}
    </main>
  </RopeanDashboardShell>
}

function BillingSettings() {
  const overview = useBillingOverview()
  const returnedPack = paymentReturn(window.location.search, "ai-pack")
  const returnedSubscription = paymentReturn(window.location.search, "subscription")
  const [working, setWorking] = useState("")
  const [message, setMessage] = useState(returnedPack.kind === "cancelled" || returnedSubscription.kind === "cancelled" ? "PayPal approval was cancelled. Refresh billing to check the server-confirmed status." : "")
  const captureStarted = useRef(false)
  const operationStarted = useRef(false)
  useEffect(() => {
    if (returnedPack.kind !== "return" || captureStarted.current) return
    captureStarted.current = true
    if (!returnedPack.providerOrderId) { setMessage("PayPal did not return an AI pack token. Refresh billing to check the server balance."); return }
    setWorking("capture"); setMessage("Capturing the AI Action pack…")
    void hostedProductClient.captureAiPack(returnedPack.providerOrderId).then(order => {
      if (order.status === "completed") { clearPaymentIdempotencyKey("ai-pack", order.packKey); setMessage(`${order.actions} purchased AI Actions are now available.`); overview.refresh() }
      else setMessage(`The AI Action pack returned with status ${order.status.replace(/_/g, " ")}.`)
    }, reason => setMessage(reason instanceof Error ? reason.message : "The AI Action pack could not be captured.")).finally(() => setWorking(""))
  }, [returnedPack.kind, returnedPack.providerOrderId])
  useEffect(() => { if (returnedSubscription.kind === "return" && !overview.loading) setMessage(overview.billing?.subscription?.status === "active" ? "Your subscription is active." : "PayPal approval returned. Subscription status is verified by server webhook; refresh if activation is still pending.") }, [returnedSubscription.kind, overview.loading, overview.billing?.subscription?.status])
  const cancel = async () => {
    const subscription = overview.billing?.subscription
    if (!subscription || working || operationStarted.current) return
    operationStarted.current = true
    setWorking("cancel"); setMessage("")
    try { const cancelled=await hostedProductClient.cancelSubscription(subscription.subscriptionId); overview.setBilling(current => current ? { ...current, currentPlanKey: cancelled.status === "active" ? cancelled.planKey : "free", subscription: cancelled } : current); setMessage("Subscription cancelled.") }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "The subscription could not be cancelled.") }
    finally { operationStarted.current = false; setWorking("") }
  }
  const buyPack = async (packKey: string) => {
    if (working || operationStarted.current || !overview.configuration?.checkoutAvailable) return
    operationStarted.current = true
    setWorking(packKey); setMessage("")
    try {
      const order = await hostedProductClient.createAiPack(packKey, paymentIdempotencyKey("ai-pack", packKey))
      if (!order.approvalUrl) throw new Error("PayPal approval is unavailable for this pack.")
      setMessage("Redirecting to PayPal…"); window.location.assign(order.approvalUrl)
    } catch (reason) { operationStarted.current = false; setMessage(reason instanceof Error ? reason.message : "The AI Action pack could not be started."); setWorking("") }
  }
  if (overview.loading) return <div className="settings-billing"><b>Loading billing…</b></div>
  if (overview.error || !overview.configuration || !overview.billing) return <div className="settings-billing"><b>Billing unavailable</b><p>{overview.error || "Billing state could not be loaded."}</p><button className="button" onClick={overview.refresh}>Try again</button></div>
  const subscription = overview.billing.subscription
  return <div className="settings-billing billing-live"><div className="billing-current"><span>Current plan</span><b>{planName(overview.billing.currentPlanKey)}</b><p>{subscription ? `${cadenceName(subscription.planKey)} · ${subscription.status.replace(/_/g, " ")}` : "Free · no renewal"}</p>{subscription?.currentPeriodEnd && <small>{subscription.status === "cancelled" ? "Recorded period end" : "Current period ends"} {new Date(subscription.currentPeriodEnd).toLocaleDateString()}</small>}{subscription?.status === "past_due" && <p className="billing-warning">Payment failed. Review the funding source and subscription status in PayPal.</p>}{subscription && !["cancelled","expired"].includes(subscription.status) && <button className="button" disabled={Boolean(working)} onClick={()=>void cancel()}>{working === "cancel" ? "Cancelling…" : "Cancel subscription"}</button>}<Link className="button" to="/plans">Review plans</Link></div><div className="billing-packs"><span>Purchased AI Actions</span><b>{overview.billing.aiActions.purchased}</b><p>Purchased Actions do not expire. Server usage and reversals determine the displayed balance.</p><div className="billing-pack-grid">{overview.configuration.aiActionPacks.map(pack => <button className="button" key={pack.key} disabled={!overview.configuration?.checkoutAvailable || Boolean(working)} onClick={()=>void buyPack(pack.key)}>{working === pack.key ? "Starting…" : `${pack.actions} — $${(pack.priceMinor/100).toFixed(2)}`}</button>)}</div>{!overview.configuration.checkoutAvailable && <small>Paid checkout is currently unavailable.</small>}</div>{message && <p className="settings-save-status" role="status">{message}</p>}<button className="quiet-link" type="button" onClick={overview.refresh}>Refresh billing status</button></div>
}

function Settings() {
  const requestedSection=new URLSearchParams(window.location.search).get("section"),auth=productionAuthMode(),live=productReadMode(),[section,setSection]=useState(requestedSection==="billing"||new URLSearchParams(window.location.search).has("subscription")||new URLSearchParams(window.location.search).has("ai-pack")?"Billing":"Profile"),[name,setName]=useState("Webcanbe user"),[email,setEmail]=useState(""),[providers,setProviders]=useState<string[]>([]),[activeSessions,setActiveSessions]=useState(0),[message,setMessage]=useState("")
  const sections=["Profile","Account","GitHub","Domains","Billing","Preferences"]
  useEffect(()=>{if(!live)return;let current=true;void hostedProductClient.account().then(account=>{if(current){setName(account.displayName);setEmail(account.email);setProviders(account.providers);setActiveSessions(account.activeSessions);setMessage("")}},error=>{if(current)setMessage(error instanceof Error?error.message:"Account profile is unavailable.")});return()=>{current=false}},[live])
  const save=async()=>{if(live){try{const account=await hostedProductClient.updateAccount(name);setName(account.displayName);setEmail(account.email);setMessage("Saved.")}catch(error){setMessage(error instanceof Error?error.message:"Could not save changes.")}return}try{localStorage.setItem("wcb-ui-settings",JSON.stringify({name,email}))}catch{}setMessage("Saved for this browser.")}
  const signOut=async()=>{if(auth)await productionSignOut();else{try{sessionStorage.removeItem("wcb-demo-auth")}catch{}}window.dispatchEvent(new Event("wcb:auth-changed"));go("/")}
  return <AppShell active="/settings"><main className="settings"><aside><h1>Settings</h1>{sections.map(x=><button key={x} onClick={()=>setSection(x)} className={section===x?"active":""}>{x}</button>)}</aside><section className="settings-panel"><span className="signal">{section}</span><h2>{section==="Profile"?"Your profile":section+" settings"}</h2>{section==="Profile"&&<><div className="profile-avatar">WC</div><label>Name<input value={name} onChange={e=>setName(e.target.value)}/></label></>}{section==="Account"&&<><label>Email<input value={email} disabled={live} onChange={e=>setEmail(e.target.value)}/></label>{live&&<div className="settings-action-row"><div><b>Sign-in methods</b><p>{providers.length?providers.join(" · "):"No active identity provider."}</p></div></div>}<div className="settings-action-row"><div><b>Session</b><p>{live?activeSessions+" active Webcanbe session"+(activeSessions===1?"":"s")+".":"Sign out returns directly to the landing page."}</p></div><button className="button" onClick={()=>void signOut()}><LogOut/> Sign out</button></div></>}{section==="GitHub"&&<div className="integration"><b>GitHub</b><p>Repository connection is not wired yet, so this action is disabled instead of pretending to work.</p><button className="button" disabled>Connection not enabled yet</button></div>}{section==="Domains"&&<div className="empty-state"><h3>Domains are not connected in this UI phase.</h3><Link className="button" to="/plans">See plans</Link></div>}{section==="Billing"&&<BillingSettings/>}{section==="Preferences"&&<div className="form-rows"><label>Notifications<select><option>Product updates</option><option>Only account notices</option></select></label><p className="settings-note">Theme switching is removed. Dashboard stays light.</p></div>}{["Profile","Account","Preferences"].includes(section)&&<button className="button primary save" onClick={()=>void save()}>Save changes</button>}{message&&<p className="settings-save-status">{message}</p>}</section></main></AppShell>
}
function Plans() {
  const queryPlan = new URLSearchParams(window.location.search).get("subscribe")
  const [authTick, setAuthTick] = useState(0)
  const requestedPlan = queryPlan || (() => { try { return sessionStorage.getItem("wcb-pending-subscription-plan") } catch { return null } })()
  const [annual, setAnnual] = useState(false)
  const [configuration, setConfiguration] = useState<PublicPaymentConfiguration>()
  const [configurationError, setConfigurationError] = useState("")
  const [checkoutState, setCheckoutState] = useState<"idle"|"authenticating"|"starting"|"redirecting"|"failed">("idle")
  const [checkoutMessage, setCheckoutMessage] = useState("")
  const [retry, setRetry] = useState(0)
  const started = useRef(false)
  useEffect(() => { const changed=()=>setAuthTick(value=>value+1); window.addEventListener("wcb:auth-changed", changed); return()=>window.removeEventListener("wcb:auth-changed", changed) }, [])
  useEffect(() => { let current = true; setConfigurationError(""); void loadPublicPaymentConfiguration().then(value => { if (current) setConfiguration(value) }, error => { if (current) setConfigurationError(error instanceof Error ? error.message : "Billing configuration is unavailable.") }); return () => { current = false } }, [retry])
  useEffect(() => {
    if (!configuration?.checkoutAvailable || !requestedPlan || started.current) return
    const plan = configuration.plans.find(item => item.key === requestedPlan && item.key !== "free")
    if (!plan) return
    started.current = true
    void (async () => {
      setCheckoutState("authenticating"); setCheckoutMessage("")
      if (!await productionSignedIn()) { try { sessionStorage.setItem("wcb-pending-subscription-plan", plan.key) } catch {}; started.current=false; go(`/login?next=${encodeURIComponent("/plans")}`); return }
      setCheckoutState("starting")
      try {
        const subscription = await hostedProductClient.createSubscription(plan.key, paymentIdempotencyKey("subscription", plan.key))
        if (subscription.status === "active") { clearPaymentIdempotencyKey("subscription", plan.key); try { sessionStorage.removeItem("wcb-pending-subscription-plan") } catch {}; go("/settings?section=billing"); return }
        if (!subscription.approvalUrl) throw new Error("PayPal subscription approval is unavailable.")
        try { sessionStorage.removeItem("wcb-pending-subscription-plan") } catch {}
        setCheckoutState("redirecting"); window.location.assign(subscription.approvalUrl)
      } catch (reason) { setCheckoutState("failed"); setCheckoutMessage(reason instanceof Error ? reason.message : "Subscription checkout could not be started.") }
    })()
  }, [configuration, requestedPlan, authTick])
  if (configurationError) return <PublicShell active="/plans"><main className="plans"><HubState kind="error" title="Plans are unavailable" body={configurationError} action={<button className="button" onClick={() => setRetry(value => value + 1)}>Try again</button>}/></main></PublicShell>
  if (!configuration) return <PublicShell active="/plans"><main className="plans"><HubState kind="loading" title="Loading plans" body=""/></main></PublicShell>
  const indexed = new Map(configuration.plans.map(plan => [plan.key, plan]))
  const rows = [
    { id: "free", name: "Free", monthly: indexed.get("free"), annual: indexed.get("free") },
    { id: "pro", name: "Pro", monthly: indexed.get("pro_monthly"), annual: indexed.get("pro_annual") },
    { id: "studio", name: "Studio", monthly: indexed.get("studio_monthly"), annual: indexed.get("studio_annual") },
  ].filter((row): row is { id: string; name: string; monthly: PublicPaymentPlan; annual: PublicPaymentPlan } => Boolean(row.monthly && row.annual))
  const limits = (plan: PublicPaymentPlan) => [
    `${plan.activeProjects} active projects`,
    `${plan.monthlyAiActions} included AI Actions / month`,
    `${plan.aiConcurrency} AI ${plan.aiConcurrency === 1 ? "concurrent action" : "concurrent actions"}`,
    `${plan.deploySlots} deploy ${plan.deploySlots === 1 ? "slot" : "slots"}`,
  ]
  const money = (minor: number) => `$${minor / 100}`
  const startSubscription = async (plan: PublicPaymentPlan) => {
    if (plan.key === "free") { go("/browse"); return }
    if (!configuration.checkoutAvailable || started.current || checkoutState === "starting" || checkoutState === "redirecting") return
    started.current = true
    setCheckoutState("authenticating"); setCheckoutMessage("")
    if (!await productionSignedIn()) { try { sessionStorage.setItem("wcb-pending-subscription-plan", plan.key) } catch {}; started.current=false; go(`/login?next=${encodeURIComponent("/plans")}`); return }
    setCheckoutState("starting")
    try {
      const subscription = await hostedProductClient.createSubscription(plan.key, paymentIdempotencyKey("subscription", plan.key))
      if (subscription.status === "active") { clearPaymentIdempotencyKey("subscription", plan.key); try { sessionStorage.removeItem("wcb-pending-subscription-plan") } catch {}; go("/settings?section=billing"); return }
      if (!subscription.approvalUrl) throw new Error("PayPal subscription approval is unavailable.")
      try { sessionStorage.removeItem("wcb-pending-subscription-plan") } catch {}
      setCheckoutState("redirecting"); window.location.assign(subscription.approvalUrl)
    } catch (reason) { started.current = false; setCheckoutState("failed"); setCheckoutMessage(reason instanceof Error ? reason.message : "Subscription checkout could not be started.") }
  }
  const billingStatus = configuration.checkoutAvailable ? "PayPal subscription checkout is available." : "Paid checkout is currently unavailable; prices and limits still come from the payment service."
  return <PublicShell active="/plans"><main className="plans"><div className="plans-head"><span className="signal">Plans</span><h1>The code is free.<br/>The workspace <em>isn’t.</em></h1><p>Exporting your codebase is never behind a plan. {billingStatus}</p><div className="billing-switch"><button className={!annual ? "active" : ""} onClick={() => setAnnual(false)}>Monthly</button><button className={annual ? "active" : ""} onClick={() => setAnnual(true)}>Annual</button></div>{checkoutMessage&&<p className="inline-error" role="alert">{checkoutMessage}</p>}</div><section className="plan-grid">{rows.map((row, index) => { const plan = annual ? row.annual : row.monthly, paid = row.id !== "free"; return <article className={index === 1 ? "featured" : ""} key={row.id}>{index === 1 && configuration.checkoutAvailable && <span className="popular">Available</span>}<h2>{row.name}</h2><p>{row.id === "free" ? "For opening a project, changing it, and taking it with you." : "More active projects, AI Actions, concurrency, and deploy capacity."}</p><strong>{money(plan.priceMinor)}<small>{plan.priceMinor > 0 ? annual ? "/ year" : "/ month" : ""}</small></strong><ul>{limits(plan).map(item => <li key={item}>✓ {item}</li>)}</ul><button className={index === 1 ? "button primary" : "button"} disabled={paid && (!configuration.checkoutAvailable || checkoutState === "starting" || checkoutState === "redirecting")} onClick={() => void startSubscription(plan)}>{row.id === "free" ? "Start for free" : !configuration.checkoutAvailable ? "Checkout unavailable" : checkoutState === "starting" ? "Starting checkout…" : checkoutState === "redirecting" ? "Redirecting…" : `Choose ${row.name}`}{row.id === "free" && <> <Arrow/></>}</button></article> })}</section><section className="plan-note"><h2>AI and marketplace policy</h2><p>Standard AI uses {configuration.aiActionCost.standard} Action; Deep AI uses {configuration.aiActionCost.deep} Actions. Included AI Actions renew monthly on paid annual plans too. Purchased Actions never expire. Add-ons: {configuration.aiActionPacks.map(addOn => `${addOn.actions} for ${money(addOn.priceMinor)}`).join(" · ")}. Marketplace listings may be free; paid listings start at {money(configuration.marketplace.minimumPaidListingMinor)}.</p></section></main></PublicShell> }

function CreatorListingEditor({ listing, onSaved }: { listing: CreatorStudioData["listings"][number]; onSaved: (listing: CreatorStudioData["listings"][number]) => void }) {
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

  if (!hosted) return <AppShell><main className="seller creator-studio"><PageHeading title="Creator Studio" description="Prepare your source project for the marketplace."/><section className="rd-panel wcb-padded"><h2>Your first submission</h2><p>Open a working project, check its responsive layout, and export its source before submitting it for review.</p><div className="rd-page-actions"><Link to="/projects" className="rd-primary-action">Choose a project <Arrow/></Link><Link to="/app/docs" className="button">Read the publishing guide</Link></div></section><section className="rd-panel wcb-padded"><h2>Publishing access</h2><p>Applications and submissions are available when signed in to the hosted product. This local preview does not publish projects.</p><Link to="/marketplace" className="button">Explore the marketplace <Arrow/></Link></section></main></AppShell>
  if (loading) return <AppShell><main className="seller creator-studio"><header className="seller-head"><div><span className="signal">Creator Studio</span><h1>Loading creator state…</h1></div></header><HubState kind="loading" title="Loading Creator Studio" body=""/></main></AppShell>
  if (error) return <AppShell><main className="seller creator-studio"><header className="seller-head"><div><span className="signal">Creator Studio</span><h1>Creator Studio needs attention.</h1></div></header><HubState kind="error" title="Creator Studio unavailable" body={error} action={<button className="button" onClick={() => void refresh()}>Try again</button>}/></main></AppShell>
  if (!application) return <AppShell><main className="seller creator-studio"><header className="seller-head"><div><span className="signal">Become a creator</span><h1>Sell working projects, not flattened files.</h1><p>Apply once. Approved creators can submit source-backed projects into the review and assessment pipeline.</p></div></header><section className="creator-application"><span>No application yet</span><h2>Start your creator application.</h2><p>The application starts as pending and does not grant publication authority.</p><button className="button primary" disabled={busy} onClick={() => void apply()}>{busy ? "Applying…" : "Apply to become a creator"} <Arrow/></button></section></main></AppShell>
  if (application.status !== "approved") return <AppShell><main className="seller creator-studio"><header className="seller-head"><div><span className="signal">Creator application</span><h1>{application.status === "pending" ? "Your application is in review." : "Your application was not approved."}</h1><p>Creator Studio unlocks only after server-side approval.</p></div></header><section className="creator-application"><span className={`creator-status ${application.status}`}>{application.status}</span><h2>Application {application.applicationId}</h2><p>Submitted {new Date(application.createdAt).toLocaleDateString()} · last updated {new Date(application.updatedAt).toLocaleDateString()}.</p></section></main></AppShell>
  if (!studio) return <AppShell><main className="seller creator-studio"><HubState kind="error" title="Studio data unavailable" body="The approved application exists, but the seller-scoped aggregate was not returned."/></main></AppShell>

  const readyCount = studio.ready.filter(item => item.status === "ready").length
  return <AppShell><main className="seller creator-studio"><header className="seller-head"><div><span className="signal">Creator Studio</span><h1>{page === "new" ? "Submit a project" : page === "projects" ? "Projects and listings" : "Your marketplace pipeline"}</h1><p>Seller-scoped product state from submission through immutable release and Listing.</p></div>{page !== "new" && <Link to="/seller/projects/new" className="button primary">Submit project <Arrow/></Link>}</header><nav className="creator-nav"><Link className={page === "home" ? "active" : ""} to="/seller">Overview</Link><Link className={page === "projects" ? "active" : ""} to="/seller/projects">Projects</Link><Link className={page === "new" ? "active" : ""} to="/seller/projects/new">New submission</Link></nav>{page === "home" && <><section className="creator-metrics"><div><span>Submissions</span><strong>{studio.submissions.length}</strong></div><div><span>Published listings</span><strong>{studio.listings.length}</strong></div><div><span>Webcanbe Ready</span><strong>{readyCount}</strong></div></section><section className="creator-pipeline"><div className="hub-section-head"><div><h2>Recent pipeline</h2><p>Review and assessment state is read from seller-safe server data.</p></div></div>{studio.submissions.length ? studio.submissions.slice(0,6).map(item => { const assessment = studio.assessments.find(value => value.submissionId === item.submissionId), review = studio.reviews.find(value => value.submissionId === item.submissionId); return <article key={item.submissionId}><div><span>Submission</span><b>{item.sourceProjectId}</b></div><div><span>Review</span><b>{review?.decision ?? item.status}</b></div><div><span>Assessment</span><b>{assessment?.result?.status ?? assessment?.status ?? "Not started"}</b></div><small>{new Date(item.createdAt).toLocaleDateString()}</small></article> }) : <p className="muted-copy">No submissions yet.</p>}</section></>}{page === "projects" && <><section className="creator-project-section"><div className="hub-section-head"><div><h2>Published listings</h2><p>Only bounded Listing metadata is editable here. Release binding stays immutable.</p></div><span>{studio.listings.length}</span></div>{studio.listings.length ? <div className="creator-listing-grid">{studio.listings.map(listing => <CreatorListingEditor key={listing.listingId} listing={listing} onSaved={updateListing}/>)}</div> : <HubState kind="empty" title="No published listings" body="Submitted projects appear here after review, assessment, promotion and publication."/>}</section><section className="creator-project-section"><div className="hub-section-head"><div><h2>Submission history</h2><p>Exact source revision and review state remain attached.</p></div><span>{studio.submissions.length}</span></div><div className="creator-submission-list">{studio.submissions.map(item => <article key={item.submissionId}><div><b>{item.sourceProjectId}</b><span>{item.status}</span></div><code>{item.sourceRevisionId}</code><small>{new Date(item.createdAt).toLocaleString()}</small></article>)}</div></section></>}{page === "new" && <section className="creator-submit"><div className="creator-submit-copy"><span className="signal">Source-backed submission</span><h2>Choose an existing project.</h2><p>The server captures its current accepted source revision and places that immutable snapshot into quarantine. This does not publish a Listing.</p></div><div className="creator-submit-form"><label>Workspace<select value={workspaceId} onChange={event => setWorkspaceId(event.target.value)}>{workspaces.map(value => <option value={value} key={value}>{value}</option>)}</select></label><label>Source project<select value={sourceProjectId} onChange={event => setSourceProjectId(event.target.value)}>{sourceProjects.map(value => <option value={value.id} key={value.id}>{value.name} · {value.id}</option>)}</select></label><button className="button primary" disabled={busy || !workspaceId || !sourceProjectId} onClick={() => void submit()}>{busy ? "Submitting…" : "Submit for review"} <Arrow/></button>{(!workspaces.length || !sourceProjects.length) && <p className="creator-message">Create an editable workspace project before submitting.</p>}</div></section>}</main></AppShell>
}

const field = (row: Record<string, unknown>, ...keys: string[]) => keys.map(key => row[key]).find(value => value !== undefined && value !== null)
const displayField = (value: unknown) => typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : value ? JSON.stringify(value) : "—"
function ControlRows({ rows, columns }: { rows: Array<Record<string, unknown>>; columns: Array<{ label: string; keys: string[] }> }) {
  return <div className="control-table"><div className="control-table-head">{columns.map(column => <span key={column.label}>{column.label}</span>)}</div>{rows.length ? rows.slice(0,20).map((row,index) => <div className="control-table-row" key={String(field(row,"audit_id","application_id","submission_id","release_id","listing_id") ?? index)}>{columns.map(column => <span key={column.label}>{displayField(field(row, ...column.keys))}</span>)}</div>) : <p>No records.</p>}</div>
}

const HIGH_RISK_CONTROL_POLICY = "Three factors are required every time."
function Control() {
  const hosted = controlMode(), [control, setControl] = useState<ControlData>(), [password, setPassword] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("")
  const [controlView,setControlView]=useState<"overview"|"requests"|"sellers"|"publishing"|"payments"|"access"|"audit">("overview")
  const [mutationFactor,setMutationFactor]=useState(""), [mutationStatus,setMutationStatus]=useState(""), [targetUserId,setTargetUserId]=useState(""), [targetRole,setTargetRole]=useState<"reviewer"|"admin"|"bigperson">("reviewer"), [targetActive,setTargetActive]=useState(true)
  const [promotionResultId,setPromotionResultId]=useState(""), [promotionCatalogProjectId,setPromotionCatalogProjectId]=useState(""), [promotionVersion,setPromotionVersion]=useState("1.0.0")
  const [rightsReleaseId,setRightsReleaseId]=useState(""), [rightsBasis,setRightsBasis]=useState<"first_party_original"|"seller_rights_reviewed"|"open_source_compatible">("first_party_original"), [rightsLicenseExpression,setRightsLicenseExpression]=useState("MIT")
  const [rightsSourceReference,setRightsSourceReference]=useState(""), [rightsDependencyReference,setRightsDependencyReference]=useState(""), [rightsAssetReference,setRightsAssetReference]=useState("")
  const [publicationPromotionId,setPublicationPromotionId]=useState(""), [publicationSlug,setPublicationSlug]=useState(""), [publicationTitle,setPublicationTitle]=useState(""), [publicationSummary,setPublicationSummary]=useState("")
  const [entitlementUserId,setEntitlementUserId]=useState(""), [entitlementReleaseId,setEntitlementReleaseId]=useState("")
  const [readyReleaseId,setReadyReleaseId]=useState(""), [readyAssessmentResultId,setReadyAssessmentResultId]=useState(""), [readyVersion,setReadyVersion]=useState("ready-v1")
  const verifyAndRead = async () => {
    if (!password || busy) return
    const factor = password
    setPassword(""); setBusy(true); setError(""); setControl(undefined)
    try { setControl(await hostedProductClient.controlRead(factor)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : HIGH_RISK_CONTROL_POLICY+" Privileged verification was refused.") }
    finally { setBusy(false) }
  }
  const enrollPasskey = async () => {
    if (!password || busy) return
    const factor = password
    setPassword(""); setBusy(true); setError("")
    try {
      await hostedProductClient.registerBigpersonPasskey(factor)
      setError("Passkey registered. Enter the privileged factor again and verify all three factors to open Operations.")
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Bigperson passkey registration was refused.") }
    finally { setBusy(false) }
  }
  const mutateOperator = async () => {
    if(!mutationFactor||!targetUserId||busy||!control)return
    const factor=mutationFactor; setMutationFactor(""); setBusy(true); setMutationStatus("")
    try{
      const operator=await hostedProductClient.controlTransitionOperator(factor,{targetUserId:targetUserId.trim(),active:targetActive,role:targetRole})
      setControl(current=>current?{...current,operators:[operator,...current.operators.filter(row=>String(field(row,"user_id"))!==targetUserId.trim())]}:current)
      setMutationStatus("Operator authority changed and audited.")
    }catch(reason){setMutationStatus(reason instanceof Error?reason.message:"Operator transition refused.")}
    finally{setBusy(false)}
  }
  const mutateSeller = async (applicationId:string,status:"approved"|"rejected") => {
    if(!mutationFactor||busy||!control)return
    const factor=mutationFactor; setMutationFactor(""); setBusy(true); setMutationStatus("")
    try{
      const application=await hostedProductClient.controlTransitionSellerApplication(factor,{applicationId,status})
      setControl(current=>current?{...current,sellerApplications:current.sellerApplications.map(row=>String(field(row,"application_id"))===applicationId?application:row)}:current)
      setMutationStatus(`Seller application ${status} and audited.`)
    }catch(reason){setMutationStatus(reason instanceof Error?reason.message:"Seller transition refused.")}
    finally{setBusy(false)}
  }
  const revokeControlSession = async (sessionId:string) => {
    if(!mutationFactor||busy||!control)return
    const factor=mutationFactor; setMutationFactor(""); setBusy(true); setMutationStatus("")
    try{
      await hostedProductClient.controlRevokeSession(factor,sessionId)
      setControl(current=>current?{...current,sessions:current.sessions.filter(row=>String(field(row,"session_id"))!==sessionId)}:current)
      setMutationStatus("Session revoked and audited.")
    }catch(reason){setMutationStatus(reason instanceof Error?reason.message:"Session revocation refused.")}
    finally{setBusy(false)}
  }
  const decideReview = async (row:Record<string,unknown>,decision:"approved_for_next_stage"|"rejected") => {
    if(!mutationFactor||busy||!control)return
    const submissionId=String(field(row,"submission_id")??""),snapshotHash=String(field(row,"snapshot_hash")??"")
    const factor=mutationFactor;setMutationFactor("");setBusy(true);setMutationStatus("")
    try{
      const review=await hostedProductClient.controlReviewDecision(factor,{submissionId,snapshotHash,decision})
      setControl(current=>current?{...current,reviews:[review,...current.reviews.filter(item=>String(field(item,"submission_id"))!==submissionId)]}:current)
      setMutationStatus(`Review ${decision} and audited.`)
    }catch(reason){setMutationStatus(reason instanceof Error?reason.message:"Review decision refused.")}
    finally{setBusy(false)}
  }
  const admitControlAssessment = async (review:Record<string,unknown>) => {
    if(!mutationFactor||busy||!control)return
    const submissionId=String(field(review,"submission_id")??""),submission=control.submissions.find(row=>String(field(row,"submission_id"))===submissionId)
    if(!submission){setMutationStatus("Submission provenance is unavailable.");return}
    const factor=mutationFactor;setMutationFactor("");setBusy(true);setMutationStatus("")
    try{
      const assessment=await hostedProductClient.controlAdmitAssessment(factor,{submissionId,sellerUserId:String(field(submission,"seller_user_id")??""),snapshotHash:String(field(submission,"snapshot_hash")??""),reviewDecisionId:String(field(review,"decision_id")??"")})
      setControl(current=>current?{...current,assessments:[assessment,...current.assessments.filter(item=>String(field(item,"submission_id"))!==submissionId)]}:current)
      setMutationStatus("Assessment admitted and audited.")
    }catch(reason){setMutationStatus(reason instanceof Error?reason.message:"Assessment admission refused.")}
    finally{setBusy(false)}
  }
  const promoteControlRelease = async () => {
    if(!mutationFactor||busy||!control||!promotionResultId||!promotionCatalogProjectId||!promotionVersion)return
    const factor=mutationFactor;setMutationFactor("");setBusy(true);setMutationStatus("")
    try{
      const result=await hostedProductClient.controlPromoteAssessmentRelease(factor,{resultId:promotionResultId.trim(),catalogProjectId:promotionCatalogProjectId.trim(),version:promotionVersion.trim()})
      setControl(current=>current?{...current,promotions:[result.promotion,...current.promotions.filter(row=>String(field(row,"promotion_id"))!==String(field(result.promotion,"promotion_id")))],releases:[result.release,...current.releases.filter(row=>String(field(row,"release_id"))!==String(field(result.release,"release_id")))]}:current)
      setPublicationPromotionId(String(field(result.promotion,"promotion_id")??""))
      setRightsReleaseId(String(field(result.release,"release_id")??""))
      setReadyReleaseId(String(field(result.release,"release_id")??""))
      setReadyAssessmentResultId(promotionResultId.trim())
      setMutationStatus("Passed assessment promoted to an immutable release and audited.")
    }catch(reason){setMutationStatus(reason instanceof Error?reason.message:"Release promotion refused.")}
    finally{setBusy(false)}
  }
  const verifyControlRights = async () => {
    if(!mutationFactor||busy||!control||!rightsReleaseId||!rightsLicenseExpression||!rightsSourceReference||!rightsDependencyReference||!rightsAssetReference)return
    const factor=mutationFactor;setMutationFactor("");setBusy(true);setMutationStatus("")
    const sourceEvidence:Record<string,unknown>={reviewed:true,unresolvedCount:0,reference:rightsSourceReference.trim()}
    if(rightsBasis==="first_party_original")Object.assign(sourceEvidence,{origin:"first_party_repo",original:true})
    else if(rightsBasis==="seller_rights_reviewed")Object.assign(sourceEvidence,{sellerAttested:true,reviewerApproved:true})
    else Object.assign(sourceEvidence,{openSourceCompatible:true})
    try{
      const verification=await hostedProductClient.controlVerifyReleaseRights(factor,{
        releaseId:rightsReleaseId.trim(),
        rightsBasis,
        licenseExpression:rightsLicenseExpression.trim(),
        sourceEvidence,
        dependencyEvidence:{reviewed:true,unresolvedCount:0,reference:rightsDependencyReference.trim()},
        assetEvidence:{reviewed:true,unresolvedCount:0,reference:rightsAssetReference.trim()},
      })
      setControl(current=>current?{...current,rights:[verification,...current.rights.filter(row=>String(field(row,"release_id"))!==rightsReleaseId.trim())]}:current)
      setMutationStatus("Release publication/distribution rights verified and audited.")
    }catch(reason){setMutationStatus(reason instanceof Error?reason.message:"Release rights verification refused.")}
    finally{setBusy(false)}
  }
  const publishControlListing = async () => {
    if(!mutationFactor||busy||!control||!publicationPromotionId||!publicationSlug||!publicationTitle||!publicationSummary)return
    const factor=mutationFactor;setMutationFactor("");setBusy(true);setMutationStatus("")
    try{
      const result=await hostedProductClient.controlPublishPromotedListing(factor,{promotionId:publicationPromotionId.trim(),slug:publicationSlug.trim(),title:publicationTitle.trim(),summary:publicationSummary.trim()})
      setControl(current=>current?{...current,publications:[result.publication,...current.publications.filter(row=>String(field(row,"publication_id"))!==String(field(result.publication,"publication_id")))],listings:[result.listing,...current.listings.filter(row=>String(field(row,"listing_id"))!==String(field(result.listing,"listing_id")))]}:current)
      setEntitlementReleaseId(String(field(result.listing,"release_id")??""))
      setMutationStatus("Promoted release published as a Listing and audited.")
    }catch(reason){setMutationStatus(reason instanceof Error?reason.message:"Listing publication refused.")}
    finally{setBusy(false)}
  }
  const qualifyControlReady = async () => {
    if(!mutationFactor||busy||!control||!readyReleaseId||!readyAssessmentResultId||!readyVersion)return
    const factor=mutationFactor;setMutationFactor("");setBusy(true);setMutationStatus("")
    try{
      const qualification=await hostedProductClient.controlQualifyReleaseReady(factor,{releaseId:readyReleaseId.trim(),assessmentResultId:readyAssessmentResultId.trim(),qualificationVersion:readyVersion.trim()})
      setControl(current=>current?{...current,ready:[qualification,...current.ready.filter(row=>String(field(row,"qualification_id"))!==String(field(qualification,"qualification_id")))]}:current)
      setMutationStatus("Ready qualification derived from immutable source and audited.")
    }catch(reason){setMutationStatus(reason instanceof Error?reason.message:"Ready qualification refused.")}
    finally{setBusy(false)}
  }
  const grantControlEntitlement = async () => {
    if(!mutationFactor||busy||!control||!entitlementUserId||!entitlementReleaseId)return
    const factor=mutationFactor;setMutationFactor("");setBusy(true);setMutationStatus("")
    try{
      const entitlement=await hostedProductClient.controlGrantTestEntitlement(factor,{beneficiaryUserId:entitlementUserId.trim(),releaseId:entitlementReleaseId.trim()})
      setControl(current=>current?{...current,entitlements:[entitlement,...current.entitlements.filter(row=>String(field(row,"entitlement_id"))!==String(field(entitlement,"entitlement_id")))]}:current)
      setMutationStatus("TEST entitlement granted and audited.")
    }catch(reason){setMutationStatus(reason instanceof Error?reason.message:"TEST entitlement grant refused.")}
    finally{setBusy(false)}
  }
  const transitionControlEntitlement = async (entitlementId:string,status:"revoked"|"invalid") => {
    if(!mutationFactor||busy||!control)return
    const factor=mutationFactor;setMutationFactor("");setBusy(true);setMutationStatus("")
    try{
      const entitlement=await hostedProductClient.controlTransitionTestEntitlement(factor,{entitlementId,status})
      setControl(current=>current?{...current,entitlements:current.entitlements.map(row=>String(field(row,"entitlement_id"))===entitlementId?entitlement:row)}:current)
      setMutationStatus(`TEST entitlement ${status} and audited.`)
    }catch(reason){setMutationStatus(reason instanceof Error?reason.message:"TEST entitlement transition refused.")}
    finally{setBusy(false)}
  }
  if (!hosted) return <div className="control-standalone"><main className="control"><header className="control-head"><span className="signal">Operations</span><h1>Hosted privileged session required.</h1><p>The local product preview does not fabricate privileged records or platform roles.</p></header></main></div>
  if (controlView==="requests") return <Suspense fallback={<main className="control-standalone" aria-busy="true"/>}><ControlRequests onBack={()=>setControlView("overview")}/></Suspense>
  if (!control) return <div className="control-standalone"><main className="control"><header className="control-head"><span className="signal">Bigperson Operations</span><h1>Operations access</h1><p>Ordinary request triage uses your active operator role and first-party session. High-risk platform controls continue to require the complete fresh three-factor ceremony.</p></header><section className="control-auth-gate"><div><b>Requests</b><p>Read, assign, prioritize, transition, and record notes with operator authorization and append-only request audit.</p><button className="button primary" onClick={()=>setControlView("requests")}>Open Requests queue</button></div><div><b>1. Google identity</b><p>Verified again on the server from the current first-party session and the enrolled Google issuer + subject.</p></div><div><b>2. Privileged factor</b><p>Entered for this operation only. It is cleared from UI state before the passkey ceremony.</p></div><div><b>3. Apple / WebAuthn passkey</b><p>User verification is required. The signed challenge is one-time, session-bound, operation-bound and expires after 90 seconds.</p></div><label>Privileged factor<input type="password" autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} onKeyDown={event=>{if(event.key==="Enter")void verifyAndRead()}}/></label><div className="control-auth-actions"><button className="button primary" disabled={busy||!password} onClick={()=>void verifyAndRead()}>{busy?"Verifying…":"Verify all 3 factors"}</button><button className="button" disabled={busy||!password} onClick={()=>void enrollPasskey()}>First Bigperson: register passkey</button></div>{error&&<p className="creator-message" role="status">{error}</p>}</section></main></div>
  const metrics = [["Users", control.users.length], ["Operators", control.operators.filter(row => field(row,"active") === true).length], ["Seller applications", control.sellerApplications.length], ["Submissions", control.submissions.length], ["Listings", control.listings.length], ["Audit events", control.audit.length]] as const
  const pendingSellers=control.sellerApplications.filter(row=>String(field(row,"status")??"")==="pending").length
  const pendingReviews=control.submissions.filter(row=>!control.reviews.some(item=>String(field(item,"submission_id"))===String(field(row,"submission_id")))).length
  const activeOperators=control.operators.filter(row=>field(row,"active")===true).length
  const authorityRole=control.authority.role
  return <div className="control-standalone"><main className="control"><header className="control-head control-console-head"><div><span className="signal">Bigperson Operations</span><h1>Platform control.</h1><p>Bigperson inherits every reviewer and admin capability. Seller approval, review, publication, access control and audit stay in this one console. The path itself is not trusted as authorization.</p></div><span className="control-role-badge">{authorityRole==="bigperson"?"BIGPERSON · REVIEWER + ADMIN + PLATFORM":"PLATFORM · "+authorityRole.toUpperCase()}</span></header>
    <section className="control-authenticated"><b>Three-factor proof consumed for this read.</b><p>Every write below still requires a new Google-bound session check, privileged factor verification and passkey assertion.</p><button className="button" onClick={()=>setControl(undefined)}>Lock Operations</button></section>
    <nav className="control-console-nav" aria-label="Operations sections">{([["overview","Overview"],["requests","Requests"],["sellers","Sellers & Review"],["publishing","Publishing"],["payments","Payments & Payouts"],["access","Access & Roles"],["audit","Audit"]] as const).map(([value,label])=><button key={value} type="button" className={controlView===value?"active":""} onClick={()=>setControlView(value)}>{label}</button>)}</nav>
    <section className="control-metrics">{metrics.map(([label,value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</section>
    <aside className="control-stepup"><b>Bigperson includes Reviewer + Admin permissions.</b><p>Platform roles: reviewer → admin → bigperson. Reviewer actions, seller/admin actions and Bigperson-only platform-role changes are all available here. Workspace owner/editor/viewer roles remain separate.</p></aside>
    <section className="control-mutation-factor"><label>Privileged factor for next mutation<input type="password" autoComplete="current-password" value={mutationFactor} onChange={event=>setMutationFactor(event.target.value)}/></label><p>One factor entry authorizes only the single operation whose method, path and body are signed. The value is cleared before the passkey prompt.</p>{mutationStatus&&<b role="status">{mutationStatus}</b>}</section>
    {controlView==="overview"&&<section className="control-overview-grid"><article><span>Seller intake</span><strong>{pendingSellers}</strong><p>Pending creator applications awaiting an approve/reject decision.</p><button type="button" onClick={()=>setControlView("sellers")}>Open seller review</button></article><article><span>Review queue</span><strong>{pendingReviews}</strong><p>Submitted source snapshots that do not yet have an immutable review decision.</p><button type="button" onClick={()=>setControlView("sellers")}>Open review queue</button></article><article><span>Platform access</span><strong>{activeOperators}</strong><p>Active reviewer, admin and Bigperson operators.</p><button type="button" onClick={()=>setControlView("access")}>Manage access</button></article><article><span>Published listings</span><strong>{control.listings.length}</strong><p>Release, Ready and Listing publication controls.</p><button type="button" onClick={()=>setControlView("publishing")}>Open publishing</button></article></section>}
    {controlView==="access"&&<>
    <section className="control-section"><div className="hub-section-head"><div><h2>Privileged operators</h2><p>Every role change requires a new Google-bound session check, privileged factor verification and passkey assertion. The final active bigperson is protected in PostgreSQL.</p></div></div><div className="control-mutation-form"><label>Target user ID<input value={targetUserId} onChange={event=>setTargetUserId(event.target.value)} placeholder="Internal Webcanbe user UUID"/></label><label>Platform role<select value={targetRole} onChange={event=>setTargetRole(event.target.value as "reviewer"|"admin"|"bigperson")}><option value="reviewer">reviewer</option><option value="admin">admin</option><option value="bigperson">bigperson</option></select></label><label>State<select value={targetActive?"active":"inactive"} onChange={event=>setTargetActive(event.target.value==="active")}><option value="active">active</option><option value="inactive">inactive</option></select></label><button className="button" disabled={busy||!mutationFactor||!targetUserId} onClick={()=>void mutateOperator()}>Verify 3 factors & apply</button></div><ControlRows rows={control.operators} columns={[{label:"User",keys:["user_id"]},{label:"Role",keys:["role"]},{label:"Active",keys:["active"]},{label:"Epoch",keys:["epoch"]}]}/></section>
    <section className="control-split"><div><div className="hub-section-head"><div><h2>Users</h2><p>Identity-account aggregation without provider credentials.</p></div></div><ControlRows rows={control.users} columns={[{label:"User",keys:["user_id"]},{label:"Identities",keys:["identity_count"]},{label:"Active identity",keys:["has_active_identity"]}]}/></div><div><div className="hub-section-head"><div><h2>Sessions</h2><p>Active session identifiers and bounded authentication metadata. Tokens and hashes are never exposed.</p></div></div><div className="control-session-list">{control.sessions.slice(0,40).map(row=>{const sessionId=String(field(row,"session_id")??"");return <article key={sessionId}><div><b>{String(field(row,"user_id")??"")}</b><code>{sessionId}</code><small>{String(field(row,"auth_provider")??"unknown")} · expires {displayField(field(row,"expires_at"))}</small></div><button className="button" disabled={busy||!mutationFactor} onClick={()=>void revokeControlSession(sessionId)}>Revoke</button></article>})}</div></div></section>
    <section className="control-split"><div><div className="hub-section-head"><div><h2>Workspaces</h2><p>Membership health and owner coverage.</p></div></div><ControlRows rows={control.workspaces} columns={[{label:"Workspace",keys:["workspace_id"]},{label:"Members",keys:["active_members"]},{label:"Owners",keys:["owners"]}]}/></div><div><div className="hub-section-head"><div><h2>TEST entitlements</h2><p>Admin and Bigperson may grant or terminate only provider=test entitlements through a fresh three-factor proof. Payment-provider entitlements are not mutable here.</p></div></div><div className="control-mutation-form"><label>Beneficiary user<input value={entitlementUserId} onChange={event=>setEntitlementUserId(event.target.value)} placeholder="Internal user UUID"/></label><label>Published release<input value={entitlementReleaseId} onChange={event=>setEntitlementReleaseId(event.target.value)} placeholder="Release UUID"/></label><button className="button" disabled={busy||!mutationFactor||!entitlementUserId||!entitlementReleaseId} onClick={()=>void grantControlEntitlement()}>Grant TEST entitlement</button></div><div className="control-session-list">{control.entitlements.slice(0,40).map(row=>{const entitlementId=String(field(row,"entitlement_id")??""),provider=String(field(row,"provider")??""),status=String(field(row,"status")??"");return <article key={entitlementId}><div><b>{String(field(row,"user_id")??"")}</b><code>{entitlementId}</code><small>{provider} · {status}</small></div><div><button className="button" disabled={busy||!mutationFactor||provider!=="test"||status!=="active"} onClick={()=>void transitionControlEntitlement(entitlementId,"revoked")}>Revoke</button><button className="button" disabled={busy||!mutationFactor||provider!=="test"||status!=="active"} onClick={()=>void transitionControlEntitlement(entitlementId,"invalid")}>Invalidate</button></div></article>})}</div></div></section>
    </>}
    {controlView==="sellers"&&<>
    <section className="control-section"><div className="hub-section-head"><div><h2>Seller applications</h2><p>Approve or reject intake only after a fresh three-factor ceremony. Rejected applications cannot be silently reopened.</p></div></div><div className="control-seller-actions">{control.sellerApplications.slice(0,20).map(row=>{const applicationId=String(field(row,"application_id")??""),status=String(field(row,"status")??"");return <article key={applicationId}><div><b>{applicationId}</b><span>{String(field(row,"user_id")??"")}</span></div><strong>{status}</strong><div><button className="button" disabled={busy||!mutationFactor||status==="approved"||status==="rejected"} onClick={()=>void mutateSeller(applicationId,"approved")}>Approve</button><button className="button" disabled={busy||!mutationFactor||status==="rejected"} onClick={()=>void mutateSeller(applicationId,"rejected")}>Reject</button></div></article>})}</div></section>
    <section className="control-section"><div className="hub-section-head"><div><h2>Submission pipeline</h2><p>Immutable submission provenance. A review decision requires a fresh three-factor ceremony and cannot be rewritten after it exists.</p></div></div><div className="control-seller-actions">{control.submissions.slice(0,30).map(row=>{const submissionId=String(field(row,"submission_id")??""),review=control.reviews.find(item=>String(field(item,"submission_id"))===submissionId);return <article key={submissionId}><div><b>{submissionId}</b><span>{String(field(row,"seller_user_id")??"")} · {String(field(row,"source_revision_id")??"")}</span></div><strong>{review?String(field(review,"decision")??"reviewed"):String(field(row,"status")??"")}</strong><div><button className="button" disabled={busy||!mutationFactor||Boolean(review)} onClick={()=>void decideReview(row,"approved_for_next_stage")}>Approve review</button><button className="button" disabled={busy||!mutationFactor||Boolean(review)} onClick={()=>void decideReview(row,"rejected")}>Reject review</button></div></article>})}</div></section>
    <section className="control-split"><div><div className="hub-section-head"><div><h2>Reviews</h2><p>Immutable review decisions. Approved submissions can be admitted to assessment once.</p></div></div><div className="control-session-list">{control.reviews.slice(0,30).map(row=>{const decisionId=String(field(row,"decision_id")??""),submissionId=String(field(row,"submission_id")??""),decision=String(field(row,"decision")??""),assessment=control.assessments.find(item=>String(field(item,"submission_id"))===submissionId);return <article key={decisionId}><div><b>{decision}</b><code>{submissionId}</code><small>{decisionId}</small></div><button className="button" disabled={busy||!mutationFactor||decision!=="approved_for_next_stage"||Boolean(assessment)} onClick={()=>void admitControlAssessment(row)}>{assessment?"Admitted":"Admit assessment"}</button></article>})}</div></div><div><div className="hub-section-head"><div><h2>Assessments</h2><p>Admission and isolated assessment state.</p></div></div><ControlRows rows={control.assessments} columns={[{label:"Request",keys:["assessment_request_id"]},{label:"Submission",keys:["submission_id"]},{label:"Status",keys:["status"]},{label:"Admitted by",keys:["admitted_by"]}]}/></div></section>
    </>}
    {controlView==="publishing"&&<>
    <section className="control-section"><div className="hub-section-head"><div><h2>Assessment results → release promotion</h2><p>Only a passed immutable assessment can be promoted. The server derives submission, seller, snapshot and review lineage; the operator supplies only the target catalog project and version.</p></div></div><div className="control-mutation-form"><label>Passed result<input value={promotionResultId} onChange={event=>setPromotionResultId(event.target.value)} placeholder="Assessment result UUID"/></label><label>Catalog project<input value={promotionCatalogProjectId} onChange={event=>setPromotionCatalogProjectId(event.target.value)} placeholder="Catalog project UUID"/></label><label>Version<input value={promotionVersion} onChange={event=>setPromotionVersion(event.target.value)} placeholder="1.0.0"/></label><button className="button" disabled={busy||!mutationFactor||!promotionResultId||!promotionCatalogProjectId||!promotionVersion} onClick={()=>void promoteControlRelease()}>Promote release</button></div><ControlRows rows={control.results} columns={[{label:"Result",keys:["result_id"]},{label:"Submission",keys:["submission_id"]},{label:"Status",keys:["result_status"]},{label:"Completed",keys:["completed_at"]}]}/><div className="hub-section-head"><div><h3>Catalog projects</h3><p>Promotion must match seller, workspace and source provenance.</p></div></div><ControlRows rows={control.catalogProjects} columns={[{label:"Catalog",keys:["catalog_project_id"]},{label:"Source",keys:["source_project_id"]},{label:"Created by",keys:["created_by"]},{label:"Title",keys:["title"]}]}/></section>
    <section className="control-section"><div className="hub-section-head"><div><h2>Release rights verification</h2><p>Listing publication is blocked until a fresh admin/Bigperson three-factor operation records immutable publication/distribution-rights evidence for the exact release.</p></div></div><div className="control-mutation-form"><label>Release<input value={rightsReleaseId} onChange={event=>setRightsReleaseId(event.target.value)} placeholder="Release UUID"/></label><label>Rights basis<select value={rightsBasis} onChange={event=>setRightsBasis(event.target.value as "first_party_original"|"seller_rights_reviewed"|"open_source_compatible")}><option value="first_party_original">first-party original</option><option value="seller_rights_reviewed">seller rights reviewed</option><option value="open_source_compatible">open-source compatible</option></select></label><label>License expression<input value={rightsLicenseExpression} onChange={event=>setRightsLicenseExpression(event.target.value)} placeholder="MIT or marketplace license identifier"/></label><label>Source evidence reference<input value={rightsSourceReference} onChange={event=>setRightsSourceReference(event.target.value)} placeholder="Repository / attestation / license evidence reference"/></label><label>Dependency evidence reference<input value={rightsDependencyReference} onChange={event=>setRightsDependencyReference(event.target.value)} placeholder="Lockfile/license scan evidence reference"/></label><label>Asset evidence reference<input value={rightsAssetReference} onChange={event=>setRightsAssetReference(event.target.value)} placeholder="Asset ownership/license review evidence reference"/></label><button className="button" disabled={busy||!mutationFactor||!rightsReleaseId||!rightsLicenseExpression||!rightsSourceReference||!rightsDependencyReference||!rightsAssetReference} onClick={()=>void verifyControlRights()}>Verify release rights</button></div><ControlRows rows={control.rights} columns={[{label:"Release",keys:["release_id"]},{label:"Basis",keys:["rights_basis"]},{label:"License",keys:["license_expression"]},{label:"Status",keys:["verification_status"]},{label:"Verified by",keys:["verified_by"]}]}/></section>
    <section className="control-split"><div><div className="hub-section-head"><div><h2>Releases</h2><p>Immutable published source provenance.</p></div></div><ControlRows rows={control.releases} columns={[{label:"Release",keys:["release_id"]},{label:"Version",keys:["version"]},{label:"Revision",keys:["source_revision_id"]},{label:"Status",keys:["status"]}]}/><ControlRows rows={control.promotions} columns={[{label:"Promotion",keys:["promotion_id"]},{label:"Result",keys:["result_id"]},{label:"Release",keys:["release_id"]},{label:"Version",keys:["version"]}]}/></div><div><div className="hub-section-head"><div><h2>Listing publication</h2><p>Publication is one-way and must bind to one promoted immutable release.</p></div></div><div className="control-mutation-form"><label>Promotion<input value={publicationPromotionId} onChange={event=>setPublicationPromotionId(event.target.value)} placeholder="Promotion UUID"/></label><label>Slug<input value={publicationSlug} onChange={event=>setPublicationSlug(event.target.value)} placeholder="project-slug"/></label><label>Title<input value={publicationTitle} onChange={event=>setPublicationTitle(event.target.value)} placeholder="Listing title"/></label><label>Summary<input value={publicationSummary} onChange={event=>setPublicationSummary(event.target.value)} placeholder="Truthful marketplace summary"/></label><button className="button" disabled={busy||!mutationFactor||!publicationPromotionId||!publicationSlug||!publicationTitle||!publicationSummary} onClick={()=>void publishControlListing()}>Publish Listing</button></div><ControlRows rows={control.listings} columns={[{label:"Listing",keys:["listing_id"]},{label:"Title",keys:["title"]},{label:"Status",keys:["status"]},{label:"Availability",keys:["availability"]}]}/><ControlRows rows={control.publications} columns={[{label:"Publication",keys:["publication_id"]},{label:"Promotion",keys:["promotion_id"]},{label:"Release",keys:["release_id"]},{label:"Published by",keys:["published_by"]}]}/></div></section>
    <section className="control-split"><div><div className="hub-section-head"><div><h2>Webcanbe Ready</h2><p>Status is computed on the server from the immutable release source with the canonical React compatibility analyzer. The browser cannot submit a Ready score or status.</p></div></div><div className="control-mutation-form"><label>Release<input value={readyReleaseId} onChange={event=>setReadyReleaseId(event.target.value)} placeholder="Promoted release UUID"/></label><label>Assessment result<input value={readyAssessmentResultId} onChange={event=>setReadyAssessmentResultId(event.target.value)} placeholder="Passed result UUID"/></label><label>Qualification version<input value={readyVersion} onChange={event=>setReadyVersion(event.target.value)} placeholder="ready-v1"/></label><button className="button" disabled={busy||!mutationFactor||!readyReleaseId||!readyAssessmentResultId||!readyVersion} onClick={()=>void qualifyControlReady()}>Derive & qualify Ready</button></div><ControlRows rows={control.ready} columns={[{label:"Release",keys:["release_id"]},{label:"Status",keys:["qualification_status"]},{label:"Version",keys:["qualification_version"]},{label:"Qualified by",keys:["qualified_by"]}]}/></div><div><div className="hub-section-head"><div><h2>Deploy intents</h2><p>Revision-bound deployment requests and state.</p></div></div><ControlRows rows={control.deployIntents} columns={[{label:"Intent",keys:["deploy_intent_id"]},{label:"Project",keys:["project_id"]},{label:"Status",keys:["status"]},{label:"Requested by",keys:["requested_by"]}]}/></div></section>
    </>}
    {controlView==="payments"&&<section className="control-section"><div className="hub-section-head"><div><h2>Payments & Payouts</h2><p>Requests can link here, but cases never perform refunds or payouts. Provider-backed payment and payout actions remain in their authoritative modules and retain their existing fresh authority requirements.</p></div></div><div className="rd-empty"><b>No combined payment operations view is exposed by this control read yet.</b><p>Use the maintained payment reconciliation and payout processes. This console does not invent a refund or Withdraw Now control.</p></div></section>}
    {controlView==="audit"&&<>
    <section className="control-section"><div className="hub-section-head"><div><h2>Privileged audit</h2><p>Append-only evidence for high-risk operations.</p></div></div><ControlRows rows={control.audit} columns={[{label:"Actor",keys:["actor_user_id"]},{label:"Action",keys:["action"]},{label:"Target",keys:["target_id"]},{label:"Transition",keys:["transition"]},{label:"Created",keys:["created_at"]}]}/></section>
    </>}
  </main></div>
}

const PUBLIC_ORIGIN = "https://webcanbe.com"
const BIGPERSON_CONTROL_PATH = "/_ops/keystone-7f31"

type RouteMetadata = Readonly<{ title: string; description: string; canonical?: string; noIndex?: boolean }>

function routeMetadata(path: string): RouteMetadata {
  const exact: Record<string, RouteMetadata> = {
    "/": { title: "Webcanbe — Edit visually. Leave with real code you own.", description: "Start from working web projects, edit the real source visually or in code, and keep the codebase.", canonical: "/" },
    "/browse": { title: "Marketplace — Webcanbe", description: "Browse working web projects with real source code, visual editing, code editing, and export.", canonical: "/browse" },
    "/templates": { title: "Marketplace — Webcanbe", description: "Browse working web projects with real source code, visual editing, code editing, and export.", canonical: "/browse" },
    "/plans": { title: "Plans — Webcanbe", description: "Compare Webcanbe plans for source-first web project editing and ownership.", canonical: "/plans" },
    "/pricing": { title: "Plans — Webcanbe", description: "Compare Webcanbe plans for source-first web project editing and ownership.", canonical: "/plans" },
    "/about": { title: "About — Webcanbe", description: "Learn why Webcanbe keeps real project source at the center of visual and code editing.", canonical: "/about" },
    "/changelog": { title: "Changelog — Webcanbe", description: "Product updates and changes to Webcanbe.", canonical: "/changelog" },
    "/contact": { title: "Contact — Webcanbe", description: "Contact Webcanbe.", canonical: "/contact" },
    "/updates": { title: "Updates — Webcanbe", description: "Webcanbe product and platform updates.", canonical: "/updates" },
    "/licenses": { title: "Licenses — Webcanbe", description: "Webcanbe licensing information.", canonical: "/licenses" },
    "/terms": { title: "Terms — Webcanbe", description: "Webcanbe terms of service.", canonical: "/terms" },
    "/policy": { title: "Privacy Policy — Webcanbe", description: "How Webcanbe handles account and product data.", canonical: "/policy" },
    "/privacy": { title: "Privacy Policy — Webcanbe", description: "How Webcanbe handles account and product data.", canonical: "/policy" },
  }
  if (exact[path]) return exact[path]
  const appRoute = Object.values(appRoutes).find(([route]) => route === path)
  if (appRoute) return { title: `${appRoute[1]} — Webcanbe`, description: "Your Webcanbe workspace.", noIndex: true }
  const legalMetadata:Record<string,string>={"/legal/terms":"/terms","/legal/privacy":"/policy","/legal/licenses":"/licenses"}
  if(legalMetadata[path]) return {...exact[legalMetadata[path]]}
  if(["/legal","/legal/acceptable-use","/legal/privacy-requests"].includes(path))return {title:"Legal — Webcanbe",description:"Webcanbe policies, acceptable use, and privacy requests.",canonical:path}
  if(path.startsWith("/contact/")&&contactTopics[path.split("/")[2]])return {title:contactTopics[path.split("/")[2]].title+" — Webcanbe",description:"Create a persisted Webcanbe request for help with your account, projects, or business.",canonical:path}
  if (path === "/docs" || path.startsWith("/docs/")) {
    if(!docPages[path]) return {title:"Page not found — Webcanbe",description:"This documentation page does not exist.",noIndex:true}
    const title = docPages[path].title
    return { title, description: docPages[path].description, canonical: path }
  }
  if (path.startsWith("/project/")) {
    if(path.endsWith("/acquire")) return {title:"Acquire project — Webcanbe",description:"Review acquisition for the selected release.",noIndex:true}
    const preview = path.endsWith("/preview")
    return { title: (preview ? "Project preview" : "Project") + " — Webcanbe", description: "Inspect a real source-backed Webcanbe project and its release details.", canonical: path }
  }
  return { title: "Webcanbe", description: "Source-first web projects with visual and code editing.", noIndex: true }
}

function syncRouteMetadata(path: string) {
  const meta = routeMetadata(path)
  document.title = meta.title

  const setMeta = (selector: string, attribute: "name" | "property", key: string, content: string) => {
    let node = document.head.querySelector<HTMLMetaElement>(selector)
    if (!node) {
      node = document.createElement("meta")
      node.setAttribute(attribute, key)
      document.head.appendChild(node)
    }
    node.content = content
  }

  setMeta('meta[name="description"]', "name", "description", meta.description)
  setMeta('meta[property="og:title"]', "property", "og:title", meta.title)
  setMeta('meta[property="og:description"]', "property", "og:description", meta.description)
  setMeta('meta[name="twitter:title"]', "name", "twitter:title", meta.title)
  setMeta('meta[name="twitter:description"]', "name", "twitter:description", meta.description)
  setMeta('meta[name="robots"]', "name", "robots", meta.noIndex ? "noindex, nofollow" : "index, follow")

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (meta.canonical) {
    if (!canonical) {
      canonical = document.createElement("link")
      canonical.rel = "canonical"
      document.head.appendChild(canonical)
    }
    canonical.href = PUBLIC_ORIGIN + meta.canonical
    setMeta('meta[property="og:url"]', "property", "og:url", canonical.href)
  } else {
    canonical?.remove()
    document.head.querySelector('meta[property="og:url"]')?.remove()
  }
}

function NotFound({path}:{path:string}){return <PublicShell><main className="not-found"><span className="signal">404</span><h1>This page does not exist.</h1><p><code>{path}</code> is not a Webcanbe route.</p><div><Link className="button primary" to="/">Back home</Link><Link className="button" to="/browse">Marketplace</Link></div></main></PublicShell>}

class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Worker/API failures carry request IDs server-side. Avoid logging user data here.
  }
  render() {
    if (!this.state.failed) return this.props.children
    return <PublicShell><main className="not-found"><span className="signal">500</span><h1>Something went wrong.</h1><p>Webcanbe could not finish rendering this page.</p><div><button className="button primary" type="button" onClick={()=>window.location.reload()}>Try again</button><Link className="button" to="/">Back home</Link></div></main></PublicShell>
  }
}
export default function App() {
  const path=usePath(),directAuth=path==="/login"||path==="/signup",directNext=authNext()
  const [authIntent,setAuthIntent]=useState<{signup:boolean;next:string}|null>(directAuth?{signup:path==="/signup",next:directNext}:null)
  // Install before protected children run passive effects on direct navigation.
  useLayoutEffect(()=>{const h=(e:Event)=>{const d=(e as CustomEvent<{signup?:boolean;next?:unknown}>).detail;setAuthIntent({signup:Boolean(d?.signup),next:authNext(d?.next)})};window.addEventListener("wcb:open-auth",h);return()=>window.removeEventListener("wcb:open-auth",h)},[])
  useEffect(()=>{if(directAuth)setAuthIntent({signup:path==="/signup",next:directNext})},[directAuth,path,directNext])
  useEffect(()=>{syncRouteMetadata(path)},[path])
  useEffect(() => {
    if (path === "/browse" || path === "/marketplace") analytics.capture("wcb_marketplace_viewed", { source: "marketplace" })
    if (path.startsWith("/project/")) {
      const reference = path.split("/")[2]
      const project = projects.find(item => item.slug === reference || item.id === reference)
      if (project) analytics.capture("wcb_project_viewed", { listing_id: project.id, source: "marketplace" })
    }
  }, [path])
  const basePath=directAuth?"/":path;let page:React.ReactNode
  if(basePath==="/__wcb_preview_runtime")page=<Suspense fallback={<main/>}><PreviewRuntimeHost/></Suspense>
  else if(basePath==="/")page=<Landing/>
  else if(basePath==="/browse"||basePath==="/templates")page=<Browse key={window.location.search}/>
  else if(basePath==="/creators")page=<CreatorIntroduction/>
  else if(basePath.startsWith("/creators/"))page=<CreatorProfile handle={basePath.split("/")[2]||""}/>
  else if(basePath.startsWith("/project/")&&basePath.endsWith("/preview"))page=<ProjectPreviewPage key={basePath} reference={basePath.split("/")[2]||""}/>
  else if(basePath.startsWith("/project/"))page=<Detail key={basePath} reference={basePath.split("/")[2]??""}/>
  else if(basePath==="/docs"||basePath.startsWith("/docs/"))page=<Documentation path={basePath}/>
  else if(basePath==="/legal"||basePath.startsWith("/legal/"))page=<PublicSite path={basePath}/>
  else if(basePath.startsWith("/contact/"))page=<PublicInfo path={basePath}/>
  else if(["/changelog","/about","/contact","/updates","/github","/licenses","/terms","/policy","/privacy"].includes(basePath))page=<InfoPage path={basePath}/>
  else if(basePath==="/auth/complete")page=<AuthComplete/>
  else if(basePath===GATE2_AUTH_SMOKE_PATH)page=<Gate2AuthSmoke/>
  else if(basePath.startsWith("/checkout/"))page=<Protected><Checkout/></Protected>
  else if(basePath.startsWith("/workspace/"))page=<Protected><Suspense fallback={<main className="route-gate" role="status" aria-live="polite" aria-busy="true"><LoadingSpinner/><span className="signal">Workspace</span><p>Loading editor…</p></main>}><CompatibleWorkspace/></Suspense></Protected>
  else if(basePath==="/projects")page=<Protected><Projects/></Protected>
  else if(basePath==="/purchases")page=<Protected><Purchases/></Protected>
  else if(basePath==="/requests")page=<Protected><MyRequests/></Protected>
  else if(basePath==="/dashboard-preview")page=productionAuthMode()?<NotFound path={basePath}/>:<Dashboard/>
  else if(basePath==="/dashboard")page=<Protected><Dashboard/></Protected>
  else if(basePath==="/marketplace")page=<Browse/>
  else if(basePath!=="/seller" && Object.values(appRoutes).some(([route])=>route===basePath))page=<Protected><Dashboard key={basePath} initialView={viewForPath(basePath)}/></Protected>
  else if(basePath==="/settings")page=<Protected><Settings/></Protected>
  else if(basePath==="/plans"||basePath==="/pricing")page=<Plans/>
  else if(basePath==="/seller"||basePath.startsWith("/seller/"))page=<Protected><Suspense fallback={<main aria-busy="true"/>}><CreatorEnvironment path={basePath}/></Suspense></Protected>
  else if(basePath===BIGPERSON_CONTROL_PATH)page=<Protected><Control/></Protected>
  else page=<NotFound path={basePath}/>
  const closeAuth=()=>{setAuthIntent(null);if(directAuth){window.history.replaceState({},"","/");window.dispatchEvent(new PopStateEvent("popstate"))}}
  return <AppErrorBoundary>{page}{authIntent&&<Auth signup={authIntent.signup} next={authIntent.next} onClose={closeAuth}/>}</AppErrorBoundary>
}
