import { useEffect, useRef, useState } from "react"
import { basicSetup, EditorView } from "codemirror"
import { keymap } from "@codemirror/view"
import { javascript } from "@codemirror/lang-javascript"
import { css } from "@codemirror/lang-css"
import { json } from "@codemirror/lang-json"
import type { FileOperation, MutationTransaction, RevisionLedger, SourceValidation } from "../core/types"

export type SourceResponse = { files?: Array<{ file: string; hash: string }>; source?: string; revision?: string; history?: RevisionLedger; validation?: SourceValidation; transaction?: MutationTransaction; diff?: string; error?: string }
type Request = (action: string, body?: Record<string, unknown>) => Promise<{ ok: boolean; data: SourceResponse }>
type Draft = { file: string; text: string; baseline: string; hash: string; baseRevision: string }

function CodeEditor({ file, value, onChange, onSave }: { file: string; value: string; onChange: (text: string) => void; onSave: () => void }) {
  const host = useRef<HTMLDivElement>(null), view = useRef<EditorView | undefined>(undefined)
  const callbacks = useRef({ onChange, onSave }); callbacks.current = { onChange, onSave }
  useEffect(() => {
    const editor = new EditorView({ parent: host.current!, doc: value, extensions: [
      basicSetup, file.endsWith(".css") ? css() : file.endsWith(".json") ? json() : javascript({ jsx: true, typescript: /\.tsx?$/.test(file) }),
      EditorView.contentAttributes.of({ "aria-label": "Source code editor" }),
      keymap.of([{ key: "Mod-s", run: () => { callbacks.current.onSave(); return true } }]),
      EditorView.updateListener.of(update => { if (update.docChanged) callbacks.current.onChange(update.state.doc.toString()) }),
      EditorView.theme({ "&": { height: "440px", fontSize: "13px" }, ".cm-scroller": { overflow: "auto", fontFamily: "monospace" } }),
    ] })
    view.current = editor
    return () => { editor.destroy(); view.current = undefined }
  }, [file])
  useEffect(() => { const editor = view.current; if (editor && editor.state.doc.toString() !== value) editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } }) }, [value])
  return <div ref={host} className="source-code-editor" />
}

export default function CodeWorkspace({ projectId, request, epoch, connected, visible, openFile, onAccepted }: { projectId: string; request: Request; epoch: number; connected: boolean; visible: "canvas" | "code" | "history"; openFile?: string; onAccepted: (data: SourceResponse) => Promise<void> }) {
  const [files, setFiles] = useState<Array<{ file: string; hash: string }>>([])
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [active, setActive] = useState("")
  const [head, setHead] = useState("")
  const [ledger, setLedger] = useState<RevisionLedger>()
  const [validation, setValidation] = useState<SourceValidation>()
  const [status, setStatus] = useState("")
  const [busy, setBusy] = useState(false)
  const [showDiff, setShowDiff] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<MutationTransaction>()
  const [fileAction, setFileAction] = useState<"create" | "rename" | "delete">("create")
  const [newPath, setNewPath] = useState("src/New.tsx")
  const serial = useRef(0), mounted = useRef(true), saving = useRef(false)
  const pendingSave = useRef<{ signature: string; key: string } | undefined>(undefined)
  const requests = useRef(request); requests.current = request
  const draft = drafts[active], dirty = Boolean(draft && draft.text !== draft.baseline)
  const conflict = Boolean(dirty && draft.baseRevision !== head)
  const initialHashes = new Map<string, string>()
  for (const entry of ledger?.transactions ?? []) if (entry.success) for (const [file, version] of Object.entries(entry.versions ?? {})) if (!initialHashes.has(file)) initialHashes.set(file, version.before)

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; ++serial.current } }, [])
  useEffect(() => { setDrafts({}); setActive(""); setFiles([]); setLedger(undefined); setValidation(undefined); setStatus(""); ++serial.current }, [projectId])
  useEffect(() => {
    if (!connected) return
    const sequence = ++serial.current
    void (async () => {
      const listing = await requests.current("files")
      if (sequence !== serial.current) return
      if (!listing.ok) { setStatus(listing.data.error ?? "Source unavailable."); return }
      setFiles(listing.data.files ?? []); setHead(listing.data.revision ?? "")
      setActive(current => current || listing.data.files?.[0]?.file || "")
      const history = await requests.current("history")
      if (sequence === serial.current && history.ok) setLedger(history.data.history)
    })().catch(() => { if (sequence === serial.current) setStatus("Source connection unavailable. Drafts are retained.") })
  }, [epoch, connected, projectId])
  useEffect(() => {
    if (visible !== "history" || !connected) return
    let cancelled = false
    void requests.current("history").then(response => { if (!cancelled && response.ok) { setLedger(response.data.history); setHead(response.data.revision ?? "") } }).catch(() => {})
    return () => { cancelled = true }
  }, [visible, connected])
  useEffect(() => { if (openFile) setActive(openFile) }, [openFile])
  useEffect(() => {
    if (!active || !connected) return
    let cancelled = false
    void requests.current("files", { file: active }).then(response => {
      if (cancelled || !response.ok || response.data.source === undefined) return
      const source = response.data.source, hash = response.data.files?.find(file => file.file === active)?.hash ?? "", baseRevision = response.data.revision ?? ""
      setHead(baseRevision)
      setDrafts(current => current[active] && current[active].text !== current[active].baseline ? current : { ...current, [active]: { file: active, text: source, baseline: source, hash, baseRevision } })
    }).catch(() => { if (!cancelled) setStatus("Unable to load this file.") })
    return () => { cancelled = true }
  }, [active, epoch, connected])
  useEffect(() => {
    if (!draft || !connected || !dirty) { setValidation(undefined); return }
    let cancelled = false
    const timer = setTimeout(() => {
      void requests.current("validate", { file: draft.file, content: draft.text }).then(response => { if (!cancelled && response.ok) setValidation(response.data.validation) }).catch(() => {})
    }, 500)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [draft?.text, draft?.file, connected, dirty])
  useEffect(() => {
    const preventLoss = (event: BeforeUnloadEvent) => { if (Object.values(drafts).some(item => item.text !== item.baseline)) { event.preventDefault(); event.returnValue = "" } }
    window.addEventListener("beforeunload", preventLoss)
    return () => window.removeEventListener("beforeunload", preventLoss)
  }, [drafts])

  async function save() {
    if (!draft || !dirty || saving.current || !connected) return
    saving.current = true; setBusy(true); setStatus("Validating source before acceptance…")
    const saved = { ...draft }
    // Keep the same key after an uncertain transport failure. Changing the draft
    // creates a new proposal and therefore a new key.
    const signature = JSON.stringify(saved)
    if (pendingSave.current?.signature !== signature) pendingSave.current = { signature, key: crypto.randomUUID() }
    try {
      const response = await requests.current("code", { expectedRevision: saved.baseRevision, idempotencyKey: pendingSave.current!.key, operations: [{ kind: "update", file: saved.file, expectedHash: saved.hash, content: saved.text }] })
      if (!mounted.current) return
      setValidation(response.data.validation)
      if (!response.ok) { pendingSave.current = undefined; setStatus(response.data.error ?? "Save rejected. Draft retained; preview remains at the last accepted revision."); const latest = await requests.current("history"); if (latest.ok) { setLedger(latest.data.history); setHead(latest.data.revision ?? head) } return }
      pendingSave.current = undefined
      const current = await requests.current("files", { file: saved.file })
      const newSource = current.data.source ?? saved.text, newHash = current.data.files?.find(file => file.file === saved.file)?.hash ?? ""
      setDrafts(all => ({ ...all, [saved.file]: { ...saved, baseline: newSource, text: all[saved.file]?.text === saved.text ? newSource : all[saved.file]?.text ?? saved.text, hash: newHash, baseRevision: response.data.revision! } }))
      setStatus("Saved real source. Selection cleared; preview is rebuilding.")
      await onAccepted(response.data)
    } catch { setStatus("Save response unavailable. Draft retained; Save retries the same request safely.") }
    finally { saving.current = false; if (mounted.current) setBusy(false) }
  }
  async function reloadBase() {
    if (!draft) return
    const response = await requests.current("files", { file: active })
    if (!response.ok || response.data.source === undefined) { setStatus(response.data.error ?? "Source unavailable."); return }
    if (response.data.source !== draft.baseline) { setStatus("This file changed in accepted source. Copy your draft, then use Discard draft to load the current file and reconcile manually."); return }
    setDrafts(all => ({ ...all, [active]: { ...all[active], baseRevision: response.data.revision! } })); setHead(response.data.revision!); pendingSave.current = undefined
    setStatus("Draft rebased: this file is unchanged; later edits in other files are preserved.")
  }
  async function discard() {
    const response = await requests.current("files", { file: active })
    if (!response.ok || response.data.source === undefined) return
    const source = response.data.source
    setDrafts(all => ({ ...all, [active]: { file: active, text: source, baseline: source, hash: response.data.files!.find(file => file.file === active)!.hash, baseRevision: response.data.revision! } }))
    setHead(response.data.revision!); setStatus("Loaded current accepted source."); pendingSave.current = undefined
  }
  async function applyFileOperation() {
    if (saving.current || !connected || Object.values(drafts).some(item => item.text !== item.baseline)) return
    const file = files.find(item => item.file === active)
    if (fileAction !== "create" && !file) return
    const operation: FileOperation = fileAction === "create"
      ? { kind: "create", file: newPath, expectedHash: null, content: newPath.endsWith(".json") ? "{}\n" : newPath.endsWith(".css") ? "/* New stylesheet */\n" : "export {}\n" }
      : fileAction === "rename" ? { kind: "rename", file: active, to: newPath, expectedHash: file!.hash }
      : { kind: "delete", file: active, expectedHash: file!.hash }
    saving.current = true; setBusy(true)
    try {
      const response = await requests.current("code", { expectedRevision: head, idempotencyKey: crypto.randomUUID(), operations: [operation] })
      if (!response.ok) { setStatus(response.data.error ?? "File operation rejected. Source is unchanged."); setValidation(response.data.validation); return }
      setDrafts(all => { const next = { ...all }; delete next[active]; return next })
      setActive(fileAction === "delete" ? files.find(item => item.file !== active)?.file ?? "" : newPath)
      setStatus(`Source ${fileAction} accepted. History retains a safe inverse.`)
      await onAccepted(response.data)
    } catch { setStatus("File operation response unavailable. Reopen History to check acceptance before retrying.") }
    finally { saving.current = false; setBusy(false) }
  }
  async function historyAction(action: "revert" | "checkpoint", id?: string) {
    if (saving.current) return
    saving.current = true; setBusy(true)
    try {
      const response = await requests.current(action, { expectedRevision: head, idempotencyKey: crypto.randomUUID(), transactionId: id })
      if (!response.ok) { setStatus(response.data.error ?? "History action rejected."); return }
      setStatus(action === "checkpoint" ? "Validated checkpoint recorded." : "Revert committed against the current revision.")
      await onAccepted(response.data)
    } catch { setStatus("History connection unavailable. Reload History to check the result.") }
    finally { saving.current = false; setBusy(false) }
  }

  return <div className="source-workspace" hidden={visible === "canvas"}>
    {visible === "code" && <>
      <div className="source-file-tree" aria-label="Source file tree">{files.map(item => <button key={item.file} aria-pressed={active === item.file} onClick={() => { setActive(item.file); setValidation(undefined) }}>{item.file}{drafts[item.file]?.text !== drafts[item.file]?.baseline ? " ●" : initialHashes.has(item.file) && initialHashes.get(item.file) !== item.hash ? " M" : ""}</button>)}</div>
      <div className="source-editor-panel">
        <div className="source-editor-actions"><strong>{active || "Connect to open source"}{dirty ? " • Unsaved draft" : " • Accepted source"}</strong><button onClick={() => void save()} disabled={!dirty || busy || !connected}>Save source</button><button onClick={() => setShowDiff(value => !value)} disabled={!draft}>Draft diff</button><button onClick={() => void discard()} disabled={!dirty || busy}>Discard draft</button></div>
        <details className="source-file-operations"><summary>File operations</summary><label>File action <select aria-label="File action" value={fileAction} onChange={event => setFileAction(event.target.value as typeof fileAction)}><option value="create">Create</option><option value="rename">Rename</option><option value="delete">Delete</option></select></label>{fileAction !== "create" && <p>{fileAction === "delete" ? "Delete" : "Rename"} <b>{active}</b></p>}{fileAction !== "delete" && <label>New source path <input aria-label="New source path" value={newPath} onChange={event => setNewPath(event.target.value)} /></label>}<p>Save or discard drafts first. Referenced files cannot be removed or renamed if that breaks the preview build. Multi-file import updates can be submitted together through the source transaction API.</p><button onClick={() => void applyFileOperation()} disabled={busy || !connected || Object.values(drafts).some(item => item.text !== item.baseline)}>Apply file operation</button></details>
        {conflict && <p role="alert">HEAD changed while this draft was open. Save will reject this stale base. <button onClick={() => void reloadBase()}>Rebase unchanged file</button></p>}
        {draft && <CodeEditor file={active} value={draft.text} onChange={value => setDrafts(all => ({ ...all, [active]: { ...all[active], text: value } }))} onSave={() => void save()} />}
        {validation && <div className="source-diagnostics" role="status">{validation.passed ? "Parse checks passed. Save validates the controlled preview bundle." : "Syntax/validation error — draft retained; preview remains at the last accepted revision."}{validation.diagnostics.map((item, index) => <p key={index}>{item.file}{item.line ? `:${item.line}:${item.column ?? 0}` : ""}: {item.message}</p>)}</div>}
        {showDiff && draft && <pre className="draft-diff">{`${active}\n--- Accepted source\n${draft.baseline.split("\n").map(line => "-" + line).join("\n")}\n+++ Draft\n${draft.text.split("\n").map(line => "+" + line).join("\n")}`}</pre>}
        <small>⌘S / Ctrl+S saves one transaction. Drafts stay in memory until accepted.</small>
      </div>
    </>}
    {visible === "history" && <div className="source-history"><h2>Source history</h2><p>HEAD <code>{head}</code></p><button onClick={() => void historyAction("checkpoint")} disabled={busy || !connected}>Create checkpoint</button><p>Revert checks every affected file. A later change in an affected file requires manual reconciliation.</p>
      {[...(ledger?.transactions ?? [])].reverse().map(entry => <article key={entry.id} data-transaction-id={entry.id}><b>{entry.summary}</b><span>{entry.status} · {entry.producer} · {new Date(entry.timestamp).toLocaleString()}{entry.newRevisionId === head ? " · HEAD" : ""}</span><code>{entry.id}<br/>{entry.baseRevisionId} → {entry.newRevisionId ?? "no revision"}</code><p>{entry.fileStates?.map(item => item.file).join(", ") || entry.file || "Source checkpoint"}</p><button onClick={() => setSelectedEntry(entry)}>View diff</button><button disabled={busy || !ledger?.past.includes(entry.id)} onClick={() => void historyAction("revert", entry.id)}>Revert transaction</button>{entry.validation && <small>{entry.validation.level}: {entry.validation.passed ? "passed" : "failed"}</small>}{entry.error && <p role="alert">{entry.error}</p>}</article>)}
      {!ledger?.transactions.length && <p>No accepted changes yet. The initial source revision is retained.</p>}
      {selectedEntry && <pre className="history-diff">{`Transaction ${selectedEntry.id}\n` + selectedEntry.patches.map(patch => `${patch.file}\n@@ offset ${patch.range.start} @@\n${patch.before.split("\n").map(line => "-" + line).join("\n")}\n${patch.after.split("\n").map(line => "+" + line).join("\n")}`).join("\n\n")}</pre>}
    </div>}
    <p className="code-status" role="status">{status}</p>
  </div>
}
