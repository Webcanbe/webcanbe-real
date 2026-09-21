import { createHash } from "node:crypto"

const SECRET_PATH = /(^|\/)(?:\.env(?:\.|$)|secrets?(?:\/|$)|credentials?(?:\/|$)|(?:id_rsa|id_ed25519|\.npmrc|\.pypirc)$)/i
const SECRET_CONTENT = /(?:-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|(?:api[_-]?key|secret|token|password|authorization)\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{8,})/i
const SOURCE_PATH = /^(?:[A-Za-z0-9][A-Za-z0-9._-]*\/)*[A-Za-z0-9][A-Za-z0-9._-]*\.(?:[cm]?[jt]sx?|css|json)$/
const MODES = new Set(["explain", "modify", "style", "multifile", "fix"])
const LIMITS = Object.freeze({ files: 12, bytes: 96 * 1024, request: 4000, output: 96 * 1024, retries: 1 })

export class AiRequestError extends Error { constructor(status, message) { super(message); this.status = status } }
const fail = (status, message) => { throw new AiRequestError(status, message) }
const bytes = value => new TextEncoder().encode(value).byteLength

export function actionCost(mode) { return mode === "deep" ? 3 : 1 }
export function aiModel(env) { return typeof env?.WEBCANBE_AI_MODEL === "string" && env.WEBCANBE_AI_MODEL.length <= 200 ? env.WEBCANBE_AI_MODEL : "@cf/meta/llama-3.3-70b-instruct-fp8-fast" }
export function safeAiPath(file) { return typeof file === "string" && file.length <= 512 && SOURCE_PATH.test(file) && !file.includes("..") && !SECRET_PATH.test(file) }
function relativeImportCandidates(importer, specifier) {
  if (typeof specifier !== "string" || !specifier.startsWith(".") || /[?#]/.test(specifier)) return []
  const parts = importer.split("/").slice(0, -1)
  for (const part of specifier.split("/")) {
    if (!part || part === ".") continue
    if (part === "..") { if (!parts.length) return []; parts.pop() }
    else if (/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(part)) parts.push(part)
    else return []
  }
  const base = parts.join("/")
  if (!base) return []
  const extensions = [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs", ".css", ".json"]
  return [base, ...extensions.map(extension => base + extension), ...extensions.map(extension => base + "/index" + extension)]
}
const sourceIsSafeForAi = source => typeof source === "string" && !SECRET_CONTENT.test(source)

/** Returns only current, authorised source. No project-wide archive, config, or credentials enter a model prompt. */
export function selectAiContext(files, request) {
  if (!request || typeof request !== "object" || !MODES.has(request.feature) || typeof request.prompt !== "string" || !request.prompt.trim() || request.prompt.length > LIMITS.request) fail(400, "Provide a bounded AI editing request.")
  if (request.files !== undefined && !Array.isArray(request.files)) fail(400, "AI source selection must be a file list.")
  const selected = new Set(), explicit = new Set()
  const add = file => { if (safeAiPath(file) && files.has(file)) selected.add(file) }
  for (const file of [request.selection?.file, ...(request.files ?? [])]) if (typeof file === "string" && files.has(file) && !safeAiPath(file)) fail(422, "Selected AI source is not permitted.")
  add(request.selection?.file); if (selected.has(request.selection?.file)) explicit.add(request.selection.file)
  for (const file of request.files ?? []) { add(file); if (selected.has(file)) explicit.add(file) }
  if (!selected.size) for (const file of [...files.keys()].filter(safeAiPath).sort()) { selected.add(file); if (selected.size >= LIMITS.files) break }
  if (selected.size > LIMITS.files) fail(422, "AI context may include at most 12 source files.")
  const result = [], queued = [...selected]; let total = 0
  while (queued.length) {
    if (result.length >= LIMITS.files) break
    const file = queued.shift()
    if (result.some(item => item.file === file)) continue
    const source = files.get(file)
    if (typeof source !== "string") continue
    if (!sourceIsSafeForAi(source)) {
      if (explicit.has(file)) fail(422, "Selected AI source contains credential-like content.")
      continue
    }
    total += bytes(source)
    if (total > LIMITS.bytes) fail(422, "Selected AI context exceeds 96 KiB.")
    result.push({ file, source })
    for (const match of source.matchAll(/(?:from\s*|import\s*)["']([^"']+)["']/g)) {
      for (const candidate of relativeImportCandidates(file, match[1])) if (safeAiPath(candidate) && files.has(candidate) && !queued.includes(candidate) && !result.some(item => item.file === candidate)) queued.push(candidate)
    }
  }
  if (!result.length) fail(422, "No safe source is available for AI context.")
  return result
}

export function proposalPrompt(request, context) {
  return [
    "You edit only the supplied authorised source files. Never suggest shell commands, secrets, package installation, config changes, or files outside this context.",
    "Return strict JSON only: {\\\"summary\\\":string,\\\"operations\\\":[{\\\"kind\\\":\\\"update\\\"|\\\"create\\\"|\\\"delete\\\",\\\"file\\\":string,\\\"expectedHash\\\":string|null,\\\"content\\\":string?}]}. For explain return operations:[] .",
    `Request (${request.feature}${request.mode === "deep" ? ", deep" : ""}): ${request.prompt.trim()}`,
    "Authorised source (use the supplied SHA-256 as expectedHash):\n" + context.map(item => `--- ${item.file} SHA-256:${createHash("sha256").update(item.source).digest("hex")}\n${item.source}`).join("\n"),
  ].join("\n\n")
}

export function parseProposal(output, allowedFiles) {
  const raw = typeof output === "string" ? output.trim().replace(/^```(?:json)?\s*|\s*```$/g, "") : ""
  if (!raw || bytes(raw) > LIMITS.output) fail(422, "AI returned an invalid or oversized proposal.")
  let proposal
  try { proposal = JSON.parse(raw) } catch { fail(422, "AI returned malformed proposal JSON.") }
  if (!proposal || typeof proposal !== "object" || Array.isArray(proposal) || typeof proposal.summary !== "string" || proposal.summary.length > 1000 || !Array.isArray(proposal.operations) || proposal.operations.length > 20) fail(422, "AI proposal has an invalid shape.")
  for (const operation of proposal.operations) {
    if (!operation || typeof operation !== "object" || !["update", "create", "delete"].includes(operation.kind) || !safeAiPath(operation.file) || (allowedFiles && !allowedFiles.has(operation.file)) || (operation.kind === "create" ? operation.expectedHash !== null : typeof operation.expectedHash !== "string") || (["update", "create"].includes(operation.kind) && (typeof operation.content !== "string" || bytes(operation.content) > 2 * 1024 * 1024 || operation.content.includes("\0")))) fail(422, "AI proposal contains an unsafe or unselected source operation.")
  }
  return { summary: proposal.summary, operations: proposal.operations }
}

export class WorkersAiProvider {
  constructor(binding, model) { this.binding = binding; this.model = model }
  async generate(prompt, signal) {
    if (!this.binding?.run) throw new AiRequestError(503, "Workers AI is not configured for this environment.")
    const work = this.binding.run(this.model, { messages: [{ role: "user", content: prompt }], max_tokens: 4096 }, signal ? { signal } : undefined)
    const response = signal ? await Promise.race([work, new Promise((_, reject) => signal.addEventListener("abort", () => reject(new AiRequestError(504, "Workers AI timed out.")), { once: true }))]) : await work
    const text = typeof response === "string" ? response : response?.response ?? response?.result?.response
    if (typeof text !== "string") throw new AiRequestError(502, "Workers AI returned no text proposal.")
    return text
  }
}

/** Usage is an entitlement adapter, deliberately independent from payment implementation. */
export async function runAiRequest({ provider, usage, request, files, userId, projectId, revision, apply, signal }) {
  if (!["standard", "deep", undefined].includes(request.mode)) fail(400, "AI mode must be standard or deep.")
  if (typeof request.idempotencyKey !== "string" || !/^[A-Za-z0-9_-]{8,160}$/.test(request.idempotencyKey)) fail(400, "A bounded AI idempotency key is required.")
  const context = selectAiContext(files, request)
  const reservation = await usage.reserve({ userId, projectId, idempotencyKey: request.idempotencyKey, cost: actionCost(request.mode), expectedRevision: revision })
  if (reservation.replayed && reservation.status === "reserved") {
    if (reservation.outcome?.settlementPending === true && reservation.outcome?.result?.applied === true) {
      const outcome = { ...reservation.outcome }; delete outcome.settlementPending
      try { await usage.commit(reservation.id, outcome) } catch { throw new AiRequestError(503, "Source was accepted; AI Action settlement is pending.") }
      return outcome
    }
    fail(409, "This AI request is already in progress.")
  }
  if (reservation.status === "released") fail(409, "This AI request was released; use a new idempotency key.")
  if (reservation.status === "committed" && reservation.outcome) {
    if (request.apply === true && reservation.outcome.state === "ready_to_review") {
      const result = await apply(reservation.outcome.proposal)
      const outcome = { ...reservation.outcome, state: result?.applied ? "done" : "ready_to_review", result }
      try { await usage.commit(reservation.id, outcome) }
      catch { if (result?.applied) throw new AiRequestError(503, "Source was accepted; AI Action settlement is pending."); throw new AiRequestError(503, "AI Action settlement failed.") }
      return outcome
    }
    return reservation.outcome
  }
  let settled = false, sourceAccepted = false
  try {
    let proposal, lastError
    for (let attempt = 0; attempt <= LIMITS.retries; attempt++) {
      try { proposal = parseProposal(await provider.generate(proposalPrompt(request, context), signal), new Set(context.map(item => item.file))); break }
      catch (error) { lastError = error; if (!(error instanceof AiRequestError) || error.message !== "AI returned malformed proposal JSON." || attempt === LIMITS.retries) throw error }
    }
    if (!proposal) throw lastError
    const result = await apply(proposal); sourceAccepted = result?.applied === true
    const outcome = { state: result?.applied ? "done" : "ready_to_review", cost: actionCost(request.mode), contextFiles: context.map(item => item.file), proposal, result }
    try { await usage.commit(reservation.id, outcome) }
    catch {
      if (sourceAccepted) {
        await usage.recordPending?.(reservation.id, { ...outcome, settlementPending: true }).catch(() => {})
        throw new AiRequestError(503, "Source was accepted; AI Action settlement is pending.")
      }
      throw new AiRequestError(503, "AI Action settlement failed.")
    }
    settled = true
    return outcome
  } catch (error) {
    if (!settled && !sourceAccepted) await usage.release(reservation.id).catch(() => {})
    throw error
  }
}
