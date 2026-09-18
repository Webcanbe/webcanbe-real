import { request } from "node:https"
import { lookup } from "node:dns"
import { createHash } from "node:crypto"
import { ZIP_LIMITS } from "./projectRegistry"
import type { SourceImportOrigin } from "../core/types"

export type ExternalSourceReference = { provider: "github"; repository: string; commit: string; expectedArchiveSha256?: string }
export interface ExternalSourceProvider { fetch(reference: ExternalSourceReference, signal: AbortSignal): Promise<{ archive: Buffer; origin: SourceImportOrigin }> }
export function sourceReference(value: unknown): ExternalSourceReference {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("An immutable source reference is required.")
  const v = value as Record<string, unknown>
  if (Object.keys(v).some(key => !["provider", "repository", "commit", "expectedArchiveSha256"].includes(key)) || v.provider !== "github" || typeof v.repository !== "string" || !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(v.repository) || typeof v.commit !== "string" || !/^[a-f0-9]{40}$/.test(v.commit) || v.expectedArchiveSha256 !== undefined && (typeof v.expectedArchiveSha256 !== "string" || !/^[a-f0-9]{64}$/.test(v.expectedArchiveSha256))) throw new Error("Only a public GitHub repository and complete immutable commit are admitted.")
  return { provider: "github", repository: v.repository, commit: v.commit, ...(v.expectedArchiveSha256 ? { expectedArchiveSha256: v.expectedArchiveSha256 as string } : {}) }
}
// The only remote source host is fixed here; requests cannot supply URLs,
// credentials, redirects, proxies, ports or DNS overrides. IPv4-only resolution
// rejects non-public ranges and pins that checked address to the TLS connection.
export function publicSourceAddress(address: string) {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(address)) return false
  const [a,b,c,d] = address.split(".").map(Number)
  return [a,b,c,d].every(n => n >= 0 && n <= 255) && a > 0 && a < 224 && ![10,127].includes(a) && !(a === 100 && b >= 64 && b <= 127) && !(a === 169 && b === 254) && !(a === 172 && b >= 16 && b <= 31) && !(a === 192 && (b === 168 || b === 0 || b === 88 && c === 99)) && !(a === 198 && (b === 18 || b === 19 || b === 51 && c === 100)) && !(a === 203 && b === 0 && c === 113)
}
export class GitHubSourceProvider implements ExternalSourceProvider {
  async fetch(value: ExternalSourceReference, signal: AbortSignal) {
    const reference = sourceReference(value), url = `https://codeload.github.com/${reference.repository}/zip/${reference.commit}`
    const archive = await new Promise<Buffer>((resolve, reject) => {
      let finished = false
      const finish = (error?: Error, bytes?: Buffer) => { if (finished) return; finished = true; clearTimeout(timer); signal.removeEventListener("abort", abort); error ? reject(error) : resolve(bytes!) }
      const req = request(url, { method: "GET", agent: false, maxHeaderSize: 16384, headers: { "User-Agent": "WebCanBe-immutable-source", Accept: "application/zip", "Accept-Encoding": "identity" }, lookup: (_host, _options, callback) => {
        lookup("codeload.github.com", { family: 4, all: true }, (error, addresses) => {
          if (error || !addresses.length || addresses.some(item => !publicSourceAddress(item.address))) return callback(new Error("Source host resolution rejected."), [])
          // Node's request may ask for all addresses. Return the checked list;
          // neither the hostname nor a redirect can trigger a second lookup.
          if (_options.all) callback(null, addresses); else callback(null, addresses[0].address, 4)
        })
      } }, res => {
        if (res.statusCode !== 200 || res.headers["content-encoding"] && res.headers["content-encoding"] !== "identity" || Number(res.headers["content-length"] ?? 0) > ZIP_LIMITS.archiveBytes) { res.destroy(); req.destroy(); finish(new Error("Source response rejected.")); return }
        const chunks: Buffer[] = []; let size = 0
        res.on("data", (chunk: Buffer) => { size += chunk.length; if (size > ZIP_LIMITS.archiveBytes) { res.destroy(); req.destroy(); finish(new Error("Source archive exceeds intake limit.")) } else chunks.push(chunk) })
        res.on("error", () => finish(new Error("Source transfer failed.")))
        res.on("end", () => finish(undefined, Buffer.concat(chunks)))
      })
      const abort = () => { req.destroy(); finish(new Error("Source transfer cancelled.")) }
      const timer = setTimeout(() => { req.destroy(); finish(new Error("Source transfer deadline exceeded.")) }, 10000)
      req.on("error", () => finish(new Error("Source transfer failed.")))
      signal.addEventListener("abort", abort, { once: true }); if (signal.aborted) abort(); else req.end()
    })
    const archiveSha256 = createHash("sha256").update(archive).digest("hex")
    if (signal.aborted || reference.expectedArchiveSha256 && reference.expectedArchiveSha256 !== archiveSha256) throw new Error("Source archive integrity check failed.")
    return { archive, origin: { provider: "github" as const, repository: reference.repository, commit: reference.commit, archiveSha256 } }
  }
}
