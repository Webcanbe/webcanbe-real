export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "script-src 'self'",
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "style-src-attr 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseapp.com",
  "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com",
  "worker-src 'self' blob:",
  "media-src 'self' blob: https:",
  "manifest-src 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ")

export const SECURITY_HEADERS = Object.freeze({
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "Content-Security-Policy": CONTENT_SECURITY_POLICY,
})

const PRIVATE_EXACT = new Set([
  "/dashboard",
  "/dashboard-preview",
  "/projects",
  "/purchases",
  "/settings",
  "/control",
  "/login",
  "/signup",
  "/auth/complete",
])

const PRIVATE_PREFIXES = ["/workspace/", "/checkout/", "/seller/"]

export function shouldNoIndexPath(path) {
  if (typeof path !== "string" || !path.startsWith("/")) return true
  if (PRIVATE_EXACT.has(path)) return true
  if (path === "/seller") return true
  return PRIVATE_PREFIXES.some(prefix => path.startsWith(prefix))
}

export function applySecurityHeaders(response, options = {}) {
  const headers = new Headers(response.headers)
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value)
  if (options.noIndex === true) headers.set("X-Robots-Tag", "noindex, nofollow")
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
