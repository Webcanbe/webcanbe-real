import fs from "node:fs"
import path from "node:path"
import { request } from "node:https"
import { randomUUID } from "node:crypto"
import { spawn } from "node:child_process"
import { build } from "esbuild"
import { Pool } from "pg"
import { describe, it, expect, afterEach } from "vitest"
import { HostedLinuxRunnerProvider } from "./runtime/hostedLinuxRunner"
import { PostgresLeaseStore } from "./runtime/postgresFencing"
import { snapshotPreview, type ControlledJob } from "./runtime/controlledPreview"
import { LOCAL_RESOURCE_BUDGET } from "./runtime/runnerScheduler"
const run = process.env.WCB_HOSTED_RUNNER_TEST === "1" ? describe : describe.skip
const configFile = path.resolve(".webcanbe/runner/qa-phase2g2/gateway-client.json")
const clean: Array<() => unknown> = []
afterEach(async () => { for (const close of clean.splice(0).reverse()) await close() })
const lookup: any = (_hostname: unknown, _options: unknown, cb: any) => cb(null, [{ address: "127.0.0.1", family: 4 }])
function snapshot(text = "Hosted local TEST", color = "red") {
  return snapshotPreview({ html: `<link rel="stylesheet" href="/test.css"><button id="count">${text}</button><script>let n=0;document.querySelector('button').onclick=()=>{document.querySelector('button').textContent='Count '+(++n);console.log('count='+n)};console.log('boot=${text}')</script>`, files: new Map([["/test.css", { contentType: "text/css", body: Buffer.from(`button{width:200px;height:50px;color:${color}}`) }]]) })
}
function job(): ControlledJob {
  const generation = randomUUID(), expiresAt = Date.now() + 60000
  return { generation, expiresAt, revision: "rev_" + randomUUID(), route: "/", origin: `http://wcb-${generation}.preview.invalid`, network: { external: "deny" }, snapshot: snapshot(), allocation: { owner: { userId: randomUUID(), workspaceId: randomUUID(), projectId: randomUUID(), sessionId: randomUUID() }, idempotencyKey: generation, startupDeadline: Date.now() + 15000, executionDeadline: expiresAt, idleMs: 60000, budget: LOCAL_RESOURCE_BUDGET } }
}
async function setup() {
  const config = JSON.parse(fs.readFileSync(configFile, "utf8")), pool = new Pool(config.postgres); clean.push(() => pool.end())
  const leases = new PostgresLeaseStore(pool), provider = new HostedLinuxRunnerProvider(leases, [{ ...config.host, lookup }], async () => true); clean.push(() => provider.close())
  await provider.recover()
  return { config, pool, leases, provider }
}
run("real Linux hosted-protocol provider through local TEST mTLS (not cloud isolation)", () => {
  it("executes native-sandbox Chromium, renders/input/updates and verifies explicit cleanup", async () => {
    const d = await setup(), request = job(), started = performance.now(), execution = await d.provider.open(request, new AbortController().signal)
    const startupMs = Math.round(performance.now() - started)
    const initial = await execution.sample!(); expect(Buffer.from(initial.bytes).subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a")
    expect((initial.observation as any).logs).toContain("log: boot=Hosted local TEST")
    await execution.input({ type: "pointer", action: "click", x: 70, y: 25 })
    expect((await execution.sample!()).observation).toMatchObject({ logs: expect.arrayContaining(["log: count=1"]) })
    const revision = "rev_" + randomUUID(), cssStart = performance.now()
    await execution.update!({ expectedRevision: request.revision, expectedDigest: request.snapshot.digest, revision, snapshot: snapshot("Hosted local TEST", "blue"), kind: "css-hot-update" })
    const cssMs = Math.round(performance.now() - cssStart)
    await execution.input({ type: "pointer", action: "click", x: 70, y: 25 })
    expect((await execution.sample!()).observation).toMatchObject({ logs: expect.arrayContaining(["log: count=2"]) })
    const closeStart = performance.now(); await execution.close(); await execution.close()
    expect((await d.pool.query("SELECT state FROM wcb_runner_leases WHERE generation=$1", [request.generation])).rows[0].state).toBe("stopped")
    await expect(execution.capture()).rejects.toThrow()
    fs.writeFileSync(".webcanbe/runner/qa-phase2g2/hosted-protocol-metrics.json", JSON.stringify({ boundary: "local Linux VM + TEST mTLS + PostgreSQL", startupMs, cssMs, cleanupMs: Math.round(performance.now() - closeStart), nativeSandboxRequiredByWorker: true }))
  }, 30000)
  it("rejects missing mTLS credentials and a forged fencing token", async () => {
    const d = await setup()
    const rpc = (credentials: boolean) => new Promise<number>((resolve, reject) => {
      const req = request(d.config.host.origin + "/rpc", { method: "POST", lookup, ca: d.config.host.ca, ...(credentials ? { cert: d.config.host.cert, key: d.config.host.key } : {}), headers: { "Content-Type": "application/json" } }, res => { res.resume(); res.on("end", () => resolve(res.statusCode!)) }); req.on("error", reject)
      req.end(JSON.stringify({ command: "sample", fence: { generation: randomUUID(), controller: randomUUID(), epoch: "1", hostId: "local-test-host" } }))
    })
    await expect(rpc(false)).rejects.toThrow(); expect(await rpc(true)).toBe(409)
    await expect(d.provider.revoke(randomUUID())).rejects.toThrow("not verified")
  })
  it("A owns a real runner, A is SIGKILLed, B retires it and A's late message cannot regain authority", async () => {
    const d = await setup(), requestJob = job(), module = path.resolve(".webcanbe/runner/qa-phase2g2/controller-runtime.cjs")
    await build({ stdin: { contents: 'export {HostedLinuxRunnerProvider} from "./src/webcanbe-engine/runtime/hostedLinuxRunner";export {PostgresLeaseStore} from "./src/webcanbe-engine/runtime/postgresFencing";', resolveDir: process.cwd() }, outfile: module, bundle: true, platform: "node", format: "cjs", packages: "external", logLevel: "silent" })
    const input = path.resolve(".webcanbe/runner/qa-phase2g2/controller-job.json"); fs.writeFileSync(input, JSON.stringify(requestJob), { mode: 0o600 })
    const code = `const fs=require('node:fs'),{Pool}=require('pg'),{HostedLinuxRunnerProvider,PostgresLeaseStore}=require(process.argv[1]);(async()=>{const c=JSON.parse(fs.readFileSync(process.argv[2])),pool=new Pool(c.postgres),p=new HostedLinuxRunnerProvider(new PostgresLeaseStore(pool),[{...c.host,lookup:(_h,_o,cb)=>cb(null,[{address:'127.0.0.1',family:4}])}],async()=>true);await p.open(JSON.parse(fs.readFileSync(process.argv[3])),new AbortController().signal);console.log('ready');setInterval(()=>{},10000)})().catch(()=>process.exit(1));`
    const child = spawn(process.execPath, ["-e", code, module, configFile, input], { stdio: ["ignore", "pipe", "pipe"] }); clean.push(() => { if (!child.killed) child.kill("SIGKILL") })
    await new Promise<void>((resolve, reject) => { const timeout = setTimeout(() => reject(Error("Controller A startup timed out")), 20000); child.stdout.on("data", data => { if (String(data).includes("ready")) { clearTimeout(timeout); resolve() } }); child.on("exit", code => { if (code !== null) { clearTimeout(timeout); reject(Error("Controller A failed")) } }) })
    const row = (await d.pool.query("SELECT * FROM wcb_runner_leases WHERE generation=$1", [requestJob.generation])).rows[0]
    expect(row.state).toBe("running"); child.kill("SIGKILL"); await new Promise(resolve => child.on("exit", resolve))
    await new Promise(r => setTimeout(r, 5400)); await d.provider.recover()
    const recovered = (await d.pool.query("SELECT * FROM wcb_runner_leases WHERE generation=$1", [requestJob.generation])).rows[0]
    expect(recovered.state).toBe("stopped"); expect(BigInt(recovered.epoch)).toBe(BigInt(row.epoch) + 1n)
    const late = { generation: row.generation, controller: row.controller, epoch: String(row.epoch), hostId: row.host_id }
    await expect(d.leases.heartbeat(late)).rejects.toThrow("Stale"); await expect(d.leases.guard(late, async () => "late sample")).rejects.toThrow("Stale")
    const fresh = await d.provider.open(job(), new AbortController().signal); expect((await fresh.capture()).length).toBeGreaterThan(100); await fresh.close()
  }, 45000)
})
