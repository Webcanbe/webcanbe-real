import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { DurableSource } from "../mutations/durableSource"
import { MutationHistory } from "../mutations/sourceMutations"
import { detectProject, type ProjectRecord } from "./projectRegistry"
import type { ProjectGrant } from "./hostedAuthority"
import { PostgresProjectStore, type HostedSourceState } from "./postgresStores"

/** Adapter for the synchronous Phase 2 source/analysis/compiler interfaces.
 * Each operation reads an authorized durable revision, uses a fresh private
 * checkout, and CAS-commits real files + the existing ledger back to PostgreSQL.
 * Never share a materialization across tenants or use it as durable authority. */
export async function withHostedSource<T>(backend: PostgresProjectStore, grant: ProjectGrant, applicationRoot: string, action: (project: ProjectRecord, source: DurableSource) => Promise<T>, write = false): Promise<{ value: T; state: HostedSourceState }> {
  const state = await backend.read(grant)
  const job = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "wcb-source-checkout-"))), root = path.join(job, "project"), historyRoot = path.join(job, "history")
  fs.mkdirSync(root, { mode: 0o700 })
  try {
    for (const [name, bytes] of state.files) {
      const file = path.join(root, name)
      fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 }); fs.writeFileSync(file, bytes, { flag: "wx", mode: 0o600 })
    }
    const project: ProjectRecord = { id: grant.projectId, name: "Hosted project", root, sourceRoot: path.join(root, "src"), imported: true, detection: detectProject(root, applicationRoot), history: new MutationHistory() }
    fs.mkdirSync(path.join(historyRoot, project.id), { recursive: true, mode: 0o700 }); fs.writeFileSync(path.join(historyRoot, project.id, "history.json"), JSON.stringify(state.history), { mode: 0o600 })
    const source = new DurableSource(project, historyRoot), value = await action(project, source)
    let acceptedEpoch = state.epoch
    if (write && (source.revision() !== state.revision || JSON.stringify(source.history()) !== JSON.stringify(state.history))) {
      const files = new Map(state.files)
      for (const file of files.keys()) if (/^src\/.+\.(?:tsx?|jsx?|css|json)$/.test(file)) files.delete(file)
      for (const [file, text] of source.files()) files.set(file, Buffer.from(text))
      acceptedEpoch = (await backend.accept(grant, { revision: state.revision, epoch: state.epoch }, files, source.history())).epoch
    }
    // Reauthorization and exact current state after all asynchronous work.
    const current = await backend.read(grant)
    if (current.epoch !== acceptedEpoch || current.revision !== source.revision()) throw new Error("Hosted source changed during this operation; retry against current history.")
    return { value, state: current }
  } finally { fs.rmSync(job, { recursive: true, force: true }) }
}
