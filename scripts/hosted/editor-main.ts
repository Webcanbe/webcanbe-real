import fs from "node:fs"
import path from "node:path"
import { HostedEditor } from "../../src/webcanbe-engine/runtime/hostedEditor"
import { hostedEditorServer } from "../../src/webcanbe-engine/runtime/hostedEditorServer"
import { OidcIdentityProvider } from "../../src/webcanbe-engine/runtime/hostedIdentity"
import { hostedPostgresPool } from "../../src/webcanbe-engine/runtime/postgresFencing"

// Trusted operator configuration only. No request can select these credentials,
// host inventory, source root, identity endpoints or local-test policy.
const config = JSON.parse(fs.readFileSync(process.argv[2],"utf8"))
if (config.localTest && config.listenAddress !== "127.0.0.1") throw new Error("Local TEST mode must bind loopback.")
const pool = hostedPostgresPool(config.postgres, config.localTest === true)
const hosts = config.hosts.map((host: { id: string; origin: string; ca: string; cert: string; key: string }) => ({...host,ca:fs.readFileSync(host.ca,"utf8"),cert:fs.readFileSync(host.cert,"utf8"),key:fs.readFileSync(host.key,"utf8")}))
const editor = new HostedEditor(fs.realpathSync(config.applicationRoot), { pool, origins:config.origins,hosts,identityProvider:new OidcIdentityProvider(config.oidc),fastRefresh:config.fastRefresh === true })
const server = hostedEditorServer(editor,{key:fs.readFileSync(config.key),cert:fs.readFileSync(config.cert)},path.join(config.applicationRoot,"dist"))
server.listen(config.port,config.listenAddress,()=>console.log("Hosted editor TLS listener started. Readiness requires the retained Phase 2 evidence gates."))
let closing=false
async function close() {
  if(closing)return;closing=true
  const stopped=new Promise<void>(resolve=>server.close(()=>resolve()));server.closeAllConnections()
  try { await editor.close() }
  catch { process.exitCode=1;console.error("Hosted cleanup unverified; durable quarantine retained.") }
  finally { await pool.end();await stopped }
}
process.on("SIGTERM",()=>void close());process.on("SIGINT",()=>void close())
