import { Buffer } from "node:buffer"
import { describe, expect, it } from "vitest"
import { EditorProjectError, editorProjectRequest, sourceContentHash, zipStore } from "./editor-projects.js"
import fs from "node:fs"

const userId="11111111-1111-4111-8111-111111111111"
const otherUser="22222222-2222-4222-8222-222222222222"
const sessionId="33333333-3333-4333-8333-333333333333"
const workspaceId="44444444-4444-4444-8444-444444444444"
const projectId="55555555-5555-4555-8555-555555555555"
const baseRevision="rev_66666666-6666-4666-8666-666666666666"

function fixture(){
  const files=new Map([
    ["package.json",Buffer.from('{"scripts":{"build":"vite build"},"dependencies":{"react":"19.3.0","vite":"6.4.3"}}')],
    ["src/App.tsx",Buffer.from('export default function App(){return <main>Hello</main>}')],
    ["src/styles.css",Buffer.from("main{padding:24px}")],
  ])
  const history={
    schema:1,sourceScope:2,projectId,revisions:[{revisionId:baseRevision,projectId,parentRevisionId:null,createdAt:"2026-09-21T00:00:00.000Z",actor:userId,producer:"system",contentHash:""}],
    transactions:[],past:[],future:[],
    releaseOrigin:{entitlementId:"77777777-7777-4777-8777-777777777777",releaseId:"88888888-8888-4888-8888-888888888888",catalogProjectId:"99999999-9999-4999-8999-999999999999",sourceProjectId:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",sourceRevisionId:"rev_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",sourceContentHash:"c".repeat(64),releaseSnapshotHash:"d".repeat(64)}
  }
  history.revisions[0].contentHash=sourceContentHash(files,history)
  return {files,history}
}
function payload(files){return Object.fromEntries([...files].map(([file,bytes])=>[file,bytes.toString("base64")]))}

function fakeDb(){
  const f=fixture()
  const state={
    project:{project_id:projectId,workspace_id:workspaceId,name:"Purchased project",revision:baseRevision,files:payload(f.files),history:f.history,source_epoch:1,role:"owner",membership_epoch:1,workspace_epoch:1},
    capability:undefined,
    drafts:undefined,
    began:0,committed:0,rolledBack:0,
  }
  const db={async query(sql,params=[]){
    if(sql==="BEGIN"){state.began++;return{rows:[],rowCount:0}}
    if(sql==="COMMIT"){state.committed++;return{rows:[],rowCount:0}}
    if(sql==="ROLLBACK"){state.rolledBack++;return{rows:[],rowCount:0}}
    if(sql.startsWith("SELECT p.project_id,p.name,p.revision")) {
      return params[0]===userId?{rows:[state.project],rowCount:1}:{rows:[],rowCount:0}
    }
    if(sql.includes("FROM wcb_projects p")&&sql.includes("JOIN wcb_project_members")) {
      const requestedUser=params[1]
      return requestedUser===userId&&params[0]===projectId?{rows:[state.project],rowCount:1}:{rows:[],rowCount:0}
    }
    if(sql.startsWith("DELETE FROM wcb_editor_capabilities")) return {rows:[],rowCount:0}
    if(sql.startsWith("SELECT count(*) AS n FROM wcb_editor_capabilities")) return {rows:[{n:state.capability?1:0}],rowCount:1}
    if(sql.startsWith("INSERT INTO wcb_editor_capabilities")) {
      state.capability={preview_id:params[0],project_id:params[1],token_hash:params[2],grant_json:JSON.parse(params[3])}
      return {rows:[],rowCount:1}
    }
    if(sql.includes("FROM wcb_editor_capabilities")&&sql.includes("token_hash=$3")) {
      const match=state.capability&&state.capability.preview_id===params[0]&&state.capability.project_id===params[1]&&state.capability.token_hash===params[2]
      return match?{rows:[{grant_json:state.capability.grant_json}],rowCount:1}:{rows:[],rowCount:0}
    }
    if(sql.startsWith("SELECT revision,files,history,source_epoch,workspace_id FROM wcb_projects")) return {rows:[state.project],rowCount:1}
    if(sql.startsWith("UPDATE wcb_projects SET revision=$2")) {
      if(state.project.revision!==params[4]||String(state.project.source_epoch)!==String(params[5]))return{rows:[],rowCount:0}
      state.project={...state.project,revision:params[1],files:JSON.parse(params[2]),history:JSON.parse(params[3]),source_epoch:Number(state.project.source_epoch)+1}
      return {rows:[{source_epoch:state.project.source_epoch}],rowCount:1}
    }
    if(sql.startsWith("SELECT version,payload FROM wcb_drafts")) return state.drafts?{rows:[state.drafts],rowCount:1}:{rows:[],rowCount:0}
    if(sql.includes("pg_advisory_xact_lock")) return {rows:[{}],rowCount:1}
    if(sql.startsWith("INSERT INTO wcb_drafts")) {
      state.drafts={version:params[2],payload:JSON.parse(params[3])};return{rows:[],rowCount:1}
    }
    if(sql.startsWith("UPDATE wcb_editor_capabilities SET revoked=true")) return {rows:[],rowCount:1}
    throw new Error("Unexpected SQL: "+sql)
  }}
  return {db,state}
}

describe("production Worker source editor API",()=>{
  it("keeps source hashing ordered and ignores non-editable files",()=>{
    const f=fixture()
    const a=sourceContentHash(f.files,f.history)
    const reversed=new Map([...f.files].reverse())
    expect(sourceContentHash(reversed,f.history)).toBe(a)
    reversed.set("README.md",Buffer.from("changed docs"))
    expect(sourceContentHash(reversed,f.history)).toBe(a)
  })

  it("builds a real stored ZIP archive containing project files",()=>{
    const archive=zipStore(new Map([["src/App.tsx",Buffer.from("hello")],["package.json",Buffer.from("{}")]]))
    expect(archive.readUInt32LE(0)).toBe(0x04034b50)
    expect(archive.includes(Buffer.from("src/App.tsx"))).toBe(true)
    expect(archive.includes(Buffer.from("package.json"))).toBe(true)
    expect(archive.readUInt32LE(archive.length-22)).toBe(0x06054b50)
  })

  it("lists and opens only projects belonging to the current session user",async()=>{
    const {db}=fakeDb()
    const session={sessionId,userId,expiresAt:Date.now()+600000}
    const listed=await editorProjectRequest(db,session,"/__webcanbe/api/projects",{})
    expect(listed.value.projects).toHaveLength(1)
    const opened=await editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/session`,{})
    expect(opened.status).toBe(201)
    expect(opened.value.project.id).toBe(projectId)
    await expect(editorProjectRequest(db,{...session,userId:otherUser},`/__webcanbe/api/projects/${projectId}/session`,{})).rejects.toMatchObject({status:403})
  })

  it("CAS-saves accepted source, preserves release provenance and reopens the new revision",async()=>{
    const {db,state}=fakeDb()
    const session={sessionId,userId,expiresAt:Date.now()+600000}
    const opened=await editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/session`,{})
    const auth={previewId:opened.value.session.previewId,capability:opened.value.session.capability}
    const before=await editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/files`,auth)
    const app=before.value.files.find(item=>item.file==="src/App.tsx")
    const next='export default function App(){return <main>Production edit</main>}'
    const saved=await editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/code`,{
      ...auth,expectedRevision:before.value.revision,idempotencyKey:"production-save-1",
      operations:[{kind:"update",file:"src/App.tsx",expectedHash:app.hash,content:next}],
    })
    expect(saved.status).toBe(200)
    expect(saved.value.revision).not.toBe(baseRevision)
    expect(saved.value.transaction.versions["src/App.tsx"].after).toBeDefined()
    expect(state.project.history.releaseOrigin).toEqual(fixture().history.releaseOrigin)
    const reopened=await editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/files`,{...auth,file:"src/App.tsx"})
    expect(reopened.value.source).toBe(next)
    expect(reopened.value.revision).toBe(saved.value.revision)
    expect(state.committed).toBe(1)
    expect(state.rolledBack).toBe(0)
  })

  it("inspects a safe static JSX text target and commits it as a Visual source transaction",async()=>{
    const {db,state}=fakeDb()
    const session={sessionId,userId,expiresAt:Date.now()+600000}
    const opened=await editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/session`,{})
    const auth={previewId:opened.value.session.previewId,capability:opened.value.session.capability}
    const source=Buffer.from(state.project.files["src/App.tsx"],"base64").toString("utf8")
    const elementStart=source.indexOf("<main>")
    const compatibility=await editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/compatibility`,auth)
    expect(compatibility.value.summary.partial).toBeGreaterThan(0)
    const inspected=await editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/inspect`,{...auth,identity:{file:"src/App.tsx",elementStart}})
    expect(inspected.value.target.text).toBe("Hello")
    expect(inspected.value.target.capabilities.text).toBe(true)

    const saved=await editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/mutate`,{
      ...auth,
      expectedRevision:baseRevision,
      idempotencyKey:"visual-text-1",
      identity:{file:"src/App.tsx",elementStart},
      edit:{type:"text",value:"Visual verified"},
    })
    expect(saved.status).toBe(200)
    expect(saved.value.transaction.producer).toBe("visual")
    expect(saved.value.transaction.editType).toBe("text")
    expect(saved.value.transaction.before).toBe("Hello")
    expect(saved.value.transaction.after).toBe("Visual verified")
    expect(state.project.history.releaseOrigin).toEqual(fixture().history.releaseOrigin)
    const reopened=await editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/files`,{...auth,file:"src/App.tsx"})
    expect(reopened.value.source).toContain("<main>Visual verified</main>")
    expect(reopened.value.revision).toBe(saved.value.revision)
  })

  it("renders a managed Browser Run snapshot without passing Webcanbe credentials to the browser",async()=>{
    const {db}=fakeDb()
    const session={sessionId,userId,expiresAt:Date.now()+600000}
    const opened=await editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/session`,{})
    const auth={previewId:opened.value.session.previewId,capability:opened.value.session.capability}
    const source='export default function App(){return <main>Hello</main>}'
    const elementStart=source.indexOf("<main>")
    let received
    const env={BROWSER:{quickAction:async(action,options)=>{
      received={action,options}
      const observation={route:"/",viewport:{width:1280,height:900},elements:[{identity:{file:"src/App.tsx",elementStart},tagName:"main",rect:{top:10,left:20,width:300,height:80},computed:{display:"block"},layoutContext:"block"}]}
      return new Response(JSON.stringify({success:true,result:{screenshot:Buffer.alloc(120,7).toString("base64"),content:`<!doctype html><script id="wcb-observation" type="application/json">${JSON.stringify(observation)}</script>`}}),{status:200,headers:{"content-type":"application/json"}})
    }}}
    const preview=await editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/preview`,{...auth,expectedRevision:baseRevision,viewport:"desktop",route:"/"},env)
    expect(preview.status).toBe(200)
    expect(preview.value.transport).toBe("snapshot")
    expect(preview.value.snapshotElements[0].identity).toEqual({file:"src/App.tsx",elementStart})
    expect(received.action).toBe("snapshot")
    expect(received.options.url).toBe("https://webcanbe.com/__wcb_preview_runtime")
    expect(received.options.waitForSelector).toEqual({selector:"html[data-wcb-ready='1']",timeout:12000})
    expect(received.options.addScriptTag[0].content).toContain("__WCB_PROJECT_PAYLOAD__")
    expect(received.options.addScriptTag[0].content).not.toContain("__Host-wcb-session")
    expect(received.options.allowRequestPattern).toEqual(["/^https:\\/\\/webcanbe\\.com\\/(?:__wcb_preview_runtime|assets\\/[^?#]+)$/"])
  })

  it("routes production project APIs before the static SPA fallback",()=>{
    const worker=fs.readFileSync("worker/index.js","utf8")
    expect(worker).toContain('path === "/__webcanbe/api/projects"')
    expect(worker).toContain('path.startsWith("/__webcanbe/api/projects/")')
    expect(worker).toContain("editorProjectRequest")
  })
})
