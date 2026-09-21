import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { afterEach, describe, expect, it } from "vitest"

const source = fs.readFileSync("scripts/db/restore-recovery.mjs", "utf8")
const roots:string[]=[]
afterEach(()=>{for(const root of roots.splice(0))fs.rmSync(root,{recursive:true,force:true})})

function tempRoot(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"wcb-restore-rehearsal-"))
  roots.push(root)
  return root
}
function executable(file:string,body:string){
  fs.writeFileSync(file,body,{mode:0o755})
  fs.chmodSync(file,0o755)
}

describe("Phase 5 recovery-target restore tooling",()=>{
  it("hard-codes the recovery-only safety boundary and transactional restore flags",()=>{
    expect(source).toContain("WEBCANBE_DATABASE_URL")
    expect(source).toContain("RECOVERY_DATABASE_URL")
    expect(source).toContain("Refusing restore because recovery target resolves to the production database target.")
    expect(source).toContain("WEBCANBE_RESTORE_CONFIRM")
    expect(source).toContain("RESTORE_RECOVERY_TARGET")
    expect(source).toContain("TRUNCATE TABLE")
    expect(source).toContain("RESTART IDENTITY CASCADE")
    expect(source).toContain('"--data-only"')
    expect(source).toContain('"--exit-on-error"')
    expect(source).toContain('"--single-transaction"')
    expect(source).toContain('"scripts/db/recovery-preflight.mjs"')
    expect(source).not.toContain("console.log(process.env.RECOVERY_DATABASE_URL")
  })

  it("refuses the production database even when recovery uses different credentials",()=>{
    const root=tempRoot(), backup=path.join(root,"backup.dump")
    fs.writeFileSync(backup,"fixture")
    const env={
      ...process.env,
      WEBCANBE_DATABASE_URL:"postgresql://prod:prod-secret@db.example.test:5432/postgres?sslmode=require",
      RECOVERY_DATABASE_URL:"postgresql://recovery:recovery-secret@db.example.test:5432/postgres?sslmode=require",
      WEBCANBE_RESTORE_CONFIRM:"RESTORE_RECOVERY_TARGET",
    }
    const result=spawnSync(process.execPath,["scripts/db/restore-recovery.mjs",backup],{cwd:process.cwd(),env,encoding:"utf8"})
    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Refusing restore because recovery target resolves to the production database target.")
    expect(result.stdout+result.stderr).not.toContain("prod-secret")
    expect(result.stdout+result.stderr).not.toContain("recovery-secret")
  })

  it("requires explicit confirmation before invoking backup verification",()=>{
    const root=tempRoot(), backup=path.join(root,"backup.dump")
    fs.writeFileSync(backup,"fixture")
    const env={
      ...process.env,
      WEBCANBE_DATABASE_URL:"postgresql://prod:prod-secret@prod.example.test:5432/postgres",
      RECOVERY_DATABASE_URL:"postgresql://recovery:recovery-secret@recovery.example.test:5432/postgres",
    }
    const result=spawnSync(process.execPath,["scripts/db/restore-recovery.mjs",backup],{cwd:process.cwd(),env,encoding:"utf8"})
    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Refusing recovery restore without WEBCANBE_RESTORE_CONFIRM=RESTORE_RECOVERY_TARGET.")
  })

  it("supports a non-mutating plan rehearsal after archive integrity verification",()=>{
    const root=tempRoot(), bin=path.join(root,"bin"), backup=path.join(root,"backup.dump"), capture=path.join(root,"restore-args.txt")
    fs.mkdirSync(bin)
    fs.writeFileSync(backup,"fixture-archive")
    executable(path.join(bin,"pg_restore"),[
      "#!/bin/sh",
      'printf "%s\\n" "$@" > "$WCB_RESTORE_CAPTURE"',
      'i=1; while [ "$i" -le 20 ]; do echo "1; 0 0 TABLE DATA public wcb_fixture_$i owner"; i=$((i+1)); done',
      "exit 0",
      "",
    ].join("\n"))

    const env={
      ...process.env,
      PATH:bin+path.delimiter+(process.env.PATH||""),
      WCB_RESTORE_CAPTURE:capture,
      WEBCANBE_DATABASE_URL:"postgresql://prod:prod-secret@prod.example.test:5432/postgres?sslmode=require",
      RECOVERY_DATABASE_URL:"postgresql://recovery:recovery-secret@recovery.example.test:5432/postgres?sslmode=require",
      WEBCANBE_RESTORE_CONFIRM:"RESTORE_RECOVERY_TARGET",
      WEBCANBE_RESTORE_PLAN_ONLY:"1",
    }
    const result=spawnSync(process.execPath,["scripts/db/restore-recovery.mjs",backup],{cwd:process.cwd(),env,encoding:"utf8"})
    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Backup verified")
    expect(result.stdout).toContain("Recovery restore plan verified")
    expect(fs.readFileSync(capture,"utf8").trim().split("\n")).toEqual(["--list",backup])
    expect(result.stdout+result.stderr).not.toContain("prod-secret")
    expect(result.stdout+result.stderr).not.toContain("recovery-secret")
  })
})
