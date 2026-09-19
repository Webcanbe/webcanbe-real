import { createRemoteJWKSet, jwtVerify } from "jose"

export const FIREBASE_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
const FIREBASE_JWKS = createRemoteJWKSet(new URL(FIREBASE_JWKS_URL))

export async function verifyFirebaseIdToken(idToken, projectId, key = FIREBASE_JWKS, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (typeof projectId !== "string" || !projectId.trim()) throw new Error("Firebase project ID is not configured.")
  if (typeof idToken !== "string" || idToken.length < 20 || idToken.length > 8192) throw new Error("Firebase ID token is invalid.")

  const { payload, protectedHeader } = await jwtVerify(idToken, key, {
    issuer: "https://securetoken.google.com/" + projectId,
    audience: projectId,
    algorithms: ["RS256"],
    clockTolerance: 5,
  })

  if (protectedHeader.alg !== "RS256" || typeof protectedHeader.kid !== "string" || !protectedHeader.kid) throw new Error("Firebase ID token header is invalid.")
  if (typeof payload.sub !== "string" || !payload.sub || payload.sub.length > 128) throw new Error("Firebase user ID is invalid.")
  if (typeof payload.iat !== "number" || payload.iat > nowSeconds + 5) throw new Error("Firebase issued-at time is invalid.")
  if (typeof payload.auth_time !== "number" || payload.auth_time > nowSeconds + 5) throw new Error("Firebase authentication time is invalid.")
  if (typeof payload.exp !== "number" || payload.exp <= nowSeconds - 5) throw new Error("Firebase ID token has expired.")

  return payload
}
