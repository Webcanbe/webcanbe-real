import type { DraftState } from "../runtime/draftStore"
import { useEffect, useMemo, useRef, useState } from "react"
import { basicSetup, EditorView } from "codemirror"
import { keymap } from "@codemirror/view"
import { javascript } from "@codemirror/lang-javascript"
import { css } from "@codemirror/lang-css"
import { json } from "@codemirror/lang-json"
import type { FileOperation, MutationTransaction, RevisionLedger, SourceValidation } from "../core/types"

export type SourceResponse = { archivedHistory?: {transactions: MutationTransaction[];revisions: RevisionLedger["revisions"]}; restorePreview?: {baseRevision:string;revisionId:string;files:Array<{file:string;kind:string;expectedHash:string|null;afterHash:string|null}>;diff:string;truncatedPerFile:number}; draftState?: DraftState; files?: Array<{ file: string; hash: string }>; source?: string; revision?: string; history?: RevisionLedger; validation?: SourceValidation; transaction?: MutationTransaction; diff?: string; searchResults?: SourceSearchResult[]; searchMeta?: SourceSearchMeta; error?: string }
type Request = (action: string, body?: Record<string, unknown>) => Promise<{ ok: boolean; data: SourceResponse }>
type Draft = { file: string; text: string; baseline: string; hash: string; baseRevision: string }
export type CodeOpenLocation = Readonly<{ file: string; start?: number; end?: number; sequence: number }>
type TextMatch = Readonly<{ start: number; end: number }>
type SourceSearchResult = Readonly<{ file: string; start: number; end: number; line: number; column: number; preview: string }>
type SourceSearchMeta = Readonly<{ scannedFiles: number; totalFiles: number; scannedBytes: number; truncated: boolean }>

function findTextMatches(text: string, query: string, caseSensitive: boolean): TextMatch[] {
  if (!query) return []
  const escaped = [...query].map(character => "^$.*+?()[]{}|".includes(character) || character.charCodeAt(0) === 92 ? String.fromCharCode(92) + character : character).join("")
  const pattern = new RegExp(escaped, caseSensitive ? "g" : "gi")
  const matches: TextMatch[] = []
  let match: RegExpExecArray | null
  while (matches.length < 1000 && (match = pattern.exec(text))) {
    matches.push({ start: match.index, end: match.index + match[0].length })
    if (!match[0].length) pattern.lastIndex += 1
  }
  return matches
}

function CodeEditor({ file, value, reveal, onChange, onSave, onSaveAll }: { file: string; value: string; reveal?: CodeOpenLocation; onChange: (text: string) => void; onSave: () => void; onSaveAll: () => void }) {
  const host = useRef<HTMLDivElement>(null), view = useRef<EditorView | undefined>(undefined)
  const callbacks = useRef({ onChange, onSave, onSaveAll }); callbacks.current = { onChange, onSave, onSaveAll }
  useEffect(() => {
    const editor = new EditorView({ parent: host.current!, doc: value, extensions: [
      basicSetup, file.endsWith(".css") ? css() : file.endsWith(".json") ? json() : javascript({ jsx: true, typescript: /\.(?:tsx?|mts|cts)$/.test(file) }),
      EditorView.contentAttributes.of({ "aria-label": "Source code editor" }),
      keymap.of([
        { key: "Mod-s", run: () => { callbacks.current.onSave(); return true } },
        { key: "Mod-Shift-s", run: () => { callbacks.current.onSaveAll(); return true } },
      ]),
      EditorView.updateListener.of(update => { if (update.docChanged) callbacks.current.onChange(update.state.doc.toString()) }),
      EditorView.theme({ "&": { height: "440px", fontSize: "13px" }, ".cm-scroller": { overflow: "auto", fontFamily: "monospace" } }),
    ] })
    view.current = editor
    return () => { editor.destroy(); view.current = undefined }
  }, [file])
  useEffect(() => { const editor = view.current; if (editor && editor.state.doc.toString() !== value) editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } }) }, [value])
  useEffect(() => {
    const editor = view.current
    if (!editor || !reveal || reveal.file !== file) return
    const length = editor.state.doc.length
    const start = Math.max(0, Math.min(reveal.start ?? 0, length))
    const end = Math.max(start, Math.min(reveal.end ?? start, length))
    editor.dispatch({ selection: { anchor: start, head: end }, effects: EditorView.scrollIntoView(start, { y: "center" }) })
    editor.focus()
  }, [file, reveal?.sequence])
  return <div ref={host} className="source-code-editor" />
}

export default function CodeWorkspace({ projectId, request, epoch, connected, visible, openFile, openLocation, onAccepted }: { projectId: string; request: Request; epoch: number; connected: boolean; visible: "canvas" | "code" | "split" | "history"; openFile?: string; openLocation?: CodeOpenLocation; onAccepted: (data: SourceResponse) => Promise<void> }) {
  const [files, setFiles] = useState<Array<{ file: string; hash: string }>>([])
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [active, setActive] = useState("")
  const [draftsLoaded, setDraftsLoaded] = useState(false)
  const [backupStatus, setBackupStatus] = useState("")
  const draftVersion = useRef(0), backupQueue = useRef(Promise.resolve())
  const dirtyDrafts = Object.values(drafts).filter(item => item.text !== item.baseline)
  const [head, setHead] = useState("")
  const [ledger, setLedger] = useState<RevisionLedger>()
  const [validation, setValidation] = useState<SourceValidation>()
  const [status, setStatus] = useState("")
  const [busy, setBusy] = useState(false)
  const [showDiff, setShowDiff] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<MutationTransaction>()
  const [fileAction, setFileAction] = useState<"create" | "rename" | "delete">("create")
  const [newPath, setNewPath] = useState("src/New.tsx")
  const [quickOpen, setQuickOpen] = useState(false), [quickQuery, setQuickQuery] = useState("")
  const [findOpen, setFindOpen] = useState(false), [findQuery, setFindQuery] = useState(""), [replaceValue, setReplaceValue] = useState(""), [caseSensitive, setCaseSensitive] = useState(false), [matchIndex, setMatchIndex] = useState(0)
  const [projectSearchOpen, setProjectSearchOpen] = useState(false), [projectQuery, setProjectQuery] = useState(""), [projectCaseSensitive, setProjectCaseSensitive] = useState(false)
  const [projectResults, setProjectResults] = useState<SourceSearchResult[]>([]), [projectSearchMeta, setProjectSearchMeta] = useState<SourceSearchMeta>(), [projectSearching, setProjectSearching] = useState(false), [projectSearchError, setProjectSearchError] = useState("")
  const [recentFiles, setRecentFiles] = useState<string[]>([])
  const [reveal, setReveal] = useState<CodeOpenLocation>()
  const serial = useRef(0), mounted = useRef(true), saving = useRef(false), revealSequence = useRef(0)
  const validationVersion = useRef(0), validationState = useRef({head,drafts})
  validationState.current = {head,drafts}
  const pendingSave = useRef<{ signature: string; key: string } | undefined>(undefined)
  const requests = useRef(request); requests.current = request
  const draft = drafts[active], dirty = Boolean(draft && draft.text !== draft.baseline)
  const conflict = Boolean(dirty && draft.baseRevision !== head)
  const searchMatches = useMemo(() => findTextMatches(draft?.text ?? "", findQuery, caseSensitive), [draft?.text, findQuery, caseSensitive])
  const quickFiles = useMemo(() => {
    const all = files.map(item => item.file)
    const query = quickQuery.trim().toLowerCase()
    if (query) return all.filter(file => file.toLowerCase().includes(query)).slice(0, 60)
    return [...recentFiles, ...all.filter(file => !recentFiles.includes(file))].slice(0, 60)
  }, [files, quickQuery, recentFiles])
  const initialHashes = new Map<string, string>()
  for (const entry of ledger?.transactions ?? []) if (entry.success) for (const [file, version] of Object.entries(entry.versions ?? {})) if (!initialHashes.has(file)) initialHashes.set(file, version.before)

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; ++serial.current } }, [])
  useEffect(() => { setDrafts({}); setDraftsLoaded(false); draftVersion.current = 0; setActive(""); setFiles([]); setLedger(undefined); setValidation(undefined); setStatus(""); setRecentFiles([]); setQuickOpen(false); setFindOpen(false); setProjectSearchOpen(false); setProjectResults([]); setProjectSearchMeta(undefined); setProjectSearchError(""); setReveal(undefined); ++serial.current }, [projectId])
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
    if (!connected || draftsLoaded) return
    let cancelled = false
    void requests.current("drafts").then(response => {
      if (cancelled) return
      if (response.ok && response.data.draftState) {
        const state = response.data.draftState; draftVersion.current = state.version
        setDrafts(current => ({ ...Object.fromEntries(state.drafts.map(draft => [draft.file, draft])), ...Object.fromEntries(Object.entries(current).filter(([,draft]) => draft.text !== draft.baseline)) }))
        if (state.drafts.length) setBackupStatus("Recovered backed-up drafts. Accepted source is unchanged; review before saving.")
      }
      setDraftsLoaded(true)
    }).catch(() => { if (!cancelled) setBackupStatus("Draft recovery unavailable. Reconnect before editing.") })
    return () => { cancelled = true }
  }, [connected, draftsLoaded, projectId])
  useEffect(() => {
    if (!connected || !draftsLoaded) return
    const proposal = Object.values(drafts).filter(draft => draft.text !== draft.baseline).map(draft => ({ ...draft }))
    let cancelled = false
    const saveRequest = requests.current
    const timer = setTimeout(() => {
      setBackupStatus("Backing up drafts…")
      backupQueue.current = backupQueue.current.then(async () => {
        if (cancelled) return
        const response = await saveRequest("drafts", { command: "save", version: draftVersion.current, drafts: proposal })
        if (!response.ok || !response.data.draftState) { setBackupStatus(response.data.error ?? "Draft backup failed; keep this editor open."); return }
        if (!mounted.current) return
        draftVersion.current = response.data.draftState.version
        if (!cancelled) setBackupStatus(proposal.length ? "Draft backup saved. Restore it after reconnecting or restarting." : "No unsaved drafts to back up.")
      }).catch(() => setBackupStatus("Draft backup unavailable; keep this editor open."))
    }, 250)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [drafts, connected, draftsLoaded, projectId])
  useEffect(() => {
    if (visible !== "history" || !connected) return
    let cancelled = false
    void requests.current("history").then(response => { if (!cancelled && response.ok) { setLedger(response.data.history); setHead(response.data.revision ?? "") } }).catch(() => {})
    return () => { cancelled = true }
  }, [visible, connected])
  function openSourceFile(file: string) {
    if (!file) return
    setActive(file)
    setValidation(undefined)
    setRecentFiles(current => [file, ...current.filter(value => value !== file)].slice(0, 6))
    setQuickOpen(false)
  }
  function revealRange(file: string, start: number, end: number) {
    openSourceFile(file)
    setReveal({ file, start, end, sequence: ++revealSequence.current })
  }
  function jumpToMatch(index: number) {
    if (!active || !searchMatches.length) return
    const normalized = (index + searchMatches.length) % searchMatches.length
    const match = searchMatches[normalized]
    setMatchIndex(normalized)
    revealRange(active, match.start, match.end)
  }
  function replaceCurrentMatch() {
    if (!draft || !searchMatches.length) return
    const match = searchMatches[Math.min(matchIndex, searchMatches.length - 1)]
    const next = draft.text.slice(0, match.start) + replaceValue + draft.text.slice(match.end)
    setDrafts(all => ({ ...all, [active]: { ...all[active], text: next } }))
    setStatus("Replaced one match in the draft. Save source to accept it.")
    setMatchIndex(0)
    setReveal({ file: active, start: match.start, end: match.start + replaceValue.length, sequence: ++revealSequence.current })
  }
  function replaceAllMatches() {
    if (!draft || !searchMatches.length) return
    let next = draft.text
    for (const match of [...searchMatches].reverse()) next = next.slice(0, match.start) + replaceValue + next.slice(match.end)
    setDrafts(all => ({ ...all, [active]: { ...all[active], text: next } }))
    setStatus(`Replaced ${searchMatches.length} matches in the draft. Save source to accept them.`)
    setMatchIndex(0)
  }
  async function runProjectSearch() {
    const query = projectQuery.trim()
    if (!connected || projectSearching) return
    if (!query || query.length > 160 || /[\r\n\0]/.test(query)) { setProjectSearchError("Enter a single-line search query up to 160 characters."); return }
    setProjectSearching(true); setProjectSearchError("")
    try {
      const response = await requests.current("search", { expectedRevision: head, query, caseSensitive: projectCaseSensitive, limit: 100 })
      if (!response.ok) { setProjectResults([]); setProjectSearchMeta(undefined); setProjectSearchError(response.data.error ?? "Project search is unavailable."); return }
      setProjectResults(response.data.searchResults ?? [])
      setProjectSearchMeta(response.data.searchMeta)
      if (response.data.revision) setHead(response.data.revision)
    } catch { setProjectResults([]); setProjectSearchMeta(undefined); setProjectSearchError("Project search connection is unavailable.") }
    finally { setProjectSearching(false) }
  }
  function openProjectSearchResult(result: SourceSearchResult) {
    const fileDraft = drafts[result.file]
    const hasUnsavedDraft = Boolean(fileDraft && fileDraft.text !== fileDraft.baseline)
    openSourceFile(result.file)
    setProjectSearchOpen(false)
    if (hasUnsavedDraft) {
      setReveal(undefined)
      setStatus("Search result is anchored to accepted source, but this file has an unsaved draft. Save or discard the draft, then search again for an exact jump.")
      return
    }
    revealRange(result.file, result.start, result.end)
  }
  useEffect(() => { if (openFile) openSourceFile(openFile) }, [openFile])
  useEffect(() => { if (openLocation) { const fileDraft = drafts[openLocation.file]; openSourceFile(openLocation.file); if (fileDraft && fileDraft.text !== fileDraft.baseline) { setReveal(undefined); setStatus("This exact source location belongs to accepted source, but the file has an unsaved draft. Save or discard it before jumping to the accepted range."); } else setReveal(openLocation) } }, [openLocation?.sequence])
  useEffect(() => { if (active) setRecentFiles(current => current[0] === active ? current : [active, ...current.filter(value => value !== active)].slice(0, 6)) }, [active])
  useEffect(() => { setMatchIndex(0) }, [findQuery, caseSensitive, active])
  useEffect(() => {
    if (!connected || (visible !== "code" && visible !== "split")) return
    const handler = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase(), mod = event.metaKey || event.ctrlKey
      if (mod && !event.shiftKey && !event.altKey && key === "p") { event.preventDefault(); setQuickOpen(true); setQuickQuery(""); return }
      if (mod && !event.shiftKey && !event.altKey && key === "f") { event.preventDefault(); setFindOpen(true); return }
      if (mod && event.shiftKey && !event.altKey && key === "f") { event.preventDefault(); setProjectSearchOpen(true); return }
      if (event.key === "Escape") { setQuickOpen(false); setFindOpen(false); setProjectSearchOpen(false) }
    }
    window.addEventListener("keydown", handler, true)
    return () => window.removeEventListener("keydown", handler, true)
  }, [connected, visible])
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
    const version=++validationVersion.current
    setValidation(undefined)
    if (!draft || !connected || !dirty) return
    let cancelled = false
    const timer = setTimeout(() => {
      void requests.current("validate", { file: draft.file, content: draft.text }).then(response => { if (!cancelled && version===validationVersion.current && response.ok) setValidation(response.data.validation) }).catch(() => {})
    }, 500)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [draft?.text, draft?.file, connected, dirty])
  useEffect(() => {
    const preventLoss = (event: BeforeUnloadEvent) => { if (Object.values(drafts).some(item => item.text !== item.baseline)) { event.preventDefault(); event.returnValue = "" } }
    window.addEventListener("beforeunload", preventLoss)
    return () => window.removeEventListener("beforeunload", preventLoss)
  }, [drafts])

  async function save(all = false) {
    const proposals = all ? dirtyDrafts : draft && dirty ? [draft] : []
    if (!proposals.length || saving.current || !connected) return
    if (new Set(proposals.map(draft => draft.baseRevision)).size !== 1) { setStatus("Drafts have different base revisions. Rebase unchanged files before Save all."); return }
    saving.current = true; setBusy(true); setStatus("Validating source before acceptance…")
    const saved = proposals.map(draft => ({ ...draft }))
    const signature = JSON.stringify(saved)
    if (pendingSave.current?.signature !== signature) pendingSave.current = { signature, key: crypto.randomUUID() }
    try {
      const response = await requests.current("code", { expectedRevision: saved[0].baseRevision, idempotencyKey: pendingSave.current!.key, operations: saved.map(draft => ({ kind: "update", file: draft.file, expectedHash: draft.hash, content: draft.text })) })
      if (!mounted.current) return
      setValidation(response.data.validation)
      if (!response.ok) { pendingSave.current = undefined; setStatus(response.data.error ?? "Save rejected. Drafts retained; preview remains at the last accepted revision."); const latest = await requests.current("history"); if (latest.ok) { setLedger(latest.data.history); setHead(latest.data.revision ?? head) } return }
      pendingSave.current = undefined
      setDrafts(drafts => {
        const next = { ...drafts }
        for (const item of saved) {
          const hash = response.data.transaction?.versions?.[item.file]?.after ?? ""
          next[item.file] = { ...item, baseline: item.text, text: drafts[item.file]?.text ?? item.text, hash, baseRevision: response.data.revision! }
        }
        return next
      })
      setStatus(all ? `Saved ${saved.length} files in one source transaction. Preview is rebuilding.` : "Saved real source. Selection cleared; preview is rebuilding.")
      await onAccepted(response.data)
    } catch { setStatus("Save response unavailable. Drafts retained; Save retries the same request safely.") }
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
      const response = await requests.current("code", { expectedRevision: head, idempotencyKey: crypto.randomUUID(), operations: [operation], rewriteImports: fileAction === "rename" })
      if (!response.ok) { setStatus(response.data.error ?? "File operation rejected. Source is unchanged."); setValidation(response.data.validation); return }
      setDrafts(all => { const next = { ...all }; delete next[active]; return next })
      setActive(fileAction === "delete" ? files.find(item => item.file !== active)?.file ?? "" : newPath)
      setStatus(`Source ${fileAction} accepted. History retains a safe inverse.`)
      await onAccepted(response.data)
    } catch { setStatus("File operation response unavailable. Reopen History to check acceptance before retrying.") }
    finally { saving.current = false; setBusy(false) }
  }
  async function checkTypes() {
    if(saving.current||!connected)return
    const expected=head,sequence=serial.current,checkedDrafts=drafts,version=++validationVersion.current
    saving.current=true;setBusy(true);setStatus("Checking TypeScript in the isolated runner…")
    try{
      const response=await requests.current("validate",{mode:"semantic",expectedRevision:expected,operations:dirtyDrafts.map(d=>({kind:"update",file:d.file,expectedHash:d.hash,content:d.text}))})
      if(!mounted.current||serial.current!==sequence)return
      if(version!==validationVersion.current||validationState.current.head!==expected||validationState.current.drafts!==checkedDrafts){setStatus("Source or draft changed during type checking. Run Check types again.");return}
      if(!response.ok){setStatus(response.data.error??"Semantic checking unavailable.");return}
      setValidation(response.data.validation);setStatus("Semantic check complete. Source has not been saved.")
    }catch{if(mounted.current&&serial.current===sequence)setStatus("Semantic checking unavailable. Source is unchanged.")}
    finally{saving.current=false;if(mounted.current)setBusy(false)}
  }
  const [archivedEntries,setArchivedEntries]=useState<MutationTransaction[]>([])
  const [restorePreview,setRestorePreview]=useState<SourceResponse["restorePreview"]>()
  useEffect(()=>{setArchivedEntries([]);setRestorePreview(undefined)},[head])
  async function inspectHistory(body:Record<string,unknown>){
    const response=await requests.current("history",body)
    if(!response.ok){setStatus(response.data.error??"History inspection unavailable.");return}
    if(response.data.revision!==head){setStatus("History changed. Reload before restoring.");return}
    if(response.data.archivedHistory)setArchivedEntries(response.data.archivedHistory.transactions)
    if(response.data.restorePreview)setRestorePreview(response.data.restorePreview)
  }
  async function historyAction(action: "revert" | "checkpoint", id?: string, migrateSourceScope?: true, extra: {compactHistory?:true;restoreRevisionId?:string} = {}) {
    if (saving.current) return
    saving.current = true; setBusy(true)
    try {
      const response = await requests.current(action, { expectedRevision: head, idempotencyKey: crypto.randomUUID(), transactionId: id, migrateSourceScope, ...extra })
      if (!response.ok) { setStatus(response.data.error ?? "History action rejected."); return }
      setStatus(action === "checkpoint" ? "Validated checkpoint recorded." : "Revert committed against the current revision.")
      await onAccepted(response.data)
    } catch { setStatus("History connection unavailable. Reload History to check the result.") }
    finally { saving.current = false; setBusy(false) }
  }

  return <div className="source-workspace" hidden={visible === "canvas"}>
    {(visible === "code" || visible === "split") && <>{projectSearchOpen && <div className="source-project-search-backdrop" onMouseDown={() => setProjectSearchOpen(false)}><section className="source-project-search" role="dialog" aria-modal="true" aria-label="Search accepted project source" onMouseDown={event => event.stopPropagation()}><header><div><strong>Search project</strong><small>Accepted source only · unsaved drafts stay local</small></div><kbd>⇧⌘/Ctrl F</kbd></header><form onSubmit={event => { event.preventDefault(); void runProjectSearch() }}><input autoFocus aria-label="Search project source" value={projectQuery} onChange={event => { setProjectQuery(event.target.value); setProjectResults([]); setProjectSearchMeta(undefined); setProjectSearchError("") }} placeholder="Search accepted source…" maxLength={160}/><label><input type="checkbox" checked={projectCaseSensitive} onChange={event => { setProjectCaseSensitive(event.target.checked); setProjectResults([]); setProjectSearchMeta(undefined); setProjectSearchError("") }}/> Match case</label><button type="submit" disabled={projectSearching || !projectQuery.trim()}>{projectSearching ? "Searching…" : "Search"}</button></form>{projectSearchError && <p className="source-project-search-error" role="alert">{projectSearchError}</p>}{projectSearchMeta && <p className="source-project-search-meta">{projectResults.length} results · {projectSearchMeta.scannedFiles}/{projectSearchMeta.totalFiles} files scanned{projectSearchMeta.truncated ? " · bounded/truncated" : ""}</p>}<div className="source-project-search-results">{projectResults.length ? projectResults.map((result,index) => { const fileDraft=drafts[result.file], dirtyResult=Boolean(fileDraft&&fileDraft.text!==fileDraft.baseline); return <button type="button" key={`${result.file}:${result.start}:${index}`} onClick={() => openProjectSearchResult(result)}><span><b>{result.file}</b><small>{result.line}:{result.column}{dirtyResult ? " · unsaved draft" : ""}</small></span><code>{result.preview}</code></button> }) : projectSearchMeta && !projectSearching ? <p>No matches in the scanned accepted source.</p> : <p>Search is bounded to 100 results, 20 per file, 512 KiB per file, and 8 MiB scanned per request.</p>}</div></section></div>}{quickOpen && <div className="source-quick-open-backdrop" onMouseDown={() => setQuickOpen(false)}><section className="source-quick-open" role="dialog" aria-modal="true" aria-label="Quick open source file" onMouseDown={event => event.stopPropagation()}><header><strong>Quick open</strong><kbd>⌘/Ctrl P</kbd></header><input autoFocus aria-label="Quick open file" value={quickQuery} onChange={event => setQuickQuery(event.target.value)} placeholder="Type a file path…" onKeyDown={event => { if (event.key === "Enter" && quickFiles[0]) { event.preventDefault(); openSourceFile(quickFiles[0]) } if (event.key === "Escape") setQuickOpen(false) }} /><div>{quickFiles.length ? quickFiles.map(file => <button type="button" key={file} onClick={() => openSourceFile(file)}><span>{file}</span>{recentFiles.includes(file) && <small>Recent</small>}</button>) : <p>No matching source files.</p>}</div></section></div>}
      <div className="source-file-tree" aria-label="Source file tree"><div className="source-file-tree-head"><span>Files</span><button type="button" onClick={() => { setQuickOpen(true); setQuickQuery("") }}>Quick open <kbd>⌘P</kbd></button></div>{recentFiles.length > 0 && <div className="source-recent-files"><small>Recent</small>{recentFiles.map(file => <button type="button" key={file} aria-pressed={active === file} onClick={() => openSourceFile(file)}>{file}</button>)}</div>}<div className="source-all-files">{files.map(item => <button key={item.file} aria-pressed={active === item.file} onClick={() => openSourceFile(item.file)}>{item.file}{drafts[item.file]?.text !== drafts[item.file]?.baseline ? " ●" : initialHashes.has(item.file) && initialHashes.get(item.file) !== item.hash ? " M" : ""}</button>)}</div></div>
      <div className="source-editor-panel">
        <div className="source-editor-actions"><strong>{active || "Connect to open source"}{dirty ? " • Unsaved draft" : " • Accepted source"}</strong><button type="button" title="Find / replace current file (⌘/Ctrl+F)" onClick={() => { setFindOpen(value => !value); if (!findOpen) setFindQuery("") }}>Find / replace</button><button type="button" title="Search accepted project source (⇧⌘/Ctrl+F)" onClick={() => setProjectSearchOpen(true)}>Search project</button><button onClick={() => void save()} disabled={!dirty || busy || !connected}>Save source</button><button onClick={() => void save(true)} disabled={dirtyDrafts.length < 2 || busy || !connected}>Save all drafts</button><button onClick={() => void checkTypes()} disabled={busy || !connected || conflict}>Check types</button><button onClick={() => setShowDiff(value => !value)} disabled={!draft}>Draft diff</button><button onClick={() => void discard()} disabled={!dirty || busy}>Discard draft</button></div>
        {findOpen && <div className="source-find-panel"><div className="source-find-row"><input autoFocus aria-label="Find in current file" value={findQuery} onChange={event => setFindQuery(event.target.value)} placeholder="Find in current file…" onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); jumpToMatch(event.shiftKey ? matchIndex - 1 : matchIndex + 1) } }} /><span>{findQuery ? `${searchMatches.length ? matchIndex + 1 : 0} / ${searchMatches.length}` : "0 / 0"}</span><button type="button" disabled={!searchMatches.length} onClick={() => jumpToMatch(matchIndex - 1)}>Previous</button><button type="button" disabled={!searchMatches.length} onClick={() => jumpToMatch(matchIndex + 1)}>Next</button><label><input type="checkbox" checked={caseSensitive} onChange={event => setCaseSensitive(event.target.checked)} /> Match case</label></div><div className="source-find-row"><input aria-label="Replace in current file" value={replaceValue} onChange={event => setReplaceValue(event.target.value)} placeholder="Replace with…" /><button type="button" disabled={!searchMatches.length} onClick={replaceCurrentMatch}>Replace</button><button type="button" disabled={!searchMatches.length} onClick={replaceAllMatches}>Replace all</button><small>Replacements modify the draft only. Save source performs the accepted transaction.</small></div></div>}
        <details className="source-file-operations"><summary>File operations</summary><label>File action <select aria-label="File action" value={fileAction} onChange={event => setFileAction(event.target.value as typeof fileAction)}><option value="create">Create</option><option value="rename">Rename</option><option value="delete">Delete</option></select></label>{fileAction !== "create" && <p>{fileAction === "delete" ? "Delete" : "Rename"} <b>{active}</b></p>}{fileAction !== "delete" && <label>New source path <input aria-label="New source path" value={newPath} onChange={event => setNewPath(event.target.value)} /></label>}<p>Save or discard drafts first. Renames update statically resolved source, CSS and asset references in the same transaction. Ambiguous references require a Code edit. The preview build must still pass.</p><button onClick={() => void applyFileOperation()} disabled={busy || !connected || Object.values(drafts).some(item => item.text !== item.baseline)}>Apply file operation</button></details>
        {conflict && <p role="alert">HEAD changed while this draft was open. Save will reject this stale base. <button onClick={() => void reloadBase()}>Rebase unchanged file</button></p>}
        {draft && <CodeEditor file={active} value={draft.text} reveal={reveal} onChange={value => setDrafts(all => ({ ...all, [active]: { ...all[active], text: value } }))} onSave={() => void save()} onSaveAll={() => void save(true)} />}
        {validation && <div className="source-diagnostics" role="status">{validation.level === "semantic" ? (validation.passed ? "Semantic TypeScript checks passed. Build and runtime validation are separate." : "Semantic TypeScript errors — source remains unchanged.") : validation.passed ? "Parse checks passed. Save validates the controlled preview bundle." : "Syntax/validation error — draft retained; preview remains at the last accepted revision."}{validation.diagnostics.map((item, index) => <p key={index}>{item.file}{item.line ? `:${item.line}:${item.column ?? 0}` : ""}: {item.message}</p>)}</div>}
        {showDiff && draft && <pre className="draft-diff">{`${active}\n--- Accepted source\n${draft.baseline.split("\n").map(line => "-" + line).join("\n")}\n+++ Draft\n${draft.text.split("\n").map(line => "+" + line).join("\n")}`}</pre>}
        <small>⌘S / Ctrl+S saves this file. ⇧⌘S / Ctrl+Shift+S saves all dirty drafts in one validated source transaction.</small><p className="draft-backup-status" role="status">{backupStatus}</p>
      </div>
    </>}
    {visible === "history" && <div className="source-history"><h2>Source history</h2>{ledger && ledger.sourceScope!==2 && <button disabled={busy || !connected} onClick={() => void historyAction("checkpoint",undefined,true)}>Enable module file editing</button>}<p>HEAD <code>{head}</code></p><button onClick={() => void historyAction("checkpoint")} disabled={busy || !connected}>Create checkpoint</button><button disabled={busy || !connected || !ledger?.transactions.length || (ledger?.archives?.length ?? 0)>=4} onClick={()=>void historyAction("checkpoint",undefined,undefined,{compactHistory:true})}>Compact active history</button><p>Up to four lossless archives; the combined uncompressed retention limit remains 64 MiB. Archived transactions retain their audit and revert evidence.</p>{ledger?.archives?.map((archive,index)=><button key={archive.digest} disabled={busy} onClick={()=>void inspectHistory({archiveId:archive.digest})}>Browse archive {index+1} · {archive.transactions} transactions</button>)}{restorePreview&&<section><h3>Restore {restorePreview.files.length} source files</h3><p>Target {restorePreview.revisionId}. Each file preview is limited to {restorePreview.truncatedPerFile} characters. Acceptance checks the current head and validates all complete files.</p><pre className="source-diff">{restorePreview.diff}</pre><button disabled={busy || !connected || restorePreview.baseRevision!==head} onClick={()=>void historyAction("checkpoint",undefined,undefined,{restoreRevisionId:restorePreview.revisionId})}>Restore these source files</button></section>}<p>Revert checks every affected file. A later change in an affected file requires manual reconciliation.</p>
      {[...archivedEntries,...(ledger?.transactions ?? [])].reverse().map(entry => <article key={entry.id} data-transaction-id={entry.id}><b>{entry.summary}</b><span>{entry.status} · {entry.producer} · {new Date(entry.timestamp).toLocaleString()}{entry.newRevisionId === head ? " · HEAD" : ""}</span><code>{entry.id}<br/>{entry.baseRevisionId} → {entry.newRevisionId ?? "no revision"}</code><p>{entry.fileStates?.map(item => item.file).join(", ") || entry.file || "Source checkpoint"}</p><button onClick={() => setSelectedEntry(entry)}>View diff</button>{entry.newRevisionId && <button disabled={busy || !connected || entry.newRevisionId===head} onClick={()=>void inspectHistory({restoreRevisionId:entry.newRevisionId})}>Preview restore to this revision</button>}<button disabled={busy || !ledger?.past.includes(entry.id)} onClick={() => void historyAction("revert", entry.id)}>Revert transaction</button>{entry.validation && <small>{entry.validation.level}: {entry.validation.passed ? "passed" : "failed"}</small>}{entry.error && <p role="alert">{entry.error}</p>}</article>)}
      {!ledger?.transactions.length && <p>No accepted changes yet. The initial source revision is retained.</p>}
      {selectedEntry && <pre className="history-diff">{`Transaction ${selectedEntry.id}\n` + selectedEntry.patches.map(patch => `${patch.file}\n@@ offset ${patch.range.start} @@\n${patch.before.split("\n").map(line => "-" + line).join("\n")}\n${patch.after.split("\n").map(line => "+" + line).join("\n")}`).join("\n\n")}</pre>}
    </div>}
    <p className="code-status" role="status">{status}</p>
  </div>
}
