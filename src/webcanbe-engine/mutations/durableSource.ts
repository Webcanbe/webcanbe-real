import { compactHistory, historyParts, historyTransactions, historyRevisions } from "./historyArchive"
import fs from "node:fs"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"
import { createHash, randomUUID } from "node:crypto"
import type { FileOperation, MutationTransaction, RevisionLedger, SourcePatch, SourceValidation } from "../core/types"
import type { ProjectRecord } from "../runtime/projectRegistry"
import { safeArchivePath } from "../runtime/projectRegistry"

export const editableSource = /^src\/.+\.(?:tsx?|jsx?|mts|cts|mjs|cjs|css|json)$/
export const legacyEditableSource = /^src\/.+\.(?:tsx?|jsx?|css|json)$/
export const contentHash = (value: string) => createHash("sha256").update(value).digest("hex")
export const treeHash = (files: Map<string, string>) => contentHash(JSON.stringify([...files].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))))
type Change = { file: string; before: string | null; after: string | null }
type Journal = { schema: 1; projectId: string; transactionId: string; changes: Change[]; next: RevisionLedger }
export class SourceConflict extends Error {}
export const HISTORY_LIMITS = Object.freeze({ bytes: 64 * 1024 * 1024, transactions: 1000, revisions: 1001, journalBytes: 160 * 1024 * 1024 })
const historyFull = () => new SourceConflict("Project history capacity reached. Source is unchanged; export and operator-managed history archival are required before more edits.")
function readHistoryFile(file: string, limit = HISTORY_LIMITS.bytes) {
  if (fs.statSync(file).size > limit) throw historyFull()
  return JSON.parse(fs.readFileSync(file, "utf8"))
}
export function boundedHistory(ledger: RevisionLedger) {
  const origin = ledger.importOrigin
  if (origin !== undefined && (!origin || typeof origin !== "object" || Object.keys(origin).length !== 4 || origin.provider !== "github" || typeof origin.repository !== "string" || !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(origin.repository) || !/^[a-f0-9]{40}$/.test(origin.commit) || !/^[a-f0-9]{64}$/.test(origin.archiveSha256))) throw new Error("Invalid immutable import provenance.")
  if(ledger.sourceScope!==undefined&&ledger.sourceScope!==2)throw new Error("Unsupported source scope version.")
  if (ledger.transactions.length > HISTORY_LIMITS.transactions || ledger.revisions.length > HISTORY_LIMITS.revisions) throw historyFull()
  const text = JSON.stringify(ledger)
  if (Buffer.byteLength(text) > HISTORY_LIMITS.bytes) throw historyFull()
  historyParts(ledger)
  return text
}

function syncDirectory(directory: string) { const fd = fs.openSync(directory, "r"); try { fs.fsyncSync(fd) } finally { fs.closeSync(fd) } }
function ensureDirectory(directory: string) {
  const missing: string[] = []
  for (let current = directory; !fs.existsSync(current); current = path.dirname(current)) missing.push(current)
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
  for (const created of missing) { syncDirectory(created); syncDirectory(path.dirname(created)) }
}
function atomicFile(file: string, content: string) {
  const temporary = path.join(path.dirname(file), `.wcb-transaction-${randomUUID()}.tmp`)
  try {
    const fd = fs.openSync(temporary, "wx", 0o600)
    try { fs.writeFileSync(fd, content); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
    fs.renameSync(temporary, file); syncDirectory(path.dirname(file))
  } finally { fs.rmSync(temporary, { force: true }) }
}

/** Private local source authority. The JSON ledger is the durable form of the
 * existing MutationTransaction/history, not an alternative canvas document.
 * The fsynced journal precedes source writes; ledger rename is the commit point.
 * Recovery completes before source is admitted to any compiler or session.
 */
export class DurableSource {
  private ledger!: RevisionLedger
  private readonly directory: string
  private readonly statePath: string
  private readonly journalPath: string
  private poisoned = false
  private held = false
  constructor(private project: ProjectRecord, storageRoot: string, private options: { disposableStaging?: boolean; actor?: string } = {}) {
    this.directory = path.join(storageRoot, project.id)
    ensureDirectory(this.directory)
    this.statePath = path.join(this.directory, "history.json")
    this.journalPath = path.join(this.directory, "pending.json")
    const release = this.lease()
    try {
      this.ledger = fs.existsSync(this.statePath) ? readHistoryFile(this.statePath) : { schema: 1, sourceScope: 2, projectId: project.id, revisions: [], transactions: [], past: [], future: [] }
      if (this.ledger.schema !== 1 || this.ledger.projectId !== project.id || !Array.isArray(this.ledger.revisions) || !Array.isArray(this.ledger.transactions)) throw new Error("Invalid project history. Recovery requires operator review.")
      boundedHistory(this.ledger)
      this.recover()
      if (!this.ledger.revisions.length) {
        this.ledger.revisions.push({ revisionId: `rev_${randomUUID()}`, projectId: project.id, parentRevisionId: null, createdAt: new Date().toISOString(), actor: this.options.actor ?? "local-operator", producer: "system", contentHash: treeHash(this.files()) })
        atomicFile(this.statePath, boundedHistory(this.ledger))
      }
      this.hydrate()
    } finally { release() }
  }
  /** SQLite's per-project RESERVED lock is kernel-released on process death.
   * This avoids PID files, stale-lock deletion races and two-server writers. */
  lease() {
    if (this.held) throw new SourceConflict("A project operation is already in progress.")
    // A private hosted checkout is disposable transaction staging, never an
    // authority or commit point. PostgreSQL supplies all hosted locks and CAS.
    if (this.options.disposableStaging) {
      this.held = true
      if (this.ledger) { this.reload(); this.recover(); this.hydrate() }
      return () => { this.held = false }
    }
    const database = new DatabaseSync(path.join(this.directory, "writer.sqlite"))
    try { database.exec("PRAGMA busy_timeout=1000; BEGIN IMMEDIATE") }
    catch { database.close(); throw new SourceConflict("Another server owns this project operation. Retry after it completes.") }
    this.held = true
    const release = () => { try { database.exec("ROLLBACK") } finally { this.held = false; database.close() } }
    try {
      // A peer server may have died since this instance was initialized.
      // Recover its journal before any source read in the next API operation.
      if (this.ledger) { this.reload(); this.recover(); this.hydrate() }
    } catch (error) { release(); throw error }
    return release
  }
  private withLease<T>(operation: () => T): T {
    if (this.held) return operation()
    const release = this.lease()
    try { return operation() } finally { release() }
  }
  private reload() {
    if (fs.existsSync(this.statePath)) this.ledger = readHistoryFile(this.statePath)
    this.hydrate()
  }

  private hydrate() { this.project.history.hydrate(historyTransactions(this.ledger), this.ledger.past, this.ledger.future) }
  private assertReady() { if (this.poisoned) throw new Error("Source recovery is required. Restart before reopening this project.") }
  head() { this.assertReady(); this.reload(); return this.ledger.revisions.at(-1)! }
  history() { this.assertReady(); this.reload(); return structuredClone(this.ledger) }

  /** Every segment is checked, including the root. No symlink traversal, hard
   * links, normalization aliases or caller-selected root is accepted. */
  private target(file: string, allowAbsent = false, scope=this.ledger?.sourceScope) {
    if (!(scope===2?editableSource:legacyEditableSource).test(file) || safeArchivePath(file) !== file) throw new Error("File operation is outside the editable source scope.")
    if (fs.realpathSync(this.project.root) !== this.project.root || fs.lstatSync(this.project.sourceRoot).isSymbolicLink() || fs.realpathSync(this.project.sourceRoot) !== path.join(this.project.root, "src")) throw new Error("Source root identity changed.")
    let current = this.project.root
    const parts = file.split("/")
    for (let index = 0; index < parts.length; index++) {
      current = path.join(current, parts[index])
      if (!fs.existsSync(current)) {
        // Dangling links also count as occupied paths.
        try { fs.lstatSync(current); throw new Error("Source path is a link.") } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error }
        if (!allowAbsent) throw new Error("Source file is unavailable.")
        continue
      }
      const stat = fs.lstatSync(current)
      if (stat.isSymbolicLink() || (index < parts.length - 1 ? !stat.isDirectory() : !stat.isFile() || stat.nlink !== 1)) throw new Error("Source path is a link or changed identity.")
    }
    return current
  }
  files(scope=this.ledger?.sourceScope) {
    this.assertReady()
    const files = new Map<string, string>()
    for (const entry of fs.readdirSync(this.project.sourceRoot, { recursive: true })) {
      if (typeof entry !== "string") continue
      const file = `src/${entry.split(path.sep).join("/")}`
      if ((scope===2?editableSource:legacyEditableSource).test(file)) files.set(file, fs.readFileSync(this.target(file,false,scope), "utf8"))
    }
    return files
  }
  revision() {
    const hash = treeHash(this.files()), head = this.head()
    // An outside edit invalidates all anchors but is never silently adopted.
    return hash === head.contentHash ? head.revisionId : `external_${hash}`
  }
  assertBase(expected: unknown) {
    if (typeof expected !== "string" || expected !== this.revision() || expected !== this.head().revisionId) throw new SourceConflict("Source changed. Reload accepted source; an outside filesystem edit needs operator reconciliation.")
  }
  retry(key: string, requestHash: string) {
    this.reload()
    const entry = historyTransactions(this.ledger).find(item => item.idempotencyKey === key)
    if (entry && entry.requestHash !== requestHash) throw new SourceConflict("Idempotency key was already used for a different request.")
    return entry && structuredClone(entry)
  }
  prepare(operations: FileOperation[]) {
    if (!Array.isArray(operations) || !operations.length || operations.length > 100) throw new Error("Provide 1–100 source file operations.")
    const before = this.files(), after = new Map(before), touched = new Set<string>()
    const touch = (file: string) => { this.target(file, true); if (touched.has(file)) throw new Error("Conflicting operations for the same path."); touched.add(file) }
    for (const op of operations) {
      if (!op || typeof op.file !== "string") throw new Error("Invalid file operation.")
      touch(op.file)
      const old = before.get(op.file)
      if (op.kind === "create") {
        if (op.expectedHash !== null || old !== undefined || fs.existsSync(path.join(this.project.root, op.file))) throw new SourceConflict("Create target already exists.")
      } else if (old === undefined || typeof op.expectedHash !== "string" || contentHash(old) !== op.expectedHash) throw new SourceConflict("Expected source hash does not match.")
      if (op.kind === "update" || op.kind === "create") after.set(op.file, op.content)
      else if (op.kind === "delete") after.delete(op.file)
      else if (op.kind === "rename") {
        if (typeof op.to !== "string") throw new Error("Rename destination is required.")
        touch(op.to)
        if (before.has(op.to) || fs.existsSync(path.join(this.project.root, op.to))) throw new SourceConflict("Rename destination exists.")
        after.delete(op.file); after.set(op.to, op.content ?? old!)
      } else throw new Error("Unknown file operation.")
    }
    const lower = new Set<string>()
    let bytes = 0
    for (const [file, content] of after) {
      if (typeof content !== "string" || content.includes("\0") || Buffer.byteLength(content) > 2 * 1024 * 1024 || Buffer.from(content).toString("utf8") !== content) throw new Error("Invalid UTF-8 source or file size.")
      bytes += Buffer.byteLength(content)
      const key = file.toLowerCase()
      if (lower.has(key) || [...lower].some(other => other.startsWith(key + "/") || key.startsWith(other + "/"))) throw new Error("Case-insensitive or file/directory path conflict.")
      lower.add(key)
    }
    let entries = after.size
    for (const item of fs.readdirSync(this.project.root, { recursive: true, withFileTypes: true })) {
      if (item.isSymbolicLink()) throw new Error("Project contains an unsupported link.")
      if (!item.isFile()) continue
      const absolute = path.join(item.parentPath, item.name), file = path.relative(this.project.root, absolute).split(path.sep).join("/")
      if (!before.has(file)) { bytes += fs.statSync(absolute).size; ++entries }
    }
    if (bytes > 40 * 1024 * 1024 || entries > 2000) throw new Error("Project source and asset limit exceeded.")
    const changes = [...touched].map(file => ({ file, before: before.get(file) ?? null, after: after.get(file) ?? null })).filter(item => item.before !== item.after)
    if (!changes.length) throw new Error("There are no source changes to save.")
    return { before, after, changes }
  }
  restoreOperations(revisionId: string) {
    this.reload()
    const revisions = historyRevisions(this.ledger), index = revisions.findIndex(item => item.revisionId === revisionId)
    if (index < 0) throw new SourceConflict("Restore checkpoint is unavailable.")
    const transactions = new Map(historyTransactions(this.ledger).map(entry => [entry.id, entry])), current = this.files(), desired = new Map(current)
    for (const revision of revisions.slice(index + 1).reverse()) {
      const entry = transactions.get(revision.transactionId ?? "")
      if (!entry || !entry.fileStates || entry.status !== "accepted") throw new SourceConflict("Restore requires complete accepted file evidence.")
      for (const file of entry.fileStates) {
        if ((desired.get(file.file) ?? null) !== file.after) throw new SourceConflict("Restore conflicts with source evidence.")
        if (file.before === null) desired.delete(file.file); else desired.set(file.file, file.before)
      }
    }
    if (treeHash(desired) !== revisions[index].contentHash) throw new SourceConflict("Restore digest or source-scope epoch differs; reconcile in Code.")
    const operations: FileOperation[] = []
    for (const file of new Set([...current.keys(), ...desired.keys()])) {
      const before = current.get(file), after = desired.get(file)
      if (before === after) continue
      operations.push(after === undefined ? {kind:"delete",file,expectedHash:contentHash(before!)} : before === undefined ? {kind:"create",file,expectedHash:null,content:after} : {kind:"update",file,expectedHash:contentHash(before),content:after})
    }
    if (!operations.length) throw new SourceConflict("Checkpoint already has the current source bytes.")
    this.prepare(operations) // preserve the ordinary 100-file mutation and byte bounds
    return operations
  }
  /** Conservative selective revert: unaffected files survive; a later change in
   * any affected file conflicts. Never restore a project-wide old snapshot. */
  revertOperations(id?: string, redo = false) {
    this.reload()
    const transactionId = id ?? (redo ? this.ledger.future.at(-1) : this.ledger.past.at(-1))
    if (!transactionId || !(redo ? this.ledger.future : this.ledger.past).includes(transactionId)) throw new SourceConflict(`Nothing safe to ${redo ? "redo" : "revert"}.`)
    const entry = historyTransactions(this.ledger).find(item => item.id === transactionId)!
    const current = this.files(), operations: FileOperation[] = []
    for (const patch of entry.fileStates ?? []) {
      const version = entry.versions?.[patch.file]
      if (!version) throw new SourceConflict("Transaction has no safe inverse.")
      const expected = redo ? version.before : version.after
      const actual = current.get(patch.file)
      if ((actual === undefined ? "absent" : contentHash(actual)) !== expected) throw new SourceConflict(`Revert conflicts with later work in ${patch.file}.`)
      const desired = (redo ? patch.after : patch.before) ?? ""
      const desiredHash = redo ? version.after : version.before
      operations.push(desiredHash === "absent" ? { kind: "delete", file: patch.file, expectedHash: contentHash(actual!) } : actual === undefined ? { kind: "create", file: patch.file, expectedHash: null, content: desired } : { kind: "update", file: patch.file, expectedHash: contentHash(actual), content: desired })
    }
    return { operations, transactionId }
  }
  private writeChanges(changes: Change[], direction: "before" | "after", fault?: (index: number) => void) {
    // Validate the entire recovery set before changing any bytes.
    for (const change of changes) {
      const target = this.target(change.file, true), current = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : null
      if (current !== change.before && current !== change.after) throw new SourceConflict("Recovery found unrelated source changes; project is quarantined.")
    }
    for (const [index, change] of changes.entries()) {
      const target = this.target(change.file, true), desired = change[direction]
      if (desired === null) { fs.rmSync(target, { force: true }); if (fs.existsSync(path.dirname(target))) syncDirectory(path.dirname(target)) }
      else { ensureDirectory(path.dirname(target)); this.target(change.file, true); atomicFile(target, desired) }
      fault?.(index)
    }
  }
  private recover() {
    if (!fs.existsSync(this.journalPath)) return
    const journal: Journal = readHistoryFile(this.journalPath, HISTORY_LIMITS.journalBytes)
    if (journal.schema !== 1 || journal.projectId !== this.project.id || journal.next.projectId !== this.project.id) throw new Error("Invalid source recovery journal.")
    const committed = this.ledger.transactions.some(item => item.id === journal.transactionId && item.status === "accepted")
    this.writeChanges(journal.changes, committed ? "after" : "before")
    fs.unlinkSync(this.journalPath); syncDirectory(this.directory)
    for (const directory of new Set([this.directory, ...journal.changes.map(change => path.dirname(path.join(this.project.root, change.file)))])) {
      if (!fs.existsSync(directory)) continue
      for (const file of fs.readdirSync(directory)) if (/^\.wcb-transaction-[a-f0-9-]+\.tmp$/.test(file)) fs.unlinkSync(path.join(directory, file))
    }
  }
  reject(entry: MutationTransaction) {
    return this.withLease(() => {
      this.assertReady(); this.reload()
      boundedHistory(this.ledger)
      if (this.ledger.transactions.length >= HISTORY_LIMITS.transactions) throw historyFull()
      const next = structuredClone(this.ledger); next.transactions.push(entry)
      atomicFile(this.statePath, boundedHistory(next)); this.ledger = next
    })
  }
  commit(input: { expectedRevision: string; operations: FileOperation[]; entry: MutationTransaction; authorize: () => void; reverts?: string; redo?: boolean; checkpoint?: boolean; migrateSourceScope?: boolean; compactHistory?: boolean; fault?: (phase: string, index?: number) => void }) {
    return this.withLease(() => {
      this.assertBase(input.expectedRevision); input.authorize()
      boundedHistory(this.ledger)
      if (!input.compactHistory && (this.ledger.transactions.length >= HISTORY_LIMITS.transactions || this.ledger.revisions.length >= HISTORY_LIMITS.revisions)) throw historyFull()
      if(input.migrateSourceScope&&(!input.checkpoint||this.ledger.sourceScope===2||input.operations.length))throw new SourceConflict("Source scope migration requires a legacy checkpoint.")
      if (input.compactHistory && (!input.checkpoint || input.migrateSourceScope || input.operations.length)) throw new SourceConflict("Compaction requires a separate unchanged-source checkpoint.")
      const prepared = input.checkpoint ? { before: this.files(), after: this.files(input.migrateSourceScope?2:this.ledger.sourceScope), changes: [] } : this.prepare(input.operations)
      const { changes, after } = prepared, entry = structuredClone(input.entry)
      const next = input.compactHistory ? compactHistory(this.ledger) : structuredClone(this.ledger), parent = this.head()
      if(input.migrateSourceScope)next.sourceScope=2
      entry.baseRevisionId = parent.revisionId; entry.newRevisionId = `rev_${randomUUID()}`; entry.status = "accepted"; entry.success = true
      entry.operations = input.operations
      entry.versions = Object.fromEntries(changes.map(change => [change.file, { before: change.before === null ? "absent" : contentHash(change.before), after: change.after === null ? "absent" : contentHash(change.after) }]))
      // Full affected-file before/after patches retain a conflict-safe inverse.
      // This is source evidence, never a project snapshot restore operation.
      entry.fileStates = changes
      if (!entry.patches.length) entry.patches = changes.map(change => ({ file: change.file, range: { start: 0, end: change.before?.length ?? 0 }, before: change.before ?? "", after: change.after ?? "" }))
      entry.file ||= changes[0]?.file ?? ""
      next.transactions.push(entry)
      next.revisions.push({ revisionId: entry.newRevisionId, parentRevisionId: parent.revisionId, projectId: this.project.id, createdAt: entry.timestamp, producer: entry.producer!, actor: entry.actor!, contentHash: treeHash(after), transactionId: entry.id })
      if (input.reverts) {
        entry.reverts = input.reverts
        if (input.redo) { next.future = next.future.filter(id => id !== input.reverts); next.past.push(input.reverts) }
        else { next.past = next.past.filter(id => id !== input.reverts); next.future.push(input.reverts) }
      } else if (!input.checkpoint) { next.past.push(entry.id); next.future = [] }
      boundedHistory(next) // quota before journaling or changing canonical source
      const journal: Journal = { schema: 1, projectId: this.project.id, transactionId: entry.id, changes, next }
      // Recheck authority, revision, and file identities after all validation.
      input.authorize(); this.assertBase(input.expectedRevision)
      const journalText = JSON.stringify(journal)
      if (Buffer.byteLength(journalText) > HISTORY_LIMITS.journalBytes) throw historyFull()
      atomicFile(this.journalPath, journalText)
      try {
        input.fault?.("journal")
        this.writeChanges(changes, "after", index => input.fault?.("write", index))
        input.authorize()
        if (treeHash(this.files(next.sourceScope)) !== treeHash(after)) throw new SourceConflict("Source changed during commit.")
        atomicFile(this.statePath, boundedHistory(next))
        this.ledger = next; this.hydrate()
        input.fault?.("committed")
        fs.unlinkSync(this.journalPath); syncDirectory(this.directory)
        return entry
      } catch (error) {
        // The disk ledger decides whether a commit succeeded, including failures
        // after rename/fsync. A retry with the same key returns that result.
        try {
          this.ledger = readHistoryFile(this.statePath)
          this.recover(); this.hydrate()
          const accepted = historyTransactions(this.ledger).find(item => item.id === entry.id)
          if (accepted) return accepted
        } catch { this.poisoned = true; throw new Error("Source recovery failed; project quarantined until restart/operator recovery.") }
        throw error
      }
    })
  }
}

export function transactionEntry(projectId: string, baseRevisionId: string, producer: "visual" | "code" | "system", idempotencyKey: string, requestHash: string, summary: string, validation: SourceValidation, patch?: MutationTransaction): MutationTransaction {
  const patches: SourcePatch[] = patch?.patches ?? []
  return { ...patch, id: `wcb_${randomUUID()}`, timestamp: new Date().toISOString(), file: patch?.file ?? "", range: patch?.range ?? { start: 0, end: 0 }, before: patch?.before ?? "", after: patch?.after ?? "", target: patch?.target ?? { file: "", elementStart: 0 }, patches, editType: patch?.editType ?? (producer === "code" ? "code" : "checkpoint"), projectId, baseRevisionId, actor: "local-operator", producer, idempotencyKey, requestHash, summary: summary.slice(0, 200), validation, success: validation.passed, status: validation.passed ? "accepted" : "rejected", error: validation.passed ? undefined : validation.diagnostics.map(item => `${item.file}: ${item.message}`).join("\n") }
}
