import fs from "node:fs"
import { describe, expect, it } from "vitest"

const app = fs.readFileSync("src/App.tsx", "utf8")

describe("Phase 5 route and render hardening", () => {
  it("blocks the public dashboard preview on canonical production", () => {
    expect(app).toContain('basePath==="/dashboard-preview"')
    expect(app).toContain('productionAuthMode()?<NotFound path={basePath}/>:<Dashboard/>')
  })

  it("keeps the approved dashboard component unchanged behind the protected route", () => {
    expect(app).toContain('basePath==="/dashboard")page=<Protected><Dashboard/></Protected>')
  })

  it("renders a recoverable 500 surface instead of a blank page on React render failure", () => {
    expect(app).toContain("class AppErrorBoundary extends Component")
    expect(app).toContain("static getDerivedStateFromError()")
    expect(app).toContain('<span className="signal">500</span>')
    expect(app).toContain("window.location.reload()")
    expect(app).toContain("<AppErrorBoundary>")
  })
})
