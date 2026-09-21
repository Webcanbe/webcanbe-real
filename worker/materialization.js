import { Buffer } from "node:buffer"
import { createHash, randomUUID } from "node:crypto"
import { releaseSnapshotHash } from "./snapshot-integrity.js"

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const REVISION = /^rev_[a-f0-9-]{36}$/i
const HASH = /^[a-f0-9]{64}$/i
const KEY = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
const LIMITS = Object.freeze({ entries: 2000, fileBytes: 2 * 1024 * 1024, totalBytes: 40 * 1024 * 1024, historyBytes: 64 * 1024 * 1024 })

const sha256 = value => createHash("sha256").update(value).digest("hex")
const cleanUuid = value => {
  if (typeof value !== "string" || !UUID.test(value)) throw new MaterializationError(422, "Invalid materialization request.")
  return value
}
const cleanKey = value => {
  if (typeof value !== "string" || !KEY.test(value)) throw new MaterializationError(422, "Invalid materialization request.")
  return value
}
const cleanName = value => {
  const text = typeof value === "string" ? value.trim() : "Purchased project"
  if (!text || text.length > 200 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text)) throw new MaterializationError(422, "Invalid materialization request.")
  return text
}

function safePath(value) {
  if (typeof value !== "string" || !value || value.length > 512 || /[\x00-\x1f\x7f\\:]/.test(value) || value.startsWith("/") || value !== value.normalize("NFC")) return false
  const parts = value.split("/")
  if (parts.length > 20 || parts.some(part => !part || part.length > 128 || part === "." || part === ".." || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part))) return false
  if (parts.some(part => ["node_modules", ".git", ".webcanbe"].includes(part.toLowerCase()) || /^\.env(?:$|\.)/i.test(part) && !/^\.env\.example$/i.test(part))) return false
  return true
}

export function sourceMember(file, directory, scope) {
  if (!safePath(file) || !file.startsWith(directory + "/")) return false
  return scope === 2 ? /\.(?:tsx?|jsx?|mts|cts|mjs|cjs|css|json)$/.test(file) : /\.(?:tsx?|jsx?|css|json)$/.test(file)
}

function decodeFiles(value) {
  if (!Array.isArray(value) || value.length > LIMITS.entries) throw new MaterializationError(409, "Release source integrity check failed.")
  const files = new Map(), seen = new Set()
  let total = 0
  for (const entry of value) {
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== "string" || typeof entry[1] !== "string" || !safePath(entry[0]) || !BASE64.test(entry[1])) throw new MaterializationError(409, "Release source integrity check failed.")
    const key = entry[0].toLowerCase()
    if (seen.has(key)) throw new MaterializationError(409, "Release source integrity check failed.")
    const bytes = Buffer.from(entry[1], "base64")
    total += bytes.length
    if (bytes.length > LIMITS.fileBytes || total > LIMITS.totalBytes) throw new MaterializationError(409, "Release source integrity check failed.")
    seen.add(key); files.set(entry[0], bytes)
  }
  return files
}

function encodedFiles(files) {
  return [...files].sort(([a], [b]) => a.localeCompare(b)).map(([file, bytes]) => [file, bytes.toString("base64")])
}

function filePayload(files) {
  const result = Object.create(null)
  for (const [file, bytes] of [...files].sort(([a], [b]) => a.localeCompare(b))) result[file] = bytes.toString("base64")
  return result
}

function validSourceDirectory(value) {
  return typeof value === "string" && safePath(value) && !value.split("/").some(part => part.startsWith("."))
}

function verifyHistoryShape(history, sourceProjectId, sourceRevisionId, sourceContentHash) {
  if (!history || typeof history !== "object" || history.schema !== 1 || history.projectId !== sourceProjectId || !Array.isArray(history.revisions) || !history.revisions.length || !Array.isArray(history.transactions) || !Array.isArray(history.past) || !Array.isArray(history.future)) throw new MaterializationError(409, "Release source integrity check failed.")
  if (history.sourceScope !== undefined && history.sourceScope !== 2) throw new MaterializationError(409, "Release source integrity check failed.")
  if (history.sourceDirectory !== undefined && !validSourceDirectory(history.sourceDirectory)) throw new MaterializationError(409, "Release source integrity check failed.")
  if (Buffer.byteLength(JSON.stringify(history)) > LIMITS.historyBytes) throw new MaterializationError(409, "Release source integrity check failed.")
  const head = history.revisions.at(-1)
  if (!head || head.revisionId !== sourceRevisionId || head.contentHash !== sourceContentHash || !REVISION.test(String(head.revisionId)) || !HASH.test(String(head.contentHash))) throw new MaterializationError(409, "Release source integrity check failed.")
}

export class MaterializationError extends Error {
  constructor(status, message) {
    super(message)
    this.name = "MaterializationError"
    this.status = status
  }
}

export function verifyReleaseSnapshot(row) {
  const sourceProjectId = cleanUuid(String(row.source_project_id))
  const sourceRevisionId = String(row.source_revision_id)
  const sourceContentHash = String(row.source_content_hash)
  const snapshotHash = String(row.snapshot_hash)
  if (!REVISION.test(sourceRevisionId) || !HASH.test(sourceContentHash) || !HASH.test(snapshotHash)) throw new MaterializationError(409, "Release source integrity check failed.")
  const history = structuredClone(row.history)
  verifyHistoryShape(history, sourceProjectId, sourceRevisionId, sourceContentHash)
  const files = decodeFiles(row.files)
  const directory = history.sourceDirectory ?? "src", scope = history.sourceScope
  const decoder = new TextDecoder("utf-8", { fatal: true })
  let editable
  try {
    editable = [...files].filter(([file]) => sourceMember(file, directory, scope)).map(([file, bytes]) => [file, decoder.decode(bytes)]).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
  } catch {
    throw new MaterializationError(409, "Release source integrity check failed.")
  }
  if (sha256(JSON.stringify(editable)) !== sourceContentHash) throw new MaterializationError(409, "Release source integrity check failed.")
  const calculatedSnapshot = releaseSnapshotHash({ projectId: sourceProjectId, revisionId: sourceRevisionId, contentHash: sourceContentHash, files: encodedFiles(files), history })
  if (calculatedSnapshot !== snapshotHash) throw new MaterializationError(409, "Release source integrity check failed.")
  return Object.freeze({ files, history, sourceProjectId, sourceRevisionId, sourceContentHash, snapshotHash })
}

export function buildMaterializedHistory(snapshot, row, workspaceProjectId, userId) {
  const releaseId = cleanUuid(String(row.release_id)), catalogProjectId = cleanUuid(String(row.catalog_project_id))
  const origin = Object.freeze({
    entitlementId: cleanUuid(String(row.entitlement_id)),
    releaseId,
    catalogProjectId,
    sourceProjectId: snapshot.sourceProjectId,
    sourceRevisionId: snapshot.sourceRevisionId,
    sourceContentHash: snapshot.sourceContentHash,
    releaseSnapshotHash: snapshot.snapshotHash,
  })
  const revisionId = `rev_${randomUUID()}`
  const history = {
    schema: 1,
    ...(snapshot.history.importOrigin ? { importOrigin: structuredClone(snapshot.history.importOrigin) } : {}),
    releaseOrigin: structuredClone(origin),
    sourceScope: snapshot.history.sourceScope ?? 2,
    ...(snapshot.history.sourceDirectory && snapshot.history.sourceDirectory !== "src" ? { sourceDirectory: snapshot.history.sourceDirectory } : {}),
    projectId: workspaceProjectId,
    revisions: [{
      revisionId,
      projectId: workspaceProjectId,
      parentRevisionId: null,
      createdAt: new Date().toISOString(),
      actor: userId,
      producer: "system",
      contentHash: snapshot.sourceContentHash,
    }],
    transactions: [],
    past: [],
    future: [],
  }
  return Object.freeze({ revisionId, history, origin })
}

async function rollback(db) {
  try { await db.query("ROLLBACK") } catch {}
}

async function currentSession(db, session) {
  const result = await db.query(
    `SELECT s.session_id FROM wcb_sessions s
      WHERE s.session_id=$1 AND s.user_id=$2 AND s.active
        AND s.expires_at=to_timestamp($3/1000.0) AND s.expires_at>clock_timestamp()
        AND NOT EXISTS(SELECT 1 FROM wcb_disabled_users d WHERE d.user_id=$2)
      FOR SHARE`,
    [session.sessionId, session.userId, session.expiresAt],
  )
  if (!result.rowCount) throw new MaterializationError(403, "Working-copy creation was refused.")
}

async function workspaceAuthority(db, userId, workspaceId) {
  const result = await db.query(
    "SELECT workspace_id FROM wcb_workspace_members WHERE workspace_id=$1 AND user_id=$2 AND active AND role IN ('owner','editor') FOR SHARE",
    [workspaceId, userId],
  )
  if (!result.rowCount) throw new MaterializationError(403, "Working-copy creation was refused.")
}

function workspaceProject(row, materialization) {
  return Object.freeze({
    workspaceProjectId: String(materialization.workspace_project_id),
    workspaceId: String(materialization.workspace_id),
    entitlementId: String(materialization.entitlement_id),
    releaseId: String(row.release_id),
    sourceProjectId: String(row.source_project_id),
    sourceRevisionId: String(row.source_revision_id),
    sourceContentHash: String(row.source_content_hash),
    releaseSnapshotHash: String(row.snapshot_hash),
    createdAt: new Date(materialization.created_at).toISOString(),
  })
}

export async function materializeDatabaseWorkspaceProject(db, session, input) {
  if (!session || typeof session !== "object") throw new MaterializationError(403, "Working-copy creation was refused.")
  const workspaceId = cleanUuid(input?.workspaceId), entitlementId = cleanUuid(input?.entitlementId), idempotencyKey = cleanKey(input?.idempotencyKey), name = cleanName(input?.name)
  if (Object.keys(input ?? {}).some(key => !["workspaceId", "entitlementId", "idempotencyKey", "name"].includes(key))) throw new MaterializationError(422, "Invalid materialization request.")

  await db.query("BEGIN")
  try {
    await currentSession(db, session)
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,91))", [`${session.userId}:${entitlementId}`])
    await workspaceAuthority(db, session.userId, workspaceId)

    const byKey = (await db.query(
      "SELECT * FROM wcb_entitlement_materializations WHERE user_id=$1 AND idempotency_key=$2 FOR UPDATE",
      [session.userId, idempotencyKey],
    )).rows[0]
    if (byKey && (String(byKey.entitlement_id) !== entitlementId || String(byKey.workspace_id) !== workspaceId)) throw new MaterializationError(409, "Idempotency key already belongs to another working copy.")

    const release = (await db.query(
      `SELECT e.entitlement_id,e.user_id,e.status AS entitlement_status,e.release_id,
              r.catalog_project_id,r.status AS release_status,r.source_project_id,r.source_revision_id,
              r.source_content_hash,r.snapshot_hash,r.files,r.history
         FROM wcb_license_entitlements e
         JOIN wcb_project_releases r ON r.release_id=e.release_id
        WHERE e.entitlement_id=$1 AND e.user_id=$2
        FOR SHARE OF e,r`,
      [entitlementId, session.userId],
    )).rows[0]
    if (!release) throw new MaterializationError(403, "Working-copy creation was refused.")
    if (release.entitlement_status !== "active") throw new MaterializationError(409, "The entitlement is not active.")
    if (release.release_status !== "published") throw new MaterializationError(409, "The purchased release is unavailable.")

    let materialization = byKey ?? (await db.query("SELECT * FROM wcb_entitlement_materializations WHERE entitlement_id=$1 FOR UPDATE", [entitlementId])).rows[0]
    if (materialization && String(materialization.user_id) !== session.userId) throw new MaterializationError(403, "Working-copy creation was refused.")
    if (materialization && String(materialization.workspace_id) !== workspaceId) throw new MaterializationError(409, "This entitlement was already materialized into another workspace.")

    if (!materialization) {
      materialization = (await db.query(
        `INSERT INTO wcb_entitlement_materializations(entitlement_id,workspace_id,user_id,workspace_project_id,idempotency_key,project_name,status,created_at,updated_at)
         VALUES($1,$2,$3,$4,$5,$6,'pending',clock_timestamp(),clock_timestamp()) RETURNING *`,
        [entitlementId, workspaceId, session.userId, randomUUID(), idempotencyKey, name],
      )).rows[0]
    } else if (materialization.status === "failed") {
      materialization = (await db.query(
        "UPDATE wcb_entitlement_materializations SET status='pending',last_error=NULL,project_name=$2,updated_at=clock_timestamp() WHERE entitlement_id=$1 RETURNING *",
        [entitlementId, name],
      )).rows[0]
    }

    const workspaceProjectId = cleanUuid(String(materialization.workspace_project_id))
    if (materialization.status === "ready") {
      const existing = (await db.query(
        `SELECT p.workspace_id,p.files,p.history,pm.role,pm.active
           FROM wcb_projects p JOIN wcb_project_members pm ON pm.project_id=p.project_id AND pm.user_id=$2
          WHERE p.project_id=$1 AND NOT p.deleted FOR SHARE`,
        [workspaceProjectId, session.userId],
      )).rows[0]
      if (!existing || String(existing.workspace_id) !== workspaceId || existing.role !== "owner" || existing.active !== true || existing.history?.releaseOrigin?.entitlementId !== entitlementId) throw new MaterializationError(409, "Existing working-copy provenance is inconsistent.")
      await currentSession(db, session); await workspaceAuthority(db, session.userId, workspaceId)
      await db.query("COMMIT")
      return workspaceProject(release, materialization)
    }

    const snapshot = verifyReleaseSnapshot(release)
    const built = buildMaterializedHistory(snapshot, release, workspaceProjectId, session.userId)
    const payload = filePayload(snapshot.files)

    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [workspaceId])
    const existingProject = (await db.query("SELECT workspace_id,files,history FROM wcb_projects WHERE project_id=$1 AND NOT deleted FOR UPDATE", [workspaceProjectId])).rows[0]
    if (existingProject) {
      const member = (await db.query("SELECT role,active FROM wcb_project_members WHERE project_id=$1 AND user_id=$2 FOR SHARE", [workspaceProjectId, session.userId])).rows[0]
      const origin = existingProject.history?.releaseOrigin
      if (String(existingProject.workspace_id) !== workspaceId || !member || member.role !== "owner" || member.active !== true || origin?.entitlementId !== entitlementId || origin?.releaseId !== String(release.release_id) || origin?.releaseSnapshotHash !== snapshot.snapshotHash) throw new MaterializationError(409, "Materialization identity already contains different source.")
    } else {
      const count = Number((await db.query("SELECT count(*) AS n FROM wcb_projects WHERE workspace_id=$1 AND NOT deleted", [workspaceId])).rows[0]?.n ?? 0)
      if (count >= 20) throw new MaterializationError(409, "Workspace project capacity reached.")
      await db.query(
        "INSERT INTO wcb_projects(project_id,workspace_id,name,revision,files,history,source_epoch) VALUES($1,$2,$3,$4,$5,$6,1)",
        [workspaceProjectId, workspaceId, name, built.revisionId, JSON.stringify(payload), JSON.stringify(built.history)],
      )
      await db.query(
        "INSERT INTO wcb_project_members(project_id,user_id,role,epoch,active) VALUES($1,$2,'owner',1,true)",
        [workspaceProjectId, session.userId],
      )
    }

    await currentSession(db, session); await workspaceAuthority(db, session.userId, workspaceId)
    materialization = (await db.query(
      "UPDATE wcb_entitlement_materializations SET status='ready',attempts=attempts+1,last_error=NULL,updated_at=clock_timestamp() WHERE entitlement_id=$1 RETURNING *",
      [entitlementId],
    )).rows[0]
    await db.query("COMMIT")
    return workspaceProject(release, materialization)
  } catch (error) {
    await rollback(db)
    if (error instanceof MaterializationError) throw error
    throw new MaterializationError(503, "Working-copy creation is temporarily unavailable.")
  }
}
