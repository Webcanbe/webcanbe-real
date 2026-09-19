const encoder = new TextEncoder()

function base64url(bytes) {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

export async function anonymousRateKey(request, scope) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown"
  const userAgent = (request.headers.get("User-Agent") || "unknown").slice(0, 512)
  const material = encoder.encode(scope + "\n" + ip + "\n" + userAgent)
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", material))
  return scope + ":" + base64url(digest).slice(0, 32)
}

export async function rateLimitAllowed(binding, key) {
  if (!binding || typeof binding.limit !== "function") return true
  try {
    const result = await binding.limit({ key })
    return result?.success !== false
  } catch {
    // Abuse throttling must not become an availability dependency.
    return true
  }
}
