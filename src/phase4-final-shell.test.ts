import fs from "node:fs"
import { describe, expect, it } from "vitest"
const app = fs.readFileSync("src/App.tsx","utf8")
const landing = fs.readFileSync("public/wcb-landing/index.html","utf8")
describe("Phase 4 exact dashboard and hero auth bridge", () => {
  it("uses the exact live Ropean dashboard", () => {
    expect(app).toContain('src="https://shadcn-admin-template.ropean.org/"')
    expect(app).toContain('className="ropean-original-dashboard"')
    expect(app).not.toContain('const [pane, setPane] = useState("overview")')
  })
  it("opens auth from the landing without reloading", () => {
    expect(landing).toContain('id="wcb-auth-bridge"')
    expect(landing).toContain('type: "wcb:open-auth"')
    expect(app).toContain('window.addEventListener("message", messageHandler)')
  })
})
