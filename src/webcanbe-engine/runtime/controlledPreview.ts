import { semanticSnapshot, semanticResult } from "./semanticTypecheck"
import type { ProjectGrant } from "./hostedAuthority"
import type { RunnerOwner } from "./runnerScheduler"
import { IncrementalPreviewCompiler, classifyPreviewUpdate, type PreviewUpdate } from "./incrementalPreview"
import type { RunnerAllocation } from "./runnerScheduler"
import { LOCAL_RESOURCE_BUDGET } from "./runnerScheduler"
import type { ArtifactStore, ArtifactReference } from "./storageContracts"
import { redactSecrets } from "./previewSecrets"
import type { PreviewElement, SourceIdentity } from "../core/types"
import { analyzeReactSource } from "../adapters/react/reactSourceAdapter"
import { contentHash } from "../mutations/durableSource"
import { createHash, randomUUID } from "node:crypto"
import { buildIsolatedHttpPreview, type HttpPreviewBuild } from "./isolatedPreview"
import { safeArchivePath, type SessionAuthority, type ProjectRecord } from "./projectRegistry"
import { routeAllowed, validPreviewInput } from "./previewInputs"
export { validPreviewInput } from "./previewInputs"

export const STRICT_PREVIEW_BLOCKER = "Strict preview is unavailable: no controlled browser/network runner has been verified and installed. Client iframe policy or runner claims cannot authorize strict execution."

/** Server-owned immutable bytes. No source root, editor key, cookie or capability. */
export type PreviewSnapshot = Readonly<{
  digest: string
  html: string
  files: readonly Readonly<{ path: string; contentType: string; base64: string }>[]
}>
export function snapshotPreview(build: HttpPreviewBuild): PreviewSnapshot {
  let bytes = Buffer.byteLength(build.html)
  const files = [...build.files].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([path, artifact]) => {
    bytes += artifact.body.length
    // Artifact keys are compiler filenames, not encoded HTTP request targets.
    if (!path.startsWith("/") || safeArchivePath(path.slice(1)) !== path.slice(1) || /[\r\n]/.test(artifact.contentType)) throw new Error("Invalid controlled preview artifact.")
    return Object.freeze({ path, contentType: artifact.contentType, base64: artifact.body.toString("base64") })
  })
  if (files.length > 2000 || bytes > 32 * 1024 * 1024) throw new Error("Controlled preview artifact limit exceeded.")
  const payload = { html: build.html, files: Object.freeze(files) }
  return Object.freeze({ ...payload, digest: createHash("sha256").update(JSON.stringify(payload)).digest("hex") })
}

export type ControlledJob = Readonly<{
  secretDelivery?: import("./managedPreviewSecrets").RuntimeSecretDelivery
  purpose?: "semantic-typescript-v1"
  allocation?: RunnerAllocation
  generation: string
  origin: string
  revision: string
  expiresAt: number
  route: string
  network: Readonly<{ external: "deny" }>
  snapshot: PreviewSnapshot
}>
export type PreviewKey = "Tab" | "Enter" | "Escape" | "Backspace" | "Delete" | "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown" | "Home" | "End" | "PageUp" | "PageDown" | "SelectAll" | "CopySelection"
export type PreviewInput = Readonly<{ type: "text"; text: string }> | Readonly<{ type: "key"; key: PreviewKey; shift: boolean }> | Readonly<{ type: "pointer"; x: number; y: number; action: "move" | "click" | "select" }> | Readonly<{ type: "navigate"; route: string }> | Readonly<{ type: "scroll"; dx: number; dy: number }> | Readonly<{ type: "history"; action: "back" | "forward" | "reload" }> | Readonly<{ type: "viewport"; width: number; height: number }>
export type RunnerObservation = { route: string; viewport: { width: number; height: number }; selection: PreviewElement | null; logs: string[]; clipboard?: string; focused?: { role: string; name: string } }
export type RunnerSample = { bytes: Uint8Array; observation: unknown }
export interface ControlledExecution {
  check?(): Promise<unknown>
  update?(update: PreviewUpdate): Promise<void>
  sample?(): Promise<RunnerSample>
  /** Trusted browser screenshot encoder; never project-supplied HTML/SVG/URLs. */
  capture(): Promise<Uint8Array>
  input(input: PreviewInput): Promise<void>
  /** Must kill/reap the entire job and delete its private profile, artifacts and IPC. */
  close(): Promise<void>
}
/** Server-owned replaceable execution boundary. Must enforce isolation outside browser APIs,
 * retain the native browser sandbox, supervise expiry/crash and reap aborted startup. */
export { RunnerCleanupError } from "./runnerContracts"
import { RunnerCleanupError } from "./runnerContracts"
export interface RunnerProvider {
  open(job: ControlledJob, signal: AbortSignal): Promise<ControlledExecution>
  /** Trusted controller recovery only; must create a revoke tombstone and verify cleanup. */
  revoke?(generation: string): Promise<void>
}
/** Compatibility name for the Phase 2C.1 broker seam. */
export type ProjectRunner = RunnerProvider
type Awaitable<T> = T | Promise<T>
/** Every authority/state result is awaited. Local implementations may return
 * values; hosted implementations always consult durable PostgreSQL authority. */
export interface PreviewRegistry {
  authorize(projectId: string, previewId: string, capability: string, operation: "preview"): Awaitable<boolean>
  sessionActive(projectId: string, previewId: string): Awaitable<boolean>
  revision(projectId: string, previewId?: string): Awaitable<string>
  sessionBinding(projectId: string, previewId: string): Awaitable<{ grant: ProjectGrant } | undefined>
  sessionExpiry(projectId: string, previewId: string): Awaitable<number | undefined>
  sessionOwner(projectId: string, previewId: string): Awaitable<RunnerOwner>
  withPreviewSource<T>(projectId: string, authority: SessionAuthority, action: (project: ProjectRecord, files: Map<string, string>) => Promise<T>, compiler?: IncrementalPreviewCompiler): Promise<T>
}
export interface PreviewArtifactStore {
  put: (grant: ProjectGrant, ref: ArtifactReference, snapshot: PreviewSnapshot) => Awaitable<void>
  get: (grant: ProjectGrant, ref: ArtifactReference) => Awaitable<PreviewSnapshot>
  retire: (ref: ArtifactReference) => Awaitable<void>
}
type Entry = {
  projectId: string; authority: SessionAuthority; job?: ControlledJob; compiler?: IncrementalPreviewCompiler; updating?: boolean; heldForUpdate?: boolean; restartRequired?: boolean; lastRoute?: string; artifactRef?: ArtifactReference; sourceHashes?: Map<string, string>
  generation: string; revision: string; expiresAt: number; sequence: number; abort: AbortController
  timer: ReturnType<typeof setTimeout>; retired: boolean; pending: boolean; busy: boolean
  execution?: ControlledExecution; closing?: Promise<void>
}


/** Raster transport. Only server-installed providers can start strict execution.
 * All calls require the existing server capability; a generation is not authority.
 * Strict failure never falls back to Blob or executable HTML in an end-user browser.
 */
export class ControlledPreviewTransport {
  private readonly entries = new Map<string, Entry>()
  private closed = false
  private quarantined = false
  private readonly sweepTimer: ReturnType<typeof setInterval>
  constructor(private readonly registry: PreviewRegistry, private readonly applicationRoot: string, private readonly runner?: ProjectRunner, private readonly now = Date.now, private readonly artifacts?: PreviewArtifactStore, private readonly options: { fastRefresh?: boolean } = {}) {
    this.sweepTimer = setInterval(() => { void this.sweep().catch(() => { this.quarantined = true }) }, 250)
    this.sweepTimer.unref()
  }

  private async authorized(projectId: string, authority: SessionAuthority) {
    return authority.operation === "preview" && await this.registry.authorize(projectId, authority.previewId, authority.capability, "preview") && await this.registry.sessionActive(projectId, authority.previewId)
  }
  private async current(entry: Entry) {
    try { return !this.closed && !this.quarantined && !entry.retired && entry.expiresAt > this.now() && await this.authorized(entry.projectId, entry.authority) && await this.registry.revision(entry.projectId, entry.authority.previewId) === entry.revision } catch { return false }
  }
  private async retire(entry: Entry) {
    entry.retired = true; clearTimeout(entry.timer); entry.abort.abort()
    // Independent cleanup must all run even if the artifact backend is down.
    // Failed cleanup retains the entry and capacity until a verified retry.
    const cleanups: Promise<unknown>[] = []
    if (entry.artifactRef) {
      const ref = entry.artifactRef
      cleanups.push(Promise.resolve().then(() => this.artifacts?.retire(ref)).then(() => { if (entry.artifactRef === ref) entry.artifactRef = undefined }))
    }
    if (entry.compiler && !entry.updating) {
      const compiler = entry.compiler
      cleanups.push(compiler.close().then(() => { if (entry.compiler === compiler) entry.compiler = undefined }))
    }
    if (entry.execution && !entry.closing) entry.closing = Promise.resolve().then(() => entry.execution!.close())
    if (entry.closing) cleanups.push(entry.closing)
    if ((await Promise.allSettled(cleanups)).some(result => result.status === "rejected")) {
      this.quarantined = true
      throw new Error("Controlled runner cleanup failed; transport quarantined.")
    }
    // Pending startup still consumes capacity until its late result is closed.
    if (!entry.pending) { entry.job = undefined; this.entries.delete(entry.generation) }
  }
  async sweep() {
    const results = await Promise.allSettled([...this.entries.values()].map(async entry => {
      const observed = { revision: entry.revision, updating: entry.updating, held: entry.heldForUpdate, busy: entry.busy }
      const current = await this.current(entry), authorized = await this.authorized(entry.projectId, entry.authority)
      // An async authority lookup can overlap the entire commit/update. Never
      // retire a now-current generation using that older revision observation.
      // The next sweep will assess its new state; capture/input recheck directly.
      if (!this.closed && !this.quarantined && !entry.retired && (entry.revision !== observed.revision || entry.updating !== observed.updating || entry.heldForUpdate !== observed.held || entry.busy !== observed.busy)) return
      if (this.closed || this.quarantined || entry.retired || !entry.updating && !entry.heldForUpdate && !current || entry.expiresAt <= this.now() || !authorized) await this.retire(entry)
    }))
    if (results.some(result => result.status === "rejected")) throw new Error("Controlled runner cleanup failed; transport quarantined.")
  }

  async start(projectId: string, authority: SessionAuthority, request: { revision: string; route: string }) {
    authority = { ...authority }
    if (!request || Object.keys(request).some(key => !["revision", "route"].includes(key)) || !routeAllowed(request.route)) throw new Error("Invalid controlled preview request. External networking is not an enabled project capability.")
    const { revision, route } = request
    if (!await this.authorized(projectId, authority)) throw new Error("Controlled preview is unauthorized.")
    if (revision !== await this.registry.revision(projectId, authority.previewId)) throw new Error("Controlled preview source revision is stale.")
    if (this.closed || this.quarantined) throw new Error("Controlled preview transport is closed or quarantined.")
    if (!this.runner) throw new Error(STRICT_PREVIEW_BLOCKER)
    await this.sweep()
    for (const entry of this.entries.values()) if (entry.authority.previewId === authority.previewId) await this.retire(entry)
    // Recheck after async cleanup before reserving the new slot.
    if (this.closed || this.quarantined || !await this.authorized(projectId, authority)) throw new Error("Controlled preview is unavailable.")
    const expiresAt = Math.min((await this.registry.sessionExpiry(projectId, authority.previewId))!, this.now() + 60_000)
    // All asynchronous lookups finish before the capacity check + reservation.
    // No await may split this pair: concurrent hosted requests share this gate.
    if (this.closed || this.quarantined || !Number.isFinite(expiresAt) || expiresAt <= this.now()) throw new Error("Controlled preview is unavailable.")
    if (this.entries.size >= 4 || [...this.entries.values()].some(entry => entry.pending)) throw new Error("Controlled preview capacity reached.")
    const generation = randomUUID()
    const entry: Entry = { projectId, authority: { ...authority }, generation, revision, expiresAt, sequence: 0, abort: new AbortController(), retired: false, pending: true, busy: false,
      timer: setTimeout(() => { void this.retire(entry).catch(() => { this.quarantined = true }) }, Math.max(0, expiresAt - this.now())) }
    entry.timer.unref(); this.entries.set(generation, entry)
    try {
      entry.compiler = new IncrementalPreviewCompiler(Boolean(this.options.fastRefresh))
      let snapshot = await this.registry.withPreviewSource(projectId, authority, async (project, files) => {
        entry.sourceHashes = new Map([...files].map(([file, text]) => [file, contentHash(text)]))
        return snapshotPreview(await buildIsolatedHttpPreview(project, this.applicationRoot, entry.compiler))
      }, entry.compiler)
      snapshot = await this.storedSnapshot(entry, snapshot)
      if (!await this.current(entry)) throw new Error("Controlled preview became stale during compilation.")
      // Reserved .invalid name is resolved only inside the future runner. It is
      // not an address or bootstrap credential returned to an end-user browser.
      entry.job = Object.freeze({ generation, revision: entry.revision, expiresAt, route, origin: "http://wcb-" + generation + ".preview.invalid", network: Object.freeze({ external: "deny" as const }), snapshot, allocation: Object.freeze({ owner: Object.freeze(await this.registry.sessionOwner(projectId, authority.previewId)), idempotencyKey: generation, startupDeadline: Math.min(expiresAt, this.now() + 15_000), executionDeadline: expiresAt, idleMs: 60_000, budget: LOCAL_RESOURCE_BUDGET }) })
      entry.execution = await this.runner.open(entry.job, entry.abort.signal)
      if (!await this.current(entry)) throw new Error("Controlled preview became stale during startup.")
      entry.pending = false
      return { transport: "raster" as const, generation, revision: entry.revision, expiresAt }
    } catch (error) { if (error instanceof RunnerCleanupError) this.quarantined = true; entry.pending = false; await this.retire(entry); throw error }
  }
  async typecheck(projectId: string, authority: SessionAuthority, revision: string, files: Map<string,string>) {
    authority={...authority}; files=new Map(files)
    if(!this.runner||this.closed||this.quarantined||!await this.authorized(projectId,authority)||await this.registry.revision(projectId,authority.previewId)!==revision)throw new Error("Semantic checker authority unavailable.")
    const expiresAt=Math.min((await this.registry.sessionExpiry(projectId,authority.previewId))!,this.now()+60_000)
    if(!Number.isFinite(expiresAt)||expiresAt<=this.now()||this.closed||this.quarantined||this.entries.size>=4||[...this.entries.values()].some(e=>e.pending||e.job?.purpose==="semantic-typescript-v1"))throw new Error("Semantic checker capacity unavailable.")
    const generation=randomUUID(),entry:Entry={projectId,authority,generation,revision,expiresAt,sequence:0,abort:new AbortController(),retired:false,pending:true,busy:true,timer:setTimeout(()=>{void this.retire(entry).catch(()=>{this.quarantined=true})},Math.max(0,expiresAt-this.now()))}
    entry.timer.unref();this.entries.set(generation,entry)
    try{
      const snapshot=await this.registry.withPreviewSource(projectId,authority,async project=>semanticSnapshot(project,this.applicationRoot,files))
      const stored=await this.storedSnapshot(entry,snapshot)
      if(!await this.current(entry))throw new Error("Semantic source became stale.")
      entry.job=Object.freeze({purpose:"semantic-typescript-v1",generation,revision,expiresAt,route:"/",origin:"http://wcb-"+generation+".preview.invalid",network:{external:"deny" as const},snapshot:stored,allocation:{owner:await this.registry.sessionOwner(projectId,authority.previewId),idempotencyKey:generation,startupDeadline:Math.min(expiresAt,this.now()+15_000),executionDeadline:expiresAt,idleMs:60_000,budget:LOCAL_RESOURCE_BUDGET}})
      entry.execution=await this.runner.open(entry.job,entry.abort.signal);entry.pending=false
      if(!entry.execution.check||!await this.current(entry))throw new Error("Semantic checker unavailable or stale.")
      const result=semanticResult(await entry.execution.check())
      if(!await this.current(entry))throw new Error("Semantic result became stale or unauthorized.")
      return result
    }catch(error){if(error instanceof RunnerCleanupError)this.quarantined=true;throw error}
    finally{entry.pending=false;await this.retire(entry)}
  }
  private async storedSnapshot(entry: Entry, snapshot: PreviewSnapshot, revision = entry.revision) {
    const grant = (await this.registry.sessionBinding(entry.projectId, entry.authority.previewId))?.grant
    if (!this.artifacts || !grant) return snapshot
    const ref: ArtifactReference = { workspaceId: grant.workspaceId, projectId: entry.projectId, revision, generation: entry.generation, digest: snapshot.digest }
    if (entry.artifactRef && JSON.stringify(entry.artifactRef) !== JSON.stringify(ref)) {
      await this.artifacts.retire(entry.artifactRef)
      entry.artifactRef = undefined
    }
    await this.artifacts.put(grant, ref, snapshot)
    entry.artifactRef = ref
    return this.artifacts.get(grant, ref)
  }
  /** Hold only a live same-session generation across a canonical commit. Capture
   * and input still reject the old revision. The bounded update either advances
   * its digest/revision atomically or destroys the entire job. */
  async holdForSourceCommit(projectId: string, previewId: string, structural = false) {
    for (const entry of this.entries.values()) if (entry.projectId === projectId && entry.authority.previewId === previewId && !entry.retired && entry.execution?.update) {
      entry.heldForUpdate = true
      if (await this.current(entry)) entry.restartRequired ||= structural
      else entry.heldForUpdate = false
    }
  }
  async update(projectId: string, authority: SessionAuthority, generation: string, revision: string) {
    if (!await this.authorized(projectId, authority)) throw new Error("Controlled preview is unauthorized.")
    const entry = this.entries.get(generation)
    if (!entry || entry.projectId !== projectId || entry.authority.previewId !== authority.previewId || entry.retired || entry.pending || entry.busy || entry.updating || entry.expiresAt <= this.now() || this.closed || this.quarantined || !entry.execution?.update || !entry.compiler || !entry.job) throw new Error("Controlled update is unavailable; restart the generation.")
    entry.updating = true; entry.heldForUpdate = false; entry.busy = true
    try {
      if (revision !== await this.registry.revision(projectId, authority.previewId)) throw new Error("Controlled update revision is stale.")
      if (entry.restartRequired) {
        entry.updating = false; entry.busy = false
        return { ...await this.start(projectId, authority, { revision, route: entry.lastRoute ?? entry.job.route }), updateKind: "generation-restart" }
      }
      const built = await this.registry.withPreviewSource(projectId, authority, async (project, files) => ({
        snapshot: snapshotPreview(await buildIsolatedHttpPreview(project, this.applicationRoot, entry.compiler)),
        sourceHashes: new Map([...files].map(([file, text]) => [file, contentHash(text)]))
      }), entry.compiler)
      const { snapshot, sourceHashes } = built
      if (!await this.authorized(projectId, authority) || revision !== await this.registry.revision(projectId, authority.previewId) || entry.retired || entry.expiresAt <= this.now()) throw new Error("Update became stale during compilation.")
      if (entry.compiler.configurationChanged) {
        entry.updating = false; entry.busy = false
        return { ...await this.start(projectId, authority, { revision, route: entry.lastRoute ?? entry.job.route }), updateKind: "generation-restart" }
      }
      const affectedFiles = [...new Set([...(entry.sourceHashes?.keys() ?? []), ...sourceHashes.keys()])].filter(file => entry.sourceHashes?.get(file) !== sourceHashes.get(file))
      const kind = classifyPreviewUpdate(entry.job.snapshot, snapshot)
      const stored = await this.storedSnapshot(entry, snapshot, revision)
      await entry.execution.update({ expectedRevision: entry.revision, expectedDigest: entry.job.snapshot.digest, revision, snapshot: stored, kind })
      if (!await this.authorized(projectId, authority) || revision !== await this.registry.revision(projectId, authority.previewId) || entry.retired || entry.expiresAt <= this.now()) throw new Error("Update became stale in runner.")
      entry.revision = revision; entry.sourceHashes = sourceHashes
      entry.job = Object.freeze({ ...entry.job, revision, snapshot: stored })
      return { transport: "raster" as const, generation, revision, expiresAt: entry.expiresAt, updateKind: kind, affectedFiles, compilerBuilds: entry.compiler.builds }
    } catch (error) { await this.retire(entry); throw error }
    finally { entry.updating = false; entry.busy = false; if (entry.retired && entry.compiler) { await entry.compiler.close(); entry.compiler = undefined } }
  }
  private async requireEntry(projectId: string, authority: SessionAuthority, generation: string) {
    // Wrong capabilities must not stop someone else's job.
    if (!await this.authorized(projectId, authority)) throw new Error("Controlled preview is unauthorized.")
    const entry = this.entries.get(generation)
    if (!entry || entry.projectId !== projectId || entry.authority.previewId !== authority.previewId) throw new Error("Controlled preview generation is unavailable.")
    if (!await this.current(entry)) { await this.retire(entry); throw new Error("Controlled preview is stale or expired.") }
    if (!entry.execution || entry.pending || entry.busy) throw new Error("Controlled preview is not ready.")
    entry.busy = true
    return entry
  }
  async capture(projectId: string, authority: SessionAuthority, generation: string) {
    const entry = await this.requireEntry(projectId, authority, generation)
    entry.busy = true
    try {
      if (!await this.current(entry)) throw new Error("Controlled preview expired before capture.")
      const sample = entry.execution!.sample ? await entry.execution!.sample() : { bytes: await entry.execution!.capture(), observation: undefined }
      const bytes = Buffer.from(sample.bytes)
      if (!await this.current(entry)) throw new Error("Controlled preview expired during capture.")
      // Fixed raster type, bounded dimensions and bytes. The provider owns encoding.
      if (bytes.length < 33 || bytes.length > 8 * 1024 * 1024 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" || bytes.toString("ascii", 12, 16) !== "IHDR" || bytes.readUInt32BE(16) < 1 || bytes.readUInt32BE(20) < 1 || bytes.readUInt32BE(16) > 4096 || bytes.readUInt32BE(20) > 4096) throw new Error("Invalid controlled preview raster.")
      const observation = sample.observation === undefined ? undefined : sanitizeObservation(sample.observation)
      if (observation) entry.lastRoute = observation.route
      if (observation) observation.logs = observation.logs.map(line => redactSecrets(line, [authority.capability]))
      if (observation && (observation.viewport.width !== bytes.readUInt32BE(16) || observation.viewport.height !== bytes.readUInt32BE(20))) throw new Error("Raster geometry mismatch.")
      if (observation?.selection) {
        await this.registry.withPreviewSource(projectId, authority, async (_project, files) => {
          const valid = (identity: SourceIdentity) => files.has(identity.file) && analyzeReactSource(identity.file, files.get(identity.file) ?? "", file => files.get(file)).some(target => target.identity.elementStart === identity.elementStart)
          if (!valid(observation.selection!.identity)) observation.selection = null
          else if (observation.selection!.parentIdentity && !valid(observation.selection!.parentIdentity)) { delete observation.selection!.parentIdentity; delete observation.selection!.parentLayoutContext }
        })
        if (!await this.current(entry)) throw new Error("Preview source changed during selection validation.")
      }
      return { transport: "raster" as const, generation, contentType: "image/png" as const, bytes, observation, sequence: ++entry.sequence, revision: entry.revision }
    } catch (error) { await this.retire(entry); throw error } finally { entry.busy = false }
  }
  async input(projectId: string, authority: SessionAuthority, generation: string, input: PreviewInput, sequence?: number) {
    if (!validPreviewInput(input)) throw new Error("Invalid controlled preview input.")
    const command = Object.freeze({ ...input })
    const entry = await this.requireEntry(projectId, authority, generation)
    entry.busy = true
    try {
      if (!await this.current(entry)) throw new Error("Controlled preview expired before input.")
      if (sequence !== undefined && sequence !== entry.sequence) throw new Error("Preview frame is stale.")
      await entry.execution!.input(command)
      if (!await this.current(entry)) throw new Error("Controlled preview expired during input.")
    }
    catch (error) { await this.retire(entry); throw error } finally { entry.busy = false }
  }
  async stop(projectId: string, authority: SessionAuthority, generation: string) {
    if (!await this.authorized(projectId, authority)) throw new Error("Controlled preview is unauthorized.")
    const entry = this.entries.get(generation)
    if (entry && (entry.projectId !== projectId || entry.authority.previewId !== authority.previewId)) throw new Error("Controlled preview generation is unavailable.")
    if (entry) await this.retire(entry)
  }
  async close() { this.closed = true; clearInterval(this.sweepTimer); await this.sweep() }
}


function sanitizeObservation(value: unknown): RunnerObservation {
  const v = value as RunnerObservation
  if (!v || !routeAllowed(v.route) || !validPreviewInput({ type: "viewport", ...v.viewport }) || !Array.isArray(v.logs) || v.logs.length > 20 || v.logs.some(line => typeof line !== "string" || line.length > 310)) throw new Error("Invalid runner observation.")
  const identity = (value: SourceIdentity) => {
    if (!value || typeof value.file !== "string" || value.file.length > 512 || safeArchivePath(value.file) !== value.file || !Number.isSafeInteger(value.elementStart) || value.elementStart < 0) throw new Error("Invalid observed source identity.")
    return { file: value.file, elementStart: value.elementStart }
  }
  const layout = (value: string) => { if (!["block", "flex", "grid", "positioned", "unknown"].includes(value)) throw new Error("Invalid observed layout."); return value as PreviewElement["layoutContext"] }
  let selection: PreviewElement | null = null
  if (v.selection !== null) {
    const e = v.selection
    if (!e || typeof e.tagName !== "string" || !/^[a-z][a-z0-9-]{0,63}$/.test(e.tagName) || !e.rect || !e.computed || typeof e.computed !== "object") throw new Error("Invalid observed element.")
    const rect = { top: e.rect.top, left: e.rect.left, width: e.rect.width, height: e.rect.height }
    if (Object.values(rect).some(n => !Number.isFinite(n) || Math.abs(n) > 1e7) || rect.width < 0 || rect.height < 0) throw new Error("Invalid observed geometry.")
    const computed: Record<string, string> = {}
    for (const key of ["display","position","backgroundColor","color","fontSize","fontWeight","padding","margin","gap","width","height","border","borderRadius"]) {
      const item = e.computed[key]
      if (item !== undefined) { if (typeof item !== "string" || item.length > 512) throw new Error("Invalid observed style."); computed[key] = item }
    }
    selection = { identity: identity(e.identity), tagName: e.tagName, rect, computed, layoutContext: layout(e.layoutContext) }
    if (e.parentIdentity) { selection.parentIdentity = identity(e.parentIdentity); selection.parentLayoutContext = layout(e.parentLayoutContext!) }
  }
  if (v.clipboard !== undefined && (typeof v.clipboard !== "string" || v.clipboard !== "" && !validPreviewInput({ type: "text", text: v.clipboard }))) throw new Error("Invalid clipboard text.")
  if (v.focused !== undefined && (!v.focused || !["button","textbox","link","checkbox","radio","combobox","slider","unknown"].includes(v.focused.role) || typeof v.focused.name !== "string" || v.focused.name.length > 200)) throw new Error("Invalid focus description.")
  return { route: v.route, viewport: { width: v.viewport.width, height: v.viewport.height }, selection, logs: v.logs.slice(), ...(v.clipboard !== undefined ? { clipboard: v.clipboard } : {}), ...(v.focused ? { focused: { role: v.focused.role, name: v.focused.name } } : {}) }
}
