import { createRemoteJWKSet, jwtVerify } from "jose"
import { verifyFirebaseIdToken } from "./firebase-auth.js"
import { browseCatalog, catalogDetail } from "./product-catalog.js"
import { withHyperdrive } from "./hyperdrive.js"
import { databaseReadiness } from "./readiness.js"
import { issueDatabaseSession, resolveDatabaseSession, rotateDatabaseCsrf, verifyDatabaseCsrf, revokeDatabaseSession, revokeAllDatabaseSessions, databaseWorkspaces } from "./postgres-session.js"
import { databasePurchases, databaseWorkspaceProjects } from "./product-private.js"
import { MaterializationError, materializeDatabaseWorkspaceProject } from "./materialization.js"
import { databaseAccount, updateDatabaseAccount } from "./account-profile.js"
import { IdentityLinkConflict, linkDatabaseIdentity } from "./identity-link.js"
import { databaseControlRead } from "./control-read.js"
import { beginBigpersonRegistration, finishBigpersonRegistration, beginBigpersonOperation, consumeBigpersonOperation } from "./bigperson-auth.js"
import { transitionOperator, transitionSellerApplication } from "./control-mutations.js"
import { SECURITY_HEADERS, applySecurityHeaders, isKnownAppPath, shouldNoIndexPath } from "./security-headers.js"
import { requestId, safeFailureLog, withRequestId } from "./telemetry.js"
import { anonymousRateKey, rateLimitAllowed } from "./rate-limit.js"

const APP_ORIGIN = "https://webcanbe.com"
const CALLBACK_URI = APP_ORIGIN + "/__webcanbe/auth/callback"
const GOOGLE_ISSUER = "https://accounts.google.com"
const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth"
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token"
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"))
const FIREBASE_PROJECT_ID = "webcanbe-b607e"
const LOGIN_COOKIE = "__Host-wcb-login"
const SESSION_COOKIE = "__Host-wcb-session"
const encoder = new TextEncoder()
const decoder = new TextDecoder()

const commonHeaders = {
  ...SECURITY_HEADERS,
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
}

function json(value, status = 200, extra = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...commonHeaders, "Content-Type": "application/json; charset=utf-8", ...extra },
  })
}

function rateLimitedResponse() {
  return json({ error: "Too many requests. Try again shortly." }, 429, { "Retry-After": "60" })
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

function bearerToken(request) {
  const header = request.headers.get("Authorization") || ""
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(header)
  return match?.[1]
}

async function createSessionCookie(env, identity) {
  if (!env.GOOGLE_OAUTH_CLIENT_SECRET) throw new Error("Session signing is not configured.")
  const now = Date.now()
  return signPayload({
    sub: identity.provider + ":" + identity.subject,
    identityProvider: identity.provider,
    providerSubject: identity.subject,
    email: typeof identity.email === "string" ? identity.email.slice(0, 320) : "",
    emailVerified: identity.emailVerified === true,
    name: typeof identity.name === "string" ? identity.name.slice(0, 200) : "",
    picture: typeof identity.picture === "string" ? identity.picture.slice(0, 1000) : "",
    signInProvider: typeof identity.signInProvider === "string" ? identity.signInProvider.slice(0, 100) : identity.provider,
    csrf: randomToken(),
    iat: now,
    exp: now + 7 * 24 * 60 * 60 * 1000,
  }, env.GOOGLE_OAUTH_CLIENT_SECRET, "session")
}

const databaseAvailable = env => Boolean(env.HYPERDRIVE?.connectionString)

async function establishFirstPartySession(env, identity) {
  if (databaseAvailable(env)) {
    return withHyperdrive(env, db => issueDatabaseSession(db, {
      issuer: identity.issuer,
      subject: identity.subject,
      email: identity.email,
      emailVerified: identity.emailVerified === true,
      name: identity.name,
      picture: identity.picture,
    }, { allowSelfRegistration: true }))
  }
  const token = await createSessionCookie(env, {
    provider: identity.provider,
    subject: identity.subject,
    email: identity.email,
    emailVerified: identity.emailVerified,
    name: identity.name,
    picture: identity.picture,
    signInProvider: identity.signInProvider,
  })
  return { cookie: SESSION_COOKIE + "=" + token + "; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=604800" }
}

async function readDatabaseSession(request, env) {
  if (!databaseAvailable(env)) return undefined
  const token = cookie(request, SESSION_COOKIE)
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return undefined
  return withHyperdrive(env, db => resolveDatabaseSession(db, token))
}

async function smallJsonBody(request, maximum = 32 * 1024) {
  const declared = Number(request.headers.get("Content-Length") || "0")
  if (Number.isFinite(declared) && declared > maximum) throw new Error("Request too large.")
  const text = await request.text()
  if (text.length > maximum) throw new Error("Request too large.")
  const value = JSON.parse(text || "{}")
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid request.")
  return value
}

async function publicCatalog(request, env, path, traceId) {
  if (!requireSameOriginPost(request)) return json({ error: "Catalog request refused." }, 403)
  if (!env.HYPERDRIVE?.connectionString) return json({ error: "Product database is not configured." }, 503)

  let body
  try {
    body = await smallJsonBody(request)
  } catch {
    return json({ error: "Invalid catalog request." }, 400)
  }

  try {
    return await withHyperdrive(env, async db => {
      if (path === "/__webcanbe/api/product/catalog/browse") {
        const listings = await browseCatalog(db, body)
        return json({ listings })
      }
      if (path === "/__webcanbe/api/product/catalog/detail") {
        if (Object.keys(body).some(key => key !== "reference") || typeof body.reference !== "string") return json({ error: "Invalid catalog request." }, 422)
        const listing = await catalogDetail(db, body.reference)
        return listing ? json({ listing }) : json({ error: "Listing not found." }, 404)
      }
      return json({ error: "Catalog request refused." }, 404)
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ""
    if (message.startsWith("Invalid ") || message.includes("too long")) return json({ error: message }, 422)
    safeFailureLog({ event: "public_catalog_database", requestId: traceId, path, status: 503 })
    return json({ error: "Product catalog is temporarily unavailable." }, 503)
  }
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

  const session = await establishFirstPartySession(env, {
    issuer: GOOGLE_ISSUER,
    provider: "google",
    subject: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified === true,
    name: payload.name,
    picture: payload.picture,
    signInProvider: "google.com",
  })

  const headers = new Headers({ ...commonHeaders, Location: "/auth/complete" })
  appendCookie(headers, session.cookie)
  appendCookie(headers, clearCookie(LOGIN_COOKIE, "Lax"))
  return new Response(null, { status: 303, headers })
}

async function firebaseExchange(request, env) {
  if (!requireSameOriginPost(request)) return json({ error: "Firebase session exchange refused." }, 403)
  if (!env.GOOGLE_OAUTH_CLIENT_SECRET) return json({ error: "Firebase session exchange is not configured." }, 503)

  const idToken = bearerToken(request)
  if (!idToken) return json({ error: "Firebase ID token is required." }, 401)

  let payload
  try {
    payload = await verifyFirebaseIdToken(idToken, FIREBASE_PROJECT_ID)
  } catch {
    return json({ error: "Firebase identity verification failed." }, 403)
  }

  const firebaseClaim = payload.firebase
  const signInProvider = firebaseClaim && typeof firebaseClaim === "object" && typeof firebaseClaim.sign_in_provider === "string"
    ? firebaseClaim.sign_in_provider
    : "firebase"

  const session = await establishFirstPartySession(env, {
    issuer: "https://securetoken.google.com/" + FIREBASE_PROJECT_ID,
    provider: "firebase",
    subject: payload.sub,
    email: typeof payload.email === "string" ? payload.email : "",
    emailVerified: payload.email_verified === true,
    name: typeof payload.name === "string" ? payload.name : "",
    picture: typeof payload.picture === "string" ? payload.picture : "",
    signInProvider,
  })

  const headers = new Headers({ ...commonHeaders, "Content-Type": "application/json; charset=utf-8" })
  appendCookie(headers, session.cookie)
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers })
}

async function readSession(request, env) {
  if (!env.GOOGLE_OAUTH_CLIENT_SECRET) return undefined
  const value = await verifyPayload(cookie(request, SESSION_COOKIE), env.GOOGLE_OAUTH_CLIENT_SECRET, "session")
  if (!value || typeof value.exp !== "number" || value.exp <= Date.now() || typeof value.csrf !== "string" || typeof value.sub !== "string") return undefined
  return value
}

async function session(request, env) {
  if (!requireSameOriginPost(request)) return json({ error: "Session request refused." }, 403)

  const databaseSession = await readDatabaseSession(request, env)
  if (databaseSession) {
    const csrf = await withHyperdrive(env, db => rotateDatabaseCsrf(db, databaseSession))
    return json({
      csrf,
      expiresAt: databaseSession.expiresAt,
      user: {
        email: databaseSession.email || "",
        name: databaseSession.displayName || "Webcanbe user",
        picture: databaseSession.picture || "",
        emailVerified: databaseSession.emailVerified === true,
        provider: "database",
        signInProvider: "database",
      },
    })
  }

  const value = await readSession(request, env)
  if (!value) return json({ error: "Sign in to continue." }, 403)
  return json({
    csrf: value.csrf,
    expiresAt: value.exp,
    user: {
      email: value.email || "",
      name: value.name || "",
      picture: value.picture || "",
      provider: value.identityProvider || "legacy",
      signInProvider: value.signInProvider || value.identityProvider || "legacy",
    },
  })
}

async function logout(request, env) {
  if (!requireSameOriginPost(request)) return json({ error: "Sign-out request refused." }, 403)

  const databaseSession = await readDatabaseSession(request, env)
  if (databaseSession) {
    const allowed = await withHyperdrive(env, db => verifyDatabaseCsrf(db, databaseSession, request.headers.get("X-WCB-CSRF")))
    if (!allowed) return json({ error: "Sign-out request refused." }, 403)
    await withHyperdrive(env, db => revokeDatabaseSession(db, databaseSession.sessionId))
    const headers = new Headers(commonHeaders)
    appendCookie(headers, clearCookie(SESSION_COOKIE, "Strict"))
    return new Response(null, { status: 204, headers })
  }

  const value = await readSession(request, env)
  if (!value || request.headers.get("X-WCB-CSRF") !== value.csrf) return json({ error: "Sign-out request refused." }, 403)
  const headers = new Headers(commonHeaders)
  appendCookie(headers, clearCookie(SESSION_COOKIE, "Strict"))
  return new Response(null, { status: 204, headers })
}

async function privateProduct(request, env, path, traceId) {
  if (!requireSameOriginPost(request)) return json({ error: "Product request refused." }, 403)
  if (!databaseAvailable(env)) return json({ error: "Product database is not configured." }, 503)

  try {
    return await withHyperdrive(env, async db => {
      const token = cookie(request, SESSION_COOKIE)
      const databaseSession = token ? await resolveDatabaseSession(db, token) : undefined
      if (!databaseSession) return json({ error: "Sign in to continue." }, 403)
      const csrf = request.headers.get("X-WCB-CSRF")
      if (!await verifyDatabaseCsrf(db, databaseSession, csrf)) return json({ error: "Product request refused." }, 403)
      if (!await rateLimitAllowed(env.PRIVATE_API_RATE_LIMITER, "user:" + databaseSession.userId)) return rateLimitedResponse()

      if (path === "/__webcanbe/api/workspaces") {
        return json({ workspaces: await databaseWorkspaces(db, databaseSession) })
      }
      if (path === "/__webcanbe/api/product/purchases") {
        return json({ entitlements: await databasePurchases(db, databaseSession) })
      }
      if (path === "/__webcanbe/api/product/workspace-projects/list") {
        return json({ workspaceProjects: await databaseWorkspaceProjects(db, databaseSession) })
      }
      if (path === "/__webcanbe/api/product/workspace-projects/materialize") {
        if (env.WEBCANBE_PRODUCT_MUTATIONS !== "enabled") return json({ error: "Product mutations are not enabled." }, 503)
        let body
        try { body = await smallJsonBody(request) }
        catch { return json({ error: "Invalid materialization request." }, 400) }
        try {
          const workspaceProject = await materializeDatabaseWorkspaceProject(db, databaseSession, body)
          return json({ workspaceProject }, 201)
        } catch (error) {
          if (error instanceof MaterializationError) return json({ error: error.message }, error.status)
          return json({ error: "Working-copy creation is temporarily unavailable." }, 503)
        }
      }
      if (path.startsWith("/__webcanbe/api/ops/")) {
        if (!await rateLimitAllowed(env.BIGPERSON_RATE_LIMITER, "bigperson:" + databaseSession.userId)) return rateLimitedResponse()
        if (env.WEBCANBE_CONTROL_MODE !== "enabled") return json({ error: "Privileged operations are not enabled." }, 404)
        let body
        try { body = await smallJsonBody(request) }
        catch { return json({ error: "Invalid privileged request." }, 400) }
        try {
          if (path === "/__webcanbe/api/ops/bigperson/register/options") {
            return json(await beginBigpersonRegistration(db, databaseSession, body, env, request))
          }
          if (path === "/__webcanbe/api/ops/bigperson/register/verify") {
            return json(await finishBigpersonRegistration(db, databaseSession, body, env, request), 201)
          }
          if (path === "/__webcanbe/api/ops/bigperson/operation/options") {
            return json(await beginBigpersonOperation(db, databaseSession, body, env, request))
          }
          if (path === "/__webcanbe/api/ops/control/read") {
            await db.query("BEGIN")
            try {
              await consumeBigpersonOperation(db, databaseSession, body, env, request, { method: "POST", path, body: {} })
              const control = await databaseControlRead(db, databaseSession)
              if (!control) throw new Error("Privileged operation refused.")
              await db.query("COMMIT")
              return json({ control })
            } catch (error) {
              await db.query("ROLLBACK")
              throw error
            }
          }
          if (path === "/__webcanbe/api/ops/operators/transition" || path === "/__webcanbe/api/ops/seller-applications/transition") {
            const operationBody = body?.operationBody ?? {}
            await db.query("BEGIN")
            try {
              const proof = await consumeBigpersonOperation(db, databaseSession, body, env, request, { method: "POST", path, body: operationBody })
              const result = path.endsWith("/operators/transition")
                ? await transitionOperator(db, databaseSession, operationBody, proof.evidenceId)
                : await transitionSellerApplication(db, databaseSession, operationBody, proof.evidenceId)
              await db.query("COMMIT")
              return json(path.endsWith("/operators/transition") ? { operator: result } : { application: result })
            } catch (error) {
              await db.query("ROLLBACK")
              throw error
            }
          }
          return json({ error: "Privileged operation is unavailable." }, 404)
        } catch (error) {
          return json({ error: error instanceof Error ? error.message : "Privileged operation refused." }, 403)
        }
      }
      if (path === "/__webcanbe/api/account/identities/link/firebase") {
        const idToken = bearerToken(request)
        if (!idToken) return json({ error: "Verified Firebase identity proof is required." }, 401)
        let payload
        try { payload = await verifyFirebaseIdToken(idToken, FIREBASE_PROJECT_ID) }
        catch { return json({ error: "Firebase identity verification failed." }, 403) }
        try {
          const result = await linkDatabaseIdentity(db, databaseSession, {
            issuer: "https://securetoken.google.com/" + FIREBASE_PROJECT_ID,
            subject: payload.sub,
          })
          return json({
            linked: true,
            provider: "Firebase Authentication",
            alreadyLinked: result.alreadyLinked,
          })
        } catch (error) {
          if (error instanceof IdentityLinkConflict) return json({ error: "This sign-in identity already belongs to another Webcanbe account." }, 409)
          return json({ error: "Identity linking was refused." }, 403)
        }
      }
      if (path === "/__webcanbe/api/account/get") {
        return json({ account: await databaseAccount(db, databaseSession) })
      }
      if (path === "/__webcanbe/api/account/update") {
        let body
        try { body = await smallJsonBody(request) }
        catch { return json({ error: "Invalid account update." }, 400) }
        try { return json({ account: await updateDatabaseAccount(db, databaseSession, body) }) }
        catch (error) {
          const message = error instanceof Error ? error.message : "Invalid account update."
          return json({ error: message }, 422)
        }
      }
      if (path === "/__webcanbe/api/account/sessions/revoke-all") {
        const revokedSessions = await revokeAllDatabaseSessions(db, databaseSession)
        const headers = new Headers({ ...commonHeaders, "Content-Type": "application/json; charset=utf-8" })
        appendCookie(headers, clearCookie(SESSION_COOKIE, "Strict"))
        return new Response(JSON.stringify({ ok: true, revokedSessions }), { status: 200, headers })
      }
      return json({ error: "Product request refused." }, 404)
    })
  } catch {
    safeFailureLog({ event: "private_product_database", requestId: traceId, path, status: 503 })
    return json({ error: "Product data is temporarily unavailable." }, 503)
  }
}

async function readiness(request, env, traceId) {
  if (!requireSameOriginPost(request)) return json({ error: "Readiness request refused." }, 403)
  if (!databaseAvailable(env)) return json({ worker: "ok", database: "unconfigured", schema: "unknown" }, 503)

  try {
    const result = await withHyperdrive(env, db => databaseReadiness(db))
    if (!result.ok) return json({
      worker: "ok",
      database: "reachable",
      schema: "incomplete",
      requiredCount: result.requiredCount,
      readyCount: result.readyCount,
    }, 503)
    return json({
      worker: "ok",
      database: "ready",
      schema: "ready",
      requiredCount: result.requiredCount,
      readyCount: result.readyCount,
    })
  } catch {
    safeFailureLog({ event: "production_readiness_database", requestId: traceId, path: "/__webcanbe/ops/readiness", status: 503 })
    return json({ worker: "ok", database: "unavailable", schema: "unknown" }, 503)
  }
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname
    const traceId = requestId()
    try {
      let response
      if (path === "/__webcanbe/auth/start" || path === "/__webcanbe/auth/callback" || path === "/__webcanbe/auth/firebase-exchange") {
        const key = await anonymousRateKey(request, "auth:" + path)
        if (!await rateLimitAllowed(env.AUTH_RATE_LIMITER, key)) response = rateLimitedResponse()
        else if (path === "/__webcanbe/auth/start") response = await start(request, env)
        else if (path === "/__webcanbe/auth/callback") response = await callback(request, env)
        else response = await firebaseExchange(request, env)
      }
      else if (path === "/__webcanbe/auth/session") response = await session(request, env)
      else if (path === "/__webcanbe/auth/logout") response = await logout(request, env)
      else if (path === "/__webcanbe/ops/readiness") {
        const key = await anonymousRateKey(request, "ops:readiness")
        response = !await rateLimitAllowed(env.PUBLIC_API_RATE_LIMITER, key) ? rateLimitedResponse() : await readiness(request, env, traceId)
      }
      else if (path === "/__webcanbe/api/product/catalog/browse" || path === "/__webcanbe/api/product/catalog/detail") {
        const key = await anonymousRateKey(request, "public:" + path)
        response = !await rateLimitAllowed(env.PUBLIC_API_RATE_LIMITER, key) ? rateLimitedResponse() : await publicCatalog(request, env, path, traceId)
      }
      else if (path === "/__webcanbe/api/workspaces" || path === "/__webcanbe/api/product/purchases" || path === "/__webcanbe/api/product/workspace-projects/list" || path === "/__webcanbe/api/product/workspace-projects/materialize" || path === "/__webcanbe/api/account/get" || path === "/__webcanbe/api/account/update" || path === "/__webcanbe/api/account/sessions/revoke-all" || path === "/__webcanbe/api/account/identities/link/firebase" || path.startsWith("/__webcanbe/api/ops/")) response = await privateProduct(request, env, path, traceId)
      else {
        const asset = await env.ASSETS.fetch(request)
        const acceptsHtml = request.method === "GET" && (request.headers.get("Accept") || "").includes("text/html")
        const unknownAppPath = acceptsHtml && !isKnownAppPath(path)
        const secured = applySecurityHeaders(asset, { noIndex: shouldNoIndexPath(path) || unknownAppPath })
        response = unknownAppPath && secured.status === 200
          ? new Response(secured.body, { status: 404, headers: secured.headers })
          : secured
      }
      return withRequestId(response, traceId)
    } catch {
      safeFailureLog({ event: "worker_unhandled", requestId: traceId, path, status: 500 })
      return withRequestId(json({ error: "The request could not be completed." }, 500), traceId)
    }
  },
}
