import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { afterEach, describe, expect, it } from "vitest"
import { ProjectRegistry } from "./runtime/projectRegistry"
import { contentHash, HISTORY_LIMITS, transactionEntry } from "./mutations/durableSource"
const roots: string[]=[]
afterEach(()=>{for(const root of roots.splice(0))fs.rmSync(root,{recursive:true,force:true})})
function setup() {
  const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"wcb-history-limit-")));roots.push(root)
  fs.cpSync("fixtures/compatible-react-vite",path.join(root,"fixtures/compatible-react-vite"),{recursive:true})
  const registry=new ProjectRegistry(root),source=registry.durable("phase1-fixture"),historyFile=path.join(root,".webcanbe/history/phase1-fixture/history.json")
  return {root,registry,source,historyFile}
}
describe("bounded source/history before canonical writes",()=>{
  it("keeps accepted files and history exact when rejected receipt capacity is exhausted",()=>{
    const d=setup(),before=d.source.files(),ledger=d.source.history(),base=d.source.revision()
    for(let n=0;n<HISTORY_LIMITS.transactions;n++)ledger.transactions.push(transactionEntry("phase1-fixture",base,"code",randomUUID(),"rejected", "Invalid draft",{passed:false,level:"parse",diagnostics:[]}))
    fs.writeFileSync(d.historyFile,JSON.stringify(ledger));const disk=fs.readFileSync(d.historyFile)
    expect(()=>d.source.reject(transactionEntry("phase1-fixture",base,"code",randomUUID(),"new","Invalid draft",{passed:false,level:"parse",diagnostics:[]}))).toThrow("history capacity")
    expect(d.source.files()).toEqual(before);expect(fs.readFileSync(d.historyFile)).toEqual(disk)
  })
  it("rejects accepted edits at capacity before creating a journal or changing source",()=>{
    const d=setup(),before=d.source.files(),ledger=d.source.history(),base=d.source.revision()
    for(let n=0;n<HISTORY_LIMITS.transactions;n++)ledger.transactions.push(transactionEntry("phase1-fixture",base,"code",randomUUID(),"receipt","Historical receipt",{passed:false,level:"parse",diagnostics:[]}))
    fs.writeFileSync(d.historyFile,JSON.stringify(ledger));const file="src/App.tsx",old=before.get(file)!
    expect(()=>d.source.commit({expectedRevision:base,operations:[{kind:"update",file,expectedHash:contentHash(old),content:old+"\n// denied"}],entry:transactionEntry("phase1-fixture",base,"code",randomUUID(),"new","Edit",{passed:true,level:"parse",diagnostics:[]}),authorize:()=>{}})).toThrow("history capacity")
    expect(d.source.files()).toEqual(before);expect(fs.existsSync(path.join(path.dirname(d.historyFile),"pending.json"))).toBe(false)
    expect(d.source.history().transactions).toHaveLength(HISTORY_LIMITS.transactions)
  })
  it("rejects oversized disk history before JSON parsing and preserves source for operator recovery",()=>{
    const d=setup(),before=d.source.files(),fd=fs.openSync(d.historyFile,"w");fs.ftruncateSync(fd,HISTORY_LIMITS.bytes+1);fs.closeSync(fd)
    expect(()=>new ProjectRegistry(d.root).durable("phase1-fixture")).toThrow("history capacity")
    for(const [file,content]of before)expect(fs.readFileSync(path.join(d.root,"fixtures/compatible-react-vite",file),"utf8")).toBe(content)
  })
})
