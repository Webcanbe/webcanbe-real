import type { RunnerObservation, PreviewInput } from "../runtime/controlledPreview"
import { lazy, Suspense, useEffect, useRef, useState } from "react"
import { isPreviewMessage, PREVIEW_CHANNEL } from "../bridge/previewProtocol"
import { safePreviewRoute } from "../bridge/previewRoute"
import { PREVIEW_SECURITY_NOTICE } from "../bridge/previewSecurity"
import type { CompatibilitySummary, MutationTransaction, PreviewElement, SourceTarget, StyleProperty, ViewportPreset } from "../core/types"
import type { SourceResponse } from "./CodeWorkspace"
const CodeWorkspace = lazy(() => import("./CodeWorkspace"))
import "./compatibleWorkspace.css"

type ProjectInfo = { id: string; name: string; imported: boolean; detection: { framework: string; tailwind: boolean; dependencies: Array<{ name: string; declared: string; resolved: boolean }> } }
type PreviewSession = { projectId: string; previewId: string; capability: string; expiresAt: string }
type RuntimeInfo = { profile: string; supported: boolean; dependencies: Array<{ name: string; declared: string; selected?: string; locked?: string }>; issues: Array<{ message: string; requiredCapability: string }>; notes: string[] }
type ApiResponse = SourceResponse & { transport?: "blob" | "http" | "raster"; viewerUrl?: string; png?: string; sequence?: number; observation?: RunnerObservation; generation?: string; origin?: string; state?: string; runtime?: RuntimeInfo; target?: SourceTarget; summary?: CompatibilitySummary; transaction?: MutationTransaction; diff?: string; project?: ProjectInfo; session?: PreviewSession; html?: string; source?: string; revision?: string; targets?: SourceTarget[]; archive?: string; error?: string }

const editableLabels: Partial<Record<StyleProperty, string>> = {
  backgroundColor: "Background", color: "Text color", fontSize: "Font size", fontWeight: "Font weight", padding: "Padding", paddingX: "Horizontal padding", paddingY: "Vertical padding", margin: "Margin", gap: "Gap", width: "Width", height: "Height", maxWidth: "Max width", border: "Border", borderRadius: "Radius", alignItems: "Align items", justifyContent: "Justify content", alignSelf: "Align self", justifySelf: "Justify self", order: "Order", flexGrow: "Grow", flexShrink: "Shrink", gridTemplateColumns: "Grid columns", gridTemplateRows: "Grid rows", gridColumn: "Grid column", gridRow: "Grid row",
}

function workspaceProjectId() { const id = window.location.pathname.split("/").filter(Boolean).at(-1); return id && id !== "northstar" ? id : "phase1-fixture" }

export default function CompatibleWorkspace() {
  const frame = useRef<HTMLIFrameElement>(null)
  const previewContainer = useRef<HTMLDivElement>(null)
  const [availableWidth, setAvailableWidth] = useState(1280)
  const [runtime, setRuntime] = useState<RuntimeInfo>()
  const [selectMode, setSelectMode] = useState(true)
  const routeHash = useRef("#/")
  const routePath = useRef("/")
  const [routeInput, setRouteInput] = useState("/")
  const [previewState, setPreviewState] = useState("stopped")
  const activeGeneration = useRef("")
  const rasterBusy = useRef(false)
  const rasterSequence = useRef(0)
  const rasterQueued = useRef<{ input: PreviewInput; sequence: number; generation: string } | undefined>(undefined)
  const lastRaster = useRef<ApiResponse | undefined>(undefined)
  const inspected = useRef("")
  const selectionSource = useRef<"runtime" | "source">("runtime")
  const inspectSequence = useRef(0)
  const connectionEpoch = useRef(0)
  const [projectId, setProjectId] = useState(workspaceProjectId)
  const [project, setProject] = useState<ProjectInfo>()
  const [session, setSession] = useState<PreviewSession>()
  const [hovered, setHovered] = useState<PreviewElement>()
  const [selected, setSelected] = useState<PreviewElement>()
  const [target, setTarget] = useState<SourceTarget>()
  const [summary, setSummary] = useState<CompatibilitySummary>()
  const [message, setMessage] = useState("Starting a sandboxed project preview…")
  const [text, setText] = useState("")
  const [viewport, setViewport] = useState<ViewportPreset>("desktop")
  const rasterWidth = useRef(1280)
  rasterWidth.current = { mobile: 390, tablet: 768, desktop: 1280 }[viewport]
  const [diff, setDiff] = useState("")
  const [accessKey, setAccessKey] = useState("")
  const [connectionAttempt, setConnectionAttempt] = useState(0)
  const keyInput = useRef<HTMLInputElement>(null)
  const revision = useRef("")
  const [preview, setPreview] = useState<{ url: string; transport: "blob" | "http" | "raster"; generation: string }>()
  const previewUrl = preview?.url ?? ""
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url) }, [preview])
  const [targets, setTargets] = useState<SourceTarget[]>([])
  const [source, setSource] = useState("")
  const [pending, setPending] = useState(false)
  const [surface, setSurface] = useState<"canvas" | "code" | "history">("canvas")
  const [sourceUIOpened, setSourceUIOpened] = useState(false)
  function openSurface(value: "canvas" | "code" | "history") { if (value !== "canvas") setSourceUIOpened(true); setSurface(value) }
  const [sourceEpoch, setSourceEpoch] = useState(0)
  const [codeFile, setCodeFile] = useState<string>()

  async function request(path: string, body: Record<string, unknown> = {}) {
    const response = await fetch(`/__webcanbe/api/projects/${projectId}/${path}`, { method: "POST", headers: { "Content-Type": "application/json", "X-WCB-Editor-Key": accessKey }, body: JSON.stringify({ expectedRevision: revision.current, ...body, previewId: session?.previewId, capability: session?.capability }) })
    return { ok: response.ok, data: await response.json() as ApiResponse }
  }

  async function refreshCompatibility() {
    const epoch = connectionEpoch.current
    const response = await request("compatibility")
    if (epoch !== connectionEpoch.current) return
    if (response.ok) { setSummary(response.data.summary); setTargets(response.data.targets ?? []) }
  }

  async function inspect(element: PreviewElement) {
    const sequence = ++inspectSequence.current, generation = activeGeneration.current, epoch = connectionEpoch.current
    setMessage("Reading the element’s real source location…")
    const response = await request("inspect", { identity: element.identity })
    if (sequence !== inspectSequence.current || generation !== activeGeneration.current || epoch !== connectionEpoch.current) return
    if (!response.ok || !response.data.target) { setTarget(undefined); setSelected(undefined); inspected.current = ""; setMessage(response.data.error ?? "This element is preview-only."); return }
    revision.current = response.data.revision ?? ""
    setSource(response.data.source ?? "")
    setTarget(response.data.target)
    setText(response.data.target.text ?? "")
    setMessage(response.data.target.capabilities.visualEdit ? "Connected to the real source file." : response.data.target.unavailableReasons.visualEdit ?? "This element is available in code, but has limited visual editing.")
  }

  useEffect(() => {
    ++connectionEpoch.current
    if (!accessKey) { setMessage("Enter the local editor access key printed by the development server."); return }
    routeHash.current = "#/"; routePath.current = "/"
    try { const saved = sessionStorage.getItem('wcb-preview-route:' + projectId); if (safePreviewRoute(saved)) routePath.current = saved! } catch { /* Route persistence is optional; credentials never enter storage. */ }
    setRouteInput(routePath.current); setRuntime(undefined); activeGeneration.current = ""
    setSession(undefined); setPreview(undefined); setTarget(undefined); setSelected(undefined); setHovered(undefined)
    let cancelled = false, connected: PreviewSession | undefined
    const stop = (old: PreviewSession) => { void fetch('/__webcanbe/api/projects/' + projectId + '/preview', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', 'X-WCB-Editor-Key': accessKey }, body: JSON.stringify({ previewId: old.previewId, capability: old.capability, command: 'stop' }) }).catch(() => {}) }
    void (async () => {
      const response = await fetch(`/__webcanbe/api/projects/${projectId}/session`, { method: "POST", headers: { "Content-Type": "application/json", "X-WCB-Editor-Key": accessKey }, body: "{}" })
      const data = await response.json() as ApiResponse
      if (!response.ok || !data.session || !data.project) { setMessage(data.error ?? "This project could not start a preview."); return }
      connected = data.session
      if (cancelled) { stop(connected); return }
      setRuntime(data.runtime); setProject(data.project); setSession(data.session); setMessage("Project source is ready. See the verified preview boundary below.")
    })().catch(() => { if (!cancelled) setMessage("The local Compatible engine is unavailable.") })
    const pagehide = () => { if (connected) stop(connected) }
    window.addEventListener("pagehide", pagehide)
    return () => { cancelled = true; ++connectionEpoch.current; window.removeEventListener("pagehide", pagehide); if (connected) stop(connected) }
  }, [projectId, accessKey, connectionAttempt])

  async function refreshPreview() {
    const epoch = connectionEpoch.current
    selectionSource.current = "runtime"
    setPreviewState("starting"); activeGeneration.current = ""; inspected.current = ""; ++inspectSequence.current
    setSelected(undefined); setHovered(undefined); setTarget(undefined)
    const response = await request("preview", { route: routePath.current })
    if (epoch !== connectionEpoch.current) return
    revision.current = response.data.revision ?? revision.current
    if (response.ok && response.data.transport === "raster" && response.data.viewerUrl && response.data.generation) {
      activeGeneration.current = response.data.generation; rasterSequence.current = 0; lastRaster.current = undefined
      setPreview({ url: response.data.viewerUrl, transport: "raster", generation: response.data.generation })
      setPreviewState("ready")
    } else if (response.ok && response.data.html && response.data.generation) {
      activeGeneration.current = response.data.generation
      setPreview({ url: URL.createObjectURL(new Blob([response.data.html], { type: "text/html" })), transport: response.data.transport ?? "blob", generation: response.data.generation })
    } else { setPreview(undefined); setPreviewState("failed"); setMessage(response.data.error ?? "Preview unavailable. Inspect source below.") }
  }
  useEffect(() => { if (session) void (async () => { await refreshCompatibility(); await refreshPreview() })() }, [session])

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
    frame.current?.contentWindow?.postMessage({ channel: "wcb-raster", type: "frame", generation: data.generation, sequence: data.sequence, png: data.png, ...data.observation.viewport, select: selectMode }, "*")
  }
  async function rasterOperation(input?: PreviewInput, sequence = rasterSequence.current) {
    if (preview?.transport !== "raster" || !activeGeneration.current) return
    if (rasterBusy.current) { if (input && !rasterQueued.current) rasterQueued.current = { input, sequence, generation: activeGeneration.current }; return }
    rasterBusy.current = true
    const generation = activeGeneration.current, epoch = connectionEpoch.current
    try {
      if (input) {
        if (input.type === "pointer") selectionSource.current = "runtime"
        const result = await request("preview", { command: "input", generation, sequence, input })
        if (!result.ok) throw new Error(result.data.error ?? "Preview input rejected.")
      }
      let result = await request("preview", { command: "capture", generation })
      if (generation !== activeGeneration.current || epoch !== connectionEpoch.current) return
      if (result.ok && result.data.observation && result.data.observation.viewport.width !== rasterWidth.current) {
        const resized = await request("preview", { command: "input", generation, sequence: result.data.sequence, input: { type: "viewport", width: rasterWidth.current, height: 900 } })
        if (!resized.ok) throw new Error(resized.data.error ?? "Viewport rejected.")
        result = await request("preview", { command: "capture", generation })
      }
      if (generation !== activeGeneration.current || epoch !== connectionEpoch.current) return
      if (!result.ok || !result.data.observation) throw new Error(result.data.error ?? "Preview expired. Connect to renew.")
      const data = result.data, observation = data.observation!
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
      if (generation === activeGeneration.current && epoch === connectionEpoch.current) { activeGeneration.current = ""; setPreviewState("expired"); setSelected(undefined); setTarget(undefined); setMessage(String(error instanceof Error ? error.message : error)) }
    } finally {
      rasterBusy.current = false
      const queued = rasterQueued.current; rasterQueued.current = undefined
      if (queued && queued.generation === activeGeneration.current) {
        if (queued.input.type === "pointer" && queued.sequence !== rasterSequence.current) setMessage("The frame changed before selection. Select the element again.")
        else void rasterOperation(queued.input, rasterSequence.current)
      }
    }
  }
  useEffect(() => {
    if (preview?.transport !== "raster") return
    void rasterOperation()
    const timer = setInterval(() => { void rasterOperation() }, 1500)
    const receive = (event: MessageEvent) => {
      const data = event.data
      if (event.source !== frame.current?.contentWindow || event.origin !== "null" || data?.channel !== "wcb-raster" || data.type !== "input" || data.generation !== activeGeneration.current || data.sequence !== rasterSequence.current) return
      if (data.input?.type === "pointer" || data.input?.type === "scroll") void rasterOperation(data.input, data.sequence)
    }
    window.addEventListener("message", receive)
    return () => { clearInterval(timer); window.removeEventListener("message", receive) }
  }, [preview, session, selectMode])
  useEffect(() => {
    if (preview?.transport === "raster") void rasterOperation()
  }, [viewport])

  function configurePreview() {
    if (!session || !preview) return
    if (preview.transport === "raster") { deliverRaster(); return }
    frame.current?.contentWindow?.postMessage({ channel: PREVIEW_CHANNEL, type: "configure", session: session.previewId, generation: preview.generation, active: selectMode, hash: routeHash.current }, "*")
  }

  useEffect(() => { configurePreview() }, [selectMode, preview])

  async function sourceAccepted(data: SourceResponse) {
    revision.current = data.revision ?? revision.current
    setDiff(data.diff ?? "")
    inspected.current = ""; ++inspectSequence.current
    setSelected(undefined); setHovered(undefined); setTarget(undefined)
    setSourceEpoch(value => value + 1)
    await refreshCompatibility()
    await refreshPreview()
  }

  async function mutate(edit: { type: "text"; value: string } | { type: "style" | "layout"; property: StyleProperty; value: string } | { type: "responsive"; property: StyleProperty; value: string; viewport: ViewportPreset }) {
    if (!selected || !session || pending) return
    const epoch = connectionEpoch.current
    setPending(true)
    const response = await request("mutate", { identity: target?.identity ?? selected.identity, expectedRevision: target?.identity.revisionId ?? revision.current, idempotencyKey: crypto.randomUUID(), edit }).finally(() => setPending(false))
    if (epoch !== connectionEpoch.current) return
    if (!response.ok || !response.data.transaction?.success) { setMessage(response.data.transaction?.error ?? response.data.error ?? "The source change was not safe to apply."); return }
    setDiff(response.data.diff ?? "")
    setMessage(`Saved ${response.data.transaction.editType} transaction to the real source.`)
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
    const response = await fetch("/__webcanbe/api/projects/import", { method: "POST", headers: { "Content-Type": "application/json", "X-WCB-Editor-Key": accessKey }, body: JSON.stringify({ name: file.name, archive: btoa(binary) }) })
    const data = await response.json() as ApiResponse
    if (!response.ok || !data.project) { setMessage(data.error ?? "Import rejected."); return }
    window.history.replaceState({}, "", `/workspace/${data.project.id}`)
    setProjectId(data.project.id)
  }
  async function exportProject() {
    const response = await request("export")
    if (!response.ok || !response.data.archive) { setMessage(response.data.error ?? "Export unavailable."); return }
    const bytes = Uint8Array.from(atob(response.data.archive), ch => ch.charCodeAt(0))
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/zip" }))
    const link = document.createElement("a"); link.href = url; link.download = `${project?.name ?? "project"}.zip`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  useEffect(() => {
    const container = previewContainer.current
    if (!container) return
    const observer = new ResizeObserver(() => setAvailableWidth(container.clientWidth))
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const activeBox = selected ?? hovered
  const styleOrigins = target?.styleOrigins.filter((styleOrigin) => styleOrigin.editable && !styleOrigin.prefix) ?? []
  const viewportWidth = { mobile: 390, tablet: 768, desktop: 1280 }[viewport]
  const scale = Math.max(0.1, Math.min(1, availableWidth / viewportWidth))
  const frameStyle = { width: viewportWidth, height: preview?.transport === "raster" ? 900 : `${100 / scale}%`, transform: `scale(${scale})`, marginLeft: Math.max(0, (availableWidth - viewportWidth * scale) / 2) }

  return <main className="compatible-workspace">
    <header className="compatible-topbar">
      <a href="/projects" className="compatible-brand">WebCanBe <span>/ Compatible</span></a>
      <div className="compatible-project-status"><i/> {project?.name ?? "Loading project"} <small>{project?.detection.tailwind ? "Tailwind detected" : "Actual source files"}</small></div>
      <div className="compatible-top-actions"><button type="button" aria-pressed={surface === "canvas"} onClick={() => openSurface("canvas")}>Canvas</button><button type="button" aria-pressed={surface === "code"} onClick={() => openSurface("code")}>Code</button><button type="button" aria-pressed={surface === "history"} onClick={() => openSurface("history")}>History</button><button type="button" onClick={() => void history("undo")}>Undo</button><button type="button" onClick={() => void history("redo")}>Redo</button><button type="button" onClick={() => void exportProject()} disabled={!session}>Export code</button></div>
    </header>
    <div className="compatible-layout">
      <aside className="compatible-files">
        <label>Local editor access<input ref={keyInput} type="password" autoComplete="off" aria-label="Local editor access key" /></label><button onClick={() => { setAccessKey(keyInput.current?.value ?? ""); setConnectionAttempt(value => value + 1) }}>Connect / renew session</button>
        <label>Import React/Vite ZIP<input type="file" accept=".zip" disabled={!session} onChange={event => { const file = event.target.files?.[0]; if (file) void importProject(file) }} /></label>
        <p>Project runtime</p><strong>▾ src</strong><span>⌘ JSX / TSX source</span><span># CSS / Modules</span>
        <div className="compatibility-summary"><small>Visual compatibility</small><b>{summary ? `${summary.score}%` : "…"}</b><p>{summary ? `${summary.full} full · ${summary.partial} partial · ${summary.codeOnly} code only` : "Analysing real source…"}</p></div>
        {runtime && <details><summary>Runtime: {runtime.profile}</summary><p>{runtime.supported ? "Explicit dedicated profile" : "Runtime unavailable"}</p>{runtime.dependencies.map(item => <p key={item.name}>{item.name}: {item.declared} → {item.selected ?? "unavailable"}{item.locked ? ` (lock ${item.locked})` : ""}</p>)}{runtime.issues.map((issue, index) => <p key={index}>{issue.message} Requires: {issue.requiredCapability}</p>)}{runtime.notes.map(note => <p key={note}>{note}</p>)}</details>}
        <p>Source targets</p>{targets.map(item => <button key={`${item.identity.file}:${item.identity.elementStart}`} onClick={() => { selectionSource.current = "source"; const element: PreviewElement = { identity: item.identity, tagName: item.elementName, rect: { top: 0, left: 0, width: 0, height: 0 }, computed: {}, layoutContext: "unknown" }; setSelected(element); void inspect(element) }}>{item.elementName} · {item.compatibility}</button>)}
      </aside>
      <section className="compatible-preview-shell">
        <div className="compatible-preview-head"><span><i/> Sandboxed source preview <small data-preview-state={previewState}>{previewState}</small></span>{(preview?.transport === "http" || preview?.transport === "raster") && <form onSubmit={event => { event.preventDefault(); if (!safePreviewRoute(routeInput)) { setMessage("Enter a local preview path such as /projects/42?view=detail#notes."); return } if (preview?.transport === "raster") void rasterOperation({ type: "navigate", route: routeInput }); else { routePath.current = routeInput; void refreshPreview() } }}><input aria-label="Preview path" value={routeInput} onChange={event => setRouteInput(event.target.value)} /><button type="submit">Open route</button></form>}{preview?.transport === "raster" && <><button type="button" onClick={() => void rasterOperation({ type: "history", action: "back" })}>Back</button><button type="button" onClick={() => void rasterOperation({ type: "history", action: "forward" })}>Forward</button><button type="button" onClick={() => void rasterOperation({ type: "history", action: "reload" })}>Refresh preview</button></>}<button type="button" disabled={!session} onClick={() => { ++connectionEpoch.current; activeGeneration.current = ""; ++inspectSequence.current; void request("preview", { command: "stop" }).then(response => { if (response.ok) { setPreview(undefined); setSession(undefined); activeGeneration.current = ""; setPreviewState("stopped"); setSelected(undefined); setHovered(undefined); setTarget(undefined); setMessage("Preview stopped. Connect to start a new session.") } else setMessage(response.data.error ?? "Stop rejected.") }) }}>Stop preview</button><button type="button" onClick={() => setSelectMode(value => !value)}>{selectMode ? "Interact with preview" : "Select elements"}</button><label>Viewport <select value={viewport} onChange={(event) => setViewport(event.target.value as ViewportPreset)}><option value="mobile">Mobile</option><option value="tablet">Tablet</option><option value="desktop">Desktop</option></select></label></div>
        {sourceUIOpened && <Suspense fallback={<p>Loading source editor…</p>}><CodeWorkspace key={projectId} projectId={projectId} request={request} epoch={sourceEpoch} connected={Boolean(session)} visible={surface} openFile={codeFile} onAccepted={sourceAccepted} /></Suspense>}
        <div hidden={surface !== "canvas"} ref={previewContainer} className={`compatible-frame-wrap ${viewport}`}><div className="preview-device" style={frameStyle}><iframe key={preview?.generation ?? "unavailable"} ref={frame} referrerPolicy="no-referrer" onLoad={configurePreview} title="Running imported React/Vite project" src={previewUrl || undefined} srcDoc={previewUrl ? undefined : "<p>Preview unavailable. Source inspection remains available.</p>"} sandbox="allow-scripts" />{activeBox && <div className={`canvas-outline ${selected ? "selected" : ""}`} style={{ left: activeBox.rect.left, top: activeBox.rect.top, width: activeBox.rect.width, height: activeBox.rect.height }}>{selected && <span>{selected.tagName} · {selected.identity.file.replace("src/", "")}</span>}</div>}</div></div>
      </section>
      <aside className="compatible-inspector">
        <div className="inspector-heading"><p>Element inspector</p><span>{target?.compatibility ?? "preview"}</span></div>
        {selected && <div className="source-location"><small>Source location</small><b>{selected.identity.file}</b><span>{target?.nodeKind ?? "native"} · JSX offset {selected.identity.elementStart} · {selected.layoutContext} inside {selected.parentLayoutContext ?? "unknown"}</span></div>}
        {!selected && <div className="empty-inspector"><b>Visual editing changes the same files.</b><p>Hover and select an element in the actual running project to inspect its real source.</p></div>}
        {target?.capabilities.text && <label className="inspector-control">Text <textarea value={text} onChange={(event) => setText(event.target.value)} /><button type="button" onClick={() => void mutate({ type: "text", value: text })}>Apply text change</button></label>}
        {styleOrigins.length > 0 && <div className="style-controls"><small>Safe style origins</small>{styleOrigins.map((styleOrigin) => <label className="inspector-control" key={`${styleOrigin.property}-${styleOrigin.kind}-${styleOrigin.range?.start}`}><span>{editableLabels[styleOrigin.property] ?? styleOrigin.property}<em>{styleOrigin.kind}</em></span><div><input data-wcb-property={styleOrigin.property} defaultValue={styleOrigin.value?.replace(/^['"]|['"]$/g, "")} key={styleOrigin.value} /><button type="button" onClick={(event) => { const input = event.currentTarget.previousElementSibling as HTMLInputElement; void mutate({ type: "style", property: styleOrigin.property, value: input.value }) }}>Save</button></div><button type="button" onClick={() => { const input = document.querySelector<HTMLInputElement>(`input[data-wcb-property="${styleOrigin.property}"]`); if (input) void mutate({ type: "responsive", property: styleOrigin.property, value: input.value, viewport }) }}>Save at {viewport}</button></label>)}</div>}
        {target?.capabilities.layout && <div className="semantic-controls"><small>Semantic layout</small><button type="button" onClick={() => void mutate({ type: "layout", property: "gap", value: "24px" })}>Set gap 24px</button><button type="button" onClick={() => void mutate({ type: "layout", property: "justifyContent", value: "space-between" })}>Distribute items</button></div>}
        {target && !target.capabilities.visualEdit && <div className="limited-editing"><b>Visual editing unavailable</b><br/>{target.unavailableReasons.visualEdit ?? "WebCanBe cannot safely identify a static source mutation."}<br/><button type="button" onClick={() => { setCodeFile(target.identity.file); openSurface("code") }}>Open code location</button></div>}
        {target?.effectScope && <p className="limited-editing">Effect scope: {target.effectScope}</p>}
        {target && <details><summary>{target.identity.file} — source</summary><pre className="source-diff">{source}</pre></details>}
        {target && Object.entries(target.unavailableReasons).map(([key, reason]) => <p key={key} className="limited-editing">{reason}</p>)}
        {diff && <div className="source-diff"><small>Actual source diff</small><pre>{diff}</pre></div>}
        <p className="transaction-status">{message}</p>
        <p className="limited-editing" data-preview-boundary>{preview?.transport === "raster" ? "Local controlled preview: project JavaScript runs in an isolated Linux browser. This viewer receives pixels and validated selection data. External project networking is disabled. Sessions last up to 60 seconds; reconnect to renew." : PREVIEW_SECURITY_NOTICE}</p>
      </aside>
    </div>
  </main>
}
