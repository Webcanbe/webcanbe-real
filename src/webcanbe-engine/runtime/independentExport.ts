import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID, createHash } from 'node:crypto'
import { extractSafeZip, detectProject, type ProjectRecord } from './projectRegistry'
import { MutationHistory } from '../mutations/sourceMutations'
import { inspectRuntime } from './runtimeCompatibility'
import { buildIsolatedHttpPreview } from './isolatedPreview'

let active = 0

/** Independent gate: consumes the actual exact-source export in a fresh checkout.
 * No live registry/history/preview state, uploaded config execution, package scripts,
 * project node_modules or host dependency fallback. Artifacts contain no bridge.
 */
export async function buildIndependentExport(archive: Buffer, applicationRoot: string, runtimeValues: Record<string,string> = {}) {
  if (active >= 2) throw Error('Independent export capacity reached.')
  active++
  let job: string | undefined
  try {
    job = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'wcb-independent-export-')))
    const root = path.join(job, 'project')
    await extractSafeZip(Buffer.from(archive), root)
    const detection = detectProject(root, applicationRoot)
    if (!detection.supported || !detection.sourceDirectory) throw Error('Export source root is not statically supported.')
    const project: ProjectRecord = { id: randomUUID(), name: 'Independent source export', root, sourceRoot: path.join(root, detection.sourceDirectory), imported: true, detection, history: new MutationHistory() }
    const digest = () => {
      const hash = createHash('sha256')
      for (const entry of fs.readdirSync(root, { recursive: true, withFileTypes: true }).filter(e => e.isFile()).map(e => path.relative(root, path.join(e.parentPath, e.name))).sort()) hash.update(JSON.stringify([entry, fs.readFileSync(path.join(root, entry)).toString('base64')]))
      return hash.digest('hex')
    }
    const before = digest(), report = inspectRuntime(project, applicationRoot, runtimeValues)
    const artifact = await buildIsolatedHttpPreview(project, applicationRoot, undefined, runtimeValues, true)
    if (digest() !== before) throw Error('Independent build changed canonical export bytes.')
    return { ...artifact, base: report.base, profile: report.profile, plan: report.exportBuild ?? { external: [], output: {} }, sourceUnchanged: true as const }
  } finally { active--; if (job) fs.rmSync(job, { recursive: true, force: true }) }
}
