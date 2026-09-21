import { describe, expect, it } from "vitest"
import { safeAuthReturn } from "./authReturn"
describe("same-origin authentication return intent", () => {
  it.each([undefined, null, 1, "https://evil.example/path", "//evil.example/path", "/\\evil.example/path", "/\n/evil.example", "/\t/evil.example"])("rejects unsafe target %j", value => {
    expect(safeAuthReturn(value, "https://webcanbe.com")).toBe("/dashboard")
  })
  it("preserves a direct workspace URL and its query/hash", () => {
    expect(safeAuthReturn("/workspace/project-id?view=code#history", "https://webcanbe.com")).toBe("/workspace/project-id?view=code#history")
  })
})
