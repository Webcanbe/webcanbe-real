import { useEffect, useRef, useState } from "react"
import type { SourceResponse } from "./CodeWorkspace"
import type { SourceTarget } from "../core/types"
import { analytics } from "../../analytics"

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
  idle: "Idle", preparing: "Preparing context", generating: "Generating", validating: "Validating", ready: "Proposal ready", applying: "Applying", done: "Done", failed: "Failed",
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
  if (status === 429) return "Another AI request is already running. Try again when it finishes."
  if (status === 504) return "The AI provider timed out. No source was changed and the reservation was released."
  if (status >= 500 && serverMessage?.includes("Source was accepted")) return `${serverMessage} Reload the project before taking another action.`
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

export default function AiWorkspacePanel({ open, onClose, connected, currentRevision, target, request, onApplied }: {
  open: boolean
  onClose: () => void
  connected: boolean
  currentRevision: string
  target?: SourceTarget
  request: AiRequest
  onApplied: (data: SourceResponse) => Promise<void>
}) {
  const [prompt, setPrompt] = useState("")
  const [mode, setMode] = useState<AiMode>("standard")
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
  const controller = useRef<AbortController | undefined>(undefined)
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const busy = ["preparing", "generating", "validating", "applying"].includes(phase)
  const stale = Boolean(outcome && isAiProposalStale(currentRevision, proposalRevision))

  useEffect(() => { if (open) window.setTimeout(() => promptRef.current?.focus(), 0) }, [open])
  useEffect(() => () => controller.current?.abort(), [])

  async function generate() {
    if (!connected || !currentRevision || !prompt.trim() || busy) return
    const abort = new AbortController(); controller.current = abort
    const spec: Record<string, unknown> = createAiRequestSpec({ feature, prompt, mode, revision: currentRevision, idempotencyKey: crypto.randomUUID(), includeSelection, target })
    setRequestSpec(spec); setOutcome(undefined); setProposalDiff(""); setProposalRevision(""); setError(""); setAcceptedPending(false); setApplyUncertain(false); setPhase("preparing")
    try {
      await Promise.resolve()
      if (abort.signal.aborted) return
      setPhase("generating")
      const response = await request("ai", spec, abort.signal)
      if (!response.ok) throw Object.assign(new Error(aiErrorMessage(response.status, response.data.error)), { status: response.status })
      setPhase("validating")
      const next = validateAiOutcome(response.data)
      const revision = typeof next.result?.revision === "string" ? next.result.revision : currentRevision
      const originals: Record<string, string> = {}
      await Promise.all(next.proposal.operations.filter(operation => operation.kind !== "create").map(async operation => {
        const source = await request("files", { file: operation.file, expectedRevision: revision }, abort.signal)
        if (source.ok && typeof source.data.source === "string") originals[operation.file] = source.data.source
      }))
      if (abort.signal.aborted) return
      setOutcome(next); setProposalRevision(revision); setProposalDiff(buildProposalDiff(next.proposal, originals)); analytics.capture("wcb_ai_proposal_generated", { source: "workspace", ai_mode: "proposal", state: "success" }); setPhase(next.state === "done" ? "done" : "ready")
    } catch (caught) {
      if (abort.signal.aborted) { setError("Generation cancelled in this editor. No source was applied."); setPhase("failed") }
      else { setError(caught instanceof Error ? caught.message : "The AI request could not be completed."); setPhase("failed") }
    } finally { if (controller.current === abort) controller.current = undefined }
  }

  async function applyProposal() {
    if (!outcome || !requestSpec || busy) return
    if (stale) { setError("Source changed after this proposal. Generate a new proposal before applying."); setPhase("failed"); return }
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
      try { await onApplied(applied.result) }
      catch { setError("Source was applied, but the workspace refresh failed. Reconnect to load the accepted revision.") }
    } catch (caught) {
      if (abort.signal.aborted) { setApplyUncertain(true); setError("Apply was cancelled before confirmation. Reload source before retrying.") }
      else setError(caught instanceof Error ? caught.message : "The proposal could not be applied.")
      setPhase("failed")
    } finally { if (controller.current === abort) controller.current = undefined }
  }

  if (!open) return null
  return <section className="ai-workspace-panel" aria-label="AI source editor" onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); onClose() } }}>
    <header><div><small>Source-backed AI</small><h2>Ask for a change</h2></div><button type="button" onClick={onClose} aria-label="Close AI panel">×</button></header>
    <div className="ai-panel-scroll">
      <label className="ai-prompt">Request<textarea ref={promptRef} value={prompt} maxLength={4000} disabled={busy} placeholder="Describe the source change you want…" onChange={event => setPrompt(event.target.value)} onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); void generate() } }} /></label>
      <div className="ai-choice-row"><label>Intent<select value={feature} disabled={busy} onChange={event => setFeature(event.target.value as AiFeature)}><option value="modify">Edit source</option><option value="explain">Explain source</option></select></label><label>Depth<select value={mode} disabled={busy} onChange={event => setMode(event.target.value as AiMode)}><option value="standard">Standard · 1 Action</option><option value="deep">Deep · 3 Actions</option></select></label></div>
      <label className={`ai-context ${target ? "available" : ""}`}><input type="checkbox" checked={includeSelection && Boolean(target)} disabled={!target || busy} onChange={event => setIncludeSelection(event.target.checked)} /><span><b>{target ? `Use selected ${target.elementName}` : "No source target selected"}</b><small>{target ? target.identity.file : "AI will use bounded project source context."}</small></span></label>
      <div className="ai-cost"><span>Cost on successful proposal</span><b>{aiActionCost(mode)} {aiActionCost(mode) === 1 ? "Action" : "Actions"}</b><small>Availability and charging are decided by the server. Provider or validation failures release the reservation.</small></div>
      <div className="ai-submit-row"><button type="button" className="ai-primary" disabled={!connected || !prompt.trim() || busy} onClick={() => void generate()}>{outcome ? "Generate new proposal" : "Generate proposal"}</button>{busy && <button type="button" onClick={() => controller.current?.abort()}>Cancel</button>}</div>
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
