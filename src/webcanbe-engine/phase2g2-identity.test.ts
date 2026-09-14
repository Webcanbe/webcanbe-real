import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { createServer, request } from "node:https"
import { afterEach, describe, expect, it } from "vitest"
import { exportJWK, generateKeyPair, SignJWT } from "jose"
import { HostedLoginBoundary, OidcIdentityProvider, SqliteLoginStore } from "./runtime/hostedIdentity"
import { SqliteAuthorityStore } from "./runtime/hostedAuthority"

const clean: Array<() => unknown> = []
afterEach(async () => { for (const close of clean.splice(0).reverse()) await close() })
async function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wcb-test-oidc-")); clean.push(() => fs.rmSync(dir, { recursive: true, force: true }))
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost", "-keyout", path.join(dir, "key.pem"), "-out", path.join(dir, "cert.pem")], { stdio: "ignore" })
  const ca = fs.readFileSync(path.join(dir, "cert.pem"), "utf8"), keys = await generateKeyPair("RS256"), jwk = { ...await exportJWK(keys.publicKey), kid: "local-test-key", alg: "RS256" }
  let origin = "", nonce = "", claims: Record<string, unknown> = {}, verifier = "", boundary: HostedLoginBoundary
  const server = createServer({ key: fs.readFileSync(path.join(dir, "key.pem")), cert: ca }, async (req, res) => {
    if (req.url === "/jwks") { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ keys: [jwk] })); return }
    if (req.url === "/token") {
      let body = ""; for await (const chunk of req) body += chunk
      verifier = new URLSearchParams(body).get("code_verifier") ?? ""
      const now = Math.floor(Date.now() / 1000)
      const token = await new SignJWT({ iss: origin, sub: "test-provider-subject", aud: "test-client", iat: now, exp: now + 120, nonce, ...claims }).setProtectedHeader({ alg: "RS256", kid: "local-test-key" }).sign(keys.privateKey)
      res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ id_token: token, access_token: "local-test-unused" })); return
    }
    if (!await boundary.handle(req, res)) { res.writeHead(404); res.end() }
  })
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve)); clean.push(() => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()) }))
  origin = `https://localhost:${(server.address() as { port: number }).port}`
  const authority = new SqliteAuthorityStore(path.join(dir, "authority.sqlite")), logins = new SqliteLoginStore(path.join(dir, "login.sqlite")); clean.push(() => authority.close(), () => logins.close())
  const provider = new OidcIdentityProvider({ issuer: origin, authorizationEndpoint: origin + "/authorize", tokenEndpoint: origin + "/token", jwksUri: origin + "/jwks", clientId: "test-client", redirectUri: origin + "/__webcanbe/auth/callback", ca })
  const user = randomUUID(); logins.provision({ issuer: origin, subject: "test-provider-subject" }, user)
  boundary = new HostedLoginBoundary(origin, provider, logins, authority)
  const call = (url: string, headers: Record<string, string> = {}, method = "POST") => new Promise<{ status: number; cookies: string[]; body: any; location?: string }>((resolve, reject) => {
    const req = request(origin + url, { ca, method, lookup: (_hostname, _options, cb) => cb(null, [{ address: "127.0.0.1", family: 4 }]), headers: { Origin: origin, "Content-Type": "application/json", ...headers } }, res => {
      let body = ""; res.on("data", x => body += x); res.on("end", () => resolve({ status: res.statusCode!, cookies: res.headers["set-cookie"] ?? [], body: body ? JSON.parse(body) : undefined, location: res.headers.location }))
    }); req.on("error", reject); req.end()
  })
  const start = async () => {
    const result = await call("/__webcanbe/auth/start"), url = new URL(result.body.authorizationUrl); nonce = url.searchParams.get("nonce")!
    return { result, url, cookie: result.cookies[0].split(";")[0], callback: "/__webcanbe/auth/callback?state=" + url.searchParams.get("state") + "&code=local-test-code" }
  }
  return { dir, ca, origin, authority, logins, user, call, start, provider, setAuthority: (store: ConstructorParameters<typeof HostedLoginBoundary>[3]) => { boundary = new HostedLoginBoundary(origin, provider, logins, store) }, setClaims: (value: Record<string, unknown>) => { claims = value }, verifier: () => verifier }
}
describe("OIDC integration with a signed local TEST issuer over verified TLS (not production identity)", () => {
  it("returns a clean 403 when asynchronous CSRF rotation fails before response headers", async () => {
    const d=await setup(),s=await d.start(),completed=await d.call(s.callback,{Cookie:s.cookie},"GET"),cookie=completed.cookies[0].split(";")[0],token=cookie.split("=")[1],session=d.authority.resolve(token)!
    d.setAuthority({ issueVerifiedSession:user=>d.authority.issueVerifiedSession(user), resolve:async value=>d.authority.resolve(value), csrf:async(s,t)=>d.authority.csrf(s,t), revokeSession:id=>d.authority.revokeSession(id), rotateCsrf:async()=>{throw Error("injected asynchronous database failure")} })
    expect(await d.call("/__webcanbe/auth/session",{Cookie:cookie})).toMatchObject({status:403})
    expect(d.authority.resolve(token)?.expiresAt).toBe(session.expiresAt)
  })

  it("exchanges code+PKCE, maps issuer+subject, sets host-only session and rotates CSRF", async () => {
    const d = await setup(), s = await d.start()
    expect(s.url.searchParams.get("code_challenge_method")).toBe("S256")
    expect(s.result.cookies[0]).toContain("Secure; HttpOnly; SameSite=Lax")
    const completed = await d.call(s.callback, { Cookie: s.cookie }, "GET")
    expect(completed.status).toBe(303); expect(d.verifier()).toMatch(/^[\w-]{43}$/)
    const sessionCookie = completed.cookies[0]
    expect(sessionCookie).toContain("Secure; HttpOnly; SameSite=Strict"); expect(sessionCookie).not.toContain("Domain=")
    const token = sessionCookie.split(";")[0].split("=")[1], session = d.authority.resolve(token)!
    expect(session.userId).toBe(d.user)
    const bootstrap = await d.call("/__webcanbe/auth/session", { Cookie: sessionCookie.split(";")[0] })
    expect(bootstrap.status).toBe(200); expect(d.authority.csrf(session, bootstrap.body.csrf)).toBe(true)
    expect(await d.call("/__webcanbe/auth/session", { Cookie: sessionCookie, Origin: "https://attacker.invalid" })).toMatchObject({ status: 403 })
    expect(await d.call("/__webcanbe/auth/logout", { Cookie: sessionCookie })).toMatchObject({ status: 403 })
    expect(await d.call("/__webcanbe/auth/logout", { Cookie: sessionCookie, "X-WCB-CSRF": bootstrap.body.csrf })).toMatchObject({ status: 204 })
    expect(d.authority.resolve(token)).toBeUndefined()
  })
  it.each([
    { nonce: "wrong" }, { iss: "https://other-issuer.invalid" }, { aud: "another-client" }, { azp: "another-client" },
    { aud: ["test-client", "other"] }, { exp: 1 }, { iat: 1 }, { iat: Math.floor(Date.now() / 1000) + 3600 }, { sub: "" },
  ])("rejects a signed but invalid token %j", async claims => {
    const d = await setup(), s = await d.start(); d.setClaims(claims)
    expect(await d.call(s.callback, { Cookie: s.cookie }, "GET")).toMatchObject({ status: 403 })
  })
  it("denies missing/wrong/duplicate browser cookies, forged state, callback replay and issuer mismatch", async () => {
    const d = await setup(), s = await d.start()
    for (const headers of [{} as Record<string, string>, { Cookie: "__Host-wcb-login=" + "a".repeat(43) }, { Cookie: s.cookie + "; " + s.cookie }]) expect(await d.call(s.callback, headers, "GET")).toMatchObject({ status: 403 })
    expect(await d.call(s.callback.replace("state=", "state=forged"), { Cookie: s.cookie }, "GET")).toMatchObject({ status: 403 })
    expect(await d.call(s.callback, { Cookie: s.cookie }, "GET")).toMatchObject({ status: 303 })
    expect(await d.call(s.callback, { Cookie: s.cookie }, "GET")).toMatchObject({ status: 403 })
    const second = await d.start()
    expect(await d.call(second.callback + "&iss=https://wrong.invalid", { Cookie: second.cookie }, "GET")).toMatchObject({ status: 403 })
  })
  it("does not enroll unknown subjects, link by email or allow disabled users to log back in", async () => {
    const d = await setup(), s = await d.start(); d.setClaims({ sub: "unprovisioned", email: "same@example.invalid", email_verified: true })
    expect(await d.call(s.callback, { Cookie: s.cookie }, "GET")).toMatchObject({ status: 403 })
    d.setClaims({}); d.authority.revokeUser(d.user)
    const again = await d.start(); expect(await d.call(again.callback, { Cookie: again.cookie }, "GET")).toMatchObject({ status: 403 })
    expect(() => d.authority.issueVerifiedSession(d.user)).toThrow()
  })
  it("persists one-use attempts across processes/stores and never remaps an identity", async () => {
    const d = await setup(), attempt = d.logins.create(), peer = new SqliteLoginStore(path.join(d.dir, "login.sqlite")); clean.push(() => peer.close())
    expect(peer.consume(attempt.state, attempt.binding).nonce).toBe(attempt.nonce)
    expect(() => d.logins.consume(attempt.state, attempt.binding)).toThrow()
    expect(() => peer.provision({ issuer: d.origin, subject: "test-provider-subject" }, randomUUID())).toThrow()
    peer.disable({ issuer: d.origin, subject: "test-provider-subject" })
    expect(() => d.logins.account({ issuer: d.origin, subject: "test-provider-subject" })).toThrow()
  })
  it("rejects browser-selected identity, cross-origin starts, HTTP endpoints and expired attempts", async () => {
    const d = await setup()
    expect(await d.call("/__webcanbe/auth/start", { Origin: "null" })).toMatchObject({ status: 403 })
    expect(await d.call("/__webcanbe/auth/callback?userId=" + d.user, {}, "GET")).toMatchObject({ status: 403 })
    expect(() => new OidcIdentityProvider({ issuer: "http://localhost", authorizationEndpoint: d.origin, tokenEndpoint: d.origin, jwksUri: d.origin, clientId: "test-client", redirectUri: d.origin })).toThrow()
    const attempt = d.logins.create(); await expect(d.provider.verify("code", { ...attempt, expires: 1 })).rejects.toThrow()
  })
})
