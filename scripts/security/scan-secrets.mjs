import { readFileSync, statSync } from "node:fs"
import { spawnSync } from "node:child_process"

const SELF = "scripts/security/scan-secrets.mjs"

const listed = spawnSync("git", ["ls-files", "-z"], { encoding: "utf8" })
if (listed.status !== 0) {
  process.stderr.write(listed.stderr || "git ls-files failed\n")
  process.exit(listed.status ?? 1)
}

const files = listed.stdout.split("\0").filter(Boolean)
const findings = []

const forbiddenTrackedPath = path => {
  if (path === ".env.example") return false
  if (path === ".env" || path.startsWith(".env.") || path.endsWith("/.env") || path.includes("/.env.")) return true
  if (path === ".dev.vars" || path.endsWith("/.dev.vars")) return true
  if (path.startsWith("backups/")) return true
  return /\.(?:pem|p12|pfx|dump|backup)$/i.test(path)
}

const placeholderPassword = value => /^(?:PRIVATE|PLACEHOLDER|REPLACE|YOUR|REDACTED|EXAMPLE|PASSWORD|CHANGE_ME|CHANGEME)/i.test(value)

const patterns = [
  ["PEM private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ["GitHub access token", /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g],
  ["Stripe secret key", /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/g],
  ["OpenAI-style secret key", /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g],
]

for (const path of files) {
  if (forbiddenTrackedPath(path)) findings.push({ path, kind: "forbidden secret-bearing file type" })
  if (path === SELF) continue

  let stat
  try { stat = statSync(path) } catch { continue }
  if (!stat.isFile() || stat.size > 10 * 1024 * 1024) continue

  let buffer
  try { buffer = readFileSync(path) } catch { continue }
  if (buffer.includes(0)) continue
  const text = buffer.toString("utf8")

  for (const [kind, regex] of patterns) {
    regex.lastIndex = 0
    if (regex.test(text)) findings.push({ path, kind })
  }

  const dbUrl = /\bpostgres(?:ql)?:\/\/([^:\s"'<>]+):([^@\s"'<>]+)@/gi
  for (const match of text.matchAll(dbUrl)) {
    const password = decodeURIComponent(match[2])
    if (!placeholderPassword(password)) findings.push({ path, kind: "PostgreSQL URL with embedded password" })
  }

  const viteSecret = /\bVITE_[A-Z0-9_]*(?:SECRET|PASSWORD|PRIVATE_KEY|SERVICE_ROLE|ACCESS_TOKEN)[A-Z0-9_]*\b/g
  if (viteSecret.test(text)) findings.push({ path, kind: "server secret exposed through VITE_* variable" })
}

if (findings.length) {
  console.error("Potential committed secrets detected:")
  for (const item of findings) console.error(`- ${item.path}: ${item.kind}`)
  console.error("Remove the credential from Git history/source and rotate it if it was real.")
  process.exit(1)
}

console.log(`Secret scan passed: ${files.length} tracked files checked.`)
