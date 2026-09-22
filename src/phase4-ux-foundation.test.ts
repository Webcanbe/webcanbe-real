import fs from "node:fs"
import { describe, expect, it } from "vitest"

describe("Phase 4 product UX foundation", () => {
  it("loads the Phase 4 layer after the existing application module", () => {
    const main = fs.readFileSync("src/main.tsx", "utf8")
    expect(main).toContain('import App from "./App"')
    expect(main).toContain('import "./phase4-final-ui.css"')
    expect(main.indexOf('import "./phase4-final-ui.css"')).toBeGreaterThan(main.indexOf('import App from "./App"'))
  })

  it("keeps the product system true-white, restrained, responsive and keyboard-visible", () => {
    const css = fs.readFileSync("src/phase4.css", "utf8")
    expect(css).toContain("--bg: #ffffff")
    expect(css).toContain(".product-header")
    expect(css).toContain(".workspace")
    expect(css).toContain(":focus-visible")
    expect(css).toContain("@media (max-width: 720px)")
    expect(css).toContain("@media (prefers-reduced-motion: reduce)")
  })
})
