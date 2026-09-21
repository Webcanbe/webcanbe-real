import { createHash } from "node:crypto"
import type { FileOperation, MutationTransaction } from "../core/types"
const contentHash = (value: string) => createHash("sha256").update(value).digest("hex")

/** Shared conservative inverse: never overwrite later edits to an affected file. */
export function historyInverse(ledger: {past: string[]; future: string[]}, entries: MutationTransaction[], current: Map<string,string>, id?: string, redo = false) {
    const transactionId = id ?? (redo ? ledger.future.at(-1) : ledger.past.at(-1))
    if (!transactionId || !(redo ? ledger.future : ledger.past).includes(transactionId)) throw new Error(`Nothing safe to ${redo ? "redo" : "revert"}.`)
    const entry = entries.find(item => item.id === transactionId)!
    const operations: FileOperation[] = []
    for (const patch of entry.fileStates ?? []) {
      const version = entry.versions?.[patch.file]
      if (!version) throw new Error("Transaction has no safe inverse.")
      const expected = redo ? version.before : version.after
      const actual = current.get(patch.file)
      if ((actual === undefined ? "absent" : contentHash(actual)) !== expected) throw new Error(`Revert conflicts with later work in ${patch.file}.`)
      const desired = (redo ? patch.after : patch.before) ?? ""
      const desiredHash = redo ? version.after : version.before
      operations.push(desiredHash === "absent" ? { kind: "delete", file: patch.file, expectedHash: contentHash(actual!) } : actual === undefined ? { kind: "create", file: patch.file, expectedHash: null, content: desired } : { kind: "update", file: patch.file, expectedHash: contentHash(actual), content: desired })
    }
    return { operations, transactionId }
}
