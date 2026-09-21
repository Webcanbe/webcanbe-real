import { describe, expect, it, vi } from "vitest"
import { AiRequestError, WorkersAiProvider, actionCost, parseProposal, runAiRequest, selectAiContext } from "./ai.js"

const files = new Map([["src/App.tsx", "export const App=()=> <h1>Hello</h1>"], ["src/theme.css", "h1{color:blue}"], [".env", "TOKEN=do-not-send"], ["secrets/key.ts", "never-send"]])
const request = { feature: "modify", prompt: "Change heading", idempotencyKey: "request_123", selection: { file: "src/App.tsx" }, mode: "standard" }
function usage() { return { reserve: vi.fn(async () => ({ id: "reserve-1" })), commit: vi.fn(async () => {}), release: vi.fn(async () => {}) } }
function provider(value) { return { generate: vi.fn(async () => value) } }
const good = JSON.stringify({ summary: "Update the heading", operations: [{ kind: "update", file: "src/App.tsx", expectedHash: "a".repeat(64), content: "export const App=()=> <h1>Changed</h1>" }] })

describe("AI proposal domain", () => {
  it("bounds selected context and excludes secrets", () => {
    const selected = selectAiContext(files, { ...request, files: [".env", "secrets/key.ts", "../../outside.ts", "src/theme.css"] })
    expect(selected.map(item => item.file)).toEqual(expect.arrayContaining(["src/App.tsx", "src/theme.css"]))
    expect(selected.map(item => item.file)).not.toEqual(expect.arrayContaining([".env", "secrets/key.ts"]))
  })

  it("returns a reviewable single-file proposal and commits one action", async () => {
    const meter = usage(), model = provider(good), apply = vi.fn(async () => ({ applied: false }))
    const result = await runAiRequest({ provider: model, usage: meter, request, files, userId: "u", projectId: "p", revision: "rev_1", apply })
    expect(result).toMatchObject({ state: "ready_to_review", cost: 1, proposal: { operations: [{ file: "src/App.tsx" }] } })
    expect(meter.reserve).toHaveBeenCalledWith(expect.objectContaining({ cost: 1 }))
    expect(meter.commit).toHaveBeenCalledWith("reserve-1")
    expect(meter.release).not.toHaveBeenCalled()
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

  it("rejects malformed paths and uses locked action costs", () => {
    expect(() => parseProposal(JSON.stringify({ summary: "bad", operations: [{ kind: "update", file: "../.env", expectedHash: "x", content: "x" }] }))).toThrow("unsafe")
    expect(actionCost("standard")).toBe(1)
    expect(actionCost("deep")).toBe(3)
  })

  it("surfaces a Workers AI timeout/provider failure without accepting a source change", async () => {
    const binding = { run: vi.fn(async () => { throw new Error("timeout") }) }
    await expect(new WorkersAiProvider(binding, "@cf/meta/llama-3.3-70b-instruct-fp8-fast").generate("test")).rejects.toThrow("timeout")
  })
})
