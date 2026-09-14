export function requireOpaqueId(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value)) throw new AuthorityDenied()
}
export class AuthorityDenied extends Error { constructor() { super("Project or session is unavailable.") } }
