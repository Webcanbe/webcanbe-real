import { isDeepStrictEqual } from "node:util"
import { createHash } from "node:crypto"
import { gzipSync, gunzipSync } from "node:zlib"
import type { HistoryArchive, MutationTransaction, RevisionLedger, SourceRevision } from "../core/types"
const LIMIT = 64 * 1024 * 1024
const cache = new Map<string, { encoded: string; value: ArchiveData; bytes: number }>()
type ArchiveData = { schema: 1; projectId: string; revisions: SourceRevision[]; transactions: MutationTransaction[] }
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")
export function decodeHistoryArchive(archive: HistoryArchive, projectId: string): ArchiveData {
  if (!archive || archive.schema !== 1 || typeof archive.data !== "string" || archive.data.length > LIMIT || !/^[A-Za-z0-9+/]+={0,2}$/.test(archive.data) || !/^[a-f0-9]{64}$/.test(archive.digest) || !Number.isInteger(archive.rawBytes) || archive.rawBytes < 1 || archive.rawBytes > LIMIT) throw new Error("Invalid history archive.")
  const hit = cache.get(archive.digest)
  let value: ArchiveData
  if (hit?.encoded === archive.data) { if (hit.bytes !== archive.rawBytes) throw new Error("History archive expansion mismatch."); value = hit.value }
  else {
    const compressed = Buffer.from(archive.data, "base64")
    if (compressed.toString("base64") !== archive.data || digest(compressed) !== archive.digest) throw new Error("History archive integrity failed.")
    const raw = gunzipSync(compressed, { maxOutputLength: LIMIT })
    if (raw.length !== archive.rawBytes) throw new Error("History archive expansion mismatch.")
    value = JSON.parse(raw.toString("utf8"))
    if (!value || value.schema !== 1 || !Array.isArray(value.transactions) || value.transactions.length > 1000 || !Array.isArray(value.revisions) || !value.revisions.length || value.revisions.length > 1001) throw new Error("Invalid history archive payload.")
    while (cache.size && [...cache.values()].reduce((n, item) => n + item.bytes, raw.length) > LIMIT) cache.delete(cache.keys().next().value!)
    cache.set(archive.digest, { encoded: archive.data, value, bytes: raw.length })
  }
  if (value.projectId !== projectId || value.transactions.length !== archive.transactions || value.revisions.length !== archive.revisions) throw new Error("History archive scope mismatch.")
  return structuredClone(value)
}
export function historyParts(ledger: RevisionLedger) {
  if (ledger.archives !== undefined && (!Array.isArray(ledger.archives) || ledger.archives.length > 4)) throw new Error("History archive capacity reached.")
  const parts = (ledger.archives ?? []).map(archive => decodeHistoryArchive(archive, ledger.projectId))
  const activeBytes = Buffer.byteLength(JSON.stringify({ ...ledger, archives: undefined }))
  if (activeBytes + (ledger.archives ?? []).reduce((n, a) => n + a.rawBytes, 0) > LIMIT) throw new Error("History retention byte quota reached.")
  if (parts.length) {
    const revisions = [...parts.flatMap(part => part.revisions), ...ledger.revisions], ids = new Set<string>()
    for (const [index, revision] of revisions.entries()) {
      if (!revision || revision.projectId !== ledger.projectId || ids.has(revision.revisionId) || revision.parentRevisionId !== (index ? revisions[index-1].revisionId : null)) throw new Error("Archived history ancestry conflict.")
      ids.add(revision.revisionId)
    }
    const transactions = [...parts.flatMap(part => part.transactions), ...ledger.transactions], transactionIds = new Set(transactions.map(t => t.id))
    if (transactionIds.size !== transactions.length || [...ledger.past,...ledger.future].some(id => !transactionIds.has(id))) throw new Error("Archived transaction index conflict.")
  }
  return parts
}
export function compactHistory(ledger: RevisionLedger): RevisionLedger {
  historyParts(ledger)
  if (!ledger.transactions.length || ledger.revisions.length < 2 || (ledger.archives?.length ?? 0) >= 4) throw new Error("No eligible history window or archive capacity available.")
  const payload: ArchiveData = { schema: 1, projectId: ledger.projectId, revisions: ledger.revisions.slice(0,-1), transactions: ledger.transactions }
  const raw = Buffer.from(JSON.stringify(payload)), compressed = gzipSync(raw, { level: 1 })
  const archive: HistoryArchive = { schema: 1, digest: digest(compressed), rawBytes: raw.length, revisions: payload.revisions.length, transactions: payload.transactions.length, data: compressed.toString("base64") }
  return { ...structuredClone(ledger), archives: [...(ledger.archives ?? []), archive], revisions: ledger.revisions.slice(-1), transactions: [] }
}
export function historyTransactions(ledger: RevisionLedger) { return [...historyParts(ledger).flatMap(part => part.transactions), ...ledger.transactions] }
export function historyRevisions(ledger: RevisionLedger) { return [...historyParts(ledger).flatMap(part => part.revisions), ...ledger.revisions] }
/** Compare expanded immutable ancestry; compaction cannot replace old receipts. */
export function preservesHistory(previous: RevisionLedger, next: RevisionLedger) {
  return isDeepStrictEqual(historyRevisions(previous), historyRevisions(next).slice(0,-1)) && isDeepStrictEqual(historyTransactions(previous), historyTransactions(next).slice(0,-1))
}

export function appendsCompaction(previous: RevisionLedger, next: RevisionLedger) {
  if ((next.archives?.length ?? 0) !== (previous.archives?.length ?? 0) + 1 || !isDeepStrictEqual(next.archives?.slice(0,-1) ?? [], previous.archives ?? []) || next.transactions.length !== 1 || next.revisions.length !== 2) return false
  const data = decodeHistoryArchive(next.archives!.at(-1)!, previous.projectId)
  return isDeepStrictEqual(data.transactions, previous.transactions) && isDeepStrictEqual(data.revisions, previous.revisions.slice(0,-1)) && isDeepStrictEqual(next.revisions[0],previous.revisions.at(-1))
}
