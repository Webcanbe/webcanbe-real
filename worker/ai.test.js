import { describe, expect, it, vi } from "vitest"
import { AiRequestError, WorkersAiProvider, actionCost, parseProposal, proposalPrompt, runAiRequest, selectAiContext } from "./ai.js"

const files = new Map([["src/App.tsx", "export const App=()=> <h1>Hello</h1>"], ["src/theme.css", "h1{color:blue}"], [".env", "TOKEN=do-not-send"], ["secrets/key.ts", "never-send"]])
const request = { feature: "modify", prompt: "Change heading", idempotencyKey: "request_123", selection: { file: "src/App.tsx" }, mode: "standard" }
function usage() { return { reserve: vi.fn(async () => ({ id: "reserve-1" })), commit: vi.fn(async () => {}), release: vi.fn(async () => {}), recordPending: vi.fn(async () => {}) } }
function provider(value) { return { generate: vi.fn(async () => value) } }
const good = JSON.stringify({ summary: "Update the heading", operations: [{ kind: "update", file: "src/App.tsx", expectedHash: "a".repeat(64), content: "export const App=()=> <h1>Changed</h1>" }] })

describe("AI proposal domain", () => {
  it("bounds selected context and excludes secrets", () => {
    const selected = selectAiContext(files, { ...request, files: ["src/theme.css"] })
    expect(selected.map(item => item.file)).toEqual(expect.arrayContaining(["src/App.tsx", "src/theme.css"]))
    expect(selected.map(item => item.file)).not.toEqual(expect.arrayContaining([".env", "secrets/key.ts"]))
    expect(() => selectAiContext(files, { ...request, selection: { file: ".env" }, files: [] })).toThrow("not permitted")
  })

  it("resolves imports from the actual importer and excludes credential-like source", () => {
    const nested = new Map([
      ["src/public/App.tsx", "import { config } from './config'; export const App=()=>config"],
      ["src/public/config.ts", "export const config='public'"],
      ["src/private/config.ts", "export const token='FAKE_SECRET_MARKER_123456789'"],
    ])
    const selected = selectAiContext(nested, { ...request, selection: { file: "src/public/App.tsx" }, files: [] })
    expect(selected.map(item => item.file)).toEqual(["src/public/App.tsx", "src/public/config.ts"])
    expect(proposalPrompt(request, selected)).not.toContain("FAKE_SECRET_MARKER")
    expect(() => selectAiContext(new Map([["src/App.tsx", "const apiKey='FAKE_SECRET_MARKER_123456789'"]]), request)).toThrow("credential-like")
  })

  it("returns a reviewable single-file proposal and commits one action", async () => {
    const meter = usage(), model = provider(good), apply = vi.fn(async () => ({ applied: false }))
    const result = await runAiRequest({ provider: model, usage: meter, request, files, userId: "u", projectId: "p", revision: "rev_1", apply })
    expect(result).toMatchObject({ state: "ready_to_review", cost: 1, proposal: { operations: [{ file: "src/App.tsx" }] } })
    expect(meter.reserve).toHaveBeenCalledWith(expect.objectContaining({ cost: 1 }))
    expect(meter.commit).toHaveBeenCalledWith("reserve-1", expect.objectContaining({ state: "ready_to_review" }))
    expect(meter.release).not.toHaveBeenCalled()
  })

  it("returns an explanation without inventing a source apply", async () => {
    const meter = usage(), apply = vi.fn(async () => ({ applied: false, revision: "rev_1" }))
    const result = await runAiRequest({ provider: provider(JSON.stringify({ summary: "This component renders a heading.", operations: [] })), usage: meter, request: { ...request, feature: "explain", prompt: "Explain this component" }, files, userId: "u", projectId: "p", revision: "rev_1", apply })
    expect(result).toMatchObject({ state: "ready_to_review", cost: 1, proposal: { operations: [] }, result: { applied: false, revision: "rev_1" } })
  })

  it("accepts bounded multi-file apply proposals through the supplied canonical callback", async () => {
    const meter = usage(), apply = vi.fn(async proposal => ({ applied: true, revision: "rev_2", operations: proposal.operations }))
    const multi = JSON.stringify({ summary: "Change component and styles", operations: [{ kind: "update", file: "src/App.tsx", expectedHash: "b".repeat(64), content: "export const App=()=> <h1 className=\"hero\">Changed</h1>" }, { kind: "update", file: "src/theme.css", expectedHash: "c".repeat(64), content: ".hero{color:red}" }] })
    const result = await runAiRequest({ provider: provider(multi), usage: meter, request: { ...request, mode: "deep", files: ["src/theme.css"] }, files, userId: "u", projectId: "p", revision: "rev_1", apply })
    expect(result).toMatchObject({ state: "done", cost: 3, result: { revision: "rev_2" } })
    expect(apply.mock.calls[0][0].operations).toHaveLength(2)
  })

  it("releases its reservation for malformed output or validation rejection", async () => {
    const meter = usage()
    await expect(runAiRequest({ provider: provider("not json"), usage: meter, request, files, userId: "u", projectId: "p", revision: "rev_1", apply: async () => ({}) })).rejects.toBeInstanceOf(AiRequestError)
    expect(meter.release).toHaveBeenCalledWith("reserve-1")
    const rejected = usage()
    await expect(runAiRequest({ provider: provider(good), usage: rejected, request, files, userId: "u", projectId: "p", revision: "rev_1", apply: async () => { throw new AiRequestError(409, "Source changed") } })).rejects.toThrow("Source changed")
    expect(rejected.release).toHaveBeenCalledWith("reserve-1")
  })

  it("rejects model operations outside authorised context before canonical apply", async () => {
    const meter = usage(), apply = vi.fn(async () => ({ applied: true }))
    const injected = JSON.stringify({ summary: "Expand authority", operations: [{ kind: "create", file: "src/Injected.ts", expectedHash: null, content: "export {}" }] })
    await expect(runAiRequest({ provider: provider(injected), usage: meter, request, files, userId: "u", projectId: "p", revision: "rev_1", apply })).rejects.toThrow("unselected")
    expect(apply).not.toHaveBeenCalled()
    expect(meter.release).toHaveBeenCalledWith("reserve-1")
  })

  it("holds usage for recovery when settlement fails after canonical source acceptance", async () => {
    const meter = usage(); meter.commit.mockRejectedValueOnce(new Error("ledger offline"))
    const apply = vi.fn(async () => ({ applied: true, revision: "rev_2" }))
    await expect(runAiRequest({ provider: provider(good), usage: meter, request: { ...request, apply: true }, files, userId: "u", projectId: "p", revision: "rev_1", apply })).rejects.toThrow("settlement is pending")
    expect(apply).toHaveBeenCalledTimes(1)
    expect(meter.release).not.toHaveBeenCalled()
    expect(meter.recordPending).toHaveBeenCalledWith("reserve-1", expect.objectContaining({ settlementPending: true, result: { applied: true, revision: "rev_2" } }))
  })

  it("rejects malformed paths and uses locked action costs", () => {
    expect(() => parseProposal(JSON.stringify({ summary: "bad", operations: [{ kind: "update", file: "../.env", expectedHash: "x", content: "x" }] }))).toThrow("unsafe")
    expect(actionCost("standard")).toBe(1)
    expect(actionCost("deep")).toBe(3)
  })

  it("surfaces a Workers AI timeout/provider failure without accepting a source change", async () => {
    const binding = { run: vi.fn(async () => { throw new Error("timeout") }) }
    await expect(new WorkersAiProvider(binding, "@cf/meta/llama-3.3-70b-instruct-fp8-fast").generate("test")).rejects.toThrow("timeout")
  })

  it("passes cancellation through generation and releases exactly once", async () => {
    const meter = usage(), apply = vi.fn(), controller = new AbortController()
    const model = new WorkersAiProvider({ run: vi.fn(() => new Promise(() => {})) }, "model")
    const pending = runAiRequest({ provider: model, usage: meter, request, files, userId: "u", projectId: "p", revision: "rev_1", apply, signal: controller.signal })
    await Promise.resolve()
    controller.abort()
    await expect(pending).rejects.toMatchObject({ status: 504 })
    expect(apply).not.toHaveBeenCalled()
    expect(meter.release).toHaveBeenCalledTimes(1)
  })

  it("applies the persisted reviewed proposal without regenerating or charging twice", async () => {
    const outcome = { state: "ready_to_review", cost: 1, contextFiles: ["src/App.tsx"], proposal: JSON.parse(good), result: { applied: false, revision: "rev_1" } }
    const meter = { reserve: vi.fn(async () => ({ id: "reserve-1", status: "committed", outcome, replayed: true })), commit: vi.fn(async () => {}), release: vi.fn(async () => {}) }
    const model = provider(good), apply = vi.fn(async () => ({ applied: true, revision: "rev_2" }))
    const result = await runAiRequest({ provider: model, usage: meter, request: { ...request, apply: true }, files, userId: "u", projectId: "p", revision: "rev_1", apply })
    expect(result).toMatchObject({ state: "done", result: { revision: "rev_2" } })
    expect(model.generate).not.toHaveBeenCalled()
    expect(apply).toHaveBeenCalledWith(outcome.proposal)
    expect(meter.commit).toHaveBeenCalledTimes(1)
  })

  it("never releases a replayed reservation when reviewed apply succeeds but settlement is pending", async () => {
    const outcome = { state: "ready_to_review", cost: 1, contextFiles: ["src/App.tsx"], proposal: JSON.parse(good), result: { applied: false, revision: "rev_1" } }
    const meter = { reserve: vi.fn(async () => ({ id: "reserve-1", status: "committed", outcome, replayed: true })), commit: vi.fn(async () => { throw new Error("ledger offline") }), release: vi.fn(async () => {}) }
    await expect(runAiRequest({ provider: provider(good), usage: meter, request: { ...request, apply: true }, files, userId: "u", projectId: "p", revision: "rev_1", apply: async () => ({ applied: true, revision: "rev_2" }) })).rejects.toThrow("settlement is pending")
    expect(meter.release).not.toHaveBeenCalled()
  })

  it("recovers a pending post-acceptance settlement without applying source twice", async () => {
    const pending = { state: "done", cost: 1, contextFiles: ["src/App.tsx"], proposal: JSON.parse(good), result: { applied: true, revision: "rev_2" }, settlementPending: true }
    const meter = { reserve: vi.fn(async () => ({ id: "reserve-1", status: "reserved", outcome: pending, replayed: true })), commit: vi.fn(async () => {}), release: vi.fn(async () => {}) }
    const apply = vi.fn()
    const result = await runAiRequest({ provider: provider(good), usage: meter, request: { ...request, apply: true }, files, userId: "u", projectId: "p", revision: "rev_1", apply })
    expect(result).toMatchObject({ state: "done", result: { revision: "rev_2" } })
    expect(result).not.toHaveProperty("settlementPending")
    expect(apply).not.toHaveBeenCalled()
    expect(meter.commit).toHaveBeenCalledTimes(1)
  })
})
