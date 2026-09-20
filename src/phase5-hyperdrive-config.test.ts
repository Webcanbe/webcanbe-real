import fs from "node:fs"
import { describe, expect, it } from "vitest"

const configText = fs.readFileSync("wrangler.jsonc", "utf8")
const config = JSON.parse(configText)

describe("Phase 5 production Hyperdrive configuration", () => {
  it("binds the production Hyperdrive configuration and normal Bigperson vars", () => {
    expect(config.vars?.WEBCANBE_BIGPERSON_GOOGLE_EMAIL).toBe("sihumin196@gmail.com")
    expect(config.vars?.WEBCANBE_CONTROL_MODE).toBe("enabled")
    expect(config.hyperdrive).toContainEqual({
      binding: "HYPERDRIVE",
      id: "7f537011fc1a4303aac7aff9601a1699",
    })
  })

  it("does not commit database credentials or Bigperson secret values as vars", () => {
    expect(config.vars?.WEBCANBE_BIGPERSON_FACTOR_PEPPER).toBeUndefined()
    expect(config.vars?.WEBCANBE_BIGPERSON_BOOTSTRAP_FACTOR_SALT).toBeUndefined()
    expect(config.vars?.WEBCANBE_BIGPERSON_BOOTSTRAP_FACTOR_DIGEST).toBeUndefined()
    expect(configText).not.toMatch(/postgres(?:ql)?:\/\//i)
    expect(configText).not.toMatch(/connection[_-]?string/i)
    expect(configText).not.toMatch(/db[_-]?password|database[_-]?password/i)
  })
})
