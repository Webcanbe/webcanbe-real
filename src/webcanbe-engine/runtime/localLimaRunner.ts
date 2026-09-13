import { spawn } from "node:child_process"
import { join } from "node:path"
import { RunnerCleanupError } from "./controlledPreview"
import type { ControlledExecution, ControlledJob, RunnerProvider, PreviewInput, RunnerSample } from "./controlledPreview"

/** Local operator-only provider. Fixed guest executable, private stdio, no shell interpolation.
 * Linux systemd/bubblewrap enforce isolation; Playwright routes are artifact delivery only. */
export class LocalLimaRunnerProvider implements RunnerProvider {
  constructor(private readonly root: string) {}
  async open(job: ControlledJob, signal: AbortSignal): Promise<ControlledExecution> {
    if (signal.aborted || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(job.generation)) throw new Error("Runner startup rejected.")
    const executable = join(this.root, ".webcanbe/runner/tools/bin/limactl")
    const env = { PATH: process.env.PATH, HOME: process.env.HOME, LIMA_HOME: join(this.root, ".webcanbe/runner/lima") }
    const prefix = ["shell", "--workdir=/", "wcb", "sudo", "-n"]
    const child = spawn(executable, [...prefix, "/opt/wcb-runtime/launch.sh", job.generation], { env, stdio: ["pipe", "pipe", "pipe"] })
    let closed = false, closePromise: Promise<void> | undefined, buffer = "", stderr = "", nextId = 0
    const pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>()
    const rejectAll = (error: Error) => { for (const item of pending.values()) { clearTimeout(item.timer); item.reject(error) } pending.clear() }
    const rpc = (command: string, value?: unknown): Promise<any> => new Promise((resolve, reject) => {
      if (closed || pending.size) return reject(new Error("Runner is closed or busy."))
      const id = ++nextId
      const timer = setTimeout(() => { pending.delete(id); reject(new Error("Runner command timed out.")); void close().catch(() => {}) }, 12000)
      pending.set(id, { resolve, reject, timer })
      child.stdin.write(JSON.stringify({ id, command, value }) + "\n", error => { if (error) rejectAll(new Error("Runner pipe failed.")) })
    })
    child.stdout.setEncoding("utf8")
    child.stdout.on("data", (chunk: string) => {
      buffer += chunk
      if (Buffer.byteLength(buffer) > 16 * 1024 * 1024) { rejectAll(new Error("Runner output limit exceeded.")); void close().catch(() => {}); return }
      let newline: number
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1)
        try {
          const reply = JSON.parse(line), item = pending.get(reply.id)
          if (!item) throw new Error("Unexpected runner response.")
          pending.delete(reply.id); clearTimeout(item.timer)
          if (reply.error) item.reject(new Error(String(reply.error).slice(0, 1000))); else item.resolve(reply.result)
        } catch { rejectAll(new Error("Invalid runner response.")); void close().catch(() => {}) }
      }
    })
    child.stderr.on("data", chunk => { stderr = (stderr + String(chunk)).slice(-4096) })
    child.on("error", () => rejectAll(new Error("Local runner is not prepared. Run npm run runner:prepare.")))
    child.on("exit", () => rejectAll(new Error("Runner exited: " + stderr.slice(-1000))))
    child.stdin.on("error", () => rejectAll(new Error("Runner pipe closed.")))
    const close = () => closePromise ??= (async () => {
      closed = true; signal.removeEventListener("abort", abort); rejectAll(new Error("Runner was revoked.")); child.stdin.end()
      // The guest watchdog also kills the entire cgroup after 65s if the host disappears.
      // Explicit stop/reap is required before this slot may be reused.
      await new Promise<void>((resolve, reject) => {
        const stop = spawn(executable, [...prefix, "/opt/wcb-runtime/stop.sh", job.generation], { env, stdio: "ignore" })
        const timer = setTimeout(() => { stop.kill("SIGKILL"); reject(new Error("Runner cleanup could not be verified.")) }, 8000)
        stop.on("error", () => { clearTimeout(timer); reject(new Error("Runner cleanup unavailable.")) })
        stop.on("exit", code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error("Runner cleanup failed.")) })
      }).finally(() => child.kill("SIGKILL"))
    })()
    const abort = () => { void close().catch(() => {}) }
    signal.addEventListener("abort", abort, { once: true })
    if (signal.aborted) abort()
    try {
      await rpc("open", job)
      if (signal.aborted) throw new Error("Runner startup revoked.")
      const sample = async (): Promise<RunnerSample> => {
        const result = await rpc("sample")
        if (typeof result?.png !== "string" || result.png.length > 12 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(result.png)) throw new Error("Invalid runner raster.")
        return { bytes: Buffer.from(result.png, "base64"), observation: result.observation }
      }
      return { sample, capture: async () => (await sample()).bytes, input: async (input: PreviewInput) => { await rpc("input", input) }, close }
    } catch (error) { try { await close() } catch { throw new RunnerCleanupError("Runner startup cleanup failed; restart only after verifying VM cleanup.") } throw error }
  }
}
