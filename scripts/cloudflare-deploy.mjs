import { spawnSync } from "node:child_process"

// Runtime secrets are managed on the Worker. keep_vars in wrangler.jsonc keeps
// those values intact, so a source deployment never needs them in the shell.
const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["wrangler", "deploy"],
  { stdio: "inherit", env: process.env },
)
process.exitCode = result.status ?? 1
