import fs from "node:fs"
import { describe, expect, it } from "vitest"

const worker = fs.readFileSync("worker/index.js", "utf8")
const wrangler = fs.readFileSync("wrangler.jsonc", "utf8")

describe("Phase 5 Worker abuse rate limiting", () => {
  it("configures distinct Cloudflare rate-limit namespaces", () => {
    expect(wrangler).toContain('"name": "AUTH_RATE_LIMITER"')
    expect(wrangler).toContain('"namespace_id": "136713667501"')
    expect(wrangler).toContain('"limit": 30')
    expect(wrangler).toContain('"name": "PUBLIC_API_RATE_LIMITER"')
    expect(wrangler).toContain('"namespace_id": "136713667502"')
    expect(wrangler).toContain('"name": "PRIVATE_API_RATE_LIMITER"')
    expect(wrangler).toContain('"namespace_id": "136713667503"')
  })

  it("rate-limits auth and public API requests before expensive handlers", () => {
    expect(worker).toContain('anonymousRateKey(request, "auth:" + path)')
    expect(worker).toContain("env.AUTH_RATE_LIMITER")
    expect(worker).toContain('anonymousRateKey(request, "public:" + path)')
    expect(worker).toContain("env.PUBLIC_API_RATE_LIMITER")
    expect(worker).toContain('anonymousRateKey(request, "ops:readiness")')
  })

  it("rate-limits private product access only after session and CSRF validation", () => {
    const csrf = worker.indexOf("verifyDatabaseCsrf(db, databaseSession, csrf, token)")
    const limiter = worker.indexOf('rateLimitAllowed(env.PRIVATE_API_RATE_LIMITER, "user:" + databaseSession.userId)')
    expect(csrf).toBeGreaterThan(-1)
    expect(limiter).toBeGreaterThan(csrf)
  })

  it("returns a bounded 429 response with Retry-After", () => {
    expect(worker).toContain('status = 200')
    expect(worker).toContain('Too many requests. Try again shortly.')
    expect(worker).toContain('"Retry-After": "60"')
    expect(worker).toContain("429")
  })
})
