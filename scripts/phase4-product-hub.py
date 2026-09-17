from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)

app_path = Path("src/App.tsx")
app = app_path.read_text()

app = replace_once(
    app,
    'const nav = [["Browse", "/browse"], ["My projects", "/projects"], ["Dashboard", "/dashboard"], ["Plans", "/plans"]]',
    'const nav = [["Dashboard", "/dashboard"], ["Browse", "/browse"], ["My projects", "/projects"], ["Purchases", "/purchases"], ["Plans", "/plans"]]',
    "primary navigation",
)

start = app.index("function Projects() {")
end = app.index("\n\nfunction Settings()", start)
replacement = r'''function useProductLibrary() {
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
  if (library.loading) return <AppShell active="/dashboard"><main className="standard product-hub dashboard-hub"><header className="hub-title"><div><span className="signal">Overview</span><h1>Your workspace</h1></div></header><HubState kind="loading" title="Loading your workspace" body=""/></main></AppShell>
  if (library.error) return <AppShell active="/dashboard"><main className="standard product-hub dashboard-hub"><header className="hub-title"><div><span className="signal">Overview</span><h1>Your workspace</h1></div></header><HubState kind="error" title="Workspace overview unavailable" body={library.error} action={<button className="button" onClick={() => window.location.reload()}>Try again</button>}/></main></AppShell>
  const local = !library.hosted
  const copyItems = local ? projects.slice(0, 2).map((project, index) => ({ project, href: `/workspace/${project.id}`, createdAt: index ? "" : "" })) : library.copies.map(copy => ({ project: releaseProject(library.catalog, copy.releaseId, copy.workspaceProjectId), href: `/workspace/${copy.workspaceProjectId}`, createdAt: copy.createdAt }))
  const entitlementItems = local ? projects.slice(3, 5).map(project => ({ project, createdAt: "", needsCopy: true })) : library.entitlements.filter(item => item.status === "active").map(entitlement => ({ project: releaseProject(library.catalog, entitlement.releaseId, entitlement.entitlementId, "Purchased project"), createdAt: entitlement.grantedAt, needsCopy: !library.copies.some(copy => copy.entitlementId === entitlement.entitlementId) }))
  const needsAttention = entitlementItems.filter(item => item.needsCopy)
  const continueItem = copyItems[0]
  const activity = [...copyItems.map(item => ({ label: "Working copy", title: item.project.title, date: item.createdAt })), ...entitlementItems.map(item => ({ label: "Purchase", title: item.project.title, date: item.createdAt }))].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 5)
  return <AppShell active="/dashboard"><main className="standard product-hub dashboard-hub"><header className="hub-title"><div><span className="signal">Overview</span><h1>Your workspace</h1><p>Continue a working copy, open a purchase, or find something new.</p></div><Link className="button" to="/browse">Find a project <Arrow/></Link></header><section className="hub-metrics" aria-label="Workspace summary"><div><span>Working copies</span><strong>{copyItems.length}</strong></div><div><span>Purchases</span><strong>{entitlementItems.length}</strong></div><div><span>Ready to open</span><strong>{needsAttention.length}</strong></div></section>{continueItem ? <section className="continue-panel"><div><span className="signal">Continue building</span><h2>{continueItem.project.title}</h2><p>Open the same source-backed working copy and keep editing from its current revision.</p><Link className="button primary" to={continueItem.href}>Open workspace <Arrow/></Link></div><Preview project={continueItem.project}/></section> : <HubState kind="empty" title="No working copies yet" body="Your purchases remain available until you are ready to create one." action={<Link className="button primary" to="/purchases">View purchases <Arrow/></Link>}/>}<div className="dashboard-grid">{needsAttention.length > 0 && <section className="attention-list"><div className="hub-section-head"><div><h2>Ready to open</h2><p>Purchased releases without a working copy.</p></div><Link to="/purchases">View all</Link></div>{needsAttention.slice(0,3).map(item => <Link key={item.project.id} className="attention-row" to="/purchases"><span>{item.project.title}</span><small>Create working copy <Arrow/></small></Link>)}</section>}<section className="activity-list"><div className="hub-section-head"><div><h2>Recent product activity</h2><p>Only project and purchase state — no invented analytics.</p></div></div>{activity.length ? activity.map((item,index) => <div className="activity-row" key={`${item.label}-${item.title}-${index}`}><span>{item.label}</span><b>{item.title}</b><small>{item.date ? new Date(item.date).toLocaleDateString() : "Preview state"}</small></div>) : <p className="muted-copy">Activity will appear after you purchase or create a working copy.</p>}</section></div></main></AppShell>
}'''
app = app[:start] + replacement + app[end:]

app = replace_once(
    app,
    'if (path === "/projects") return <Projects/>; if (path === "/dashboard") return <Dashboard/>;',
    'if (path === "/projects") return <Projects/>; if (path === "/purchases") return <Purchases/>; if (path === "/dashboard") return <Dashboard/>;',
    "purchase route",
)
app_path.write_text(app)

main_path = Path("src/main.tsx")
main = main_path.read_text()
main = replace_once(main, 'import "./phase4.css"\n', 'import "./phase4.css"\nimport "./phase4-product-hub.css"\n', "phase4 product CSS import")
main_path.write_text(main)

compat_path = Path("src/webcanbe-engine/visual-editor/CompatibleWorkspace.tsx")
compat = compat_path.read_text()
compat = replace_once(compat, 'const [surface, setSurface] = useState<"canvas" | "code" | "history">("canvas")', 'const [surface, setSurface] = useState<"canvas" | "code" | "split" | "history">("canvas")', "workspace surface state")
compat = replace_once(compat, 'function openSurface(value: "canvas" | "code" | "history")', 'function openSurface(value: "canvas" | "code" | "split" | "history")', "workspace open surface")
compat = replace_once(
    compat,
    '<div className="compatible-top-actions"><button type="button" aria-pressed={surface === "canvas"} onClick={() => openSurface("canvas")}>Canvas</button><button type="button" aria-pressed={surface === "code"} onClick={() => openSurface("code")}>Code</button><button type="button" aria-pressed={surface === "history"} onClick={() => openSurface("history")}>History</button><button type="button" onClick={() => void history("undo")}>Undo</button><button type="button" onClick={() => void history("redo")}>Redo</button><button type="button" onClick={() => void exportProject()} disabled={!session}>Export code</button></div>',
    '<div className="compatible-mode-tabs" aria-label="Workspace mode"><button type="button" aria-pressed={surface === "canvas"} onClick={() => openSurface("canvas")}>Visual</button><button type="button" aria-pressed={surface === "code"} onClick={() => openSurface("code")}>Code</button><button type="button" aria-pressed={surface === "split"} onClick={() => openSurface("split")}>Split</button></div><div className="compatible-top-actions"><button type="button" aria-pressed={surface === "history"} onClick={() => openSurface("history")}>Changes</button><button type="button" onClick={() => void history("undo")}>Undo</button><button type="button" onClick={() => void history("redo")}>Redo</button><button type="button" onClick={() => void exportProject()} disabled={!session}>Export</button></div>',
    "workspace mode controls",
)
compat = replace_once(compat, '<section className="compatible-preview-shell">', '<section className={`compatible-preview-shell ${surface === "split" ? "split-mode" : ""}`}>', "split shell class")
compat = replace_once(compat, '<div hidden={surface !== "canvas"} ref={previewContainer}', '<div hidden={surface !== "canvas" && surface !== "split"} ref={previewContainer}', "split preview visibility")
compat_path.write_text(compat)

code_path = Path("src/webcanbe-engine/visual-editor/CodeWorkspace.tsx")
code = code_path.read_text()
code = replace_once(code, 'visible: "canvas" | "code" | "history";', 'visible: "canvas" | "code" | "split" | "history";', "CodeWorkspace visible union")
code = replace_once(code, '{visible === "code" && <>', '{(visible === "code" || visible === "split") && <>', "CodeWorkspace split render")
code_path.write_text(code)

css = r'''/* Phase 4 product-library and real workspace pass. */
.product-hub { padding-bottom: 112px; }
.hub-title { display:flex; align-items:flex-end; justify-content:space-between; gap:40px; padding:72px 0 34px; border-bottom:1px solid #ececec; }
.hub-title h1 { margin:10px 0 8px; font-size:clamp(46px,5.4vw,74px); line-height:.98; letter-spacing:-.065em; font-weight:520; color:#111; }
.hub-title p { margin:0; max-width:590px; color:#696969; font-size:15px; line-height:1.55; }
.hub-tabs { display:flex; gap:4px; padding:18px 0; border-bottom:1px solid #ececec; }
.hub-tabs a { color:#707070; text-decoration:none; font-size:13px; padding:9px 12px; border-radius:8px; }
.hub-tabs a:hover { background:#f5f5f5; color:#111; }
.hub-tabs a.active { background:#111; color:#fff; }
.hub-section { padding-top:42px; }
.hub-section-head { display:flex; align-items:flex-end; justify-content:space-between; gap:24px; margin-bottom:18px; }
.hub-section-head h2 { margin:0 0 5px; font-size:22px; letter-spacing:-.035em; color:#111; }
.hub-section-head p,.hub-section-head>span,.hub-section-head a { margin:0; color:#777; font-size:12px; }
.hub-section-head a { color:#333; text-underline-offset:3px; }
.hub-list,.purchase-list { border-top:1px solid #e8e8e8; }
.hub-row,.purchase-row { display:grid; grid-template-columns:220px minmax(0,1fr) auto; align-items:center; gap:28px; padding:22px 0; border-bottom:1px solid #e8e8e8; }
.hub-row .project-preview,.purchase-row .project-preview { height:132px; border-radius:10px; }
.hub-row .preview-body,.purchase-row .preview-body { padding:13px 4px; }
.hub-row .preview-body h3,.purchase-row .preview-body h3 { font-size:18px; }
.hub-row .preview-orb,.purchase-row .preview-orb { width:80px; height:76px; top:20px; }
.hub-row-copy>span,.purchase-copy>span { color:#858585; font-size:10px; text-transform:uppercase; letter-spacing:.08em; }
.hub-row-copy h3,.purchase-copy h3 { margin:7px 0 6px; font-size:19px; letter-spacing:-.035em; }
.hub-row-copy p,.purchase-copy p { margin:0; color:#747474; font-size:13px; line-height:1.45; }
.hub-row-meta,.purchase-action { display:flex; flex-direction:column; align-items:flex-end; gap:14px; min-width:150px; }
.hub-row-meta small,.purchase-copy small { color:#858585; font-size:11px; }
.purchase-action strong { font-size:18px; font-weight:600; }
.entitlement-status { display:inline-flex; width:max-content; padding:4px 7px; border-radius:999px; background:#f0f0f0; color:#666!important; }
.entitlement-status.active { background:#edf7f3; color:#16745e!important; }
.entitlement-status.revoked,.entitlement-status.invalid { background:#f7eeee; color:#8d4444!important; }
.hub-state { max-width:720px; padding:54px 0 70px; }
.hub-state>span { color:#888; font-size:11px; text-transform:uppercase; letter-spacing:.08em; }
.hub-state h2 { margin:10px 0 8px; font-size:30px; letter-spacing:-.045em; }
.hub-state p { margin:0 0 22px; color:#6e6e6e; line-height:1.55; }
.hub-state .button+.button { margin-left:8px; }
.inline-error { margin-top:22px; padding:13px 15px; border:1px solid #eadada; background:#fcf7f7; color:#7b3f3f; border-radius:9px; font-size:13px; }
.hub-loading { border-top:1px solid #ececec; }
.hub-skeleton { display:grid; grid-template-columns:220px 1fr 150px; gap:28px; align-items:center; padding:22px 0; border-bottom:1px solid #ececec; }
.hub-skeleton i,.hub-skeleton span,.hub-skeleton b { display:block; background:linear-gradient(90deg,#f1f1f1,#f8f8f8,#f1f1f1); background-size:200% 100%; animation:hubShimmer 1.2s linear infinite; border-radius:9px; }
.hub-skeleton i { height:132px; }.hub-skeleton span { height:54px; }.hub-skeleton b { height:42px; }
@keyframes hubShimmer { to { background-position:-200% 0; } }
.hub-metrics { display:grid; grid-template-columns:repeat(3,1fr); border-top:1px solid #e8e8e8; border-bottom:1px solid #e8e8e8; margin:20px 0 44px; }
.hub-metrics>div { padding:22px 0; }.hub-metrics>div+div { border-left:1px solid #e8e8e8; padding-left:26px; }
.hub-metrics span { display:block; color:#7b7b7b; font-size:11px; }.hub-metrics strong { display:block; margin-top:6px; font-size:28px; letter-spacing:-.04em; font-weight:520; }
.continue-panel { display:grid; grid-template-columns:minmax(0,.9fr) minmax(380px,1.1fr); align-items:center; gap:64px; padding:42px 0 56px; }
.continue-panel h2 { margin:10px 0 12px; font-size:38px; letter-spacing:-.055em; }.continue-panel p { max-width:470px; color:#6d6d6d; line-height:1.55; }
.continue-panel .project-preview { height:300px; }
.dashboard-grid { display:grid; grid-template-columns:1fr 1fr; gap:50px; padding-top:38px; border-top:1px solid #e8e8e8; }
.attention-row { display:flex; justify-content:space-between; gap:20px; padding:15px 0; border-top:1px solid #ededed; color:#222; text-decoration:none; }
.attention-row small { color:#707070; }.attention-row:hover small { color:#111; }
.activity-row { display:grid; grid-template-columns:86px 1fr auto; gap:14px; padding:14px 0; border-top:1px solid #ededed; font-size:12px; }.activity-row span,.activity-row small { color:#818181; }.activity-row b { font-weight:520; }
.muted-copy { color:#777; font-size:13px; }

/* The production workspace uses CompatibleWorkspace, not the earlier static mock. */
.compatible-workspace { min-height:100vh; background:#fff; color:#111; font-family:"Host Grotesk",Inter,Arial,sans-serif; }
.compatible-topbar { height:56px; padding:0 16px; justify-content:flex-start; gap:22px; border-bottom:1px solid #e7e7e7; background:#fff; }
.compatible-brand { color:#111; font-size:13px; }.compatible-brand span { color:#888; }
.compatible-project-status { color:#333; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }.compatible-project-status i,.compatible-preview-head i { background:#10a37f; }.compatible-project-status small { color:#858585; }
.compatible-mode-tabs { display:flex; gap:2px; margin-left:auto; padding:3px; border:1px solid #e4e4e4; background:#f6f6f6; border-radius:9px; }
.compatible-mode-tabs button,.compatible-top-actions button { border:0; background:transparent; color:#686868; border-radius:6px; padding:7px 10px; font:inherit; }
.compatible-mode-tabs button:hover,.compatible-top-actions button:hover { background:#ededed; color:#111; }
.compatible-mode-tabs button[aria-pressed="true"] { background:#fff; color:#111; box-shadow:0 1px 2px rgba(0,0,0,.08); }
.compatible-top-actions { gap:3px; margin-left:0; }.compatible-top-actions button { border:1px solid transparent; }
.compatible-layout { grid-template-columns:210px minmax(0,1fr) 300px; min-height:calc(100vh - 56px); }
.compatible-files { border-right:1px solid #e7e7e7; background:#fff; color:#444; max-height:calc(100vh - 56px); padding:16px 12px; }
.compatible-files p,.inspector-heading p { color:#858585; }.compatible-files strong { color:#333; }.compatible-files span { color:#727272; }
.compatible-files button,.compatible-files select,.compatible-files input { border:1px solid #dedede; background:#fff; color:#333; border-radius:7px; padding:7px 8px; font:inherit; }
.compatibility-summary { border-top-color:#e8e8e8; }.compatibility-summary small,.compatibility-summary p { color:#7d7d7d; }
.compatible-preview-shell { background:#f3f3f3; min-width:0; }
.compatible-preview-head { height:44px; border-bottom:1px solid #e2e2e2; color:#666; background:#fff; gap:8px; overflow:auto; }
.compatible-preview-head input,.compatible-preview-head select,.compatible-preview-head button { border:1px solid #dedede; background:#fff; color:#444; border-radius:6px; font:inherit; padding:5px 7px; }
.compatible-frame-wrap { height:calc(100vh - 100px); background:#ededed; }
.compatible-frame-wrap iframe { background:#fff; }
.compatible-inspector { border-left:1px solid #e7e7e7; background:#fff; color:#333; max-height:calc(100vh - 56px); }
.inspector-heading { border-bottom-color:#e7e7e7; }.inspector-heading span { border-color:#dedede; color:#666; background:#f6f6f6; }
.source-location { border-bottom-color:#e8e8e8; }.source-location small,.style-controls>small { color:#8a8a8a; }.source-location b { color:#222; }.source-location span,.empty-inspector,.empty-inspector p { color:#707070; }
.inspector-control { color:#444; }.inspector-control textarea,.inspector-control input { border-color:#dedede; background:#fff; color:#111; border-radius:7px; }.inspector-control button { border-color:#d8d8d8; background:#f7f7f7; color:#222; }
.canvas-outline { border-color:#111; box-shadow:0 0 0 1px rgba(255,255,255,.8); }.canvas-outline span { background:#111; color:#fff; }
.source-gesture { border-color:#111; background:#fff; color:#111; box-shadow:0 2px 6px rgba(0,0,0,.12); }
.source-workspace { background:#fff; color:#222; padding:14px; gap:12px; }
.source-workspace button { border-color:#dedede; border-radius:7px; color:#222; background:#fff; }.source-workspace button[aria-pressed=true] { background:#111; color:#fff; }.source-code-editor,.source-workspace pre,.source-history article { border-color:#e2e2e2; }.source-history article { box-shadow:none; }
.compatible-preview-shell.split-mode { display:grid; grid-template-columns:minmax(0,1fr) minmax(360px,.92fr); grid-template-rows:44px minmax(0,1fr); height:calc(100vh - 56px); }
.compatible-preview-shell.split-mode .compatible-preview-head { grid-column:1 / -1; grid-row:1; }
.compatible-preview-shell.split-mode .compatible-frame-wrap { grid-column:1; grid-row:2; height:auto; min-height:0; border-right:1px solid #e0e0e0; }
.compatible-preview-shell.split-mode .source-workspace { grid-column:2; grid-row:2; min-height:0; overflow:auto; align-content:flex-start; }
.compatible-preview-shell.split-mode .source-file-tree { width:100%; max-height:150px; overflow:auto; }
.compatible-preview-shell.split-mode .source-editor-panel { min-width:0; width:100%; }
.compatible-preview-shell.split-mode .source-code-editor .cm-editor { height:340px; }

@media (max-width: 960px) {
  .hub-title { align-items:flex-start; flex-direction:column; }
  .hub-row,.purchase-row { grid-template-columns:150px 1fr; }.hub-row-meta,.purchase-action { grid-column:2; align-items:flex-start; flex-direction:row; }
  .continue-panel,.dashboard-grid { grid-template-columns:1fr; }.continue-panel { gap:28px; }
  .compatible-layout { grid-template-columns:170px minmax(0,1fr); }.compatible-inspector { display:none; }
  .compatible-preview-shell.split-mode { grid-template-columns:1fr; grid-template-rows:44px minmax(320px,1fr) minmax(320px,1fr); overflow:auto; }
  .compatible-preview-shell.split-mode .compatible-frame-wrap { grid-column:1; grid-row:2; min-height:320px; border-right:0; border-bottom:1px solid #e2e2e2; }
  .compatible-preview-shell.split-mode .source-workspace { grid-column:1; grid-row:3; min-height:320px; }
}
@media (max-width: 720px) {
  .hub-title { padding-top:48px; }.hub-metrics { grid-template-columns:1fr; }.hub-metrics>div+div { border-left:0; border-top:1px solid #e8e8e8; padding-left:0; }
  .hub-row,.purchase-row { grid-template-columns:1fr; }.hub-row .project-preview,.purchase-row .project-preview { height:200px; }.hub-row-meta,.purchase-action { grid-column:1; align-items:flex-start; }.purchase-action { flex-direction:row; justify-content:space-between; }
  .compatible-topbar { overflow:auto; }.compatible-project-status { display:none; }.compatible-layout { display:block; }.compatible-files { display:none; }.compatible-preview-shell { height:64vh; }.compatible-inspector { display:block; min-height:36vh; border-left:0; border-top:1px solid #e7e7e7; }
}
@media (prefers-reduced-motion: reduce) { .hub-skeleton { animation:none; } }
'''
Path("src/phase4-product-hub.css").write_text(css)

test = r'''import { describe, expect, it } from "vitest"
import fs from "node:fs"

describe("Phase 4 product-library information architecture", () => {
  const app = fs.readFileSync("src/App.tsx", "utf8")
  it("keeps My Projects and Purchases as separate product destinations with explicit states", () => {
    expect(app).toContain('["My projects", "/projects"]')
    expect(app).toContain('["Purchases", "/purchases"]')
    expect(app).toContain('if (path === "/purchases") return <Purchases/>')
    expect(app).toContain('Purchases stay separate until you create a copy.')
    expect(app).toContain('Nothing here yet')
    expect(app).toContain('Something needs attention')
  })
  it("derives dashboard attention from real purchase/copy state rather than fake analytics", () => {
    expect(app).toContain('Ready to open')
    expect(app).toContain('Recent product activity')
    expect(app).toContain('Only project and purchase state — no invented analytics.')
    expect(app).not.toContain('Good afternoon, Oliver.')
  })
})

describe("Phase 4 real workspace modes", () => {
  const workspace = fs.readFileSync("src/webcanbe-engine/visual-editor/CompatibleWorkspace.tsx", "utf8")
  const code = fs.readFileSync("src/webcanbe-engine/visual-editor/CodeWorkspace.tsx", "utf8")
  const css = fs.readFileSync("src/phase4-product-hub.css", "utf8")
  it("exposes Visual, Code, Split and Changes while preserving the actual source workspace", () => {
    expect(workspace).toContain('>Visual</button>')
    expect(workspace).toContain('>Code</button>')
    expect(workspace).toContain('>Split</button>')
    expect(workspace).toContain('>Changes</button>')
    expect(workspace).toContain('surface === "split"')
    expect(code).toContain('visible: "canvas" | "code" | "split" | "history"')
    expect(code).toContain('visible === "code" || visible === "split"')
  })
  it("uses a true-white production workspace and a two-surface split layout", () => {
    expect(css).toContain('.compatible-workspace { min-height:100vh; background:#fff;')
    expect(css).toContain('.compatible-preview-shell.split-mode { display:grid;')
    expect(css).toContain('grid-template-columns:minmax(0,1fr) minmax(360px,.92fr)')
  })
})
'''
Path("src/phase4-product-hub.test.ts").write_text(test)
