import { describe, expect, it } from "vitest"
import { SignJWT, generateKeyPair } from "jose"
import { verifyFirebaseIdToken } from "./firebase-auth.js"

const projectId = "webcanbe-test"
const now = 1_800_000_000

async function token(overrides = {}) {
  const { privateKey, publicKey } = await generateKeyPair("RS256")
  const payload = {
    auth_time: now - 20,
    email: "user@example.com",
    email_verified: true,
    firebase: { sign_in_provider: "github.com" },
    ...overrides.payload,
  }
  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(overrides.issuer ?? "https://securetoken.google.com/" + projectId)
    .setAudience(overrides.audience ?? projectId)
    .setSubject(overrides.subject ?? "firebase-uid")
    .setIssuedAt(overrides.iat ?? now - 10)
    .setExpirationTime(overrides.exp ?? now + 3600)
    .sign(privateKey)
  return { jwt, publicKey }
}

describe("Firebase ID token verifier", () => {
  it("accepts a correctly signed Firebase ID token", async () => {
    const { jwt, publicKey } = await token()
    const payload = await verifyFirebaseIdToken(jwt, projectId, publicKey, now)
    expect(payload.sub).toBe("firebase-uid")
    expect(payload.email).toBe("user@example.com")
  })

  it("rejects a token for a different Firebase project", async () => {
    const { jwt, publicKey } = await token({ audience: "other-project" })
    await expect(verifyFirebaseIdToken(jwt, projectId, publicKey, now)).rejects.toThrow()
  })

  it("rejects a token with a future auth_time", async () => {
    const { jwt, publicKey } = await token({ payload: { auth_time: now + 60 } })
    await expect(verifyFirebaseIdToken(jwt, projectId, publicKey, now)).rejects.toThrow("authentication time")
  })

  it("rejects an empty or oversized Firebase uid", async () => {
    const oversized = "u".repeat(129)
    const { jwt, publicKey } = await token({ subject: oversized })
    await expect(verifyFirebaseIdToken(jwt, projectId, publicKey, now)).rejects.toThrow("user ID")
  })
})
