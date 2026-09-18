import { useEffect, useMemo, useState } from "react"
import { LayoutDashboard, Store, FolderKanban, ShoppingBag, PanelsTopLeft, BookOpen, Settings2, ChevronDown, Search, Bell, UserRound, Github, Phone, X, FileCode2, History, PackageCheck, Sparkles, Plus, CircleHelp, ShieldCheck, ScrollText } from "lucide-react"
import Home from "./Home"
import "./app.css"
import CompatibleWorkspace from "./webcanbe-engine/visual-editor/CompatibleWorkspace"
import { hostedProductClient, hostedProductMode, type ControlData, type CreatorStudioData, type HostedListing, type HostedListingDetail, type SourceProjectSummary } from "./hostedProductClient"
import type { LicenseEntitlement, WorkspaceProject } from "./webcanbe-engine/runtime/productDomain"

type Project = { id: string; slug: string; title: string; tagline: string; price: number; stack: string[]; category: string; color: string; creator: string; updated: string; releaseId?: string }

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
  return { id: listing.listingId, slug: listing.slug, title: listing.title, tagline: listing.summary, price: typeof demo.price === "number" && Number.isFinite(demo.price) ? demo.price : 0, stack: listing.tags.length ? listing.tags : ["React", "Vite"], category: metadataText(detail.category ?? demo.category, "Project"), color: metadataText(demo.color, colors[index % colors.length]), creator: metadataText(detail.creator ?? demo.creator, "WebCanBe creator"), updated: `Release ${listing.releaseVersion}`, releaseId: listing.releaseId }
}

function usePath() {
  const [path, setPath] = useState(window.location.pathname)
  useEffect(() => { const update = () => setPath(window.location.pathname); window.addEventListener("popstate", update); return () => window.removeEventListener("popstate", update) }, [])
  return path
}

let routeTimer: number | undefined
function go(to: string) {
  if (to.startsWith("/login") || to.startsWith("/signup")) {
    window.dispatchEvent(new CustomEvent("wcb:open-auth", { detail: { signup: to.startsWith("/signup") } }))
    return
  }
  const current = window.location.pathname + window.location.search
  if (to === current) return
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
function Mark() { return <span className="mark" aria-label="WebCanBe"><i/><i/><i/></span> }
function Arrow() { return <span className="arrow">↗</span> }

function Landing() { return <Home /> }

const publicNav: string[][] = []
const appNav = [["Dashboard", "/dashboard"], ["My projects", "/projects"], ["Purchases", "/purchases"], ["Marketplace", "/browse"]]

function PublicShell({ children, active }: { children: React.ReactNode; active?: string }) {
  const hosted = hostedProductMode(), [menu, setMenu] = useState(false), [signedIn, setSignedIn] = useState(!hosted)
  useEffect(() => {
    if (!hosted) return
    let current = true
    void hostedProductClient.authenticated().then(value => { if (current) setSignedIn(value) })
    return () => { current = false }
  }, [hosted])
  return <div className="product public-product"><header className="product-header public-header"><Link to="/" className="brand"><Mark/> <span>WebCanBe</span></Link><nav>{publicNav.map(([n,p]) => <Link key={p} to={p} className={active === p ? "active" : ""}>{n}</Link>)}</nav><div className="header-actions">{signedIn ? <Link to="/dashboard" className="button compact public-open-app">Open app</Link> : <><Link to="/login" className="quiet-link">Log in</Link><Link to="/signup" className="button primary compact">Get started</Link></>}<button className="mobile-menu" onClick={() => setMenu(!menu)}>Menu</button></div>{menu && <div className="mobile-nav">{publicNav.map(([n,p]) => <Link key={p} to={p}>{n}</Link>)}{signedIn ? <Link to="/dashboard">Open app</Link> : <><Link to="/login">Log in</Link><Link to="/signup">Get started</Link></>}</div>}</header>{children}</div>
}

function AppShell({ children, active, onSectionChange }: { children: React.ReactNode; active?: string; onSectionChange?: (section: string) => void }) {
  const [menu, setMenu] = useState(false)
  const action = (id: string, to: string, label: string, Icon: typeof LayoutDashboard) => onSectionChange
    ? <button type="button" className={active === id ? "active" : ""} onClick={() => onSectionChange(id)}><Icon/><span>{label}</span></button>
    : <Link to={to} className={active === to ? "active" : ""}><Icon/><span>{label}</span></Link>
  return <div className="product app-frame rope-app">
    <aside className={`app-sidebar rope-sidebar ${menu ? "open" : ""}`}>
      <div className="rope-sidebar-head"><Link to="/dashboard" className="brand app-sidebar-brand"><Mark/><span><b>WebCanBe</b><small>Source-first workspace</small></span></Link></div>
      <div className="rope-sidebar-scroll">
        <div className="rope-nav-group"><span className="rope-nav-label">General</span><nav className="rope-nav-list">
          {action("overview","/dashboard","Dashboard",LayoutDashboard)}
          {action("marketplace","/browse","Marketplace",Store)}
        </nav></div>
        <details open className="rope-nav-group rope-nav-collapsible"><summary><PanelsTopLeft/><span>Workspace</span><ChevronDown/></summary><div className="rope-subnav">
          {action("projects","/projects","My projects",FolderKanban)}
          {action("purchases","/purchases","Purchases",ShoppingBag)}
        </div></details>
        <details open className="rope-nav-group rope-nav-collapsible"><summary><PackageCheck/><span>Creator</span><ChevronDown/></summary><div className="rope-subnav">
          {action("creator","/seller","Creator Studio",Sparkles)}
          {action("listings","/seller/projects","Listings",FolderKanban)}
          {action("submission","/seller/projects/new","New submission",Plus)}
        </div></details>
        <details open className="rope-nav-group rope-nav-collapsible"><summary><CircleHelp/><span>Other</span><ChevronDown/></summary><div className="rope-subnav">
          {action("docs","/docs","Documentation",BookOpen)}
          {action("plans","/plans","Plans",ScrollText)}
          {action("settings","/settings","Settings",Settings2)}
          {action("control","/control","Control",ShieldCheck)}
        </div></details>
      </div>
      <div className="app-sidebar-account rope-account">{onSectionChange ? <button type="button" onClick={() => onSectionChange("settings")}><span className="avatar">WC</span><span><b>WebCanBe account</b><small>Settings</small></span></button> : <Link to="/settings"><span className="avatar">WC</span><span><b>WebCanBe account</b><small>Settings</small></span></Link>}</div>
    </aside>
    <div className="app-main rope-main">
      <header className="rope-topbar">
        <button className="rope-mobile-trigger" onClick={() => setMenu(value => !value)} aria-expanded={menu}>Menu</button>
        <button className="rope-sidebar-toggle" type="button" aria-label="Sidebar"><PanelsTopLeft/></button>
        <div className="rope-top-tabs">
          {onSectionChange ? <>
            <button className={active === "overview" ? "active" : ""} onClick={() => onSectionChange("overview")}>Overview</button>
            <button className={active === "projects" ? "active" : ""} onClick={() => onSectionChange("projects")}>Projects</button>
            <button className={active === "marketplace" ? "active" : ""} onClick={() => onSectionChange("marketplace")}>Marketplace</button>
            <button className={active === "settings" ? "active" : ""} onClick={() => onSectionChange("settings")}>Settings</button>
          </> : <span className="active">WebCanBe</span>}
        </div>
        <div className="rope-topbar-actions"><button className="rope-search" type="button"><Search/><span>Search</span><kbd>⌘K</kbd></button><button className="rope-icon-button" type="button" aria-label="Notifications"><Bell/></button><button className="rope-user-button" type="button"><span className="avatar">WC</span></button></div>
      </header>
      {children}
    </div>
    {menu && <button className="app-sidebar-scrim" aria-label="Close navigation" onClick={() => setMenu(false)}/>}
  </div>
}

function Protected({ children }: { children: React.ReactNode }) {
  const hosted = hostedProductMode(), [state, setState] = useState<"checking" | "allowed">(hosted ? "checking" : "allowed")
  useEffect(() => {
    if (!hosted) return
    let current = true
    void hostedProductClient.authenticated().then(ok => {
      if (!current) return
      if (ok) setState("allowed")
      else go(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`)
    })
    return () => { current = false }
  }, [hosted])
  if (state !== "allowed") return <main className="route-gate"><span className="signal">Account</span><p>Checking your session…</p></main>
  return <>{children}</>
}

function Preview({ project, large = false }: { project: Project; large?: boolean }) {
  return <div className={`project-preview ${project.color} ${large ? "large" : ""}`}><div className="preview-nav"><span>{project.title}</span><span>Index&nbsp;&nbsp; About&nbsp;&nbsp; Contact</span></div><div className="preview-body"><p>{project.category}</p><h3>{project.title}<br/>made to be <em>used.</em></h3><div className="preview-orb"/></div><div className="preview-foot"><span>Scroll to explore</span><span>01 — 04</span></div></div>
}
function ProjectCard({ project }: { project: Project }) { return <article className="project-card"><Link to={`/project/${project.slug}`}><Preview project={project}/></Link><div className="card-meta"><div><Link className="project-title" to={`/project/${project.slug}`}>{project.title}</Link><p>{project.tagline}</p></div><strong>${project.price}</strong></div><div className="stacks">{project.stack.map(x => <span key={x}>{x}</span>)}</div></article> }

function Browse() {
  const [query, setQuery] = useState(""); const [category, setCategory] = useState("All projects")
  const hosted = hostedProductMode(), [catalog, setCatalog] = useState<Project[]>([]), [catalogMessage, setCatalogMessage] = useState(hosted ? "Loading projects…" : "")
  const categories = ["All projects", "Marketing", "Commerce", "SaaS", "Editorial", "Directory"]
  const local = useMemo(() => projects.filter(p => (category === "All projects" || p.category === category) && `${p.title} ${p.tagline} ${p.stack.join(" ")}`.toLowerCase().includes(query.toLowerCase())), [query, category])
  useEffect(() => {
    if (!hosted) return
    let current = true
    setCatalogMessage("Loading projects…")
    void hostedProductClient.browse({ ...(query.trim() ? { query } : {}), ...(category === "All projects" ? {} : { tags: [category] }), limit: 100 }).then(listings => {
      if (current) { setCatalog(listings.map(hostedProject)); setCatalogMessage("") }
    }, error => { if (current) { setCatalog([]); setCatalogMessage(error instanceof Error ? error.message : "Catalog unavailable.") } })
    return () => { current = false }
  }, [hosted, query, category])
  const filtered = hosted ? catalog : local
  return <PublicShell><main className="browse"><section className="browse-hero"><div><span className="signal">Marketplace</span><h1>Start from<br/><em>something real.</em></h1></div><p>Working web projects, ready to open, change, and make your own. The source code is always yours.</p></section><section className="browse-controls"><label className="search"><span>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search projects, stacks, or styles"/></label><div className="filters">{categories.map(c => <button onClick={() => setCategory(c)} className={category === c ? "selected" : ""} key={c}>{c}</button>)}</div></section><section className="browse-heading"><p>{catalogMessage || `${filtered.length} working projects`}</p><button className="sort">Recently updated <span>↓</span></button></section><section className="project-grid">{filtered.map(p => <ProjectCard project={p} key={p.id}/>)}</section></main></PublicShell>
}

function Detail({ reference }: { reference: string }) {
  const hosted = hostedProductMode(), fallback = projects.find(project => project.slug === reference) ?? projects[0]
  const [project, setProject] = useState<Project | undefined>(hosted ? undefined : fallback), [tab, setTab] = useState("Overview"), [message, setMessage] = useState(hosted ? "Loading project…" : ""), [buying, setBuying] = useState(false)
  useEffect(() => {
    if (!hosted) { setProject(fallback); return }
    let current = true
    void hostedProductClient.detail(reference).then(listing => { if (current) { setProject(hostedProject(listing)); setMessage("") } }, error => { if (current) setMessage(error instanceof Error ? error.message : "Project unavailable.") })
    return () => { current = false }
  }, [hosted, reference])
  if (!project) return <PublicShell><main className="detail"><div className="crumb"><Link to="/browse">Marketplace</Link><span>/</span><span>{message}</span></div></main></PublicShell>
  const checkoutTarget = `/checkout/${encodeURIComponent(project.releaseId ?? project.id)}?project=${encodeURIComponent(project.slug)}`
  const buy = async () => {
    if (buying) return
    setBuying(true)
    if (!hosted) { go(`/login?next=${encodeURIComponent(checkoutTarget)}`); return }
    const signedIn = await hostedProductClient.authenticated()
    go(signedIn ? checkoutTarget : `/login?next=${encodeURIComponent(checkoutTarget)}`)
  }
  return <PublicShell><main className="detail"><div className="crumb"><Link to="/browse">Marketplace</Link><span>/</span><span>{project.title}</span></div><section className="detail-top"><div><div className="project-eyebrow">{project.category} project <span>•</span> by {project.creator}</div><h1>{project.title}</h1><p>{project.tagline} Built as a working project, not a static download.</p><div className="detail-actions"><button className="button primary" disabled={buying} onClick={() => void buy()}>{buying ? "Continuing…" : `Buy project — $${project.price}`} <Arrow/></button><button className="button">Preview project</button></div>{message && <p role="status">{message}</p>}</div><aside className="price-box"><span>One-time project price</span><strong>${project.price}</strong><p>Includes the entire codebase. Export is yours on every plan.</p></aside></section><Preview project={project} large/><div className="detail-content"><section><div className="tabs">{["Overview", "What’s included", "Project structure"].map(t => <button className={tab === t ? "active" : ""} onClick={() => setTab(t)} key={t}>{t}</button>)}</div>{tab === "Overview" && <div className="copy-block"><h2>A project you can keep building.</h2><p>{project.title} comes with actual routes, components, styles, and content structure. Open it in the visual workspace, edit the source, or do both — changes flow through the same files.</p><div className="two-col"><div><span>Made for</span><p>Founders and small teams who want a considered starting point without giving up the code.</p></div><div><span>Compatibility</span><p>Visual editor enabled. Standard file structure. Works in any normal local development flow.</p></div></div></div>}{tab === "What’s included" && <ul className="included"><li>Complete source code and project configuration</li><li>Responsive pages and reusable components</li><li>Visual editing compatibility</li><li>Clear README and local setup notes</li></ul>}{tab === "Project structure" && <div className="file-tree"><span>▾ app</span><span className="indent">▾ (marketing)</span><span className="indent-2">page.tsx</span><span className="indent">layout.tsx</span><span>▾ components</span><span className="indent">Hero.tsx</span><span className="indent">Navigation.tsx</span><span>styles.css</span></div>}</section><aside className="specs"><h3>Project details</h3><dl><div><dt>Stack</dt><dd>{project.stack.join(", ")}</dd></div><div><dt>Last updated</dt><dd>{project.updated}</dd></div><div><dt>Editing</dt><dd>Visual + code + AI</dd></div><div><dt>License</dt><dd>Commercial use</dd></div></dl></aside></div></main></PublicShell>
}

function authNext() {
  const value = new URLSearchParams(window.location.search).get("next")
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard"
}

function Auth({ signup = false, onClose }: { signup?: boolean; onClose?: () => void }) {
  const _hostedBoundary = async () => hostedProductClient.authStart()
  void _hostedBoundary
  return <div className="auth-demo-layer" data-auth-note="Email/password is not enabled by the current hosted identity boundary.">
    <div className="auth-demo-backdrop"/>
    <section className="auth-demo-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <button className="auth-demo-close" type="button" aria-label="Close" onClick={onClose}><X/></button>
      <h1 id="auth-title">Log in or sign up</h1>
      <p>Get smarter responses, upload files and images, and more.</p>
      <div className="auth-demo-actions">
        <button className="auth-demo-provider" type="button"><span className="google-g" aria-hidden="true">G</span><span>Continue with Google</span></button>
        <button className="auth-demo-provider" type="button"><Github/><span>Continue with GitHub</span></button>
        <button className="auth-demo-provider" type="button"><Phone/><span>Continue with phone</span></button>
      </div>
      <div className="auth-demo-divider"><span>OR</span></div>
      <input className="auth-demo-email" type="email" placeholder="Email address" aria-label="Email address"/>
      <button className="auth-demo-continue" type="button">Continue</button>
      <p className="auth-demo-terms">By continuing, you agree to our Terms of Use and acknowledge our Privacy Policy.</p>
    </section>
  </div>
}

const docPages: Record<string, { title: string; eyebrow: string; intro: string; sections: { title: string; body: string }[] }> = {
  "/docs": { title: "Introduction", eyebrow: "Getting Started", intro: "WebCanBe is a source-first marketplace and browser workspace for real web projects.", sections: [
    { title: "The source is the product", body: "Visual, Code, Split, history, export, and future AI edits stay attached to the same working project source and revision." },
    { title: "Start from something real", body: "Marketplace listings point to versioned project releases. A purchase can become your own editable working copy without mutating the published release." },
    { title: "Own the code", body: "Export stays part of the product contract. The project should continue as a normal codebase outside WebCanBe." },
  ]},
  "/docs/getting-started": { title: "Getting started", eyebrow: "Getting Started", intro: "Move from marketplace release to editable project without introducing a second source of truth.", sections: [
    { title: "1. Browse", body: "Open Marketplace and inspect a working project release." },
    { title: "2. Create a working copy", body: "Your editable copy is created from the immutable release you selected." },
    { title: "3. Edit", body: "Use Visual, Code, or Split. Changes operate against the same project source." },
  ]},
  "/docs/customization": { title: "Customization", eyebrow: "Getting Started", intro: "Change appearance and structure while the project source remains authoritative.", sections: [
    { title: "Visual edits", body: "Use the visual workspace for layout, spacing, type, and supported style changes." },
    { title: "Code edits", body: "Open source directly when the visual layer is not the right tool for the change." },
  ]},
  "/docs/marketplace": { title: "Marketplace", eyebrow: "Product", intro: "Browse immutable releases of working web projects.", sections: [
    { title: "Listings", body: "Listings expose bounded public metadata and point to a specific release." },
    { title: "Release integrity", body: "A published release does not silently change underneath a purchase." },
  ]},
  "/docs/visual-editor": { title: "Visual editor", eyebrow: "Workspace", intro: "Edit the interface without replacing the underlying source with a proprietary canvas.", sections: [
    { title: "Source-backed selection", body: "Visual selections resolve to source-backed targets in the working revision." },
    { title: "Minimal patches", body: "Visual changes should produce minimal source edits and then reparse the project." },
  ]},
  "/docs/code-editor": { title: "Code editor", eyebrow: "Workspace", intro: "Open and edit the actual source in the same workspace.", sections: [
    { title: "Same project", body: "Code mode is not a generated copy of the visual project. It is the same working source." },
    { title: "Split mode", body: "Preview and source can stay side by side without introducing another canonical representation." },
  ]},
  "/docs/export": { title: "Export", eyebrow: "Ownership", intro: "Leave with the project source you have been editing.", sections: [
    { title: "Portable by design", body: "The exported project should continue in a normal local development workflow." },
    { title: "No runtime lock-in", body: "WebCanBe is not meant to remain in the runtime for the exported project to work." },
  ]},
  "/docs/compatibility": { title: "Compatibility", eyebrow: "Reference", intro: "Compatibility is explicit instead of being hidden behind conversion.", sections: [
    { title: "Current focus", body: "React/Vite projects with JSX or TSX, CSS, CSS Modules, inline styles, Flex, Grid, and Tailwind are the main target." },
    { title: "Separate dimensions", body: "Runtime support, visual editability, verification, security admission, export, and hosted readiness are tracked separately." },
  ]},
  "/docs/security": { title: "Security", eyebrow: "Reference", intro: "Uploaded projects and hosted operations stay behind explicit authority boundaries.", sections: [
    { title: "Admission", body: "Uploaded package scripts, plugins, lifecycle hooks, and arbitrary installs are not executed during admission." },
    { title: "Authority", body: "Session, project, revision, and privileged operation boundaries are enforced server-side." },
  ]},
}

const docsNav = [
  ["Getting Started", [["Introduction","/docs"],["Getting started","/docs/getting-started"],["Customization","/docs/customization"]]],
  ["Product", [["Marketplace","/docs/marketplace"],["Visual editor","/docs/visual-editor"],["Code editor","/docs/code-editor"],["Export","/docs/export"]]],
  ["Reference", [["Compatibility","/docs/compatibility"],["Security","/docs/security"],["Changelog","/changelog"]]],
] as const

function Documentation({ path }: { path: string }) {
  const page = docPages[path] ?? docPages["/docs"]
  return <main className="docs-page">
    <header className="docs-topbar"><Link to="/" className="brand"><Mark/><span>WebCanBe</span></Link><nav><Link to="/docs">Docs</Link><Link to="/browse">Marketplace</Link><Link to="/dashboard">Dashboard</Link></nav></header>
    <div className="docs-layout">
      <aside className="docs-sidebar">{docsNav.map(([group,items]) => <section key={group}><h3>{group}</h3>{items.map(([label,href]) => <Link key={href} to={href} className={path === href ? "active" : ""}>{label}</Link>)}</section>)}</aside>
      <article className="docs-content"><div className="docs-breadcrumb">Docs <span>/</span> {page.eyebrow}</div><h1>{page.title}</h1><p className="docs-lead">{page.intro}</p>{page.sections.map(section => <section key={section.title}><h2>{section.title}</h2><p>{section.body}</p></section>)}<div className="docs-help"><b>Need help?</b><p>Use the project repository or contact WebCanBe.</p><div><a href="mailto:hello@webcanbe.com">Email</a><a href="https://github.com/Webcanbe/webcanbe-real" target="_blank" rel="noreferrer">GitHub</a></div></div></article>
      <aside className="docs-toc"><span>On this page</span>{page.sections.map(section => <a key={section.title} href="#">{section.title}</a>)}</aside>
    </div>
  </main>
}

const infoPages: Record<string, { eyebrow: string; title: string; intro: string; items: { title: string; body: string }[] }> = {
  "/changelog": { eyebrow:"Resources", title:"Changelog", intro:"Product UI and platform changes for WebCanBe.", items:[{title:"Phase 4",body:"Final product UX, landing, auth demo, dashboard shell, documentation, and app-wide UI polish."},{title:"Phase 3",body:"Hosted product domain, marketplace, purchases, Creator Studio, releases, and control surfaces."}] },
  "/about": { eyebrow:"Company", title:"About WebCanBe", intro:"A source-first way to start from working web projects and keep the code.", items:[{title:"Principle",body:"Do not hide the code. Edit the code visually."},{title:"Ownership",body:"The source remains the product, not a proprietary canvas."}] },
  "/contact": { eyebrow:"Company", title:"Contact", intro:"Questions about WebCanBe, creator publishing, or the product.", items:[{title:"Email",body:"hello@webcanbe.com"},{title:"Repository",body:"github.com/Webcanbe/webcanbe-real"}] },
  "/updates": { eyebrow:"Resources", title:"Updates", intro:"Product changes and release notes.", items:[{title:"Current",body:"Phase 4 UI finalization is in progress."}] },
  "/licenses": { eyebrow:"Legal", title:"Licenses", intro:"Open-source and third-party notices used by WebCanBe.", items:[{title:"Project dependencies",body:"Third-party packages retain their own licenses and notices."}] },
  "/terms": { eyebrow:"Legal", title:"Terms of Use", intro:"Demo terms page for the Phase 4 UI.", items:[{title:"Status",body:"Final commercial terms are not published in this UI phase."}] },
  "/privacy": { eyebrow:"Legal", title:"Privacy", intro:"Demo privacy page for the Phase 4 UI.", items:[{title:"Status",body:"Final production privacy disclosures belong to launch hardening."}] },
}

function InfoPage({ path }: { path: string }) {
  const page = infoPages[path] ?? infoPages["/about"]
  return <PublicShell><main className="info-page"><span className="signal">{page.eyebrow}</span><h1>{page.title}</h1><p className="info-lead">{page.intro}</p><section className="info-grid">{page.items.map(item => <article key={item.title}><h2>{item.title}</h2><p>{item.body}</p></article>)}</section></main></PublicShell>
}

function AuthComplete() {
  const [message, setMessage] = useState("Finishing sign-in…")
  useEffect(() => {
    let current = true
    void hostedProductClient.authenticated().then(ok => {
      if (!current) return
      if (!ok) { setMessage("Your sign-in session could not be verified."); window.setTimeout(() => go("/login"), 300); return }
      let next = "/dashboard"
      try {
        const stored = sessionStorage.getItem("wcb-auth-next")
        sessionStorage.removeItem("wcb-auth-next")
        if (stored && stored.startsWith("/") && !stored.startsWith("//")) next = stored
      } catch { /* Session storage is convenience-only; safe dashboard fallback remains. */ }
      setMessage("Signed in. Continuing…")
      go(next)
    }).catch(() => { if (current) { setMessage("Your sign-in session could not be verified."); window.setTimeout(() => go("/login"), 300) } })
    return () => { current = false }
  }, [])
  return <main className="auth-complete" role="status"><Mark/><span className="signal">Account</span><h1>{message}</h1></main>
}

function Checkout() {
  const params = new URLSearchParams(window.location.search), reference = params.get("project") ?? "", hosted = hostedProductMode()
  const fallback = projects.find(item => item.slug === reference)
  const [project, setProject] = useState<Project | undefined>(hosted ? undefined : fallback), [message, setMessage] = useState(hosted ? "Loading order…" : "")
  useEffect(() => {
    if (!hosted || !reference) return
    let current = true
    void hostedProductClient.detail(reference).then(listing => { if (current) { setProject(hostedProject(listing)); setMessage("") } }, reason => { if (current) setMessage(reason instanceof Error ? reason.message : "Order details are unavailable.") })
    return () => { current = false }
  }, [hosted, reference])
  const price = project?.price ?? 0
  return <main className="checkout-page"><header className="checkout-header"><Link to="/" className="brand"><Mark/><span>WebCanBe</span></Link><Link to={project ? `/project/${project.slug}` : "/browse"}>Back to project</Link></header><section className="checkout-layout"><div className="checkout-main"><span className="signal">Checkout</span><h1>{message || "Complete your purchase."}</h1><p>Your account is ready. Payment is the next boundary: WebCanBe must not create an entitlement until the payment provider confirms the transaction.</p><div className="checkout-provider-placeholder"><strong>Card checkout</strong><p>The real card-first provider connection belongs to Phase 5. This Phase 4 surface defines the correct flow without pretending a payment happened.</p><button className="button primary" disabled>{price ? `Pay $${price}` : "Pay"}</button></div></div><aside className="checkout-summary"><span>Order summary</span><h2>{project?.title ?? "Selected project"}</h2><p>{project?.tagline ?? "The selected immutable release will be bound to the completed purchase."}</p><dl><div><dt>Project</dt><dd>{price ? `$${price}` : "—"}</dd></div><div><dt>Total</dt><dd>{price ? `$${price}` : "—"}</dd></div></dl><small>Successful payment → entitlement → Dashboard. From there, create or open the editable working copy.</small></aside></section></main>
}

function Workspace() { const [mode, setMode] = useState("Visual"); const [selected, setSelected] = useState("Hero.tsx"); const [prompt, setPrompt] = useState(""); const [sent, setSent] = useState(false); return <main className="workspace"><header className="workspace-top"><Link to="/projects" className="brand"><Mark/><span>WebCanBe</span></Link><div className="workspace-name"><span className="dot"/> Northstar Studio <span className="slash">/</span> <small>All changes saved</small></div><div className="workspace-actions"><button>Share</button><button>Export code</button><button className="workspace-publish">Publish</button></div></header><div className="workspace-body"><aside className="workspace-files"><div className="files-head"><span>Files</span><button>＋</button></div><div className="file-list"><b>▾ app</b><button className={selected === "page.tsx" ? "on" : ""} onClick={() => setSelected("page.tsx")}>⌘ page.tsx</button><b>▾ components</b><button className={selected === "Hero.tsx" ? "on" : ""} onClick={() => setSelected("Hero.tsx")}>⌘ Hero.tsx</button><button className={selected === "Navigation.tsx" ? "on" : ""} onClick={() => setSelected("Navigation.tsx")}>⌘ Navigation.tsx</button><button className={selected === "Manifesto.tsx" ? "on" : ""} onClick={() => setSelected("Manifesto.tsx")}>⌘ Manifesto.tsx</button><b>▾ styles</b><button className={selected === "globals.css" ? "on" : ""} onClick={() => setSelected("globals.css")}># globals.css</button></div><div className="files-bottom"><Link to="/projects">← Back to projects</Link></div></aside><section className="workspace-main"><div className="workspace-tabs"><div>{["Visual", "Code", "Preview"].map(x => <button key={x} onClick={() => setMode(x)} className={mode === x ? "active" : ""}>{x}</button>)}</div><span>Desktop <b>⌄</b></span></div><div className="workspace-stage">{mode === "Visual" && <div className="canvas"><div className="canvas-toolbar"><button>↖ Select</button><button>Text</button><button>Frame</button><button>◫</button></div><div className="canvas-page"><div className="mini-header"><b>NORTHSTAR</b><span>Work&nbsp;&nbsp; Studio&nbsp;&nbsp; Journal</span></div><div className="mini-hero"><p>Independent design<br/>for <em>useful things.</em></p><div className="mini-image"/><span className="selection-label">Hero.tsx</span><span className="selection-handle a"/><span className="selection-handle b"/></div><div className="mini-copy">We create identities, tools, and places for people making a more thoughtful world.</div></div></div>}{mode === "Code" && <CodePane file={selected}/>} {mode === "Preview" && <div className="preview-browser"><div className="browser-bar"><i/><i/><i/><span>northstar.local</span></div><div className="site-full"><div className="mini-header"><b>NORTHSTAR</b><span>Work&nbsp;&nbsp; Studio&nbsp;&nbsp; Journal</span></div><div className="mini-hero"><p>Independent design<br/>for <em>useful things.</em></p><div className="mini-image"/></div></div></div>}</div></section><aside className="workspace-ai"><div className="ai-head"><span>Project changes</span><span className="same-files">Same files</span></div><div className="change-note"><span className="dot"/>Visual edit</div><p className="ai-copy">The selected hero is linked to <b>components/Hero.tsx</b>. Move it here, and its source changes too.</p><div className="ai-thread">{sent ? <><span className="you">You</span><p>{prompt}</p><span className="assistant-label">WebCanBe</span><p>Drafted a change to <b>{selected}</b>. Review it in the code panel before keeping it.</p></> : <><span className="assistant-label">WebCanBe</span><p>Ask for a change. It will be made in this project — not a separate preview.</p></>}</div><div className="ai-input"><textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Ask for a change..."/><button disabled={!prompt} onClick={() => { setSent(true); setPrompt("") }}>↑</button></div></aside></div></main> }

function CodePane({ file }: { file: string }) { const lines = ["import { Arrow } from \"./Arrow\"", "", "export default function Hero() {", "  return (", "    <section className=\"hero\">", "      <p className=\"eyebrow\">Northstar Studio</p>", "      <h1>Independent design for", "        <em>useful things.</em>", "      </h1>", "      <div className=\"hero-image\" />", "    </section>", "  )", "}"]; return <div className="code-pane"><div className="code-file">{file}</div><pre>{lines.map((l,i) => <code key={i}><i>{i + 1}</i>{l}</code>)}</pre></div> }

function useProductLibrary() {
  const hosted = hostedProductMode()
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
  return catalog.find(project => project.releaseId === releaseId) ?? { ...projects[0], id: fallbackId, slug: fallbackId, title, tagline: "A working copy with retained release provenance.", price: 0, category: "Project", creator: "WebCanBe creator", updated: "Release retained" }
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
  const [working, setWorking] = useState("")
  const [actionError, setActionError] = useState("")
  const localPurchases = projects.slice(3)
  const copiesByEntitlement = new Map(library.copies.map(copy => [copy.entitlementId, copy]))
  const openPurchase = async (entitlement: LicenseEntitlement, project: Project) => {
    const existing = copiesByEntitlement.get(entitlement.entitlementId)
    if (existing) { go(`/workspace/${existing.workspaceProjectId}`); return }
    if (entitlement.status !== "active" || working) return
    setWorking(entitlement.entitlementId); setActionError("")
    try {
      const workspaceId = (await hostedProductClient.workspaces())[0]
      if (!workspaceId) throw new Error("Create or join an editable workspace before making a working copy.")
      const copy = await hostedProductClient.materialize(workspaceId, entitlement.entitlementId, project.title)
      library.setCopies(current => [...current, copy]); go(`/workspace/${copy.workspaceProjectId}`)
    } catch (reason) { setActionError(reason instanceof Error ? reason.message : "A working copy could not be created.") }
    finally { setWorking("") }
  }
  const activeCount = library.hosted ? library.entitlements.filter(item => item.status === "active").length : localPurchases.length
  return <AppShell active="/purchases"><main className="standard product-hub"><header className="hub-title"><div><span className="signal">Your library</span><h1>Purchases</h1><p>Entitlements stay intact here even before you create an editable working copy.</p></div><Link className="button" to="/browse">Browse marketplace <Arrow/></Link></header><HubTabs active="purchases"/>{actionError && <div className="inline-error" role="alert">{actionError}</div>}<section className="hub-section"><div className="hub-section-head"><div><h2>Purchased releases</h2><p>Each purchase remains bound to its release.</p></div><span>{activeCount} active</span></div>{library.loading ? <HubState kind="loading" title="Loading purchases" body=""/> : library.error ? <HubState kind="error" title="Purchases could not be loaded" body={library.error} action={<button className="button" onClick={() => window.location.reload()}>Try again</button>}/> : library.hosted ? library.entitlements.length ? <div className="purchase-list">{library.entitlements.map(entitlement => { const project = releaseProject(library.catalog, entitlement.releaseId, entitlement.entitlementId, "Purchased project"), copy = copiesByEntitlement.get(entitlement.entitlementId), busy = working === entitlement.entitlementId; return <article className="purchase-row" key={entitlement.entitlementId}><Preview project={project}/><div className="purchase-copy"><span className={`entitlement-status ${entitlement.status}`}>{entitlement.status}</span><h3>{project.title}</h3><p>Release entitlement granted {new Date(entitlement.grantedAt).toLocaleDateString()}.</p><small>{project.stack.join(" · ")}</small></div><div className="purchase-action"><strong>${project.price}</strong><button className={copy ? "button" : "button primary"} disabled={busy || entitlement.status !== "active"} onClick={() => void openPurchase(entitlement, project)}>{copy ? "Open working copy" : busy ? "Creating copy…" : "Create working copy"} <Arrow/></button></div></article> })}</div> : <HubState kind="empty" title="No purchases yet" body="Browse the marketplace when you want a working project to start from." action={<Link className="button primary" to="/browse">Browse projects <Arrow/></Link>}/> : <div className="purchase-list">{localPurchases.map(project => <article className="purchase-row" key={project.id}><Preview project={project}/><div className="purchase-copy"><span className="entitlement-status active">active</span><h3>{project.title}</h3><p>This preview keeps the purchased release separate from editable working copies.</p><small>{project.stack.join(" · ")}</small></div><div className="purchase-action"><strong>${project.price}</strong><Link className="button primary" to={`/workspace/${project.id}`}>Create working copy <Arrow/></Link></div></article>)}</div>}</section></main></AppShell>
}

function Dashboard() {
  const library = useProductLibrary()
  const [pane, setPane] = useState("overview")
  if (library.loading) return <AppShell active={pane} onSectionChange={setPane}><main className="rope-dashboard"><HubState kind="loading" title="Loading your workspace" body=""/></main></AppShell>
  if (library.error) return <AppShell active={pane} onSectionChange={setPane}><main className="rope-dashboard"><HubState kind="error" title="Workspace overview unavailable" body={library.error}/></main></AppShell>

  const local = !library.hosted
  const copyItems = local ? projects.slice(0, 3).map(project => ({ project, href: `/workspace/${project.id}`, createdAt: "" })) : library.copies.map(copy => ({ project: releaseProject(library.catalog, copy.releaseId, copy.workspaceProjectId), href: `/workspace/${copy.workspaceProjectId}`, createdAt: copy.createdAt }))
  const entitlementItems = local ? projects.slice(3, 6).map(project => ({ project, createdAt: "", needsCopy: true })) : library.entitlements.filter(item => item.status === "active").map(entitlement => ({ project: releaseProject(library.catalog, entitlement.releaseId, entitlement.entitlementId, "Purchased project"), createdAt: entitlement.grantedAt, needsCopy: !library.copies.some(copy => copy.entitlementId === entitlement.entitlementId) }))
  const needsAttention = entitlementItems.filter(item => item.needsCopy)
  const continueItem = copyItems[0]
  const activity = [...copyItems.map(item => ({ label:"Working copy",title:item.project.title,date:item.createdAt })), ...entitlementItems.map(item => ({ label:"Purchase",title:item.project.title,date:item.createdAt }))].slice(0,5)
  const catalogProjects = local ? projects : library.catalog
  const dashboardDocs: [string, string][] = [
    ["Introduction","/docs"],
    ["Getting started","/docs/getting-started"],
    ["Customization","/docs/customization"],
    ["Marketplace","/docs/marketplace"],
    ["Visual editor","/docs/visual-editor"],
    ["Code editor","/docs/code-editor"],
    ["Export","/docs/export"],
    ["Compatibility","/docs/compatibility"],
    ["Security","/docs/security"],
    ["Changelog","/changelog"],
  ]

  const header = (title:string,description:string,action?:React.ReactNode) => <header className="rope-dashboard-head"><div><h1>{title}</h1><p>{description}</p></div>{action}</header>

  let content: React.ReactNode
  if (pane === "projects") {
    content = <main className="rope-dashboard">{header("My projects","Editable working copies in the same dashboard shell.")}<div className="rope-list-card"><div className="rope-table-head"><span>Project</span><span>Stack</span><span>Status</span><span>Updated</span></div>{copyItems.map(item => <div className="rope-table-row" key={item.project.id}><div><b>{item.project.title}</b><small>{item.project.tagline}</small></div><span>{item.project.stack.slice(0,2).join(" · ")}</span><span className="rope-status">Editable</span><span>{item.project.updated || "Working copy"}</span></div>)}</div></main>
  } else if (pane === "purchases") {
    content = <main className="rope-dashboard">{header("Purchases","Release-bound purchases, without leaving the dashboard.")}<div className="rope-card-grid">{entitlementItems.map(item => <article className="rope-project-card" key={item.project.id}><Preview project={item.project}/><div><span className="rope-soft-badge">Purchased release</span><h3>{item.project.title}</h3><p>{item.project.tagline}</p><small>{item.needsCopy ? "Ready to create working copy" : "Working copy exists"}</small></div></article>)}</div></main>
  } else if (pane === "marketplace") {
    content = <main className="rope-dashboard">{header("Marketplace","Browse working project releases inside the dashboard.",<button className="rope-primary-action" type="button">Explore</button>)}<div className="rope-card-grid">{catalogProjects.slice(0,6).map(project => <article className="rope-project-card" key={project.id}><Preview project={project}/><div><span>{project.category}</span><h3>{project.title}</h3><p>{project.tagline}</p><small>{project.stack.join(" · ")}</small></div></article>)}</div></main>
  } else if (pane === "creator" || pane === "listings" || pane === "submission") {
    content = <main className="rope-dashboard">{header(pane === "creator" ? "Creator Studio" : pane === "listings" ? "Listings" : "New submission","Creator tools stay inside the same app shell.")}<div className="rope-creator-grid"><article><Sparkles/><h3>Source-backed publishing</h3><p>Submit working projects instead of flattened files.</p></article><article><PackageCheck/><h3>Immutable releases</h3><p>Published releases remain bound to a source revision.</p></article><article><History/><h3>Review history</h3><p>Assessment and review state stays attached to the submission.</p></article></div></main>
  } else if (pane === "docs") {
    content = <main className="rope-dashboard">{header("Documentation","WebCanBe product documentation, shown without leaving Dashboard.")}<div className="rope-doc-grid">{dashboardDocs.map(([label,href]) => <article key={href}><BookOpen/><h3>{label}</h3><p>{href.includes("visual") ? "Source-backed visual editing." : href.includes("code") ? "Edit the actual project source." : "WebCanBe workflow and reference."}</p></article>)}</div></main>
  } else if (pane === "plans") {
    content = <main className="rope-dashboard">{header("Plans","UI preview only. Commercial pricing is finalized separately.")}<div className="rope-plan-row"><article><span>Free</span><h3>Explore</h3><p>Open the marketplace and work with a project.</p></article><article className="featured"><span>Pro</span><h3>Build more</h3><p>More workspaces and production features.</p></article><article><span>Studio</span><h3>Publish</h3><p>Creator and team workflows.</p></article></div></main>
  } else if (pane === "settings" || pane === "control") {
    content = <main className="rope-dashboard">{header(pane === "settings" ? "Settings" : "Control",pane === "settings" ? "Account and workspace preferences." : "Operator UI preview.")}<div className="rope-settings-card"><div className="rope-settings-nav"><button className="active">Profile</button><button>Account</button><button>Appearance</button><button>Notifications</button></div><div className="rope-settings-form"><label>Display name<input defaultValue="WebCanBe user"/></label><label>Email<input defaultValue="user@webcanbe.com"/></label><button className="rope-primary-action" type="button">Save changes</button></div></div></main>
  } else {
    const metrics=[["Working copies",copyItems.length,"Editable source-backed projects"],["Purchases",entitlementItems.length,"Release-bound entitlements"],["Ready to open",needsAttention.length,"Need a working copy"],["Edit modes",3,"Visual · Code · Split"]]
    content = <main className="rope-dashboard">
      {header("Dashboard","Continue your projects, review purchases, or start from the marketplace.",<button className="rope-primary-action" type="button" onClick={() => setPane("marketplace")}>Browse marketplace <Arrow/></button>)}
      <nav className="rope-page-tabs"><button className="active" onClick={() => setPane("overview")}>Overview</button><button onClick={() => setPane("projects")}>Projects</button><button onClick={() => setPane("purchases")}>Purchases</button><button onClick={() => setPane("docs")}>Documentation</button></nav>
      <section className="rope-metric-grid">{metrics.map(([label,value,note]) => <article className="rope-metric-card" key={String(label)}><div className="rope-metric-title"><span>{label}</span><i><PanelsTopLeft/></i></div><strong>{value}</strong><p>{note}</p></article>)}</section>
      <section className="rope-dashboard-grid">
        <article className="rope-card rope-overview-card"><header><div><h2>Overview</h2><p>Current project state, not invented revenue analytics.</p></div></header><div className="rope-mini-chart"><div><span>Working copies</span><i style={{height:`${42 + copyItems.length*12}px`}}/></div><div><span>Purchases</span><i style={{height:`${42 + entitlementItems.length*12}px`}}/></div><div><span>Ready</span><i style={{height:`${42 + needsAttention.length*12}px`}}/></div><div><span>Edit modes</span><i style={{height:"78px"}}/></div></div>{continueItem && <div className="rope-current-project"><Preview project={continueItem.project}/><div><span className="rope-soft-badge">Continue building</span><h3>{continueItem.project.title}</h3><p>{continueItem.project.tagline}</p><button className="rope-primary-action compact" type="button">Open workspace</button></div></div>}</article>
        <article className="rope-card rope-activity-card"><header><div><h2>Recent product activity</h2><p>Only project and purchase state — no invented analytics.</p></div></header><div className="rope-activity-list">{activity.map((item,index) => <div className="rope-activity-row" key={index}><span className="rope-activity-icon">{item.label==="Purchase"?<ShoppingBag/>:<FileCode2/>}</span><div><b>{item.title}</b><small>{item.label}</small></div><time>{item.date ? new Date(item.date).toLocaleDateString() : "Demo"}</time></div>)}</div></article>
      </section>
    </main>
  }
  return <AppShell active={pane} onSectionChange={setPane}>{content}</AppShell>
}

function Settings() { const [section, setSection] = useState("Profile"); const sections = ["Profile", "Account", "GitHub", "Domains", "Billing", "Preferences"]; return <AppShell><main className="settings"><aside><h1>Settings</h1>{sections.map(x => <button key={x} onClick={() => setSection(x)} className={section === x ? "active" : ""}>{x}</button>)}</aside><section className="settings-panel"><span className="signal">{section}</span><h2>{section === "Profile" ? "Your profile" : `${section} settings`}</h2>{section === "Profile" && <><div className="profile-avatar">OT</div><label>Name<input defaultValue="Oliver Taylor"/></label><label>Public creator name<input defaultValue="Oliver"/></label></>}{section === "GitHub" && <div className="integration"><b>GitHub</b><p>Connect GitHub when you’re ready to push project code to your own repositories.</p><button className="button">Connect GitHub <Arrow/></button></div>}{section === "Domains" && <div className="empty-state"><h3>Connect a domain when you’re ready.</h3><p>Domains are available on Pro and Studio.</p><Link className="button" to="/plans">See plans <Arrow/></Link></div>}{!["Profile", "GitHub", "Domains"].includes(section) && <div className="form-rows"><label>Email<input defaultValue="oliver@example.com"/></label><label>Notifications<select defaultValue="Product updates"><option>Product updates</option><option>Only account notices</option></select></label></div>}<button className="button primary save">Save changes</button></section></main></AppShell> }

function Plans() { const [annual, setAnnual] = useState(false); const plans = [{name:"Free", price:"$0", desc:"For opening a project, changing it, and taking it with you.", items:["Unlimited editing", "Code export", "1 workspace"]},{name:"Pro",price:annual?"$15.83":"$19",desc:"For one person building more than one real thing.",items:["Unlimited workspaces", "AI allowance", "Domains, deployment, GitHub"]},{name:"Studio",price:annual?"$40.83":"$49",desc:"For people building with clients and collaborators.",items:["5 seats", "Larger AI allowance", "Client handoff and selling"]}]; return <PublicShell active="/plans"><main className="plans"><div className="plans-head"><span className="signal">Plans</span><h1>The code is free.<br/>The workspace <em>isn’t.</em></h1><p>Exporting your codebase is never behind a plan.</p><div className="billing-switch"><button className={!annual ? "active" : ""} onClick={() => setAnnual(false)}>Monthly</button><button className={annual ? "active" : ""} onClick={() => setAnnual(true)}>Yearly <span>2 months free</span></button></div></div><section className="plan-grid">{plans.map((p,i) => <article className={i === 1 ? "featured" : ""} key={p.name}>{i === 1 && <span className="popular">Most chosen</span>}<h2>{p.name}</h2><p>{p.desc}</p><strong>{p.price}<small>{p.price !== "$0" && "/ month"}</small></strong><ul>{p.items.map(x => <li key={x}>✓ {x}</li>)}</ul><button className={i === 1 ? "button primary" : "button"} onClick={() => go(i ? "/signup" : "/browse")}>{i === 0 ? "Start for free" : `Choose ${p.name}`} <Arrow/></button></article>)}</section></main></PublicShell> }

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
}

export default function App() {
  const path = usePath()
  const directAuth = path === "/login" || path === "/signup"
  const [authIntent, setAuthIntent] = useState<{ signup: boolean } | null>(directAuth ? { signup: path === "/signup" } : null)

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ signup?: boolean }>).detail
      setAuthIntent({ signup: Boolean(detail?.signup) })
    }
    window.addEventListener("wcb:open-auth", handler)
    return () => window.removeEventListener("wcb:open-auth", handler)
  }, [])

  useEffect(() => {
    if (directAuth) setAuthIntent({ signup: path === "/signup" })
  }, [directAuth, path])

  const basePath = directAuth ? "/" : path
  let page: React.ReactNode
  if (basePath === "/") page = <Landing/>
  else if (basePath === "/browse") page = <Browse/>
  else if (basePath.startsWith("/project/")) page = <Detail reference={basePath.split("/").pop() ?? ""}/>
  else if (basePath.startsWith("/docs")) page = <Documentation path={basePath}/>
  else if (["/changelog","/about","/contact","/updates","/licenses","/terms","/privacy"].includes(basePath)) page = <InfoPage path={basePath}/>
  else if (basePath === "/auth/complete") page = <AuthComplete/>
  else if (basePath.startsWith("/checkout/")) page = <Protected><Checkout/></Protected>
  else if (basePath.startsWith("/workspace/")) page = <Protected><CompatibleWorkspace/></Protected>
  else if (basePath === "/projects") page = <Protected><Projects/></Protected>
  else if (basePath === "/purchases") page = <Protected><Purchases/></Protected>
  else if (basePath === "/dashboard") page = <Protected><Dashboard/></Protected>
  else if (basePath === "/settings") page = <Protected><Settings/></Protected>
  else if (basePath === "/plans") page = <Plans/>
  else if (basePath === "/seller/projects/new") page = <Protected><Seller page="new"/></Protected>
  else if (basePath === "/seller/projects") page = <Protected><Seller page="projects"/></Protected>
  else if (basePath === "/seller") page = <Protected><Seller/></Protected>
  else if (basePath === "/control") page = <Protected><Control/></Protected>
  else page = <Browse/>

  const closeAuth = () => {
    setAuthIntent(null)
    if (directAuth) {
      window.history.replaceState({}, "", "/")
      window.dispatchEvent(new PopStateEvent("popstate"))
    }
  }

  return <>{page}{authIntent && <Auth signup={authIntent.signup} onClose={closeAuth}/>}</>
}
