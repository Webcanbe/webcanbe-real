from pathlib import Path

app = Path('src/App.tsx')
text = app.read_text()

old_go = '''function go(to: string) { window.history.pushState({}, "", to); window.dispatchEvent(new PopStateEvent("popstate")); window.scrollTo(0, 0) }
function Link({ to, children, className = "" }: { to: string; children: React.ReactNode; className?: string }) { return <a className={className} href={to} onClick={(e) => { e.preventDefault(); go(to) }}>{children}</a> }
'''
new_go = '''let routeTimer: number | undefined
function go(to: string) {
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
'''
if old_go not in text: raise SystemExit('go block not found')
text = text.replace(old_go, new_go)

old_shell = '''const nav = [["Dashboard", "/dashboard"], ["Browse", "/browse"], ["My projects", "/projects"], ["Purchases", "/purchases"], ["Plans", "/plans"]]
function AppShell({ children, active }: { children: React.ReactNode; active?: string }) {
  const [menu, setMenu] = useState(false)
  return <div className="product"><header className="product-header"><Link to="/browse" className="brand"><Mark/> <span>WebCanBe</span></Link><nav>{nav.map(([n, p]) => <Link key={p} to={p} className={active === p ? "active" : ""}>{n}</Link>)}</nav><div className="header-actions"><Link to="/seller" className="quiet-link">Sell a project</Link><Link to="/settings" className="avatar">OT</Link><button className="mobile-menu" onClick={() => setMenu(!menu)}>Menu</button></div>{menu && <div className="mobile-nav">{nav.map(([n,p]) => <Link key={p} to={p}>{n}</Link>)}<Link to="/settings">Settings</Link></div>}</header>{children}</div>
}
'''
new_shell = '''const publicNav = [["Pricing", "/plans"]]
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

function AppShell({ children, active }: { children: React.ReactNode; active?: string }) {
  const [menu, setMenu] = useState(false)
  return <div className="product app-frame"><aside className={`app-sidebar ${menu ? "open" : ""}`}><Link to="/dashboard" className="brand app-sidebar-brand"><Mark/> <span>WebCanBe</span></Link><nav>{appNav.map(([n,p]) => <Link key={p} to={p} className={active === p ? "active" : ""}>{n}</Link>)}</nav><div className="app-sidebar-secondary"><Link to="/seller">Creator Studio</Link><Link to="/plans">Plans</Link></div><div className="app-sidebar-account"><Link to="/settings"><span className="avatar">OT</span><span><b>Account</b><small>Settings</small></span></Link></div></aside><div className="app-main"><header className="app-mobile-header"><Link to="/dashboard" className="brand"><Mark/><span>WebCanBe</span></Link><button className="mobile-menu" onClick={() => setMenu(value => !value)} aria-expanded={menu}>Menu</button></header>{children}</div>{menu && <button className="app-sidebar-scrim" aria-label="Close navigation" onClick={() => setMenu(false)}/>}</div>
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
'''
if old_shell not in text: raise SystemExit('shell block not found')
text = text.replace(old_shell, new_shell)

text = text.replace('return <AppShell active="/browse"><main className="browse">', 'return <PublicShell><main className="browse">', 1)
browse_start = text.index('function Browse()')
detail_start = text.index('function Detail(', browse_start)
browse = text[browse_start:detail_start].replace('</main></AppShell>', '</main></PublicShell>')
text = text[:browse_start] + browse + text[detail_start:]

text = text.replace('  const [project, setProject] = useState<Project | undefined>(hosted ? undefined : fallback), [tab, setTab] = useState("Overview"), [message, setMessage] = useState(hosted ? "Loading project…" : ""), [opening, setOpening] = useState(false)', '  const [project, setProject] = useState<Project | undefined>(hosted ? undefined : fallback), [tab, setTab] = useState("Overview"), [message, setMessage] = useState(hosted ? "Loading project…" : ""), [buying, setBuying] = useState(false)')
old_detail_logic = '''  if (!project) return <AppShell active="/browse"><main className="detail"><div className="crumb"><Link to="/browse">Marketplace</Link><span>/</span><span>{message}</span></div></main></AppShell>
  const open = async () => {
    if (!hosted) { go(`/workspace/${project.id}`); return }
    if (!project.releaseId || opening) return
    setOpening(true); setMessage("Creating your workspace copy…")
    try { const copy = await hostedProductClient.purchaseAndMaterialize(project.releaseId, project.title); go(`/workspace/${copy.workspaceProjectId}`) }
    catch (error) { setMessage(error instanceof Error ? error.message : "Purchase could not be completed."); setOpening(false) }
  }
  return <AppShell active="/browse"><main className="detail">'''
new_detail_logic = '''  if (!project) return <PublicShell><main className="detail"><div className="crumb"><Link to="/browse">Marketplace</Link><span>/</span><span>{message}</span></div></main></PublicShell>
  const checkoutTarget = `/checkout/${encodeURIComponent(project.releaseId ?? project.id)}?project=${encodeURIComponent(project.slug)}`
  const buy = async () => {
    if (buying) return
    setBuying(true)
    if (!hosted) { go(`/login?next=${encodeURIComponent(checkoutTarget)}`); return }
    const signedIn = await hostedProductClient.authenticated()
    go(signedIn ? checkoutTarget : `/login?next=${encodeURIComponent(checkoutTarget)}`)
  }
  return <PublicShell><main className="detail">'''
if old_detail_logic not in text: raise SystemExit('detail logic not found')
text = text.replace(old_detail_logic, new_detail_logic)
text = text.replace('<button className="button primary" disabled={opening} onClick={() => void open()}>{opening ? "Opening…" : "Open in workspace"} <Arrow/></button>', '<button className="button primary" disabled={buying} onClick={() => void buy()}>{buying ? "Continuing…" : `Buy project — $${project.price}`} <Arrow/></button>')
detail_start = text.index('function Detail(')
auth_start = text.index('function authNext()', detail_start)
detail = text[detail_start:auth_start].replace('</main></AppShell>', '</main></PublicShell>')
text = text[:detail_start] + detail + text[auth_start:]

text = text.replace('return value && value.startsWith("/") && !value.startsWith("//") ? value : "/browse"', 'return value && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard"')
text = text.replace('{next !== "/browse" && <p className="auth-return">', '{next !== "/dashboard" && <p className="auth-return">')

checkout = '''\nfunction Checkout() {
  const params = new URLSearchParams(window.location.search)
  const reference = params.get("project") ?? ""
  const project = projects.find(item => item.slug === reference)
  const price = project?.price ?? 0
  return <main className="checkout-page"><header className="checkout-header"><Link to="/" className="brand"><Mark/><span>WebCanBe</span></Link><Link to={project ? `/project/${project.slug}` : "/browse"}>Back to project</Link></header><section className="checkout-layout"><div className="checkout-main"><span className="signal">Checkout</span><h1>Complete your purchase.</h1><p>Your account is ready. Payment is the next boundary: WebCanBe must not create an entitlement until the payment provider confirms the transaction.</p><div className="checkout-provider-placeholder"><strong>Card checkout</strong><p>The real card-first provider connection belongs to Phase 5. This Phase 4 surface defines the correct flow without pretending a payment happened.</p><button className="button primary" disabled>{price ? `Pay $${price}` : "Pay"}</button></div></div><aside className="checkout-summary"><span>Order summary</span><h2>{project?.title ?? "Selected project"}</h2><p>{project?.tagline ?? "The selected immutable release will be bound to the completed purchase."}</p><dl><div><dt>Project</dt><dd>{price ? `$${price}` : "—"}</dd></div><div><dt>Total</dt><dd>{price ? `$${price}` : "—"}</dd></div></dl><small>Successful payment → entitlement → Dashboard. From there, create or open the editable working copy.</small></aside></section></main>
}\n'''
text = text.replace('\nfunction Workspace()', checkout + '\nfunction Workspace()', 1)

plans_start = text.index('function Plans()')
creator_start = text.index('function CreatorListingEditor', plans_start)
plans = text[plans_start:creator_start].replace('return <AppShell active="/plans"><main className="plans">', 'return <PublicShell active="/plans"><main className="plans">').replace('</main></AppShell>', '</main></PublicShell>')
text = text[:plans_start] + plans + text[creator_start:]

old_routes = 'if (path.startsWith("/workspace/")) return <CompatibleWorkspace/>; if (path === "/projects") return <Projects/>; if (path === "/purchases") return <Purchases/>; if (path === "/dashboard") return <Dashboard/>; if (path === "/settings") return <Settings/>; if (path === "/plans") return <Plans/>; if (path === "/seller/projects/new") return <Seller page="new"/>; if (path === "/seller/projects") return <Seller page="projects"/>; if (path === "/seller") return <Seller/>; if (path === "/control") return <Control/>; return <Browse/>'
new_routes = 'if (path.startsWith("/checkout/")) return <Protected><Checkout/></Protected>; if (path.startsWith("/workspace/")) return <Protected><CompatibleWorkspace/></Protected>; if (path === "/projects") return <Protected><Projects/></Protected>; if (path === "/purchases") return <Protected><Purchases/></Protected>; if (path === "/dashboard") return <Protected><Dashboard/></Protected>; if (path === "/settings") return <Protected><Settings/></Protected>; if (path === "/plans") return <Plans/>; if (path === "/seller/projects/new") return <Protected><Seller page="new"/></Protected>; if (path === "/seller/projects") return <Protected><Seller page="projects"/></Protected>; if (path === "/seller") return <Protected><Seller/></Protected>; if (path === "/control") return <Protected><Control/></Protected>; return <Browse/>'
if old_routes not in text: raise SystemExit('route block not found')
text = text.replace(old_routes, new_routes)
app.write_text(text)

client = Path('src/hostedProductClient.ts')
ct = client.read_text()
needle = '  async authStart() {\n'
insert = '''  async authenticated() {
    try { await this.session(); return true }
    catch { return false }
  }

'''
if insert not in ct:
    if needle not in ct: raise SystemExit('authStart not found')
    ct = ct.replace(needle, insert + needle)
client.write_text(ct)

home = Path('src/Home.tsx')
ht = home.read_text()
old_route = '''function route(event: MouseEvent<HTMLAnchorElement>, href: string) {
  if (!href.startsWith("/") || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  window.history.pushState({}, "", href)
  window.dispatchEvent(new PopStateEvent("popstate"))
  window.scrollTo({ top: 0, behavior: "auto" })
}
'''
new_route = '''let landingRouteTimer: number | undefined
function route(event: MouseEvent<HTMLAnchorElement>, href: string) {
  if (!href.startsWith("/") || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  if (landingRouteTimer) window.clearTimeout(landingRouteTimer)
  document.documentElement.classList.add("wcb-route-leaving")
  landingRouteTimer = window.setTimeout(() => {
    window.history.pushState({}, "", href)
    window.dispatchEvent(new PopStateEvent("popstate"))
    window.scrollTo({ top: 0, behavior: "auto" })
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => document.documentElement.classList.remove("wcb-route-leaving")))
    landingRouteTimer = undefined
  }, 120)
}
'''
if old_route not in ht: raise SystemExit('landing route block not found')
ht = ht.replace(old_route, new_route)
home.write_text(ht)

main = Path('src/main.tsx')
mt = main.read_text()
if 'phase4-public-flow.css' not in mt:
    mt = mt.replace('import "./phase4-operations.css"', 'import "./phase4-operations.css"\nimport "./phase4-public-flow.css"')
main.write_text(mt)

Path('src/phase4-public-flow.css').write_text('''/* Phase 4 IA correction. Landing composition remains owned by landing.module.css. */
#root{transition:opacity .12s ease,transform .12s ease}html.wcb-route-leaving #root{opacity:.72;transform:translateY(2px);pointer-events:none}html.wcb-route-leaving body::before{content:"";position:fixed;z-index:9999;top:0;left:0;height:2px;width:38%;background:#111;animation:wcb-route-line .22s ease forwards}@keyframes wcb-route-line{from{width:8%;opacity:.3}to{width:74%;opacity:.9}}.public-header .brand{margin-right:20px}.public-header nav{margin-left:auto}.public-header .header-actions{margin-left:14px}.public-open-app{white-space:nowrap}.app-frame{display:grid;grid-template-columns:228px minmax(0,1fr);min-height:100vh;background:#fff}.app-sidebar{position:sticky;top:0;height:100vh;display:flex;flex-direction:column;padding:18px 14px;border-right:1px solid #ececec;background:#fff;z-index:55}.app-sidebar-brand{height:42px;display:flex;align-items:center;gap:8px;padding:0 9px;color:#111;text-decoration:none;font-weight:650}.app-sidebar nav{display:flex;flex-direction:column;gap:2px;margin-top:26px}.app-sidebar nav a,.app-sidebar-secondary>a{display:flex;align-items:center;min-height:38px;padding:0 10px;border-radius:8px;color:#686868;text-decoration:none;font-size:13px}.app-sidebar nav a:hover,.app-sidebar-secondary>a:hover{background:#f5f5f5;color:#111}.app-sidebar nav a.active{background:#111;color:#fff}.app-sidebar-secondary{display:flex;flex-direction:column;gap:2px;margin-top:24px;padding-top:20px;border-top:1px solid #ededed}.app-sidebar-account{margin-top:auto;padding-top:14px;border-top:1px solid #ededed}.app-sidebar-account>a{display:flex;align-items:center;gap:10px;padding:8px;border-radius:9px;color:#222;text-decoration:none}.app-sidebar-account>a:hover{background:#f5f5f5}.app-sidebar-account b,.app-sidebar-account small{display:block}.app-sidebar-account b{font-size:12px;font-weight:600}.app-sidebar-account small{margin-top:2px;color:#858585;font-size:10px}.app-main{min-width:0;min-height:100vh}.app-mobile-header{display:none}.app-sidebar-scrim{display:none}.app-frame .standard,.app-frame .settings,.app-frame .seller,.app-frame .control{max-width:1180px}.route-gate{min-height:100vh;display:grid;place-content:center;text-align:center;gap:10px;background:#fff;color:#111}.route-gate p{margin:0;color:#707070}.checkout-page{min-height:100vh;background:#fff;color:#111}.checkout-header{height:64px;display:flex;align-items:center;justify-content:space-between;padding:0 max(28px,calc((100vw - 1120px)/2));border-bottom:1px solid #ececec}.checkout-header .brand{color:#111;text-decoration:none}.checkout-header>a:last-child{color:#666;text-decoration:none;font-size:13px}.checkout-layout{max-width:1120px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:90px;padding:72px 28px 110px}.checkout-main h1{font-size:clamp(46px,5vw,70px);line-height:.98;letter-spacing:-.06em;font-weight:520;margin:12px 0 18px}.checkout-main>p{max-width:610px;color:#686868;line-height:1.55}.checkout-provider-placeholder{margin-top:42px;border-top:1px solid #e7e7e7;padding-top:24px}.checkout-provider-placeholder strong{display:block;font-size:15px}.checkout-provider-placeholder p{max-width:620px;color:#737373;line-height:1.5}.checkout-provider-placeholder .button{margin-top:12px;min-width:160px}.checkout-summary{border:1px solid #e5e5e5;border-radius:14px;padding:24px;height:max-content}.checkout-summary>span{color:#858585;font-size:10px;text-transform:uppercase;letter-spacing:.08em}.checkout-summary h2{margin:8px 0;font-size:26px;letter-spacing:-.04em}.checkout-summary>p,.checkout-summary small{color:#6f6f6f;line-height:1.5}.checkout-summary dl{margin:26px 0;border-top:1px solid #ececec;border-bottom:1px solid #ececec}.checkout-summary dl div{display:flex;justify-content:space-between;padding:13px 0}.checkout-summary dl div+div{border-top:1px solid #ececec}.checkout-summary dt{color:#777}.checkout-summary dd{margin:0;font-weight:600}.detail-actions .button.primary{min-width:190px}@media(max-width:850px){.public-header nav{display:none}.app-frame{display:block}.app-sidebar{position:fixed;left:0;top:0;width:238px;transform:translateX(-104%);transition:transform .18s ease;box-shadow:18px 0 50px rgba(0,0,0,.08)}.app-sidebar.open{transform:translateX(0)}.app-mobile-header{height:58px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:1px solid #ececec;background:#fff;position:sticky;top:0;z-index:45}.app-mobile-header .brand{color:#111}.app-sidebar-scrim{display:block;position:fixed;inset:0;border:0;background:rgba(0,0,0,.18);z-index:50}.checkout-layout{grid-template-columns:1fr;gap:34px;padding-top:48px}.checkout-summary{order:-1}}@media(prefers-reduced-motion:reduce){#root{transition:none}html.wcb-route-leaving #root{transform:none}html.wcb-route-leaving body::before{animation:none;width:70%}}''')

Path('src/phase4-public-flow.test.ts').write_text('''import { describe, expect, it } from "vitest"\nimport fs from "node:fs"\n\nconst app = fs.readFileSync(new URL("./App.tsx", import.meta.url), "utf8")\nconst home = fs.readFileSync(new URL("./Home.tsx", import.meta.url), "utf8")\nconst client = fs.readFileSync(new URL("./hostedProductClient.ts", import.meta.url), "utf8")\n\ndescribe("Phase 4 public/auth/purchase flow", () => {\n  it("keeps the landing template composition intact while adding only transition behavior", () => {\n    for (const marker of ["function Navbar()", "function EditorPreview()", "function Testimonials()", "function Pricing()", "function FAQ()", "function Footer()", "styles.topShell", "styles.resourceGrid"]) expect(home).toContain(marker)\n    expect(home).toContain('}, 120)')\n  })\n  it("removes app navigation from the public top bar and moves authenticated navigation to a sidebar", () => {\n    expect(app).toContain('const publicNav = [["Pricing", "/plans"]]')\n    expect(app).toContain('className={`app-sidebar ${menu ? "open" : ""}`}')\n    expect(app).toContain('["Marketplace", "/browse"]')\n  })\n  it("routes buying through authentication and checkout rather than a TEST entitlement", () => {\n    expect(app).toContain('go(signedIn ? checkoutTarget : `/login?next=${encodeURIComponent(checkoutTarget)}`)')\n    expect(app).toContain('function Checkout()')\n    expect(app).not.toContain('hostedProductClient.purchaseAndMaterialize(project.releaseId')\n  })\n  it("protects app routes with the real hosted session boundary", () => {\n    expect(app).toContain('return <Protected><Dashboard/></Protected>')\n    expect(app).toContain('return <Protected><Checkout/></Protected>')\n    expect(client).toContain('async authenticated()')\n  })\n  it("keeps real payment explicitly deferred instead of claiming success", () => {\n    expect(app).toContain('The real card-first provider connection belongs to Phase 5')\n    expect(app).toContain('Successful payment → entitlement → Dashboard')\n  })\n})\n''')
