import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"

const legal = JSON.parse(readFileSync(new URL("../src/public/content/legal-review-3.json", import.meta.url), "utf8"))
const unresolved = [...new Set(Object.values(legal).flatMap(page => page.unresolvedFields || []))].sort()
if (unresolved.length || Object.values(legal).some(page => page.publicationBlocked)) {
  console.error(`Legal publication blocked: ${unresolved.join(", ")}`)
  process.exit(1)
}

// Runtime secrets are managed on the Worker. keep_vars in wrangler.jsonc keeps
// those values intact, so a source deployment never needs them in the shell.
const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["wrangler", "deploy"],
  { stdio: "inherit", env: process.env },
)
process.exitCode = result.status ?? 1
