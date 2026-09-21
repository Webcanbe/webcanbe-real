import crypto from "node:crypto"
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
function dbUrl(user:string,password:string,host:string){
  return "postgresql://"+user+":"+encodeURIComponent(password)+"@"+host+":5432/postgres?sslmode=require"
}
function writeBackupFixture(backup:string, systemIdentifier="1111111111111111111", database="postgres"){
  fs.writeFileSync(backup,"fixture-archive")
  const digest=crypto.createHash("sha256").update(fs.readFileSync(backup)).digest("hex")
  fs.writeFileSync(backup+".sha256",digest+"  "+path.basename(backup)+"\n")
  fs.writeFileSync(backup+".source.json",JSON.stringify({
    format:"webcanbe-postgres-backup-source-v1",
    systemIdentifier,
    database,
    archiveSha256:digest,
    createdAt:"2026-09-21T00:00:00.000Z",
  }))
}
function fakeArchiveVerifier(bin:string,capture?:string){
  executable(path.join(bin,"pg_restore"),[
    "#!/bin/sh",
    ...(capture ? ['printf "%s\\n" "$@" > "$WCB_RESTORE_CAPTURE"'] : []),
    'i=1; while [ "$i" -le 20 ]; do echo "1; 0 0 TABLE DATA public wcb_fixture_$i owner"; i=$((i+1)); done',
    "exit 0",
    "",
  ].join("\n"))
}
function fakeIdentityProbe(bin:string,body:string){
  executable(path.join(bin,"psql"),"#!/bin/sh\n"+body+"\n")
}

describe("Phase 5 recovery-target restore tooling",()=>{
  it("hard-codes the recovery-only safety boundary, source manifest guard and transactional restore flags",()=>{
    expect(source).toContain("RECOVERY_DATABASE_URL")
    expect(source).toContain("WEBCANBE_DATABASE_URL")
    expect(source).toContain("readSourceManifest")
    expect(source).toContain("recordedSourceIdentity")
    expect(source).toContain("USE_BACKUP_SOURCE_IDENTITY")
    expect(source).toContain("Recovery target matches the PostgreSQL cluster/database identity recorded in the backup")
    expect(source).toContain("pg_control_system()")
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
    writeBackupFixture(backup)
    const env={
      ...process.env,
      WEBCANBE_DATABASE_URL:dbUrl("prod","prod-secret","db.example.test"),
      RECOVERY_DATABASE_URL:dbUrl("recovery","recovery-secret","db.example.test"),
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
    writeBackupFixture(backup)
    const env={
      ...process.env,
      WEBCANBE_DATABASE_URL:dbUrl("prod","prod-secret","prod.example.test"),
      RECOVERY_DATABASE_URL:dbUrl("recovery","recovery-secret","recovery.example.test"),
    }
    const result=spawnSync(process.execPath,["scripts/db/restore-recovery.mjs",backup],{cwd:process.cwd(),env,encoding:"utf8"})
    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Refusing recovery restore without WEBCANBE_RESTORE_CONFIRM=RESTORE_RECOVERY_TARGET.")
  })

  it("refuses recovery when the connected target matches the identity recorded in the backup",()=>{
    const root=tempRoot(), bin=path.join(root,"bin"), backup=path.join(root,"backup.dump")
    fs.mkdirSync(bin)
    writeBackupFixture(backup,"7777777777777777777")
    fakeArchiveVerifier(bin)
    fakeIdentityProbe(bin,'printf "7777777777777777777\\tpostgres\\n"')
    const env={
      ...process.env,
      PATH:bin+path.delimiter+(process.env.PATH||""),
      WEBCANBE_DATABASE_URL:dbUrl("prod","prod-secret","current-prod.example.test"),
      RECOVERY_DATABASE_URL:dbUrl("recovery","recovery-secret","recovery.example.test"),
      WEBCANBE_RESTORE_CONFIRM:"RESTORE_RECOVERY_TARGET",
    }
    const result=spawnSync(process.execPath,["scripts/db/restore-recovery.mjs",backup],{cwd:process.cwd(),env,encoding:"utf8"})
    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Recovery target matches the PostgreSQL cluster/database identity recorded in the backup")
    expect(result.stdout+result.stderr).not.toContain("prod-secret")
    expect(result.stdout+result.stderr).not.toContain("recovery-secret")
  })

  it("refuses DNS aliases that connect to the same current production cluster/database before target mutation",()=>{
    const root=tempRoot(), bin=path.join(root,"bin"), backup=path.join(root,"backup.dump")
    fs.mkdirSync(bin)
    writeBackupFixture(backup,"1111111111111111111")
    fakeArchiveVerifier(bin)
    fakeIdentityProbe(bin,'if [ "$PGHOST" = "recovery-alias.example.test" ]; then printf "2222222222222222222\\tpostgres\\n"; else printf "2222222222222222222\\tpostgres\\n"; fi')
    const env={
      ...process.env,
      PATH:bin+path.delimiter+(process.env.PATH||""),
      WEBCANBE_DATABASE_URL:dbUrl("prod","prod-secret","primary-alias.example.test"),
      RECOVERY_DATABASE_URL:dbUrl("recovery","recovery-secret","recovery-alias.example.test"),
      WEBCANBE_RESTORE_CONFIRM:"RESTORE_RECOVERY_TARGET",
    }
    const result=spawnSync(process.execPath,["scripts/db/restore-recovery.mjs",backup],{cwd:process.cwd(),env,encoding:"utf8"})
    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Production and recovery connect to the same PostgreSQL cluster/database identity")
  })

  it("fails closed when PostgreSQL identity evidence is malformed",()=>{
    const root=tempRoot(), bin=path.join(root,"bin"), backup=path.join(root,"backup.dump")
    fs.mkdirSync(bin)
    writeBackupFixture(backup)
    fakeArchiveVerifier(bin)
    fakeIdentityProbe(bin,'printf "unknown\\n"')
    const env={
      ...process.env,
      PATH:bin+path.delimiter+(process.env.PATH||""),
      WEBCANBE_DATABASE_URL:dbUrl("prod","prod-secret","prod.example.test"),
      RECOVERY_DATABASE_URL:dbUrl("recovery","recovery-secret","recovery.example.test"),
      WEBCANBE_RESTORE_CONFIRM:"RESTORE_RECOVERY_TARGET",
    }
    const result=spawnSync(process.execPath,["scripts/db/restore-recovery.mjs",backup],{cwd:process.cwd(),env,encoding:"utf8"})
    expect(result.status).toBe(1)
    expect(result.stderr).toContain("PostgreSQL identity probe returned malformed output")
  })

  it("supports a non-mutating plan rehearsal with recorded source plus live production verification",()=>{
    const root=tempRoot(), bin=path.join(root,"bin"), backup=path.join(root,"backup.dump"), capture=path.join(root,"restore-args.txt")
    fs.mkdirSync(bin)
    writeBackupFixture(backup,"1111111111111111111")
    fakeArchiveVerifier(bin,capture)
    fakeIdentityProbe(bin,[
      'if [ "$PGHOST" = "prod.example.test" ]; then',
      '  printf "1111111111111111111\\tpostgres\\n"',
      "else",
      '  printf "2222222222222222222\\tpostgres\\n"',
      "fi",
    ].join("\n"))

    const env={
      ...process.env,
      PATH:bin+path.delimiter+(process.env.PATH||""),
      WCB_RESTORE_CAPTURE:capture,
      WEBCANBE_DATABASE_URL:dbUrl("prod","prod-secret","prod.example.test"),
      RECOVERY_DATABASE_URL:dbUrl("recovery","recovery-secret","recovery.example.test"),
      WEBCANBE_RESTORE_CONFIRM:"RESTORE_RECOVERY_TARGET",
      WEBCANBE_RESTORE_PLAN_ONLY:"1",
    }
    const result=spawnSync(process.execPath,["scripts/db/restore-recovery.mjs",backup],{cwd:process.cwd(),env,encoding:"utf8"})
    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Backup verified")
    expect(result.stdout).toContain("Recorded backup source identity verified")
    expect(result.stdout).toContain("distinct from the recorded backup source and current production")
    expect(result.stdout).toContain("Recovery restore plan verified")
    expect(fs.readFileSync(capture,"utf8").trim().split("\n")).toEqual(["--list",backup])
    expect(result.stdout+result.stderr).not.toContain("prod-secret")
    expect(result.stdout+result.stderr).not.toContain("recovery-secret")
  })

  it("supports an explicitly confirmed offline plan when production is unreachable",()=>{
    const root=tempRoot(), bin=path.join(root,"bin"), backup=path.join(root,"backup.dump")
    fs.mkdirSync(bin)
    writeBackupFixture(backup,"1111111111111111111")
    fakeArchiveVerifier(bin)
    fakeIdentityProbe(bin,'printf "2222222222222222222\\tpostgres\\n"')
    const env={
      ...process.env,
      PATH:bin+path.delimiter+(process.env.PATH||""),
      RECOVERY_DATABASE_URL:dbUrl("recovery","recovery-secret","recovery.example.test"),
      WEBCANBE_RESTORE_CONFIRM:"RESTORE_RECOVERY_TARGET",
      WEBCANBE_RESTORE_OFFLINE_SOURCE_CONFIRM:"USE_BACKUP_SOURCE_IDENTITY",
      WEBCANBE_RESTORE_PLAN_ONLY:"1",
    }
    delete env.WEBCANBE_DATABASE_URL
    const result=spawnSync(process.execPath,["scripts/db/restore-recovery.mjs",backup],{cwd:process.cwd(),env,encoding:"utf8"})
    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Recorded backup source identity verified")
    expect(result.stdout).toContain("distinct from the recorded backup source.")
    expect(result.stdout).toContain("Recovery restore plan verified")
  })

  it("refuses offline recovery planning without explicit source-manifest confirmation",()=>{
    const root=tempRoot(), backup=path.join(root,"backup.dump")
    writeBackupFixture(backup)
    const env={
      ...process.env,
      RECOVERY_DATABASE_URL:dbUrl("recovery","recovery-secret","recovery.example.test"),
      WEBCANBE_RESTORE_CONFIRM:"RESTORE_RECOVERY_TARGET",
      WEBCANBE_RESTORE_PLAN_ONLY:"1",
    }
    delete env.WEBCANBE_DATABASE_URL
    const result=spawnSync(process.execPath,["scripts/db/restore-recovery.mjs",backup],{cwd:process.cwd(),env,encoding:"utf8"})
    expect(result.status).toBe(1)
    expect(result.stderr).toContain("offline restore requires WEBCANBE_RESTORE_OFFLINE_SOURCE_CONFIRM=USE_BACKUP_SOURCE_IDENTITY")
  })
})
