import { describe, expect, it } from "vitest"
import fs from "node:fs"

const app = fs.readFileSync("src/App.tsx", "utf8")
const client = fs.readFileSync("src/hostedProductClient.ts", "utf8")
const controller = fs.readFileSync("src/webcanbe-engine/runtime/hostedProductController.ts", "utf8")
const identity = fs.readFileSync("src/webcanbe-engine/runtime/hostedIdentity.ts", "utf8")
const server = fs.readFileSync("src/webcanbe-engine/runtime/hostedEditorServer.ts", "utf8")

describe("Phase 4 public production seams", () => {
  it("serves published catalog reads without requiring a private session", () => {
    expect(client).toContain('this.publicPost<{ listings: HostedListing[] }>("/__webcanbe/api/product/catalog/browse"')
    expect(client).toContain('this.publicPost<{ listing: HostedListingDetail }>("/__webcanbe/api/product/catalog/detail"')
    const publicBranch = controller.indexOf('action === "/catalog/browse" || action === "/catalog/detail"')
    const privateAuth = controller.indexOf('const session = await this.boundary.authenticate(request)')
    expect(publicBranch).toBeGreaterThan(-1)
    expect(privateAuth).toBeGreaterThan(publicBranch)
    expect(controller).toContain('request.headers.origin !== origin')
  })

  it("finishes OIDC on a fixed same-origin completion route and resumes safe browser intent", () => {
    expect(identity).toContain('Location: "/auth/complete"')
    expect(identity).not.toContain('Location: "/workspace/northstar"')
    expect(app).toContain('function AuthComplete()')
    expect(app).toContain('sessionStorage.getItem("wcb-auth-next")')
    expect(app).toMatch(/else if\s*\(basePath\s*===\s*"\/auth\/complete"\)\s*page\s*=\s*<AuthComplete\/>/)
  })

  it("serves intended public and authenticated SPA routes on hard refresh", () => {
    expect(server).toContain(String.raw`auth\/complete`)
    expect(server).toContain("dashboard")
    expect(server).toContain(String.raw`project\/[a-z0-9-]+`)
    expect(server).toContain(String.raw`checkout\/[A-Za-z0-9_.:-]+`)
    expect(server).toContain(String.raw`workspace\/(?:northstar|[a-f0-9-]{36})`)
    expect(server).toContain('spaDocument.test(file)')
  })

  it("hydrates checkout from the real hosted public listing detail", () => {
    expect(app).toContain('void hostedProductClient.detail(reference).then')
    expect(app).toContain('setProject(hostedProject(listing))')
  })
})
