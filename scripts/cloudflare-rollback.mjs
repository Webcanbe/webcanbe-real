import { spawnSync } from "node:child_process"

const versionId = process.argv[2] || ""
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(versionId)) {
  console.error("Usage: WEBCANBE_ROLLBACK_CONFIRM=ROLLBACK_PRODUCTION npm run deploy:rollback -- <worker-version-id>")
  process.exit(1)
}

const npx = process.platform === "win32" ? "npx.cmd" : "npx"
const planOnly = process.env.WEBCANBE_ROLLBACK_PLAN_ONLY === "1"
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function containsExactVersionId(value, target) {
  if (typeof value === "string") return value.toLowerCase() === target.toLowerCase()
  if (Array.isArray(value)) return value.some((entry) => containsExactVersionId(entry, target))
  if (value && typeof value === "object") {
    return Object.values(value).some((entry) => containsExactVersionId(entry, target))
  }
  return false
}

function collectVersionIds(value, keyPath = "") {
  const found = new Set()
  function visit(entry, path) {
    if (typeof entry === "string") {
      if (path.toLowerCase().includes("version") && uuidPattern.test(entry)) found.add(entry.toLowerCase())
      return
    }
    if (Array.isArray(entry)) {
      for (const item of entry) visit(item, path)
      return
    }
    if (entry && typeof entry === "object") {
      for (const [key, child] of Object.entries(entry)) {
        visit(child, path ? `${path}.${key}` : key)
      }
    }
  }
  visit(value, keyPath)
  return [...found]
}

function readWranglerJson(args, failureMessage, invalidJsonMessage) {
  const result = spawnSync(npx, ["wrangler", ...args, "--json"], {
    encoding: "utf8",
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  })

  if (result.error?.code === "ENOENT") {
    console.error("npx/wrangler is not available.")
    process.exit(1)
  }
  if ((result.status ?? 1) !== 0) {
    console.error(failureMessage)
    process.exit(1)
  }

  try {
    return JSON.parse(result.stdout || "")
  } catch {
    console.error(invalidJsonMessage)
    process.exit(1)
  }
}

function verifyRollbackTarget() {
  const versions = readWranglerJson(
    ["versions", "list"],
    "Unable to read recent Worker versions for rollback planning.",
    "Wrangler versions list did not return valid JSON.",
  )

  if (!containsExactVersionId(versions, versionId)) {
    console.error("Rollback target was not found in the current Wrangler versions list. Do not guess or execute the rollback.")
    process.exit(1)
  }

  const deploymentStatus = readWranglerJson(
    ["deployments", "status"],
    "Unable to read the current Worker deployment status for rollback planning.",
    "Wrangler deployments status did not return valid JSON.",
  )
  const activeVersionIds = collectVersionIds(deploymentStatus)
  if (activeVersionIds.length === 0) {
    console.error("Current Worker deployment status did not expose any version IDs. Do not execute the rollback without current-deployment evidence.")
    process.exit(1)
  }

  console.log(`Rollback target verified in current Worker versions: ${versionId}`)
  console.log(`Current active Worker version ID(s): ${activeVersionIds.join(", ")}`)
  if (activeVersionIds.includes(versionId.toLowerCase())) {
    console.log("Rollback target is already present in the current deployment; inspect traffic allocation before taking action.")
  }
}

if (planOnly) {
  verifyRollbackTarget()
  console.log("Plan only: no Worker deployment was changed.")
  process.exit(0)
}

if (process.env.WEBCANBE_ROLLBACK_CONFIRM !== "ROLLBACK_PRODUCTION") {
  console.error("Refusing production rollback without WEBCANBE_ROLLBACK_CONFIRM=ROLLBACK_PRODUCTION.")
  process.exit(1)
}

// Even an explicitly confirmed rollback must pass the same read-only target/current-deployment
// preflight as plan mode. This prevents a stale or mistyped version from reaching Wrangler rollback.
verifyRollbackTarget()

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
