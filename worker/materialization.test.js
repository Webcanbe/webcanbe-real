import { Buffer } from "node:buffer"
import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import { buildMaterializedHistory, materializeDatabaseWorkspaceProject, verifyReleaseSnapshot } from "./materialization.js"
import { releaseSnapshotHash } from "./snapshot-integrity.js"
import fs from "node:fs"

const sha256 = value => createHash("sha256").update(value).digest("hex")
const userId = "11111111-1111-4111-8111-111111111111"
const workspaceId = "22222222-2222-4222-8222-222222222222"
const entitlementId = "33333333-3333-4333-8333-333333333333"
const releaseId = "44444444-4444-4444-8444-444444444444"
const catalogProjectId = "55555555-5555-4555-8555-555555555555"
const sourceProjectId = "66666666-6666-4666-8666-666666666666"
const sourceRevisionId = "rev_77777777-7777-4777-8777-777777777777"
const sessionId = "88888888-8888-4888-8888-888888888888"
const workspaceProjectId = "99999999-9999-4999-8999-999999999999"

function releaseFixture() {
  const files = [
    ["src/App.tsx", Buffer.from("export default function App(){return <main>Hello</main>}").toString("base64")],
    ["src/styles.css", Buffer.from("main{padding:24px}").toString("base64")],
    ["README.md", Buffer.from("# Demo").toString("base64")],
  ]
  const editable = files
    .filter(([file]) => file.startsWith("src/") && /\.(?:tsx?|jsx?|mts|cts|mjs|cjs|css|json)$/.test(file))
    .map(([file, encoded]) => [file, Buffer.from(encoded, "base64").toString("utf8")])
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
  const sourceContentHash = sha256(JSON.stringify(editable))
  const history = {
    schema: 1,
    sourceScope: 2,
    projectId: sourceProjectId,
    revisions: [{ revisionId: sourceRevisionId, projectId: sourceProjectId, parentRevisionId: null, createdAt: "2026-09-19T00:00:00.000Z", actor: userId, producer: "system", contentHash: sourceContentHash }],
    transactions: [],
    past: [],
    future: [],
  }
  const snapshotFiles = [...files].sort(([a], [b]) => a.localeCompare(b))
  const snapshotHash = releaseSnapshotHash({ projectId: sourceProjectId, revisionId: sourceRevisionId, contentHash: sourceContentHash, files: snapshotFiles, history })
  return {
    entitlement_id: entitlementId,
    user_id: userId,
    entitlement_status: "active",
    release_id: releaseId,
    catalog_project_id: catalogProjectId,
    release_status: "published",
    source_project_id: sourceProjectId,
    source_revision_id: sourceRevisionId,
    source_content_hash: sourceContentHash,
    snapshot_hash: snapshotHash,
    files,
    history,
  }
}

function fakeDatabase() {
  const release = releaseFixture()
  const state = { materialization: undefined, project: undefined, member: undefined, committed: 0, rolledBack: 0, queries: [] }
  const db = {
    async query(sql, params = []) {
      state.queries.push({ sql, params })
      if (sql === "BEGIN") return { rows: [], rowCount: 0 }
      if (sql === "COMMIT") { state.committed++; return { rows: [], rowCount: 0 } }
      if (sql === "ROLLBACK") { state.rolledBack++; return { rows: [], rowCount: 0 } }
      if (sql.includes("SELECT s.session_id FROM wcb_sessions")) return { rows: [{ session_id: sessionId }], rowCount: 1 }
      if (sql.includes("pg_advisory_xact_lock")) return { rows: [{}], rowCount: 1 }
      if (sql.includes("FROM wcb_workspace_members") && sql.includes("role IN ('owner','editor')")) return { rows: [{ workspace_id: workspaceId }], rowCount: 1 }
      if (sql.includes("FROM wcb_entitlement_materializations WHERE user_id=$1 AND idempotency_key=$2")) return { rows: state.materialization && state.materialization.idempotency_key === params[1] ? [state.materialization] : [], rowCount: state.materialization && state.materialization.idempotency_key === params[1] ? 1 : 0 }
      if (sql.includes("FROM wcb_license_entitlements e") && sql.includes("JOIN wcb_project_releases r")) return { rows: [release], rowCount: 1 }
      if (sql.includes("FROM wcb_entitlement_materializations WHERE entitlement_id=$1 FOR UPDATE")) return { rows: state.materialization ? [state.materialization] : [], rowCount: state.materialization ? 1 : 0 }
      if (sql.includes("INSERT INTO wcb_entitlement_materializations")) {
        state.materialization = {
          entitlement_id: entitlementId,
          workspace_id: workspaceId,
          user_id: userId,
          workspace_project_id: workspaceProjectId,
          idempotency_key: params[4],
          project_name: params[5],
          status: "pending",
          attempts: 0,
          created_at: "2026-09-19T00:00:00.000Z",
          updated_at: "2026-09-19T00:00:00.000Z",
        }
        return { rows: [state.materialization], rowCount: 1 }
      }
      if (sql.includes("SELECT workspace_id,files,history FROM wcb_projects")) return { rows: state.project ? [state.project] : [], rowCount: state.project ? 1 : 0 }
      if (sql.includes("SELECT count(*) AS n FROM wcb_projects")) return { rows: [{ n: state.project ? "1" : "0" }], rowCount: 1 }
      if (sql.includes("INSERT INTO wcb_projects")) {
        state.project = { workspace_id: workspaceId, files: JSON.parse(params[4]), history: JSON.parse(params[5]) }
        return { rows: [], rowCount: 1 }
      }
      if (sql.includes("INSERT INTO wcb_project_members")) {
        state.member = { role: "owner", active: true }
        return { rows: [], rowCount: 1 }
      }
      if (sql.includes("UPDATE wcb_entitlement_materializations SET status='ready'")) {
        state.materialization = { ...state.materialization, status: "ready", attempts: Number(state.materialization.attempts) + 1 }
        return { rows: [state.materialization], rowCount: 1 }
      }
      if (sql.includes("FROM wcb_projects p JOIN wcb_project_members pm")) {
        return state.project && state.member
          ? { rows: [{ workspace_id: workspaceId, files: state.project.files, history: state.project.history, role: state.member.role, active: state.member.active }], rowCount: 1 }
          : { rows: [], rowCount: 0 }
      }
      throw new Error("Unexpected SQL: " + sql)
    },
  }
  return { db, state }
}

describe("Workers working-copy materialization", () => {
  it("verifies immutable release provenance before creating editable source", () => {
    const release = releaseFixture()
    const snapshot = verifyReleaseSnapshot(release)
    expect(snapshot.sourceProjectId).toBe(sourceProjectId)
    expect(snapshot.sourceRevisionId).toBe(sourceRevisionId)
    expect(snapshot.sourceContentHash).toBe(release.source_content_hash)
    const built = buildMaterializedHistory(snapshot, release, workspaceProjectId, userId)
    expect(built.history.projectId).toBe(workspaceProjectId)
    expect(built.history.releaseOrigin).toMatchObject({
      entitlementId,
      releaseId,
      catalogProjectId,
      sourceProjectId,
      sourceRevisionId,
      releaseSnapshotHash: release.snapshot_hash,
    })
    expect(built.history.revisions).toHaveLength(1)
    expect(built.history.revisions[0].contentHash).toBe(release.source_content_hash)
  })

  it("refuses a release whose immutable files no longer match its snapshot", () => {
    const release = releaseFixture()
    release.files = [...release.files]
    release.files[0] = [release.files[0][0], Buffer.from("tampered").toString("base64")]
    expect(() => verifyReleaseSnapshot(release)).toThrow(/integrity/i)
  })

  it("accepts the same release after JSONB-style object key reordering", () => {
    const release = releaseFixture()
    const h = release.history
    const head = h.revisions[0]
    release.history = {
      past: h.past,
      future: h.future,
      schema: h.schema,
      projectId: h.projectId,
      revisions: [{
        actor: head.actor,
        producer: head.producer,
        createdAt: head.createdAt,
        projectId: head.projectId,
        revisionId: head.revisionId,
        contentHash: head.contentHash,
        parentRevisionId: head.parentRevisionId,
      }],
      sourceScope: h.sourceScope,
      transactions: h.transactions,
    }
    expect(() => verifyReleaseSnapshot(release)).not.toThrow()
  })

  it("atomically creates one workspace project and replays the same idempotent request", async () => {
    const { db, state } = fakeDatabase()
    const session = { sessionId, userId, expiresAt: Date.parse("2026-09-20T00:00:00Z") }
    const input = { workspaceId, entitlementId, idempotencyKey: "copy:demo-1", name: "Purchased project" }

    const first = await materializeDatabaseWorkspaceProject(db, session, input)
    expect(first).toMatchObject({ workspaceProjectId, workspaceId, entitlementId, releaseId })
    expect(state.project).toBeTruthy()
    expect(state.member).toEqual({ role: "owner", active: true })
    expect(state.materialization.status).toBe("ready")
    expect(state.committed).toBe(1)
    expect(state.rolledBack).toBe(0)
    expect(state.queries.some(call => call.sql.includes("INSERT INTO wcb_projects"))).toBe(true)
    expect(state.queries.some(call => call.sql.includes("INSERT INTO wcb_project_members"))).toBe(true)

    const insertsBefore = state.queries.filter(call => call.sql.includes("INSERT INTO wcb_projects")).length
    const second = await materializeDatabaseWorkspaceProject(db, session, input)
    expect(second.workspaceProjectId).toBe(first.workspaceProjectId)
    const insertsAfter = state.queries.filter(call => call.sql.includes("INSERT INTO wcb_projects")).length
    expect(insertsAfter).toBe(insertsBefore)
    expect(state.committed).toBe(2)
  })

  it("keeps the HTTP mutation route fail-closed until the production mutation flag is enabled", () => {
    const worker = fs.readFileSync("worker/index.js", "utf8")
    expect(worker).toContain("/__webcanbe/api/product/workspace-projects/materialize")
    expect(worker).toContain('env.WEBCANBE_PRODUCT_MUTATIONS !== "enabled"')
    expect(worker).toContain("Product mutations are not enabled.")
    expect(worker).toContain("materializeDatabaseWorkspaceProject")
  })
})
