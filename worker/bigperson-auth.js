import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server"

const GOOGLE_ISSUER = "https://accounts.google.com"
const RP_ID = "webcanbe.com"
const ORIGIN = "https://webcanbe.com"
const CHALLENGE_MS = 90_000
const GOOGLE_SESSION_MAX_AGE_MS = 10 * 60_000
const PBKDF2_ITERATIONS = 600_000
const encoder = new TextEncoder()

function b64url(bytes) {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}
function cleanPassword(value) {
  if (typeof value !== "string" || value.length < 6 || value.length > 256) throw new Error("Privileged factor refused.")
  return value
}
async function deriveFactor(password, salt, pepper) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(cleanPassword(password) + "\0" + pepper), "PBKDF2", false, ["deriveBits"])
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: PBKDF2_ITERATIONS }, material, 256)
  return b64url(new Uint8Array(bits))
}
function equalText(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
async function sha256Json(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(JSON.stringify(value ?? {})))
  return b64url(new Uint8Array(digest))
}
function requireConfig(env) {
  const allowedEmail = String(env.WEBCANBE_BIGPERSON_GOOGLE_EMAIL || "").trim().toLowerCase()
  const pepper = String(env.WEBCANBE_BIGPERSON_FACTOR_PEPPER || "")
  if (!allowedEmail || !pepper) throw new Error("Bigperson authentication is not configured.")
  return { allowedEmail, pepper }
}
function requireGoogleSession(session, allowedEmail) {
  if (!session || session.authProvider !== "google" || session.authIssuer !== GOOGLE_ISSUER || !session.authSubject) throw new Error("A fresh Google-authenticated Webcanbe session is required.")
  if (!Number.isFinite(session.createdAt) || Date.now() - session.createdAt > GOOGLE_SESSION_MAX_AGE_MS) throw new Error("Google authentication is older than the Bigperson freshness window. Sign in with Google again.")
  if (String(session.email || "").trim().toLowerCase() !== allowedEmail || session.emailVerified !== true) throw new Error("Google identity is not authorized for Bigperson bootstrap.")
}
async function activeBigperson(db, session) {
  const result = await db.query("SELECT role,active,epoch FROM wcb_product_operators WHERE user_id=$1", [session.userId])
  const row = result.rows[0]
  return row && row.active && row.role === "bigperson" ? row : undefined
}
async function securityRow(db, session) {
  const result = await db.query("SELECT google_issuer,google_subject,factor_salt,factor_digest,factor_version FROM wcb_bigperson_security WHERE user_id=$1", [session.userId])
  return result.rows[0]
}
async function verifyStoredFactor(row, password, pepper) {
  if (!row?.factor_salt || !row?.factor_digest) return false
  return equalText(await deriveFactor(password, String(row.factor_salt), pepper), String(row.factor_digest))
}
async function bootstrapFactor(password, env, pepper) {
  const salt = String(env.WEBCANBE_BIGPERSON_BOOTSTRAP_FACTOR_SALT || "")
  if (!salt) throw new Error("Bigperson bootstrap factor salt is not configured.")
  const digest = await deriveFactor(password, salt, pepper)
  const expected = String(env.WEBCANBE_BIGPERSON_BOOTSTRAP_FACTOR_DIGEST || "")
  if (!expected) throw new Error("Bigperson bootstrap factor digest is not configured.")
  if (!equalText(digest, expected)) throw new Error("Privileged factor refused.")
  return { salt, digest }
}
async function assertBoundGoogle(db, session, row) {
  if (!row || row.google_issuer !== session.authIssuer || row.google_subject !== session.authSubject) throw new Error("Current Google identity is not the enrolled Bigperson identity.")
  const identity = await db.query("SELECT active FROM wcb_identity_accounts WHERE issuer=$1 AND subject=$2 AND user_id=$3", [session.authIssuer, session.authSubject, session.userId])
  if (!identity.rows[0]?.active) throw new Error("Enrolled Google identity is inactive.")
}
async function purgeChallenges(db, session) {
  await db.query("DELETE FROM wcb_bigperson_challenges WHERE expires_at<=clock_timestamp() OR used_at IS NOT NULL OR (user_id=$1 AND session_id<>$2)", [session.userId, session.sessionId])
}
function rpOrigin(request) {
  const url = new URL(request.url)
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return { rpID: url.hostname, origin: url.origin }
  return { rpID: RP_ID, origin: ORIGIN }
}

export async function beginBigpersonRegistration(db, session, body, env, request) {
  const { allowedEmail, pepper } = requireConfig(env)
  requireGoogleSession(session, allowedEmail)
  const count = await db.query("SELECT count(*)::int AS total FROM wcb_product_operators WHERE active AND role='bigperson'")
  if (Number(count.rows[0]?.total ?? 0) > 0) throw new Error("Bigperson bootstrap is closed.")
  const bootstrap = await bootstrapFactor(body?.password, env, pepper)
  const existing = await db.query("SELECT credential_id,transports FROM wcb_bigperson_passkeys WHERE user_id=$1 AND active", [session.userId])
  const { rpID } = rpOrigin(request)
  const options = await generateRegistrationOptions({
    rpName: "Webcanbe",
    rpID,
    userID: encoder.encode(session.userId),
    userName: allowedEmail,
    attestationType: "none",
    excludeCredentials: existing.rows.map(row => ({ id: String(row.credential_id), transports: row.transports ?? [] })),
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
    preferredAuthenticatorType: "localDevice",
    supportedAlgorithmIDs: [-7, -257],
  })
  const salt = bootstrap.salt
  const pendingDigest = bootstrap.digest
  const challengeId = crypto.randomUUID()
  await purgeChallenges(db, session)
  await db.query(
    "INSERT INTO wcb_bigperson_challenges(challenge_id,user_id,session_id,purpose,challenge,factor_verified_at,pending_factor_salt,pending_factor_digest,expires_at) VALUES($1,$2,$3,'register',$4,clock_timestamp(),$5,$6,clock_timestamp()+$7*interval '1 millisecond')",
    [challengeId, session.userId, session.sessionId, options.challenge, salt, pendingDigest, CHALLENGE_MS],
  )
  return { challengeId, options }
}

export async function finishBigpersonRegistration(db, session, body, env, request) {
  const { allowedEmail } = requireConfig(env)
  requireGoogleSession(session, allowedEmail)
  const rowResult = await db.query("SELECT * FROM wcb_bigperson_challenges WHERE challenge_id=$1 AND user_id=$2 AND session_id=$3 AND purpose='register' AND used_at IS NULL AND expires_at>clock_timestamp() FOR UPDATE", [body?.challengeId, session.userId, session.sessionId])
  const row = rowResult.rows[0]
  if (!row) throw new Error("Bigperson registration challenge expired.")
  const count = await db.query("SELECT count(*)::int AS total FROM wcb_product_operators WHERE active AND role='bigperson'")
  if (Number(count.rows[0]?.total ?? 0) > 0) throw new Error("Bigperson bootstrap is closed.")
  const { rpID, origin } = rpOrigin(request)
  const verification = await verifyRegistrationResponse({ response: body?.response, expectedChallenge: String(row.challenge), expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true, supportedAlgorithmIDs: [-7, -257] })
  if (!verification.verified || !verification.registrationInfo) throw new Error("Passkey registration refused.")
  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo
  if (credentialDeviceType !== "singleDevice" || credentialBackedUp) throw new Error("Bigperson requires a device-bound passkey that is not cloud-synced.")
  await db.query("BEGIN")
  try {
    await db.query("UPDATE wcb_bigperson_challenges SET used_at=clock_timestamp() WHERE challenge_id=$1 AND used_at IS NULL", [row.challenge_id])
    await db.query("INSERT INTO wcb_bigperson_security(user_id,google_issuer,google_subject,factor_salt,factor_digest) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id) DO UPDATE SET google_issuer=EXCLUDED.google_issuer,google_subject=EXCLUDED.google_subject,factor_salt=EXCLUDED.factor_salt,factor_digest=EXCLUDED.factor_digest,factor_version=wcb_bigperson_security.factor_version+1,updated_at=clock_timestamp()", [session.userId, session.authIssuer, session.authSubject, row.pending_factor_salt, row.pending_factor_digest])
    await db.query("INSERT INTO wcb_bigperson_passkeys(credential_id,user_id,webauthn_user_id,public_key,counter,transports,device_type,backed_up) VALUES($1,$2,$3,$4,$5,$6,$7,$8)", [credential.id, session.userId, optionsUserId(session.userId), Buffer.from(credential.publicKey), credential.counter, credential.transports ?? [], credentialDeviceType, credentialBackedUp])
    await db.query("INSERT INTO wcb_product_operators(user_id,active,role,epoch) VALUES($1,true,'bigperson',1) ON CONFLICT(user_id) DO UPDATE SET active=true,role='bigperson',epoch=wcb_product_operators.epoch+1,updated_at=clock_timestamp()", [session.userId])
    await db.query("COMMIT")
  } catch (error) { await db.query("ROLLBACK"); throw error }
  return { registered: true }
}
function optionsUserId(userId) {
  return b64url(encoder.encode(userId))
}

export async function beginBigpersonOperation(db, session, body, env, request) {
  const { pepper } = requireConfig(env)
  if (!await activeBigperson(db, session)) throw new Error("Bigperson authority required.")
  const security = await securityRow(db, session)
  await assertBoundGoogle(db, session, security)
  if (!await verifyStoredFactor(security, body?.password, pepper)) throw new Error("Privileged factor refused.")
  const method = String(body?.operation?.method || "").toUpperCase()
  const path = String(body?.operation?.path || "")
  if (!["POST","DELETE","PATCH"].includes(method) || !path.startsWith("/__webcanbe/api/ops/")) throw new Error("Invalid privileged operation.")
  const bodyHash = await sha256Json(body?.operation?.body ?? {})
  const passkeys = await db.query("SELECT credential_id,transports FROM wcb_bigperson_passkeys WHERE user_id=$1 AND active ORDER BY created_at", [session.userId])
  if (!passkeys.rows.length) throw new Error("No active Bigperson passkey.")
  const { rpID } = rpOrigin(request)
  const options = await generateAuthenticationOptions({ rpID, allowCredentials: passkeys.rows.map(row => ({ id: String(row.credential_id), transports: row.transports ?? [] })), userVerification: "required" })
  const challengeId = crypto.randomUUID()
  await purgeChallenges(db, session)
  await db.query("INSERT INTO wcb_bigperson_challenges(challenge_id,user_id,session_id,purpose,challenge,operation_method,operation_path,operation_body_hash,factor_verified_at,expires_at) VALUES($1,$2,$3,'operation',$4,$5,$6,$7,clock_timestamp(),clock_timestamp()+$8*interval '1 millisecond')", [challengeId, session.userId, session.sessionId, options.challenge, method, path, bodyHash, CHALLENGE_MS])
  return { challengeId, options }
}

export async function consumeBigpersonOperation(db, session, body, env, request, expectedOperation) {
  requireConfig(env)
  if (!await activeBigperson(db, session)) throw new Error("Bigperson authority required.")
  const security = await securityRow(db, session)
  await assertBoundGoogle(db, session, security)
  const challengeResult = await db.query("SELECT * FROM wcb_bigperson_challenges WHERE challenge_id=$1 AND user_id=$2 AND session_id=$3 AND purpose='operation' AND used_at IS NULL AND expires_at>clock_timestamp() FOR UPDATE", [body?.challengeId, session.userId, session.sessionId])
  const challenge = challengeResult.rows[0]
  if (!challenge) throw new Error("Privileged operation challenge expired.")
  const method = String(expectedOperation.method || "").toUpperCase(), path = String(expectedOperation.path || ""), bodyHash = await sha256Json(expectedOperation.body ?? {})
  if (challenge.operation_method !== method || challenge.operation_path !== path || challenge.operation_body_hash !== bodyHash) throw new Error("Privileged operation binding mismatch.")
  const passkeyResult = await db.query("SELECT * FROM wcb_bigperson_passkeys WHERE credential_id=$1 AND user_id=$2 AND active FOR UPDATE", [body?.response?.id, session.userId])
  const passkey = passkeyResult.rows[0]
  if (!passkey) throw new Error("Passkey refused.")
  if (String(passkey.device_type) !== "singleDevice" || passkey.backed_up === true) throw new Error("Bigperson requires the enrolled device-bound passkey.")
  const { rpID, origin } = rpOrigin(request)
  const verification = await verifyAuthenticationResponse({
    response: body.response,
    expectedChallenge: String(challenge.challenge),
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
    credential: { id: String(passkey.credential_id), publicKey: new Uint8Array(passkey.public_key), counter: Number(passkey.counter), transports: passkey.transports ?? [] },
  })
  if (!verification.verified) throw new Error("Passkey verification refused.")
  const consumed = await db.query("UPDATE wcb_bigperson_challenges SET used_at=clock_timestamp() WHERE challenge_id=$1 AND used_at IS NULL RETURNING challenge_id", [challenge.challenge_id])
  if (!consumed.rows.length) throw new Error("Privileged operation challenge was already used.")
  await db.query("UPDATE wcb_bigperson_passkeys SET counter=$2,last_used_at=clock_timestamp() WHERE credential_id=$1", [passkey.credential_id, verification.authenticationInfo.newCounter])
  const evidenceId = crypto.randomUUID()
  await db.query("INSERT INTO wcb_operator_step_up_evidence(evidence_id,operator_user_id,session_id,authority,verified_at,expires_at,active) VALUES($1,$2,$3,'control_high_risk',clock_timestamp(),clock_timestamp()+interval '5 minutes',true)", [evidenceId, session.userId, session.sessionId])
  return { verified: true, credentialId: String(passkey.credential_id), evidenceId }
}
