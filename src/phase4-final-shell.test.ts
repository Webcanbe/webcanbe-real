import fs from "node:fs"
import { describe, expect, it } from "vitest"

const app=fs.readFileSync("src/App.tsx","utf8")
const css=fs.readFileSync("src/phase4-final-ui.css","utf8")

describe("final Phase 4 shell behavior",()=>{
  it("layers auth over the existing page instead of fabricating a background",()=>{
    expect(app).toContain('window.addEventListener("wcb:open-auth"')
    expect(app).toContain('const basePath = directAuth ? "/" : path')
    expect(app).toContain('authIntent && <Auth')
    expect(app).not.toContain("auth-demo-underlay")
    expect(css).toContain(".auth-demo-layer .auth-demo-backdrop")
    expect(css).toContain("rgba(255,255,255,.98)")
  })

  it("keeps dashboard menu interactions in one shell",()=>{
    expect(app).toContain('const [pane, setPane] = useState("overview")')
    expect(app).toContain("onSectionChange={setPane}")
    expect(app).toContain('pane === "projects"')
    expect(app).toContain('pane === "marketplace"')
    expect(app).toContain('pane === "docs"')
    expect(app).toContain("<details open")
  })
})
