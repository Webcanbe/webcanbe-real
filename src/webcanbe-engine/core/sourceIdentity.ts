import type { SourceIdentity } from "./types"

export function encodeSourceIdentity(identity: SourceIdentity) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(identity))))
}

export function decodeSourceIdentity(value: string): SourceIdentity | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(escape(atob(value))))
    return typeof parsed.file === "string" && Number.isInteger(parsed.elementStart) && parsed.elementStart >= 0 ? parsed : null
  } catch {
    return null
  }
}

export function sourceIdentityKey(identity: SourceIdentity) {
  return `${identity.file}:${identity.elementStart}`
}
