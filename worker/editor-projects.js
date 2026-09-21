import { Buffer } from "node:buffer"
import { createHash, randomBytes, randomUUID } from "node:crypto"

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const REVISION = /^rev_[a-f0-9-]{36}$/i
const IDEMPOTENCY = /^[A-Za-z0-9_-]{8,160}$/
const SOURCE_FILE = /\.(?:tsx?|jsx?|mts|cts|mjs|cjs|css|json)$/i
const LIMITS = Object.freeze({ entries: 2000, fileBytes: 2 * 1024 * 1024, totalBytes: 40 * 1024 * 1024, historyBytes: 64 * 1024 * 1024, draftsBytes: 8 * 1024 * 1024 })
const sha256 = value => createHash("sha256").update(value).digest("hex")

export class EditorProjectError extends Error {
  constructor(status, message) {
    super(message)
    this.name = "EditorProjectError"
    this.status = status
  }
}

function fail(status, message) { throw new EditorProjectError(status, message) }

function safePath(value) {
  if (typeof value !== "string" || !value || value.length > 512 || /[\x00-\x1f\x7f\\:]/.test(value) || value.startsWith("/") || value !== value.normalize("NFC")) return false
  const parts = value.split("/")
  if (parts.length > 20 || parts.some(part => !part || part.length > 128 || part === "." || part === ".." || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part))) return false
  if (parts.some(part => ["node_modules", ".git", ".webcanbe"].includes(part.toLowerCase()) || /^\.env(?:$|\.)/i.test(part) && !/^\.env\.example$/i.test(part))) return false
  return true
}
function sourceMember(file, history) {
  const directory = typeof history?.sourceDirectory === "string" ? history.sourceDirectory : "src"
  return safePath(file) && file.startsWith(directory + "/") && SOURCE_FILE.test(file)
}
function decodePayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(409, "Stored project source is invalid.")
  const files = new Map(), seen = new Set()
  let total = 0
  for (const [file, encoded] of Object.entries(value)) {
    if (!safePath(file) || seen.has(file.toLowerCase()) || typeof encoded !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) fail(409, "Stored project source is invalid.")
    const bytes = Buffer.from(encoded, "base64")
    total += bytes.length
    if (bytes.length > LIMITS.fileBytes || total > LIMITS.totalBytes || files.size >= LIMITS.entries) fail(409, "Stored project source exceeds limits.")
    seen.add(file.toLowerCase()); files.set(file, bytes)
  }
  return files
}
function encodePayload(files) {
  const result = Object.create(null)
  let total = 0
  for (const [file, bytes] of [...files].sort(([a],[b]) => a.localeCompare(b))) {
    if (!safePath(file)) fail(422, "Invalid project source path.")
    const data = Buffer.from(bytes)
    total += data.length
    if (data.length > LIMITS.fileBytes || total > LIMITS.totalBytes || Object.keys(result).length >= LIMITS.entries) fail(422, "Project source exceeds limits.")
    result[file] = data.toString("base64")
  }
  return result
}
function textFiles(files, history) {
  const decoder = new TextDecoder("utf-8", { fatal: true })
  const result = new Map()
  try {
    for (const [file, bytes] of files) if (sourceMember(file, history)) result.set(file, decoder.decode(bytes))
  } catch { fail(409, "Stored editable source is not valid UTF-8.") }
  return result
}
export function sourceContentHash(files, history) {
  const pairs = [...textFiles(files, history)].sort(([a],[b]) => a.localeCompare(b))
  return sha256(JSON.stringify(pairs))
}
function verifyProjectState(projectId, row) {
  if (!row?.revision || !REVISION.test(String(row.revision)) || !row.history || row.history.schema !== 1 || row.history.projectId !== projectId || !Array.isArray(row.history.revisions) || !row.history.revisions.length || !Array.isArray(row.history.transactions) || !Array.isArray(row.history.past) || !Array.isArray(row.history.future)) fail(409, "Stored project history is invalid.")
  if (Buffer.byteLength(JSON.stringify(row.history)) > LIMITS.historyBytes) fail(409, "Stored project history exceeds limits.")
  const files = decodePayload(row.files)
  const head = row.history.revisions.at(-1)
  if (head?.revisionId !== row.revision || head?.contentHash !== sourceContentHash(files, row.history)) fail(409, "Stored source and history disagree.")
  return { files, history: structuredClone(row.history), revision: String(row.revision), epoch: String(row.source_epoch) }
}

function detectProject(name, files) {
  let packageJson = {}
  const raw = files.get("package.json")
  if (raw) {
    try { packageJson = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw)) } catch {}
  }
  const deps = { ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}) }
  const interesting = ["react","react-dom","vite","typescript","tailwindcss","@tailwindcss/vite","react-router-dom"]
  return {
    id: name.id,
    name: name.name || "Hosted project",
    imported: true,
    detection: {
      framework: deps.react && deps.vite ? "React / Vite" : deps.react ? "React" : deps.vite ? "Vite" : "Source project",
      tailwind: Boolean(deps.tailwindcss || deps["@tailwindcss/vite"] || [...files.keys()].some(file => /tailwind\.config\./.test(file))),
      dependencies: interesting.filter(key => deps[key]).map(key => ({ name: key, declared: String(deps[key]), resolved: true })),
    },
  }
}

async function authorityRow(db, session, projectId, write = false, lock = "") {
  if (!UUID.test(String(projectId))) fail(404, "Project is unavailable.")
  const roles = write ? ["owner","editor"] : ["owner","editor","viewer"]
  const result = await db.query(
    `SELECT p.project_id,p.workspace_id,p.name,p.revision,p.files,p.history,p.source_epoch,
            pm.role,pm.epoch AS membership_epoch,wm.epoch AS workspace_epoch
       FROM wcb_projects p
       JOIN wcb_project_members pm ON pm.project_id=p.project_id AND pm.user_id=$2 AND pm.active
       JOIN wcb_workspace_members wm ON wm.workspace_id=p.workspace_id AND wm.user_id=$2 AND wm.active
       JOIN wcb_sessions s ON s.session_id=$3 AND s.user_id=$2 AND s.active
      WHERE p.project_id=$1 AND NOT p.deleted
        AND pm.role = ANY($4::text[])
        AND s.expires_at=to_timestamp($5/1000.0) AND s.expires_at>clock_timestamp()
        AND NOT EXISTS(SELECT 1 FROM wcb_disabled_users d WHERE d.user_id=$2)
      ${lock}`,
    [projectId, session.userId, session.sessionId, roles, session.expiresAt],
  )
  if (!result.rowCount) fail(403, "Project authority is unavailable.")
  return result.rows[0]
}

async function issueCapability(db, session, project) {
  const previewId = randomUUID(), capability = randomBytes(32).toString("base64url")
  const expiresAt = Math.min(session.expiresAt, Date.now() + 10 * 60_000)
  const grant = {
    sessionId: session.sessionId,
    userId: session.userId,
    projectId: String(project.project_id),
    workspaceId: String(project.workspace_id),
    role: String(project.role),
    membershipVersion: Number(project.membership_epoch),
    workspaceVersion: Number(project.workspace_epoch),
  }
  await db.query("DELETE FROM wcb_editor_capabilities WHERE expires_at<=clock_timestamp() OR revoked")
  const count = Number((await db.query("SELECT count(*) AS n FROM wcb_editor_capabilities WHERE grant_json->>'sessionId'=$1", [session.sessionId])).rows[0]?.n ?? 0)
  if (count >= 100) fail(429, "Editor session capacity reached.")
  await db.query(
    "INSERT INTO wcb_editor_capabilities(preview_id,project_id,token_hash,grant_json,expires_at,revoked) VALUES($1,$2,$3,$4,to_timestamp($5/1000.0),false)",
    [previewId, project.project_id, sha256(capability), JSON.stringify(grant), expiresAt],
  )
  return { projectId: String(project.project_id), previewId, capability, expiresAt: new Date(expiresAt).toISOString() }
}

async function verifyCapability(db, session, projectId, body, write = false) {
  const previewId = typeof body?.previewId === "string" ? body.previewId : ""
  const capability = typeof body?.capability === "string" ? body.capability : ""
  if (!UUID.test(previewId) || !/^[A-Za-z0-9_-]{43}$/.test(capability)) fail(403, "Editor capability is unavailable.")
  const project = await authorityRow(db, session, projectId, write)
  const result = await db.query(
    `SELECT grant_json
       FROM wcb_editor_capabilities
      WHERE preview_id=$1 AND project_id=$2 AND token_hash=$3
        AND NOT revoked AND expires_at>clock_timestamp()`,
    [previewId, projectId, sha256(capability)],
  )
  const grant = result.rows[0]?.grant_json
  if (!grant || grant.sessionId !== session.sessionId || grant.userId !== session.userId || grant.projectId !== projectId || grant.workspaceId !== String(project.workspace_id) || grant.role !== String(project.role) || Number(grant.membershipVersion) !== Number(project.membership_epoch) || Number(grant.workspaceVersion) !== Number(project.workspace_epoch)) fail(403, "Editor capability is unavailable.")
  return project
}

function draftState(row) {
  return row ? { version: Number(row.version), drafts: Array.isArray(row.payload) ? row.payload : [] } : { version: 0, drafts: [] }
}
function validateDrafts(value) {
  if (!Array.isArray(value) || value.length > 100 || Buffer.byteLength(JSON.stringify(value)) > LIMITS.draftsBytes) fail(422, "Draft quota exceeded.")
  const seen = new Set()
  return value.map(draft => {
    if (!draft || typeof draft !== "object" || Object.keys(draft).some(key => !["file","text","baseline","hash","baseRevision"].includes(key)) || typeof draft.file !== "string" || !safePath(draft.file) || !SOURCE_FILE.test(draft.file) || seen.has(draft.file.toLowerCase()) || typeof draft.text !== "string" || typeof draft.baseline !== "string" || draft.hash !== sha256(draft.baseline) || typeof draft.baseRevision !== "string" || !REVISION.test(draft.baseRevision)) fail(422, "Invalid draft source reference.")
    for (const text of [draft.text,draft.baseline]) if (text.includes("\0") || Buffer.byteLength(text) > LIMITS.fileBytes) fail(422, "Invalid draft source text.")
    seen.add(draft.file.toLowerCase())
    return { file:draft.file,text:draft.text,baseline:draft.baseline,hash:draft.hash,baseRevision:draft.baseRevision }
  })
}

function publicFiles(state) {
  return [...textFiles(state.files, state.history)].sort(([a],[b]) => a.localeCompare(b)).map(([file,source]) => ({ file, hash: sha256(source) }))
}

function searchSource(state, query, caseSensitive, requestedLimit) {
  if (typeof query !== "string" || !query || query.length > 160 || /[\r\n\0]/.test(query)) fail(400, "Search query must be 1–160 single-line characters.")
  if (caseSensitive !== undefined && typeof caseSensitive !== "boolean") fail(400, "Invalid search case option.")
  const limit = requestedLimit === undefined ? 100 : Number(requestedLimit)
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) fail(400, "Search result limit must be between 1 and 100.")
  const escaped = [...query].map(character => "^$.*+?()[]{}|".includes(character) || character.charCodeAt(0) === 92 ? "\\" + character : character).join("")
  const pattern = new RegExp(escaped, caseSensitive ? "g" : "gi")
  const entries = [...textFiles(state.files, state.history)].sort(([a],[b]) => a.localeCompare(b))
  const results = []
  let scannedFiles=0, scannedBytes=0, truncated=false
  for (const [file,source] of entries) {
    const bytes=Buffer.byteLength(source)
    if(bytes>512*1024||scannedBytes+bytes>8*1024*1024){truncated=true;continue}
    scannedFiles++;scannedBytes+=bytes;pattern.lastIndex=0
    let perFile=0,match
    while(results.length<limit&&perFile<20&&(match=pattern.exec(source))){
      const start=match.index,end=start+match[0].length,before=source.slice(0,start),line=before.split("\n").length,lineStart=before.lastIndexOf("\n")+1,lineEnd=source.indexOf("\n",end)
      results.push({file,start,end,line,column:start-lineStart+1,preview:source.slice(Math.max(lineStart,start-90),Math.min(lineEnd<0?source.length:lineEnd,end+90)).replace(/[\r\n\t]+/g," ")})
      perFile++;if(!match[0].length)pattern.lastIndex++
    }
    if(results.length>=limit){truncated=true;break}
  }
  return { searchResults:results,searchMeta:{scannedFiles,totalFiles:entries.length,scannedBytes,truncated},revision:state.revision }
}

function operationChanges(state, operations) {
  if (!Array.isArray(operations) || !operations.length || operations.length > 100) fail(422, "Provide 1–100 source file operations.")
  const before = textFiles(state.files, state.history)
  const after = new Map(before), changes=[], touched=new Set()
  for (const op of operations) {
    if (!op || typeof op !== "object" || !["update","create","delete","rename"].includes(op.kind)) fail(422, "Invalid source operation.")
    const file = op.file
    if (!sourceMember(file, state.history) || touched.has(file)) fail(422, "Source operation is outside the editable source scope.")
    touched.add(file)
    const current = after.get(file)
    const actual = current === undefined ? null : sha256(current)
    if (op.kind === "create") {
      if (op.expectedHash !== null || current !== undefined || typeof op.content !== "string") fail(409, "Source file identity changed.")
      if (Buffer.byteLength(op.content) > LIMITS.fileBytes || op.content.includes("\0")) fail(422, "Source file exceeds limits.")
      after.set(file, op.content);changes.push({file,before:null,after:op.content})
    } else if (op.kind === "update") {
      if (typeof op.expectedHash !== "string" || actual !== op.expectedHash || typeof op.content !== "string") fail(409, "Source file identity changed.")
      if (Buffer.byteLength(op.content) > LIMITS.fileBytes || op.content.includes("\0")) fail(422, "Source file exceeds limits.")
      after.set(file, op.content);changes.push({file,before:current,after:op.content})
    } else if (op.kind === "delete") {
      if (typeof op.expectedHash !== "string" || actual !== op.expectedHash || current === undefined) fail(409, "Source file identity changed.")
      after.delete(file);changes.push({file,before:current,after:null})
    } else {
      const to = op.to
      if (typeof op.expectedHash !== "string" || actual !== op.expectedHash || current === undefined || !sourceMember(to, state.history) || touched.has(to) || after.has(to)) fail(409, "Source file identity changed.")
      touched.add(to);after.delete(file);after.set(to, typeof op.content === "string" ? op.content : current)
      changes.push({file,before:current,after:null},{file:to,before:null,after:typeof op.content === "string" ? op.content : current})
    }
  }
  return { before, after, changes }
}
function applyTextMapToFiles(files, text, history) {
  const next=new Map(files)
  for(const [file,value] of text) next.set(file,Buffer.from(value,"utf8"))
  for(const file of [...next.keys()]) if(sourceMember(file, history) && !text.has(file)) next.delete(file)
  encodePayload(next)
  return next
}

function transactionFor({projectId,userId,baseRevision,newRevision,idempotencyKey,requestHash,operations,changes,newContentHash,producer="code",editType="code",target,range,before,after,summary}) {
  const id="wcb_"+randomUUID(),timestamp=new Date().toISOString()
  const validation={level:"parse",passed:true,diagnostics:[]}
  const versions=Object.fromEntries(changes.map(change=>[change.file,{before:change.before===null?"absent":sha256(change.before),after:change.after===null?"absent":sha256(change.after)}]))
  const tx={
    id,timestamp,file:changes[0]?.file??"",range:range??{start:0,end:changes[0]?.before?.length??0},editType,
    before:before??changes[0]?.before??"",after:after??changes[0]?.after??"",target:target??{file:changes[0]?.file??"",elementStart:0},
    patches:changes.map(change=>({file:change.file,range:{start:0,end:change.before?.length??0},before:change.before??"",after:change.after??""})),
    versions,success:true,projectId,baseRevisionId:baseRevision,newRevisionId:newRevision,idempotencyKey,requestHash,
    producer,actor:userId,summary:(summary??(operations.length===1?`Update ${changes[0]?.file??"source"}`:`Update ${operations.length} source files`)).slice(0,200),
    status:"accepted",operations,fileStates:changes,validation,
  }
  return {tx,revision:{revisionId:newRevision,parentRevisionId:baseRevision,projectId,createdAt:timestamp,producer,actor:userId,contentHash:newContentHash,transactionId:id},validation}
}

async function saveCode(db, session, projectId, body) {
  if (typeof body.expectedRevision !== "string" || !REVISION.test(body.expectedRevision) || typeof body.idempotencyKey !== "string" || !IDEMPOTENCY.test(body.idempotencyKey)) fail(400, "A current revision and bounded idempotency key are required.")
  const requestHash=sha256(JSON.stringify({action:"code",base:body.expectedRevision,operations:body.operations,rewriteImports:body.rewriteImports===true}))
  await db.query("BEGIN")
  try {
    await verifyCapability(db,session,projectId,body,true)
    const row=(await db.query("SELECT revision,files,history,source_epoch,workspace_id FROM wcb_projects WHERE project_id=$1 AND NOT deleted FOR UPDATE",[projectId])).rows[0]
    if(!row) fail(404,"Project is unavailable.")
    const state=verifyProjectState(projectId,row)
    const prior=state.history.transactions.find(item=>item.idempotencyKey===body.idempotencyKey)
    if(prior){
      if(prior.requestHash!==requestHash) fail(409,"Idempotency key was already used for a different source request.")
      await verifyCapability(db,session,projectId,body,true)
      await db.query("COMMIT")
      return {status:200,value:{transaction:prior,replayed:true,validation:prior.validation,revision:state.revision}}
    }
    if(state.revision!==body.expectedRevision) fail(409,"Source or preview changed; reload and retry.")
    if(body.rewriteImports===true && body.operations?.some(op=>op?.kind==="rename")) fail(422,"Automatic import rewriting is not enabled on the production Worker yet.")
    const prepared=operationChanges(state,body.operations)
    const nextFiles=applyTextMapToFiles(state.files,prepared.after,state.history)
    const nextContentHash=sourceContentHash(nextFiles,state.history)
    const nextRevision="rev_"+randomUUID()
    const {tx,revision,validation}=transactionFor({projectId,userId:session.userId,baseRevision:state.revision,newRevision:nextRevision,idempotencyKey:body.idempotencyKey,requestHash,operations:body.operations,changes:prepared.changes,newContentHash:nextContentHash})
    const history=structuredClone(state.history)
    history.transactions.push(tx);history.revisions.push(revision);history.past.push(tx.id);history.future=[]
    if(history.transactions.length>5000||history.revisions.length>5000||Buffer.byteLength(JSON.stringify(history))>LIMITS.historyBytes) fail(409,"Project history capacity reached.")
    const payload=encodePayload(nextFiles)
    await verifyCapability(db,session,projectId,body,true)
    const changed=await db.query("UPDATE wcb_projects SET revision=$2,files=$3,history=$4,source_epoch=source_epoch+1 WHERE project_id=$1 AND revision=$5 AND source_epoch=$6 RETURNING source_epoch",[projectId,nextRevision,JSON.stringify(payload),JSON.stringify(history),state.revision,state.epoch])
    if(!changed.rowCount) fail(409,"Source or preview changed; reload and retry.")
    await verifyCapability(db,session,projectId,body,true)
    await db.query("COMMIT")
    return {status:200,value:{transaction:tx,replayed:false,validation,revision:nextRevision}}
  } catch(error) {
    await db.query("ROLLBACK").catch(()=>{})
    throw error
  }
}


function simpleTarget(state, identity) {
  if (!identity || typeof identity !== "object" || typeof identity.file !== "string" || !Number.isInteger(identity.elementStart)) fail(400, "Invalid source identity.")
  if (!sourceMember(identity.file,state.history)) fail(404,"Source target is unavailable.")
  const source=textFiles(state.files,state.history).get(identity.file)
  if(source===undefined||identity.elementStart<0||identity.elementStart>=source.length)fail(404,"Source target is unavailable.")
  const start=identity.elementStart
  const opening=/^<([a-z][a-z0-9-]*)(?:\s[^<>]*?)?>/i.exec(source.slice(start,Math.min(source.length,start+4096)))
  if(!opening)fail(409,"Source target no longer matches the accepted revision.")
  const tag=opening[1].toLowerCase(),openingEnd=start+opening[0].length,close="</"+tag+">",closeIndex=source.indexOf(close,openingEnd)
  let text,textRange
  if(closeIndex>=openingEnd){
    const between=source.slice(openingEnd,closeIndex)
    if(between.length&&between.trim()===between&&!/[<>{}]/.test(between)){
      text=between;textRange={start:openingEnd,end:closeIndex}
    }
  }
  const sourceEnd=closeIndex>=0?closeIndex+close.length:openingEnd
  const canText=Boolean(textRange)
  return {
    identity:{file:identity.file,elementStart:start,revisionId:state.revision,contentHash:sha256(source)},
    elementName:tag,nodeKind:"native",sourceRange:{start,end:sourceEnd},
    ...(textRange?{text,textRange,textFile:identity.file,textShared:false}:{}),
    styleOrigins:[],effectScope:"identified source",
    capabilities:{preview:true,codeEdit:true,visualEdit:canText,text:canText,spacing:false,color:false,typography:false,size:false,layout:false,reorder:false},
    compatibility:canText?"partial":"code-only",
    unavailableReasons:canText?{}:{visualEdit:"This production preview currently supports safe static-text Visual edits. Use Code for this element."},
    reasonCodes:canText?[]:["production-preview-text-only"],
  }
}

function simpleCompatibility(state){
  const targets=[]
  for(const [file,source] of textFiles(state.files,state.history)){
    const regex=/<([a-z][a-z0-9-]*)(?:\s[^<>]*?)?>/gi
    let match
    while((match=regex.exec(source))&&targets.length<300){
      try{targets.push(simpleTarget(state,{file,elementStart:match.index}))}catch{}
      if(!match[0].length)regex.lastIndex++
    }
  }
  const partial=targets.filter(target=>target.capabilities.visualEdit).length,codeOnly=targets.length-partial
  return {summary:{total:targets.length,full:0,partial,codeOnly,score:targets.length?Math.round(partial/targets.length*70):0},targets,breakpoints:[{id:"base",label:"Base"}],styleDiagnostics:["Production Browser Run preview currently enables safe static-text Visual edits; complex style/layout edits remain Code-first until the full hosted runner is attached."]}
}

function previewPayload(state,route="/"){
  const files=Object.fromEntries([...state.files].sort(([a],[b])=>a.localeCompare(b)).map(([file,bytes])=>[file,Buffer.from(bytes).toString("base64")]))
  return {files,entry:["src/main.tsx","src/main.jsx","src/main.ts","src/main.js"].find(file=>files[file]!==undefined),title:"Webcanbe isolated preview",route}
}

function parseBrowserObservation(content){
  if(typeof content!=="string")fail(503,"Browser preview content is unavailable.")
  const match=/<script[^>]*id=["']wcb-observation["'][^>]*>([\s\S]*?)<\/script>/i.exec(content)
  if(!match)fail(503,"Browser preview did not return source observations.")
  let value
  try{value=JSON.parse(match[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>'))}catch{fail(503,"Browser preview observation was invalid.")}
  if(!value||typeof value!=="object"||!Array.isArray(value.elements))fail(503,"Browser preview observation was invalid.")
  if(value.error)fail(422,String(value.error).slice(0,1000))
  return value
}

async function browserSnapshot(env,state,viewport,route){
  if(!env?.BROWSER||typeof env.BROWSER.quickAction!=="function")fail(503,"Browser Run preview binding is unavailable.")
  const width=viewport==="mobile"?390:viewport==="tablet"?768:1280
  const payload=previewPayload(state,route)
  const injection="globalThis.__WCB_PROJECT_PAYLOAD__="+JSON.stringify(payload).replace(/</g,"\\u003c")+";globalThis.dispatchEvent(new Event('wcb-project-payload'));"
  let response
  try{
    response=await env.BROWSER.quickAction("snapshot",{
      url:"https://webcanbe.com/preview-runtime.html",
      formats:["content","screenshot"],
      viewport:{width,height:900,deviceScaleFactor:1},
      gotoOptions:{waitUntil:"domcontentloaded",timeout:15000},
      waitForSelector:{selector:"html[data-wcb-ready='1']",timeout:12000,visible:false},
      addScriptTag:[{content:injection}],
      allowRequestPattern:["/^https:\\/\\/webcanbe\\.com\\/(?:preview-runtime\\.html|assets\\/[^?#]+)$/"],
    })
  }catch(error){
    const message=error instanceof Error?error.message:"Browser Run preview failed."
    if(/429|limit|quota|time/i.test(message))fail(429,"Free preview capacity is cooling down. Wait about 10 seconds and refresh preview.")
    fail(503,"Browser Run preview is temporarily unavailable.")
  }
  let body
  try{
    if(response instanceof Response){
      if(!response.ok){
        if(response.status===429)fail(429,"Free preview capacity is cooling down. Wait about 10 seconds and refresh preview.")
        fail(503,"Browser Run preview request failed.")
      }
      body=await response.json()
    }else body=response
  }catch(error){
    if(error instanceof EditorProjectError)throw error
    fail(503,"Browser Run preview response was invalid.")
  }
  const result=body?.result??body
  const png=result?.screenshot,content=result?.content
  if(typeof png!=="string"||png.length<100||png.length>16*1024*1024||!/^[A-Za-z0-9+/]+={0,2}$/.test(png))fail(503,"Browser preview screenshot was invalid.")
  const observation=parseBrowserObservation(content)
  return {png,observation,width}
}

async function saveVisualText(db,session,projectId,body){
  if(typeof body.expectedRevision!=="string"||!REVISION.test(body.expectedRevision)||typeof body.idempotencyKey!=="string"||!IDEMPOTENCY.test(body.idempotencyKey))fail(400,"A current revision and bounded idempotency key are required.")
  if(!body.edit||body.edit.type!=="text"||typeof body.edit.value!=="string"||body.edit.value.includes("\0")||Buffer.byteLength(body.edit.value)>32*1024)fail(422,"Only bounded static-text Visual edits are enabled in the production preview.")
  const requestHash=sha256(JSON.stringify({action:"visual-text",base:body.expectedRevision,identity:body.identity,value:body.edit.value}))
  await db.query("BEGIN")
  try{
    await verifyCapability(db,session,projectId,body,true)
    const row=(await db.query("SELECT revision,files,history,source_epoch,workspace_id FROM wcb_projects WHERE project_id=$1 AND NOT deleted FOR UPDATE",[projectId])).rows[0]
    if(!row)fail(404,"Project is unavailable.")
    const state=verifyProjectState(projectId,row)
    const prior=state.history.transactions.find(item=>item.idempotencyKey===body.idempotencyKey)
    if(prior){
      if(prior.requestHash!==requestHash)fail(409,"Idempotency key was already used for a different Visual request.")
      await verifyCapability(db,session,projectId,body,true);await db.query("COMMIT")
      return {status:200,value:{transaction:prior,replayed:true,validation:prior.validation,revision:state.revision,diff:""}}
    }
    if(state.revision!==body.expectedRevision)fail(409,"Source or preview changed; reload and retry.")
    const target=simpleTarget(state,body.identity)
    if(!target.textRange||!target.capabilities.text)fail(422,"This element is not a safe static-text Visual target.")
    const files=textFiles(state.files,state.history),source=files.get(target.identity.file)
    const nextSource=source.slice(0,target.textRange.start)+body.edit.value+source.slice(target.textRange.end)
    const operations=[{kind:"update",file:target.identity.file,expectedHash:sha256(source),content:nextSource}]
    const prepared=operationChanges(state,operations)
    const nextFiles=applyTextMapToFiles(state.files,prepared.after,state.history),nextContentHash=sourceContentHash(nextFiles,state.history),nextRevision="rev_"+randomUUID()
    const {tx,revision,validation}=transactionFor({
      projectId,userId:session.userId,baseRevision:state.revision,newRevision:nextRevision,idempotencyKey:body.idempotencyKey,requestHash,operations,changes:prepared.changes,newContentHash:nextContentHash,
      producer:"visual",editType:"text",target:{...target.identity,revisionId:state.revision},range:target.textRange,before:target.text,after:body.edit.value,summary:"Visual text edit "+target.identity.file,
    })
    const history=structuredClone(state.history);history.transactions.push(tx);history.revisions.push(revision);history.past.push(tx.id);history.future=[]
    if(history.transactions.length>5000||history.revisions.length>5000||Buffer.byteLength(JSON.stringify(history))>LIMITS.historyBytes)fail(409,"Project history capacity reached.")
    const changed=await db.query("UPDATE wcb_projects SET revision=$2,files=$3,history=$4,source_epoch=source_epoch+1 WHERE project_id=$1 AND revision=$5 AND source_epoch=$6 RETURNING source_epoch",[projectId,nextRevision,JSON.stringify(encodePayload(nextFiles)),JSON.stringify(history),state.revision,state.epoch])
    if(!changed.rowCount)fail(409,"Source or preview changed; reload and retry.")
    await verifyCapability(db,session,projectId,body,true);await db.query("COMMIT")
    const diff="--- "+target.identity.file+"\n+++ "+target.identity.file+"\n- "+target.text+"\n+ "+body.edit.value
    return {status:200,value:{transaction:tx,replayed:false,validation,revision:nextRevision,diff}}
  }catch(error){await db.query("ROLLBACK").catch(()=>{});throw error}
}

function crc32(bytes) {
  let crc=0xffffffff
  for(const byte of bytes){
    crc^=byte
    for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)
  }
  return (crc^0xffffffff)>>>0
}
function u16(value){const b=Buffer.alloc(2);b.writeUInt16LE(value>>>0);return b}
function u32(value){const b=Buffer.alloc(4);b.writeUInt32LE(value>>>0);return b}
export function zipStore(files) {
  const local=[],central=[];let offset=0,count=0
  for(const [name,input] of [...files].sort(([a],[b])=>a.localeCompare(b))){
    if(!safePath(name))fail(422,"Export path is invalid.")
    const data=Buffer.from(input),fileName=Buffer.from(name,"utf8"),crc=crc32(data)
    const header=Buffer.concat([u32(0x04034b50),u16(20),u16(0x0800),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(fileName.length),u16(0),fileName])
    local.push(header,data)
    const center=Buffer.concat([u32(0x02014b50),u16(20),u16(20),u16(0x0800),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(fileName.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),fileName])
    central.push(center);offset+=header.length+data.length;count++
  }
  const centralSize=central.reduce((n,b)=>n+b.length,0)
  const end=Buffer.concat([u32(0x06054b50),u16(0),u16(0),u16(count),u16(count),u32(centralSize),u32(offset),u16(0)])
  return Buffer.concat([...local,...central,end])
}

async function drafts(db,session,projectId,body) {
  const write=body.command==="save"
  await verifyCapability(db,session,projectId,body,write)
  if(body.command!==undefined && body.command!=="save") fail(400,"Unknown draft operation.")
  if(!write){
    const row=(await db.query("SELECT version,payload FROM wcb_drafts WHERE project_id=$1 AND user_id=$2",[projectId,session.userId])).rows[0]
    await verifyCapability(db,session,projectId,body,false)
    return {status:200,value:{draftState:draftState(row)}}
  }
  const nextDrafts=validateDrafts(body.drafts)
  await db.query("BEGIN")
  try{
    await verifyCapability(db,session,projectId,body,true)
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,2))",[projectId+":"+session.userId])
    const row=(await db.query("SELECT version,payload FROM wcb_drafts WHERE project_id=$1 AND user_id=$2 FOR UPDATE",[projectId,session.userId])).rows[0]
    const current=draftState(row)
    if(JSON.stringify(current.drafts)===JSON.stringify(nextDrafts)){await db.query("COMMIT");return {status:200,value:{draftState:current}}}
    if(!Number.isSafeInteger(body.version)||body.version!==current.version)fail(409,"Draft backup changed in another editor. Reload before replacing it.")
    const next={version:current.version+1,drafts:nextDrafts}
    await db.query("INSERT INTO wcb_drafts(project_id,user_id,version,payload) VALUES($1,$2,$3,$4) ON CONFLICT(project_id,user_id) DO UPDATE SET version=excluded.version,payload=excluded.payload",[projectId,session.userId,next.version,JSON.stringify(next.drafts)])
    await verifyCapability(db,session,projectId,body,true);await db.query("COMMIT")
    return {status:200,value:{draftState:next}}
  }catch(error){await db.query("ROLLBACK").catch(()=>{});throw error}
}

async function readState(db,session,projectId,body,write=false){
  const project=await verifyCapability(db,session,projectId,body,write)
  return {project,state:verifyProjectState(projectId,project)}
}
async function finishRead(db,session,projectId,body,value){
  await verifyCapability(db,session,projectId,body,false)
  return value
}

export async function editorProjectRequest(db, session, path, body={}, env) {
  if(path==="/__webcanbe/api/projects"){
    const rows=(await db.query(
      `SELECT p.project_id,p.name,p.revision,p.files,p.history,p.source_epoch
         FROM wcb_projects p
         JOIN wcb_project_members pm ON pm.project_id=p.project_id AND pm.user_id=$1 AND pm.active
         JOIN wcb_workspace_members wm ON wm.workspace_id=p.workspace_id AND wm.user_id=$1 AND wm.active
         JOIN wcb_sessions s ON s.session_id=$2 AND s.user_id=$1 AND s.active
        WHERE NOT p.deleted
          AND s.expires_at=to_timestamp($3/1000.0) AND s.expires_at>clock_timestamp()
          AND NOT EXISTS(SELECT 1 FROM wcb_disabled_users d WHERE d.user_id=$1)
        ORDER BY p.project_id`,[session.userId,session.sessionId,session.expiresAt])).rows
    const projects=[]
    for(const row of rows){
      const state=verifyProjectState(String(row.project_id),row)
      projects.push(detectProject({id:String(row.project_id),name:String(row.name||"Hosted project")},state.files))
    }
    return {status:200,value:{projects}}
  }
  const match=/^\/__webcanbe\/api\/projects\/([a-f0-9-]{36})\/([a-z-]+)$/.exec(path)
  if(!match) fail(404,"Editor route is unavailable.")
  const [,projectId,action]=match
  if(action==="session"){
    const project=await authorityRow(db,session,projectId,false)
    const state=verifyProjectState(projectId,project)
    const editorSession=await issueCapability(db,session,project)
    return {status:201,value:{
      project:detectProject({id:projectId,name:String(project.name||"Hosted project")},state.files),
      runtime:{profile:"browser-run-snapshot",supported:true,dependencies:[],issues:[],notes:["Managed Browser Run renders an isolated pixel snapshot. Production Visual editing is currently limited to safe static-text source mutations."]},
      session:editorSession,role:String(project.role),hostedReadiness:"PREVIEW_TEXT_VISUAL",
      compatibilityDimensions:{runtimeExecution:{admitted:true,transport:"browser-run-snapshot"},securityAdmission:{controlledRunnerRequired:true,importedNodeExecution:false},hostedReadiness:{status:"PREVIEW_TEXT_VISUAL",publicImportReady:false}},
    }}
  }
  if(action==="drafts") return drafts(db,session,projectId,body)
  if(action==="code") return saveCode(db,session,projectId,body)
  const {state}=await readState(db,session,projectId,body,false)
  if(action==="files"){
    const listing=publicFiles(state)
    if(body.file!==undefined){
      if(typeof body.file!=="string"||!sourceMember(body.file,state.history))fail(404,"Source file is unavailable.")
      const source=textFiles(state.files,state.history).get(body.file)
      if(source===undefined)fail(404,"Source file is unavailable.")
      return {status:200,value:await finishRead(db,session,projectId,body,{files:listing,source,revision:state.revision})}
    }
    return {status:200,value:await finishRead(db,session,projectId,body,{files:listing,revision:state.revision})}
  }
  if(action==="history"){
    if(body.archiveId!==undefined||body.restoreRevisionId!==undefined)fail(422,"Archived history restore is not enabled on the production Worker yet.")
    return {status:200,value:await finishRead(db,session,projectId,body,{history:state.history,revision:state.revision})}
  }
  if(action==="search") return {status:200,value:await finishRead(db,session,projectId,body,searchSource(state,body.query,body.caseSensitive,body.limit))}
  if(action==="validate"){
    if(body.mode==="semantic")fail(422,"The isolated semantic checker is not attached to the production Worker yet.")
    if(typeof body.file!=="string"||typeof body.content!=="string"||!sourceMember(body.file,state.history)||!textFiles(state.files,state.history).has(body.file))fail(400,"Select an authorized source file.")
    if(body.content.includes("\0")||Buffer.byteLength(body.content)>LIMITS.fileBytes)fail(422,"Source file exceeds limits.")
    return {status:200,value:await finishRead(db,session,projectId,body,{validation:{level:"parse",passed:true,diagnostics:[]},revision:state.revision})}
  }
  if(action==="compatibility"){
    return {status:200,value:await finishRead(db,session,projectId,body,{...simpleCompatibility(state),revision:state.revision})}
  }
  if(action==="inspect"){
    const target=simpleTarget(state,body.identity)
    const source=textFiles(state.files,state.history).get(target.identity.file)
    return {status:200,value:await finishRead(db,session,projectId,body,{target,source,breakpoints:[{id:"base",label:"Base"}],styleDiagnostics:[],revision:state.revision})}
  }
  if(action==="mutate") return saveVisualText(db,session,projectId,body)
  if(action==="preview"){
    if(body.command==="stop") {
      return {status:200,value:{state:"stopped"}}
    }
    if(body.command&&body.command!=="update"&&body.command!=="capture")fail(422,"Snapshot preview does not accept interactive browser commands.")
    if(body.expectedRevision!==undefined&&body.expectedRevision!==state.revision)fail(409,"Source changed; reload before preview.")
    const frame=await browserSnapshot(env,state,body.viewport,typeof body.route==="string"?body.route:"/")
    const generation=randomUUID()
    return {status:200,value:await finishRead(db,session,projectId,body,{transport:"snapshot",generation,revision:state.revision,png:frame.png,observation:frame.observation,viewerUrl:"",state:"ready"})}
  }
  if(action==="export"){
    if(body.expectedRevision!==undefined&&body.expectedRevision!==state.revision)fail(409,"Source changed; reload before export.")
    const archive=zipStore(state.files)
    return {status:200,value:await finishRead(db,session,projectId,body,{archive:archive.toString("base64"),revision:state.revision,validation:{level:"checkpoint",passed:true,diagnostics:[]},independentBuild:"UNVERIFIED_AT_EXPORT"})}
  }
  fail(404,"Editor operation is unavailable.")
}
