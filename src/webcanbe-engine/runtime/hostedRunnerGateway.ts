import { createServer, type ServerOptions } from "node:https"
import type { TLSSocket } from "node:tls"
import type { ControlledExecution, ControlledJob, RunnerProvider } from "./controlledPreview"
import { validPreviewInput } from "./previewInputs"
import { createHash } from "node:crypto"
import { PostgresLeaseStore, type Fence } from "./postgresFencing"

/** Trusted management service on a dedicated Linux host. Mutual TLS credentials
 * remain here, outside every project job. PostgreSQL fences every command/result.
 * No source mounts, arbitrary shell, URLs, HTTP proxy, evaluate or secret injection. */
export function hostedRunnerGateway(tls: ServerOptions, hostId: string, leases: PostgresLeaseStore, provider: RunnerProvider) {
  if (!tls.key || !tls.cert || !tls.ca || !provider.revoke) throw new Error("Gateway requires private PKI and explicit provider revocation.")
  const handles = new Map<string, { hash: string; opening: Promise<ControlledExecution> }>()
  const server = createServer({ ...tls, requestCert: true, rejectUnauthorized: true, minVersion: "TLSv1.2" }, async (request, response) => {
    const send = (status: number, value: unknown) => { const data = JSON.stringify(value); if (Buffer.byteLength(data) > 16 * 1024 * 1024) throw new Error("Gateway output bound exceeded."); response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }); response.end(data) }
    try {
      if (!(request.socket as TLSSocket).authorized || request.method !== "POST" || request.url !== "/rpc" || request.headers.origin || request.headers.cookie || request.headers["content-type"] !== "application/json") throw new Error("Management request denied.")
      let size = 0; const chunks: Buffer[] = []
      for await (const chunk of request) { size += chunk.length; if (size > 48 * 1024 * 1024) throw new Error("Input limit exceeded."); chunks.push(Buffer.from(chunk)) }
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8")), fence = body.fence as Fence
      if (!fence || fence.hostId !== hostId || Object.keys(body).some(key => !["command","fence","job","input","update"].includes(key))) throw new Error("Invalid hosted command.")
      if (body.command === "revoke") {
        await leases.guard(fence, async () => { await provider.revoke!(fence.generation); const handle = handles.get(fence.generation); if (handle) { await (await handle.opening.catch(() => undefined))?.close(); handles.delete(fence.generation) } }, true)
        return send(200, { cleaned: true })
      }
      const result = await leases.guard(fence, async () => {
        if (body.command === "open") {
          const job = body.job as ControlledJob
          if (!job || job.generation !== fence.generation) throw new Error("Admitted job mismatch.")
          const hash = createHash("sha256").update(JSON.stringify(job)).digest("hex"), existing = handles.get(fence.generation)
          if (existing && existing.hash !== hash) throw new Error("Duplicate job conflict.")
          if (!existing) {
            if (handles.size >= 4) throw new Error("Host capacity reached.")
            const opening = provider.open(job, new AbortController().signal)
            handles.set(fence.generation, { hash, opening })
          }
          await handles.get(fence.generation)!.opening
          return { ready: true }
        }
        const entry = handles.get(fence.generation)
        if (!entry) throw new Error("Worker handle unavailable; revoke and start a fresh generation.")
        const execution = await entry.opening
        if (body.command === "sample") {
          const sample = execution.sample ? await execution.sample() : { bytes: await execution.capture(), observation: undefined }
          return { png: Buffer.from(sample.bytes).toString("base64"), observation: sample.observation }
        }
        if (body.command === "input" && validPreviewInput(body.input)) { await execution.input(body.input); return { applied: true } }
        if (body.command === "update" && execution.update) { await execution.update(body.update); return { applied: true } }
        throw new Error("Unsupported command.")
      }, false, body.command === "open" ? body.job : undefined)
      send(200, result)
    } catch { if (!response.headersSent) { response.writeHead(409, { "Content-Type": "application/json", "Cache-Control": "no-store" }); response.end('{"error":"Hosted runner request rejected; authority or cleanup may require recovery."}') } else response.destroy() }
  })
  server.headersTimeout = 5000; server.requestTimeout = 15000; server.keepAliveTimeout = 1000; server.maxConnections = 16
  server.on("upgrade", (_req, socket) => socket.destroy())
  // Worker external watchdog remains the backstop if this trusted service dies.
  server.once("close", () => { for (const generation of handles.keys()) void provider.revoke!(generation).catch(() => {}) })
  return server
}
