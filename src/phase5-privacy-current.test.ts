import fs from "node:fs"
import { describe, expect, it } from "vitest"

const app = fs.readFileSync("src/App.tsx", "utf8")
const security = fs.readFileSync("public/.well-known/security.txt", "utf8")

describe("Phase 5 privacy and security disclosure", () => {
  it("describes the authentication providers and server session model now in use", () => {
    const policy = app.slice(app.indexOf('"/policy": {'), app.indexOf("\n  ] },", app.indexOf('"/policy": {')) + 6)
    expect(policy).toContain("Firebase Authentication")
    expect(policy).toContain("GitHub")
    expect(policy).toContain("Email/Password")
    expect(policy).toContain("Cloudflare")
    expect(policy).toContain("Supabase-hosted PostgreSQL")
    expect(policy).toContain("Secure HttpOnly cookies")
    expect(policy).toContain("does not request access to Gmail")
    expect(policy).toContain("does not sell personal information")
  })

  it("does not claim that email alone links provider identities", () => {
    const policy = app.slice(app.indexOf('"/policy": {'), app.indexOf("\n  ] },", app.indexOf('"/policy": {')) + 6)
    expect(policy).toContain("not treated by themselves as authority to silently merge")
  })

  it("publishes a canonical security contact", () => {
    expect(security).toContain("Contact: mailto:hello@webcanbe.com")
    expect(security).toContain("Canonical: https://webcanbe.com/.well-known/security.txt")
    expect(security).toContain("Policy: https://webcanbe.com/policy")
    expect(security).toContain("Expires: 2027-09-19")
  })
})
