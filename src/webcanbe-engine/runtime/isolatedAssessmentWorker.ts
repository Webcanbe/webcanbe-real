import { createHash, randomUUID } from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { MutationHistory } from "../mutations/sourceMutations"
import type { AssessmentJobFence, AssessmentJobLease, AssessmentResult, AssessmentResultInput, AssessmentWorkerAuthority } from "./productDomain"
import type { ControlledExecution, ControlledJob, RunnerProvider } from "./controlledPreview"
import { semanticResult, semanticSnapshot } from "./semanticTypecheck"
import { detectProject, safeArchivePath, type ProjectRecord } from "./projectRegistry"
import { sourceDirectory, sourceMember } from "./sourceDirectory"
import { LOCAL_RESOURCE_BUDGET, type RunnerOwner } from "./runnerScheduler"
import type { PostgresProductDomainStore } from "./postgresProductDomain"
import type { Pool } from "pg"
import { HostedLinuxRunnerProvider, type HostedRunnerHost } from "./hostedLinuxRunner"
import { PostgresLeaseStore } from "./postgresFencing"

export interface HostedIsolatedAssessmentRunner extends RunnerProvider {
  readonly isolationBoundary: "hosted-linux"
  close(): Promise<void>
}

export type HostedAssessmentRunnerFactory = (authorized: (owner: RunnerOwner) => Promise<boolean>) => HostedIsolatedAssessmentRunner

const sameOwner = (left: RunnerOwner, right: RunnerOwner) => left.userId === right.userId && left.workspaceId === right.workspaceId && left.projectId === right.projectId && left.sessionId === right.sessionId
const fenceOf = (lease: AssessmentJobLease): AssessmentJobFence => ({ assessmentJobId: lease.assessmentJobId, submissionId: lease.submissionId, snapshotHash: lease.snapshotHash, generation: lease.generation })
const resultKey = (worker: AssessmentWorkerAuthority, fence: AssessmentJobFence) => `assessment-${createHash("sha256").update(JSON.stringify({ workerId: worker.workerId, ...fence })).digest("hex")}`

/** Trusted server worker. Uploaded files are staged as inert data for the
 * existing static profile admission, then checked only by the hosted Linux
 * runner's fixed semantic command. */
export class IsolatedAssessmentWorker {
  constructor(
    private readonly products: PostgresProductDomainStore,
    private readonly applicationRoot: string,
    private readonly runnerFactory: HostedAssessmentRunnerFactory,
    private readonly executionMs = 15_000,
  ) {
    if (!path.isAbsolute(applicationRoot) || !Number.isInteger(executionMs) || executionMs < 25 || executionMs > 30_000) throw new Error("Invalid isolated assessment worker configuration.")
  }

  async run(worker: AssessmentWorkerAuthority, claimed: AssessmentJobLease): Promise<AssessmentResult> {
    const fence = fenceOf(claimed), snapshot = await this.products.assessmentExecutionSnapshot(worker, fence)
    if (claimed.workerId !== worker.workerId || claimed.sellerUserId !== snapshot.sellerUserId || claimed.sourceProjectId !== snapshot.sourceProjectId || claimed.sourceRevisionId !== snapshot.sourceRevisionId || claimed.sourceContentHash !== snapshot.sourceContentHash) throw new Error("Assessment lease does not match its immutable execution snapshot.")
    const owner: RunnerOwner = { userId: snapshot.sellerUserId, workspaceId: snapshot.workspaceId, projectId: snapshot.sourceProjectId, sessionId: snapshot.assessmentJobId }
    const runner = this.runnerFactory(async candidate => {
      if (!sameOwner(candidate, owner)) return false
      try { await this.products.assertAssessmentLease(worker, fence); return true } catch { return false }
    })
    if (runner.isolationBoundary !== "hosted-linux") { await runner.close(); throw new Error("Assessment requires the hosted Linux isolation boundary.") }

    const abort = new AbortController(), timeout = setTimeout(() => abort.abort(), this.executionMs)
    timeout.unref()
    let renewalBusy = false, leaseLost = false
    const renewal = setInterval(() => {
      if (renewalBusy || abort.signal.aborted) return
      renewalBusy = true
      void this.products.renewAssessmentJobLease(worker, fence).catch(() => { leaseLost = true; abort.abort() }).finally(() => { renewalBusy = false })
    }, 1_000)
    renewal.unref()
    let execution: ControlledExecution | undefined, prepared: ReturnType<typeof semanticSnapshot> | undefined
    let input: AssessmentResultInput
    try {
      prepared = this.prepare(snapshot)
      await this.products.assertAssessmentLease(worker, fence)
      const now = Date.now(), generation = randomUUID(), expiresAt = now + Math.min(60_000, this.executionMs + 15_000)
      const job: ControlledJob = Object.freeze({
        purpose: "semantic-typescript-v1",
        allocation: Object.freeze({ owner, idempotencyKey: resultKey(worker, fence), startupDeadline: now + Math.min(15_000, this.executionMs), executionDeadline: expiresAt, idleMs: Math.min(60_000, this.executionMs + 5_000), budget: LOCAL_RESOURCE_BUDGET }),
        generation,
        origin: `http://wcb-${generation}.preview.invalid`,
        revision: snapshot.sourceRevisionId,
        expiresAt,
        route: "/",
        network: Object.freeze({ external: "deny" as const }),
        snapshot: prepared,
      })
      execution = await runner.open(job, abort.signal)
      if (!execution.check) throw new Error("Hosted isolated runner lacks the fixed assessment command.")
      const checked = semanticResult(await this.bounded(execution.check(), abort.signal))
      input = { idempotencyKey: resultKey(worker, fence), status: checked.passed ? "passed" : "failed", metadata: this.evidence(checked) }
    } catch (error) {
      if (leaseLost) throw error
      input = { idempotencyKey: resultKey(worker, fence), status: "errored", metadata: { schema: 1, assessment: "typescript-semantic-v1", bounded: true, error: abort.signal.aborted ? "execution_timeout" : "isolated_assessment_error" } }
    } finally {
      clearTimeout(timeout); clearInterval(renewal)
      if (execution) await execution.close()
      await runner.close()
    }
    await this.products.assertAssessmentLease(worker, fence)
    return this.products.acceptAssessmentResult(worker, fence, input)
  }

  private bounded<T>(operation: Promise<T>, signal: AbortSignal) {
    if (signal.aborted) return Promise.reject(new Error("Assessment execution deadline expired."))
    return new Promise<T>((resolve, reject) => {
      const expired = () => reject(new Error("Assessment execution deadline expired."))
      signal.addEventListener("abort", expired, { once: true })
      operation.then(resolve, reject).finally(() => signal.removeEventListener("abort", expired))
    })
  }

  private prepare(snapshot: Awaited<ReturnType<PostgresProductDomainStore["assessmentExecutionSnapshot"]>>) {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "wcb-assessment-")))
    try {
      for (const [name, bytes] of snapshot.files) {
        if (safeArchivePath(name) !== name) throw new Error("Unsafe immutable assessment path.")
        const file = path.join(root, name)
        fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
        fs.writeFileSync(file, bytes, { flag: "wx", mode: 0o600 })
      }
      const detection = detectProject(root, this.applicationRoot)
      const project: ProjectRecord = { id: snapshot.sourceProjectId, name: "Immutable seller assessment", archiveRoot: root, root, sourceRoot: path.join(root, detection.sourceDirectory ?? "src"), imported: true, detection, history: new MutationHistory() }
      const scope = sourceDirectory(project), source = new Map<string, string>()
      for (const [name, bytes] of snapshot.files) if (sourceMember(name, scope)) source.set(name, new TextDecoder("utf-8", { fatal: true }).decode(bytes))
      return semanticSnapshot(project, this.applicationRoot, source)
    } finally { fs.rmSync(root, { recursive: true, force: true }) }
  }

  private evidence(result: ReturnType<typeof semanticResult>) {
    const diagnostics = result.diagnostics.slice(0, 8).map(item => ({ file: item.file.slice(0, 300), message: item.message.slice(0, 400), ...(item.line ? { line: item.line } : {}), ...(item.column ? { column: item.column } : {}) }))
    return { schema: 1, assessment: "typescript-semantic-v1", bounded: true, passed: result.passed, diagnosticCount: result.diagnostics.length, diagnostics }
  }
}

/** Production composition: the assessment path has no local or host-process
 * execution fallback. Each run receives the existing durable hosted runner
 * scheduler with its authorization callback bound to the assessment fence. */
export function hostedIsolatedAssessmentWorker(products: PostgresProductDomainStore, applicationRoot: string, pool: Pool, hosts: readonly HostedRunnerHost[]) {
  return new IsolatedAssessmentWorker(products, applicationRoot, authorized => new HostedLinuxRunnerProvider(new PostgresLeaseStore(pool), hosts, authorized))
}
