import fs from "node:fs"
import { describe, expect, it } from "vitest"

const auth = fs.readFileSync("worker/bigperson-auth.js", "utf8")
const worker = fs.readFileSync("worker/index.js", "utf8")
const session = fs.readFileSync("worker/postgres-session.js", "utf8")
const client = fs.readFileSync("src/hostedProductClient.ts", "utf8")
const app = fs.readFileSync("src/App.tsx", "utf8")
const schema = fs.readFileSync("deployment/hosted/postgres-bigperson-3factor.sql", "utf8")
const hardening = fs.readFileSync("deployment/hosted/postgres-supabase-hardening.sql", "utf8")
const wrangler = fs.readFileSync("wrangler.jsonc", "utf8")

describe("Phase 5 Bigperson mandatory three-factor boundary", () => {
  it("binds first-party sessions to the identity that authenticated them", () => {
    expect(session).toContain("auth_issuer,auth_subject,auth_provider")
    expect(session).toContain("identity.issuer, identity.subject, identity.provider")
    expect(session).toContain("const createdAt = new Date(row.created_at).getTime()")
    expect(auth).toContain('session.authProvider !== "google"')
    expect(auth).toContain('session.authIssuer !== GOOGLE_ISSUER')
    expect(auth).toContain("GOOGLE_SESSION_MAX_AGE_MS")
  })

  it("never stores the entered privileged factor as plaintext", () => {
    expect(auth).toContain("PBKDF2_ITERATIONS = 600_000")
    expect(auth).toContain('name: "PBKDF2"')
    expect(auth).toContain("WEBCANBE_BIGPERSON_FACTOR_PEPPER")
    expect(auth).toContain("WEBCANBE_BIGPERSON_BOOTSTRAP_FACTOR_DIGEST")
    expect(auth).toContain("Bigperson bootstrap factor digest is not configured.")
    expect(schema).toContain("factor_salt text")
    expect(schema).toContain("factor_digest text")
    expect(schema).not.toMatch(/password\s+text/i)
    expect(app).toContain('setPassword(""); setBusy(true)')
  })

  it("requires verified WebAuthn user verification and operation-bound one-time challenges", () => {
    expect(auth).toContain("generateAuthenticationOptions")
    expect(auth).toContain("verifyAuthenticationResponse")
    expect(auth).toContain('userVerification: "required"')
    expect(auth).toContain("requireUserVerification: true")
    expect(auth).toContain("CHALLENGE_MS = 90_000")
    expect(auth).toContain("operation_body_hash")
    expect(auth).toContain("used_at IS NULL")
    expect(auth).toContain("Privileged operation binding mismatch.")
    expect(auth).toContain("Privileged operation challenge was already used.")
  })

  it("requires all three factors for every privileged Control read", () => {
    expect(worker).toContain("beginBigpersonOperation")
    expect(worker).toContain("consumeBigpersonOperation")
    expect(worker).toContain('{ method: "POST", path, body: {} }')
    expect(client).toContain("async controlRead(password: string)")
    expect(client).toContain("startAuthentication")
    expect(client).toContain("/__webcanbe/api/ops/bigperson/operation/options")
    expect(app).toContain("Three factors are required every time.")
    expect(app).toContain("Verify all 3 factors")
  })

  it("adds a dedicated low-volume ceremony rate limit", () => {
    expect(wrangler).toContain('"BIGPERSON_RATE_LIMITER"')
    expect(wrangler).toContain('"limit": 5')
    expect(worker).toContain('rateLimitAllowed(env.BIGPERSON_RATE_LIMITER, "bigperson:" + databaseSession.userId)')
  })

  it("locks first Bigperson enrollment to Google + factor + verified passkey before role bootstrap", () => {
    expect(auth).toContain("beginBigpersonRegistration")
    expect(auth).toContain("bootstrapFactor")
    expect(auth).toContain("Bigperson bootstrap is closed.")
    expect(auth).toContain("verifyRegistrationResponse")
    expect(auth).toContain("preferredAuthenticatorType: \"localDevice\"")
    expect(auth).toContain("supportedAlgorithmIDs: [-7, -257]")
    expect(auth).toContain('credentialDeviceType !== "singleDevice"')
    expect(auth).toContain("credentialBackedUp")
    expect(auth).toContain('passkey.device_type) !== "singleDevice"')
    expect(auth).toContain("role='bigperson'")
  })

  it("binds Bigperson rows to the real internal account profile and preserves server-only DB access", () => {
    expect(schema).toContain("REFERENCES wcb_user_profiles(user_id)")
    expect(schema).not.toContain("wcb_users")
    expect(schema).toContain("REVOKE ALL PRIVILEGES ON TABLE wcb_bigperson_security, wcb_bigperson_passkeys, wcb_bigperson_challenges FROM anon, authenticated")
    expect(schema).toContain("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE wcb_bigperson_security, wcb_bigperson_passkeys, wcb_bigperson_challenges TO webcanbe_runtime")
    expect(hardening).toContain("DO $")
    expect(hardening).not.toContain("DO $\nBEGIN")
  })

  it("keeps sensitive values out of the repository", () => {
    expect(auth).not.toContain("@gmail.com")
    expect(auth).not.toContain("101612")
    expect(client).not.toContain("@gmail.com")
    expect(app).not.toContain("@gmail.com")
    expect(schema).not.toContain("@gmail.com")
  })
})
