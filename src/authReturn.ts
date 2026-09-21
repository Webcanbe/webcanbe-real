/** Keep provider return intent on the current application origin. */
export function safeAuthReturn(raw: unknown, origin: string): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || /[\u0000-\u001f]/.test(raw)) return "/dashboard"
  const target = new URL(raw, origin)
  return target.origin === origin ? target.pathname + target.search + target.hash : "/dashboard"
}
