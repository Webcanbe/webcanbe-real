import { Buffer } from "node:buffer"
import { describe, expect, it, vi } from "vitest"
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
    aiGrant:undefined,
    aiReservations:[],
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
    if(sql.startsWith("SELECT * FROM wcb_ai_usage_reservations WHERE user_id=$1 AND idempotency_key=$2")) {
      const row=state.aiReservations.find(item=>item.user_id===params[0]&&item.idempotency_key===params[1]);return row?{rows:[row],rowCount:1}:{rows:[],rowCount:0}
    }
    if(sql.startsWith("SELECT plan_key FROM wcb_subscriptions")||sql.startsWith("SELECT 1 FROM wcb_subscriptions")) return {rows:[],rowCount:0}
    if(sql.startsWith("INSERT INTO wcb_ai_included_grants")) {
      state.aiGrant={grant_id:params[0],included_actions:params[3],expires_at:params[4]};return{rows:[],rowCount:1}
    }
    if(sql.startsWith("SELECT grant_id,included_actions,expires_at FROM wcb_ai_included_grants")) return state.aiGrant?{rows:[state.aiGrant],rowCount:1}:{rows:[],rowCount:0}
    if(sql.startsWith("SELECT credit_id,purchased_actions FROM wcb_ai_purchased_credits")) return {rows:[],rowCount:0}
    if(sql.startsWith("SELECT * FROM wcb_ai_usage_reservations WHERE user_id=$1 AND status IN")) return {rows:state.aiReservations.filter(item=>item.user_id===params[0]&&["reserved","committed"].includes(item.status)),rowCount:state.aiReservations.length}
    if(sql.startsWith("INSERT INTO wcb_ai_usage_reservations")) {
      const row={reservation_id:params[0],user_id:params[1],project_id:params[2],idempotency_key:params[3],cost:params[4],expected_revision:params[5],allocations:JSON.parse(params[6]),status:"reserved",outcome:null};state.aiReservations.push(row);return{rows:[row],rowCount:1}
    }
    if(sql.startsWith("SELECT user_id FROM wcb_ai_usage_reservations")) {
      const row=state.aiReservations.find(item=>item.reservation_id===params[0]);return row?{rows:[{user_id:row.user_id}],rowCount:1}:{rows:[],rowCount:0}
    }
    if(sql.startsWith("SELECT * FROM wcb_ai_usage_reservations WHERE reservation_id=$1")) {
      const row=state.aiReservations.find(item=>item.reservation_id===params[0]);return row?{rows:[row],rowCount:1}:{rows:[],rowCount:0}
    }
    if(sql.startsWith("SELECT 1\n        FROM jsonb_array_elements")) return {rows:[],rowCount:0}
    if(sql.startsWith("UPDATE wcb_ai_usage_reservations")) {
      const row=state.aiReservations.find(item=>item.reservation_id===params[0]);if(!row)return{rows:[],rowCount:0};if(sql.includes("SET outcome=$2::jsonb")){if(row.status!=="reserved")return{rows:[],rowCount:0};row.outcome=JSON.parse(params[1]);return{rows:[row],rowCount:1}}if(row.status==="reserved")row.status=params[1];if(params[1]==="committed"&&params[3])row.outcome=JSON.parse(params[3]);return{rows:[row],rowCount:1}
    }
    if(sql.startsWith("INSERT INTO wcb_drafts")) {
      state.drafts={version:params[2],payload:JSON.parse(params[3])};return{rows:[],rowCount:1}
    }
    if(sql.startsWith("UPDATE wcb_editor_capabilities SET revoked=true")) return {rows:[],rowCount:1}
    throw new Error("Unexpected SQL: "+sql)
  }}
  return {db,state}
}

describe("production Worker source editor API",()=>{
  it("keeps capability and draft checks on metadata while verifying source for file reads",async()=>{
    const {db}=fakeDb(),session={sessionId,userId,expiresAt:Date.now()+600000}
    const queries=[]
    const original=db.query.bind(db)
    db.query=async(sql,params)=>{
      if(sql.includes("FROM wcb_projects p")&&sql.includes("JOIN wcb_project_members"))queries.push(sql)
      return original(sql,params)
    }
    const opened=await editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/session`,{})
    const auth={previewId:opened.value.session.previewId,capability:opened.value.session.capability}
    const decode=vi.spyOn(TextDecoder.prototype,"decode")
    queries.length=0
    try {
      await editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/drafts`,auth)
      expect(queries.length).toBeGreaterThan(0)
      expect(queries.every(sql=>!sql.includes("p.files,p.history"))).toBe(true)
      expect(decode).not.toHaveBeenCalled()
      queries.length=0
      const result=await editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/files`,{...auth,file:"src/styles.css"})
      expect(result.value.source).toBe("main{padding:24px}")
      expect(queries.filter(sql=>sql.includes("p.files,p.history"))).toHaveLength(1)
      expect(queries.filter(sql=>!sql.includes("p.files,p.history")).length).toBeGreaterThan(0)
      expect(decode).toHaveBeenCalledTimes(2)
    } finally { decode.mockRestore() }
  })
  it.each([['reviewed','original'],['reviewed','accepted'],['direct','original'],['direct','accepted']])("recovers AI settlement endpoint after %s Apply using %s revision",async(flow,revisionChoice)=>{
    const {db,state}=fakeDb(),session={sessionId,userId,expiresAt:Date.now()+600000}
    const opened=await editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/session`,{})
    const auth={previewId:opened.value.session.previewId,capability:opened.value.session.capability}
    const listed=await editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/files`,auth)
    const hash=listed.value.files.find(item=>item.file==='src/App.tsx').hash
    let generations=0,allocations=0,releases=0
    const env={AI:{run:async()=>{generations++;return {response:JSON.stringify({summary:'Settlement recovery',operations:[{kind:'update',file:'src/App.tsx',expectedHash:hash,content:'export default function App(){return <main>Accepted once</main>}'}]})}}}}
    const body={...auth,feature:'modify',prompt:'Change heading',mode:'standard',expectedRevision:baseRevision,idempotencyKey:'ai-settlement-recovery'}
    const query=db.query.bind(db);let failDone=false
    db.query=async(sql,params=[])=>{
      if(sql.startsWith('INSERT INTO wcb_ai_usage_reservations'))allocations++
      if(sql.startsWith('UPDATE wcb_ai_usage_reservations')){
        if(params[1]==='released')releases++
        if(failDone && (sql.includes('SET outcome=$2') || params[3] && JSON.parse(params[3]).state==='done'))throw new Error('injected ledger outage after source acceptance')
      }
      return query(sql,params)
    }
    if(flow==='reviewed')await editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/ai`,body,env)
    failDone=true
    await expect(editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/ai`,{...body,apply:true},env)).rejects.toMatchObject({status:503})
    const acceptedRevision=state.project.revision
    expect(state.project.history.transactions).toHaveLength(1)
    expect(state.aiReservations[0].status).toBe(flow==='reviewed'?'committed':'reserved')
    failDone=false
    const recovery={...body,apply:true,expectedRevision:revisionChoice==='accepted'?acceptedRevision:baseRevision}
    for(const attack of [{idempotencyKey:'different-stale-key',expectedRevision:baseRevision},{prompt:'Different request'}, {mode:'deep'}, {capability:'invalid'}]){
      await expect(editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/ai`,{...recovery,...attack},env)).rejects.toBeDefined()
    }
    await expect(editorProjectRequest(db,{...session,userId:otherUser},`/__webcanbe/api/projects/${projectId}/ai`,recovery,env)).rejects.toMatchObject({status:403})
    for(let replay=0;replay<2;replay++)await expect(editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/ai`,recovery,env)).resolves.toMatchObject({status:200,value:{state:'done',result:{applied:true,revision:acceptedRevision}}})
    expect(state.project.revision).toBe(acceptedRevision)
    expect(state.project.history.transactions).toHaveLength(1)
    expect(state.project.history.transactions[0].producer).toBe('ai')
    expect({generations,allocations,releases}).toEqual({generations:1,allocations:1,releases:0})
    expect(state.aiReservations).toHaveLength(1)
    expect(state.aiReservations[0]).toMatchObject({status:'committed',cost:1,outcome:{state:'done'}})
  })
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

  it("reviews then applies AI through canonical source, history, reopen, undo and export",async()=>{
    const {db,state}=fakeDb(),session={sessionId,userId,expiresAt:Date.now()+600000}
    const opened=await editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/session`,{})
    const auth={previewId:opened.value.session.previewId,capability:opened.value.session.capability}
    const original=Buffer.from(state.project.files["src/App.tsx"],"base64").toString("utf8")
    const hash=(await editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/files`,auth)).value.files.find(item=>item.file==="src/App.tsx").hash
    const changed='export default function App(){return <main>AI accepted</main>}'
    const env={AI:{run:async()=>({response:JSON.stringify({summary:"Update the main heading",operations:[{kind:"update",file:"src/App.tsx",expectedHash:hash,content:changed}]})})}}
    const body={...auth,feature:"modify",prompt:"Change the heading",mode:"standard",selection:{file:"src/App.tsx"},expectedRevision:baseRevision,idempotencyKey:"ai-review-apply-1"}
    const proposed=await editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/ai`,body,env)
    expect(proposed.value).toMatchObject({state:"ready_to_review",cost:1,result:{applied:false,revision:baseRevision}})
    expect(Buffer.from(state.project.files["src/App.tsx"],"base64").toString("utf8")).toBe(original)
    const applied=await editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/ai`,{...body,apply:true},env)
    expect(applied.value).toMatchObject({state:"done",result:{applied:true}})
    const acceptedRevision=applied.value.result.revision
    const reopened=await editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/files`,{...auth,file:"src/App.tsx"})
    expect(reopened.value).toMatchObject({source:changed,revision:acceptedRevision})
    const history=await editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/history`,auth)
    expect(history.value.history.transactions.at(-1)).toMatchObject({producer:"ai",editType:"ai",summary:"Update the main heading"})
    const archive=await editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/export`,{...auth,expectedRevision:acceptedRevision})
    expect(Buffer.from(archive.value.archive,"base64").includes(Buffer.from(changed))).toBe(true)
    const undone=await editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/undo`,{...auth,expectedRevision:acceptedRevision,idempotencyKey:"undo-ai-accepted-1"})
    expect(undone.value.transaction.editType).toBe("revert")
    const afterUndo=await editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/files`,{...auth,file:"src/App.tsx"})
    expect(afterUndo.value.source).toBe(original)
  })

  it("refuses a reviewed AI proposal after a newer Code revision",async()=>{
    const {db,state}=fakeDb(),session={sessionId,userId,expiresAt:Date.now()+600000}
    const opened=await editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/session`,{})
    const auth={previewId:opened.value.session.previewId,capability:opened.value.session.capability}
    const listed=await editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/files`,auth)
    const app=listed.value.files.find(item=>item.file==="src/App.tsx"),aiSource='export default function App(){return <main>AI stale</main>}'
    const env={AI:{run:async()=>({response:JSON.stringify({summary:"Stale proposal",operations:[{kind:"update",file:"src/App.tsx",expectedHash:app.hash,content:aiSource}]})})}}
    const body={...auth,feature:"modify",prompt:"Change heading",mode:"standard",selection:{file:"src/App.tsx"},expectedRevision:baseRevision,idempotencyKey:"ai-stale-review-1"}
    await editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/ai`,body,env)
    const manual='export default function App(){return <main>Newer Code</main>}'
    const saved=await editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/code`,{...auth,expectedRevision:baseRevision,idempotencyKey:"newer-code-before-ai",operations:[{kind:"update",file:"src/App.tsx",expectedHash:app.hash,content:manual}]})
    await expect(editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/ai`,{...body,apply:true},env)).rejects.toMatchObject({status:409})
    expect(state.project.revision).toBe(saved.value.revision)
    expect(Buffer.from(state.project.files["src/App.tsx"],"base64").toString("utf8")).toBe(manual)
  })

  it("inspects a safe static JSX text target and commits it as a Visual source transaction",async()=>{
    const {db,state}=fakeDb()
    const session={sessionId,userId,expiresAt:Date.now()+600000}
    const opened=await editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/session`,{})
    const auth={previewId:opened.value.session.previewId,capability:opened.value.session.capability}
    const source=Buffer.from(state.project.files["src/App.tsx"],"base64").toString("utf8")
    const elementStart=source.indexOf("<main>")
    const compatibility=await editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/compatibility`,auth)
    expect(compatibility.value.summary.full + compatibility.value.summary.partial).toBeGreaterThan(0)
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
    expect(received.options.url).toBe("https://webcanbe-real.iseig513.workers.dev/__wcb_preview_runtime")
    expect(received.options.waitForSelector).toEqual({selector:"html[data-wcb-ready='1']",timeout:45000})
    expect(received.options.screenshotOptions).toEqual({fullPage:true})
    expect(received.options.addScriptTag[0].content).toContain("__WCB_PROJECT_PAYLOAD__")
    expect(received.options.addScriptTag[0].content).not.toContain("__Host-wcb-session")
    expect(received.options.allowRequestPattern).toEqual(["^https://webcanbe-real\\.iseig513\\.workers\\.dev/(?:__wcb_preview_runtime|assets/[^?#]+)$"])
  })

  it("reports real draft parse errors without accepting or replacing source",async()=>{
    const {db,state}=fakeDb(),session={sessionId,userId,expiresAt:Date.now()+600000}
    const opened=await editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/session`,{})
    const auth={previewId:opened.value.session.previewId,capability:opened.value.session.capability}
    const before=state.project.files["src/App.tsx"]
    const invalid=await editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/validate`,{...auth,file:"src/App.tsx",content:"export default function App( {"})
    expect(invalid.value.validation).toMatchObject({level:"parse",passed:false})
    expect(invalid.value.validation.diagnostics[0]).toMatchObject({file:"src/App.tsx",line:1})
    const corrected=await editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/validate`,{...auth,file:"src/App.tsx",content:"export default function App(){return <main>Corrected</main>}"})
    expect(corrected.value.validation).toEqual({level:"parse",passed:true,diagnostics:[]})
    expect(state.project.files["src/App.tsx"]).toBe(before)
    expect(state.project.revision).toBe(baseRevision)
  })

  it("routes production project APIs before the static SPA fallback",()=>{
    const worker=fs.readFileSync("worker/index.js","utf8")
    expect(worker).toContain('path === "/__webcanbe/api/projects"')
    expect(worker).toContain('path.startsWith("/__webcanbe/api/projects/")')
    expect(worker).toContain("editorProjectRequest")
  })
})


describe("Worker AST Visual transactions",()=>{
  async function setup(source, extra={}, tailwind=false){
    const {db,state}=fakeDb()
    const files=new Map([["package.json",Buffer.from(JSON.stringify({dependencies:{react:"19",vite:"6",...(tailwind?{tailwindcss:"4"}:{})}}))],["src/App.tsx",Buffer.from(source)],...Object.entries(extra).map(([f,s])=>[f,Buffer.from(s)])])
    state.project.files=payload(files)
    state.project.history.revisions[0].contentHash=sourceContentHash(files,state.project.history)
    const session={sessionId,userId,expiresAt:Date.now()+600000}
    const opened=await editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/session`,{})
    const auth={previewId:opened.value.session.previewId,capability:opened.value.session.capability}
    const call=(action,body={},env)=>editorProjectRequest(db,session,`/__webcanbe/api/projects/${projectId}/${action}`,{...auth,...body},env)
    const inspected=await call("inspect",{identity:{file:"src/App.tsx",elementStart:source.indexOf("<main")}})
    return {state,call,target:inspected.value.target}
  }
  it.each([
    ['inline',`export default()=> <main style={{color:"red"}}>Hello</main>`,{},false,'src/App.tsx'],
    ['module',`import s from './a.module.css';export default()=> <main className={s.card}>Hello</main>`,{'src/a.module.css':'.card { color:red; padding:4px }'},false,'src/a.module.css'],
    ['css',`import './a.css';export default()=> <main className="card">Hello</main>`,{'src/a.css':'.card { color:red; padding:4px }'},false,'src/a.css'],
    ['tailwind',`export default()=> <main className="text-red-500 unknown-hook p-4">Hello</main>`,{},true,'src/App.tsx'],
  ])("persists %s color through inspect, history, reopen and export",async(_,source,extra,tailwind,file)=>{
    const {state,call,target}=await setup(source,extra,tailwind)
    expect(target.styleOrigins.find(o=>o.property==='color').editable).toBe(true)
    const body={identity:target.identity,expectedRevision:baseRevision,idempotencyKey:'style-color-retry',edit:{type:'style',property:'color',value:tailwind?'text-blue-500':'blue',scope:'source'}}
    const saved=await call('mutate',body)
    const reopened=await call('files',{file})
    expect(reopened.value.source).toContain(tailwind?'text-blue-500':'blue')
    if(tailwind)expect(reopened.value.source).toContain('unknown-hook p-4')
    expect(reopened.value.revision).toBe(saved.value.revision)
    expect((await call('history')).value.history.transactions).toHaveLength(1)
    expect((await call('mutate',body)).value.replayed).toBe(true)
    expect(state.project.history.transactions).toHaveLength(1)
    await expect(call('mutate',{...body,idempotencyKey:'stale-source-key'})).rejects.toMatchObject({status:409})
    const archive=zipStore(new Map(Object.entries(state.project.files).map(([f,b])=>[f,Buffer.from(b,'base64')])))
    expect(archive.includes(Buffer.from(reopened.value.source))).toBe(true)
  })
  it('shares Visual and Code revisions with conflict-safe undo and redo',async()=>{
    const {state,call,target}=await setup(`export default()=> <main style={{color:"red"}}>Hello</main>`)
    const original=state.project.files['src/App.tsx']
    const saved=await call('mutate',{identity:target.identity,expectedRevision:baseRevision,idempotencyKey:'undo-style-test',edit:{type:'style',property:'color',value:'blue'}})
    const changed=state.project.files['src/App.tsx']
    const undone=await call('revert',{expectedRevision:saved.value.revision,idempotencyKey:'undo-action-test'})
    expect(state.project.files['src/App.tsx']).toBe(original)
    expect(state.project.history.future).toEqual([saved.value.transaction.id])
    const redone=await call('redo',{expectedRevision:undone.value.revision,idempotencyKey:'redo-action-test'})
    expect(state.project.files['src/App.tsx']).toBe(changed)
    expect(state.project.history.past).toEqual([saved.value.transaction.id])
    const source=Buffer.from(changed,'base64').toString()+'\n// Code after Visual'
    const {createHash}=await import('node:crypto')
    await call('code',{expectedRevision:redone.value.revision,idempotencyKey:'code-after-visual',operations:[{kind:'update',file:'src/App.tsx',expectedHash:createHash('sha256').update(Buffer.from(changed,'base64')).digest('hex'),content:source}]})
    const before=structuredClone(state.project)
    await expect(call('revert',{expectedRevision:state.project.revision,idempotencyKey:'selective-conflict',transactionId:saved.value.transaction.id})).rejects.toMatchObject({status:409})
    expect(state.project).toEqual(before)
  })
  const cssCases=[['boxShadow','0 1px 2px black','0 4px 12px rgba(0,0,0,0.2)'],['backgroundColor','red','blue'],['fontSize','16px','24px'],['fontWeight','400','700'],['padding','4px','12px'],['margin','4px','12px'],['gap','4px','12px'],['width','40px','80px'],['height','40px','80px'],['border','1px solid red','2px solid blue'],['borderRadius','4px','12px'],['display','flex','grid'],['flexDirection','row','column'],['alignItems','start','center'],['justifyContent','start','center'],['alignSelf','start','center'],['justifySelf','start','center'],['order','1','2'],['flexGrow','0','1'],['flexShrink','1','0'],['flexBasis','40px','80px'],['gridTemplateColumns','1fr','1fr 1fr'],['gridTemplateRows','1fr','1fr 1fr'],['gridColumn','1','2'],['gridRow','1','2'],['maxWidth','40px','80px'],['minWidth','40px','80px'],['minHeight','40px','80px'],['maxHeight','40px','80px'],['lineHeight','1','1.5'],['letterSpacing','0em','0.1em']]
  it.each(cssCases)('mutates %s through inline and CSS Module source origins',async(property,before,after)=>{
    for(const inline of [true,false]){
      const cssName=property.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())
      const source=inline?`export default()=> <main style={{${property}:${JSON.stringify(before)}}}>Text</main>`:`import s from './x.module.css';export default()=> <main className={s.card}>Text</main>`
      const {state,call,target}=await setup(source,inline?{}:{'src/x.module.css':`.card{${cssName}:${before};--unrelated:keep}`})
      const saved=await call('mutate',{identity:target.identity,expectedRevision:baseRevision,idempotencyKey:'property-matrix-key',edit:{type:'style',property,value:after,scope:'source'}})
      const inspected=await call('inspect',{identity:{file:target.identity.file,elementStart:target.identity.elementStart,revisionId:saved.value.revision}})
      const origin=inspected.value.target.styleOrigins.find(o=>o.property===property)
      expect(origin.value.replace(/^"|"$/g,'')).toBe(after)
      if(!inline)expect(Buffer.from(state.project.files['src/x.module.css'],'base64').toString()).toContain('--unrelated:keep')
      const undone=await call('revert',{expectedRevision:saved.value.revision,idempotencyKey:'matrix-undo-key'})
      expect(undone.value.transaction.editType).toBe('revert')
    }
  })
  it.each([
    ['padding','p-4','p-8'],['paddingX','px-4','px-8'],['paddingY','py-4','py-8'],['margin','m-4','m-8'],['gap','gap-4','gap-8'],['backgroundColor','bg-red-500','bg-blue-500'],['color','text-red-500','text-blue-500'],['fontSize','text-sm','text-lg'],['fontWeight','font-normal','font-bold'],['width','w-4','w-8'],['height','h-4','h-8'],['border','border','border-2'],['borderRadius','rounded-sm','rounded-lg'],['boxShadow','shadow-sm','shadow-lg'],['display','flex','grid'],['flexDirection','flex-row','flex-col'],['alignItems','items-start','items-center'],['justifyContent','justify-start','justify-center'],['alignSelf','self-start','self-center'],['justifySelf','justify-self-start','justify-self-center'],['order','order-1','order-2'],['flexGrow','grow-0','grow'],['flexShrink','shrink','shrink-0'],['flexBasis','basis-4','basis-8'],['gridTemplateColumns','grid-cols-1','grid-cols-2'],['gridTemplateRows','grid-rows-1','grid-rows-2'],['gridColumn','col-start-1','col-start-2'],['gridRow','row-start-1','row-start-2'],['maxWidth','max-w-sm','max-w-lg'],['minWidth','min-w-4','min-w-8'],['minHeight','min-h-4','min-h-8'],['maxHeight','max-h-4','max-h-8'],['lineHeight','leading-tight','leading-loose'],['letterSpacing','tracking-tight','tracking-wide'],
  ])('changes the %s Tailwind token and preserves unrelated classes',async(property,before,after)=>{
    const source=`export default()=> <main className="${before} md:${before} unknown-hook">Text</main>`
    const {state,call,target}=await setup(source,{},true)
    const saved=await call('mutate',{identity:target.identity,expectedRevision:baseRevision,idempotencyKey:'tailwind-matrix-key',edit:{type:'style',property,value:after}})
    expect(Buffer.from(state.project.files['src/App.tsx'],'base64').toString()).toContain(`className="${after} md:${before} unknown-hook"`)
    const inspected=await call('inspect',{identity:{file:'src/App.tsx',elementStart:target.identity.elementStart,revisionId:saved.value.revision}})
    expect(inspected.value.target.styleOrigins.some(o=>o.property===property&&o.value===after)).toBe(true)
  })
  it('fails closed for unknown overlapping shadow utilities',async()=>{
    const {state,call,target}=await setup(`export default()=> <main className="shadow-sm shadow-brand">Text</main>`,{},true)
    const before=structuredClone(state.project)
    expect(target.styleOrigins.find(o=>o.property==='boxShadow').editable).toBe(false)
    await expect(call('mutate',{identity:target.identity,expectedRevision:baseRevision,idempotencyKey:'shadow-ambiguity-key',edit:{type:'style',property:'boxShadow',value:'shadow-lg'}})).rejects.toMatchObject({status:422})
    expect(state.project).toEqual(before)
  })
  it('does not advertise blocked cascade edits and retains the blocking source location',async()=>{
    const {target}=await setup(`import './a.css';export default()=> <main className="card"><span /></main>`,{'src/a.css':'.card { color:red } main { color:blue !important }'})
    expect(target.capabilities.color).toBe(false)
    expect(target.capabilities.visualEdit).toBe(false)
    expect(target.compatibility).toBe('code-only')
    expect(target.styleOrigins.find(o=>o.property==='color').reason).toContain('src/a.css:1:')
  })
  it('inspects important declarations as read-only source evidence',async()=>{
    const {target}=await setup(`import './a.css';export default()=> <main className="card"><span /></main>`,{'src/a.css':'.card { color:red !important }'})
    expect(target.styleOrigins.find(o=>o.property==='color')).toMatchObject({file:'src/a.css',value:'red',editable:false})
    expect(target.capabilities.color).toBe(false)
  })
  it('does not advertise structural reorder from an order declaration or a lone child',async()=>{
    const a=await setup(`export default()=> <main style={{order:1}}>Text</main>`)
    expect(a.target.capabilities.reorder).toBe(false)
    const source=`export default()=> <main style={{display:"flex"}}><span>Only</span></main>`
    const b=await setup(source)
    const inspected=await b.call('inspect',{identity:{file:'src/App.tsx',elementStart:source.indexOf('<span>')}})
    expect(inspected.value.target.capabilities.reorder).toBe(false)
  })
  it('returns source units without inventing units for Tailwind tokens',async()=>{
    const a=await setup(`export default()=> <main style={{padding:16,lineHeight:1.5,width:"50%"}}>Text</main>`)
    expect(a.target.styleOrigins.find(o=>o.property==='padding')).toMatchObject({numericValue:16,unit:'px'})
    expect(a.target.styleOrigins.find(o=>o.property==='lineHeight')).toMatchObject({numericValue:1.5,unit:''})
    expect(a.target.styleOrigins.find(o=>o.property==='width')).toMatchObject({numericValue:50,unit:'%'})
    const b=await setup(`export default()=> <main className="p-4">Text</main>`,{},true)
    expect(b.target.styleOrigins[0].numericValue).toBeUndefined()
    expect(b.target.styleOrigins[0].unit).toBeUndefined()
  })
  it('replays accepted pre-style Worker text fingerprints across the engine upgrade',async()=>{
    const {state,call,target}=await setup(`export default()=> <main>Hello</main>`)
    const body={identity:target.identity,expectedRevision:baseRevision,idempotencyKey:'legacy-text-retry',edit:{type:'text',value:'Previously accepted',scope:'instance'}}
    const saved=await call('mutate',body)
    const {createHash}=await import('node:crypto')
    state.project.history.transactions[0].requestHash=createHash('sha256').update(JSON.stringify({action:'visual-text',base:body.expectedRevision,identity:body.identity,value:body.edit.value})).digest('hex')
    const before=structuredClone(state.project)
    const replay=await call('mutate',body)
    expect(replay.value.replayed).toBe(true)
    expect(replay.value.transaction.id).toBe(saved.value.transaction.id)
    expect(state.project).toEqual(before)
    await expect(call('mutate',{...body,edit:{...body.edit,value:'Different request'}})).rejects.toMatchObject({status:409})
    expect(state.project).toEqual(before)
  })
  it('reopens JSX entities as rendered text without double-escaping subsequent edits',async()=>{
    const {state,call,target}=await setup(`export default()=> <main>Hello</main>`)
    const saved=await call('mutate',{identity:target.identity,expectedRevision:baseRevision,idempotencyKey:'text-entity-first',edit:{type:'text',value:'A & B'}})
    const inspected=await call('inspect',{identity:{file:'src/App.tsx',elementStart:target.identity.elementStart,revisionId:saved.value.revision}})
    expect(inspected.value.target.text).toBe('A & B')
    await call('mutate',{identity:inspected.value.target.identity,expectedRevision:saved.value.revision,idempotencyKey:'text-entity-second',edit:{type:'text',value:inspected.value.target.text+'!'}})
    expect(Buffer.from(state.project.files['src/App.tsx'],'base64').toString()).toContain('A &amp; B!')
    expect(Buffer.from(state.project.files['src/App.tsx'],'base64').toString()).not.toContain('&amp;amp;')
    const encoded=await setup(`export default()=> <main>&quot;Hi&quot; &#65; &copy;</main>`)
    expect(encoded.target.text).toBe('"Hi" A ©')
  })
  it('preserves escaped literal text and rejects executable JSX text injection',async()=>{
    const a=await setup(`export default()=> <main>{"Hello"}</main>`)
    const value='Quotes " and & <script> {expression} 한글'
    const saved=await a.call('mutate',{identity:a.target.identity,expectedRevision:baseRevision,idempotencyKey:'escaped-text-test',edit:{type:'text',value}})
    const read=await a.call('inspect',{identity:{file:'src/App.tsx',elementStart:a.target.identity.elementStart,revisionId:saved.value.revision}})
    expect(read.value.target.text).toBe(value)
    const b=await setup(`export default()=> <main>Hello</main>`)
    const before=structuredClone(b.state.project)
    await expect(b.call('mutate',{identity:b.target.identity,expectedRevision:baseRevision,idempotencyKey:'jsx-injection-test',edit:{type:'text',value:'</main><script />'}})).rejects.toMatchObject({status:422})
    expect(b.state.project).toEqual(before)
  })
  it('updates only the selected responsive origin',async()=>{
    const {state,call,target}=await setup(`export default()=> <main className="p-4 md:p-8 unknown">Hello</main>`,{},true)
    await call('mutate',{identity:target.identity,expectedRevision:baseRevision,idempotencyKey:'responsive-test-key',edit:{type:'style',property:'padding',value:'48px',breakpoint:'tw:md'}})
    expect(Buffer.from(state.project.files['src/App.tsx'],'base64').toString()).toContain('p-4 md:p-12 unknown')
  })
  it.each(['reorder','responsive-create'])('validates staged %s before acceptance and rolls back provider failures',async(type)=>{
    const source=type==='reorder'?`export default()=> <main style={{display:"flex"}}><p>One</p><p>Two</p></main>`:`export default()=> <main className="p-4 unknown">Text</main>`
    const {state,call,target}=await setup(source,{},type!=='reorder')
    const identity=type==='reorder'?(await call('inspect',{identity:{file:'src/App.tsx',elementStart:source.indexOf('<p>')}})).value.target.identity:target.identity
    const edit=type==='reorder'?{type,value:'next',scope:'source'}:{type,property:'padding',value:'32px',breakpoint:'tw:md',scope:'source'}
    const body={identity,edit,expectedRevision:baseRevision,idempotencyKey:'structural-save-test'}
    const before=structuredClone(state.project)
    await expect(call('mutate',body,{BROWSER:{quickAction:async()=>{throw new Error('provider unavailable')}}})).rejects.toMatchObject({status:503})
    expect(state.project).toEqual(before)
    let candidate
    const env={BROWSER:{quickAction:async(_,options)=>{
      expect(state.project).toEqual(before)
      const script=options.addScriptTag[0].content
      candidate=JSON.parse(script.slice(script.indexOf('=')+1,script.indexOf(';globalThis.dispatchEvent')))
      return {screenshot:Buffer.alloc(120,7).toString('base64'),content:'<script id="wcb-observation">'+JSON.stringify({elements:[],viewport:{width:1280,height:900},route:'/'})+'</script>'}
    }}}
    const saved=await call('mutate',body,env)
    const next=Buffer.from(candidate.files['src/App.tsx'],'base64').toString()
    expect(next).toContain(type==='reorder'?'<p>Two</p><p>One</p>':'p-4 md:p-8 unknown')
    expect(state.project.files['src/App.tsx']).toBe(candidate.files['src/App.tsx'])
    await call('revert',{expectedRevision:saved.value.revision,idempotencyKey:'structural-undo-test'})
    expect(state.project.files['src/App.tsx']).toBe(before.files['src/App.tsx'])
  })
  it('builds the actual API export independently from an existing fixture',async()=>{
    const path=await import('node:path')
    const fixtureRoot=path.resolve('fixtures/compatible-react-vite')
    const extra=Object.fromEntries(fs.readdirSync(fixtureRoot,{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>[path.relative(fixtureRoot,path.join(e.parentPath,e.name)),fs.readFileSync(path.join(e.parentPath,e.name),'utf8')]))
    const source=extra['src/App.tsx'].replace('<main>','<main style={{color:"red",boxShadow:"none"}}>')
    extra['src/App.tsx']=source
    const {state,call,target}=await setup(source,extra)
    await call('mutate',{identity:target.identity,expectedRevision:baseRevision,idempotencyKey:'independent-build-test',edit:{type:'style',property:'color',value:'blue'}})
    for(const [file,tag,property,value,breakpoint] of [
      ['src/App.tsx','<main','boxShadow','0 4px 12px rgba(0,0,0,0.2)','base'],
      ['src/components/Hero.tsx','<section','gap','52px','css:(max-width: 720px)'],
      ['src/components/TailwindPanel.tsx','<p','fontSize','text-xl','base'],
      ['src/components/FeatureGrid.tsx','<article','borderRadius','20px','base'],
    ]){
      const current=await call('files',{file})
      const inspected=await call('inspect',{identity:{file,elementStart:current.value.source.indexOf(tag)}})
      await call('mutate',{identity:inspected.value.target.identity,expectedRevision:state.project.revision,idempotencyKey:'fixture-'+property,edit:{type:'style',property,value,breakpoint,scope:'source'}})
    }
    const {buildIndependentExport}=await import('../src/webcanbe-engine/runtime/independentExport.ts')
    const compilingProvider={BROWSER:{quickAction:async(_,options)=>{
      const script=options.addScriptTag[0].content
      const candidate=JSON.parse(script.slice(script.indexOf('=')+1,script.indexOf(';globalThis.dispatchEvent')))
      await buildIndependentExport(zipStore(new Map(Object.entries(candidate.files).map(([f,b])=>[f,Buffer.from(b,'base64')]))),process.cwd())
      return {screenshot:Buffer.alloc(120,7).toString('base64'),content:'<script id="wcb-observation">'+JSON.stringify({elements:[],viewport:{width:1280,height:900},route:'/'})+'</script>'}
    }}}
    for(const [tag,edit] of [
      ['<div>',{type:'reorder',value:'next',scope:'source'}],
      ['<section',{type:'responsive-create',property:'gap',value:'64px',breakpoint:'new:tablet',scope:'source'}],
    ]){
      const file='src/components/Hero.tsx',current=await call('files',{file})
      const inspected=await call('inspect',{identity:{file,elementStart:current.value.source.indexOf(tag)}})
      await call('mutate',{identity:inspected.value.target.identity,expectedRevision:state.project.revision,idempotencyKey:'fixture-'+edit.type,edit},compilingProvider)
    }
    const codeView=await call('files',{file:'src/App.tsx'})
    expect(codeView.value.source).toContain('color:"blue"')
    const {createHash}=await import('node:crypto')
    const code=codeView.value.source+'\n// Accepted Code after Visual'
    await call('code',{expectedRevision:codeView.value.revision,idempotencyKey:'vertical-code-test',operations:[{kind:'update',file:'src/App.tsx',content:code,expectedHash:createHash('sha256').update(codeView.value.source).digest('hex')}]})
    expect((await call('files',{file:'src/App.tsx'})).value.source).toBe(code)
    expect((await call('history')).value.history.transactions.map(t=>t.producer)).toEqual(['visual','visual','visual','visual','visual','visual','visual','code'])
    const exported=await call('export',{expectedRevision:state.project.revision})
    const artifact=await buildIndependentExport(Buffer.from(exported.value.archive,'base64'),process.cwd())
    expect(artifact.sourceUnchanged).toBe(true)
    expect(artifact.html).toContain('assets/app.js')
    expect(artifact.files.size).toBeGreaterThan(0)
    if(process.env.WCB_VISUAL_ARTIFACT_DIR){
      const root=path.resolve(process.env.WCB_VISUAL_ARTIFACT_DIR)
      fs.mkdirSync(root,{recursive:true});fs.writeFileSync(path.join(root,'index.html'),artifact.html)
      for(const [file,value] of artifact.files){const dest=path.join(root,file.replace(/^\//,''));fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,value.body)}
    }
  },20000)
  if(process.env.WCB_VISUAL_DEMO_ROOT) it('preserves the pinned original E2E demo through Visual, Code, undo/redo and independent export',async()=>{
    const path=await import('node:path'),{execFileSync}=await import('node:child_process')
    const root=path.resolve(process.env.WCB_VISUAL_DEMO_ROOT)
    expect(execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()).toBe('00b47131c23785b607c2d3b459c331316dad5767')
    const names=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean)
    const extra=Object.fromEntries(names.map(file=>[file,fs.readFileSync(path.join(root,file),'utf8')]))
    const source=extra['src/App.tsx'],{state,call}=await setup(source,extra)
    const grid=(await call('inspect',{identity:{file:'src/App.tsx',elementStart:source.indexOf('<div className="project-grid"')}})).value.target
    const saved=await call('mutate',{identity:grid.identity,expectedRevision:baseRevision,idempotencyKey:'demo-grid-gap-edit',edit:{type:'style',property:'gap',value:'40px',scope:'source'}})
    const heading=(await call('inspect',{identity:{file:'src/App.tsx',elementStart:source.indexOf('<h2>Selected work')}})).value.target
    await call('mutate',{identity:heading.identity,expectedRevision:state.project.revision,idempotencyKey:'demo-heading-edit',edit:{type:'text',value:'Selected studies'}})
    const current=(await call('files',{file:'src/App.tsx'})).value.source,{createHash}=await import('node:crypto')
    await call('code',{expectedRevision:state.project.revision,idempotencyKey:'demo-code-edit-key',operations:[{kind:'update',file:'src/App.tsx',expectedHash:createHash('sha256').update(current).digest('hex'),content:current+'\n// Code and Visual share this accepted source'}]})
    await call('revert',{expectedRevision:state.project.revision,idempotencyKey:'demo-gap-undo-key',transactionId:saved.value.transaction.id})
    expect((await call('files',{file:'src/styles.css'})).value.source).toBe(extra['src/styles.css'])
    await call('redo',{expectedRevision:state.project.revision,idempotencyKey:'demo-gap-redo-key'})
    expect((await call('files',{file:'src/App.tsx'})).value.source).toContain('Selected studies')
    const exported=await call('export',{expectedRevision:state.project.revision})
    const {buildIndependentExport}=await import('../src/webcanbe-engine/runtime/independentExport.ts')
    const artifact=await buildIndependentExport(Buffer.from(exported.value.archive,'base64'),process.cwd())
    expect(artifact.sourceUnchanged).toBe(true)
    if(process.env.WCB_VISUAL_DEMO_ARTIFACT_DIR){
      const destination=path.resolve(process.env.WCB_VISUAL_DEMO_ARTIFACT_DIR)
      fs.mkdirSync(destination,{recursive:true});fs.writeFileSync(path.join(destination,'index.html'),artifact.html)
      for(const [file,value] of artifact.files){const dest=path.join(destination,file.replace(/^\//,''));fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,value.body)}
    }
  },20000)
  it('rejects stale identity hashes and shared scope without changing accepted history',async()=>{
    const source=`import './a.css';export default()=> <main className="card"><span className="card">Hello</span></main>`
    const {state,call,target}=await setup(source,{'src/a.css':'.card{color:red}'})
    const before=structuredClone(state.project)
    const body={identity:target.identity,expectedRevision:baseRevision,idempotencyKey:'shared-style-test',edit:{type:'style',property:'color',value:'blue'}}
    await expect(call('mutate',body)).rejects.toMatchObject({status:422})
    await expect(call('mutate',{...body,identity:{...target.identity,contentHash:'0'.repeat(64)}})).rejects.toMatchObject({status:409})
    expect(state.project).toEqual(before)
  })
  it('rejects malformed staged source before acceptance',async()=>{
    const {state,call,target}=await setup(`export default()=> <main style={{color:"red"}}>Hello</main>`)
    const before=structuredClone(state.project)
    await expect(call('mutate',{identity:target.identity,expectedRevision:baseRevision,idempotencyKey:'invalid-style-test',edit:{type:'style',property:'color',value:'red; }'}})).rejects.toMatchObject({status:422})
    expect(state.project).toEqual(before)
  })
})
