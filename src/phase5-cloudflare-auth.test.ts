import fs from "node:fs"
import { describe, expect, it } from "vitest"

const app = fs.readFileSync("src/App.tsx", "utf8")
const client = fs.readFileSync("src/hostedProductClient.ts", "utf8")
const index = fs.readFileSync("index.html", "utf8")
const worker = fs.readFileSync("worker/index.js", "utf8")
const wrangler = fs.readFileSync("wrangler.jsonc", "utf8")
const pagesFunction = fs.readFileSync("functions/__webcanbe/auth/[[route]].js", "utf8")
const routes = fs.readFileSync("public/_routes.json", "utf8")

describe("Phase 5 Cloudflare Google auth", () => {
  it("routes the auth boundary through the Worker before SPA assets", () => {
    expect(wrangler).toContain('"main": "./worker/index.js"')
    expect(wrangler).toContain('"binding": "ASSETS"')
    expect(wrangler).toContain('"run_worker_first": true')
    expect(wrangler).toContain('"single-page-application"')
  })

  it("also exposes the same auth boundary when Cloudflare deploys the repo as Pages", () => {
    expect(pagesFunction).toContain('../../../worker/index.js')
    expect(pagesFunction).toContain("worker.fetch(context.request, context.env)")
    expect(routes).toContain('"/__webcanbe/auth/*"')
  })

  it("implements Google authorization-code PKCE and verifies the ID token", () => {
    expect(worker).toContain('code_challenge_method: "S256"')
    expect(worker).toContain('scope: "openid email profile"')
    expect(worker).toContain("createRemoteJWKSet")
    expect(worker).toContain("jwtVerify")
    expect(worker).toContain("GOOGLE_OAUTH_CLIENT_ID")
    expect(worker).toContain("GOOGLE_OAUTH_CLIENT_SECRET")
  })

  it("uses signed HttpOnly sessions and CSRF-protected logout", () => {
    expect(worker).toContain("__Host-wcb-session")
    expect(worker).toContain("HttpOnly")
    expect(worker).toContain("SameSite=Strict")
    expect(worker).toContain('"X-WCB-CSRF"')
    expect(worker).not.toContain("refresh_token")
  })

  it("turns real auth on only for canonical production without enabling hosted product APIs", () => {
    expect(index).toContain('name="wcb-auth-mode" content="google"')
    expect(client).toContain('window.location.origin === "https://webcanbe.com"')
    expect(client).toContain("productionAuthMode")
    expect(app).toContain("productionAuthMode")
    expect(app).toContain("productionSignedIn")
    expect(client).toContain("/__webcanbe/auth/firebase-exchange")
    expect(worker).toContain('path === "/__webcanbe/auth/firebase-exchange"')
    expect(worker).toContain("verifyFirebaseIdToken")
    expect(worker).toContain('const FIREBASE_PROJECT_ID = "webcanbe-b607e"')
  })
})
