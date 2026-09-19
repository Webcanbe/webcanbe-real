import { spawnSync } from "node:child_process"
import { writeFileSync, rmSync } from "node:fs"
import { join } from "node:path"

const required = ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "VITE_FIREBASE_PROJECT_ID"]
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required Cloudflare build secret: ${key}`)
    process.exit(1)
  }
}

const file = join(process.cwd(), ".cloudflare-deploy-secrets.json")
try {
  writeFileSync(file, JSON.stringify({
    GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    FIREBASE_PROJECT_ID: process.env.VITE_FIREBASE_PROJECT_ID,
  }), { mode: 0o600 })

  const result = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["wrangler", "deploy", "--secrets-file", file],
    { stdio: "inherit", env: process.env },
  )
  process.exitCode = result.status ?? 1
} finally {
  try { rmSync(file, { force: true }) } catch {}
}
