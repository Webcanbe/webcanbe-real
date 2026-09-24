import { EditorToolbar, EditorNavigation } from "./EditorChrome"
import { declaredPages, pageName, type EditorPage } from "./editorNavigation"
import { MousePointer2, Hand, ChevronDown, ArrowLeft, Settings2, Gauge, Code2, Upload } from "lucide-react"
import { OnboardingStrip } from "../../app-shell"
import { advanceOnboarding } from "../../shellState"
import type { Breakpoint } from "../adapters/react/projectStyles"
import type { RunnerObservation, PreviewInput } from "../runtime/controlledPreview"
import { lazy, Suspense, useEffect, useRef, useState, type MouseEvent } from "react"
import { isPreviewMessage, PREVIEW_CHANNEL } from "../bridge/previewProtocol"
import { safePreviewRoute } from "../bridge/previewRoute"
import { PREVIEW_SECURITY_NOTICE } from "../bridge/previewSecurity"
import type { CompatibilitySummary, MutationTransaction, PreviewElement, SourceTarget, StyleProperty, ViewportPreset } from "../core/types"
import type { CodeOpenLocation, SourceResponse } from "./CodeWorkspace"
const CodeWorkspace = lazy(() => import("./CodeWorkspace"))
import "../../editor-shell.css"
import "../../editor-split-fix.css"
import "../../editor-control-size.css"
import "./compatibleWorkspace.css"
import { samePointerFrame } from "./rasterFrame"
import SourceGestures from "./SourceGestures"
import { hostedEditorMode } from "./editorMode"
import AiWorkspacePanel from "./AiWorkspacePanel"
import AiListbox from "./AiListbox"
import { acceptsRevisionTransition, type RevisionState } from "./revisionTransition"
import { analytics } from "../../analytics"
import { hostedProductClient } from "../../hostedProductClient"

type ProjectInfo = { id: string; name: string; workspaceId?: string; imported: boolean; detection: { framework: string; tailwind: boolean; dependencies: Array<{ name: string; declared: string; resolved: boolean }> } }
type PreviewSession = { projectId: string; previewId: string; capability: string; expiresAt: string }
type RuntimeInfo = { profile: string; supported: boolean; dependencies: Array<{ name: string; declared: string; selected?: string; locked?: string }>; issues: Array<{ message: string; requiredCapability: string }>; notes: string[] }
type ApiResponse = SourceResponse & { updateKind?: string; breakpoints?: Breakpoint[]; styleDiagnostics?: string[]; transport?: "blob" | "http" | "raster" | "snapshot"; viewerUrl?: string; png?: string; sequence?: number; observation?: RunnerObservation; snapshotElements?: PreviewElement[]; snapshotViewport?: { width: number; height: number }; snapshotRoute?: string; generation?: string; origin?: string; state?: string; runtime?: RuntimeInfo; target?: SourceTarget; summary?: CompatibilitySummary; transaction?: MutationTransaction; diff?: string; project?: ProjectInfo; session?: PreviewSession; html?: string; source?: string; revision?: string; targets?: SourceTarget[]; archive?: string; error?: string }

const hostedMode = hostedEditorMode()

const editableLabels: Partial<Record<StyleProperty, string>> = {
  backgroundColor: "Background", color: "Text color", fontSize: "Font size", fontWeight: "Font weight", padding: "Padding", paddingX: "Horizontal padding", paddingY: "Vertical padding", margin: "Margin", gap: "Gap", width: "Width", height: "Height", maxWidth: "Max width", border: "Border", borderRadius: "Radius", alignItems: "Align items", justifyContent: "Justify content", alignSelf: "Align self", justifySelf: "Justify self", order: "Order", flexGrow: "Grow", flexShrink: "Shrink", gridTemplateColumns: "Grid columns", gridTemplateRows: "Grid rows", gridColumn: "Grid column", gridRow: "Grid row",
}

function workspaceProjectId() { const id = window.location.pathname.split("/").filter(Boolean).at(-1); return id && id !== "northstar" ? id : "phase1-fixture" }

function isTextEditingTarget(target: EventTarget | null) {
  const element = target instanceof Element ? target : null
  return Boolean(element?.closest('input, textarea, select, [contenteditable="true"], .cm-editor'))
}

export default function CompatibleWorkspace({agentChatEnabled=false}:{agentChatEnabled?:boolean}={}) {
  const frame = useRef<HTMLIFrameElement>(null)
  const previewModeButton = useRef<HTMLButtonElement>(null)
  const [copiedText, setCopiedText] = useState<string>()
  const previewContainer = useRef<HTMLDivElement>(null)
  const [availableWidth, setAvailableWidth] = useState(1280)
  const [availableHeight, setAvailableHeight] = useState(() => typeof window === "undefined" ? 900 : Math.max(320, window.innerHeight - 180))
  const [leftPanel, setLeftPanel] = useState<"pages" | "layers" | "assets" | "project">("pages")
  const [pages,setPages] = useState<EditorPage[]>([{path:"/",name:"Home"}])
  const [projectFiles,setProjectFiles] = useState<string[]>([])
  const [updatedAt,setUpdatedAt] = useState<string>()
  const [zoom,setZoom] = useState<number | "fit">("fit")
  const [runtime, setRuntime] = useState<RuntimeInfo>()
  const [selectMode, setSelectMode] = useState(true)
  const selectModeRef = useRef(selectMode)
  selectModeRef.current = selectMode
  const routeHash = useRef("#/")
  const routePath = useRef("/")
  const [routeInput, setRouteInput] = useState("/")
  const [previewState, setPreviewState] = useState("stopped")
  const activeGeneration = useRef("")
  const rasterBusy = useRef(false)
  const rasterSequence = useRef(0)
  const rasterQueued = useRef<Array<{ input: PreviewInput; sequence: number; generation: string; revision: string; epoch: number; frame?: ApiResponse }>>([])
  const currentRasterOperation = useRef<(input?: PreviewInput, sequence?: number) => Promise<void>>(async () => {})
  const refreshAttempt = useRef(0)
  const lastRaster = useRef<ApiResponse | undefined>(undefined)
  const inspected = useRef("")
  const selectionSource = useRef<"runtime" | "source">("runtime")
  const inspectSequence = useRef(0)
  const connectionEpoch = useRef(0)
  const [projectId, setProjectId] = useState(workspaceProjectId)
  const [project, setProject] = useState<ProjectInfo>()
  const [session, setSession] = useState<PreviewSession>()
  const trackLeague = (kind:string) => { if(hostedMode && session) void hostedProductClient.buildLeagueTrack(kind, `${projectId}:${new Date().toISOString().slice(0,10)}`, projectId).catch(()=>{}) }
  const [hovered, setHovered] = useState<PreviewElement>()
  const [selected, setSelected] = useState<PreviewElement>()
  const [target, setTarget] = useState<SourceTarget>()
  const [summary, setSummary] = useState<CompatibilitySummary>()
  const [message, setMessage] = useState("Starting a sandboxed project preview…")
  const [text, setText] = useState("")
  const [breakpoints, setBreakpoints] = useState<Breakpoint[]>([])
  const [authoringBreakpoint, setAuthoringBreakpoint] = useState("base")
  const [newBreakpoint,setNewBreakpoint]=useState("new:mobile")
  const [newProperty,setNewProperty]=useState<StyleProperty>("padding")
  const [newValue,setNewValue]=useState("24px")
  const [styleDiagnostics, setStyleDiagnostics] = useState<string[]>([])
  const [effectScope, setEffectScope] = useState("source")
  const [viewport, setViewport] = useState<ViewportPreset>("desktop")
  const rasterWidth = useRef(1280)
  rasterWidth.current = { mobile: 390, tablet: 768, desktop: 1280 }[viewport]
  const [diff, setDiff] = useState("")
  const [accessKey, setAccessKey] = useState("")
  const [csrf, setCsrf] = useState("")
  const csrfToken = useRef("")
  const connecting = useRef(false)
  const cleanupPending = useRef<Promise<void>>(Promise.resolve())
  const [workspaces, setWorkspaces] = useState<string[]>([])
  const [workspaceId, setWorkspaceId] = useState("")
  const [chatAccountScope, setChatAccountScope] = useState("")
  const [hostedProjects, setHostedProjects] = useState<ProjectInfo[]>([])
  const headers = () => ({ "Content-Type": "application/json", ...(hostedMode ? { "X-WCB-CSRF": csrfToken.current } : { "X-WCB-Editor-Key": accessKey }) })
  function invalidateRaster() {
    frame.current?.contentWindow?.postMessage({ channel: "wcb-raster", type: "invalidate", generation: activeGeneration.current }, "*")
    rasterQueued.current = []
  }
  async function connectHosted() {
    if(connecting.current)return
    connecting.current=true
    invalidateRaster(); ++connectionEpoch.current; activeGeneration.current=""; rasterQueued.current=[]
    try {
    const response = await fetch("/__webcanbe/auth/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
    if (!response.ok) { csrfToken.current=""; setCsrf(""); setMessage("Sign in to open your projects."); return }
    const data = await response.json(); csrfToken.current=data.csrf; setChatAccountScope(String(data.user?.email ?? ""))
    const authorizedHeaders = { "Content-Type": "application/json", "X-WCB-CSRF": data.csrf }
    const [workspaceResponse, projectResponse] = await Promise.all([fetch("/__webcanbe/api/workspaces", { method: "POST", headers: authorizedHeaders, body: "{}" }), fetch("/__webcanbe/api/projects", { method: "POST", headers: authorizedHeaders, body: "{}" })])
    const workspaceData = workspaceResponse.ok ? await workspaceResponse.json() as {workspaces:string[]} : {workspaces:[]}
    const projectData = projectResponse.ok ? await projectResponse.json() as {projects:ProjectInfo[]} : {projects:[]}
    const requested=projectData.projects.find(item=>item.id===workspaceProjectId())
    const saved=localStorage.getItem("wcb-selected-workspace") || ""
    const selected=requested?.workspaceId || (workspaceData.workspaces.includes(saved)?saved:workspaceData.workspaces[0] || "")
    if(requested?.workspaceId && requested.workspaceId!==saved){localStorage.setItem("wcb-selected-workspace",requested.workspaceId);window.dispatchEvent(new Event("wcb:workspaces-updated"))}
    setWorkspaces(workspaceData.workspaces)
    setWorkspaceId(selected)
    setHostedProjects(projectData.projects)
    if(workspaceProjectId()==="phase1-fixture"){
      const first=projectData.projects.find(item=>item.workspaceId===selected)
      if(first)setProjectId(first.id)
    }
    setCsrf(data.csrf); setConnectionAttempt(value => value + 1)
    } finally { connecting.current=false }
  }
  async function signIn() {
    const response = await fetch("/__webcanbe/auth/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
    if (!response.ok) { setMessage("Sign-in is unavailable."); return }
    window.location.assign((await response.json()).authorizationUrl)
  }
  useEffect(() => { if (hostedMode) void connectHosted().catch(() => setMessage("Sign-in connection is unavailable.")) }, [])
  const [connectionAttempt, setConnectionAttempt] = useState(0)
  const keyInput = useRef<HTMLInputElement>(null)
  const revision = useRef("")
  const [currentRevision, setCurrentRevision] = useState("")
  const responseOrigins = useRef(new WeakMap<object, RevisionState>())
  function responseIsCurrent(data: object) { return acceptsRevisionTransition({ revision: revision.current, connection: connectionEpoch.current }, responseOrigins.current.get(data)) }
  function updateRevision(value: string | undefined, data: object) {
    if (!value || !responseIsCurrent(data)) return false
    revision.current = value; setCurrentRevision(value); return true
  }
  const [preview, setPreview] = useState<{ url: string; html?: string; transport: "blob" | "http" | "raster" | "snapshot"; generation: string }>()
  const [snapshotElements, setSnapshotElements] = useState<PreviewElement[]>([])
  const [snapshotViewport, setSnapshotViewport] = useState({ width: 1280, height: 900 })
  const previewUrl = preview?.url ?? ""
  const viewportWidth = { mobile: 390, tablet: 768, desktop: 1280 }[viewport]
  const frameHeight = preview?.transport === "snapshot" ? snapshotViewport.height : 900
  const scale = zoom === "fit" ? Math.max(0.1, Math.min(1, availableWidth / viewportWidth, availableHeight / frameHeight)) : zoom

  useEffect(() => {
    let active=true
    setPages([{path:"/",name:"Home"}]);setProjectFiles([]);setUpdatedAt(undefined)
    if(session && currentRevision) void (async()=>{
      const [listing,historyData]=await Promise.all([request("files"),request("history")])
      if(!active || !listing.ok || listing.data.revision!==currentRevision)return
      const files=listing.data.files?.map(item=>item.file)??[];setProjectFiles(files)
      const head=historyData.data.history?.revisions?.find(item=>item.revisionId===currentRevision)
      if(historyData.ok && historyData.data.revision===currentRevision && head)setUpdatedAt(head.createdAt)
      const routeFiles=files.filter(file=>/(?:^|\/)(?:App|routes?|router|pages?)\.[jt]sx?$/i.test(file)).slice(0,20)
      const contents=await Promise.all(routeFiles.map(file=>request("files",{file})))
      if(active)setPages(declaredPages(contents.filter(result=>result.ok&&result.data.revision===currentRevision).map(result=>result.data.source??"")))
    })().catch(()=>{/* Navigation metadata never blocks the source editor. */})
    return()=>{active=false}
  },[session,currentRevision])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url) }, [preview])
  const [targets, setTargets] = useState<SourceTarget[]>([])
  const [source, setSource] = useState("")
  const [pending, setPending] = useState(false)
  const [surface, setSurface] = useState<"canvas" | "code" | "split" | "history">(() => { const mode = new URLSearchParams(window.location.search).get("mode"); return mode === "code" || mode === "split" || mode === "history" ? mode : "canvas" })
  const [previewOnly, setPreviewOnly] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const aiButton = useRef<HTMLButtonElement>(null)
  function closeAi() { setAiOpen(false); window.setTimeout(() => aiButton.current?.focus(), 0) }
  const [sourceUIOpened, setSourceUIOpened] = useState(() => surface !== "canvas")
  function openSurface(value: "canvas" | "code" | "split" | "history") { setPreviewOnly(false); if (value !== "canvas") setSourceUIOpened(true); if (value !== surface) { analytics.capture("wcb_editor_mode_changed", { source: "workspace", editor_mode: value === "canvas" ? "visual" : value }); trackLeague(({canvas:"visual_opened",code:"code_opened",split:"split_opened",history:"history_opened"} as const)[value]) } setSurface(value); const url = new URL(window.location.href); url.searchParams.set("mode", value); window.history.replaceState({}, "", url) }
  useEffect(()=>{if(viewport==="mobile")trackLeague("mobile_preview_used");else if(viewport==="tablet")trackLeague("tablet_preview_used")},[viewport,session])
  useEffect(()=>{if(aiOpen)trackLeague("ai_panel_opened")},[aiOpen,session])
  useEffect(()=>{if(selected)trackLeague("first_element_selected")},[selected,session])
  const [sourceEpoch, setSourceEpoch] = useState(0)
  const codeLocationSequence = useRef(0)
  const [codeLocation, setCodeLocation] = useState<CodeOpenLocation>()
  function openCodeLocation(file: string, start = 0, end = start) {
    setCodeLocation({ file, start, end, sequence: ++codeLocationSequence.current })
    openSurface("code")
  }

  async function request(path: string, body: Record<string, unknown> = {}, signal?: AbortSignal) {
    // Code may have refreshed accepted source while a prior Apply response is in flight.
    // Preserve both the unchanged local state and the server-checked causal predecessor.
    const initiated = { revision: revision.current, connection: connectionEpoch.current,
      baseRevision: ["code", "mutate", "ai", "undo", "redo", "revert"].includes(path) && typeof body.expectedRevision === "string" ? body.expectedRevision : undefined }
    const response = await fetch(`/__webcanbe/api/projects/${projectId}/${path}`, { method: "POST", headers: headers(), signal, body: JSON.stringify({ ...(revision.current ? { expectedRevision: revision.current } : {}), viewport, ...body, previewId: session?.previewId, capability: session?.capability }) })
    const contentType = response.headers.get("content-type") ?? ""
    const data = contentType.includes("application/json")
      ? await response.json() as ApiResponse & { result?: object }
      : { error: `${path} returned ${response.status} without a JSON response. Retry the action.` } as ApiResponse & { result?: object }
    responseOrigins.current.set(data, initiated)
    if (data.result && typeof data.result === "object") responseOrigins.current.set(data.result, initiated)
    return { ok: response.ok, status: response.status, data }
  }

  async function refreshCompatibility() {
    const epoch = connectionEpoch.current, expectedRevision = revision.current
    const response = await request("compatibility")
    if (epoch !== connectionEpoch.current || expectedRevision !== revision.current) return
    if (response.ok && responseIsCurrent(response.data)) { updateRevision(response.data.revision, response.data); setSummary(response.data.summary); setTargets(response.data.targets ?? []); setBreakpoints(response.data.breakpoints ?? []); setStyleDiagnostics(response.data.styleDiagnostics ?? []) }
  }

  async function inspect(element: PreviewElement) {
    const sequence = ++inspectSequence.current, generation = activeGeneration.current, epoch = connectionEpoch.current
    setMessage("Reading the element’s real source location…")
    const response = await request("inspect", { identity: element.identity })
    if (sequence !== inspectSequence.current || generation !== activeGeneration.current || epoch !== connectionEpoch.current || !responseIsCurrent(response.data)) return
    if (!response.ok || !response.data.target) { setTarget(undefined); setSelected(undefined); inspected.current = ""; setMessage(response.data.error ?? "This element is preview-only."); return }
    updateRevision(response.data.revision, response.data)
    setSource(response.data.source ?? "")
    setTarget(response.data.target)
    setBreakpoints(response.data.breakpoints ?? [])
    setStyleDiagnostics(response.data.styleDiagnostics ?? [])
    setText(response.data.target.text ?? "")
    setMessage(response.data.target.capabilities.visualEdit ? "Connected to the real source file." : response.data.target.unavailableReasons.visualEdit ?? "This element is available in code, but has limited visual editing.")
  }

  useEffect(() => {
    invalidateRaster(); ++connectionEpoch.current
    if (hostedMode ? !csrf || projectId === "phase1-fixture" : !accessKey) { setMessage(hostedMode ? "Sign in, then choose or import a project." : "Enter the local editor access key printed by the development server."); return }
    routeHash.current = "#/"; routePath.current = "/"
    try { const saved = sessionStorage.getItem('wcb-preview-route:' + projectId); if (safePreviewRoute(saved)) routePath.current = saved! } catch { /* Route persistence is optional; credentials never enter storage. */ }
    setRouteInput(routePath.current); setRuntime(undefined); activeGeneration.current = ""; revision.current = ""; setCurrentRevision(""); rasterQueued.current = []
    setSession(undefined); setPreview(undefined); setTarget(undefined); setSelected(undefined); setHovered(undefined)
    let cancelled = false, connected: PreviewSession | undefined
    const stop = (old: PreviewSession) => { cleanupPending.current = fetch('/__webcanbe/api/projects/' + projectId + '/preview', { method: 'POST', keepalive: true, headers: headers(), body: JSON.stringify({ previewId: old.previewId, capability: old.capability, command: 'stop' }) }).then(() => {}, () => {}) }
    void (async () => {
      await cleanupPending.current
      if(cancelled)return
      const response = await fetch(`/__webcanbe/api/projects/${projectId}/session`, { method: "POST", headers: headers(), body: "{}" })
      const data = await response.json() as ApiResponse
      if (cancelled) { if (data.session) stop(data.session); return }
      if (!response.ok || !data.session || !data.project) { setMessage(data.error ?? "This project could not start a preview."); return }
      connected = data.session
      advanceOnboarding(1, window.location.pathname.split("/").filter(Boolean).at(-1) || projectId); setLeftPanel("pages"); setRuntime(data.runtime); setProject(data.project); if (data.revision) { revision.current = data.revision; setCurrentRevision(data.revision) } setSession(data.session); setMessage("Project source is ready. See the verified preview boundary below.")
      analytics.capture("wcb_workspace_opened", { source: "direct", editor_mode: surface === "canvas" ? "visual" : surface })
    })().catch(() => { if (!cancelled) setMessage("The local Compatible engine is unavailable.") })
    const pagehide = () => { if (connected) stop(connected) }
    window.addEventListener("pagehide", pagehide)
    return () => { cancelled = true; ++connectionEpoch.current; window.removeEventListener("pagehide", pagehide); if (connected) stop(connected) }
  }, [projectId, accessKey, csrf, connectionAttempt])

  async function refreshPreview(incremental = false) {
    const epoch = connectionEpoch.current, expectedRevision = revision.current, attempt = ++refreshAttempt.current
    const current = () => epoch === connectionEpoch.current && expectedRevision === revision.current && attempt === refreshAttempt.current
    selectionSource.current = "runtime"
    invalidateRaster(); setPreviewState("starting"); activeGeneration.current = ""; inspected.current = ""; ++inspectSequence.current
    setSelected(undefined); setHovered(undefined); setTarget(undefined)
    let response
    try { response = await request("preview", { ...(incremental && preview?.transport === "raster" ? { command: "update", generation: preview.generation } : { route: routePath.current }), ...(expectedRevision ? { expectedRevision } : {}) }) }
    catch { if (current()) { setPreviewState("failed"); setMessage("Preview connection failed. Retry from Preview controls.") } return }
    if (!current()) return
    if (!response.ok && response.status === 429 && preview?.transport === "snapshot") {
      setPreviewState("cooldown")
      setMessage(response.data.error ?? "Free managed preview is cooling down; retrying shortly.")
      window.setTimeout(() => { if (current()) void refreshPreview(true) }, 10_500)
      return
    }
    if (!response.ok && incremental && preview?.transport !== "snapshot") response = await request("preview", { route: routePath.current, ...(expectedRevision ? { expectedRevision } : {}) })
    if (!current()) return
    if (response.data.updateKind) setMessage(response.data.updateKind === "css-hot-update" ? "CSS updated inside the controlled runner; application state retained." : response.data.updateKind === "react-fast-refresh" ? "React component refreshed inside the controlled runner; compatible component state retained." : response.data.updateKind === "generation-restart" ? "Structural source change started a new controlled generation." : "Incremental rebuild applied; document reloaded with route and viewport retained.")
    updateRevision(response.data.revision, response.data)
    if (response.ok && response.data.transport === "snapshot" && response.data.png && response.data.generation) {
      activeGeneration.current = response.data.generation
      setSnapshotElements(response.data.snapshotElements ?? [])
      setSnapshotViewport(response.data.snapshotViewport ?? { width: rasterWidth.current, height: 900 })
      if (safePreviewRoute(response.data.snapshotRoute)) { routePath.current = response.data.snapshotRoute!; setRouteInput(response.data.snapshotRoute!) }
      setPreview({ url: "data:image/png;base64," + response.data.png, transport: "snapshot", generation: response.data.generation })
      setPreviewState("ready")
      setMessage("Managed Browser Run preview is ready. Select a rendered element to edit its real source.")
    } else if (response.ok && response.data.transport === "raster" && response.data.viewerUrl && response.data.generation) {
      activeGeneration.current = response.data.generation; rasterSequence.current = 0; lastRaster.current = undefined
      setPreview({ url: response.data.viewerUrl, transport: "raster", generation: response.data.generation })
      setPreviewState("ready")
      if (!response.data.updateKind) setMessage("Controlled preview is ready.")
    } else if (response.ok && response.data.html && response.data.generation) {
      activeGeneration.current = response.data.generation
      setPreview({ html: response.data.html, url: URL.createObjectURL(new Blob([response.data.html], { type: "text/html" })), transport: response.data.transport ?? "blob", generation: response.data.generation })
    } else { if (!preview) setPreview(undefined); setPreviewState("failed"); setMessage(response.data.error ?? "Preview unavailable. Inspect source below.") }
  }
  useEffect(() => { if (!session) return; if (revision.current) { void refreshCompatibility(); void refreshPreview(); return } const epoch = connectionEpoch.current; void (async () => { await refreshCompatibility(); if (epoch === connectionEpoch.current) await refreshPreview() })() }, [session])

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== "null" || event.source !== frame.current?.contentWindow || !isPreviewMessage(event.data) || event.data.session !== session?.previewId || !activeGeneration.current || event.data.generation !== activeGeneration.current) return
      if (event.data.type === "ready") setPreviewState("ready")
      if (event.data.type === "failed" || event.data.type === "expired") { setPreviewState(event.data.type); setMessage(event.data.type === "expired" ? "Preview session expired. Connect to renew." : "Preview did not become ready. Check its route and supported profile."); setSelected(undefined); setHovered(undefined); setTarget(undefined) }
      if (event.data.type === "clear") { setSelected(undefined); setHovered(undefined); setTarget(undefined); inspected.current = ""; ++inspectSequence.current }
      if (event.data.type === "route") {
        let changed = false
        if (event.data.hash) { changed = routeHash.current !== event.data.hash; routeHash.current = event.data.hash }
        if (safePreviewRoute(event.data.route)) {
          changed = changed || routePath.current !== event.data.route
          routePath.current = event.data.route; setRouteInput(event.data.route)
          try { sessionStorage.setItem('wcb-preview-route:' + projectId, event.data.route) } catch { /* No credential storage. */ }
        }
        // A route observation invalidates geometry and any in-flight source inspection,
        // not the source revision or the authority required for a later explicit edit.
        if (changed) { setSelected(undefined); setHovered(undefined); setTarget(undefined); inspected.current = ""; ++inspectSequence.current }
      }
      if (event.data.type === "hover") setHovered(event.data.element)
      if (event.data.type === "select") {
        selectionSource.current = "runtime"
        setSelected(event.data.element)
        const key = activeGeneration.current + ':' + event.data.element.identity.file + ':' + event.data.element.identity.elementStart
        if (inspected.current !== key) { inspected.current = key; void inspect(event.data.element) }
      }
      if (event.data.type === "drag") {
        setSelected(event.data.element)
        setMessage("Drag intent cannot be inferred safely. Select an existing semantic layout property in the inspector.")
      }
    }
    window.addEventListener("message", receive)
    return () => window.removeEventListener("message", receive)
  }, [session, preview, projectId])

  function deliverRaster(data = lastRaster.current) {
    if (!data?.png || !data.observation || data.generation !== activeGeneration.current) return
    frame.current?.contentWindow?.postMessage({ channel: "wcb-raster", type: "frame", generation: data.generation, sequence: data.sequence, png: data.png, revision: data.revision, focused: data.observation.focused, accessibility: data.observation.accessibility, ...data.observation.viewport, select: selectModeRef.current }, "*")
  }
  async function rasterOperation(input?: PreviewInput, sequence = rasterSequence.current) {
    if (preview?.transport !== "raster" || !activeGeneration.current) return
    if (rasterBusy.current) {
      if (input) {
        const queue = rasterQueued.current, last = queue.at(-1)
        if (input.type === "text" && last?.input.type === "text" && last.generation === activeGeneration.current && last.revision === revision.current && last.epoch === connectionEpoch.current && last.input.text.length + input.text.length <= 4096) last.input = { type: "text", text: last.input.text + input.text }
        else if (queue.length < 64) queue.push({ input, sequence, generation: activeGeneration.current, revision: revision.current, epoch: connectionEpoch.current, frame: input.type === "pointer" ? lastRaster.current : undefined })
        else setMessage("Preview input queue is full. Wait for the frame before continuing.")
      }
      return
    }
    rasterBusy.current = true
    const generation = activeGeneration.current, epoch = connectionEpoch.current, requestRevision = revision.current
    try {
      if (input) {
        if (input.type === "pointer") selectionSource.current = "runtime"
        const result = await request("preview", { command: "input", generation, sequence, input, expectedRevision: requestRevision })
        if (generation !== activeGeneration.current || epoch !== connectionEpoch.current || requestRevision !== revision.current) return
        if (!result.ok) throw new Error(result.data.error ?? "Preview input rejected.")
      }
      let result = await request("preview", { command: "capture", generation, expectedRevision: requestRevision })
      if (generation !== activeGeneration.current || epoch !== connectionEpoch.current || requestRevision !== revision.current) return
      if (result.ok && result.data.observation && result.data.observation.viewport.width !== rasterWidth.current) {
        const resized = await request("preview", { command: "input", generation, expectedRevision: requestRevision, sequence: result.data.sequence, input: { type: "viewport", width: rasterWidth.current, height: 900 } })
        if (generation !== activeGeneration.current || epoch !== connectionEpoch.current || requestRevision !== revision.current) return
        if (!resized.ok) throw new Error(resized.data.error ?? "Viewport rejected.")
        result = await request("preview", { command: "capture", generation, expectedRevision: requestRevision })
      }
      if (generation !== activeGeneration.current || epoch !== connectionEpoch.current || requestRevision !== revision.current) return
      if (!result.ok || !result.data.observation) throw new Error(result.data.error ?? "Preview expired. Connect to renew.")
      const data = result.data, observation = data.observation!
      if (input?.type === "key" && input.key === "CopySelection" && observation.clipboard !== undefined) {
        const value = observation.clipboard
        const stillCurrent = () => generation === activeGeneration.current && epoch === connectionEpoch.current && requestRevision === revision.current
        if (!value) setMessage("No preview text is selected.")
        else void navigator.clipboard.writeText(value).then(() => { if (stillCurrent()) { setCopiedText(undefined); setMessage("Preview selection copied.") } }).catch(() => { if (stillCurrent()) { setCopiedText(value); setMessage("Copy the selected preview text below.") } })
      }
      rasterSequence.current = data.sequence!; lastRaster.current = data; deliverRaster(data)
      if (routePath.current !== observation.route) {
        selectionSource.current = "runtime"
        routePath.current = observation.route; setRouteInput(observation.route)
        try { sessionStorage.setItem('wcb-preview-route:' + projectId, observation.route) } catch { /* No credentials. */ }
        setTarget(undefined); inspected.current = ""; ++inspectSequence.current
      }
      if (selectionSource.current === "runtime") setSelected(observation.selection ?? undefined)
      if (observation.selection && selectionSource.current === "runtime") {
        const key = generation + ':' + observation.selection.identity.file + ':' + observation.selection.identity.elementStart
        if (inspected.current !== key) { inspected.current = key; void inspect(observation.selection) }
      } else if (selectionSource.current === "runtime") { setTarget(undefined); inspected.current = ""; ++inspectSequence.current }
      setPreviewState("ready")
    } catch (error) {
      if (generation === activeGeneration.current && epoch === connectionEpoch.current && requestRevision === revision.current) { invalidateRaster(); activeGeneration.current = ""; setPreviewState("expired"); setSelected(undefined); setTarget(undefined); setMessage(String(error instanceof Error ? error.message : error)) }
    } finally {
      rasterBusy.current = false
      const queued = rasterQueued.current.shift()
      if (queued && queued.generation === activeGeneration.current && queued.revision === revision.current && queued.epoch === connectionEpoch.current) {
        if (queued.input.type === "pointer" && queued.sequence !== rasterSequence.current && !samePointerFrame(queued.frame, lastRaster.current)) setMessage("The frame changed before selection. Select the element again.")
        else void currentRasterOperation.current(queued.input, rasterSequence.current)
      }
    }
  }
  useEffect(() => { currentRasterOperation.current = rasterOperation })
  useEffect(() => {
    if (preview?.transport !== "raster") return
    void currentRasterOperation.current()
    const timer = setInterval(() => { void currentRasterOperation.current() }, 1500)
    const receive = (event: MessageEvent) => {
      const data = event.data
      if (event.source !== frame.current?.contentWindow || event.origin !== "null" || data?.channel !== "wcb-raster" || data.generation !== activeGeneration.current || data.sequence !== rasterSequence.current) return
      if (data.type === "focus-exit") { previewModeButton.current?.focus(); return }
      if (data.type === "input" && ["pointer", "scroll", "key", "text"].includes(data.input?.type)) void currentRasterOperation.current(data.input, data.sequence)
    }
    window.addEventListener("message", receive)
    return () => { clearInterval(timer); window.removeEventListener("message", receive) }
  // Mode changes configure the viewer without invalidating its displayed frame.
  }, [preview, session])
  useEffect(() => {
    if (preview?.transport === "raster") void rasterOperation()
    if (preview?.transport === "snapshot") void refreshPreview()
    if (selected && session) void inspect(selected)
  }, [viewport])

  function configurePreview() {
    if (!session || !preview) return
    if (preview.transport === "raster") { deliverRaster(); return }
    frame.current?.contentWindow?.postMessage({ channel: PREVIEW_CHANNEL, type: "configure", session: session.previewId, generation: preview.generation, active: selectMode, hash: routeHash.current }, "*")
  }

  useEffect(() => { configurePreview() }, [selectMode, preview])

  async function sourceAccepted(data: SourceResponse) {
    if (!updateRevision(data.revision, data)) return
    advanceOnboarding(2, window.location.pathname.split("/").filter(Boolean).at(-1) || projectId)
    activeGeneration.current = ""; rasterQueued.current = []
    setDiff(data.diff ?? "")
    inspected.current = ""; ++inspectSequence.current
    setSelected(undefined); setHovered(undefined); setTarget(undefined)
    setSourceEpoch(value => value + 1)
    const epoch = connectionEpoch.current, acceptedRevision = revision.current
    await refreshCompatibility()
    if (epoch !== connectionEpoch.current || acceptedRevision !== revision.current) return
    await refreshPreview(true)
  }

  async function mutate(edit: ({ type: "reorder"; value: string } | { type: "text"; value: string } | { type: "style" | "layout" | "responsive-create"; property: StyleProperty; value: string } | { type: "responsive"; property: StyleProperty; value: string; viewport: ViewportPreset }) & { breakpoint?: string; scope?: string }) {
    if (!selected || !session || pending) return
    const epoch = connectionEpoch.current
    setPending(true)
    const response = await request("mutate", { identity: target?.identity ?? selected.identity, expectedRevision: target?.identity.revisionId ?? revision.current, idempotencyKey: crypto.randomUUID(), edit: { ...edit, scope: effectScope } }).finally(() => setPending(false))
    if (epoch !== connectionEpoch.current) return
    if (!response.ok || !response.data.transaction?.success) { setMessage(response.data.transaction?.error ?? response.data.error ?? "The source change was not safe to apply."); return }
    setDiff(response.data.diff ?? "")
    setMessage(`Saved ${response.data.transaction.editType} transaction to the real source.`)
    analytics.capture("wcb_visual_save_completed", { editor_mode: "visual", state: "success", source: "workspace" })
    await sourceAccepted(response.data)
  }

  async function history(action: "undo" | "redo") {
    const epoch = connectionEpoch.current
    if (pending) return
    setPending(true)
    const response = await request(action, { idempotencyKey: crypto.randomUUID() }).finally(() => setPending(false))
    if (epoch !== connectionEpoch.current) return
    if (!response.ok || !response.data.transaction) { setMessage(response.data.error ?? `Nothing safe to ${action}.`); return }
    setDiff(response.data.diff ?? "")
    setMessage(`${action === "undo" ? "Undid" : "Redid"} the real source transaction.`)
    await sourceAccepted(response.data)
  }

  async function importProject(file: File) {
    if (file.size > 25 * 1024 * 1024) { setMessage("ZIP upload limit: 25 MiB."); return }
    const bytes = new Uint8Array(await file.arrayBuffer())
    let binary = ""
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
    const response = await fetch("/__webcanbe/api/projects/import", { method: "POST", headers: headers(), body: JSON.stringify({ name: file.name, archive: btoa(binary), ...(hostedMode ? { workspaceId } : {}) }) })
    const data = await response.json() as ApiResponse
    if (!response.ok || !data.project) { setMessage(data.error ?? "Import rejected."); return }
    window.history.replaceState({}, "", `/workspace/${data.project.id}`)
    setProjectId(data.project.id)
  }
  async function exportProject() {
    analytics.capture("wcb_export_started", { source: "workspace", editor_mode: surface === "canvas" ? "visual" : surface })
    trackLeague("export_started")
    const response = await request("export")
    if (!response.ok || !response.data.archive) { analytics.capture("wcb_export_completed", { source: "workspace", state: "failure" }); setMessage(response.data.error ?? "Export unavailable."); return }
    const bytes = Uint8Array.from(atob(response.data.archive), ch => ch.charCodeAt(0))
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/zip" }))
    const link = document.createElement("a"); link.href = url; link.download = `${project?.name ?? "project"}.zip`; link.click(); setMessage("Accepted source ZIP is ready to download."); advanceOnboarding(3, window.location.pathname.split("/").filter(Boolean).at(-1) || projectId); setTimeout(() => URL.revokeObjectURL(url), 1000)
    analytics.capture("wcb_export_completed", { source: "workspace", state: "success" })
  }

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const editing = isTextEditingTarget(event.target)
      const key = event.key.toLowerCase()
      const mod = event.metaKey || event.ctrlKey

      if (event.key === "Escape") {
        if (shortcutsOpen) { event.preventDefault(); setShortcutsOpen(false); return }
        if (!editing) {
          setSelected(undefined); setHovered(undefined); setTarget(undefined); inspected.current = ""; ++inspectSequence.current
          setSelectMode(true)
        }
        return
      }
      if (editing) return

      if (!mod && !event.altKey && event.key === "?") { event.preventDefault(); setShortcutsOpen(true); return }
      if (mod && !event.altKey && key === "z") { event.preventDefault(); void history(event.shiftKey ? "redo" : "undo"); return }
      if (event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && key === "y") { event.preventDefault(); void history("redo"); return }
      if (mod && !event.altKey && (event.key === "+" || event.key === "=")) { event.preventDefault(); setZoom(Math.min(2, Math.round((scale + .1) * 10) / 10)); return }
      if (mod && !event.altKey && event.key === "-") { event.preventDefault(); setZoom(Math.max(.25, Math.round((scale - .1) * 10) / 10)); return }
      if (mod && !event.altKey && key === "0") { event.preventDefault(); setZoom(1); return }
      if (mod && !event.altKey && key === "1") { event.preventDefault(); setZoom("fit"); return }
      if (mod && event.shiftKey && !event.altKey && key === "e") { event.preventDefault(); if (session) void exportProject(); return }

      if (!mod && !event.altKey && !event.shiftKey && key === "v") { event.preventDefault(); setSelectMode(true); return }
      if (!mod && !event.altKey && !event.shiftKey && key === "i") { event.preventDefault(); setSelectMode(false); return }
      if (!mod && !event.altKey && event.shiftKey && key === "v") { event.preventDefault(); openSurface("canvas"); return }
      if (!mod && !event.altKey && event.shiftKey && key === "c") { event.preventDefault(); openSurface("code"); return }
      if (!mod && !event.altKey && event.shiftKey && key === "s") { event.preventDefault(); openSurface("split"); return }
      if (!mod && !event.altKey && event.shiftKey && key === "h") { event.preventDefault(); openSurface("history"); return }
      if (!mod && !event.altKey && event.shiftKey && key === "m") { event.preventDefault(); setViewport("mobile"); return }
      if (!mod && !event.altKey && event.shiftKey && key === "t") { event.preventDefault(); setViewport("tablet"); return }
      if (!mod && !event.altKey && event.shiftKey && key === "d") { event.preventDefault(); setViewport("desktop") }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [shortcutsOpen, pending, session, viewport, project?.name, scale])

  useEffect(() => {
    const container = previewContainer.current
    if (!container) return
    const observer = new ResizeObserver(entries => setAvailableWidth(entries[0]?.contentRect.width ?? container.clientWidth))
    const updateAvailableHeight = () => setAvailableHeight(Math.max(320, window.innerHeight - 180))
    observer.observe(container)
    window.addEventListener("resize", updateAvailableHeight)
    return () => { observer.disconnect(); window.removeEventListener("resize", updateAvailableHeight) }
  }, [])

  const activeBox = selected ?? hovered
  const activeBreakpoint = breakpoints.find(item => item.id === authoringBreakpoint)
  const styleOrigins = target?.styleOrigins.filter(origin => origin.editable && (authoringBreakpoint === "base" ? !origin.prefix && !origin.media : activeBreakpoint?.media ? origin.media === activeBreakpoint.media : origin.kind === "tailwind" && origin.prefix === activeBreakpoint?.prefix)) ?? []
  const inspectorGroups: Array<{ label: string; properties: StyleProperty[] }> = [
    { label: "Layout", properties: ["alignItems", "justifyContent", "alignSelf", "justifySelf", "order", "flexGrow", "flexShrink", "gridTemplateColumns", "gridTemplateRows", "gridColumn", "gridRow", "gap"] },
    { label: "Size", properties: ["width", "height", "maxWidth"] },
    { label: "Spacing", properties: ["padding", "paddingX", "paddingY", "margin"] },
    { label: "Typography", properties: ["fontSize", "fontWeight", "color"] },
    { label: "Fill", properties: ["backgroundColor"] },
    { label: "Border / Radius", properties: ["border", "borderRadius"] },
    { label: "Shadow", properties: [] },
  ]
  const frameStyle = { width: viewportWidth, height: frameHeight, transform: `scale(${scale})` }
  function selectSnapshot(event: MouseEvent<HTMLImageElement>) {
    if (!selectMode || preview?.transport !== "snapshot") return
    const rect = event.currentTarget.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const x = (event.clientX - rect.left) * snapshotViewport.width / rect.width
    const y = (event.clientY - rect.top) * snapshotViewport.height / rect.height
    const matches = snapshotElements.filter(element => x >= element.rect.left && y >= element.rect.top && x <= element.rect.left + element.rect.width && y <= element.rect.top + element.rect.height)
      .sort((a,b) => a.rect.width * a.rect.height - b.rect.width * b.rect.height)
    const element = matches[0]
    if (!element) { setSelected(undefined); setTarget(undefined); setMessage("No source-mapped element at that point."); return }
    selectionSource.current = "runtime"; setSelected(element); setHovered(undefined)
    const key = activeGeneration.current + ":" + element.identity.file + ":" + element.identity.elementStart
    inspected.current = key; void inspect(element)
  }

  const visibleHostedProjects=hostedProjects.filter(item=>item.workspaceId===(project?.workspaceId || workspaceId))
  return <><OnboardingStrip navigate={path => window.location.assign(path)}/><main className={`compatible-workspace${previewOnly ? " preview-only" : ""}${preview?.transport === "snapshot" && surface === "canvas" ? " full-page-canvas" : ""}`} data-source-revision={currentRevision}>
    <EditorToolbar name={project?.name} revision={currentRevision} updatedAt={updatedAt} surface={surface} openSurface={openSurface} connected={Boolean(session)} previewOnly={previewOnly} onPreview={() => { if (previewOnly) { setPreviewOnly(false); setSelectMode(true) } else { openSurface("canvas"); setPreviewOnly(true); setSelectMode(false) } }} onExport={() => void exportProject()} onUndo={() => void history("undo")} onRedo={() => void history("redo")} onProject={() => setLeftPanel("project")} onShortcuts={() => setShortcutsOpen(true)} onText={() => {setAiOpen(false); const field = document.querySelector<HTMLTextAreaElement>(".compatible-inspector textarea"); if(field)field.focus();else setMessage("Select a text layer to edit its content.")}}/>
    {shortcutsOpen && <div className="compatible-shortcuts-backdrop" onMouseDown={() => setShortcutsOpen(false)}><section className="compatible-shortcuts" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onMouseDown={event => event.stopPropagation()}><header><div><small>Keyboard shortcuts</small><h2>Move through the editor without leaving the source boundary.</h2></div><button type="button" onClick={() => setShortcutsOpen(false)} aria-label="Close shortcuts">Esc</button></header><div className="compatible-shortcut-grid"><div><span>Undo accepted source change</span><kbd>⌘/Ctrl Z</kbd></div><div><span>Redo accepted source change</span><kbd>⇧⌘Z / Ctrl Y</kbd></div><div><span>Save current code file</span><kbd>⌘/Ctrl S</kbd></div><div><span>Save all code drafts</span><kbd>⇧⌘/Ctrl S</kbd></div><div><span>Quick open source file</span><kbd>⌘/Ctrl P</kbd></div><div><span>Find / replace current file</span><kbd>⌘/Ctrl F</kbd></div><div><span>Search accepted project source</span><kbd>⇧⌘/Ctrl F</kbd></div><div><span>Visual surface</span><kbd>Shift V</kbd></div><div><span>Code surface</span><kbd>Shift C</kbd></div><div><span>Split surface</span><kbd>Shift S</kbd></div><div><span>Source history</span><kbd>Shift H</kbd></div><div><span>Select elements</span><kbd>V</kbd></div><div><span>Interact with preview</span><kbd>I</kbd></div><div><span>Mobile / Tablet / Desktop</span><kbd>Shift M / T / D</kbd></div><div><span>Export accepted source</span><kbd>⇧⌘/Ctrl E</kbd></div><div><span>Clear selection / return to Select</span><kbd>Esc</kbd></div><div><span>Open this shortcut guide</span><kbd>?</kbd></div></div><p>While a text field or the code editor is focused, typing and CodeMirror’s own undo/redo take priority. Project-level undo/redo is intentionally not triggered there. Draft backup is recovery-only; preview, history, project search and export use accepted source until Save succeeds.</p></section></div>}
    <div className="compatible-layout">
      <aside className="compatible-files" aria-label="Project and source navigation">
        <EditorNavigation panel={leftPanel} setPanel={setLeftPanel} pages={pages.some(page=>page.path===routeInput)?pages:[...pages,{path:routeInput,name:pageName(routeInput)}]} route={routeInput} onPage={path=>{setRouteInput(path);routePath.current=path;setSelected(undefined);setTarget(undefined);if(preview?.transport==="raster")void rasterOperation({type:"navigate",route:path});else void refreshPreview();setLeftPanel("layers")}} targets={targets} selected={selected} onSelect={item=>{selectionSource.current="source";const element:PreviewElement={identity:item.identity,tagName:item.elementName,rect:{top:0,left:0,width:0,height:0},computed:{},layoutContext:"unknown"};setSelected(element);setAiOpen(false);void inspect(element);if(session&&preview&&preview.transport!=="raster"&&preview.transport!=="snapshot")frame.current?.contentWindow?.postMessage({channel:PREVIEW_CHANNEL,type:"configure",session:session.previewId,generation:preview.generation,active:selectMode,selection:item.identity},"*")}} files={projectFiles} onFile={file=>file?openCodeLocation(file,0,0):openSurface("code")} connected={Boolean(session)} onProject={()=>setLeftPanel("project")}/>
        <div id="editor-project-panel" role="tabpanel" aria-label="Project" hidden={leftPanel !== "project"}>
          <aside className="project-settings-nav"><button className="project-settings-back" onClick={()=>setLeftPanel("pages")}><ArrowLeft/>Back to editor</button><small>Project settings</small><button className="active" onClick={()=>document.querySelector<HTMLElement>('.project-settings-main')?.scrollTo({top:0,behavior:"smooth"})}><Settings2/>General</button><button onClick={()=>document.querySelector<HTMLElement>('.project-settings-runtime')?.scrollIntoView({behavior:'smooth'})}><Gauge/>Compatibility</button><button onClick={()=>{setLeftPanel("pages");openSurface("history")}}><Code2/>Source history</button></aside>
          <main className="project-settings-main"><header><div><small>Project settings</small><h1>{project?.name || "Workspace project"}</h1><p>Connection, source import, and runtime compatibility for this project.</p></div><button onClick={()=>setLeftPanel("pages")} aria-label="Close project settings">Done</button></header>
          <section className="project-settings-section"><h2>Project source</h2><p>Connect to the canonical source session before importing or editing.</p>
          <div className="project-settings-fields">{hostedMode ? <>
            <label>Project{visibleHostedProjects.length > 0 ? <AiListbox label="Hosted project" value={projectId} onChange={id => { window.history.replaceState({}, "", `/workspace/${id}`); setProjectId(id) }} options={visibleHostedProjects.map(item => ({value:item.id,label:item.name}))}/> : <span>{project?.name || "Current working copy"}</span>}</label>
            {workspaces.length > 0 && <label>Import workspace<AiListbox label="Import workspace" value={workspaceId} onChange={setWorkspaceId} options={workspaces.map(id => ({value:id,label:id}))}/></label>}
            <button className="project-settings-connect" onClick={() => void (csrf ? connectHosted() : signIn())}>{csrf ? "Reconnect source session" : "Sign in to connect"}</button>
          </> : <><label>Local editor access<input ref={keyInput} type="password" autoComplete="off" aria-label="Local editor access key" /></label><button className="project-settings-connect" onClick={() => { setAccessKey(keyInput.current?.value ?? ""); setConnectionAttempt(value => value + 1) }}>Connect / renew session</button></>}</div></section>
          <section className="project-settings-section"><h2>Import source</h2><p>Replace this working copy from a compatible React/Vite ZIP. Existing revision history remains authoritative.</p><label className="project-import-drop"><Upload/><span><b>Choose a React/Vite ZIP</b><small>ZIP only · source is validated before acceptance</small></span><input type="file" accept=".zip" disabled={hostedMode ? !csrf || !workspaceId : !session} onChange={event => { const file = event.target.files?.[0]; if (file) void importProject(file) }} /></label></section>
          <section className="project-settings-section project-settings-runtime"><h2>Compatibility</h2><p>Measured from the current accepted source, not from a generated preview.</p><div className="project-runtime-grid"><article><small>Visual compatibility</small><strong>{summary ? `${summary.score}%` : "…"}</strong><span>{summary ? `${summary.full} full · ${summary.partial} partial · ${summary.codeOnly} code only` : session ? "Analysis unavailable" : "Connect to inspect source"}</span></article><article><small>Runtime profile</small><strong>{runtime?.profile || (session ? "Unavailable" : "Not connected")}</strong><span>{runtime ? runtime.supported ? "Dedicated profile available" : "Runtime unavailable" : "Connect to inspect runtime"}</span></article></div>{runtime && <details><summary>Runtime details</summary>{runtime.dependencies.map(item => <p key={item.name}>{item.name}: {item.declared} → {item.selected ?? "unavailable"}{item.locked ? ` (lock ${item.locked})` : ""}</p>)}{runtime.issues.map((issue, index) => <p key={index}>{issue.message} Requires: {issue.requiredCapability}</p>)}{runtime.notes.map(note => <p key={note}>{note}</p>)}</details>}</section>
          </main>
        </div>
      </aside>
      <section className={`compatible-preview-shell ${surface === "split" ? "split-mode" : ""}`}>

        {(surface === "canvas" || surface === "split") && <details className="editor-preview-controls"><summary>Preview controls <ChevronDown/></summary><div className="compatible-preview-head"><span><i/> Sandboxed source preview <small data-preview-state={previewState}>{previewState}</small></span>{(preview?.transport === "http" || preview?.transport === "raster") && <form onSubmit={event => { event.preventDefault(); if (!safePreviewRoute(routeInput)) { setMessage("Enter a local preview path such as /projects/42?view=detail#notes."); return } if (preview?.transport === "raster") void rasterOperation({ type: "navigate", route: routeInput }); else { routePath.current = routeInput; void refreshPreview() } }}><input aria-label="Preview path" value={routeInput} onChange={event => setRouteInput(event.target.value)} /><button type="submit">Open route</button></form>}{preview?.transport === "raster" && <><button type="button" onClick={() => void rasterOperation({ type: "history", action: "back" })}>Back</button><button type="button" onClick={() => void rasterOperation({ type: "history", action: "forward" })}>Forward</button><button type="button" onClick={() => void rasterOperation({ type: "history", action: "reload" })}>Refresh preview</button></>}<button type="button" disabled={!session} onClick={() => { invalidateRaster(); ++connectionEpoch.current; activeGeneration.current = ""; ++inspectSequence.current; void request("preview", { command: "stop" }).then(response => { if (response.ok) { setPreview(undefined); setSession(undefined); activeGeneration.current = ""; setPreviewState("stopped"); setSelected(undefined); setHovered(undefined); setTarget(undefined); setMessage("Preview stopped. Connect to start a new session.") } else setMessage(response.data.error ?? "Stop rejected.") }) }}>Stop preview</button><button ref={previewModeButton} type="button" aria-pressed={!selectMode} disabled={preview?.transport === "snapshot"} title={preview?.transport === "snapshot" ? "Managed snapshot preview supports source-mapped selection; live interaction requires the persistent hosted runner." : selectMode ? "Interact with preview (I)" : "Select elements (V)"} onClick={() => setSelectMode(value => !value)}>{preview?.transport === "snapshot" ? "Select elements" : selectMode ? "Interact with preview" : "Select elements"}</button><label>Viewport <AiListbox label="Viewport" value={viewport} onChange={value => setViewport(value as ViewportPreset)} options={[{value:"mobile",label:"Mobile"},{value:"tablet",label:"Tablet"},{value:"desktop",label:"Desktop"}]}/></label></div></details>}
        {sourceUIOpened && <Suspense fallback={<p>Loading source editor…</p>}><CodeWorkspace key={projectId} projectId={projectId} request={request} epoch={sourceEpoch} connected={Boolean(session)} visible={surface} openLocation={codeLocation} onAccepted={sourceAccepted} /></Suspense>}
        {(surface === "canvas" || surface === "split") && <div className="editor-canvas-tools"><button aria-label="Select elements" title="Select and edit elements" aria-pressed={selectMode} onClick={()=>setSelectMode(true)}><MousePointer2/></button><button aria-label="Pan and interact with preview" title="Pan, scroll, and use the page without editing" aria-pressed={!selectMode} disabled={preview?.transport==="snapshot"} onClick={()=>setSelectMode(false)}><Hand/></button><span className="editor-canvas-divider"/><details className="editor-zoom-menu"><summary aria-label="Canvas zoom">{Math.round(scale*100)}%</summary><div><button onClick={()=>setZoom(Math.min(2,Math.round((scale+.1)*10)/10))}>Zoom in <kbd>⌘+</kbd></button><button onClick={()=>setZoom(Math.max(.25,Math.round((scale-.1)*10)/10))}>Zoom out <kbd>⌘−</kbd></button><button onClick={()=>setZoom(1)}>Zoom to 100% <kbd>⌘0</kbd></button><button onClick={()=>setZoom("fit")}>Zoom to fit <kbd>⌘1</kbd></button></div></details><a className="editor-canvas-upgrade" href="/plans">Plans</a></div>}
        <div hidden={surface !== "canvas" && surface !== "split"} ref={previewContainer} className={`compatible-frame-wrap ${viewport}`}>{!previewUrl && !preview ? <div className="editor-canvas-empty"><b>{session ? "Preparing your preview" : "Your canvas is ready"}</b><p>{session ? "Source tools remain available while the preview starts." : "Connect or open a project to see its live page here."}</p><button type="button" onClick={() => setLeftPanel("project")}>Project connection</button></div> : null}<div className="editor-artboard" style={{width:viewportWidth*scale,height:frameHeight*scale}}><div className="preview-device" style={{...frameStyle, visibility: !previewUrl && !preview ? "hidden" : "visible"}}><div className="editor-artboard-label">{viewport === "mobile" ? "Phone" : viewport === "tablet" ? "Tablet" : "Desktop"} <span>{viewportWidth}</span></div><div className="editor-preview-viewport">{preview?.transport === "snapshot" ? <img key={preview.generation} src={preview.url} alt="Managed production project preview" draggable={false} onClick={selectSnapshot} style={{width:"100%",height:frameHeight,objectFit:"fill",display:"block",cursor:selectMode?"crosshair":"default"}} /> : <iframe key={preview?.generation ?? "unavailable"} ref={frame} referrerPolicy="no-referrer" onLoad={configurePreview} title="Running imported React/Vite project" src={preview?.html ? undefined : previewUrl || undefined} srcDoc={preview?.html ?? (previewUrl ? undefined : "<p>Preview unavailable. Source inspection remains available.</p>")} sandbox="allow-scripts" />}{!previewOnly && activeBox && activeBox.rect.width > 0 && activeBox.rect.height > 0 && <div className={`canvas-outline ${selected ? "selected" : ""}`} style={{ left: activeBox.rect.left, top: activeBox.rect.top, width: activeBox.rect.width, height: activeBox.rect.height }}>{selected && <span>{selected.tagName} · {selected.identity.file.replace("src/", "")}</span>}{selected && target && selectionSource.current === "runtime" && target.identity.elementStart === selected.identity.elementStart && target.identity.file === selected.identity.file && <SourceGestures key={JSON.stringify([projectId, preview?.generation, revision.current, selected.identity, selected.rect, viewport, authoringBreakpoint, effectScope, scale, routeInput, previewState])} target={target} origins={effectScope === "source" ? styleOrigins : target.repeated ? [] : styleOrigins.filter(origin => !origin.shared)} scale={scale} breakpoint={authoringBreakpoint} disabled={pending || !session || !selectMode || previewState !== "ready"} onEdit={edit => void mutate(edit)} />}</div>}</div></div></div></div>
      </section>
      <aside className="compatible-inspector" aria-label="Element properties">
        <div className="inspector-heading editor-inspector-tabs" role="tablist" aria-label="Inspector panels"><button ref={aiButton} role="tab" aria-selected={aiOpen} aria-controls="ai-workspace-panel" onClick={()=>setAiOpen(true)}>Agent</button><button role="tab" aria-selected={!aiOpen} aria-controls="editor-style-panel" onClick={()=>setAiOpen(false)}>Style</button></div>
        <div id="ai-workspace-panel"><AiWorkspacePanel open={aiOpen} enabled={agentChatEnabled} onClose={closeAi} connected={Boolean(session && currentRevision)} currentRevision={currentRevision} storageScope={hostedMode ? chatAccountScope && workspaceId ? `${chatAccountScope}:${workspaceId}:${projectId}` : "" : `local:${projectId}`} target={target} request={request} onApplied={sourceAccepted} /></div>
        <div id="editor-style-panel" role="tabpanel" aria-label="Style" hidden={aiOpen}>
        {!selected && <div className="empty-inspector"><b>Select a layer</b><p>Click an element on the canvas or choose one from Layers.</p></div>}
        {selected && Object.keys(selected.computed).length > 0 && <div className="editor-measurements">{[{title:"Position",keys:["position"]},{title:"Size",keys:["width","height"]},{title:"Layout",keys:["display","gap","padding"]}].map(group=><section key={group.title}><h3>{group.title}</h3>{group.keys.filter(key=>selected.computed[key]&&!styleOrigins.some(origin=>origin.property===key)).map(key=><label key={key}><span>{key[0].toUpperCase()+key.slice(1)}</span><input aria-label={`Computed ${key}`} title="Computed value. Edit an available source declaration below or use Code." readOnly value={selected.computed[key]}/></label>)}</section>)}</div>}
        {target?.capabilities.text && <label className="inspector-control">Text {target.textShared && <small>Shared literal · {target.textFile ?? target.identity.file}</small>}<textarea value={text} onChange={(event) => setText(event.target.value)} /><button type="button" onClick={() => void mutate({ type: "text", value: text })}>Apply text change</button></label>}
        {styleOrigins.length > 0 && <div className="style-controls">{inspectorGroups.filter(group => styleOrigins.some(origin => group.properties.includes(origin.property))).map(group => { const origins = styleOrigins.filter(origin => group.properties.includes(origin.property)); return <section className="inspector-group" key={group.label}><h3>{group.label}</h3>{origins.map((styleOrigin) => { const inputId = `wcb-property-${styleOrigin.property}-${styleOrigin.kind}-${styleOrigin.range?.start ?? 0}`; return <label className="inspector-control" key={inputId}><span>{editableLabels[styleOrigin.property] ?? styleOrigin.property}<em>{styleOrigin.kind}</em></span><small>{styleOrigin.file} {styleOrigin.selector || styleOrigin.prefix || "base"} · {styleOrigin.scope}</small><div><input id={inputId} data-wcb-property={styleOrigin.property} defaultValue={styleOrigin.value?.replace(/^['"]|['"]$/g, "")} key={styleOrigin.value} /><button type="button" onClick={(event) => { const input = event.currentTarget.previousElementSibling as HTMLInputElement; void mutate({ type: "style", property: styleOrigin.property, value: input.value, breakpoint: authoringBreakpoint }) }}>Save</button></div><button className="inspector-breakpoint-save" type="button" onClick={() => { const input = document.getElementById(inputId) as HTMLInputElement | null; if (input) void mutate({ type: "responsive", property: styleOrigin.property, value: input.value, viewport }) }}>Save at {viewport}</button></label> })}</section> })}</div>}
        <details className="editor-source-details"><summary>Source & breakpoints</summary>
        {selected && <div className="source-location"><small>Source location</small><b>{selected.identity.file}</b><span>{target?.nodeKind ?? "native"} · JSX offset {selected.identity.elementStart} · {selected.layoutContext} inside {selected.parentLayoutContext ?? "unknown"}</span>{target && <button type="button" onClick={() => openCodeLocation(target.identity.file, target.sourceRange.start, target.sourceRange.end)}>Open exact code location</button>}</div>}
        {target && <div className="style-analysis"><p>{target.effectScope}</p><label>Authoring breakpoint <AiListbox label="Authoring breakpoint" value={authoringBreakpoint} onChange={setAuthoringBreakpoint} options={breakpoints.map(item => ({value:item.id,label:`${item.label}${item.min !== undefined ? ` ≥ ${item.min}px` : ""}${item.max !== undefined ? ` ≤ ${item.max}px` : ""}`}))}/></label><label>Effect scope <AiListbox label="Effect scope" value={effectScope} onChange={value => setEffectScope(value as typeof effectScope)} options={[{value:"source",label:"Edit identified source (all matching uses)"},{value:"instance",label:"Selected runtime instance only (shared sources refused)"}]}/></label><small>Mobile / tablet / desktop are preview widths. Choose an existing source breakpoint to edit its override; base values may also affect wider viewports.</small><details><summary>Effective values and source origins</summary>{target.styleOrigins.map((origin, index) => <p key={index}>{origin.property}: {origin.effective ? selected?.computed[origin.property] || origin.value : origin.value} · {origin.effective ? "effective at viewport" : origin.active ? "active candidate" : "inactive/conditional"}<br/>{origin.kind} · {origin.file} {origin.selector || origin.prefix || "base"} {origin.media}<br/>{origin.scope}<br/>{origin.reason}</p>)}{styleDiagnostics.map((item, index) => <p key={index}>{item}</p>)}<p>Inherited or unresolved computed values are read-only; use Code.</p></details>{!styleOrigins.length && <p>No safe existing declaration at this breakpoint. Code remains available.</p>}</div>}
        </details>
        {target && <details className="responsive-construction"><summary>Create responsive override</summary><p>Uses the selected element’s existing base class or utility. The change affects every matching source use.</p><label>New override breakpoint<AiListbox label="New override breakpoint" value={newBreakpoint} onChange={setNewBreakpoint} options={[{value:"new:mobile",label:"CSS mobile ≤ 767px"},{value:"new:tablet",label:"CSS tablet 768–1023px"},{value:"new:desktop",label:"CSS desktop ≥ 1024px"},...breakpoints.filter(b=>b.id!=="base").map(b=>({value:b.id,label:b.label}))]}/></label><label>Override property<AiListbox label="Override property" value={newProperty} onChange={value=>setNewProperty(value as StyleProperty)} options={Object.entries(editableLabels).map(([property,label])=>({value:property,label}))}/></label><label>Override value<input aria-label="Override value" value={newValue} onChange={event=>setNewValue(event.target.value)}/></label><button disabled={pending} onClick={()=>void mutate({type:"responsive-create",property:newProperty,value:newValue,breakpoint:newBreakpoint})}>Create source override</button></details>}
        {target?.reorder && <div className="semantic-reorder"><small>Reorder adjacent JSX siblings in the source Flex/Grid parent</small><button type="button" disabled={target.reorder.previous === undefined || pending} onClick={() => void mutate({ type: "reorder", value: "previous" })}>Move before previous sibling</button><button type="button" disabled={target.reorder.next === undefined || pending} onClick={() => void mutate({ type: "reorder", value: "next" })}>Move after next sibling</button></div>}
        {target?.capabilities.layout && <div className="semantic-controls"><small>Semantic layout</small><button type="button" onClick={() => void mutate({ type: "layout", property: "gap", value: "24px" })}>Set gap 24px</button><button type="button" onClick={() => void mutate({ type: "layout", property: "justifyContent", value: "space-between" })}>Distribute items</button></div>}
        {target && !target.capabilities.visualEdit && <div className="limited-editing"><b>Visual editing unavailable</b><br/>{target.unavailableReasons.visualEdit ?? "WebCanBe cannot safely identify a static source mutation."}<br/><button type="button" onClick={() => openCodeLocation(target.identity.file, target.sourceRange.start, target.sourceRange.end)}>Open code location</button></div>}
        {target?.component?.resolved && <div className="limited-editing">Component definition: {target.component.file} · {target.component.definitionName}<br/><button type="button" onClick={() => openCodeLocation(target.component!.file, target.component!.range.start, target.component!.range.end)}>Open component definition</button></div>}
        {target?.propOrigin && <div className="limited-editing">Prop {target.propOrigin.name} → {target.propOrigin.localName}. Invocation values remain Code-only.{target.invocationOrigins?.map(origin=><button key={`${origin.file}:${origin.range.start}`} onClick={()=>openCodeLocation(origin.file, origin.range.start, origin.range.end)}>Open caller {origin.file} · {origin.range.start}</button>)}</div>}
        {target?.effectScope && <p className="limited-editing">Effect scope: {target.effectScope}</p>}
        {target && <details><summary>{target.identity.file} — source</summary><pre className="source-diff">{source}</pre></details>}
        {target && Object.entries(target.unavailableReasons).map(([key, reason]) => <p key={key} className="limited-editing">{reason}</p>)}
        {diff && <details className="editor-source-details"><summary>Actual source diff</summary><pre className="source-diff">{diff}</pre></details>}
        <p className="transaction-status" role="status">{message}</p>{copiedText !== undefined && <label>Selected preview text<textarea aria-label="Selected preview text" readOnly value={copiedText} onFocus={event => event.target.select()} /></label>}
        <details className="editor-source-details"><summary>Preview boundary</summary><p className="limited-editing" data-preview-boundary>{preview?.transport === "snapshot" ? "Managed snapshot preview: project code runs in Cloudflare Browser Run without Webcanbe login credentials. Requests are restricted to the Webcanbe preview runtime assets, and Visual changes still commit to the same PostgreSQL-backed source. This free-tier preview is static between refreshes; live interaction remains unavailable." : preview?.transport === "raster" ? "Controlled preview: project JavaScript runs in an isolated Linux browser. This viewer receives pixels and validated selection data. External project networking is disabled. Sessions last up to 60 seconds; reconnect to renew." : PREVIEW_SECURITY_NOTICE}</p></details>
        </div>
      </aside>
    </div>
  </main></>
}
