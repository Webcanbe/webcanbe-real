import fs from "node:fs"
import path from "node:path"
import { createHash, randomUUID } from "node:crypto"
import { contentHash, editableSource, SourceConflict } from "../mutations/durableSource"
import { safeArchivePath } from "./projectRegistry"
import { PostgresAccess } from "./postgresStores"
import { pgTransaction } from "./postgresTransaction"
import type { ProjectGrant } from "./hostedAuthority"
export type SourceDraft = { file: string; text: string; baseline: string; hash: string; baseRevision: string }
export type DraftState = { version: number; drafts: SourceDraft[] }
export function validatedDrafts(value: unknown): SourceDraft[] {
  if (!Array.isArray(value) || value.length > 100 || Buffer.byteLength(JSON.stringify(value)) > 8 * 1024 * 1024) throw new Error("Draft quota exceeded.")
  const seen = new Set<string>()
  return value.map(draft => {
    if (!draft || typeof draft !== "object" || Object.keys(draft).some(k => !["file","text","baseline","hash","baseRevision"].includes(k)) || typeof draft.file !== "string" || !editableSource.test(draft.file) || safeArchivePath(draft.file) !== draft.file || seen.has(draft.file.toLowerCase()) || typeof draft.text !== "string" || typeof draft.baseline !== "string" || draft.hash !== contentHash(draft.baseline) || typeof draft.baseRevision !== "string" || !/^rev_[a-f0-9-]{36}$/.test(draft.baseRevision)) throw new Error("Invalid draft source reference.")
    for (const text of [draft.text,draft.baseline]) if (text.includes("\0") || Buffer.byteLength(text) > 2*1024*1024 || Buffer.from(text).toString("utf8") !== text) throw new Error("Invalid draft source text.")
    seen.add(draft.file.toLowerCase())
    return { file:draft.file,text:draft.text,baseline:draft.baseline,hash:draft.hash,baseRevision:draft.baseRevision }
  })
}
function nextState(old: DraftState, expectedVersion: unknown, drafts: SourceDraft[]): DraftState {
  if (JSON.stringify(old.drafts) === JSON.stringify(drafts)) return old
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion !== old.version) throw new SourceConflict("Draft backup changed in another editor. Reload before replacing it.")
  return { version:old.version+1,drafts }
}
/** Local developer mode only. No tokens or capabilities are stored with drafts. */
export class LocalDraftStore {
  constructor(private directory: string) {}
  private file(project: string, actor: string) { return path.join(this.directory,createHash("sha256").update(project+"\0"+actor).digest("hex")+".json") }
  read(project: string, actor: string): DraftState {
    const file=this.file(project,actor)
    if(!fs.existsSync(file))return {version:0,drafts:[]}
    if(fs.statSync(file).size>9*1024*1024)throw new Error("Draft backup exceeds quota.")
    const value=JSON.parse(fs.readFileSync(file,"utf8"));return {version:value.version,drafts:validatedDrafts(value.drafts)}
  }
  write(project: string,actor: string,expectedVersion:unknown,value:unknown) {
    const drafts=validatedDrafts(value),next=nextState(this.read(project,actor),expectedVersion,drafts)
    fs.mkdirSync(this.directory,{recursive:true,mode:0o700});const file=this.file(project,actor),temporary=file+"."+randomUUID()+".tmp"
    try { const fd=fs.openSync(temporary,"wx",0o600);try{fs.writeFileSync(fd,JSON.stringify(next));fs.fsyncSync(fd)}finally{fs.closeSync(fd)}fs.renameSync(temporary,file);const parent=fs.openSync(this.directory,"r");try{fs.fsyncSync(parent)}finally{fs.closeSync(parent)} }
    finally{fs.rmSync(temporary,{force:true})}
    return next
  }
}
/** Durable personal drafts are separate proposals, never accepted source or
 * history. Fresh project/session grants protect every read and CAS write. */
export class PostgresDraftStore {
  constructor(private access:PostgresAccess){}
  async read(grant:ProjectGrant):Promise<DraftState>{
    return pgTransaction(this.access.pool,async client=>{
      await this.access.authorize(client,grant,"drafts")
      const row=(await client.query("SELECT version,payload FROM wcb_drafts WHERE project_id=$1 AND user_id=$2",[grant.projectId,grant.userId])).rows[0]
      await this.access.authorize(client,grant,"drafts")
      return row?{version:Number(row.version),drafts:validatedDrafts(row.payload)}:{version:0,drafts:[]}
    })
  }
  async write(grant:ProjectGrant,expectedVersion:unknown,value:unknown):Promise<DraftState>{
    const drafts=validatedDrafts(value)
    return pgTransaction(this.access.pool,async client=>{
      await this.access.authorize(client,grant,"drafts")
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,2))",[grant.projectId+":"+grant.userId])
      const row=(await client.query("SELECT version,payload FROM wcb_drafts WHERE project_id=$1 AND user_id=$2 FOR UPDATE",[grant.projectId,grant.userId])).rows[0]
      const next=nextState(row?{version:Number(row.version),drafts:validatedDrafts(row.payload)}:{version:0,drafts:[]},expectedVersion,drafts)
      await client.query("INSERT INTO wcb_drafts VALUES($1,$2,$3,$4) ON CONFLICT(project_id,user_id) DO UPDATE SET version=excluded.version,payload=excluded.payload",[grant.projectId,grant.userId,next.version,JSON.stringify(next.drafts)])
      await this.access.authorize(client,grant,"drafts");return next
    })
  }
}
