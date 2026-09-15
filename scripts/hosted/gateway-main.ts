// Trusted control-plane entrypoint. Configuration file is private operator data.
import fs from "node:fs"
import { hostedPostgresPool, PostgresLeaseStore } from "../../src/webcanbe-engine/runtime/postgresFencing"
import { hostedRunnerGateway } from "../../src/webcanbe-engine/runtime/hostedRunnerGateway"
import { LinuxHostRunnerProvider } from "../../src/webcanbe-engine/runtime/linuxHostRunner"
const config = JSON.parse(fs.readFileSync(process.argv[2], "utf8"))
if (!config.hostId || !config.listenAddress || !Number.isInteger(config.port)) throw new Error("Explicit gateway configuration is required.")
const pool = hostedPostgresPool(config.postgres, config.localTest === true)
const server = hostedRunnerGateway({ key: fs.readFileSync(config.key), cert: fs.readFileSync(config.cert), ca: fs.readFileSync(config.ca) }, config.hostId, new PostgresLeaseStore(pool), new LinuxHostRunnerProvider(), config.localTest === true ? error => console.error("Hosted TEST runner operation failed:",error) : undefined)
server.listen(config.port, config.listenAddress, () => process.stdout.write("Hosted Linux gateway listening. Deployment evidence is required before admission.\n"))
const close = () => { server.closeAllConnections(); server.close(() => { void pool.end().finally(() => process.exit(0)) }) }
process.on("SIGTERM", close); process.on("SIGINT", close)
