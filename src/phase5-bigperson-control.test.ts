import fs from "node:fs"
import { describe, expect, it } from "vitest"
import { databaseControlRead } from "../worker/control-read.js"

const app = fs.readFileSync("src/App.tsx", "utf8")
const client = fs.readFileSync("src/hostedProductClient.ts", "utf8")
const worker = fs.readFileSync("worker/index.js", "utf8")
const headers = fs.readFileSync("worker/security-headers.js", "utf8")
const migration = fs.readFileSync("deployment/hosted/postgres-control-roles.sql", "utf8")
const domain = fs.readFileSync("src/webcanbe-engine/runtime/postgresProductDomain.ts", "utf8")
const finalUi = fs.readFileSync("src/phase4-final-ui.css", "utf8")

function db(role?: string) {
  return {
    async query(text: string) {
      if (text.includes("FROM wcb_product_operators WHERE user_id=$1 AND active")) return { rows: role ? [{ user_id:"u", role, active:true, epoch:7 }] : [] }
      if (text.includes("FROM wcb_product_operators WHERE user_id=$1 FOR SHARE")) return { rows: role ? [{ role, active:true, epoch:7 }] : [] }
      return { rows: [] }
    },
  }
}

describe("Phase 5 bigperson Control foundation", () => {
  it("keeps Control off public navigation and the obvious /control route", () => {
    expect(app).not.toContain('item("/control","Control"')
    expect(app).toContain('const BIGPERSON_CONTROL_PATH = "/_ops/keystone-7f31"')
    expect(app).toContain("basePath===BIGPERSON_CONTROL_PATH")
    expect(headers).toContain('"/_ops/keystone-7f31"')
    expect(headers).not.toContain('"/control"')
  })

  it("renders the hidden Admin route as a standalone Operations panel", () => {
    const control = app.slice(app.indexOf("function Control()"), app.indexOf("const BIGPERSON_CONTROL_PATH"))
    expect(control).toContain('className="control-standalone"')
    expect(control).not.toContain("<AppShell>")
    expect(control).not.toContain("RopeanDashboardShell")
    expect(control).not.toContain("site-footer")
    expect(finalUi).toContain(".control-standalone")
    expect(finalUi).toContain("min-height:100vh")
  })

  it("keeps obscurity separate from authorization", () => {
    expect(app).toContain("The path itself is not trusted as authorization")
    expect(worker).toContain('env.WEBCANBE_CONTROL_MODE !== "enabled"')
    expect(worker).toContain("databaseControlRead(db, databaseSession)")
    expect(client).toContain('meta[name="wcb-control-mode"]')
    expect(client).toContain("/__webcanbe/api/ops/control/read")
  })

  it("models reviewer admin and bigperson separately from workspace roles", () => {
    expect(migration).toContain("CHECK (role IN ('reviewer','admin','bigperson'))")
    expect(domain).toContain('minimum: "reviewer" | "admin" | "bigperson"')
    expect(domain).toContain("reviewer: 1, admin: 2, bigperson: 3")
    expect(app).toContain("reviewer → admin → bigperson")
    expect(app).toContain("Workspace owner/editor/viewer roles remain separate")
  })

  it("protects the final active bigperson at the database layer", () => {
    expect(migration).toContain("wcb_protect_last_bigperson")
    expect(migration).toContain("The final active bigperson cannot be removed or demoted")
    expect(domain).toContain('requireControlStepUpIn(client, operator, evidenceId, "bigperson")')
  })

  it("allows bounded Control reads only for active platform operators", async () => {
    await expect(databaseControlRead(db() as never, { userId:"u" } as never)).resolves.toBeUndefined()
    for (const role of ["reviewer","admin","bigperson"]) {
      const value = await databaseControlRead(db(role) as never, { userId:"u" } as never)
      expect(value?.authority).toEqual({ role, epoch:7 })
      expect(value?.operators).toEqual([])
      expect(value?.audit).toEqual([])
    }
  })

  it("exposes the complete current privileged read surface without secrets", () => {
    for (const label of ["Privileged operators","Users","Sessions","Workspaces","Entitlements","Seller applications","Submission pipeline","Reviews","Assessments","Assessment results","Releases","Listings","Webcanbe Ready","Deploy intents","Privileged audit"]) expect(app).toContain(label)
    expect(app).not.toContain("step_up_evidence_id")
    expect(app).not.toContain("token_hash")
  })
})
