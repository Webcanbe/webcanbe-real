import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { build } from "esbuild"
import { afterEach, expect, it, vi } from "vitest"
import { ProjectRegistry } from "./runtime/projectRegistry"
import { SqliteAuthorityStore } from "./runtime/hostedAuthority"
import { SqliteLeaseStore, ScheduledRunnerProvider } from "./runtime/runnerScheduler"
import { contentHash, transactionEntry } from "./mutations/durableSource"
import { hostedRasterViewerDocument } from "./runtime/rasterViewer"
import type { ControlledJob } from "./runtime/controlledPreview"
const dispose: Array<() => unknown> = []
afterEach(async () => { vi.restoreAllMocks(); for (const close of dispose.splice(0).reverse()) await close() })
function directory() { const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "wcb-2g-failure-"))); dispose.push(() => fs.rmSync(dir, { recursive: true, force: true })); return dir }
it("recovers a real SIGKILL during durable scheduler allocation before releasing capacity", async () => {
  const dir = directory(), runtime = path.join(dir, "lease-runtime.cjs"), file = path.join(dir, "leases.sqlite"), generation = randomUUID()
  await build({ stdin: { contents: 'export {SqliteLeaseStore,LOCAL_RESOURCE_BUDGET} from "./src/webcanbe-engine/runtime/runnerScheduler"', resolveDir: process.cwd() }, bundle: true, platform: "node", format: "cjs", packages: "external", outfile: runtime, logLevel: "silent" })
  const child = spawnSync(process.execPath, ["-e", `const {SqliteLeaseStore,LOCAL_RESOURCE_BUDGET}=require(${JSON.stringify(runtime)});const store=new SqliteLeaseStore(${JSON.stringify(file)});store.reserve({generation:${JSON.stringify(generation)},requestHash:'crash-request',state:'allocating',allocation:{owner:{userId:'synthetic-user',workspaceId:'synthetic-workspace',projectId:'synthetic-project',sessionId:'synthetic-session'},idempotencyKey:'synthetic-crash',startupDeadline:Date.now()+15000,executionDeadline:Date.now()+60000,idleMs:60000,budget:LOCAL_RESOURCE_BUDGET}},{global:4,tenant:2,project:2});process.kill(process.pid,'SIGKILL')`], { env: { ...process.env, NODE_PATH: path.join(process.cwd(), "node_modules") }, encoding: "utf8", timeout: 10000 })
  expect(child.signal, child.stderr).toBe("SIGKILL")
  const store = new SqliteLeaseStore(file), revoked: string[] = []
  const scheduler = new ScheduledRunnerProvider({ revoke: async id => { revoked.push(id) }, open: async () => { throw new Error("not launched") } }, store, () => false)
  dispose.push(() => scheduler.close())
  await expect(scheduler.open({ generation: randomUUID() } as ControlledJob, new AbortController().signal)).rejects.toThrow("ownership")
  expect(revoked).toEqual([generation]); expect(store.unsettled()).toHaveLength(0)
})
it.each(["pending.json", "history.json"])("rolls back actual source/ledger changes after a %s storage rename failure", target => {
  const dir = directory(); fs.cpSync(path.join(process.cwd(), "fixtures/compatible-react-vite"), path.join(dir, "fixtures/compatible-react-vite"), { recursive: true })
  const registry = new ProjectRegistry(dir), source = registry.durable("phase1-fixture"), before = source.files(), revision = source.revision(), rename = fs.renameSync
  vi.spyOn(fs, "renameSync").mockImplementation((from, to) => { if (String(to).endsWith("/" + target)) throw new Error("Synthetic storage write failure"); return rename(from, to) })
  expect(() => source.commit({ expectedRevision: revision, operations: [{ kind: "update", file: "src/App.css", expectedHash: contentHash(before.get("src/App.css")!), content: "/* must roll back */" }], entry: transactionEntry("phase1-fixture", revision, "code", "storage-failure", "request", "storage fault", { level: "parse", passed: true, diagnostics: [] }), authorize: () => {} })).toThrow("storage write failure")
  vi.restoreAllMocks(); const restarted = new ProjectRegistry(dir).durable("phase1-fixture")
  expect(restarted.files()).toEqual(before); expect(restarted.revision()).toBe(revision); expect(restarted.history().transactions).toHaveLength(0)
})
it("revocation during source commit rolls back writes and leaves no accepted revision", () => {
  const dir = directory(), accounts = new SqliteAuthorityStore(path.join(dir, "authority.sqlite")); dispose.push(() => accounts.close())
  fs.cpSync(path.join(process.cwd(), "fixtures/compatible-react-vite"), path.join(dir, "fixtures/compatible-react-vite"), { recursive: true })
  const registry = new ProjectRegistry(dir), source = registry.durable("phase1-fixture"), before = source.files(), revision = source.revision(), user = randomUUID(), workspace = randomUUID(), project = randomUUID()
  accounts.setWorkspaceMember(workspace, user, "owner"); const auth = accounts.issueVerifiedSession(user); accounts.registerProject(auth.session, workspace, project); const grant = accounts.grant(auth.session, project, "code")
  expect(() => source.commit({ expectedRevision: revision, operations: [{ kind: "update", file: "src/App.css", expectedHash: contentHash(before.get("src/App.css")!), content: "/* revoke during write */" }], entry: transactionEntry("phase1-fixture", revision, "code", "revoke-during-commit", "request", "revocation", { level: "parse", passed: true, diagnostics: [] }), authorize: () => { if (!accounts.check(grant, "code")) throw new Error("revoked") }, fault: phase => { if (phase === "write") accounts.revokeSession(auth.session.sessionId) } })).toThrow("revoked")
  expect(source.files()).toEqual(before); expect(source.revision()).toBe(revision)
})
it("hosted raster document accepts only the exact configured parent and has no runtime authority", () => {
  const html = hostedRasterViewerDocument("https://app.webcanbe.example")
  expect(html).toContain('event.origin!=="https://app.webcanbe.example"')
  expect(html).not.toContain("localhost"); expect(html).not.toContain("fetch("); expect(html).not.toContain("cookie"); expect(html).not.toContain("localStorage"); expect(html).not.toContain("iframe")
  expect(() => hostedRasterViewerDocument("http://app.webcanbe.example")).toThrow("HTTPS")
})
