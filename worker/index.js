import { createRemoteJWKSet, jwtVerify } from "jose"

const APP_ORIGIN = "https://webcanbe.com"
const CALLBACK_URI = APP_ORIGIN + "/__webcanbe/auth/callback"
const GOOGLE_ISSUER = "https://accounts.google.com"
const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth"
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token"
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"))
const LOGIN_COOKIE = "__Host-wcb-login"
const SESSION_COOKIE = "__Host-wcb-session"
const encoder = new TextEncoder()
const decoder = new TextDecoder()

const commonHeaders = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
}

function json(value, status = 200, extra = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...commonHeaders, "Content-Type": "application/json; charset=utf-8", ...extra },
  })
}

function base64url(bytes) {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function fromBase64url(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, char => char.charCodeAt(0))
}

function randomToken(bytes = 32) {
  const value = new Uint8Array(bytes)
  crypto.getRandomValues(value)
  return base64url(value)
}

async function purposeKey(secret, purpose) {
  const material = await crypto.subtle.digest("SHA-256", encoder.encode("webcanbe:" + purpose + ":" + secret))
  return crypto.subtle.importKey("raw", material, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"])
}

async function signPayload(payload, secret, purpose) {
  const encoded = base64url(encoder.encode(JSON.stringify(payload)))
  const key = await purposeKey(secret, purpose)
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(encoded)))
  return encoded + "." + base64url(signature)
}

async function verifyPayload(token, secret, purpose) {
  if (!token || token.length > 4096) return undefined
  const pieces = token.split(".")
  if (pieces.length !== 2) return undefined
  try {
    const key = await purposeKey(secret, purpose)
    const valid = await crypto.subtle.verify("HMAC", key, fromBase64url(pieces[1]), encoder.encode(pieces[0]))
    if (!valid) return undefined
    const payload = JSON.parse(decoder.decode(fromBase64url(pieces[0])))
    return payload && typeof payload === "object" ? payload : undefined
  } catch {
    return undefined
  }
}

function cookie(request, name) {
  const header = request.headers.get("Cookie") || ""
  const matches = header.split(";").map(part => part.trim()).filter(Boolean).map(part => {
    const index = part.indexOf("=")
    return index < 0 ? [part, ""] : [part.slice(0, index), part.slice(index + 1)]
  }).filter(([key]) => key === name)
  return matches.length === 1 ? matches[0][1] : undefined
}

function requireSameOriginPost(request) {
  const type = request.headers.get("Content-Type") || ""
  return request.method === "POST" && request.headers.get("Origin") === APP_ORIGIN && /^application\/json(?:;|$)/i.test(type)
}

function appendCookie(headers, value) {
  headers.append("Set-Cookie", value)
}

function clearCookie(name, sameSite) {
  return name + "=; Path=/; Secure; HttpOnly; SameSite=" + sameSite + "; Max-Age=0"
}

async function start(request, env) {
  if (!requireSameOriginPost(request)) return json({ error: "Sign-in request refused." }, 403)
  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) return json({ error: "Google sign-in is not configured." }, 503)

  const state = randomToken()
  const nonce = randomToken()
  const verifier = randomToken()
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(verifier))))
  const expires = Date.now() + 5 * 60 * 1000
  const login = await signPayload({ state, nonce, verifier, expires }, env.GOOGLE_OAUTH_CLIENT_SECRET, "oauth-login")

  const authorization = new URL(GOOGLE_AUTH)
  authorization.search = new URLSearchParams({
    client_id: env.GOOGLE_OAUTH_CLIENT_ID,
    redirect_uri: CALLBACK_URI,
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    response_mode: "query",
    prompt: "select_account",
  }).toString()

  const headers = new Headers({ ...commonHeaders, "Content-Type": "application/json; charset=utf-8" })
  appendCookie(headers, LOGIN_COOKIE + "=" + login + "; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=300")
  return new Response(JSON.stringify({ authorizationUrl: authorization.href }), { status: 200, headers })
}

async function callback(request, env) {
  if (request.method !== "GET" || !env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) return json({ error: "Identity callback refused." }, 403)
  const url = new URL(request.url)
  if (url.origin !== APP_ORIGIN) return json({ error: "Identity callback refused." }, 403)

  const state = url.searchParams.get("state")
  const code = url.searchParams.get("code")
  if (!state || !code || code.length > 4096) return json({ error: "Identity callback is incomplete." }, 400)

  const login = await verifyPayload(cookie(request, LOGIN_COOKIE), env.GOOGLE_OAUTH_CLIENT_SECRET, "oauth-login")
  if (!login || login.state !== state || typeof login.nonce !== "string" || typeof login.verifier !== "string" || typeof login.expires !== "number" || login.expires <= Date.now()) {
    return json({ error: "Identity callback could not be verified." }, 403)
  }

  const tokenResponse = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: CALLBACK_URI,
      client_id: env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
      code_verifier: login.verifier,
    }),
  })
  const tokenBody = await tokenResponse.json().catch(() => ({}))
  if (!tokenResponse.ok || typeof tokenBody.id_token !== "string") return json({ error: "Google sign-in could not be completed." }, 403)

  let payload
  try {
    const verified = await jwtVerify(tokenBody.id_token, GOOGLE_JWKS, {
      issuer: GOOGLE_ISSUER,
      audience: env.GOOGLE_OAUTH_CLIENT_ID,
      algorithms: ["RS256"],
      maxTokenAge: "10m",
      clockTolerance: 5,
    })
    payload = verified.payload
  } catch {
    return json({ error: "Google identity verification failed." }, 403)
  }

  if (payload.nonce !== login.nonce || typeof payload.sub !== "string" || !payload.sub || typeof payload.email !== "string" || payload.email_verified !== true || (payload.azp !== undefined && payload.azp !== env.GOOGLE_OAUTH_CLIENT_ID)) {
    return json({ error: "Google identity verification failed." }, 403)
  }

  const now = Date.now()
  const session = await signPayload({
    sub: payload.sub,
    email: payload.email,
    name: typeof payload.name === "string" ? payload.name.slice(0, 200) : "",
    picture: typeof payload.picture === "string" ? payload.picture.slice(0, 1000) : "",
    csrf: randomToken(),
    iat: now,
    exp: now + 7 * 24 * 60 * 60 * 1000,
  }, env.GOOGLE_OAUTH_CLIENT_SECRET, "session")

  const headers = new Headers({ ...commonHeaders, Location: "/auth/complete" })
  appendCookie(headers, SESSION_COOKIE + "=" + session + "; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=604800")
  appendCookie(headers, clearCookie(LOGIN_COOKIE, "Lax"))
  return new Response(null, { status: 303, headers })
}

async function readSession(request, env) {
  if (!env.GOOGLE_OAUTH_CLIENT_SECRET) return undefined
  const value = await verifyPayload(cookie(request, SESSION_COOKIE), env.GOOGLE_OAUTH_CLIENT_SECRET, "session")
  if (!value || typeof value.exp !== "number" || value.exp <= Date.now() || typeof value.csrf !== "string" || typeof value.sub !== "string") return undefined
  return value
}

async function session(request, env) {
  if (!requireSameOriginPost(request)) return json({ error: "Session request refused." }, 403)
  const value = await readSession(request, env)
  if (!value) return json({ error: "Sign in to continue." }, 403)
  return json({
    csrf: value.csrf,
    expiresAt: value.exp,
    user: { email: value.email || "", name: value.name || "", picture: value.picture || "" },
  })
}

async function logout(request, env) {
  if (!requireSameOriginPost(request)) return json({ error: "Sign-out request refused." }, 403)
  const value = await readSession(request, env)
  if (!value || request.headers.get("X-WCB-CSRF") !== value.csrf) return json({ error: "Sign-out request refused." }, 403)
  const headers = new Headers(commonHeaders)
  appendCookie(headers, clearCookie(SESSION_COOKIE, "Strict"))
  return new Response(null, { status: 204, headers })
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname
    if (path === "/__webcanbe/auth/start") return start(request, env)
    if (path === "/__webcanbe/auth/callback") return callback(request, env)
    if (path === "/__webcanbe/auth/session") return session(request, env)
    if (path === "/__webcanbe/auth/logout") return logout(request, env)
    return env.ASSETS.fetch(request)
  },
}
