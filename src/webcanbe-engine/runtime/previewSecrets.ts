import type { ProjectGrant, MembershipStore } from "./hostedAuthority"
import { AuthorityDenied } from "./hostedAuthority"
export type SecretEnvironment = "development" | "preview" | "production"
export interface ProjectSecretStore { read(projectId: string, environment: SecretEnvironment, name: string): string | undefined }
export type PreviewSecretGrant = Readonly<{ projectId: string; sessionId: string; names: readonly string[] }>
/** Grants are made by trusted server policy. Browser requests cannot request
 * names or redirect to another environment. Values are intentionally absent
 * from source/history/export storage. Browser-visible secrets are not private
 * from that project's code or pixels: only narrowly scoped preview values fit. */
export function resolvePreviewSecrets(store: ProjectSecretStore, memberships: MembershipStore, principal: ProjectGrant, grant: PreviewSecretGrant) {
  if (!memberships.check(principal, "preview") || grant.projectId !== principal.projectId || grant.sessionId !== principal.sessionId || grant.names.length > 16) throw new AuthorityDenied()
  const values: Record<string, string> = Object.create(null)
  for (const name of grant.names) {
    if (!/^WCB_PREVIEW_[A-Z0-9_]{1,64}$/.test(name)) throw new Error("Only explicitly scoped preview secret names are admitted.")
    const value = store.read(grant.projectId, "preview", name)
    if (value === undefined || value.length < 4 || value.length > 4096) throw new Error("Preview secret is unavailable or outside its limits.")
    values[name] = value
  }
  return Object.freeze(values)
}
export function redactSecrets(text: string, values: readonly string[]) {
  // Redact before truncating so a length bound cannot expose a secret prefix.
  for (const value of [...new Set(values)].filter(Boolean).sort((a, b) => b.length - a.length)) {
    for (const encoded of [value, encodeURIComponent(value), Buffer.from(value).toString("base64")]) text = text.split(encoded).join("[REDACTED]")
  }
  return text
}
