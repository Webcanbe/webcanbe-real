import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { afterEach, describe, expect, it } from "vitest"
// @ts-expect-error launch fixture is a tested Node ESM runtime helper without a declaration file
import { buildMaterializationSmokeFixture } from "../scripts/launch/materialization-smoke-fixture.mjs"
// @ts-expect-error Worker materialization is a tested JavaScript runtime module without a declaration file
import { buildMaterializedHistory, verifyReleaseSnapshot } from "../worker/materialization.js"
import { MutationHistory } from "./webcanbe-engine/mutations/sourceMutations"
import { DurableSource, contentHash, transactionEntry } from "./webcanbe-engine/mutations/durableSource"
import { buildIndependentExport } from "./webcanbe-engine/runtime/independentExport"
import { detectProject, extractSafeZip, type ProjectRecord } from "./webcanbe-engine/runtime/projectRegistry"
import { exportProjectZip } from "./webcanbe-engine/runtime/projectExport"

const roots:string[]=[]
afterEach(()=>{for(const root of roots.splice(0))fs.rmSync(root,{recursive:true,force:true})})

const userId="11111111-1111-4111-8111-111111111111"
const workspaceId="22222222-2222-4222-8222-222222222222"
const workspaceProjectId="33333333-3333-4333-8333-333333333333"

function materializedFixture(){
  const fixture=buildMaterializationSmokeFixture({userId,workspaceId,version:"gate4-v1"})
  const release={
    entitlement_id:fixture.entitlementId,
    release_id:fixture.releaseId,
    catalog_project_id:fixture.catalogProjectId,
    source_project_id:fixture.sourceProjectId,
    source_revision_id:fixture.revisionId,
    source_content_hash:fixture.sourceContentHash,
    snapshot_hash:fixture.snapshotHash,
    files:fixture.files,
    history:fixture.history,
  }
  const snapshot=verifyReleaseSnapshot(release)
  const built=buildMaterializedHistory(snapshot,release,workspaceProjectId,userId)

  const parent=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"wcb-gate4-chain-")))
  roots.push(parent)
  const root=path.join(parent,"project")
  fs.mkdirSync(root,{recursive:true})
  for(const [file,encoded] of fixture.files){
    const target=path.join(root,file)
    fs.mkdirSync(path.dirname(target),{recursive:true})
    fs.writeFileSync(target,Buffer.from(encoded,"base64"))
  }
  const detection=detectProject(root,process.cwd())
  if(!detection.supported||!detection.sourceDirectory)throw new Error(detection.reason??"Materialized fixture is unsupported.")
  const project:ProjectRecord={
    id:workspaceProjectId,
    name:"Gate 4 materialized launch chain",
    root,
    archiveRoot:root,
    sourceRoot:path.join(root,detection.sourceDirectory),
    imported:true,
    detection,
    history:new MutationHistory(),
  }
  const historyRoot=path.join(parent,"history")
  const projectHistoryRoot=path.join(historyRoot,workspaceProjectId)
  fs.mkdirSync(projectHistoryRoot,{recursive:true})
  fs.writeFileSync(path.join(projectHistoryRoot,"history.json"),JSON.stringify(built.history))
  return{fixture,built,project,historyRoot,parent}
}

describe("Gate 4 launch chain: materialize → durable edit → reload → export",()=>{
  it("carries immutable release provenance through accepted source and independent export",async()=>{
    const d=materializedFixture()
    const source=new DurableSource(d.project,d.historyRoot)
    expect(source.revision()).toBe(d.built.revisionId)
    expect(source.history().releaseOrigin).toMatchObject({
      entitlementId:d.fixture.entitlementId,
      releaseId:d.fixture.releaseId,
      catalogProjectId:d.fixture.catalogProjectId,
      sourceProjectId:d.fixture.sourceProjectId,
      sourceRevisionId:d.fixture.revisionId,
      sourceContentHash:d.fixture.sourceContentHash,
      releaseSnapshotHash:d.fixture.snapshotHash,
    })

    const file="src/App.tsx"
    const before=source.files().get(file)
    if(!before)throw new Error("Gate 4 fixture App.tsx is unavailable.")
    const baseRevision=source.revision()
    const marker="// gate4 materialized accepted edit"
    const content=before+"\n"+marker
    const key=randomUUID()
    const entry=transactionEntry(d.project.id,baseRevision,"code",key,contentHash(key),"Gate 4 accepted Code save",{level:"compile",passed:true,diagnostics:[]})
    entry.actor=userId
    entry.editType="code"
    entry.file=file
    const operation={kind:"update" as const,file,expectedHash:contentHash(before),content}
    entry.operations=[operation]

    const accepted=source.commit({expectedRevision:baseRevision,operations:[operation],entry,authorize:()=>{}})
    expect(accepted.success).toBe(true)
    expect(accepted.newRevisionId).not.toBe(baseRevision)

    const reopened=new DurableSource(d.project,d.historyRoot)
    expect(reopened.revision()).toBe(accepted.newRevisionId)
    expect(reopened.files().get(file)).toContain(marker)
    expect(reopened.history().releaseOrigin).toEqual(source.history().releaseOrigin)
    expect(reopened.history().revisions.at(-1)?.parentRevisionId).toBe(baseRevision)

    const archive=await exportProjectZip(d.project)
    const independent=await buildIndependentExport(archive,process.cwd())
    expect(independent.sourceUnchanged).toBe(true)
    expect(independent.profile).toBeTruthy()

    const extracted=path.join(d.parent,"exported")
    await extractSafeZip(archive,extracted)
    expect(fs.readFileSync(path.join(extracted,file),"utf8")).toContain(marker)
    expect(fs.existsSync(path.join(extracted,".webcanbe"))).toBe(false)
  })
})
