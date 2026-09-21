import { createHash } from "node:crypto"

const SECRET_PATH = /(^|\/)(?:\.env(?:\.|$)|secrets?(?:\/|$)|credentials?(?:\/|$)|(?:id_rsa|id_ed25519|\.npmrc|\.pypirc)$)/i
const SOURCE_PATH = /^(?:[A-Za-z0-9][A-Za-z0-9._-]*\/)*[A-Za-z0-9][A-Za-z0-9._-]*\.(?:[cm]?[jt]sx?|css|json)$/
const MODES = new Set(["explain", "modify", "style", "multifile", "fix"])
const LIMITS = Object.freeze({ files: 12, bytes: 96 * 1024, request: 4000, output: 96 * 1024, retries: 1 })

export class AiRequestError extends Error { constructor(status, message) { super(message); this.status = status } }
const fail = (status, message) => { throw new AiRequestError(status, message) }
const bytes = value => new TextEncoder().encode(value).byteLength

export function actionCost(mode) { return mode === "deep" ? 3 : 1 }
export function aiModel(env) { return typeof env?.WEBCANBE_AI_MODEL === "string" && env.WEBCANBE_AI_MODEL.length <= 200 ? env.WEBCANBE_AI_MODEL : "@cf/meta/llama-3.3-70b-instruct-fp8-fast" }
export function safeAiPath(file) { return typeof file === "string" && file.length <= 512 && SOURCE_PATH.test(file) && !file.includes("..") && !SECRET_PATH.test(file) }

/** Returns only current, authorised source. No project-wide archive, config, or credentials enter a model prompt. */
export function selectAiContext(files, request) {
  if (!request || typeof request !== "object" || !MODES.has(request.feature) || typeof request.prompt !== "string" || !request.prompt.trim() || request.prompt.length > LIMITS.request) fail(400, "Provide a bounded AI editing request.")
  const selected = new Set()
  const add = file => { if (safeAiPath(file) && files.has(file)) selected.add(file) }
  add(request.selection?.file)
  for (const file of request.files ?? []) add(file)
  if (!selected.size) for (const file of [...files.keys()].filter(safeAiPath).sort().slice(0, 2)) selected.add(file)
  if (selected.size > LIMITS.files) fail(422, "AI context may include at most 12 source files.")
  const result = [], imports = new Set(); let total = 0
  for (const file of selected) {
    const source = files.get(file)
    if (typeof source !== "string") continue
    total += bytes(source)
    if (total > LIMITS.bytes) fail(422, "Selected AI context exceeds 96 KiB.")
    result.push({ file, source })
    for (const match of source.matchAll(/from\s+["']([^"']+)["']/g)) imports.add(match[1])
  }
  // Include direct relative imports only when they resolve to an already-authorised source file.
  for (const file of [...files.keys()].sort()) {
    if (result.length >= LIMITS.files || !safeAiPath(file) || result.some(item => item.file === file)) continue
    const basename = file.replace(/\.(?:[cm]?[jt]sx?|css|json)$/, "")
    if (![...imports].some(value => value.startsWith(".") && (value.endsWith(basename.split("/").at(-1)) || value === "./" + basename.split("/").at(-1)))) continue
    const source = files.get(file); total += bytes(source)
    if (total > LIMITS.bytes) break
    result.push({ file, source })
  }
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

export function parseProposal(output) {
  const raw = typeof output === "string" ? output.trim().replace(/^```(?:json)?\s*|\s*```$/g, "") : ""
  if (!raw || bytes(raw) > LIMITS.output) fail(422, "AI returned an invalid or oversized proposal.")
  let proposal
  try { proposal = JSON.parse(raw) } catch { fail(422, "AI returned malformed proposal JSON.") }
  if (!proposal || typeof proposal !== "object" || Array.isArray(proposal) || typeof proposal.summary !== "string" || proposal.summary.length > 1000 || !Array.isArray(proposal.operations) || proposal.operations.length > 20) fail(422, "AI proposal has an invalid shape.")
  for (const operation of proposal.operations) {
    if (!operation || typeof operation !== "object" || !["update", "create", "delete"].includes(operation.kind) || !safeAiPath(operation.file) || (operation.kind === "create" ? operation.expectedHash !== null : typeof operation.expectedHash !== "string") || (["update", "create"].includes(operation.kind) && (typeof operation.content !== "string" || bytes(operation.content) > 2 * 1024 * 1024 || operation.content.includes("\0")))) fail(422, "AI proposal contains an unsafe source operation.")
  }
  return { summary: proposal.summary, operations: proposal.operations }
}

export class WorkersAiProvider {
  constructor(binding, model) { this.binding = binding; this.model = model }
  async generate(prompt, signal) {
    if (!this.binding?.run) throw new AiRequestError(503, "Workers AI is not configured for this environment.")
    const work = this.binding.run(this.model, { messages: [{ role: "user", content: prompt }], max_tokens: 4096 })
    const response = signal ? await Promise.race([work, new Promise((_, reject) => signal.addEventListener("abort", () => reject(new AiRequestError(504, "Workers AI timed out.")), { once: true }))]) : await work
    const text = typeof response === "string" ? response : response?.response ?? response?.result?.response
    if (typeof text !== "string") throw new AiRequestError(502, "Workers AI returned no text proposal.")
    return text
  }
}

/** Usage is an entitlement adapter, deliberately independent from payment implementation. */
export async function runAiRequest({ provider, usage, request, files, userId, projectId, revision, apply }) {
  if (!["standard", "deep", undefined].includes(request.mode)) fail(400, "AI mode must be standard or deep.")
  if (typeof request.idempotencyKey !== "string" || !/^[A-Za-z0-9_-]{8,160}$/.test(request.idempotencyKey)) fail(400, "A bounded AI idempotency key is required.")
  const context = selectAiContext(files, request)
  const reservation = await usage.reserve({ userId, projectId, idempotencyKey: request.idempotencyKey, cost: actionCost(request.mode), expectedRevision: revision })
  let settled = false
  try {
    let proposal, lastError
    for (let attempt = 0; attempt <= LIMITS.retries; attempt++) {
      try { proposal = parseProposal(await provider.generate(proposalPrompt(request, context))); break }
      catch (error) { lastError = error; if (!(error instanceof AiRequestError) || error.status !== 422 || attempt === LIMITS.retries) throw error }
    }
    if (!proposal) throw lastError
    const result = await apply(proposal)
    await usage.commit(reservation.id)
    settled = true
    return { state: result?.applied ? "done" : "ready_to_review", cost: actionCost(request.mode), contextFiles: context.map(item => item.file), proposal, result }
  } catch (error) {
    if (!settled) await usage.release(reservation.id).catch(() => {})
    throw error
  }
}
