import { spawnSync } from "node:child_process"

const versionId = process.argv[2] || ""
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(versionId)) {
  console.error("Usage: WEBCANBE_ROLLBACK_CONFIRM=ROLLBACK_PRODUCTION npm run deploy:rollback -- <worker-version-id>")
  process.exit(1)
}

if (process.env.WEBCANBE_ROLLBACK_CONFIRM !== "ROLLBACK_PRODUCTION") {
  console.error("Refusing production rollback without WEBCANBE_ROLLBACK_CONFIRM=ROLLBACK_PRODUCTION.")
  process.exit(1)
}

const message = (process.env.WEBCANBE_ROLLBACK_MESSAGE || `Webcanbe operator rollback to ${versionId}`).slice(0, 500)

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["wrangler", "rollback", versionId, "--message", message],
  { stdio: "inherit", env: process.env },
)

if (result.error?.code === "ENOENT") {
  console.error("npx/wrangler is not available.")
  process.exit(1)
}
process.exitCode = result.status ?? 1
