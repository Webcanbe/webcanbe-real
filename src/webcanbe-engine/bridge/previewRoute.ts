/** Routes are observations, never upstream URLs or source identities. */
export function safePreviewRoute(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048 || !/^\/(?!\/)[\x21-\x7e]*$/.test(value) || /[\\<>"\x60]/.test(value)) return false
  try {
    const url = new URL(value, "http://preview.invalid")
    return url.origin === "http://preview.invalid" && url.pathname.startsWith("/") && !/%(?:00|0[ad]|5c)/i.test(value)
  } catch { return false }
}
