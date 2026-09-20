import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { afterEach, describe, expect, it } from "vitest"

const roots:string[]=[]
afterEach(()=>{for(const root of roots.splice(0))fs.rmSync(root,{recursive:true,force:true})})

function tempRoot(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"wcb-dr-rehearsal-"))
  roots.push(root)
  return root
}
function executable(file:string,source:string){
  fs.writeFileSync(file,source,{mode:0o755})
  fs.chmodSync(file,0o755)
}

describe("Phase 5 disaster-recovery tool rehearsal",()=>{
  it("behaviorally proves the rollback wrapper refuses unsafe calls and forwards an exact approved version",()=>{
    const root=tempRoot(), capture=path.join(root,"npx-args.txt"), fake=path.join(root,"npx")
    executable(fake,[
      "#!/bin/sh",
      'printf "%s\\n" "$@" > "$WCB_CAPTURE"',
      "exit 0",
      "",
    ].join("\n"))

    const version="12345678-1234-4234-8234-123456789abc"
    const baseEnv={...process.env,PATH:root+path.delimiter+(process.env.PATH||""),WCB_CAPTURE:capture}

    const noConfirm=spawnSync(process.execPath,["scripts/cloudflare-rollback.mjs",version],{cwd:process.cwd(),env:baseEnv,encoding:"utf8"})
    expect(noConfirm.status).toBe(1)
    expect(fs.existsSync(capture)).toBe(false)
    expect(noConfirm.stderr).toContain("Refusing production rollback")

    const badId=spawnSync(process.execPath,["scripts/cloudflare-rollback.mjs","not-a-version"],{cwd:process.cwd(),env:{...baseEnv,WEBCANBE_ROLLBACK_CONFIRM:"ROLLBACK_PRODUCTION"},encoding:"utf8"})
    expect(badId.status).toBe(1)
    expect(fs.existsSync(capture)).toBe(false)

    const approved=spawnSync(process.execPath,["scripts/cloudflare-rollback.mjs",version],{
      cwd:process.cwd(),
      env:{...baseEnv,WEBCANBE_ROLLBACK_CONFIRM:"ROLLBACK_PRODUCTION",WEBCANBE_ROLLBACK_MESSAGE:"controlled rehearsal"},
      encoding:"utf8",
    })
    expect(approved.status).toBe(0)
    expect(fs.readFileSync(capture,"utf8").trim().split("\n")).toEqual([
      "wrangler","rollback",version,"--message","controlled rehearsal",
    ])
  })

  it("behaviorally proves backup credentials stay in child env and the produced archive is verifiable",()=>{
    const root=tempRoot(), bin=path.join(root,"bin"), capture=path.join(root,"dump-capture.json"), target=path.join(root,"backup.dump")
    fs.mkdirSync(bin)

    executable(path.join(bin,"pg_dump"),[
      "#!/usr/bin/env node",
      'const fs=require("fs")',
      'const args=process.argv.slice(2)',
      'const idx=args.indexOf("--file")',
      'if(idx<0||!args[idx+1])process.exit(2)',
      'fs.writeFileSync(args[idx+1],"fixture-dump-bytes")',
      'fs.writeFileSync(process.env.WCB_DUMP_CAPTURE,JSON.stringify({args,password:process.env.PGPASSWORD,raw:process.env.WEBCANBE_DATABASE_URL||null}))',
      "",
    ].join("\n"))

    executable(path.join(bin,"pg_restore"),[
      "#!/usr/bin/env node",
      'for(let i=1;i<=20;i++)console.log("1; 0 0 TABLE DATA public wcb_fixture_"+i+" owner")',
      "",
    ].join("\n"))

    const password=["fixture","value"].join("-")
    const url="postgresql://operator:"+encodeURIComponent(password)+"@localhost:5432/postgres?sslmode=require"
    const env={...process.env,PATH:bin+path.delimiter+(process.env.PATH||""),WEBCANBE_DATABASE_URL:url,WCB_DUMP_CAPTURE:capture}

    const backup=spawnSync(process.execPath,["scripts/db/backup.mjs",target],{cwd:process.cwd(),env,encoding:"utf8"})
    expect(backup.status).toBe(0)
    expect(fs.existsSync(target)).toBe(true)
    expect(fs.existsSync(target+".sha256")).toBe(true)

    const seen=JSON.parse(fs.readFileSync(capture,"utf8"))
    expect(seen.password).toBe(password)
    expect(seen.raw).toBeNull()
    expect(seen.args.join(" ")).not.toContain(password)
    expect(seen.args.join(" ")).not.toContain("postgresql://")

    const verify=spawnSync(process.execPath,["scripts/db/verify-backup.mjs",target],{
      cwd:process.cwd(),
      env:{...process.env,PATH:bin+path.delimiter+(process.env.PATH||"")},
      encoding:"utf8",
    })
    expect(verify.status).toBe(0)
    expect(verify.stdout).toContain("Backup verified")
    expect(verify.stdout).toContain("Webcanbe table-data entries: 20")
  })
})
