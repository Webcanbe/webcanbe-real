import { createHash, randomUUID } from "node:crypto"
import { buildIsolatedHttpPreview, type HttpPreviewBuild } from "./isolatedPreview"
import { ProjectRegistry, safeArchivePath, type SessionAuthority } from "./projectRegistry"
import { safePreviewRoute } from "../bridge/previewRoute"
import { previewResourcePath } from "./httpPreviewServer"

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
  generation: string
  origin: string
  revision: string
  expiresAt: number
  route: string
  network: Readonly<{ external: "deny" }>
  snapshot: PreviewSnapshot
}>
export type PreviewInput = Readonly<{ type: "pointer"; x: number; y: number; action: "move" | "click" }> | Readonly<{ type: "navigate"; route: string }>
export interface ControlledExecution {
  /** Trusted browser screenshot encoder; never project-supplied HTML/SVG/URLs. */
  capture(): Promise<Uint8Array>
  input(input: PreviewInput): Promise<void>
  /** Must kill/reap the entire job and delete its private profile, artifacts and IPC. */
  close(): Promise<void>
}
/** Trusted server integration seam, NOT a client attestation protocol.
 * No concrete provider is installed in this checkpoint. A future provider must
 * enforce network/process/filesystem isolation before consuming job bytes, retain
 * the native browser sandbox, use private controller pipes (no exposed CDP port),
 * and supervise expiry/abort/crash independently of browser JavaScript and this
 * process's timers. No shell/config/project code runs in the editor process.
 * An aborted open must kill/reap even if it has not returned an execution handle.
 * Tests use an in-memory double: those tests prove broker logic, NOT isolation.
 */
export interface ProjectRunner {
  open(job: ControlledJob, signal: AbortSignal): Promise<ControlledExecution>
}
type Entry = {
  projectId: string; authority: SessionAuthority; job?: ControlledJob
  generation: string; revision: string; expiresAt: number; abort: AbortController
  timer: ReturnType<typeof setTimeout>; retired: boolean; pending: boolean; busy: boolean
  execution?: ControlledExecution; closing?: Promise<void>
}
function routeAllowed(route: unknown): route is string {
  if (!safePreviewRoute(route)) return false
  const pathname = previewResourcePath(route.split("#")[0])
  return Boolean(pathname && !/^\/_wcb(?:\/|$)/i.test(pathname))
}

/** Dormant raster transport foundation. Not wired to the editor API.
 * All calls require the existing server capability; a generation is not authority.
 * Strict failure never falls back to Blob or executable HTML in an end-user browser.
 */
export class ControlledPreviewTransport {
  private readonly entries = new Map<string, Entry>()
  private closed = false
  private quarantined = false
  private readonly sweepTimer: ReturnType<typeof setInterval>
  constructor(private readonly registry: ProjectRegistry, private readonly applicationRoot: string, private readonly runner?: ProjectRunner, private readonly now = Date.now) {
    this.sweepTimer = setInterval(() => { void this.sweep().catch(() => { this.quarantined = true }) }, 250)
    this.sweepTimer.unref()
  }

  private authorized(projectId: string, authority: SessionAuthority) {
    return authority.operation === "preview" && this.registry.authorize(projectId, authority.previewId, authority.capability, "preview") && this.registry.sessionActive(projectId, authority.previewId)
  }
  private current(entry: Entry) {
    try { return !this.closed && !this.quarantined && !entry.retired && entry.expiresAt > this.now() && this.authorized(entry.projectId, entry.authority) && this.registry.revision(entry.projectId) === entry.revision } catch { return false }
  }
  private async retire(entry: Entry) {
    entry.retired = true; clearTimeout(entry.timer); entry.abort.abort()
    if (entry.execution && !entry.closing) {
      entry.closing = Promise.resolve().then(() => entry.execution!.close()).catch(() => {
        this.quarantined = true
        throw new Error("Controlled runner cleanup failed; transport quarantined.")
      })
    }
    if (entry.closing) await entry.closing
    // Pending startup still consumes capacity until its late result is closed.
    if (!entry.pending) { entry.job = undefined; this.entries.delete(entry.generation) }
  }
  async sweep() {
    const results = await Promise.allSettled([...this.entries.values()].filter(entry => !this.current(entry)).map(entry => this.retire(entry)))
    if (results.some(result => result.status === "rejected")) throw new Error("Controlled runner cleanup failed; transport quarantined.")
  }

  async start(projectId: string, authority: SessionAuthority, request: { revision: string; route: string }) {
    if (!this.authorized(projectId, authority)) throw new Error("Controlled preview is unauthorized.")
    if (!request || Object.keys(request).some(key => !["revision", "route"].includes(key)) || !routeAllowed(request.route)) throw new Error("Invalid controlled preview request. External networking is not an enabled project capability.")
    const { revision, route } = request
    if (revision !== this.registry.revision(projectId)) throw new Error("Controlled preview source revision is stale.")
    if (this.closed || this.quarantined) throw new Error("Controlled preview transport is closed or quarantined.")
    if (!this.runner) throw new Error(STRICT_PREVIEW_BLOCKER)
    await this.sweep()
    for (const entry of this.entries.values()) if (entry.authority.previewId === authority.previewId) await this.retire(entry)
    // Recheck after async cleanup before reserving the new slot.
    if (this.closed || this.quarantined || !this.authorized(projectId, authority)) throw new Error("Controlled preview is unavailable.")
    if (this.entries.size >= 4 || [...this.entries.values()].some(entry => entry.pending)) throw new Error("Controlled preview capacity reached.")
    const generation = randomUUID(), expiresAt = Math.min(this.registry.sessionExpiry(projectId, authority.previewId)!, this.now() + 60_000)
    const entry: Entry = { projectId, authority: { ...authority }, generation, revision, expiresAt, abort: new AbortController(), retired: false, pending: true, busy: false,
      timer: setTimeout(() => { void this.retire(entry).catch(() => { this.quarantined = true }) }, Math.max(0, expiresAt - this.now())) }
    entry.timer.unref(); this.entries.set(generation, entry)
    try {
      const snapshot = snapshotPreview(await buildIsolatedHttpPreview(this.registry.get(projectId)!, this.applicationRoot))
      if (!this.current(entry)) throw new Error("Controlled preview became stale during compilation.")
      // Reserved .invalid name is resolved only inside the future runner. It is
      // not an address or bootstrap credential returned to an end-user browser.
      entry.job = Object.freeze({ generation, revision: entry.revision, expiresAt, route, origin: "http://wcb-" + generation + ".preview.invalid", network: Object.freeze({ external: "deny" as const }), snapshot })
      entry.execution = await this.runner.open(entry.job, entry.abort.signal)
      if (!this.current(entry)) throw new Error("Controlled preview became stale during startup.")
      entry.pending = false
      return { transport: "raster" as const, generation, revision: entry.revision, expiresAt }
    } catch (error) { entry.pending = false; await this.retire(entry); throw error }
  }
  private async requireEntry(projectId: string, authority: SessionAuthority, generation: string) {
    // Wrong capabilities must not stop someone else's job.
    if (!this.authorized(projectId, authority)) throw new Error("Controlled preview is unauthorized.")
    const entry = this.entries.get(generation)
    if (!entry || entry.projectId !== projectId || entry.authority.previewId !== authority.previewId) throw new Error("Controlled preview generation is unavailable.")
    if (!this.current(entry)) { await this.retire(entry); throw new Error("Controlled preview is stale or expired.") }
    if (!entry.execution || entry.pending || entry.busy) throw new Error("Controlled preview is not ready.")
    entry.busy = true
    return entry
  }
  async capture(projectId: string, authority: SessionAuthority, generation: string) {
    const entry = await this.requireEntry(projectId, authority, generation)
    entry.busy = true
    try {
      if (!this.current(entry)) throw new Error("Controlled preview expired before capture.")
      const bytes = Buffer.from(await entry.execution!.capture())
      if (!this.current(entry)) throw new Error("Controlled preview expired during capture.")
      // Fixed raster type, bounded dimensions and bytes. The provider owns encoding.
      if (bytes.length < 33 || bytes.length > 8 * 1024 * 1024 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" || bytes.toString("ascii", 12, 16) !== "IHDR" || bytes.readUInt32BE(16) < 1 || bytes.readUInt32BE(20) < 1 || bytes.readUInt32BE(16) > 4096 || bytes.readUInt32BE(20) > 4096) throw new Error("Invalid controlled preview raster.")
      return { transport: "raster" as const, generation, contentType: "image/png" as const, bytes }
    } catch (error) { await this.retire(entry); throw error } finally { entry.busy = false }
  }
  async input(projectId: string, authority: SessionAuthority, generation: string, input: PreviewInput) {
    if (!input || (input.type === "navigate" ? Object.keys(input).some(key => !["type", "route"].includes(key)) || !routeAllowed(input.route) : input.type !== "pointer" || Object.keys(input).some(key => !["type", "x", "y", "action"].includes(key)) || !["move", "click"].includes(input.action) || ![input.x, input.y].every(n => Number.isFinite(n) && n >= 0 && n < 4096))) throw new Error("Invalid controlled preview input.")
    const command = Object.freeze({ ...input })
    const entry = await this.requireEntry(projectId, authority, generation)
    entry.busy = true
    try {
      if (!this.current(entry)) throw new Error("Controlled preview expired before input.")
      await entry.execution!.input(command)
      if (!this.current(entry)) throw new Error("Controlled preview expired during input.")
    }
    catch (error) { await this.retire(entry); throw error } finally { entry.busy = false }
  }
  async stop(projectId: string, authority: SessionAuthority, generation: string) {
    if (!this.authorized(projectId, authority)) throw new Error("Controlled preview is unauthorized.")
    const entry = this.entries.get(generation)
    if (entry && (entry.projectId !== projectId || entry.authority.previewId !== authority.previewId)) throw new Error("Controlled preview generation is unavailable.")
    if (entry) await this.retire(entry)
  }
  async close() { this.closed = true; clearInterval(this.sweepTimer); await this.sweep() }
}
