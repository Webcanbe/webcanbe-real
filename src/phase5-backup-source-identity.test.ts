import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { afterEach, describe, expect, it } from "vitest"
import { readSourceManifest } from "../scripts/db/backup-source-manifest.mjs"

const roots:string[]=[]
afterEach(()=>{for(const root of roots.splice(0))fs.rmSync(root,{recursive:true,force:true})})

function tempRoot(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"wcb-backup-identity-"))
  roots.push(root)
  return root
}
function executable(file:string,body:string){
  fs.writeFileSync(file,body,{mode:0o755})
  fs.chmodSync(file,0o755)
}

describe("Phase 5 backup source identity binding",()=>{
  it("writes a non-secret source identity manifest bound to the archive digest",()=>{
    const root=tempRoot(), bin=path.join(root,"bin"), target=path.join(root,"backup.dump"), capture=path.join(root,"psql-calls.json")
    fs.mkdirSync(bin)
    executable(path.join(bin,"psql"),[
      "#!/usr/bin/env node",
      'const fs=require("fs")',
      'const calls=fs.existsSync(process.env.WCB_PSQL_CAPTURE)?JSON.parse(fs.readFileSync(process.env.WCB_PSQL_CAPTURE,"utf8")):[]',
      'calls.push({args:process.argv.slice(2),host:process.env.PGHOST,database:process.env.PGDATABASE,password:process.env.PGPASSWORD,raw:process.env.WEBCANBE_DATABASE_URL||null})',
      'fs.writeFileSync(process.env.WCB_PSQL_CAPTURE,JSON.stringify(calls))',
      'process.stdout.write("7777777777777777777\\t"+process.env.PGDATABASE+"\\n")',
      "",
    ].join("\n"))
    executable(path.join(bin,"pg_dump"),[
      "#!/usr/bin/env node",
      'const fs=require("fs")',
      'const args=process.argv.slice(2)',
      'const index=args.indexOf("--file")',
      'fs.writeFileSync(args[index+1],"fixture-backup-bytes")',
      "",
    ].join("\n"))

    const password="source-identity-secret"
    const env={
      ...process.env,
      PATH:bin+path.delimiter+(process.env.PATH||""),
      WEBCANBE_DATABASE_URL:"postgresql://operator:"+encodeURIComponent(password)+"@prod.example.test:5432/postgres?sslmode=require",
      WCB_PSQL_CAPTURE:capture,
    }
    const result=spawnSync(process.execPath,["scripts/db/backup.mjs",target],{cwd:process.cwd(),env,encoding:"utf8"})
    expect(result.status).toBe(0)
    expect(fs.existsSync(target)).toBe(true)
    expect(fs.existsSync(target+".sha256")).toBe(true)
    expect(fs.existsSync(target+".source.json")).toBe(true)

    const digest=crypto.createHash("sha256").update(fs.readFileSync(target)).digest("hex")
    const manifest=readSourceManifest(target,digest)
    expect(manifest.systemIdentifier).toBe("7777777777777777777")
    expect(manifest.database).toBe("postgres")
    expect(manifest.archiveSha256).toBe(digest)

    const rawManifest=fs.readFileSync(target+".source.json","utf8")
    expect(rawManifest).not.toContain(password)
    expect(rawManifest).not.toContain("prod.example.test")
    expect(rawManifest).not.toContain("operator")

    const calls=JSON.parse(fs.readFileSync(capture,"utf8"))
    expect(calls).toHaveLength(2)
    expect(calls.every((call:any)=>call.password===password)).toBe(true)
    expect(calls.every((call:any)=>call.raw===null)).toBe(true)
    expect(calls.flatMap((call:any)=>call.args).join(" ")).not.toContain(password)
    expect(calls.flatMap((call:any)=>call.args).join(" ")).not.toContain("postgresql://")
  })

  it("deletes the archive when the connected source identity changes during backup",()=>{
    const root=tempRoot(), bin=path.join(root,"bin"), target=path.join(root,"backup.dump"), count=path.join(root,"psql-count")
    fs.mkdirSync(bin)
    executable(path.join(bin,"psql"),[
      "#!/usr/bin/env node",
      'const fs=require("fs")',
      'const n=fs.existsSync(process.env.WCB_PSQL_COUNT)?Number(fs.readFileSync(process.env.WCB_PSQL_COUNT,"utf8")):0',
      'fs.writeFileSync(process.env.WCB_PSQL_COUNT,String(n+1))',
      'process.stdout.write((n===0?"1111111111111111111":"2222222222222222222")+"\\t"+process.env.PGDATABASE+"\\n")',
      "",
    ].join("\n"))
    executable(path.join(bin,"pg_dump"),[
      "#!/usr/bin/env node",
      'const fs=require("fs")',
      'const args=process.argv.slice(2)',
      'const index=args.indexOf("--file")',
      'fs.writeFileSync(args[index+1],"fixture-backup-bytes")',
      "",
    ].join("\n"))

    const env={
      ...process.env,
      PATH:bin+path.delimiter+(process.env.PATH||""),
      WEBCANBE_DATABASE_URL:"postgresql://"+"operator"+":"+"fixture"+"@"+"prod.example.test"+":5432/postgres?sslmode=require",
      WCB_PSQL_COUNT:count,
    }
    const result=spawnSync(process.execPath,["scripts/db/backup.mjs",target],{cwd:process.cwd(),env,encoding:"utf8"})
    expect(result.status).toBe(1)
    expect(result.stderr).toContain("source identity changed while the backup was being created")
    expect(fs.existsSync(target)).toBe(false)
    expect(fs.existsSync(target+".source.json")).toBe(false)
  })

  it("rejects a source manifest whose archive digest does not match",()=>{
    const root=tempRoot(), target=path.join(root,"backup.dump")
    fs.writeFileSync(target,"archive")
    fs.writeFileSync(target+".source.json",JSON.stringify({
      format:"webcanbe-postgres-backup-source-v1",
      systemIdentifier:"7777777777777777777",
      database:"postgres",
      archiveSha256:"a".repeat(64),
      createdAt:"2026-09-21T00:00:00.000Z",
    }))
    expect(()=>readSourceManifest(target,"b".repeat(64))).toThrow("Backup source manifest archive digest mismatch.")
  })
})
