import { useEffect, useMemo, useRef, useState } from "react"
import { isPreviewMessage, PREVIEW_CHANNEL } from "../bridge/previewProtocol"
import type { CompatibilitySummary, PreviewElement, SourceTarget, StyleProperty } from "../core/types"
import "./compatibleWorkspace.css"

type MutationResult = { transaction?: { success: boolean; error?: string; id: string; before: string; after: string } }

const editableLabels: Partial<Record<StyleProperty, string>> = {
  backgroundColor: "Background", color: "Text color", fontSize: "Font size", fontWeight: "Font weight",
  padding: "Padding", paddingX: "Horizontal padding", paddingY: "Vertical padding", margin: "Margin", gap: "Gap",
  width: "Width", height: "Height", border: "Border", borderRadius: "Radius", alignItems: "Align items", justifyContent: "Justify content",
}

function fixtureOrigin() {
  return `${window.location.protocol}//fixture.localhost${window.location.port ? `:${window.location.port}` : ""}`
}

async function engineRequest(path: string, body: unknown) {
  const response = await fetch(`/__webcanbe/api${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  return { ok: response.ok, data: await response.json() as MutationResult & { target?: SourceTarget; summary?: CompatibilitySummary; error?: string } }
}

export default function CompatibleWorkspace() {
  const frame = useRef<HTMLIFrameElement>(null)
  const session = useRef(crypto.randomUUID())
  const [hovered, setHovered] = useState<PreviewElement>()
  const [selected, setSelected] = useState<PreviewElement>()
  const [target, setTarget] = useState<SourceTarget>()
  const [summary, setSummary] = useState<CompatibilitySummary>()
  const [message, setMessage] = useState("Select an element in the running project.")
  const [text, setText] = useState("")
  const origin = useMemo(fixtureOrigin, [])

  useEffect(() => {
    void engineRequest("/compatibility", {}).then(({ data }) => setSummary(data.summary)).catch(() => setMessage("The local Compatible engine is unavailable."))
    const receive = (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== frame.current?.contentWindow || !isPreviewMessage(event.data) || event.data.session !== session.current) return
      if (event.data.type === "hover") setHovered(event.data.element)
      if (event.data.type === "select") {
        setSelected(event.data.element)
        setMessage("Reading the element’s real source location…")
        void engineRequest("/inspect", { identity: event.data.element.identity }).then(({ ok, data }) => {
          if (!ok || !data.target) { setTarget(undefined); setMessage(data.error ?? "This element is preview-only."); return }
          setTarget(data.target)
          setText(data.target.text ?? "")
          setMessage(data.target.capabilities.visualEdit ? "Connected to the real source file." : "This element is available in code, but no safe visual edit was found.")
        }).catch(() => setMessage("Could not inspect the selected source location."))
      }
    }
    window.addEventListener("message", receive)
    return () => window.removeEventListener("message", receive)
  }, [origin])

  function configurePreview() {
    frame.current?.contentWindow?.postMessage({ channel: PREVIEW_CHANNEL, type: "configure", session: session.current, active: true }, origin)
  }

  async function mutate(edit: { type: "text"; value: string } | { type: "style"; property: StyleProperty; value: string }) {
    if (!selected) return
    const { ok, data } = await engineRequest("/mutate", { identity: selected.identity, edit })
    if (!ok || !data.transaction?.success) { setMessage(data.transaction?.error ?? data.error ?? "The source change was not safe to apply."); return }
    setMessage(`Saved source transaction ${data.transaction.id.slice(0, 12)}.`)
    const inspected = await engineRequest("/inspect", { identity: selected.identity })
    if (inspected.data.target) { setTarget(inspected.data.target); setText(inspected.data.target.text ?? "") }
    const compatibility = await engineRequest("/compatibility", {})
    setSummary(compatibility.data.summary)
  }

  const activeBox = selected ?? hovered
  const styleOrigins = target?.styleOrigins.filter((origin) => origin.editable) ?? []

  return <main className="compatible-workspace">
    <header className="compatible-topbar">
      <a href="/projects" onClick={(event) => { event.preventDefault(); window.history.pushState({}, "", "/projects"); window.dispatchEvent(new PopStateEvent("popstate")) }} className="compatible-brand">WebCanBe <span>/ Compatible</span></a>
      <div className="compatible-project-status"><i/> Internal React/Vite fixture <small>Actual source files</small></div>
      <div className="compatible-top-actions"><span>Visual editing</span><button type="button">Export code</button></div>
    </header>
    <div className="compatible-layout">
      <aside className="compatible-files">
        <p>Fixture files</p>
        <strong>▾ src</strong>
        <span>⌘ App.tsx</span>
        <strong>▾ components</strong>
        <span>⌘ Hero.tsx</span>
        <span>⌘ FeatureGrid.tsx</span>
        <span>⌘ InlineNote.tsx</span>
        <span>⌘ TailwindPanel.tsx</span>
        <strong>▾ styles</strong>
        <span># App.css</span>
        <span># FeatureGrid.module.css</span>
        <div className="compatibility-summary">
          <small>Visual compatibility</small>
          <b>{summary ? `${summary.score}%` : "…"}</b>
          <p>{summary ? `${summary.full} full · ${summary.partial} partial · ${summary.codeOnly} code only` : "Analysing real source…"}</p>
        </div>
      </aside>
      <section className="compatible-preview-shell">
        <div className="compatible-preview-head"><span><i/> Live Vite runtime</span><span>iframe boundary</span></div>
        <div className="compatible-frame-wrap">
          <iframe ref={frame} onLoad={configurePreview} title="Running React/Vite fixture" src={`${origin}/__webcanbe/fixture/`} sandbox="allow-scripts allow-same-origin" />
          {activeBox && <div className={`canvas-outline ${selected ? "selected" : ""}`} style={{ left: activeBox.rect.left, top: activeBox.rect.top, width: activeBox.rect.width, height: activeBox.rect.height }}>
            {selected && <span>{selected.tagName} · {selected.identity.file.replace("src/", "")}</span>}
          </div>}
        </div>
      </section>
      <aside className="compatible-inspector">
        <div className="inspector-heading"><p>Element inspector</p><span>{target?.compatibility ?? "preview"}</span></div>
        {selected && <div className="source-location"><small>Source location</small><b>{selected.identity.file}</b><span>JSX offset {selected.identity.elementStart} · {selected.layoutContext} layout</span></div>}
        {!selected && <div className="empty-inspector"><b>Visual editing changes the same files.</b><p>Hover and select an element in the actual running project to inspect its real source.</p></div>}
        {target?.capabilities.text && <label className="inspector-control">Text <textarea value={text} onChange={(event) => setText(event.target.value)} /><button type="button" onClick={() => void mutate({ type: "text", value: text })}>Apply text change</button></label>}
        {styleOrigins.length > 0 && <div className="style-controls"><small>Safe style origins</small>{styleOrigins.map((origin) => <label className="inspector-control" key={`${origin.property}-${origin.kind}`}><span>{editableLabels[origin.property] ?? origin.property}<em>{origin.kind}</em></span><div><input defaultValue={origin.value?.replace(/^['"]|['"]$/g, "")} key={origin.value} onBlur={(event) => { if (event.target.value !== origin.value?.replace(/^['"]|['"]$/g, "")) void mutate({ type: "style", property: origin.property, value: event.target.value }) }} /><button type="button" onClick={(event) => { const input = event.currentTarget.previousElementSibling as HTMLInputElement; void mutate({ type: "style", property: origin.property, value: input.value }) }}>Save</button></div></label>)}</div>}
        {target && !target.capabilities.visualEdit && <div className="limited-editing">Visual edits are intentionally disabled: WebCanBe cannot safely identify a static text or style source for this element. The preview remains available.</div>}
        <p className="transaction-status">{message}</p>
      </aside>
    </div>
  </main>
}
