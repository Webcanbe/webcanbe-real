import fs from "node:fs"
import { describe, expect, it } from "vitest"
import type { SourceTarget } from "./webcanbe-engine/core/types"
import { aiActionCost, aiErrorMessage, buildProposalDiff, createAiRequestSpec, isAiProposalStale, validateAiOutcome } from "./webcanbe-engine/visual-editor/AiWorkspacePanel"

const target = { identity: { file: "src/App.tsx" }, sourceRange: { start: 12, end: 44 } } as SourceTarget
const proposal = {
  state: "ready_to_review" as const,
  cost: 1,
  contextFiles: ["src/App.tsx"],
  proposal: { summary: "Update heading", operations: [{ kind: "update" as const, file: "src/App.tsx", expectedHash: "a".repeat(64), content: "export default () => <h1>New</h1>" }] },
  result: { applied: false, revision: "rev_1" },
}

describe("CompatibleWorkspace AI client contract", () => {
  it("binds the existing Workers AI provider in the canonical deployment", () => {
    const config = JSON.parse(fs.readFileSync("wrangler.jsonc", "utf8"))
    expect(config.ai).toEqual({ binding: "AI" })
  })
  it("builds explain and selected-source requests against an exact revision", () => {
    const explain = createAiRequestSpec({ feature: "explain", prompt: "  Explain this component  ", mode: "standard", revision: "rev_1", idempotencyKey: "request_123", includeSelection: true, target })
    expect(explain).toEqual(expect.objectContaining({ feature: "explain", prompt: "Explain this component", mode: "standard", expectedRevision: "rev_1", apply: false, selection: { file: "src/App.tsx", start: 12, end: 44 } }))
    expect(aiActionCost("standard")).toBe(1)
    expect(aiActionCost("deep")).toBe(3)
  })

  it("validates a reviewable proposal and presents a bounded diff", () => {
    expect(validateAiOutcome(proposal)).toEqual(proposal)
    const diff = buildProposalDiff(proposal.proposal, { "src/App.tsx": "export default () => <h1>Old</h1>" })
    expect(diff).toContain("update src/App.tsx")
    expect(diff).toContain("- export default () => <h1>Old</h1>")
    expect(diff).toContain("+ export default () => <h1>New</h1>")
    const giant = buildProposalDiff({ summary: "large", operations: [{ ...proposal.proposal.operations[0], content: Array.from({ length: 100 }, (_, index) => `line ${index}`).join("\n") }] }, { "src/App.tsx": "old" })
    expect(giant).toContain("change preview shortened")
    expect(giant.length).toBeLessThan(2000)
  })

  it("fails closed on malformed results and stale revisions", () => {
    expect(() => validateAiOutcome({ state: "ready_to_review", cost: 1, contextFiles: [], proposal: { summary: "bad", operations: [{ kind: "update", file: "src/App.tsx" }] } })).toThrow("unreadable")
    expect(isAiProposalStale("rev_2", "rev_1")).toBe(true)
    expect(isAiProposalStale("rev_1", "rev_1")).toBe(false)
  })

  it("keeps usage and provider errors concise without inventing client authority", () => {
    expect(aiErrorMessage(402)).toContain("Not enough AI Actions")
    expect(aiErrorMessage(429)).toContain("already running")
    expect(aiErrorMessage(504)).toContain("reservation was released")
    expect(aiErrorMessage(503, "Source was accepted; AI Action settlement is pending.")).toContain("Reload the project")
  })

  it("wires proposal-first apply to the production endpoint and canonical refresh", () => {
    const workspace = fs.readFileSync("src/webcanbe-engine/visual-editor/CompatibleWorkspace.tsx", "utf8")
    const panel = fs.readFileSync("src/webcanbe-engine/visual-editor/AiWorkspacePanel.tsx", "utf8")
    const worker = fs.readFileSync("worker/editor-projects.js", "utf8")
    expect(workspace).toContain("<AiWorkspacePanel")
    expect(panel).toContain('request("ai", spec')
    expect(panel).toContain('apply: true')
    expect(panel).toContain("await onApplied")
    expect(panel).not.toContain("localStorage")
    expect(worker).toContain('aiRequestIdentity: aiRequestIdentity(body), summary: proposal.summary, operations: proposal.operations }, "ai")')
    expect(worker).toContain('producer:action==="ai"?"ai"')
  })
})
