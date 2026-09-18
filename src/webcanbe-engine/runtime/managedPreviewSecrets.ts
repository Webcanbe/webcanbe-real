import type { RunnerOwner } from "./runnerScheduler"
import type { ControlledExecution, ControlledJob, RunnerProvider, RunnerSample } from "./controlledPreview"
import { RunnerCleanupError } from "./runnerContracts"

export type ManagedSecretReference = Readonly<{ workspaceId: string; projectId: string; environment: "preview"; runtime: "isolated-browser"; name: string; key: string; version: string }>
/** Production providers and policy adapters are installed by the trusted server.
 * Browser requests never supply references, values, environments or grants. */
export interface ManagedSecretProvider {
  read(reference: ManagedSecretReference, signal: AbortSignal): Promise<{ version: string; value: string } | undefined>
  versions(references: readonly ManagedSecretReference[], signal: AbortSignal): Promise<readonly (string | undefined)[]>
}
export interface ManagedSecretPolicy { references(owner: RunnerOwner, signal: AbortSignal): Promise<readonly ManagedSecretReference[] | undefined> }
export type RuntimeSecretDelivery = { generation: string; runtime: "isolated-browser"; values: Record<string, string> }
async function bounded<T>(action: (signal: AbortSignal) => Promise<T>) {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  try { return await Promise.race([Promise.resolve().then(() => action(controller.signal)), new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("Managed preview values unavailable.")) }, 1500) })]) }
  catch { throw new Error("Managed preview values unavailable.") }
  finally { clearTimeout(timer); controller.abort() }
}
const fingerprint = (refs: readonly ManagedSecretReference[]) => JSON.stringify(refs.map(r => [r.workspaceId,r.projectId,r.environment,r.runtime,r.name,r.key,r.version]).sort((a,b) => a[4].localeCompare(b[4])))
export class ManagedPreviewSecrets {
  constructor(private provider: ManagedSecretProvider, private policy: ManagedSecretPolicy, private authorized: (owner: RunnerOwner) => Promise<boolean>) {}
  private async references(owner: RunnerOwner) {
    if (!await bounded(() => this.authorized(owner))) throw new Error("Managed preview authority unavailable.")
    const list = await bounded(signal => this.policy.references(owner, signal))
    if (!list || list.length > 16) throw new Error("Managed preview grant unavailable.")
    const refs = list.map(ref => ({ ...ref })), names = new Set<string>()
    for (const ref of refs) {
      if (ref.workspaceId !== owner.workspaceId || ref.projectId !== owner.projectId || ref.environment !== "preview" || ref.runtime !== "isolated-browser" || typeof ref.name !== "string" || !/^WCB_PREVIEW_[A-Z0-9_]{1,64}$/.test(ref.name) || typeof ref.key !== "string" || !/^[A-Za-z0-9/_-]{1,160}$/.test(ref.key) || typeof ref.version !== "string" || !/^[A-Za-z0-9._-]{1,100}$/.test(ref.version) || names.has(ref.name)) throw new Error("Managed preview grant unavailable.")
      names.add(ref.name)
    }
    return refs
  }
  async bind(owner: RunnerOwner, generation: string) {
    owner = { ...owner }
    const refs = await this.references(owner)
    if (!refs.length) return undefined
    const values: Record<string, string> = Object.create(null)
    try {
      const resolvedValues = await Promise.all(refs.map(ref => bounded(signal => this.provider.read(ref, signal))))
      for (const [index, ref] of refs.entries()) {
        const resolved = resolvedValues[index]
        if (!resolved || resolved.version !== ref.version || typeof resolved.value !== "string" || Buffer.byteLength(resolved.value) < 16 || Buffer.byteLength(resolved.value) > 4096 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(resolved.value)) throw new Error("Managed preview version unavailable.")
        values[ref.name] = resolved.value
      }
      let destroyed = false, checking: Promise<boolean> | undefined
      const valid = () => checking ??= (async () => {
        if (destroyed || fingerprint(await this.references(owner)) !== fingerprint(refs)) return false
        const versions = await bounded(signal => this.provider.versions(refs, signal))
        return !destroyed && versions.length === refs.length && versions.every((version, i) => version === refs[i].version) && await bounded(() => this.authorized(owner))
      })().catch(() => false).finally(() => { checking = undefined })
      const destroy = () => { destroyed = true; for (const key of Object.keys(values)) delete values[key] }
      if (!await valid()) { destroy(); throw new Error("Managed preview grant changed.") }
      return { delivery: { generation, runtime: "isolated-browser" as const, values }, valid, destroy }
    } catch { for (const key of Object.keys(values)) delete values[key]; throw new Error("Managed preview values unavailable.") }
  }
}
/** Adds values only to the authenticated runner message, after compilation and
 * artifact persistence. The controller's source/snapshot/job stays value-free. */
export class ManagedSecretRunnerProvider implements RunnerProvider {
  constructor(private inner: RunnerProvider, private broker: ManagedPreviewSecrets) {}
  revoke(generation: string) { if (!this.inner.revoke) throw new RunnerCleanupError("Managed runtime cleanup unavailable."); return this.inner.revoke(generation) }
  async open(job: ControlledJob, signal: AbortSignal): Promise<ControlledExecution> {
    if (job.secretDelivery) throw new Error("Caller secret delivery is forbidden.")
    if (job.purpose === "semantic-typescript-v1") return this.inner.open(job, signal)
    if (!job.allocation || signal.aborted) throw new Error("Managed preview authority unavailable.")
    const lease = await this.broker.bind(job.allocation.owner, job.generation)
    if (!lease) return this.inner.open(job, signal)
    let execution: ControlledExecution | undefined, timer: ReturnType<typeof setInterval> | undefined, closing: Promise<void> | undefined, closed = false, checking = false
    const close = () => closing ??= (async () => {
      closed = true; clearInterval(timer)
      try { await execution?.close() } catch { throw new RunnerCleanupError("Managed runtime cleanup unverified.") } finally { lease.destroy() }
    })()
    const live = async () => { if (closed || signal.aborted || !await lease.valid()) throw new Error("Managed preview grant changed.") }
    const run = async <T,>(action: () => Promise<T>) => { try { await live(); const value = await action(); await live(); return value } catch { await close(); throw new Error("Managed preview is unavailable; reconnect after checking its grant.") } }
    try {
      await live(); execution = await this.inner.open({ ...job, secretDelivery: lease.delivery }, signal); await live()
      timer = setInterval(() => { if (!checking) { checking = true; void live().catch(() => close()).catch(() => {}).finally(() => { checking = false }) } }, 1000); timer.unref()
      const sample = async (): Promise<RunnerSample> => run(async () => {
        const value = execution!.sample ? await execution!.sample() : { bytes: await execution!.capture(), observation: undefined }
        if (value.observation && typeof value.observation === "object") {
          const observation = value.observation as { logs?: unknown }
          if (Array.isArray(observation.logs)) observation.logs = observation.logs.length ? ["Runtime logs withheld for managed preview values."] : []
        }
        return value
      })
      return { sample, capture: async () => (await sample()).bytes, input: input => run(() => execution!.input(input)), update: execution.update ? update => run(() => execution!.update!(update)) : undefined, close }
    } catch (error) { await close(); if (error instanceof RunnerCleanupError) throw error; throw new Error("Managed preview startup unavailable.") }
  }
}
