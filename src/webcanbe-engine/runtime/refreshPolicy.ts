import type { PreviewSnapshot } from "./controlledPreview"
export type RefreshModule = { code: string; imports: Record<string, string>; boundary: boolean }
export type RefreshManifest = { version: 1; entry: string; modules: Record<string, RefreshModule> }
export function refreshManifest(snapshot: PreviewSnapshot): RefreshManifest | undefined {
  const file = snapshot.files.find(file => file.path === "/_wcb/refresh.json")
  if (!file || file.base64.length > 32 * 1024 * 1024) return undefined
  try { const data = JSON.parse(Buffer.from(file.base64, "base64").toString("utf8")); return data.version === 1 && typeof data.entry === "string" && data.modules && typeof data.modules === "object" ? data : undefined } catch { return undefined }
}
/** Used by both controller classification and the isolated worker. Only existing
 * component boundaries with an unchanged graph can refresh; all else reloads. */
export function refreshChanges(before: PreviewSnapshot, after: PreviewSnapshot): string[] | undefined {
  const a = refreshManifest(before), b = refreshManifest(after)
  if (!a || !b || a.entry !== b.entry || before.html !== after.html || before.files.length !== after.files.length) return undefined
  if (after.files.some(file => !["/_wcb/app.js", "/_wcb/refresh.json"].includes(file.path) && !before.files.some(old => old.path === file.path && old.base64 === file.base64 && old.contentType === file.contentType))) return undefined
  const keys = Object.keys(a.modules).sort()
  if (JSON.stringify(keys) !== JSON.stringify(Object.keys(b.modules).sort())) return undefined
  const changed: string[] = []
  for (const id of keys) {
    const old = a.modules[id], next = b.modules[id]
    if (JSON.stringify(old.imports) !== JSON.stringify(next.imports)) return undefined
    if (old.code !== next.code) { if (id === a.entry || !old.boundary || !next.boundary) return undefined; changed.push(id) }
  }
  return changed.length ? changed : undefined
}
