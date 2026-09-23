export type AiConversationMessage = { id: string; role: "user" | "assistant"; text: string }
export type AiPendingRequest = { idempotencyKey: string; prompt: string; feature: string; mode: "standard" | "deep"; expectedRevision: string; apply: false; selection?: { file: string; start: number; end: number } }
export type AiConversation = { id: string; title: string; draft: string; mode: "standard" | "deep"; messages: AiConversationMessage[]; pendingRequest?: AiPendingRequest }
export type AiConversationStore = { scope: string; activeId: string; threads: AiConversation[] }

const storageKey = (scope: string) => `wcb-ai-conversations:v1:${encodeURIComponent(scope)}`
const newId = () => crypto.randomUUID()

export function newAiConversation(): AiConversation {
  return { id: newId(), title: "New chat", draft: "", mode: "standard", messages: [] }
}

export function emptyAiConversationStore(scope: string): AiConversationStore {
  const thread = newAiConversation()
  return { scope, activeId: thread.id, threads: [thread] }
}

export function addAiConversation(store: AiConversationStore): AiConversationStore {
  const thread = newAiConversation()
  return { ...store, activeId: thread.id, threads: [thread, ...store.threads] }
}

export function updateAiConversation(store: AiConversationStore, id: string, patch: Partial<Pick<AiConversation, "draft" | "mode" | "pendingRequest">>): AiConversationStore {
  return { ...store, threads: store.threads.map(thread => thread.id === id ? { ...thread, ...patch } : thread) }
}

export function appendAiConversationMessage(store: AiConversationStore, id: string, role: AiConversationMessage["role"], text: string): AiConversationStore {
  const message = { id: newId(), role, text: text.slice(0, 4000) }
  return { ...store, threads: store.threads.map(thread => thread.id === id ? {
    ...thread,
    title: thread.messages.length === 0 && role === "user" ? text.trim().slice(0, 42) || "New chat" : thread.title,
    messages: [...thread.messages, message],
  } : thread) }
}

export function loadAiConversations(storage: Storage, scope: string): AiConversationStore {
  if (!scope) return emptyAiConversationStore(scope)
  try {
    const parsed = JSON.parse(storage.getItem(storageKey(scope)) ?? "null") as Partial<AiConversationStore> | null
    if (parsed?.scope !== scope || !Array.isArray(parsed.threads) || !parsed.threads.length) return emptyAiConversationStore(scope)
    const threads = parsed.threads.filter(thread => typeof thread?.id === "string" && typeof thread.title === "string" && typeof thread.draft === "string" && ["standard", "deep"].includes(thread.mode) && Array.isArray(thread.messages) && thread.messages.every(message => typeof message?.id === "string" && ["user", "assistant"].includes(message.role) && typeof message.text === "string")).map(thread => {
      const pending = thread.pendingRequest
      const safePending = pending && typeof pending.idempotencyKey === "string" && /^[A-Za-z0-9_-]{8,160}$/.test(pending.idempotencyKey) && typeof pending.prompt === "string" && typeof pending.expectedRevision === "string" && ["standard", "deep"].includes(pending.mode) && ["modify", "explain"].includes(pending.feature)
        ? { idempotencyKey: pending.idempotencyKey, prompt: pending.prompt, expectedRevision: pending.expectedRevision, mode: pending.mode, feature: pending.feature, apply: false as const, ...(pending.selection && typeof pending.selection.file === "string" && Number.isSafeInteger(pending.selection.start) && Number.isSafeInteger(pending.selection.end) ? { selection: { file: pending.selection.file, start: pending.selection.start, end: pending.selection.end } } : {}) }
        : undefined
      return { ...thread, pendingRequest: safePending }
    }) as AiConversation[]
    if (!threads.length) return emptyAiConversationStore(scope)
    return { scope, activeId: threads.some(thread => thread.id === parsed.activeId) ? parsed.activeId! : threads[0].id, threads }
  } catch { return emptyAiConversationStore(scope) }
}

export function saveAiConversations(storage: Storage, store: AiConversationStore): boolean {
  if (!store.scope) return false
  try { storage.setItem(storageKey(store.scope), JSON.stringify(store)); return true }
  catch { return false }
}
