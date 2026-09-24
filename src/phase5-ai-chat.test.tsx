// @vitest-environment jsdom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, expect, it, vi } from "vitest"
import AiWorkspacePanel from "./webcanbe-engine/visual-editor/AiWorkspacePanel"
import { addAiConversation, appendAiConversationMessage, emptyAiConversationStore, loadAiConversations, saveAiConversations } from "./webcanbe-engine/visual-editor/aiConversations"

afterEach(() => { sessionStorage.clear(); vi.unstubAllGlobals() })

it("shows the preparing state without an agent composer or request", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  const host = document.createElement("div"); document.body.append(host)
  const root = createRoot(host), request = vi.fn()
  try {
    await act(async () => root.render(<AiWorkspacePanel open enabled={false} onClose={() => {}} connected currentRevision="rev_1" storageScope="account:workspace:project" request={request} onApplied={async () => {}} />))
    expect(host.textContent).toContain("Agent chat is preparing")
    expect(host.querySelector("textarea")).toBeNull()
    expect(host.querySelector('[aria-label="Generate proposal"]')).toBeNull()
    expect(request).not.toHaveBeenCalled()
  } finally { await act(async () => root.unmount()); host.remove() }
})

it("keeps distinct conversation IDs and restores A and B across a reload within the same scope", () => {
  const first = emptyAiConversationStore("account:workspace-a:project-a")
  const a = appendAiConversationMessage(first, first.activeId, "user", "Change the heading in A")
  const b = addAiConversation(a)
  const withB = appendAiConversationMessage(b, b.activeId, "user", "Explain the layout in B")
  expect(withB.threads.map(thread => thread.id)).toHaveLength(2)
  expect(new Set(withB.threads.map(thread => thread.id)).size).toBe(2)
  expect(saveAiConversations(sessionStorage, withB)).toBe(true)
  const restored = loadAiConversations(sessionStorage, first.scope)
  expect(restored.activeId).toBe(b.activeId)
  expect(restored.threads.find(thread => thread.id === first.activeId)?.messages[0].text).toBe("Change the heading in A")
  expect(restored.threads.find(thread => thread.id === b.activeId)?.messages[0].text).toBe("Explain the layout in B")
  expect(loadAiConversations(sessionStorage, "account:workspace-b:project-a").threads).toHaveLength(1)
  sessionStorage.setItem(`wcb-ai-conversations:v1:${encodeURIComponent(first.scope)}`, "{corrupt")
  expect(loadAiConversations(sessionStorage, first.scope).threads).toHaveLength(1)
})

it("switches A/B in the rendered panel, reloads history, and selects only Standard or Deep by keyboard", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  const scope = "account:workspace:project"
  const request = vi.fn(async () => ({ ok: true, status: 200, data: { state: "ready_to_review", cost: 1, contextFiles: [], proposal: { summary: "Proposal ready", operations: [] }, result: { applied: false, revision: "rev_1" } } }))
  const host = document.createElement("div"); document.body.append(host)
  let root = createRoot(host)
  const panel = <AiWorkspacePanel open enabled onClose={() => {}} connected currentRevision="rev_1" storageScope={scope} request={request} onApplied={async () => {}} />
  const click = async (selector: string) => { await act(async () => (host.querySelector(selector) as HTMLButtonElement).click()) }
  const type = async (value: string) => { await act(async () => { const input = host.querySelector("textarea") as HTMLTextAreaElement; Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })) }) }
  const choose = async (label: string) => { await click('[aria-label^="AI conversation:"]'); await act(async () => (Array.from(host.querySelectorAll('[role="option"]')).find(option => option.textContent?.includes(label)) as HTMLElement).click()) }
  try {
    await act(async () => root.render(panel))
    await type("Change A")
    await click('[aria-label="Generate proposal"]')
    expect(host.querySelector(".ai-chat-history")?.textContent).toContain("Change A")
    expect((host.querySelector('[aria-label="Generate proposal"]') as HTMLButtonElement).disabled).toBe(true)
    await click('[aria-label="Generate proposal"]')
    expect(request).toHaveBeenCalledTimes(1)
    await click('[aria-label="Start new chat"]')
    await click('[aria-label="Start new chat"]')
    await type("Explain B")
    await click('[aria-label="Generate proposal"]')
    expect(host.querySelector(".ai-chat-history")?.textContent).toContain("Explain B")
    expect(host.querySelector(".ai-chat-history")?.textContent).not.toContain("Change A")
    expect(loadAiConversations(sessionStorage, scope).threads).toHaveLength(2)
    await choose("Change A")
    expect(host.querySelector(".ai-chat-history")?.textContent).toContain("Change A")
    await choose("Explain B")
    expect(host.querySelector(".ai-chat-history")?.textContent).toContain("Explain B")
    await click('[aria-label^="AI depth:"]')
    expect(Array.from(host.querySelectorAll('[role="listbox"] [role="option"]')).map(option => option.textContent)).toEqual(["Standard", "Deep"])
    await act(async () => (host.querySelector('[role="listbox"]') as HTMLElement).dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })))
    await act(async () => (host.querySelector('[role="listbox"]') as HTMLElement).dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })))
    expect((host.querySelector('[aria-label^="AI depth:"]') as HTMLButtonElement).textContent).toContain("Deep")
    await click('[aria-label^="AI depth:"]')
    await act(async () => document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })))
    expect(host.querySelector('[role="listbox"]')).toBeNull()
    await act(async () => (host.querySelector('[aria-label^="AI depth:"]') as HTMLButtonElement).dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })))
    expect(host.querySelector('[role="listbox"]')).toBeTruthy()
    await act(async () => (host.querySelector('[role="listbox"]') as HTMLElement).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })))
    expect(host.querySelector('[role="listbox"]')).toBeNull()
    expect(document.activeElement).toBe(host.querySelector('[aria-label^="AI depth:"]'))
    await act(async () => root.unmount())
    root = createRoot(host)
    await act(async () => root.render(panel))
    expect(host.querySelector(".ai-chat-history")?.textContent).toContain("Explain B")
    expect((host.querySelector('[aria-label^="AI depth:"]') as HTMLButtonElement).textContent).toContain("Deep")
    await choose("Change A")
    expect(host.querySelector(".ai-chat-history")?.textContent).toContain("Change A")
    expect(host.querySelectorAll("select")).toHaveLength(0)
  } finally { await act(async () => root.unmount()); host.remove() }
})

it("keeps a delayed result from the old chat out of a new chat", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  const host = document.createElement("div"); document.body.append(host)
  const root = createRoot(host)
  let answer!: (value: { ok: boolean; status: number; data: Record<string, unknown> }) => void
  const request = vi.fn(() => new Promise<{ ok: boolean; status: number; data: Record<string, unknown> }>(resolve => { answer = resolve }))
  try {
    await act(async () => root.render(<AiWorkspacePanel open enabled onClose={() => {}} connected currentRevision="rev_1" storageScope="account:workspace:slow-project" request={request} onApplied={async () => {}} />))
    await act(async () => { const input = host.querySelector("textarea") as HTMLTextAreaElement; Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, "Slow A"); input.dispatchEvent(new Event("input", { bubbles: true })) })
    await act(async () => (host.querySelector('[aria-label="Generate proposal"]') as HTMLButtonElement).click())
    await act(async () => (host.querySelector('[aria-label="Start new chat"]') as HTMLButtonElement).click())
    await act(async () => answer({ ok: true, status: 200, data: { state: "ready_to_review", cost: 1, contextFiles: [], proposal: { summary: "Late A response", operations: [] } } }))
    expect(host.querySelector(".ai-chat-history")?.textContent ?? "").not.toContain("Late A response")
    expect(host.querySelector(".ai-proposal")).toBeNull()
    const threads = loadAiConversations(sessionStorage, "account:workspace:slow-project").threads
    expect(threads).toHaveLength(2)
    expect(threads.find(thread => thread.title === "Slow A")?.messages.map(message => message.text)).toEqual(["Slow A"])
  } finally { await act(async () => root.unmount()); host.remove() }
})

it("replays the same reservation key after a network failure and refresh", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  const scope = "account:workspace:uncertain-project"
  const host = document.createElement("div"); document.body.append(host)
  let root = createRoot(host)
  const request = vi.fn()
    .mockRejectedValueOnce(new Error("Network connection lost"))
    .mockResolvedValueOnce({ ok: true, status: 200, data: { state: "ready_to_review", cost: 1, contextFiles: [], proposal: { summary: "Recovered proposal", operations: [] }, result: { applied: false, revision: "rev_1" } } })
  const panel = <AiWorkspacePanel open enabled onClose={() => {}} connected currentRevision="rev_1" storageScope={scope} request={request} onApplied={async () => {}} />
  try {
    await act(async () => root.render(panel))
    await act(async () => { const input = host.querySelector("textarea") as HTMLTextAreaElement; Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, "Change heading"); input.dispatchEvent(new Event("input", { bubbles: true })) })
    await act(async () => (host.querySelector('[aria-label="Generate proposal"]') as HTMLButtonElement).click())
    const firstKey = request.mock.calls[0][1].idempotencyKey
    expect(loadAiConversations(sessionStorage, scope).threads[0].pendingRequest?.idempotencyKey).toBe(firstKey)
    await act(async () => root.unmount())
    root = createRoot(host)
    await act(async () => root.render(panel))
    await act(async () => (host.querySelector('[aria-label^="AI depth:"]') as HTMLButtonElement).click())
    await act(async () => (Array.from(host.querySelectorAll('[role="option"]')).find(option => option.textContent === "Deep") as HTMLElement).click())
    expect((host.querySelector('[aria-label="Generate proposal"]') as HTMLButtonElement).disabled).toBe(true)
    await act(async () => (Array.from(host.querySelectorAll("button")).find(button => button.textContent === "Retry previous request") as HTMLButtonElement).click())
    expect(request.mock.calls[1][1].idempotencyKey).toBe(firstKey)
    expect(loadAiConversations(sessionStorage, scope).threads[0].pendingRequest).toBeUndefined()
    expect(host.querySelector(".ai-proposal")?.textContent).toContain("Recovered proposal")
  } finally { await act(async () => root.unmount()); host.remove() }
})
