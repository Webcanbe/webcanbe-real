export const PREVIEW_RUNTIME_SECURITY_HEADERS = Object.freeze({
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), hid=(), bluetooth=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Content-Security-Policy": [
    "default-src 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'unsafe-inline'",
    "img-src data: blob:",
    "font-src data:",
    "connect-src 'none'",
    "media-src data: blob:",
    "form-action 'none'",
  ].join("; "),
})

export function applyPreviewRuntimeHeaders(response) {
  const headers = new Headers(response.headers)
  for (const [name, value] of Object.entries(PREVIEW_RUNTIME_SECURITY_HEADERS)) headers.set(name, value)
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
