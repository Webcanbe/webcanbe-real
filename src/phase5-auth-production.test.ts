import fs from "node:fs"
import { describe, expect, it } from "vitest"
import { OidcIdentityProvider } from "./webcanbe-engine/runtime/hostedIdentity"

const postgresIdentity = fs.readFileSync("src/webcanbe-engine/runtime/postgresIdentity.ts", "utf8")
const editorMain = fs.readFileSync("scripts/hosted/editor-main.ts", "utf8")
const googleConfig = fs.readFileSync("deployment/hosted/google-oidc.example.json", "utf8")
const app = fs.readFileSync("src/App.tsx", "utf8")

describe("Phase 5 production authentication", () => {
  it("builds a PKCE Google OIDC request with explicit production scopes", () => {
    const provider = new OidcIdentityProvider({
      issuer: "https://accounts.google.com",
      authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenEndpoint: "https://oauth2.googleapis.com/token",
      jwksUri: "https://www.googleapis.com/oauth2/v3/certs",
      clientId: "client-id",
      redirectUri: "https://webcanbe.test/__webcanbe/auth/callback",
      scopes: ["openid", "email", "profile"],
    })
    const url = new URL(provider.authorization({
      state: "state",
      binding: "binding",
      nonce: "nonce",
      verifier: "v".repeat(43),
      expires: Date.now() + 300000,
    }))
    expect(url.searchParams.get("scope")).toBe("openid email profile")
    expect(url.searchParams.get("code_challenge_method")).toBe("S256")
    expect(url.searchParams.get("response_type")).toBe("code")
  })

  it("can atomically bootstrap a verified first-login account and owner workspace when enabled", () => {
    expect(postgresIdentity).toContain("allowSelfRegistration")
    expect(postgresIdentity).toContain("const userId = randomUUID(), workspaceId = randomUUID()")
    expect(postgresIdentity).toContain("INSERT INTO wcb_workspace_members")
    expect(postgresIdentity).toContain("'owner',1,true")
    expect(editorMain).toContain("config.identity?.allowSelfRegistration === true")
  })

  it("keeps public registration opt-in and bounds production sessions", () => {
    expect(postgresIdentity).toContain("sessionLifetimeMs")
    expect(postgresIdentity).toContain("604800000")
    expect(googleConfig).toContain('"allowSelfRegistration": true')
    expect(googleConfig).toContain('"sessionLifetimeMs": 604800000')
  })

  it("keeps Google on the Worker boundary while GitHub and email use Firebase", () => {
    expect(app).toContain("hostedProductClient.authStart()")
    expect(app).toContain("signInWithGithubFirebase()")
    expect(app).toContain("createEmailAccountFirebase")
    expect(app).toContain("signInWithEmailFirebase")
    expect(app).toContain("Google, GitHub, and email sign-in are available.")
    expect(app).toContain("Phone sign-in is not connected yet")
  })

  it("replaces a rejected protected URL with a validated login return target", () => {
    expect(app).toContain("function replaceWithLogin(next: string)")
    expect(app).toContain('const target = "/login?next=" + encodeURIComponent(next)')
    expect(app).toContain("window.location.replace(target)")
    expect(app).toContain("else replaceWithLogin(window.location.pathname+window.location.search)")
    expect(app).toContain('raw.startsWith("//") || raw.includes("\\\\")')
    expect(app).toContain("target.origin === window.location.origin")
  })

  it("lets Escape close an idle sign-in dialog without interrupting an active provider flow", () => {
    expect(app).toContain('if(event.key!=="Escape"||busy)return')
    expect(app).toContain("onClose?.()")
    expect(app).toContain('window.addEventListener("keydown",closeOnEscape)')
    expect(app).toContain('input autoFocus className="auth-demo-email"')
    expect(app).toContain("directNext=authNext()")
  })
})
