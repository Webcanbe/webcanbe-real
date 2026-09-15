import { buildIndependentExport } from "./independentExport"
import { sourceDirectory } from "./sourceDirectory"
import { decodeHistoryArchive } from "../mutations/historyArchive"
import { rewriteRenameImports } from "../mutations/sourceReferences"
import { inspectRuntime } from "./runtimeCompatibility"
import fs from "node:fs"
import path from "node:path"
import { analyzeProjectStyles, viewportWidths } from "../adapters/react/projectStyles"
import { summarizeCompatibility } from "../core/compatibility"
import type { SourceValidation, FileOperation, SourceIdentity, StyleProperty, ViewportPreset } from "../core/types"
import { formatTransactionDiff, patchProjectStyle, patchSiblingReorder, patchResponsiveConstruct, patchText, type SourceStore } from "../mutations/sourceMutations"
import { contentHash, SourceConflict, transactionEntry } from "../mutations/durableSource"
import { validateSource, validateStagedProject } from "../mutations/sourceValidation"
import type { ProjectRecord, SessionOperation } from "./projectRegistry"
import type { ProjectPersistence } from "./storageContracts"
import { exportProjectZip } from "./projectExport"

export type SourceResponse = { status: number; value: Record<string, unknown> }
/** Shared Code/Canvas/history/export semantics. A hosted caller supplies a private
 * disposable staging checkout and MUST durably accept it before emitting this
 * response. `authorize` protects local synchronous writes only; hosted authority
 * is awaited by assertAccess and by the PostgreSQL acceptance transaction. */
export async function executeSourceOperation(context: {
  project: ProjectRecord; projectRoot: string; durable: ProjectPersistence; store: SourceStore;
  action: SessionOperation; body: Record<string, unknown>; actor: string;
  assertAccess: () => void | Promise<void>; authorize: () => void;
  semanticCheck?: (files: Map<string,string>, revision: string) => Promise<SourceValidation>;
  beforeCommit: (structural: boolean) => void | Promise<void>;
}): Promise<SourceResponse> {
  const { project, projectRoot, durable, store, action, body, actor, assertAccess, authorize, beforeCommit } = context
  const revision = durable.revision()
  const send = (status: number, value: Record<string, unknown>): SourceResponse => ({ status, value })
          const styleFiles = () => { const files = durable.files(); for (const file of ["tailwind.config.js", "tailwind.config.ts", "tailwind.config.cjs"]) { if (fs.existsSync(path.join(project.root, file))) files.set(file, fs.readFileSync(path.join(project.root,file),"utf8")) } return files }
          const width = viewportWidths[body.viewport as ViewportPreset] ?? 1280
          let analysis: ReturnType<typeof analyzeProjectStyles> | undefined
          const styles = () => analysis ??= analyzeProjectStyles(styleFiles(), Boolean(store.tailwind), width)
          const targets = () => styles().targets.map(target => ({ ...target, identity: { ...target.identity, revisionId: revision, contentHash: contentHash(store.read(target.identity.file) ?? "") } }))
          if (["inspect", "source"].includes(action) && typeof body.expectedRevision === "string" && body.expectedRevision !== revision) return send(409, { error: "Selection belongs to stale source. Rebuild and select again." })
          if (action === "compatibility") { const analyzed = targets(); return send(200, { summary: summarizeCompatibility(analyzed), targets: analyzed, breakpoints: styles().breakpoints, styleDiagnostics: styles().diagnostics, revision }) }
          if (action === "files") {
            const files = durable.files()
            if (body.file !== undefined && (typeof body.file !== "string" || !files.has(body.file))) return send(404, { error: "Source file is unavailable." })
            return send(200, { files: [...files].map(([file, source]) => ({ file, hash: contentHash(source) })), source: typeof body.file === "string" ? files.get(body.file) : undefined, revision })
          }
          if (action === "history") {
            const history=durable.history()
            if(body.archiveId!==undefined){const archive=history.archives?.find(a=>a.digest===body.archiveId);return archive?send(200,{archivedHistory:decodeHistoryArchive(archive,project.id),revision}):send(404,{error:"History archive unavailable."})}
            if(body.restoreRevisionId!==undefined){if(typeof body.restoreRevisionId!=="string")return send(400,{error:"Select a checkpoint."});const operations=durable.restoreOperations(body.restoreRevisionId);return send(200,{revision,restorePreview:{baseRevision:revision,revisionId:body.restoreRevisionId,files:operations.map(op=>({file:op.file,kind:op.kind,expectedHash:op.expectedHash,afterHash:"content" in op&&op.content!==undefined?contentHash(op.content):null})),diff:operations.map(op=>`${op.kind} ${op.file}\n${"content" in op?op.content?.slice(0,4096)??"":"(deleted)"}`).join("\n\n"),truncatedPerFile:4096}})}
            return send(200, { history, revision })
          }
          if (action === "validate" && body.mode === "semantic") {
            durable.assertBase(body.expectedRevision)
            if(!context.semanticCheck)return send(422,{error:"An isolated semantic checker is required."})
            const files=body.operations===undefined||Array.isArray(body.operations)&&body.operations.length===0?durable.files():durable.prepare(body.operations as FileOperation[]).after
            const validation=await context.semanticCheck(files,revision)
            await assertAccess();durable.assertBase(revision)
            return send(200,{validation,revision,scope:sourceDirectory(project),toolchain:"typescript@5.9.3",sourceAccepted:false})
          }
          if (action === "validate") {
            if (typeof body.file !== "string" || typeof body.content !== "string" || !durable.files().has(body.file)) return send(400, { error: "Select an authorized source file." })
            return send(200, { validation: await validateSource(new Map([[body.file, body.content]])), revision })
          }
          if (action === "export") {
            durable.assertBase(body.expectedRevision ?? revision)
            const validation = await validateSource(durable.files(), "checkpoint")
            if (!validation.passed) return send(422, { error: "Export validation failed.", validation })
            const archive = await exportProjectZip(project)
            try { await buildIndependentExport(archive, projectRoot) }
            catch { return send(422, { error: "Independent export build failed.", validation: { ...validation, passed: false, diagnostics: [{ file: "project", message: "Unsupported or failed trusted independent export build." }] } }) }
            await assertAccess(); durable.assertBase(revision)
            return send(200, { archive: archive.toString("base64"), revision, validation, independentBuild: "PASS" })
          }
          if(body.migrateSourceScope!==undefined&&(action!=="checkpoint"||body.migrateSourceScope!==true))return send(400,{error:"Source scope migration requires an explicit checkpoint."})
          const special=[body.migrateSourceScope,body.compactHistory,body.restoreRevisionId].filter(value=>value!==undefined)
          if(special.length>1||body.compactHistory!==undefined&&(action!=="checkpoint"||body.compactHistory!==true)||body.restoreRevisionId!==undefined&&(action!=="checkpoint"||typeof body.restoreRevisionId!=="string"||body.restoreRevisionId.length>160))return send(400,{error:"Choose one bounded checkpoint action."})
          const mutating = ["mutate", "code", "undo", "redo", "revert", "checkpoint"].includes(action)
          // Old visual clients get a deterministic request identity. New clients
          // supply a UUID and retain it for transport retries.
          const requestHash = contentHash(JSON.stringify({ action, base: body.expectedRevision, identity: body.identity, edit: body.edit, operations: body.operations, transactionId: body.transactionId, rewriteImports: body.rewriteImports, migrateSourceScope: body.migrateSourceScope, compactHistory: body.compactHistory, restoreRevisionId: body.restoreRevisionId }))
          const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : `legacy_${requestHash}`
          if (mutating && (!/^[a-zA-Z0-9_-]{8,160}$/.test(idempotencyKey))) return send(400, { error: "A bounded idempotency key is required." })
          const result = (transaction: NonNullable<ReturnType<typeof durable.retry>>, replayed = false) => send(transaction.success ? 200 : 422, { transaction, replayed, validation: transaction.validation, error: transaction.error, diff: transaction.success ? formatTransactionDiff(transaction) : undefined, revision: durable.revision() })
          if (mutating) {
            const retried = durable.retry(idempotencyKey, requestHash)
            if (retried && actor && retried.actor !== actor) throw new SourceConflict("Idempotency key belongs to another actor.")
            if (retried) return result(retried, true)
            durable.assertBase(body.expectedRevision)
          }
          if (["code", "undo", "redo", "revert", "checkpoint"].includes(action)) {
            const inverse = ["undo", "redo", "revert"].includes(action) ? durable.revertOperations(typeof body.transactionId === "string" ? body.transactionId : undefined, action === "redo") : undefined
            const restoring=typeof body.restoreRevisionId==="string"
            let operations = restoring?durable.restoreOperations(body.restoreRevisionId as string):inverse?.operations ?? (action === "checkpoint" ? [] : body.operations as FileOperation[])
            if(action==="code"&&body.rewriteImports===true){
              durable.prepare(operations)
              const paths=new Set(fs.readdirSync(project.root,{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>path.relative(project.root,path.join(e.parentPath,e.name)).split(path.sep).join("/")))
              operations=rewriteRenameImports(durable.files(),operations,inspectRuntime(project,projectRoot).aliases,paths)
            }
            const staged = action === "checkpoint" && !restoring ? durable.files(body.migrateSourceScope===true?2:durable.history().sourceScope) : durable.prepare(operations).after
            const validation = await validateStagedProject(project, projectRoot, staged, action === "checkpoint" && !restoring ? "checkpoint" : "compile")
            const entry = transactionEntry(project.id, revision, action === "code" ? "code" : "system", idempotencyKey, requestHash, action === "code" ? `Code save: ${operations.map(op => op.file).join(", ")}` : `${action}: ${inverse?.transactionId ?? "validated source"}`, validation)
            entry.file = operations[0]?.file ?? ""
            entry.operations = operations
            if(body.migrateSourceScope===true)entry.summary="Enable module file editing: source scope v1 to v2; all bytes and prior history retained"
            if(body.compactHistory===true)entry.summary="Compact active history into a verified immutable archive; all audit and inverse evidence retained"
            if(restoring){entry.summary=`Restore source to ${body.restoreRevisionId}; ${operations.length} files; previous head remains undoable`;entry.restoresRevisionId=body.restoreRevisionId as string}
            entry.editType = restoring ? "revert" : action === "code" ? "code" : action === "checkpoint" ? "checkpoint" : action === "redo" ? "redo" : "revert"
            entry.actor = actor
            await assertAccess(); authorize(); durable.assertBase(revision)
            if (!validation.passed) { durable.reject(entry); return result(entry) }
            await beforeCommit(operations.some(op => op.kind !== "update")||body.migrateSourceScope===true)
            return result(durable.commit({ expectedRevision: revision, operations, entry, authorize, reverts: inverse?.transactionId, redo: action === "redo", checkpoint: action === "checkpoint" && !restoring, migrateSourceScope: body.migrateSourceScope===true, compactHistory: body.compactHistory===true }))
          }
          const identity = body.identity as SourceIdentity | undefined
          if (!identity || typeof identity.file !== "string" || !Number.isInteger(identity.elementStart) || identity.elementStart < 0) return send(400, { error: "Invalid source identity." })
          if ((identity.revisionId && identity.revisionId !== revision) || (identity.contentHash && identity.contentHash !== contentHash(store.read(identity.file) ?? ""))) return send(409, { error: "Stale SourceAnchor. Rebuild and select again." })
          const target = targets().find(item => item.identity.file === identity.file && item.identity.elementStart === identity.elementStart)
          if (!target) return send(404, { error: "Unknown source identity." })
          if (action === "inspect" || action === "source") return send(200, { target, breakpoints: styles().breakpoints, styleDiagnostics: styles().diagnostics, source: store.read(identity.file), revision })
          if (action !== "mutate") return send(404, { error: "Unknown operation." })
          const edit = body.edit as Record<string, unknown> | undefined
          if (typeof edit?.value !== "string" || edit.value.length > 4096) return send(400, { error: "Invalid edit value." })
          if (edit.scope === "instance" && (target.ownerComponent || target.textShared)) return send(422, { error: "This rendered instance has no independent source declaration. Edit the identified source scope or its invocation in Code." })
          if (edit.type === "text" && (target.textShared || target.repeated || /; (?:[2-9]|[1-9]\d+) statically/.test(target.effectScope ?? "")) && edit.scope !== "source") return send(422, { error: "This source definition has repeated/shared uses. Choose source scope or edit the invocation in Code." })
          const stagedFiles = durable.files(), originalFiles = new Map(stagedFiles)
          const draftStore: SourceStore = { tailwind: store.tailwind, read: file => stagedFiles.get(file), write: (file, content, expected) => { if (stagedFiles.get(file) !== expected) throw new SourceConflict("Draft source changed."); stagedFiles.set(file, content) } }
          const mutation = edit.type === "text" ? patchText(draftStore, identity, edit.value)
            : ["style", "responsive", "layout"].includes(String(edit.type)) ? patchProjectStyle(draftStore, styleFiles(), identity, edit.property as StyleProperty, edit.value, { breakpoint: typeof edit.breakpoint === "string" ? edit.breakpoint : undefined, viewport: edit.type === "responsive" ? edit.viewport as ViewportPreset : undefined, scope: typeof edit.scope === "string" ? edit.scope : undefined, semantic: edit.type === "layout" })
            : edit.type === "responsive-create" ? patchResponsiveConstruct(draftStore, styleFiles(), identity, edit.property as StyleProperty, edit.value, String(edit.breakpoint ?? ""), typeof edit.scope === "string" ? edit.scope : undefined)
            : edit.type === "reorder" ? patchSiblingReorder(draftStore, stagedFiles, identity, edit.value, body.viewport as ViewportPreset, typeof edit.scope === "string" ? edit.scope : undefined) : undefined
          if (!mutation) return send(400, { error: "Unsupported mutation." })
          if (!mutation.success) return send(422, { transaction: mutation, error: mutation.error, revision })
          const operations: FileOperation[] = [...stagedFiles].filter(([file, source]) => source !== originalFiles.get(file)).map(([file, content]) => ({ kind: "update", file, content, expectedHash: contentHash(originalFiles.get(file)!) }))
          const validation = ["reorder", "responsive-create"].includes(String(edit.type)) ? await validateStagedProject(project, projectRoot, stagedFiles, "compile") : await validateSource(new Map(operations.map(op => [op.file, stagedFiles.get(op.file)!])))
          const entry = transactionEntry(project.id, revision, "visual", idempotencyKey, requestHash, `Visual ${edit.type}: ${mutation.file}`, validation, mutation)
          entry.actor = actor
          await assertAccess(); authorize(); durable.assertBase(revision)
          if (!validation.passed) { durable.reject(entry); return result(entry) }
          await beforeCommit(operations.some(op => op.kind !== "update")||body.migrateSourceScope===true)
          return result(durable.commit({ expectedRevision: revision, operations, entry, authorize }))
}
