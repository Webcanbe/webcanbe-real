from pathlib import Path

# 1) Make catalog browse/detail truly public read endpoints while keeping every private
# product action behind the existing authenticated+CSRF boundary.
controller = Path('src/webcanbe-engine/runtime/hostedProductController.ts')
ct = controller.read_text()
old = '''    try {
      const action = pathname.slice(prefix.length), session = await this.boundary.authenticate(request)
      const body = await bodyOf(request, action === "/seller/imports/zip/admit" ? 36 * 1024 * 1024 : undefined)
      const assertSession = async (expected: ServerSession = session) => {
'''
new = '''    try {
      const action = pathname.slice(prefix.length)
      if (action === "/catalog/browse" || action === "/catalog/detail") {
        const origin = this.boundary.origins.editorOrigin
        if (request.method !== "POST" || request.headers.origin !== origin || request.headers.host !== new URL(origin).host || !(request.socket as { encrypted?: boolean }).encrypted || request.headers["x-wcb-editor-key"] !== undefined || !/^application\\/json(?:;|$)/i.test(request.headers["content-type"] ?? "")) throw new AuthorityDenied()
        const body = await bodyOf(request)
        if (action === "/catalog/browse") {
          exact(body, ["query", "tags", "limit"])
          if (body.query !== undefined && typeof body.query !== "string" || body.tags !== undefined && (!Array.isArray(body.tags) || body.tags.some(tag => typeof tag !== "string")) || body.limit !== undefined && !Number.isSafeInteger(body.limit)) throw new Error("Invalid catalog filter.")
          json(response, 200, { listings: await this.store.browse({ query: body.query as string | undefined, tags: body.tags as string[] | undefined, limit: body.limit as number | undefined }) }); return true
        }
        exact(body, ["reference"]); const listing = await this.store.listingDetail(text(body, "reference"))
        json(response, listing ? 200 : 404, listing ? { listing } : { error: "Listing not found." }); return true
      }
      const session = await this.boundary.authenticate(request)
      const body = await bodyOf(request, action === "/seller/imports/zip/admit" ? 36 * 1024 * 1024 : undefined)
      const assertSession = async (expected: ServerSession = session) => {
'''
if old not in ct:
    raise SystemExit('product controller entry block not found')
ct = ct.replace(old, new)
# Remove the now-unreachable authenticated duplicate catalog handlers.
old_catalog = '''      if (action === "/catalog/browse") {
        exact(body, ["query", "tags", "limit"])
        if (body.query !== undefined && typeof body.query !== "string" || body.tags !== undefined && (!Array.isArray(body.tags) || body.tags.some(tag => typeof tag !== "string")) || body.limit !== undefined && !Number.isSafeInteger(body.limit)) throw new Error("Invalid catalog filter.")
        return send(200, { listings: await this.store.browse({ query: body.query as string | undefined, tags: body.tags as string[] | undefined, limit: body.limit as number | undefined }) })
      }
      if (action === "/catalog/detail") {
        exact(body, ["reference"]); const listing = await this.store.listingDetail(text(body, "reference"))
        return send(listing ? 200 : 404, listing ? { listing } : { error: "Listing not found." })
      }
'''
if old_catalog not in ct:
    raise SystemExit('old authenticated catalog handlers not found')
ct = ct.replace(old_catalog, '')
controller.write_text(ct)

# 2) Browser adapter: public catalog calls must not bootstrap an authenticated session.
client = Path('src/hostedProductClient.ts')
client_text = client.read_text()
post_marker = '''  private async post<T>(path: string, body: Record<string, unknown>, retry = true): Promise<T> {
'''
public_post = '''  private async publicPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const response = await this.request(path, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const value = await response.json().catch(() => ({})) as Record<string, unknown>
    if (!response.ok) throw new HostedProductError(response.status, typeof value.error === "string" ? value.error : "The public product request was refused.")
    return value as T
  }

'''
if public_post not in client_text:
    if post_marker not in client_text:
        raise SystemExit('client post marker not found')
    client_text = client_text.replace(post_marker, public_post + post_marker)
client_text = client_text.replace('return (await this.post<{ listings: HostedListing[] }>("/__webcanbe/api/product/catalog/browse", input)).listings', 'return (await this.publicPost<{ listings: HostedListing[] }>("/__webcanbe/api/product/catalog/browse", input)).listings')
client_text = client_text.replace('return (await this.post<{ listing: HostedListingDetail }>("/__webcanbe/api/product/catalog/detail", { reference })).listing', 'return (await this.publicPost<{ listing: HostedListingDetail }>("/__webcanbe/api/product/catalog/detail", { reference })).listing')
client.write_text(client_text)

# 3) OIDC callback lands on a fixed same-origin completion route. The browser then
# resumes the previously validated contextual next route from same-tab sessionStorage.
identity = Path('src/webcanbe-engine/runtime/hostedIdentity.ts')
it = identity.read_text()
old_location = 'Location: "/workspace/northstar"'
if old_location not in it:
    raise SystemExit('historical fixed auth redirect not found')
it = it.replace(old_location, 'Location: "/auth/complete"')
identity.write_text(it)

# 4) Hosted TLS server must serve index.html on intended SPA routes so direct loads and
# refreshes do not 404 after login, checkout, or normal navigation.
server = Path('src/webcanbe-engine/runtime/hostedEditorServer.ts')
st = server.read_text()
old_document = '''      const document = file === "" || file === "index.html" || /^workspace\\/(?:northstar|[a-f0-9-]{36})$/.test(file)
'''
new_document = '''      const spaDocument = /^(?:browse|plans|login|signup|auth\\/complete|dashboard|projects|purchases|settings|seller(?:\\/projects(?:\\/new)?)?|control|project\\/[a-z0-9-]+|checkout\\/[A-Za-z0-9_.:-]+|workspace\\/(?:northstar|[a-f0-9-]{36}))$/
      const document = file === "" || file === "index.html" || spaDocument.test(file)
'''
if old_document not in st:
    raise SystemExit('hosted document route expression not found')
st = st.replace(old_document, new_document)
server.write_text(st)

# 5) Client auth completion and hosted checkout detail hydration.
app = Path('src/App.tsx')
at = app.read_text()
auth_complete = '''
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

'''
marker = '\nfunction Checkout() {'
if auth_complete not in at:
    if marker not in at:
        raise SystemExit('checkout marker not found')
    at = at.replace(marker, '\n' + auth_complete + 'function Checkout() {', 1)

old_checkout_head = '''function Checkout() {
  const params = new URLSearchParams(window.location.search)
  const reference = params.get("project") ?? ""
  const project = projects.find(item => item.slug === reference)
  const price = project?.price ?? 0
  return <main className="checkout-page">'''
new_checkout_head = '''function Checkout() {
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
  return <main className="checkout-page">'''
if old_checkout_head not in at:
    raise SystemExit('checkout head not found')
at = at.replace(old_checkout_head, new_checkout_head)
at = at.replace('<span className="signal">Checkout</span><h1>Complete your purchase.</h1>', '<span className="signal">Checkout</span><h1>{message || "Complete your purchase."}</h1>')
# Add completion route before checkout protection.
old_route = 'if (path.startsWith("/checkout/")) return <Protected><Checkout/></Protected>;'
new_route = 'if (path === "/auth/complete") return <AuthComplete/>; if (path.startsWith("/checkout/")) return <Protected><Checkout/></Protected>;'
if old_route not in at:
    raise SystemExit('checkout route marker not found')
at = at.replace(old_route, new_route)
app.write_text(at)

# 6) Small completion-state styling. No landing composition changes.
css = Path('src/phase4-public-flow.css')
cs = css.read_text()
if '.auth-complete{' not in cs:
    cs += '\n.auth-complete{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:#fff;color:#111;text-align:center;padding:32px}.auth-complete .mark{margin-bottom:12px}.auth-complete h1{margin:0;font-size:24px;letter-spacing:-.035em;font-weight:520}\n'
css.write_text(cs)

# 7) Source-level regression tests for the three production seams.
Path('src/phase4-public-production.test.ts').write_text('''import { describe, expect, it } from "vitest"\nimport fs from "node:fs"\n\nconst app = fs.readFileSync("src/App.tsx", "utf8")\nconst client = fs.readFileSync("src/hostedProductClient.ts", "utf8")\nconst controller = fs.readFileSync("src/webcanbe-engine/runtime/hostedProductController.ts", "utf8")\nconst identity = fs.readFileSync("src/webcanbe-engine/runtime/hostedIdentity.ts", "utf8")\nconst server = fs.readFileSync("src/webcanbe-engine/runtime/hostedEditorServer.ts", "utf8")\n\ndescribe("Phase 4 public production seams", () => {\n  it("serves published catalog reads without requiring a private session", () => {\n    expect(client).toContain('this.publicPost<{ listings: HostedListing[] }>("/__webcanbe/api/product/catalog/browse"')\n    expect(client).toContain('this.publicPost<{ listing: HostedListingDetail }>("/__webcanbe/api/product/catalog/detail"')\n    const publicBranch = controller.indexOf('action === "/catalog/browse" || action === "/catalog/detail"')\n    const privateAuth = controller.indexOf('const session = await this.boundary.authenticate(request)')\n    expect(publicBranch).toBeGreaterThan(-1)\n    expect(privateAuth).toBeGreaterThan(publicBranch)\n    expect(controller).toContain('request.headers.origin !== origin')\n  })\n\n  it("finishes OIDC on a fixed same-origin completion route and resumes safe browser intent", () => {\n    expect(identity).toContain('Location: "/auth/complete"')\n    expect(identity).not.toContain('Location: "/workspace/northstar"')\n    expect(app).toContain('function AuthComplete()')\n    expect(app).toContain('sessionStorage.getItem("wcb-auth-next")')\n    expect(app).toContain('if (path === "/auth/complete") return <AuthComplete/>')\n  })\n\n  it("serves intended public and authenticated SPA routes on hard refresh", () => {\n    for (const token of ['auth\\/complete', 'dashboard', 'project\\/[a-z0-9-]+', 'checkout\\/[A-Za-z0-9_.:-]+', 'workspace\\/(?:northstar|[a-f0-9-]{36})']) expect(server).toContain(token)\n    expect(server).toContain('spaDocument.test(file)')\n  })\n\n  it("hydrates checkout from the real hosted public listing detail", () => {\n    expect(app).toContain('void hostedProductClient.detail(reference).then')\n    expect(app).toContain('setProject(hostedProject(listing))')\n  })\n})\n''')
