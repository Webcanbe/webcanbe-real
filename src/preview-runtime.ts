import * as ts from "typescript"
import * as ReactModule from "react"
import { jsx, jsxs, Fragment } from "react/jsx-runtime"
import { createRoot } from "react-dom/client"

document.documentElement.dataset.wcbPreviewRuntime = "loaded"

type Payload = {
  files: Record<string, string>
  entry?: string
  title?: string
  route?: string
}

type Identity = { file: string; elementStart: number }

declare global {
  interface Window {
    __WCB_PROJECT_PAYLOAD__?: Payload
    __WCB_PREVIEW_ERROR__?: string
  }
}

const PreviewRouteContext = ReactModule.createContext(
  typeof location === "undefined" ? "/" : (location.hash.replace(/^#/, "") || "/"),
)

function currentHashRoute() {
  const value = location.hash.replace(/^#/, "") || "/"
  return value.startsWith("/") ? value : "/" + value
}

function HashRouterCompat({ children }: { children?: ReactModule.ReactNode }) {
  const [route, setRoute] = ReactModule.useState(currentHashRoute)
  ReactModule.useEffect(() => {
    const update = () => setRoute(currentHashRoute())
    addEventListener("hashchange", update)
    return () => removeEventListener("hashchange", update)
  }, [])
  return ReactModule.createElement(PreviewRouteContext.Provider, { value: route }, children)
}

function RouteCompat() { return null }

function RoutesCompat({ children }: { children?: ReactModule.ReactNode }) {
  const route = ReactModule.useContext(PreviewRouteContext)
  const entries = ReactModule.Children.toArray(children).filter(ReactModule.isValidElement) as Array<ReactModule.ReactElement<Record<string, unknown>>>
  const exact = entries.find(child => child.type === RouteCompat && child.props.path === route)
    ?? entries.find(child => child.type === RouteCompat && child.props.path === "*")
    ?? entries.find(child => child.type === RouteCompat && child.props.path === "/")
  return (exact?.props.element as ReactModule.ReactNode) ?? null
}

function NavLinkCompat(props: { to: string; children?: ReactModule.ReactNode; className?: string | ((value: { isActive: boolean }) => string) }) {
  const route = ReactModule.useContext(PreviewRouteContext)
  const active = route === props.to
  const className = typeof props.className === "function" ? props.className({ isActive: active }) : props.className
  return ReactModule.createElement("a", { href: "#" + props.to, className, "aria-current": active ? "page" : undefined }, props.children)
}

function clsxCompat(...values: unknown[]): string {
  const out: string[] = []
  const visit = (value: unknown) => {
    if (!value) return
    if (typeof value === "string" || typeof value === "number") { out.push(String(value)); return }
    if (Array.isArray(value)) { for (const item of value) visit(item); return }
    if (typeof value === "object") for (const [key, enabled] of Object.entries(value as Record<string, unknown>)) if (enabled) out.push(key)
  }
  for (const value of values) visit(value)
  return out.join(" ")
}

const RouterDomCompat = {
  HashRouter: HashRouterCompat,
  BrowserRouter: HashRouterCompat,
  Routes: RoutesCompat,
  Route: RouteCompat,
  NavLink: NavLinkCompat,
  Link: NavLinkCompat,
}

const packageModules: Record<string, unknown> = {
  react: { __esModule: true, default: ReactModule, ...ReactModule },
  "react/jsx-runtime": { __esModule: true, jsx, jsxs, Fragment },
  "react-dom/client": { __esModule: true, createRoot },
  "react-router-dom": { __esModule: true, ...RouterDomCompat },
  clsx: { __esModule: true, default: clsxCompat, clsx: clsxCompat },
}

const assetExt = /\.(?:svg|png|jpe?g|gif|webp|ico|woff2?|ttf|otf)$/i
const moduleExt = /\.(?:tsx?|jsx?|mts|cts|mjs|cjs)$/i

function decodeBase64(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function decodeText(value: string) {
  return new TextDecoder("utf-8", { fatal: true }).decode(decodeBase64(value))
}

function base64Url(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ""
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function intrinsicTag(node: ts.JsxOpeningLikeElement) {
  const text = node.tagName.getText(node.getSourceFile())
  return /^[a-z][a-z0-9-]*$/.test(text)
}

function instrument(file: string, sourceText: string) {
  const source = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") || file.endsWith(".jsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const insertions: Array<{ position: number; value: string }> = []
  const visit = (node: ts.Node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && intrinsicTag(node)) {
      const identity = base64Url(JSON.stringify({ file, elementStart: node.getStart(source) } satisfies Identity))
      insertions.push({ position: node.tagName.end, value: ` data-wcb-id="${identity}"` })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return insertions.sort((a, b) => b.position - a.position).reduce(
    (text, edit) => text.slice(0, edit.position) + edit.value + text.slice(edit.position),
    sourceText,
  )
}

function normalizePath(path: string) {
  const out: string[] = []
  for (const part of path.replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") continue
    if (part === "..") out.pop()
    else out.push(part)
  }
  return out.join("/")
}

function dirname(path: string) {
  const parts = path.split("/")
  parts.pop()
  return parts.join("/")
}

function extCandidates(path: string) {
  return [
    path,
    path + ".tsx",
    path + ".ts",
    path + ".jsx",
    path + ".js",
    path + ".mts",
    path + ".cts",
    path + ".mjs",
    path + ".cjs",
    path + ".json",
    path + ".css",
    path + ".svg",
    path + "/index.tsx",
    path + "/index.ts",
    path + "/index.jsx",
    path + "/index.js",
  ]
}

function resolveRequest(request: string, parent: string, files: Record<string, string>) {
  if (packageModules[request]) return { package: request }
  let base: string
  if (request.startsWith("@/")) base = "src/" + request.slice(2)
  else if (request.startsWith("./") || request.startsWith("../")) base = normalizePath(dirname(parent) + "/" + request)
  else if (files[request] !== undefined) base = request
  else throw new Error("Unsupported preview dependency: " + request)
  const found = extCandidates(base).find(candidate => files[candidate] !== undefined)
  if (!found) throw new Error("Preview dependency is unresolved: " + request + " from " + parent)
  return { file: found }
}

function spacing(value: string) {
  const number = Number(value)
  return Number.isFinite(number) ? number * 0.25 + "rem" : undefined
}

function cssEscape(value: string) {
  return value.replace(/([^a-zA-Z0-9_-])/g, "\\$1")
}

function tailwindRule(token: string) {
  const responsive = /^(sm|md|lg|xl|2xl):(.+)$/.exec(token)
  const bare = responsive ? responsive[2] : token
  const selector = "." + cssEscape(token)
  let body = ""
  let match: RegExpExecArray | null
  if ((match = /^(p|px|py|pt|pr|pb|pl)-(\d+(?:\.5)?)$/.exec(bare))) {
    const value = spacing(match[2]); if (!value) return ""
    const map: Record<string,string> = { p:"padding", px:"padding-inline", py:"padding-block", pt:"padding-top", pr:"padding-right", pb:"padding-bottom", pl:"padding-left" }
    body = `${map[match[1]]}:${value}`
  } else if ((match = /^(m|mx|my|mt|mr|mb|ml)-(\d+(?:\.5)?)$/.exec(bare))) {
    const value = spacing(match[2]); if (!value) return ""
    const map: Record<string,string> = { m:"margin", mx:"margin-inline", my:"margin-block", mt:"margin-top", mr:"margin-right", mb:"margin-bottom", ml:"margin-left" }
    body = `${map[match[1]]}:${value}`
  } else if (bare === "mx-auto") body = "margin-inline:auto"
  else if ((match = /^gap-(\d+(?:\.5)?)$/.exec(bare))) { const value = spacing(match[1]); if (!value) return ""; body = `gap:${value}` }
  else if (bare === "flex") body = "display:flex"
  else if (bare === "grid") body = "display:grid"
  else if ((match = /^grid-cols-(\d+)$/.exec(bare))) body = `grid-template-columns:repeat(${match[1]},minmax(0,1fr))`
  else if (bare === "items-center") body = "align-items:center"
  else if (bare === "items-start") body = "align-items:flex-start"
  else if (bare === "items-end") body = "align-items:flex-end"
  else if (bare === "justify-between") body = "justify-content:space-between"
  else if (bare === "justify-center") body = "justify-content:center"
  else if (bare === "justify-start") body = "justify-content:flex-start"
  else if (bare === "justify-end") body = "justify-content:flex-end"
  else if (bare === "bg-white") body = "background-color:#fff"
  else if (bare === "rounded") body = "border-radius:.25rem"
  else if (bare === "rounded-lg") body = "border-radius:.5rem"
  else if (bare === "font-semibold") body = "font-weight:600"
  else if (bare === "font-bold") body = "font-weight:700"
  else if (bare === "text-xs") body = "font-size:.75rem;line-height:1rem"
  else if (bare === "text-sm") body = "font-size:.875rem;line-height:1.25rem"
  else if (bare === "text-base") body = "font-size:1rem;line-height:1.5rem"
  else if (bare === "text-lg") body = "font-size:1.125rem;line-height:1.75rem"
  else if (bare === "text-xl") body = "font-size:1.25rem;line-height:1.75rem"
  else if (bare === "text-2xl") body = "font-size:1.5rem;line-height:2rem"
  else if (bare === "max-w-5xl") body = "max-width:64rem"
  else if (bare === "w-full") body = "width:100%"
  else if (bare === "h-full") body = "height:100%"
  else return ""
  const rule = `${selector}{${body}}`
  if (!responsive) return rule
  const min: Record<string,string> = { sm:"640px", md:"768px", lg:"1024px", xl:"1280px", "2xl":"1536px" }
  return `@media (min-width:${min[responsive[1]]}){${rule}}`
}

function generatedUtilityCss(files: Record<string,string>) {
  const tokens = new Set<string>()
  for (const [file, encoded] of Object.entries(files)) {
    if (!moduleExt.test(file)) continue
    const source = decodeText(encoded)
    for (const match of source.matchAll(/(?:className\s*=\s*["'`]|["'`]className["'`]\s*:\s*["'`])([^"'`]+)["'`]/g)) {
      for (const token of match[1].trim().split(/\s+/)) if (token) tokens.add(token)
    }
    for (const match of source.matchAll(/["'`]([a-z0-9_:/.[\]#%()-]+(?:\s+[a-z0-9_:/.[\]#%()-]+)+)["'`]/gi)) {
      for (const token of match[1].trim().split(/\s+/)) if (/^[a-z0-9_-]+(?::[a-z0-9_.-]+)*$/i.test(token)) tokens.add(token)
    }
  }
  return [...tokens].map(tailwindRule).filter(Boolean).join("\n")
}

function bootstrap(payload: Payload) {
  const files = payload.files
  const moduleCache = new Map<string, { exports: unknown }>()
  const styleCache = new Set<string>()
  const utilities = generatedUtilityCss(files)

  const addCss = (file: string, css: string) => {
    if (styleCache.has(file)) return
    styleCache.add(file)
    const style = document.createElement("style")
    style.dataset.wcbSource = file
    style.textContent = css.replace(/@import\s+["']tailwindcss["']\s*;?/g, "") + "\n" + utilities
    document.head.append(style)
  }

  const load = (file: string): unknown => {
    const cached = moduleCache.get(file)
    if (cached) return cached.exports
    const module = { exports: {} as unknown }
    moduleCache.set(file, module)

    if (file.endsWith(".json")) {
      module.exports = JSON.parse(decodeText(files[file]))
      return module.exports
    }
    if (file.endsWith(".css")) {
      addCss(file, decodeText(files[file]))
      module.exports = {}
      return module.exports
    }
    if (assetExt.test(file)) {
      const bytes = decodeBase64(files[file])
      const mime = file.endsWith(".svg") ? "image/svg+xml"
        : file.endsWith(".png") ? "image/png"
        : /\.jpe?g$/i.test(file) ? "image/jpeg"
        : file.endsWith(".gif") ? "image/gif"
        : file.endsWith(".webp") ? "image/webp"
        : file.endsWith(".woff2") ? "font/woff2"
        : file.endsWith(".woff") ? "font/woff"
        : "application/octet-stream"
      let binary = ""
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
      module.exports = "data:" + mime + ";base64," + btoa(binary)
      return module.exports
    }

    let source = decodeText(files[file])
    if (file.endsWith(".tsx") || file.endsWith(".jsx")) source = instrument(file, source)
    const output = ts.transpileModule(source, {
      fileName: file,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        resolveJsonModule: true,
      },
      reportDiagnostics: false,
    }).outputText

    const localRequire = (request: string) => {
      const resolved = resolveRequest(request, file, files)
      if ("package" in resolved && resolved.package) return packageModules[resolved.package]
      if ("file" in resolved && resolved.file) return load(resolved.file)
      throw new Error("Preview dependency resolution failed: " + request)
    }
    const fn = new Function("require", "module", "exports", "__filename", "__dirname", output)
    fn(localRequire, module, module.exports, file, dirname(file))
    return module.exports
  }

  // Imported project code receives no Webcanbe credential, cookie or platform secret.
  const blocked = () => Promise.reject(new Error("Preview networking is disabled."))
  Object.defineProperty(globalThis, "fetch", { value: blocked, configurable: false })
  Object.defineProperty(globalThis, "XMLHttpRequest", { value: class { constructor(){ throw new Error("Preview networking is disabled.") } }, configurable: false })
  Object.defineProperty(globalThis, "WebSocket", { value: class { constructor(){ throw new Error("Preview networking is disabled.") } }, configurable: false })
  Object.defineProperty(globalThis, "EventSource", { value: class { constructor(){ throw new Error("Preview networking is disabled.") } }, configurable: false })
  try { Object.defineProperty(navigator, "sendBeacon", { value: () => false, configurable: false }) } catch {}
  try { Object.defineProperty(globalThis, "RTCPeerConnection", { value: class { constructor(){ throw new Error("Preview networking is disabled.") } }, configurable: false }) } catch {}

  if (payload.title) document.title = payload.title
  if (typeof payload.route === "string" && payload.route.startsWith("/") && payload.route.length <= 2048) location.hash = "#" + payload.route
  const entry = payload.entry && files[payload.entry] !== undefined
    ? payload.entry
    : ["src/main.tsx","src/main.jsx","src/main.ts","src/main.js"].find(file => files[file] !== undefined)
  if (!entry) throw new Error("No supported React/Vite entry file was found.")
  load(entry)
}

function layoutContext(style: CSSStyleDeclaration) {
  if (style.position === "absolute" || style.position === "fixed") return "positioned"
  if (style.display.includes("flex")) return "flex"
  if (style.display.includes("grid")) return "grid"
  if (["block","inline-block","inline"].includes(style.display)) return "block"
  return "unknown"
}

function observations() {
  const result: Array<{
    identity: Identity
    tagName: string
    rect: { top:number; left:number; width:number; height:number }
    computed: Record<string,string>
    layoutContext: string
    parentIdentity?: Identity
    parentLayoutContext?: string
  }> = []
  for (const element of document.querySelectorAll<HTMLElement>("[data-wcb-id]")) {
    let identity: Identity
    try {
      const encoded = element.dataset.wcbId!.replace(/-/g, "+").replace(/_/g, "/")
      const padded = encoded + "=".repeat((4 - encoded.length % 4) % 4)
      const binary = atob(padded)
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
      identity = JSON.parse(new TextDecoder().decode(bytes))
    } catch { continue }
    const rect = element.getBoundingClientRect()
    if (!Number.isFinite(rect.left) || !Number.isFinite(rect.top) || !Number.isFinite(rect.width) || !Number.isFinite(rect.height)) continue
    const style = getComputedStyle(element)
    const computed: Record<string,string> = {}
    for (const property of ["display","position","backgroundColor","color","fontSize","fontWeight","padding","margin","gap","width","height","border","borderRadius"]) computed[property] = String((style as unknown as Record<string,string>)[property] ?? "")
    const parent = element.parentElement?.closest<HTMLElement>("[data-wcb-id]")
    let parentIdentity: Identity | undefined
    if (parent?.dataset.wcbId) {
      try {
        const encoded = parent.dataset.wcbId.replace(/-/g, "+").replace(/_/g, "/")
        const padded = encoded + "=".repeat((4 - encoded.length % 4) % 4)
        parentIdentity = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), char => char.charCodeAt(0))))
      } catch {}
    }
    result.push({
      identity,
      tagName: element.tagName.toLowerCase(),
      rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      computed,
      layoutContext: layoutContext(style),
      ...(parentIdentity ? { parentIdentity, parentLayoutContext: layoutContext(getComputedStyle(parent!)) } : {}),
    })
  }
  return result
}

async function render() {
  const payload = window.__WCB_PROJECT_PAYLOAD__
  if (!payload?.files || typeof payload.files !== "object") return
  try {
    bootstrap(payload)
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    await new Promise(resolve => setTimeout(resolve, 80))
    const script = document.createElement("script")
    script.id = "wcb-observation"
    script.type = "application/json"
    script.textContent = JSON.stringify({ route: location.pathname + location.search + location.hash, viewport: { width: innerWidth, height: innerHeight }, elements: observations() }).replace(/</g, "\\u003c")
    document.body.append(script)
    document.documentElement.dataset.wcbReady = "1"
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    window.__WCB_PREVIEW_ERROR__ = message
    document.body.innerHTML = `<main style="font:14px system-ui;padding:32px"><h1>Preview unavailable</h1><pre id="wcb-preview-error"></pre></main>`
    document.getElementById("wcb-preview-error")!.textContent = message
    const script = document.createElement("script")
    script.id = "wcb-observation"
    script.type = "application/json"
    script.textContent = JSON.stringify({ route: "/", viewport: { width: innerWidth, height: innerHeight }, elements: [], error: message }).replace(/</g, "\\u003c")
    document.body.append(script)
    document.documentElement.dataset.wcbReady = "1"
  }
}

window.addEventListener("wcb-project-payload", () => { void render() })
if (window.__WCB_PROJECT_PAYLOAD__) void render()
