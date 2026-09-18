import fs from "node:fs"
import { describe, expect, it } from "vitest"

const app = fs.readFileSync("src/App.tsx", "utf8")
const landing = fs.readFileSync("public/wcb-landing/index.html", "utf8")

describe("Phase 5 Google OAuth public legal pages", () => {
  it("serves the exact public privacy and terms routes configured in Google Cloud", () => {
    expect(app).toContain('"/policy": { eyebrow:"Legal", title:"Privacy Policy"')
    expect(app).toContain('"/terms": { eyebrow:"Legal", title:"Terms of Service"')
    expect(app).toContain('"/policy","/privacy"')
  })

  it("links the homepage to the canonical privacy URL", () => {
    expect(landing).toContain('href="/policy"')
    expect(landing).not.toContain('href="/privacy"')
    expect(app).toContain('<Link to="/policy">Privacy</Link>')
  })

  it("discloses Google user-data handling for the requested sign-in scopes", () => {
    expect(app).toContain("openid, email, and profile")
    expect(app).toContain("does not request access to Gmail, Google Drive, Google Calendar")
    expect(app).toContain("does not persist Google access tokens or refresh tokens")
    expect(app).toContain("does not sell Google user data")
    expect(app).toContain("hello@webcanbe.com")
  })
})
