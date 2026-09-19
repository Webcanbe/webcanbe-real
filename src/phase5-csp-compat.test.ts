import fs from "node:fs"
import { describe, expect, it } from "vitest"

const landing = fs.readFileSync("public/wcb-landing/index.html", "utf8")
const root = fs.readFileSync("index.html", "utf8")
const security = fs.readFileSync("worker/security-headers.js", "utf8")

const inlineScriptPattern = /<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi
const remoteRuntimePattern = /(?:src|href)=["']https?:\/\//gi

describe("Phase 5 CSP compatibility inventory", () => {
  it("keeps the retained landing free of runtime scripts and external runtime asset origins", () => {
    expect(landing.match(inlineScriptPattern) ?? []).toHaveLength(0)
    expect(landing.match(/<script\b[^>]*\bsrc=/gi) ?? []).toHaveLength(0)
    expect(landing.match(remoteRuntimePattern) ?? []).toHaveLength(0)
    expect(landing).not.toMatch(/\beval\s*\(/)
    expect(landing).not.toMatch(/new\s+Function\s*\(/)
  })

  it("keeps the React root free of inline scripts", () => {
    expect(root.match(inlineScriptPattern) ?? []).toHaveLength(0)
    expect(root).toContain('<script type="module" src="/src/main.tsx"></script>')
  })

  it("documents why inline styles remain allowed while inline scripts do not", () => {
    expect(landing.match(/<style\b/gi)?.length ?? 0).toBeGreaterThan(0)
    expect(landing.match(/\sstyle=["'][^"']*["']/gi)?.length ?? 0).toBeGreaterThan(0)
    expect(security).toContain('"script-src \'self\'"')
    expect(security).not.toContain('"script-src \'self\' \'unsafe-inline\'"')
    expect(security).toContain('"style-src \'self\' \'unsafe-inline\'"')
  })
})
