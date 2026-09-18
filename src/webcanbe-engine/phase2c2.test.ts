import { LocalLimaRunnerProvider } from "./runtime/localLimaRunner"
import { randomUUID } from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, expect, it, vi } from "vitest"
import { ControlledPreviewTransport, RunnerCleanupError, snapshotPreview, validPreviewInput, type RunnerObservation } from "./runtime/controlledPreview"
import { ProjectRegistry } from "./runtime/projectRegistry"
import { analyzeReactSource } from "./adapters/react/reactSourceAdapter"
const roots: string[] = [], transports: ControlledPreviewTransport[] = []
afterEach(async () => { for (const t of transports.splice(0)) await t.close().catch(() => {}); for (const p of roots.splice(0)) fs.rmSync(p, { recursive: true, force: true }) })
// Broker/representation tests only. scripts/runner/verify.cjs is the real OS proof.
async function setup() {
 const root = fs.mkdtempSync(path.join(os.tmpdir(), "wcb-raster-")); roots.push(root)
 fs.cpSync(path.join(process.cwd(), "fixtures/compatible-react-vite"), path.join(root, "fixtures/compatible-react-vite"), { recursive: true })
 const registry = new ProjectRegistry(root), id = "phase1-fixture", session = registry.createSession(id)!, authority = { ...session, operation: "preview" as const }
 const png = Buffer.alloc(33); Buffer.from("89504e470d0a1a0a", "hex").copy(png); png.write("IHDR",12); png.writeUInt32BE(1280,16); png.writeUInt32BE(900,20)
 let observation: unknown = { route: "/", viewport: { width: 1280, height: 900 }, selection: null, logs: [] }
 const execution = { capture: async () => png, sample: async () => ({ bytes: png, observation }), input: vi.fn(async () => {}), close: vi.fn(async () => {}) }
 const runner = { open: vi.fn(async () => execution) }
 const transport = new ControlledPreviewTransport(registry, process.cwd(), runner); transports.push(transport)
 const view = await transport.start(id, authority, { revision: registry.revision(id), route: "/" })
 return { registry, id, authority, execution, transport, view, root, runner, set: (v: unknown) => { observation = v }, capture: () => transport.capture(id, authority, view.generation) }
}
it("bounds and allowlists every controlled interaction; no evaluation, URL or source command", () => {
 for (const input of [{ type: "scroll", dx: 0, dy: 500 }, { type: "history", action: "reload" }, { type: "viewport", width: 390, height: 900 }, { type: "pointer", action: "select", x: 5, y: 8 }]) expect(validPreviewInput(input)).toBe(true)
 for (const input of [{ type: "evaluate", script: "alert(1)" }, { type: "navigate", route: "//example.com" }, { type: "history", action: "close" }, { type: "scroll", dx: 0, dy: Infinity }, { type: "viewport", width: 99999, height: 900 }, { type: "pointer", action: "select", x: 0, y: 0, capability: "fake" }]) expect(validPreviewInput(input)).toBe(false)
})
it("projects observations and binds input to the delivered frame sequence", async () => {
 const d = await setup(); d.set({ route: "/", viewport: { width: 1280, height: 900 }, selection: null, logs: ["hello"], html: "<script>bad</script>", capability: "forged" })
 const frame = await d.capture(); expect(frame.sequence).toBe(1); expect(frame.observation).toEqual({ route: "/", viewport: { width: 1280, height: 900 }, selection: null, logs: ["hello"] })
 await d.transport.input(d.id,d.authority,d.view.generation,{ type: "pointer", action: "select", x: 5,y: 5 },frame.sequence)
 await d.capture(); await expect(d.transport.input(d.id,d.authority,d.view.generation,{type:"pointer",action:"select",x:5,y:5},frame.sequence)).rejects.toThrow("stale")
 expect(d.execution.input).toHaveBeenCalledOnce()
})
it.each(["geometry", "logs", "identity", "route"])("rejects malformed %s across the worker JSON boundary", async kind => {
 const d = await setup(); const v: any = { route: "/", viewport: { width: 1280, height: 900 }, selection: null, logs: [] }
 if (kind === "geometry") v.viewport.width = 390
 if (kind === "logs") v.logs = ["x".repeat(400)]
 if (kind === "route") v.route = "https://evil.invalid"
 if (kind === "identity") v.selection = { identity: { file: "../outside", elementStart: 0 }, tagName: "h1", rect: { top: 0, left: 0, width: 1, height: 1 }, computed: {}, layoutContext: "block" }
 d.set(v); await expect(d.capture()).rejects.toThrow(); expect(d.execution.close).toHaveBeenCalledOnce()
})
it("requires observed source identity to resolve in the current authorized project", async () => {
 const d = await setup(), store = d.registry.store(d.id,d.authority)!, file = d.registry.sourceFiles(d.id).find(f=>f.endsWith("Hero.tsx"))!
 const identity = analyzeReactSource(file,store.read(file)!,store.read).find(t=>t.elementName==='h1')!.identity
 const v: RunnerObservation = {route:"/",viewport:{width:1280,height:900},selection:{identity,tagName:"h1",rect:{top:10,left:10,width:100,height:40},computed:{color:"rgb(0, 0, 0)"},layoutContext:"block"},logs:[]}
 d.set(v); expect((await d.capture()).observation?.selection?.identity).toEqual(identity)
 d.set({...v,selection:{...v.selection!,identity:{file:"src/not-in-project.tsx",elementStart:0}}});expect((await d.capture()).observation?.selection).toBeNull()
})

it("quarantines startup when the provider cannot verify stop/reap, before reusing capacity", async () => {
 const d = await setup(), binary = path.join(d.root, ".webcanbe/runner/tools/bin/limactl")
 fs.mkdirSync(path.dirname(binary), { recursive: true })
 // Trusted fault injection at the host process seam, not project execution.
 fs.writeFileSync(binary, `#!/usr/bin/env node
 if(process.argv.includes('/opt/wcb-runtime/stop.sh'))process.exit(1);
 process.stdin.once('data',chunk=>{const request=JSON.parse(chunk.toString());console.log(JSON.stringify({id:request.id,error:'synthetic startup failure'}))});
 `, { mode: 0o755 })
 const generation = randomUUID(), local = new LocalLimaRunnerProvider(d.root)
 const job = { generation, origin: 'http://wcb-'+generation+'.preview.invalid', revision: 'synthetic', expiresAt: Date.now()+60000, route: '/', network: { external: 'deny' as const }, snapshot: snapshotPreview({ html: '<h1>synthetic</h1>', files: new Map() }) }
 let failure: unknown
 try { await local.open(job,new AbortController().signal) } catch (error) { failure = error }
 expect(failure).toBeInstanceOf(RunnerCleanupError)
 d.runner.open.mockRejectedValueOnce(failure)
 const request = { revision: d.registry.revision(d.id), route: '/' }
 await expect(d.transport.start(d.id,d.authority,request)).rejects.toThrow('startup cleanup failed')
 await expect(d.transport.start(d.id,d.authority,request)).rejects.toThrow('quarantined')
})
