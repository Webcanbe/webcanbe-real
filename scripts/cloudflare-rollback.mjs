import { spawnSync } from "node:child_process"

const versionId = process.argv[2] || ""
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(versionId)) {
  console.error("Usage: WEBCANBE_ROLLBACK_CONFIRM=ROLLBACK_PRODUCTION npm run deploy:rollback -- <worker-version-id>")
  process.exit(1)
}

const npx = process.platform === "win32" ? "npx.cmd" : "npx"
const planOnly = process.env.WEBCANBE_ROLLBACK_PLAN_ONLY === "1"

function containsExactVersionId(value, target) {
  if (typeof value === "string") return value.toLowerCase() === target.toLowerCase()
  if (Array.isArray(value)) return value.some((entry) => containsExactVersionId(entry, target))
  if (value && typeof value === "object") {
    return Object.values(value).some((entry) => containsExactVersionId(entry, target))
  }
  return false
}

if (planOnly) {
  const versions = spawnSync(npx, ["wrangler", "versions", "list", "--json"], {
    encoding: "utf8",
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  })

  if (versions.error?.code === "ENOENT") {
    console.error("npx/wrangler is not available.")
    process.exit(1)
  }
  if ((versions.status ?? 1) !== 0) {
    console.error("Unable to read recent Worker versions for rollback planning.")
    process.exit(1)
  }

  let payload
  try {
    payload = JSON.parse(versions.stdout || "")
  } catch {
    console.error("Wrangler versions list did not return valid JSON.")
    process.exit(1)
  }

  if (!containsExactVersionId(payload, versionId)) {
    console.error("Rollback target was not found in the current Wrangler versions list. Do not guess or execute the rollback.")
    process.exit(1)
  }

  console.log(`Rollback target verified in current Worker versions: ${versionId}`)
  console.log("Plan only: no Worker deployment was changed.")
  process.exit(0)
}

if (process.env.WEBCANBE_ROLLBACK_CONFIRM !== "ROLLBACK_PRODUCTION") {
  console.error("Refusing production rollback without WEBCANBE_ROLLBACK_CONFIRM=ROLLBACK_PRODUCTION.")
  process.exit(1)
}

const message = (process.env.WEBCANBE_ROLLBACK_MESSAGE || `Webcanbe operator rollback to ${versionId}`).slice(0, 500)

const result = spawnSync(
  npx,
  ["wrangler", "rollback", versionId, "--message", message],
  { stdio: "inherit", env: process.env },
)

if (result.error?.code === "ENOENT") {
  console.error("npx/wrangler is not available.")
  process.exit(1)
}
process.exitCode = result.status ?? 1
