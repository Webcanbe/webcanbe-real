import { useEffect, useRef, useState } from "react"
import type { SourceResponse } from "./CodeWorkspace"
import type { SourceTarget } from "../core/types"
import { analytics } from "../../analytics"
import { hostedProductClient } from "../../hostedProductClient"
import AiListbox from "./AiListbox"
import { appendAiConversationMessage, emptyAiConversationStore, loadAiConversations, newAiConversation, saveAiConversations, updateAiConversation, type AiConversationStore, type AiPendingRequest } from "./aiConversations"

export type AiMode = "standard" | "deep"
export type AiFeature = "modify" | "explain"
export type AiPhase = "idle" | "preparing" | "generating" | "validating" | "ready" | "applying" | "done" | "failed"
export type AiOperation = { kind: "update" | "create" | "delete"; file: string; expectedHash: string | null; content?: string }
export type AiOutcome = {
  state: "ready_to_review" | "done"
  cost: number
  contextFiles: string[]
  proposal: { summary: string; operations: AiOperation[] }
  result?: { applied?: boolean; revision?: string; transaction?: SourceResponse["transaction"] }
}
type ApiResult = { ok: boolean; status: number; data: Record<string, unknown> & { error?: string } }
type AiRequest = (path: string, body?: Record<string, unknown>, signal?: AbortSignal) => Promise<ApiResult>

const phaseLabel: Record<AiPhase, string> = {
  idle: "Idle", preparing: "Preparing context", generating: "Generating · provider may retry once", validating: "Validating", ready: "Proposal ready", applying: "Applying", done: "Done", failed: "Failed",
}

export const aiActionCost = (mode: AiMode) => mode === "deep" ? 3 : 1

export function createAiRequestSpec({ feature, prompt, mode, revision, idempotencyKey, includeSelection, target }: { feature: AiFeature; prompt: string; mode: AiMode; revision: string; idempotencyKey: string; includeSelection: boolean; target?: SourceTarget }) {
  return {
    feature, prompt: prompt.trim(), mode, expectedRevision: revision, idempotencyKey, apply: false,
    ...(includeSelection && target ? { selection: { file: target.identity.file, start: target.sourceRange.start, end: target.sourceRange.end } } : {}),
  }
}

export const isAiProposalStale = (currentRevision: string, proposalRevision: string) => Boolean(proposalRevision && currentRevision !== proposalRevision)

export function validateAiOutcome(value: unknown): AiOutcome {
  const outcome = value as AiOutcome | undefined
  if (!outcome || !["ready_to_review", "done"].includes(outcome.state) || !Number.isSafeInteger(outcome.cost) || !Array.isArray(outcome.contextFiles) || !outcome.proposal || typeof outcome.proposal.summary !== "string" || !Array.isArray(outcome.proposal.operations)) throw new Error("AI returned an unreadable proposal.")
  for (const operation of outcome.proposal.operations) {
    if (!operation || !["update", "create", "delete"].includes(operation.kind) || typeof operation.file !== "string" || ((operation.kind === "update" || operation.kind === "create") && typeof operation.content !== "string")) throw new Error("AI returned an unreadable proposal.")
  }
  return outcome
}

export function aiErrorMessage(status: number, serverMessage?: string) {
  if (status === 402) return "Not enough AI Actions. No source was changed."
  if (status === 409) return serverMessage?.includes("Source changed") ? "Source changed after this request. Generate a new proposal before applying." : (serverMessage ?? "This AI request is no longer current.")
  if (status === 429) return serverMessage?.includes("Workers AI is busy") ? "The AI provider is busy after a bounded retry. No source was changed. You can try again." : "Another AI request is already running. Try again when it finishes."
  if (status === 504) return "The AI provider timed out after a bounded retry. No source was changed and the reservation was released. You can try again."
  if (status >= 500 && serverMessage?.includes("Source was accepted")) return `${serverMessage} Reload the project before taking another action.`
  if (status >= 500 && serverMessage?.includes("release is pending")) return "AI generation failed and its Actions reservation is still being reconciled. No source was changed. Try again shortly."
  if (status >= 500 && serverMessage?.includes("AI Action settlement failed")) return "AI Action settlement could not be confirmed. Retry this request to check its outcome before generating again."
  if (status >= 500) return "AI is temporarily unavailable. No source was changed."
  return serverMessage ?? "The AI request could not be completed."
}

function conciseDiff(file: string, kind: AiOperation["kind"], before: string, after: string) {
  const oldLines = before.split("\n"), newLines = after.split("\n")
  let start = 0
  while (start < oldLines.length && start < newLines.length && oldLines[start] === newLines[start]) start++
  let oldEnd = oldLines.length - 1, newEnd = newLines.length - 1
  while (oldEnd >= start && newEnd >= start && oldLines[oldEnd] === newLines[newEnd]) { oldEnd--; newEnd-- }
  const removed = oldLines.slice(start, oldEnd + 1), added = newLines.slice(start, newEnd + 1)
  const clip = (lines: string[]) => lines.slice(0, 8).map(line => line.slice(0, 180))
  const body = [...clip(removed).map(line => `- ${line}`), ...clip(added).map(line => `+ ${line}`)]
  if (removed.length > 8 || added.length > 8) body.push("… change preview shortened")
  return [`${kind === "create" ? "create" : kind === "delete" ? "delete" : "update"} ${file}`, `@@ line ${start + 1} @@`, ...(body.length ? body : ["  No textual change"])] .join("\n")
}

export function buildProposalDiff(proposal: AiOutcome["proposal"], originals: Record<string, string>) {
  return proposal.operations.map(operation => conciseDiff(operation.file, operation.kind, originals[operation.file] ?? "", operation.kind === "delete" ? "" : operation.content ?? "")).join("\n\n")
}

export default function AiWorkspacePanel({ open, onClose, connected, currentRevision, storageScope, target, request, onApplied, enabled = true }: {
  open: boolean
  onClose: () => void
  connected: boolean
  currentRevision: string
  storageScope: string
  target?: SourceTarget
  request: AiRequest
  onApplied: (data: SourceResponse) => Promise<void>
  enabled?: boolean
}) {
  const [conversations, setConversations] = useState<AiConversationStore>(() => typeof window === "undefined" ? emptyAiConversationStore(storageScope) : loadAiConversations(window.sessionStorage, storageScope))
  const activeConversation = conversations.threads.find(thread => thread.id === conversations.activeId) ?? conversations.threads[0]
  const prompt = activeConversation?.draft ?? ""
  const mode = activeConversation?.mode ?? "standard"
  const [feature, setFeature] = useState<AiFeature>("modify")
  const [includeSelection, setIncludeSelection] = useState(true)
  const [phase, setPhase] = useState<AiPhase>("idle")
  const [outcome, setOutcome] = useState<AiOutcome>()
  const [proposalRevision, setProposalRevision] = useState("")
  const [proposalDiff, setProposalDiff] = useState("")
  const [error, setError] = useState("")
  const [acceptedPending, setAcceptedPending] = useState(false)
  const [applyUncertain, setApplyUncertain] = useState(false)
  const [requestSpec, setRequestSpec] = useState<Record<string, unknown>>()
  const [retrySameKey, setRetrySameKey] = useState(false)
  const [storageError, setStorageError] = useState(false)
  const controller = useRef<AbortController | undefined>(undefined)
  const activeConversationId = useRef(conversations.activeId)
  const lastNewChatAt = useRef(-Infinity)
  const runtimeSnapshots = useRef(new Map<string, { outcome?: AiOutcome; proposalRevision: string; proposalDiff: string; error: string; requestSpec?: Record<string, unknown>; retrySameKey: boolean; phase: AiPhase }>())
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const busy = ["preparing", "generating", "validating", "applying"].includes(phase)
  const stale = Boolean(outcome && isAiProposalStale(currentRevision, proposalRevision))
  const selectedRange = includeSelection && target ? { file: target.identity.file, start: target.sourceRange.start, end: target.sourceRange.end } : undefined
  const matchesSpec = (spec?: Record<string, unknown>) => {
    const savedRange = spec?.selection as { file?: string; start?: number; end?: number } | undefined
    return Boolean(spec?.prompt === prompt.trim() && spec?.mode === mode && spec?.feature === feature && spec?.expectedRevision === currentRevision && savedRange?.file === selectedRange?.file && savedRange?.start === selectedRange?.start && savedRange?.end === selectedRange?.end)
  }
  const matchesRequestSpec = matchesSpec(requestSpec)
  const pendingRequest = activeConversation.pendingRequest
  const pendingMismatch = Boolean(pendingRequest && !matchesSpec(pendingRequest))
  const sameReadyRequest = Boolean(outcome && ["ready", "done"].includes(phase) && matchesRequestSpec)

  useEffect(() => { if (open && enabled) window.setTimeout(() => promptRef.current?.focus(), 0) }, [open, enabled])
  useEffect(() => () => controller.current?.abort(), [])
  useEffect(() => {
    controller.current?.abort()
    runtimeSnapshots.current.clear()
    lastNewChatAt.current = -Infinity
    const loaded = typeof window === "undefined" ? emptyAiConversationStore(storageScope) : loadAiConversations(window.sessionStorage, storageScope)
    activeConversationId.current = loaded.activeId
    setConversations(loaded); setOutcome(undefined); setProposalRevision(""); setProposalDiff(""); setError(""); setRequestSpec(undefined); setRetrySameKey(false); setPhase("idle"); setStorageError(false)
  }, [storageScope])
  useEffect(() => {
    if (conversations.scope !== storageScope || !storageScope) return
    setStorageError(!saveAiConversations(window.sessionStorage, conversations))
  }, [conversations, storageScope])

  function switchConversation(id: string) {
    if (id === activeConversationId.current || !conversations.threads.some(thread => thread.id === id)) return
    runtimeSnapshots.current.set(activeConversationId.current, { outcome, proposalRevision, proposalDiff, error: busy ? "Generation cancelled when you switched chats. No source was applied." : error, requestSpec, retrySameKey, phase: busy ? "failed" : phase })
    controller.current?.abort()
    activeConversationId.current = id
    const snapshot = runtimeSnapshots.current.get(id)
    setOutcome(snapshot?.outcome); setProposalRevision(snapshot?.proposalRevision ?? ""); setProposalDiff(snapshot?.proposalDiff ?? ""); setError(snapshot?.error ?? ""); setRequestSpec(snapshot?.requestSpec); setRetrySameKey(snapshot?.retrySameKey ?? false); setPhase(snapshot?.phase ?? "idle")
    setConversations(previous => ({ ...previous, activeId: id }))
  }

  function startConversation() {
    const now = performance.now()
    if (now - lastNewChatAt.current < 500) { promptRef.current?.focus(); return }
    lastNewChatAt.current = now
    const next = newAiConversation()
    runtimeSnapshots.current.set(activeConversationId.current, { outcome, proposalRevision, proposalDiff, error: busy ? "Generation cancelled when you started a new chat. No source was applied." : error, requestSpec, retrySameKey, phase: busy ? "failed" : phase })
    controller.current?.abort()
    activeConversationId.current = next.id
    setConversations(previous => ({ ...previous, activeId: next.id, threads: [next, ...previous.threads] }))
    setOutcome(undefined); setProposalRevision(""); setProposalDiff(""); setError(""); setRequestSpec(undefined); setRetrySameKey(false); setPhase("idle")
    window.setTimeout(() => promptRef.current?.focus(), 0)
  }

  async function generate(retryPending = false) {
    if (!connected || !currentRevision || busy || (retryPending ? !pendingRequest || pendingRequest.expectedRevision !== currentRevision : !prompt.trim() || sameReadyRequest || pendingMismatch)) return
    const threadId = activeConversationId.current
    const abort = new AbortController(); controller.current = abort
    const spec: Record<string, unknown> = pendingRequest && (retryPending || matchesSpec(pendingRequest)) ? pendingRequest : retrySameKey && matchesRequestSpec && requestSpec ? requestSpec : createAiRequestSpec({ feature, prompt, mode, revision: currentRevision, idempotencyKey: crypto.randomUUID(), includeSelection, target })
    setConversations(previous => updateAiConversation(appendAiConversationMessage(previous, threadId, "user", String(spec.prompt)), threadId, { pendingRequest: spec as AiPendingRequest }))
    setRequestSpec(spec); setRetrySameKey(false); setOutcome(undefined); setProposalDiff(""); setProposalRevision(""); setError(""); setAcceptedPending(false); setApplyUncertain(false); setPhase("preparing")
    try {
      await Promise.resolve()
      if (abort.signal.aborted) return
      setPhase("generating")
      const response = await request("ai", spec, abort.signal)
      if (!response.ok) throw Object.assign(new Error(aiErrorMessage(response.status, response.data.error)), { status: response.status, serverMessage: response.data.error })
      if (abort.signal.aborted || activeConversationId.current !== threadId) return
      setPhase("validating")
      const next = validateAiOutcome(response.data)
      setConversations(previous => appendAiConversationMessage(previous, threadId, "assistant", next.proposal.summary || "A source proposal is ready to review."))
      const revision = typeof next.result?.revision === "string" ? next.result.revision : currentRevision
      const originals: Record<string, string> = {}
      await Promise.all(next.proposal.operations.filter(operation => operation.kind !== "create").map(async operation => {
        const source = await request("files", { file: operation.file, expectedRevision: revision }, abort.signal)
        if (source.ok && typeof source.data.source === "string") originals[operation.file] = source.data.source
      }))
      if (abort.signal.aborted || activeConversationId.current !== threadId) return
      setConversations(previous => updateAiConversation(previous, threadId, { pendingRequest: undefined }))
      setOutcome(next); setProposalRevision(revision); setProposalDiff(buildProposalDiff(next.proposal, originals)); analytics.capture("wcb_ai_proposal_generated", { source: "workspace", ai_mode: "proposal", state: "success" }); setPhase(next.state === "done" ? "done" : "ready")
    } catch (caught) {
      const message = abort.signal.aborted ? "Generation cancelled in this editor. No source was applied." : caught instanceof Error ? caught.message : "The AI request could not be completed."
      const uncertain = abort.signal.aborted || (caught as { status?: number }).status === undefined || String((caught as { serverMessage?: string }).serverMessage ?? "").includes("AI Action settlement failed") || String((caught as { serverMessage?: string }).serverMessage ?? "").includes("already in progress")
      if (uncertain && activeConversationId.current === threadId) setRetrySameKey(true)
      else setConversations(previous => updateAiConversation(previous, threadId, { pendingRequest: undefined }))
      setConversations(previous => appendAiConversationMessage(previous, threadId, "assistant", message))
      if (activeConversationId.current === threadId) { setError(message); setPhase("failed") }
    } finally { if (controller.current === abort) controller.current = undefined }
  }

  async function applyProposal() {
    if (!outcome || !requestSpec || busy) return
    if (stale) { setError("Source changed after this proposal. Generate a new proposal before applying."); setPhase("failed"); return }
    if (typeof requestSpec.idempotencyKey === "string") void hostedProductClient.buildLeagueTrack("ai_proposal_reviewed", requestSpec.idempotencyKey).catch(()=>{})
    const abort = new AbortController(); controller.current = abort; setError(""); setAcceptedPending(false); setApplyUncertain(false); setPhase("applying")
    try {
      const response = await request("ai", { ...requestSpec, expectedRevision: proposalRevision, apply: true }, abort.signal)
      if (!response.ok) {
        if (response.data.error?.includes("Source was accepted")) setAcceptedPending(true)
        throw new Error(aiErrorMessage(response.status, response.data.error))
      }
      const applied = validateAiOutcome(response.data)
      if (applied.state !== "done" || !applied.result?.applied || typeof applied.result.revision !== "string") throw new Error("The proposal was not applied to source.")
      setOutcome(applied); setProposalRevision(applied.result.revision); analytics.capture("wcb_ai_edit_applied", { source: "workspace", ai_mode: "apply", state: "success" }); setPhase("done")
      setConversations(previous => appendAiConversationMessage(previous, activeConversationId.current, "assistant", `Applied to source at revision ${applied.result!.revision}.`))
      try { await onApplied(applied.result) }
      catch { setError("Source was applied, but the workspace refresh failed. Reconnect to load the accepted revision.") }
    } catch (caught) {
      if (abort.signal.aborted) { setApplyUncertain(true); setError("Apply was cancelled before confirmation. Reload source before retrying.") }
      else setError(caught instanceof Error ? caught.message : "The proposal could not be applied.")
      setPhase("failed")
    } finally { if (controller.current === abort) controller.current = undefined }
  }

  if (!open) return null
  if (!enabled) return <section className="ai-workspace-panel" aria-label="AI source editor"><header><div><small>Source-backed AI</small><h2>Agent chat is preparing</h2></div><button type="button" onClick={onClose} aria-label="Close AI panel">×</button></header><div className="ai-panel-scroll"><p className="ai-chat-note" role="status">Chat is preparing. You can continue editing your project in Visual or Code.</p></div></section>
  return <section className="ai-workspace-panel" aria-label="AI source editor" onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); onClose() } }}>
    <header><div><small>Source-backed AI</small><h2>Ask for a change</h2></div><button type="button" onClick={onClose} aria-label="Close AI panel">×</button></header>
    <div className="ai-panel-scroll">
      <div className="ai-chat-toolbar"><AiListbox label="AI conversation" value={conversations.activeId} options={conversations.threads.map(thread => ({ value: thread.id, label: thread.title }))} onChange={switchConversation} disabled={phase === "applying"} className="ai-chat-picker" /><button type="button" className="ai-new-chat" aria-label="Start new chat" title="New chat" disabled={phase === "applying"} onClick={startConversation}><span aria-hidden="true">+</span></button></div>
      {activeConversation.messages.length > 0 && <div className="ai-chat-history" aria-label="Conversation history">{activeConversation.messages.map(message => <p key={message.id} data-role={message.role}><span>{message.role === "user" ? "You" : "Webcanbe"}</span>{message.text}</p>)}</div>}
      {activeConversation.messages.length > 0 && <p className="ai-chat-note">Messages remain in this browser tab after refresh. Regenerate a past proposal before applying it.</p>}
      <div className="ai-composer ai-prompt"><textarea ref={promptRef} aria-label="Ask Webcanbe" value={prompt} maxLength={4000} disabled={busy} placeholder="Ask Webcanbe…" onChange={event => setConversations(previous => updateAiConversation(previous, activeConversationId.current, { draft: event.target.value }))} onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); void generate() } }} /><footer><AiListbox label="AI depth" value={mode} disabled={busy} options={[{ value: "standard", label: "Standard" }, { value: "deep", label: "Deep" }]} onChange={value => setConversations(previous => updateAiConversation(previous, activeConversationId.current, { mode: value as AiMode }))} className="ai-mode-picker" /><button type="button" aria-label="Use selected element" title={target ? target.identity.file : "Select an element first"} aria-pressed={includeSelection && Boolean(target)} disabled={!target || busy} onClick={()=>setIncludeSelection(value=>!value)}>⌁</button><button type="button" aria-label="Toggle explain mode" aria-pressed={feature==="explain"} disabled={busy} onClick={()=>setFeature(value=>value==="modify"?"explain":"modify")}>+</button><button type="button" className="ai-send" aria-label="Generate proposal" title={pendingMismatch ? "Resolve the previous request first" : sameReadyRequest ? "Change this request to generate another proposal" : "Generate proposal"} disabled={!connected || !prompt.trim() || busy || sameReadyRequest || pendingMismatch} onClick={() => void generate()}><span className="ai-visually-hidden">Generate proposal</span></button></footer></div>
      {pendingMismatch && <div className="ai-chat-note">A previous request has an unconfirmed result. Retry it with the same reservation key before generating a changed request. {pendingRequest?.expectedRevision === currentRevision ? <button type="button" disabled={busy || !connected} onClick={() => void generate(true)}>Retry previous request</button> : "Source has changed; reopen the project to reconcile its status."}</div>}
      {storageError && <p className="ai-error" role="alert">This tab could not save chat history. Copy important messages before leaving.</p>}
      <details className="ai-request-details"><summary>Request settings · {aiActionCost(mode)} {aiActionCost(mode) === 1 ? "Action" : "Actions"}</summary><p>{feature === "modify" ? "Edit source" : "Explain source"} · {target && includeSelection ? `Selected ${target.elementName}` : "Bounded project context"}. Availability and charging are decided by the server; provider or validation failures release the reservation.</p></details>
      {busy && <button className="ai-cancel" type="button" onClick={() => controller.current?.abort()}>Cancel request</button>}
      <div className="ai-phase" role="status" data-phase={phase}><i />{phaseLabel[phase]}</div>
      {error && <p className="ai-error" role="alert">{error}</p>}
      {outcome && <article className="ai-proposal">
        <div className="ai-proposal-head"><div><small>Proposal</small><h3>{outcome.proposal.summary || "Source explanation"}</h3></div><span>{outcome.cost} {outcome.cost === 1 ? "Action" : "Actions"}</span></div>
        <div className="ai-files"><small>Affected files</small>{outcome.proposal.operations.length ? outcome.proposal.operations.map(operation => <div key={`${operation.kind}:${operation.file}`}><span>{operation.kind}</span><code>{operation.file}</code></div>) : <p>No source changes proposed.</p>}</div>
        {proposalDiff && <details open><summary>Review concise diff</summary><pre>{proposalDiff}</pre></details>}
        {outcome.contextFiles.length > 0 && <details><summary>Context used ({outcome.contextFiles.length})</summary><p>{outcome.contextFiles.join(" · ")}</p></details>}
        {stale && <p className="ai-error">Source changed after this proposal. Applying is blocked.</p>}
        <div className="ai-apply-row"><span>{outcome.result?.applied ? "Applied to canonical source" : acceptedPending ? "Source accepted · usage settlement pending" : applyUncertain ? "Apply status unknown · reload required" : "Not applied — review only"}</span>{feature !== "explain" && outcome.proposal.operations.length > 0 && !outcome.result?.applied && !acceptedPending && !applyUncertain && <button type="button" className="ai-primary" disabled={busy || stale} onClick={() => void applyProposal()}>Apply to source</button>}</div>
      </article>}
    </div>
  </section>
}
