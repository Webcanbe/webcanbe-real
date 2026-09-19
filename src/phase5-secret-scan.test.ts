import fs from "node:fs"
import { describe, expect, it } from "vitest"

const scanner = fs.readFileSync("scripts/security/scan-secrets.mjs", "utf8")
const workflow = fs.readFileSync(".github/workflows/phase5-ui-verify.yml", "utf8")
const gitignore = fs.readFileSync(".gitignore", "utf8")

describe("Phase 5 committed-secret guard", () => {
  it("scans tracked files rather than only the current diff", () => {
    expect(scanner).toContain('spawnSync("git", ["ls-files", "-z"]')
    expect(scanner).toContain("for (const path of files)")
  })

  it("blocks explicit credential-bearing files and common live-token formats", () => {
    expect(scanner).toContain("PEM private key")
    expect(scanner).toContain("GitHub access token")
    expect(scanner).toContain("Stripe secret key")
    expect(scanner).toContain("OpenAI-style secret key")
    expect(scanner).toContain("Slack token")
    expect(scanner).toContain("PostgreSQL URL with embedded password")
    expect(scanner).toContain("server secret exposed through VITE_* variable")
  })

  it("allows documented placeholders without allowing arbitrary DB passwords", () => {
    expect(scanner).toContain("placeholderPassword")
    expect(scanner).toContain("PRIVATE")
    expect(scanner).toContain("REDACTED")
    expect(scanner).toContain("CHANGE_ME")
  })

  it("limits VITE_* fixture exceptions to historical Phase 2 tests/evidence only", () => {
    expect(scanner).toContain('path.startsWith("docs/reports/phase2-")')
    expect(scanner).toContain('/^src\\/webcanbe-engine\\/phase2-[^/]*\\.test\\.(?:ts|js)$/')
    expect(scanner).toContain("viteSecretSource")
    expect(scanner).toContain("!viteSecretFixture && viteSecretSource && viteSecret.test(text)")
    expect(scanner).toContain("Prose docs may")
    // The fixture/source scoping comes after these scans, so actual secrets remain active everywhere.
    expect(scanner.indexOf("PEM private key")).toBeLessThan(scanner.indexOf("viteSecretFixture"))
    expect(scanner.indexOf("PostgreSQL URL with embedded password")).toBeLessThan(scanner.indexOf("viteSecretFixture"))
  })

  it("runs the scanner in CI and ignores common local secret artifacts", () => {
    expect(workflow).toContain("npm run security:secrets")
    expect(gitignore).toContain(".env.local")
    expect(gitignore).toContain("*.pem")
    expect(gitignore).toContain("*.p12")
    expect(gitignore).toContain("*.pfx")
    expect(gitignore).toContain("*.dump")
  })
})
