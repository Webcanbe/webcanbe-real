import { createRequire } from "node:module"
import { X509Certificate } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { createHash, randomUUID } from "node:crypto"
import { createServer, request } from "node:https"
import { execFileSync, spawn, type ChildProcess } from "node:child_process"
import { Pool } from "pg"
import yazl from "yazl"
import { generateKeyPair, exportJWK, SignJWT } from "jose"
import { beforeAll, afterAll, describe, it, expect } from "vitest"
import { PostgresAccess } from "./runtime/postgresStores"
import { PostgresIdentityStore } from "./runtime/postgresIdentity"
import { contentHash } from "./mutations/durableSource"

const run = process.env.WCB_HOSTED_EDITOR_TEST === "1" ? describe : describe.skip
const lookup: any = (_h: unknown, _o: unknown, cb: any) => cb(null, [{ address: "127.0.0.1", family: 4 }])
type User = { id: string; workspace: string; cookie: string; csrf: string }
type Project = { id: string; previewId: string; capability: string; revision: string; generation?: string }
run("composed hosted editor: real HTTPS + signed TEST OIDC + PostgreSQL + mTLS Linux (local evidence)", () => {
  let pool: Pool, access: PostgresAccess, identities: PostgresIdentityStore, dir: string, ca: string, origin: string, issuer: string, child: ChildProcess, idp: ReturnType<typeof createServer>, editorPort: number
  let a: User, b: User, pa: Project, pb: Project
  const codes = new Map<string, { nonce: string; challenge: string; subject: string }>()
  const receipt: Record<string, unknown> = { exactPackagedEditorCli: true, boundary: "Local TEST signed OIDC/verified TLS, real PostgreSQL and mTLS native-sandbox Linux; no production infrastructure proof", checks: [] }
  const passed = (label: string) => (receipt.checks as string[]).push(label)
  async function call(user: Partial<User>, route: string, body: object = {}, headers: Record<string,string> = {}, method = "POST", target = origin) {
    return new Promise<{ status: number; body: any; cookies: string[] }>((resolve, reject) => {
      const req = request(target + route, { ca, lookup, method, headers: { Origin: target, "Content-Type": "application/json", ...(user.cookie ? { Cookie: user.cookie } : {}), ...(user.csrf ? { "X-WCB-CSRF": user.csrf } : {}), ...headers } }, res => {
        const chunks: Buffer[] = []; res.on("data", c => chunks.push(c)); res.on("end", () => { const text = Buffer.concat(chunks).toString(); try { resolve({ status: res.statusCode!, body: text ? JSON.parse(text) : undefined, cookies: res.headers["set-cookie"] ?? [] }) } catch { reject(Error("Invalid editor response")) } })
      }); req.on("error", reject); req.end(method === "POST" ? JSON.stringify(body) : undefined)
    })
  }
  async function launch() {
    const settings=JSON.parse(fs.readFileSync(path.join(dir,"config.json"),"utf8")), host={...settings.host}
    for(const field of ["ca","cert","key"]){const file=path.join(dir,"gateway-"+field+".pem");fs.writeFileSync(file,host[field],{mode:0o600});host[field]=file}
    const config={applicationRoot:settings.root,localTest:true,listenAddress:"127.0.0.1",port:settings.port,key:path.join(dir,"key.pem"),cert:path.join(dir,"cert.pem"),postgres:settings.postgres,origins:settings.origins,oidc:settings.oidc,hosts:[host],fastRefresh:true}
    fs.writeFileSync(path.join(dir,"editor-config.json"),JSON.stringify(config),{mode:0o600})
    child = spawn(process.execPath, [path.resolve(".webcanbe/hosted-package/editor.cjs"), path.join(dir, "editor-config.json")], { stdio: ["ignore", "pipe", "pipe"] })
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(Error("Hosted editor child startup timed out")), 15000)
      child.stdout!.on("data", data => { if (String(data).includes("Hosted editor TLS listener started.")) { clearTimeout(timer); resolve() } })
      child.once("exit", () => { clearTimeout(timer); reject(Error("Hosted editor exited during startup")) })
      child.stderr!.on("data", data => { if (String(data).includes("Error")) process.stderr.write(String(data)) })
    })
  }
  async function shutdown(signal: NodeJS.Signals = "SIGTERM") { if (child && child.exitCode === null && child.signalCode === null) { const done = new Promise(resolve => child.once("exit", resolve)); child.kill(signal); await done } }
  async function login(subject: string): Promise<User> {
    const user = { id: randomUUID(), workspace: randomUUID(), cookie: "", csrf: "" }
    await identities.provision({ issuer, subject }, user.id); await access.workspace(user.workspace, user.id, "owner")
    const started = await call({}, "/__webcanbe/auth/start"), auth = new URL(started.body.authorizationUrl), code = randomUUID()
    codes.set(code, { nonce: auth.searchParams.get("nonce")!, challenge: auth.searchParams.get("code_challenge")!, subject })
    const finished = await call({ cookie: started.cookies[0].split(";")[0] }, "/__webcanbe/auth/callback?state=" + auth.searchParams.get("state") + "&code=" + code, {}, {}, "GET")
    expect(finished.status).toBe(303); expect(finished.cookies[0]).toContain("Secure; HttpOnly; SameSite=Strict")
    user.cookie = finished.cookies[0].split(";")[0]
    const bootstrap = await call(user, "/__webcanbe/auth/session"); expect(bootstrap.status).toBe(200); user.csrf = bootstrap.body.csrf
    expect((await identities.resolve(user.cookie.split("=")[1]))?.userId).toBe(user.id)
    return user
  }
  async function archive(react: string) {
    const sourceRoot = path.resolve("fixtures/independent/vite-react" + react + "-ts")
    const files = new Map<string, Buffer>(fs.readdirSync(sourceRoot, { recursive: true, withFileTypes: true }).filter(e => e.isFile()).map(e => { const full = path.join(e.parentPath,e.name); return [path.relative(sourceRoot,full),fs.readFileSync(full)] as [string, Buffer] }))
    files.set("src/main.tsx", Buffer.from(`import React from 'react';import ReactDOM from 'react-dom/client';import App from './App';import './App.css';ReactDOM.createRoot(document.getElementById('root')!).render(<App/>);`))
    files.set("src/App.tsx", Buffer.from(`import {useState,useEffect} from 'react';export default function App(){const [count,setCount]=useState(0);useEffect(()=>console.log('original='+count));return <main><button style={{width:300,height:80}} onClick={()=>setCount(count+1)}>Count {count}</button><h1>Hosted heading</h1><input aria-label="Preview text" onChange={event=>console.log('typed='+event.currentTarget.value)}/></main>}`))
    files.set("src/App.css", Buffer.from("body{margin:0}button{color:red}"))
    const zip = new yazl.ZipFile(); for (const [name, bytes] of files) zip.addBuffer(bytes, name)
    zip.end(); const chunks: Buffer[] = []; for await (const c of zip.outputStream) chunks.push(Buffer.from(c))
    return Buffer.concat(chunks).toString("base64")
  }
  async function session(user: User, id: string): Promise<Project> {
    const result = await call(user, `/__webcanbe/api/projects/${id}/session`); expect(result.status, JSON.stringify(result.body)).toBe(201)
    return { id, ...result.body.session, revision: "" }
  }
  async function api(user: User, project: Project, action: string, body: object = {}) {
    return call(user, `/__webcanbe/api/projects/${project.id}/${action}`, { previewId: project.previewId, capability: project.capability, ...body })
  }
  async function files(user: User, project: Project, file = "src/App.tsx") {
    const result = await api(user, project, "files", { file }); expect(result.status, JSON.stringify(result.body)).toBe(200); project.revision = result.body.revision; return result.body
  }
  async function code(user: User, project: Project, content: string, file = "src/App.tsx", key = randomUUID()) {
    const current = await files(user, project, file)
    const body = { expectedRevision: current.revision, idempotencyKey: key, operations: [{ kind: "update", file, content, expectedHash: contentHash(current.source) }] }
    const result = await api(user, project, "code", body)
    if (result.status === 200) project.revision = result.body.revision
    return { result, body }
  }
  async function capture(user: User, project: Project) { const result = await api(user, project, "preview", { command: "capture", generation: project.generation, expectedRevision: project.revision }); expect(result.status, JSON.stringify(result.body)).toBe(200); return result.body }
  async function input(user: User, project: Project, action: "click" | "select", x = 80, y = 40) { const frame = await capture(user, project); const result = await api(user, project, "preview", { command: "input", generation: project.generation, sequence: frame.sequence, input: { type: "pointer", action, x, y } }); expect(result.status, JSON.stringify(result.body)).toBe(200) }
  beforeAll(async () => {
    dir = path.resolve(".webcanbe/runner/qa-phase2g2/hosted-editor"); fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
    const config = JSON.parse(fs.readFileSync(".webcanbe/runner/qa-phase2g2/gateway-client.json", "utf8"))
    pool = new Pool(config.postgres); await pool.query(fs.readFileSync("deployment/hosted/postgres.sql", "utf8")); access = new PostgresAccess(pool); identities = new PostgresIdentityStore(pool)
    execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost,DNS:app.wcb-app.test,DNS:viewer.wcb-preview.test", "-keyout", path.join(dir,"key.pem"), "-out", path.join(dir,"cert.pem")], { stdio: "ignore" })
    ca = fs.readFileSync(path.join(dir,"cert.pem"), "utf8")
    const keys = await generateKeyPair("RS256"), jwk = { ...await exportJWK(keys.publicKey), kid: "local-test", alg: "RS256" }
    idp = createServer({ key: fs.readFileSync(path.join(dir,"key.pem")), cert: ca }, async (req,res) => {
      if (req.url === "/jwks") { res.writeHead(200,{"Content-Type":"application/json"}); res.end(JSON.stringify({ keys: [jwk] })); return }
      let body=""; for await (const chunk of req) body += chunk
      const params = new URLSearchParams(body), code = params.get("code")!, data = codes.get(code); codes.delete(code)
      if (!data || createHash("sha256").update(params.get("code_verifier") ?? "").digest("base64url") !== data.challenge) { res.writeHead(403); res.end(); return }
      const now = Math.floor(Date.now()/1000), token = await new SignJWT({iss:issuer,sub:data.subject,aud:"local-test-client",iat:now,exp:now+120,nonce:data.nonce}).setProtectedHeader({alg:"RS256",kid:"local-test"}).sign(keys.privateKey)
      res.writeHead(200,{"Content-Type":"application/json"}); res.end(JSON.stringify({id_token:token}))
    })
    await new Promise<void>(r=>idp.listen(0,"127.0.0.1",r)); issuer = `https://localhost:${(idp.address() as any).port}`
    const portServer = createServer(); await new Promise<void>(r=>portServer.listen(0,"127.0.0.1",r)); editorPort=(portServer.address() as any).port; await new Promise<void>(r=>portServer.close(()=>r()))
    origin = `https://app.wcb-app.test:${editorPort}`
    const settings = { ...config, root: process.cwd(), dir, port: editorPort, origins: { editorOrigin:origin,viewerOrigin:`https://viewer.wcb-preview.test:${editorPort}`,editorSite:"wcb-app.test",viewerSite:"wcb-preview.test" }, oidc: { issuer,authorizationEndpoint:issuer+"/authorize",tokenEndpoint:issuer+"/token",jwksUri:issuer+"/jwks",clientId:"local-test-client",redirectUri:origin+"/__webcanbe/auth/callback",ca } }
    fs.writeFileSync(path.join(dir,"config.json"),JSON.stringify(settings),{mode:0o600})
    // Exercise the exact distributable CLI, configuration loader and verified
    // PostgreSQL factory, with explicit loopback TEST infrastructure only.
    execFileSync(process.execPath,["scripts/hosted/package.cjs"],{stdio:"pipe"})
    await launch(); a = await login("User A"); b = await login("User B")
    for (const [user,react] of [[a,"18"],[b,"19"]] as const) {
      const result = await call(user,"/__webcanbe/api/projects/import",{workspaceId:user.workspace,name:"AUTHORED hosted acceptance React"+react,archive:await archive(react)})
      expect(result.status,JSON.stringify(result.body)).toBe(201)
      const project = await session(user,result.body.project.id); if(user===a)pa=project;else pb=project
    }
  }, 60000)
  afterAll(async () => {
    await shutdown(); if(idp){idp.closeAllConnections();await new Promise<void>(r=>idp.close(()=>r()))}
    if(pool) {
      await pool.query("DROP TRIGGER IF EXISTS wcb_http_fault ON wcb_projects"); await pool.query("DROP FUNCTION IF EXISTS wcb_http_fault()")
      await pool.query("DROP TRIGGER IF EXISTS wcb_artifact_fault ON wcb_artifacts"); await pool.query("DROP FUNCTION IF EXISTS wcb_artifact_fault()"); await pool.end()
    }
    if(dir) { fs.writeFileSync(path.join(dir,"receipt.json"),JSON.stringify(receipt,null,2)+"\n"); for(const file of ["config.json","editor-config.json","key.pem","cert.pem","gateway-ca.pem","gateway-cert.pem","gateway-key.pem"])fs.rmSync(path.join(dir,file),{force:true}) }
  },30000)
  it("A and B each read, Code edit, select/Visual edit, history, preview, refresh and export their own project", async () => {
    for (const [user,p] of [[a,pa],[b,pb]] as Array<[User,Project]>) {
      const initial=await files(user,p), start=await api(user,p,"preview",{command:"start",expectedRevision:p.revision});expect(start.status,JSON.stringify(start.body)).toBe(200);p.generation=start.body.generation
      await input(user,p,"click");expect((await capture(user,p)).observation.logs).toContain("log: original=1")
      for(const input of [{type:"key",key:"Tab",shift:false},{type:"text",text:"alpha"},{type:"key",key:"SelectAll",shift:false},{type:"text",text:"한글"},{type:"key",key:"Backspace",shift:false},{type:"text",text:"字"}]){const frame=await capture(user,p);expect((await api(user,p,"preview",{command:"input",generation:p.generation,sequence:frame.sequence,input})).status).toBe(200)}
      expect((await capture(user,p)).observation.logs).toContain("log: typed=한字")
      const edited=await code(user,p,initial.source.replace("original=","code="));expect(edited.result.status,JSON.stringify(edited.result.body)).toBe(200)
      const update=await api(user,p,"preview",{command:"update",generation:p.generation,expectedRevision:p.revision});expect(update.status,JSON.stringify(update.body)).toBe(200);expect(update.body.updateKind).toBe("react-fast-refresh");expect(update.body.generation).toBe(p.generation)
      expect((await capture(user,p)).observation.logs).toContain("log: code=1")
      await input(user,p,"select",80,115);const selected=(await capture(user,p)).observation.selection;expect(selected?.tagName).toBe("h1")
      const inspect=await api(user,p,"inspect",{identity:selected.identity,expectedRevision:p.revision});expect(inspect.status).toBe(200)
      const visual=await api(user,p,"mutate",{identity:inspect.body.target.identity,expectedRevision:p.revision,idempotencyKey:randomUUID(),edit:{type:"text",value:"Visual hosted heading",scope:"source"}});expect(visual.status,JSON.stringify(visual.body)).toBe(200);p.revision=visual.body.revision
      const vu=await api(user,p,"preview",{command:"update",generation:p.generation,expectedRevision:p.revision});expect(vu.status,JSON.stringify(vu.body)).toBe(200);expect(vu.body.updateKind).toBe("react-fast-refresh")
      await input(user,p,"click");expect((await capture(user,p)).observation.logs).toContain("log: code=2")
      const css=await files(user,p,"src/App.css");expect((await code(user,p,css.source+"\nbutton{color:blue}","src/App.css")).result.status).toBe(200)
      expect((await api(user,p,"preview",{command:"update",generation:p.generation,expectedRevision:p.revision})).body.updateKind).toBe("css-hot-update")
      await input(user,p,"click");expect((await capture(user,p)).observation.logs).toContain("log: code=3")
      const history=await api(user,p,"history");expect(history.status).toBe(200);expect(history.body.history.transactions.map((t:any)=>t.producer)).toEqual(["code","visual","code"])
      const exported=await api(user,p,"export",{expectedRevision:p.revision});expect(exported.status,JSON.stringify(exported.body)).toBe(200)
      fs.writeFileSync(path.join(dir,user===a?"react18-export.zip":"react19-export.zip"),Buffer.from(exported.body.archive,"base64"),{mode:0o600})
      const db=(await pool.query("SELECT revision,history FROM wcb_projects WHERE project_id=$1",[p.id])).rows[0];expect(db.revision).toBe(exported.body.revision);expect(db.history.revisions.at(-1).revisionId).toBe(db.revision)
      await api(user,p,"preview",{command:"stop"});const next=await session(user,p.id);Object.assign(p,next);await files(user,p)
    }
    passed("Two users/projects: signed login → import → source → Code → immutable PG artifact → PG scheduled mTLS runner → input/select → Visual → accepted history → React18/19 state 1/1/2/3 → CSS → export")
  },60000)
  it("rejects cross-tenant references, stolen capabilities, forged identity fields and origin/CSRF/session attacks",async()=>{
    for(const action of ["session","files","source","search","history","export","preview","inspect","validate","mutate","code","artifact","diagnostics","logs"]) {
      const result=await api(a,pb,action,{file:"src/App.tsx",command:"capture",generation:pb.generation,expectedRevision:pb.revision});expect(result.status,action).toBe(403);expect(JSON.stringify(result.body)).not.toContain("Hosted heading")
    }
    for(const field of ["accountId","userId","projectId","artifactId","runnerId","revisionId","generationId","root","role"])expect((await api(a,pa,"files",{[field]:pb.id})).status,field).toBe(403)
    expect((await api(a,pa,"files",{workspaceId:b.workspace})).status).toBe(403)
    for(const headers of [{Origin:"https://viewer.wcb-preview.test"},{"X-WCB-CSRF":"bad"},{"X-WCB-Editor-Key":"forged"},{Cookie:a.cookie+"; "+a.cookie}] as Array<Record<string,string>>)expect((await call(a,`/__webcanbe/api/projects/${pa.id}/files`,pa,headers)).status).toBe(403)
    expect((await call({},`/__webcanbe/api/projects/${pa.id}/files`,{...pa,accountId:a.id})).status).toBe(403)
    passed("Cross-tenant source/history/artifact/preview/generation/mutation/export/diagnostics/logs and identity-ID/cookie/CSRF/origin forgery denied")
  })
  it("supports owner/editor/viewer and revokes project/workspace membership during live capabilities",async()=>{
    for(const role of ["viewer","editor","owner"] as const){
      await access.member(pa.id,a.id,role);const p=await session(a,pa.id),source=await files(a,p)
      expect((await api(a,p,"history")).status).toBe(200)
      const result=await code(a,p,source.source+"\n// role "+role);expect(result.result.status).toBe(role==="viewer"?403:200)
      if(role==="viewer"){expect((await api(a,p,"mutate",{expectedRevision:p.revision})).status).toBe(403);expect((await api(a,p,"drafts",{command:"save",version:0,drafts:[]})).status).toBe(403)}
    }
    pa=await session(a,pa.id);await files(a,pa)
    expect((await api(a,pa,"preview",{command:"start",expectedRevision:pa.revision})).status).toBe(200)
    await access.member(pa.id,a.id,null)
    for(const action of ["files","history","preview","export"])expect((await api(a,pa,action)).status).toBe(403)
    await access.member(pa.id,a.id,"owner");expect((await api(a,pa,"files")).status).toBe(403)
    pa=await session(a,pa.id);await access.workspace(a.workspace,a.id,null)
    for(const action of ["files","history","preview"])expect((await api(a,pa,action)).status).toBe(403)
    await access.workspace(a.workspace,a.id,"owner");pa=await session(a,pa.id)
    passed("Owner/editor writes and viewer read-only; live project/workspace revoke and regrant cannot revive old capability")
  },30000)
  it("accepts source/history coherently, rejects stale simultaneous edits and replays idempotency after restart",async()=>{
    const initial=await files(a,pa),body={expectedRevision:initial.revision,idempotencyKey:randomUUID(),operations:[{kind:"update",file:"src/App.tsx",expectedHash:contentHash(initial.source),content:initial.source+"\n// race one"}]}
    const race=await Promise.all([api(a,pa,"code",body),api(a,pa,"code",{...body,idempotencyKey:randomUUID(),operations:[{...body.operations[0],content:initial.source+"\n// race two"}]})])
    expect(race.map(r=>r.status).sort()).toEqual([200,409]);const accepted=race.find(r=>r.status===200)!
    const current=await files(a,pa);expect(current.revision).toBe(accepted.body.revision)
    const draft=await code(a,pa,current.source+"\n// restart retry");expect(draft.result.status).toBe(200)
    await shutdown();await launch()
    const replay=await api(a,pa,"code",draft.body);expect(replay.status,JSON.stringify(replay.body)).toBe(200);expect(replay.body.replayed).toBe(true);expect(replay.body.transaction.id).toBe(draft.result.body.transaction.id)
    expect((await api(a,pa,"code",{...draft.body,operations:[{...draft.body.operations[0],content:"different"}]})).status).toBe(409)
    expect((await api(a,pa,"history")).body.history.revisions.at(-1).revisionId).toBe(replay.body.revision)
    passed("HTTP concurrent CAS, stale revision, duplicate key conflict and exact retry with same durable cookie/capability/source/history after process restart")
  },30000)
  it("durable personal multi-file drafts survive editor restart without changing source and use CAS",async()=>{
    const app=await files(a,pa),css=await files(a,pa,"src/App.css"),history=(await api(a,pa,"history")).body.history
    const drafts=[{file:"src/App.tsx",text:app.source+"\n// recovered proposal",baseline:app.source,hash:contentHash(app.source),baseRevision:app.revision},{file:"src/App.css",text:css.source+"\n/* recovered proposal */",baseline:css.source,hash:contentHash(css.source),baseRevision:css.revision}]
    const saved=await api(a,pa,"drafts",{command:"save",version:0,drafts});expect(saved.status).toBe(200)
    expect((await api(a,pa,"drafts",{command:"save",version:0,drafts})).body.draftState).toEqual(saved.body.draftState)
    expect((await api(a,pa,"drafts",{command:"save",version:0,drafts:[]})).status).toBe(409)
    expect((await api(b,pa,"drafts")).status).toBe(403)
    await shutdown();await launch()
    expect((await api(a,pa,"drafts")).body.draftState.drafts).toEqual(drafts)
    expect((await files(a,pa)).source).toBe(app.source);expect((await api(a,pa,"history")).body.history).toEqual(history)
    const accepted=await api(a,pa,"code",{expectedRevision:app.revision,idempotencyKey:randomUUID(),operations:drafts.map(d=>({kind:"update",file:d.file,content:d.text,expectedHash:d.hash}))})
    expect(accepted.status).toBe(200);expect(accepted.body.transaction.operations).toHaveLength(2)
    expect((await api(a,pa,"history")).body.history.revisions).toHaveLength(history.revisions.length+1)
    expect((await files(a,pa)).source).toBe(drafts[0].text);expect((await files(a,pa,"src/App.css")).source).toBe(drafts[1].text)
    expect((await api(a,pa,"drafts",{command:"save",version:saved.body.draftState.version,drafts:[]})).status).toBe(200)
    passed("PostgreSQL personal draft CAS/recovery/isolation; no accepted-source or history effect until atomic two-file Code acceptance")
  },30000)
  it("hosted responsive construction writes real CSS and reload/restart fallbacks remain accurately classified",async()=>{
    const app=await files(a,pa),css=await files(a,pa,"src/App.css")
    const accepted=await api(a,pa,"code",{expectedRevision:app.revision,idempotencyKey:randomUUID(),operations:[{kind:"update",file:"src/App.tsx",expectedHash:contentHash(app.source),content:app.source.replace("<h1>",'<h1 className="title">')},{kind:"update",file:"src/App.css",expectedHash:contentHash(css.source),content:css.source+"\n.title{font-size:30px}"}]});expect(accepted.status).toBe(200);pa.revision=accepted.body.revision
    const target=(await api(a,pa,"compatibility")).body.targets.find((t:any)=>t.elementName==="h1")
    const start=await api(a,pa,"preview",{command:"start"});expect(start.status).toBe(200);pa.generation=start.body.generation
    const responsive=await api(a,pa,"mutate",{expectedRevision:pa.revision,idempotencyKey:randomUUID(),identity:target.identity,edit:{type:"responsive-create",property:"fontSize",value:"18px",breakpoint:"new:mobile",scope:"source"}})
    expect(responsive.status,JSON.stringify(responsive.body)).toBe(200);pa.revision=responsive.body.revision
    expect((await files(a,pa,"src/App.css")).source).toContain("@media (max-width: 767px)")
    expect((await api(a,pa,"preview",{command:"update",generation:pa.generation,expectedRevision:pa.revision})).body.updateKind).toBe("css-hot-update")
    await input(a,pa,"click");expect((await capture(a,pa)).observation.logs).toContain("log: code=1")
    const main=await files(a,pa,"src/main.tsx");expect((await code(a,pa,main.source+"\nconsole.log('entry edited')","src/main.tsx")).result.status).toBe(200)
    const reloaded=await api(a,pa,"preview",{command:"update",generation:pa.generation,expectedRevision:pa.revision});expect(reloaded.status).toBe(200);expect(reloaded.body.updateKind).toBe("incremental-rebuild-reload");expect(reloaded.body.generation).toBe(pa.generation)
    let reset=false
    for(let i=0;i<20;i++){if((await capture(a,pa)).observation.logs.includes("log: code=0")){reset=true;break}await new Promise(r=>setTimeout(r,50))}
    expect(reset,"entry reload must render the component with reset state").toBe(true)
    const structural=await api(a,pa,"code",{expectedRevision:pa.revision,idempotencyKey:randomUUID(),operations:[{kind:"create",file:"src/NewModule.ts",expectedHash:null,content:"export {}"}]});expect(structural.status).toBe(200);pa.revision=structural.body.revision
    const restarted=await api(a,pa,"preview",{command:"update",generation:pa.generation,expectedRevision:pa.revision});expect(restarted.status).toBe(200);expect(restarted.body.updateKind).toBe("generation-restart");expect(restarted.body.generation).not.toBe(pa.generation);pa.generation=restarted.body.generation
    expect((await capture(a,pa)).png).toBeTruthy();await api(a,pa,"preview",{command:"stop"});pa=await session(a,pa.id);await files(a,pa)
    passed("Composed HTTP missing responsive CSS construction; CSS hot update, component Fast Refresh, entry rebuild/reload with state reset, structural generation restart accurately distinguished")
  },45000)
  it("database transaction/history failures never report success or split durable source/history",async()=>{
    const old=await files(a,pa)
    for(const failure of ["source","history"]){
      await pool.query(`CREATE OR REPLACE FUNCTION wcb_http_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.project_id='${pa.id}'::uuid THEN RAISE EXCEPTION 'injected ${failure} write failure'; END IF; RETURN NEW; END $$`)
      await pool.query(`CREATE TRIGGER wcb_http_fault BEFORE UPDATE OF ${failure==="source"?"files":"history"} ON wcb_projects FOR EACH ROW EXECUTE FUNCTION wcb_http_fault()`)
      const result=await code(a,pa,old.source+"\n// rejected storage write");expect(result.result.status).toBe(422)
      await pool.query("DROP TRIGGER wcb_http_fault ON wcb_projects")
      const after=await files(a,pa);expect(after.source).toBe(old.source);expect(after.revision).toBe(old.revision)
      expect((await api(a,pa,"history")).body.history.revisions.at(-1).revisionId).toBe(old.revision)
    }
    passed("Actual PostgreSQL source and history trigger faults roll back atomically before HTTP success")
  },30000)
  it("SIGKILL during an HTTP source transaction rolls back and a new editor reconnects to exact accepted bytes",async()=>{
    const old=await files(a,pa)
    await pool.query(`CREATE OR REPLACE FUNCTION wcb_http_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.project_id='${pa.id}'::uuid THEN PERFORM pg_sleep(20); END IF; RETURN NEW; END $$`)
    await pool.query("CREATE TRIGGER wcb_http_fault BEFORE UPDATE OF files ON wcb_projects FOR EACH ROW EXECUTE FUNCTION wcb_http_fault()")
    const pending=code(a,pa,old.source+"\n// killed HTTP transaction").then(()=>"response",()=>"disconnected")
    let waiting=false
    for(let i=0;i<150;i++){if((await pool.query("SELECT pid FROM pg_stat_activity WHERE wait_event='PgSleep' AND query LIKE 'UPDATE wcb_projects SET revision=%'")).rowCount){waiting=true;break}await new Promise(r=>setTimeout(r,20))}
    expect(waiting).toBe(true);await shutdown("SIGKILL");expect(await pending).toBe("disconnected")
    // Terminated client may finish detecting disconnect after pg_sleep. Cancel
    // its now orphaned transaction, then verify PostgreSQL rolled it back.
    await pool.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE wait_event='PgSleep' AND query LIKE 'UPDATE wcb_projects SET revision=%'")
    await pool.query("DROP TRIGGER wcb_http_fault ON wcb_projects");await launch()
    const recovered=await files(a,pa);expect(recovered.source).toBe(old.source);expect(recovered.revision).toBe(old.revision);expect((await api(a,pa,"history")).body.revision).toBe(old.revision)
    passed("Actual HTTP editor SIGKILL inside PostgreSQL acceptance; connection loss has no success; database rollback and fresh-process source/history reconnect")
  },30000)
  it("artifacts fail closed, runner references/fences/expiry are checked and admission remains PostgreSQL-owned",async()=>{
    pa=await session(a,pa.id);pb=await session(b,pb.id);await files(a,pa);await files(b,pb)
    const initial=pa.revision
    await pool.query("CREATE OR REPLACE FUNCTION wcb_artifact_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected artifact write failure'; END $$")
    await pool.query("CREATE TRIGGER wcb_artifact_fault BEFORE INSERT ON wcb_artifacts FOR EACH ROW EXECUTE FUNCTION wcb_artifact_fault()")
    expect((await api(a,pa,"preview",{command:"start"})).status).toBe(422)
    await pool.query("DROP TRIGGER wcb_artifact_fault ON wcb_artifacts");await pool.query("DROP FUNCTION wcb_artifact_fault()")
    expect((await files(a,pa)).revision).toBe(initial)
    const startA=await api(a,pa,"preview",{command:"start"}),startB=await api(b,pb,"preview",{command:"start"});expect(startA.status).toBe(200);expect(startB.status).toBe(200);pa.generation=startA.body.generation;pb.generation=startB.body.generation
    expect((await api(a,pa,"preview",{command:"capture",generation:pb.generation})).status).toBe(422)
    expect((await api(a,pa,"preview",{command:"input",generation:pb.generation,sequence:1,input:{type:"pointer",action:"click",x:10,y:10}})).status).toBe(422)
    expect((await api(a,pa,"preview",{command:"capture",generation:randomUUID()})).status).toBe(422)
    const another=await session(a,pa.id);await files(a,another)
    // Both actual host slots are occupied, even though this is another editor capability.
    expect((await api(a,another,"preview",{command:"start"})).status).toBe(422)
    await pool.query("UPDATE wcb_runner_leases SET controller=$2,epoch=epoch+1 WHERE generation=$1",[pa.generation,randomUUID()])
    expect((await api(a,pa,"preview",{command:"capture",generation:pa.generation})).status).toBe(422)
    await pool.query("UPDATE wcb_runner_leases SET lease_until=clock_timestamp()-interval '1 second' WHERE generation=$1",[pa.generation])
    await api(b,pb,"preview",{command:"stop"})
    // Quarantined transport requires a fresh controller; no local lease shim.
    await shutdown();await launch();pa=await session(a,pa.id);await files(a,pa)
    const fresh=await api(a,pa,"preview",{command:"start"});expect(fresh.status,JSON.stringify(fresh.body)).toBe(200);pa.generation=fresh.body.generation
    expect((await capture(a,pa)).png.length).toBeGreaterThan(100)
    await pool.query("UPDATE wcb_runner_leases SET lease_until=clock_timestamp()-interval '1 second' WHERE generation=$1",[pa.generation])
    expect((await api(a,pa,"preview",{command:"capture",generation:pa.generation})).status).toBe(422)
    await shutdown();await launch();pa=await session(a,pa.id);await files(a,pa)
    passed("HTTP artifact-write failure, cross-project/stale generation and input rejection, real PG host admission, controller epoch fencing, lease expiry, verified recovery and restart")
  },45000)
  it("discards an actual delayed mTLS runner result after membership change and quarantines missing cleanup acknowledgement",async()=>{
    await shutdown()
    const file=path.join(dir,"config.json"),settings=JSON.parse(fs.readFileSync(file,"utf8")),host=settings.host
    let hold=false,dropCleanup=false,release:(()=>void)|undefined,ready:(()=>void)|undefined
    const relay=createServer({key:fs.readFileSync(path.join(dir,"key.pem")),cert:ca,ca:host.ca,requestCert:true,rejectUnauthorized:true},async(req,res)=>{
      const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));const payload=Buffer.concat(chunks),command=JSON.parse(payload.toString()).command
      const upstream=request(host.origin+"/rpc",{method:"POST",ca:host.ca,cert:host.cert,key:host.key,lookup,headers:{"Content-Type":"application/json"}},answer=>{
        const data:Buffer[]=[];answer.on("data",c=>data.push(Buffer.from(c)));answer.on("end",()=>{
          const deliver=()=>{if(res.writableEnded)return;release=undefined;res.writeHead(dropCleanup&&command==="revoke"?503:answer.statusCode!,{"Content-Type":"application/json"});res.end(dropCleanup&&command==="revoke"?'{}':Buffer.concat(data))}
          if(hold&&command==="sample"){hold=false;release=deliver;ready?.()}else deliver()
        })
      });upstream.on("error",()=>{res.writeHead(502);res.end('{}')});upstream.end(payload)
    })
    await new Promise<void>(r=>relay.listen(0,"127.0.0.1",r))
    try{
      fs.writeFileSync(file,JSON.stringify({...settings,host:{...host,origin:`https://localhost:${(relay.address() as any).port}`,ca}}));await launch();pa=await session(a,pa.id);await files(a,pa)
      const start=await api(a,pa,"preview",{command:"start"});expect(start.status).toBe(200);pa.generation=start.body.generation
      hold=true;const arrived=new Promise<void>(resolve=>{ready=resolve}),pending=api(a,pa,"preview",{command:"capture",generation:pa.generation})
      await arrived;await access.member(pa.id,a.id,null);release!()
      const late=await pending;expect([403,422]).toContain(late.status);expect(late.body.png).toBeUndefined();expect(late.body.observation).toBeUndefined()
      await access.member(pa.id,a.id,"owner");pa=await session(a,pa.id);await files(a,pa)
      const next=await api(a,pa,"preview",{command:"start"});expect(next.status).toBe(200);pa.generation=next.body.generation
      dropCleanup=true;expect((await api(a,pa,"preview",{command:"stop"})).status).toBe(422)
      expect((await pool.query("SELECT state FROM wcb_runner_leases WHERE generation=$1",[pa.generation])).rows[0].state).toBe("quarantined")
      const other=await session(a,pa.id);expect((await api(a,other,"preview",{command:"start"})).status).toBe(422)
      dropCleanup=false;await shutdown();await pool.query("UPDATE wcb_runner_leases SET lease_until=clock_timestamp()-interval '1 second' WHERE generation=$1",[pa.generation])
      fs.writeFileSync(file,JSON.stringify(settings));await launch()
      for(let i=0;i<100;i++){if((await pool.query("SELECT state FROM wcb_runner_leases WHERE generation=$1",[pa.generation])).rows[0].state==="stopped")break;await new Promise(r=>setTimeout(r,100))}
      expect((await pool.query("SELECT state FROM wcb_runner_leases WHERE generation=$1",[pa.generation])).rows[0].state).toBe("stopped")
      pa=await session(a,pa.id);await files(a,pa)
      passed("Actual gateway sample held in mTLS relay then membership revoked: no result/logs escaped; lost revoke acknowledgement retained PG quarantine, new controller periodic recovery verified cleanup without editor allocation")
    }finally{release?.();dropCleanup=false;await shutdown();fs.writeFileSync(file,JSON.stringify(settings));relay.closeAllConnections();await new Promise<void>(r=>relay.close(()=>r()));await access.member(pa.id,a.id,"owner");await launch();pa=await session(a,pa.id);await files(a,pa)}
  },45000)
  it("the production-built editor uses cookie/CSRF HTTP for rendered Code/Canvas/history and separate-site viewer",async()=>{
    const require=createRequire(import.meta.url),{chromium}=require(process.env.WCB_PLAYWRIGHT_MODULE || "playwright")
    const pin=createHash("sha256").update(new X509Certificate(ca).publicKey.export({format:"der",type:"spki"})).digest("base64")
    const browser=await chromium.launch({headless:true,chromiumSandbox:true,args:["--host-resolver-rules=MAP app.wcb-app.test 127.0.0.1, MAP viewer.wcb-preview.test 127.0.0.1",`--ignore-certificate-errors-spki-list=${pin}`,"--no-proxy-server"]})
    try{
      const context=await browser.newContext({viewport:{width:1600,height:1100}})
      await context.addCookies([{name:"__Host-wcb-session",value:a.cookie.split("=")[1],domain:"app.wcb-app.test",path:"/",secure:true,httpOnly:true,sameSite:"Strict"}])
      const page=await context.newPage(),errors:string[]=[],requests:any[]=[];let latest:any
      page.on("pageerror",(e:Error)=>errors.push(e.message));page.on("request",(req:any)=>{if(req.url().includes("/__webcanbe/api/"))requests.push(req.headers())});page.on("response",async(res:any)=>{if(res.url().endsWith("/preview")){try{const data=await res.json();if(data.png)latest=data}catch{}}})
      await page.goto(origin+"/workspace/"+pa.id);await page.getByRole("button",{name:"Reconnect session",exact:true}).waitFor()
      const until=async(predicate:()=>boolean)=>{for(let i=0;i<200;i++){if(predicate())return;await new Promise(r=>setTimeout(r,50))}throw Error("Hosted UI frame did not arrive")}
      await until(()=>Boolean(latest?.png));expect(await page.title()).toBeTruthy();expect(await page.locator("vite-error-overlay").count()).toBe(0)
      expect(await page.getByLabel("Local editor access key").count()).toBe(0);expect(await page.evaluate(()=>localStorage.length)).toBe(0)
      const frame=page.frames().find((f:any)=>f.url().startsWith("https://viewer.wcb-preview.test"));expect(frame).toBeDefined()
      expect(await frame.evaluate(()=>{try{parent.document.body;return false}catch{return true}})).toBe(true)
      await page.getByRole("button",{name:"Code",exact:true}).click();await page.getByRole("button",{name:/^src\/App.tsx/}).click()
      const code=page.getByRole("textbox",{name:"Source code editor"});await code.waitFor();const before=await code.innerText()
      await code.fill(before.replace("Visual hosted heading","Browser hosted heading"))
      await page.getByText("Draft backup saved. Restore it after reconnecting or restarting.",{exact:true}).waitFor()
      page.on("dialog",(dialog:any)=>dialog.accept())
      await page.reload();await page.getByRole("button",{name:"Code",exact:true}).click();await page.getByRole("button",{name:/^src\/App.tsx/}).click()
      await page.getByText("Recovered backed-up drafts. Accepted source is unchanged; review before saving.",{exact:true}).waitFor()
      expect(await code.innerText()).toContain("Browser hosted heading")
      await page.getByRole("button",{name:/^src\/App.css/}).click()
      const cssEditor=page.getByRole("textbox",{name:"Source code editor"});await cssEditor.waitFor();await cssEditor.fill((await cssEditor.innerText())+"\n/* browser multi-file draft */")
      // Hold an old-revision capture request across the accepted Code edit.
      // Fast Refresh retains the generation, so only the revision guard can
      // prevent this response from overwriting the updated preview state.
      let delayedCaptureStatus=0,holdCapture=true,releaseCapture!:()=>void,captureArrived!:()=>void,captureDelivered!:()=>void
      const heldCapture=new Promise<void>(resolve=>releaseCapture=resolve),captureReady=new Promise<void>(resolve=>captureArrived=resolve),captureDone=new Promise<void>(resolve=>captureDelivered=resolve)
      const previewPattern="**/__webcanbe/api/projects/*/preview"
      await page.route(previewPattern,async(route:any)=>{
        if(holdCapture&&route.request().postDataJSON()?.command==="capture"){
          holdCapture=false;captureArrived();await heldCapture;try{const response=await call({},new URL(route.request().url()).pathname,route.request().postDataJSON(),route.request().headers());delayedCaptureStatus=response.status;await route.fulfill({status:response.status,contentType:"application/json",body:JSON.stringify(response.body)})}catch{await route.abort()}finally{captureDelivered()}
        }else await route.continue()
      })
      try{
        await captureReady
        await page.getByRole("button",{name:/Save all drafts/}).click();await page.getByText("Saved 2 files in one source transaction. Preview is rebuilding.",{exact:true}).waitFor()
        await page.getByText(/React component refreshed inside the controlled runner|Incremental rebuild applied; document reloaded/).waitFor()
      }finally{releaseCapture();await captureDone;await page.unroute(previewPattern)}
      expect(delayedCaptureStatus).toBe(409)
      await page.getByRole("button",{name:"History",exact:true}).click();await page.getByRole("heading",{name:"Source history",exact:true}).waitFor();expect(await page.locator("[data-transaction-id]").count()).toBeGreaterThan(3)
      await page.getByRole("button",{name:"Canvas",exact:true}).click()
      await page.getByRole("button",{name:"Interact with preview",exact:true}).click()
      const raster=page.frameLocator('iframe[title="Running imported React/Vite project"]').locator("img");await raster.click({position:{x:80,y:40}});await until(()=>Boolean(latest?.observation?.logs.some((line:string)=>/^log: code=/.test(line))))
      await raster.press("Tab");await raster.pressSequentially("abc");await until(()=>Boolean(latest?.observation?.logs.includes("log: typed=abc")))
      expect(await page.getByText("The hosted operation failed. Accepted source and history remain authoritative.",{exact:true}).count()).toBe(0)
      await page.getByText("Sandboxed source preview ready",{exact:true}).waitFor()
      await page.screenshot({path:path.join(dir,"hosted-desktop.png")})
      await page.setViewportSize({width:1024,height:900});await page.screenshot({path:path.join(dir,"hosted-compact.png")})
      expect(errors).toEqual([]);expect(requests.length).toBeGreaterThan(5);expect(requests.every(h=>h["x-wcb-csrf"]&&!h["x-wcb-editor-key"])).toBe(true)
      await page.close()
    }finally{await browser.close();a.csrf=(await call(a,"/__webcanbe/auth/session")).body.csrf}
    pa=await session(a,pa.id);expect((await files(a,pa)).source).toContain("Browser hosted heading")
    passed("Built editor desktop/compact UI: HttpOnly session → in-memory CSRF → separate opaque raster viewer → real Code save → PostgreSQL history → Canvas; delayed old-revision capture rejection cannot expire refreshed preview; no browser errors/localStorage bearer/local key")
  },45000)
  it("revoked login session denies source/history/preview and cannot use still-known project IDs",async()=>{
    await call(b,"/__webcanbe/auth/logout")
    for(const action of ["files","history","preview","export"])expect((await api(b,pb,action)).status).toBe(403)
    passed("HTTP logout revokes durable login authority for all subsequent source/history/preview/export operations")
  })
})
