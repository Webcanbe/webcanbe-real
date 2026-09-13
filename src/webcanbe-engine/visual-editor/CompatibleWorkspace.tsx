import { useEffect, useRef, useState } from "react"
import { isPreviewMessage, PREVIEW_CHANNEL } from "../bridge/previewProtocol"
import type { CompatibilitySummary, MutationTransaction, PreviewElement, SourceTarget, StyleProperty, ViewportPreset } from "../core/types"
import "./compatibleWorkspace.css"

type ProjectInfo = { id: string; name: string; imported: boolean; detection: { framework: string; tailwind: boolean; dependencies: Array<{ name: string; declared: string; resolved: boolean }> } }
type PreviewSession = { projectId: string; previewId: string; capability: string; expiresAt: string }
type RuntimeInfo = { profile: string; supported: boolean; dependencies: Array<{ name: string; declared: string; selected?: string; locked?: string }>; issues: Array<{ message: string; requiredCapability: string }>; notes: string[] }
type ApiResponse = { runtime?: RuntimeInfo; target?: SourceTarget; summary?: CompatibilitySummary; transaction?: MutationTransaction; diff?: string; project?: ProjectInfo; session?: PreviewSession; html?: string; source?: string; revision?: string; targets?: SourceTarget[]; archive?: string; error?: string }

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
  const [diff, setDiff] = useState("")
  const [accessKey, setAccessKey] = useState("")
  const [connectionAttempt, setConnectionAttempt] = useState(0)
  const keyInput = useRef<HTMLInputElement>(null)
  const revision = useRef("")
  const [html, setHtml] = useState("")
  const [previewUrl, setPreviewUrl] = useState("")
  useEffect(() => {
    if (!html) { setPreviewUrl(""); return }
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }))
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [html])
  const [targets, setTargets] = useState<SourceTarget[]>([])
  const [source, setSource] = useState("")
  const [pending, setPending] = useState(false)

  async function request(path: string, body: Record<string, unknown> = {}) {
    const response = await fetch(`/__webcanbe/api/projects/${projectId}/${path}`, { method: "POST", headers: { "Content-Type": "application/json", "X-WCB-Editor-Key": accessKey }, body: JSON.stringify({ ...body, previewId: session?.previewId, capability: session?.capability, expectedRevision: revision.current }) })
    return { ok: response.ok, data: await response.json() as ApiResponse }
  }

  async function refreshCompatibility() {
    const response = await request("compatibility")
    if (response.ok) { setSummary(response.data.summary); setTargets(response.data.targets ?? []) }
  }

  async function inspect(element: PreviewElement) {
    setMessage("Reading the element’s real source location…")
    const response = await request("inspect", { identity: element.identity })
    if (!response.ok || !response.data.target) { setTarget(undefined); setMessage(response.data.error ?? "This element is preview-only."); return }
    revision.current = response.data.revision ?? ""
    setSource(response.data.source ?? "")
    setTarget(response.data.target)
    setText(response.data.target.text ?? "")
    setMessage(response.data.target.capabilities.visualEdit ? "Connected to the real source file." : response.data.target.unavailableReasons.visualEdit ?? "This element is available in code, but has limited visual editing.")
  }

  useEffect(() => {
    if (!accessKey) { setMessage("Enter the local editor access key printed by the development server."); return }
    routeHash.current = "#/"; setRuntime(undefined)
    setSession(undefined); setHtml(""); setTarget(undefined); setSelected(undefined)
    void (async () => {
      const response = await fetch(`/__webcanbe/api/projects/${projectId}/session`, { method: "POST", headers: { "Content-Type": "application/json", "X-WCB-Editor-Key": accessKey }, body: "{}" })
      const data = await response.json() as ApiResponse
      if (!response.ok || !data.session || !data.project) { setMessage(data.error ?? "This project could not start a preview."); return }
      setRuntime(data.runtime); setProject(data.project); setSession(data.session); setMessage("Project source is ready. Previews run offline; remote assets and network calls are disabled.")
    })().catch(() => setMessage("The local Compatible engine is unavailable."))
  }, [projectId, accessKey, connectionAttempt])

  async function refreshPreview() {
    const response = await request("preview")
    revision.current = response.data.revision ?? revision.current
    setHtml(response.data.html ?? "")
    if (!response.ok) setMessage(response.data.error ?? "Preview unavailable. Inspect source below.")
    setSelected(undefined); setHovered(undefined); setTarget(undefined)
  }
  useEffect(() => { if (session) void (async () => { await refreshCompatibility(); await refreshPreview() })() }, [session])

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== "null" || event.source !== frame.current?.contentWindow || !isPreviewMessage(event.data) || event.data.session !== session?.previewId) return
      if (event.data.type === "route") routeHash.current = event.data.hash
      if (event.data.type === "hover") setHovered(event.data.element)
      if (event.data.type === "select") { setSelected(event.data.element); void inspect(event.data.element) }
      if (event.data.type === "drag") {
        setSelected(event.data.element)
        setMessage("Drag intent cannot be inferred safely. Select an existing semantic layout property in the inspector.")
      }
    }
    window.addEventListener("message", receive)
    return () => window.removeEventListener("message", receive)
  }, [session, selected])

  function configurePreview() {
    if (!session) return
    frame.current?.contentWindow?.postMessage({ channel: PREVIEW_CHANNEL, type: "configure", session: session.previewId, active: selectMode, hash: routeHash.current }, "*")
  }

  useEffect(() => { configurePreview() }, [selectMode])

  async function mutate(edit: { type: "text"; value: string } | { type: "style" | "layout"; property: StyleProperty; value: string } | { type: "responsive"; property: StyleProperty; value: string; viewport: ViewportPreset }) {
    if (!selected || !session || pending) return
    setPending(true)
    const response = await request("mutate", { identity: selected.identity, edit }).finally(() => setPending(false))
    if (!response.ok || !response.data.transaction?.success) { setMessage(response.data.transaction?.error ?? response.data.error ?? "The source change was not safe to apply."); return }
    setDiff(response.data.diff ?? "")
    setMessage(`Saved ${response.data.transaction.editType} transaction to the real source.`)
    revision.current = response.data.revision ?? ""
    await refreshCompatibility()
    await refreshPreview()
  }

  async function history(action: "undo" | "redo") {
    const response = await request(action)
    if (!response.ok || !response.data.transaction) { setMessage(response.data.error ?? `Nothing safe to ${action}.`); return }
    setDiff(response.data.diff ?? "")
    setMessage(`${action === "undo" ? "Undid" : "Redid"} the real source transaction.`)
    revision.current = response.data.revision ?? ""
    await refreshCompatibility()
    await refreshPreview()
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
  const frameStyle = { width: viewportWidth, height: `${100 / scale}%`, transform: `scale(${scale})`, marginLeft: Math.max(0, (availableWidth - viewportWidth * scale) / 2) }

  return <main className="compatible-workspace">
    <header className="compatible-topbar">
      <a href="/projects" className="compatible-brand">WebCanBe <span>/ Compatible</span></a>
      <div className="compatible-project-status"><i/> {project?.name ?? "Loading project"} <small>{project?.detection.tailwind ? "Tailwind detected" : "Actual source files"}</small></div>
      <div className="compatible-top-actions"><button type="button" onClick={() => void history("undo")}>Undo</button><button type="button" onClick={() => void history("redo")}>Redo</button><button type="button" onClick={() => void exportProject()} disabled={!session}>Export code</button></div>
    </header>
    <div className="compatible-layout">
      <aside className="compatible-files">
        <label>Local editor access<input ref={keyInput} type="password" autoComplete="off" aria-label="Local editor access key" /></label><button onClick={() => { setAccessKey(keyInput.current?.value ?? ""); setConnectionAttempt(value => value + 1) }}>Connect / renew session</button>
        <label>Import React/Vite ZIP<input type="file" accept=".zip" disabled={!session} onChange={event => { const file = event.target.files?.[0]; if (file) void importProject(file) }} /></label>
        <p>Project runtime</p><strong>▾ src</strong><span>⌘ JSX / TSX source</span><span># CSS / Modules</span>
        <div className="compatibility-summary"><small>Visual compatibility</small><b>{summary ? `${summary.score}%` : "…"}</b><p>{summary ? `${summary.full} full · ${summary.partial} partial · ${summary.codeOnly} code only` : "Analysing real source…"}</p></div>
        {runtime && <details><summary>Runtime: {runtime.profile}</summary><p>{runtime.supported ? "Explicit dedicated profile" : "Runtime unavailable"}</p>{runtime.dependencies.map(item => <p key={item.name}>{item.name}: {item.declared} → {item.selected ?? "unavailable"}{item.locked ? ` (lock ${item.locked})` : ""}</p>)}{runtime.issues.map((issue, index) => <p key={index}>{issue.message} Requires: {issue.requiredCapability}</p>)}{runtime.notes.map(note => <p key={note}>{note}</p>)}</details>}
        <p>Source targets</p>{targets.map(item => <button key={`${item.identity.file}:${item.identity.elementStart}`} onClick={() => { const element: PreviewElement = { identity: item.identity, tagName: item.elementName, rect: { top: 0, left: 0, width: 0, height: 0 }, computed: {}, layoutContext: "unknown" }; setSelected(element); void inspect(element) }}>{item.elementName} · {item.compatibility}</button>)}
      </aside>
      <section className="compatible-preview-shell">
        <div className="compatible-preview-head"><span><i/> Sandboxed source preview</span><button type="button" onClick={() => setSelectMode(value => !value)}>{selectMode ? "Interact with preview" : "Select elements"}</button><label>Viewport <select value={viewport} onChange={(event) => setViewport(event.target.value as ViewportPreset)}><option value="mobile">Mobile</option><option value="tablet">Tablet</option><option value="desktop">Desktop</option></select></label></div>
        <div ref={previewContainer} className={`compatible-frame-wrap ${viewport}`}><div className="preview-device" style={frameStyle}><iframe ref={frame} onLoad={configurePreview} title="Running imported React/Vite project" src={previewUrl || undefined} srcDoc={previewUrl ? undefined : "<p>Preview unavailable. Source inspection remains available.</p>"} sandbox="allow-scripts" />{activeBox && <div className={`canvas-outline ${selected ? "selected" : ""}`} style={{ left: activeBox.rect.left, top: activeBox.rect.top, width: activeBox.rect.width, height: activeBox.rect.height }}>{selected && <span>{selected.tagName} · {selected.identity.file.replace("src/", "")}</span>}</div>}</div></div>
      </section>
      <aside className="compatible-inspector">
        <div className="inspector-heading"><p>Element inspector</p><span>{target?.compatibility ?? "preview"}</span></div>
        {selected && <div className="source-location"><small>Source location</small><b>{selected.identity.file}</b><span>{target?.nodeKind ?? "native"} · JSX offset {selected.identity.elementStart} · {selected.layoutContext} inside {selected.parentLayoutContext ?? "unknown"}</span></div>}
        {!selected && <div className="empty-inspector"><b>Visual editing changes the same files.</b><p>Hover and select an element in the actual running project to inspect its real source.</p></div>}
        {target?.capabilities.text && <label className="inspector-control">Text <textarea value={text} onChange={(event) => setText(event.target.value)} /><button type="button" onClick={() => void mutate({ type: "text", value: text })}>Apply text change</button></label>}
        {styleOrigins.length > 0 && <div className="style-controls"><small>Safe style origins</small>{styleOrigins.map((styleOrigin) => <label className="inspector-control" key={`${styleOrigin.property}-${styleOrigin.kind}-${styleOrigin.range?.start}`}><span>{editableLabels[styleOrigin.property] ?? styleOrigin.property}<em>{styleOrigin.kind}</em></span><div><input data-wcb-property={styleOrigin.property} defaultValue={styleOrigin.value?.replace(/^['"]|['"]$/g, "")} key={styleOrigin.value} /><button type="button" onClick={(event) => { const input = event.currentTarget.previousElementSibling as HTMLInputElement; void mutate({ type: "style", property: styleOrigin.property, value: input.value }) }}>Save</button></div><button type="button" onClick={() => { const input = document.querySelector<HTMLInputElement>(`input[data-wcb-property="${styleOrigin.property}"]`); if (input) void mutate({ type: "responsive", property: styleOrigin.property, value: input.value, viewport }) }}>Save at {viewport}</button></label>)}</div>}
        {target?.capabilities.layout && <div className="semantic-controls"><small>Semantic layout</small><button type="button" onClick={() => void mutate({ type: "layout", property: "gap", value: "24px" })}>Set gap 24px</button><button type="button" onClick={() => void mutate({ type: "layout", property: "justifyContent", value: "space-between" })}>Distribute items</button></div>}
        {target && !target.capabilities.visualEdit && <div className="limited-editing"><b>Visual editing unavailable</b><br/>{target.unavailableReasons.visualEdit ?? "WebCanBe cannot safely identify a static source mutation."}<br/><button type="button" onClick={() => setDiff(`${target.identity.file}\n${source}`)}>Open code location</button></div>}
        {target && <details><summary>{target.identity.file} — source</summary><pre className="source-diff">{source}</pre></details>}
        {target && Object.entries(target.unavailableReasons).map(([key, reason]) => <p key={key} className="limited-editing">{reason}</p>)}
        {diff && <div className="source-diff"><small>Actual source diff</small><pre>{diff}</pre></div>}
        <p className="transaction-status">{message}</p>
      </aside>
    </div>
  </main>
}
