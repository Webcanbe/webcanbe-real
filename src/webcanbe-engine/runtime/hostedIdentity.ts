import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { DatabaseSync } from "node:sqlite"
import { request as httpsRequest } from "node:https"
import type { IncomingMessage, ServerResponse } from "node:http"
import { createLocalJWKSet, jwtVerify, type JSONWebKeySet } from "jose"
import { AuthorityDenied, requireOpaqueId, type ServerSession } from "./hostedAuthority"

const digest = (value: string) => createHash("sha256").update(value).digest("hex")
const random = () => randomBytes(32).toString("base64url")
const equal = (a: unknown, b: string) => typeof a === "string" && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b))
export type LoginAttempt = { state: string; binding: string; nonce: string; verifier: string; expires: number }
export type VerifiedIdentity = Readonly<{ issuer: string; subject: string }>
export interface IdentityProvider { authorization(attempt: LoginAttempt): string; verify(code: string, attempt: LoginAttempt): Promise<VerifiedIdentity> }
type MaybeAsync<T> = T | Promise<T>
export interface LoginStore { create(): MaybeAsync<LoginAttempt>; consume(state: string, binding: string): MaybeAsync<LoginAttempt>; account(identity: VerifiedIdentity): MaybeAsync<string> }
export interface LoginSessionStore {
  issueVerifiedIdentity?(identity: VerifiedIdentity): MaybeAsync<{ cookie: string }>
  issueVerifiedSession(userId: string): MaybeAsync<{ cookie: string }>
  resolve(token: string): MaybeAsync<ServerSession | undefined>
  rotateCsrf(session: ServerSession): MaybeAsync<string>
  csrf(session: ServerSession, token: string): MaybeAsync<boolean>
  revokeSession(sessionId: string): MaybeAsync<void>
}

/** Durable local/test login state and operator-provisioned identity mapping.
 * No email linking, auto-enrollment, or client-selected account/workspace ID. */
export class SqliteLoginStore implements LoginStore {
  private db: DatabaseSync
  constructor(file: string, private now = Date.now) {
    this.db = new DatabaseSync(file)
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=1000;
      CREATE TABLE IF NOT EXISTS login_attempts(state_hash TEXT PRIMARY KEY,binding_hash TEXT NOT NULL,nonce TEXT NOT NULL,verifier TEXT NOT NULL,expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS identity_accounts(issuer TEXT NOT NULL,subject TEXT NOT NULL,user_id TEXT NOT NULL,active INTEGER NOT NULL,PRIMARY KEY(issuer,subject));`)
  }
  close() { this.db.close() }
  provision(identity: VerifiedIdentity, userId: string) {
    requireOpaqueId(userId)
    if (!identity.issuer || !identity.subject || identity.subject.length > 255) throw new AuthorityDenied()
    // Refuse silently moving an existing external identity to another account.
    const old = this.db.prepare("SELECT user_id FROM identity_accounts WHERE issuer=? AND subject=?").get(identity.issuer, identity.subject)
    if (old && old.user_id !== userId) throw new AuthorityDenied()
    this.db.prepare("INSERT INTO identity_accounts VALUES(?,?,?,1) ON CONFLICT(issuer,subject) DO UPDATE SET active=1").run(identity.issuer, identity.subject, userId)
  }
  disable(identity: VerifiedIdentity) { this.db.prepare("UPDATE identity_accounts SET active=0 WHERE issuer=? AND subject=?").run(identity.issuer, identity.subject) }
  account(identity: VerifiedIdentity) {
    const row = this.db.prepare("SELECT user_id FROM identity_accounts WHERE issuer=? AND subject=? AND active=1").get(identity.issuer, identity.subject)
    if (!row) throw new AuthorityDenied()
    return String(row.user_id)
  }
  create(): LoginAttempt {
    const attempt = { state: random(), binding: random(), nonce: random(), verifier: random(), expires: this.now() + 300_000 }
    this.db.exec("BEGIN IMMEDIATE")
    try {
      this.db.prepare("DELETE FROM login_attempts WHERE expires<=?").run(this.now())
      if (Number(this.db.prepare("SELECT count(*) AS n FROM login_attempts").get()!.n) >= 1000) throw new AuthorityDenied()
      this.db.prepare("INSERT INTO login_attempts VALUES(?,?,?,?,?)").run(digest(attempt.state), digest(attempt.binding), attempt.nonce, attempt.verifier, attempt.expires)
      this.db.exec("COMMIT"); return attempt
    } catch (error) { this.db.exec("ROLLBACK"); throw error }
  }
  consume(state: string, binding: string): LoginAttempt {
    if (!/^[\w-]{43}$/.test(state) || !/^[\w-]{43}$/.test(binding)) throw new AuthorityDenied()
    const row = this.db.prepare("DELETE FROM login_attempts WHERE state_hash=? AND binding_hash=? AND expires>? RETURNING nonce,verifier,expires").get(digest(state), digest(binding), this.now())
    if (!row) throw new AuthorityDenied()
    return { state, binding, nonce: String(row.nonce), verifier: String(row.verifier), expires: Number(row.expires) }
  }
}

/** Fixed server-configured endpoints, verified TLS, bounded replies, no redirects.
 * Additional CA is for private PKI/local TLS testing, never rejectUnauthorized=false. */
export function identityJson(url: string, body?: URLSearchParams, ca?: string): Promise<any> {
  const target = new URL(url)
  if (target.protocol !== "https:" || target.username || target.password || target.hash) throw new AuthorityDenied()
  return new Promise((resolve, reject) => {
    const request = httpsRequest(target, { method: body ? "POST" : "GET", ca, timeout: 5000, headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) } }, response => {
      let size = 0; const chunks: Buffer[] = []
      response.on("data", chunk => { size += chunk.length; if (size > 128 * 1024) response.destroy(new AuthorityDenied()); else chunks.push(chunk) })
      response.on("error", () => reject(new AuthorityDenied()))
      response.on("end", () => { try { if (response.statusCode !== 200 || !/^application\/json(?:;|$)/i.test(String(response.headers["content-type"]))) throw new AuthorityDenied(); resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))) } catch { reject(new AuthorityDenied()) } })
    })
    const deadline = setTimeout(() => request.destroy(new AuthorityDenied()), 5000)
    request.on("close", () => clearTimeout(deadline))
    request.on("timeout", () => request.destroy(new AuthorityDenied()))
    request.on("error", () => reject(new AuthorityDenied()))
    request.end(body?.toString())
  })
}
export type OidcConfiguration = { issuer: string; authorizationEndpoint: string; tokenEndpoint: string; jwksUri: string; clientId: string; clientSecret?: string; redirectUri: string; ca?: string }
/** Portable OIDC authorization-code + S256 PKCE adapter. Access/refresh tokens are
 * deliberately neither returned nor persisted. Only a verified identity crosses. */
export class OidcIdentityProvider implements IdentityProvider {
  constructor(private config: OidcConfiguration, private now = Date.now) {
    for (const value of [config.issuer, config.authorizationEndpoint, config.tokenEndpoint, config.jwksUri, config.redirectUri]) {
      const url = new URL(value)
      if (url.protocol !== "https:" || url.username || url.password || url.hash || url.search) throw new AuthorityDenied()
    }
    if (!config.clientId || config.clientId.length > 255) throw new AuthorityDenied()
  }
  authorization(attempt: LoginAttempt) {
    const url = new URL(this.config.authorizationEndpoint)
    url.search = new URLSearchParams({ client_id: this.config.clientId, redirect_uri: this.config.redirectUri, response_type: "code", scope: "openid", state: attempt.state, nonce: attempt.nonce, code_challenge: createHash("sha256").update(attempt.verifier).digest("base64url"), code_challenge_method: "S256", response_mode: "query" }).toString()
    return url.href
  }
  async verify(code: string, attempt: LoginAttempt): Promise<VerifiedIdentity> {
    if (!code || code.length > 4096 || attempt.expires <= this.now()) throw new AuthorityDenied()
    try {
      const c = this.config
      const response = await identityJson(c.tokenEndpoint, new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: c.redirectUri, client_id: c.clientId, code_verifier: attempt.verifier, ...(c.clientSecret ? { client_secret: c.clientSecret } : {}) }), c.ca)
      if (typeof response.id_token !== "string" || response.id_token.length > 16384) throw new AuthorityDenied()
      const jwks = await identityJson(c.jwksUri, undefined, c.ca) as JSONWebKeySet
      if (!Array.isArray(jwks.keys) || !jwks.keys.length || jwks.keys.length > 16) throw new AuthorityDenied()
      const { payload } = await jwtVerify(response.id_token, createLocalJWKSet(jwks), { issuer: c.issuer, audience: c.clientId, algorithms: ["RS256", "ES256"], requiredClaims: ["sub", "exp", "iat", "nonce"], maxTokenAge: "5m", clockTolerance: 5, currentDate: new Date(this.now()) })
      if (!equal(payload.nonce, attempt.nonce) || typeof payload.sub !== "string" || !payload.sub || payload.sub.length > 255 || payload.azp !== undefined && payload.azp !== c.clientId || Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== c.clientId || typeof payload.iat !== "number" || payload.iat > this.now() / 1000 + 5) throw new AuthorityDenied()
      if (attempt.expires <= this.now()) throw new AuthorityDenied()
      return Object.freeze({ issuer: c.issuer, subject: payload.sub })
    } catch { throw new AuthorityDenied() }
  }
}

function cookie(request: IncomingMessage, name: string) {
  const values = (request.headers.cookie ?? "").split(";").map(x => x.trim().split("=")).filter(x => x[0] === name)
  if (values.length !== 1 || values[0].length !== 2) throw new AuthorityDenied()
  return values[0][1]
}
/** Functional QA/server integration, no final auth UX. Mount before engine routes.
 * Login callback accepts only a state-bound code, never a browser ID token/user ID. */
export class HostedLoginBoundary {
  constructor(private origin: string, private provider: IdentityProvider, private logins: LoginStore, private authority: LoginSessionStore) {
    if (new URL(origin).origin !== origin || !origin.startsWith("https://")) throw new AuthorityDenied()
  }
  async handle(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
    const pathname = request.url?.split("?")[0]
    if (!["/__webcanbe/auth/start", "/__webcanbe/auth/callback", "/__webcanbe/auth/session", "/__webcanbe/auth/logout"].includes(pathname ?? "")) return false
    const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'" }
    try {
      if (request.headers.host !== new URL(this.origin).host || !(request.socket as { encrypted?: boolean }).encrypted) throw new AuthorityDenied()
      if (pathname === "/__webcanbe/auth/callback") {
        if (request.method !== "GET") throw new AuthorityDenied()
        const params = new URL(request.url!, this.origin).searchParams
        if ([...params.keys()].some(k => !["state", "code", "iss"].includes(k)) || params.getAll("state").length !== 1 || params.getAll("code").length !== 1 || params.getAll("iss").length > 1) throw new AuthorityDenied()
        const attempt = await this.logins.consume(params.get("state")!, cookie(request, "__Host-wcb-login"))
        const identity = await this.provider.verify(params.get("code")!, attempt)
        if (params.has("iss") && params.get("iss") !== identity.issuer) throw new AuthorityDenied()
        const issued = this.authority.issueVerifiedIdentity ? await this.authority.issueVerifiedIdentity(identity) : await this.authority.issueVerifiedSession(await this.logins.account(identity))
        response.writeHead(303, { ...headers, "Set-Cookie": [issued.cookie, "__Host-wcb-login=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0"], Location: "/workspace/northstar" }); response.end(); return true
      }
      if (request.method !== "POST" || request.headers.origin !== this.origin || !/^application\/json(?:;|$)/i.test(request.headers["content-type"] ?? "")) throw new AuthorityDenied()
      if (pathname === "/__webcanbe/auth/start") {
        const attempt = await this.logins.create(), authorizationUrl = this.provider.authorization(attempt)
        response.writeHead(200, { ...headers, "Content-Type": "application/json", "Set-Cookie": `__Host-wcb-login=${attempt.binding}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=300` }); response.end(JSON.stringify({ authorizationUrl })); return true
      }
      const session = await this.authority.resolve(cookie(request, "__Host-wcb-session"))
      if (!session) throw new AuthorityDenied()
      if (pathname === "/__webcanbe/auth/logout") {
        if (typeof request.headers["x-wcb-csrf"] !== "string" || !await this.authority.csrf(session, request.headers["x-wcb-csrf"])) throw new AuthorityDenied()
        await this.authority.revokeSession(session.sessionId)
        response.writeHead(204, { ...headers, "Set-Cookie": "__Host-wcb-session=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0" }); response.end(); return true
      }
      // Same-origin POST-only CSRF bootstrap; rotates only CSRF, never session TTL.
      const csrf = await this.authority.rotateCsrf(session)
      response.writeHead(200, { ...headers, "Content-Type": "application/json" }); response.end(JSON.stringify({ csrf, expiresAt: session.expiresAt })); return true
    } catch { if (response.headersSent) { response.destroy(); return true } response.writeHead(403, { ...headers, "Content-Type": "application/json" }); response.end(JSON.stringify({ error: "Identity or session is unavailable." })); return true }
  }
}
