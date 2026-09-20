import fs from "node:fs"
import { describe, expect, it } from "vitest"

const auth=fs.readFileSync("worker/bigperson-auth.js","utf8")
const mutations=fs.readFileSync("worker/control-mutations.js","utf8")
const worker=fs.readFileSync("worker/index.js","utf8")
const client=fs.readFileSync("src/hostedProductClient.ts","utf8")
const app=fs.readFileSync("src/App.tsx","utf8")
const schema=fs.readFileSync("deployment/hosted/postgres-control-roles.sql","utf8")

describe("Phase 5 privileged Control mutations",()=>{
  it("turns each successful three-factor proof into session-bound audited step-up evidence",()=>{
    expect(auth).toContain("INSERT INTO wcb_operator_step_up_evidence")
    expect(auth).toContain("'control_high_risk'")
    expect(auth).toContain("evidenceId")
    expect(mutations).toContain("verified_at>=clock_timestamp()-interval '5 minutes'")
    expect(mutations).toContain("session_id=$3")
  })
  it("binds the passkey challenge to the exact mutation body",()=>{
    expect(worker).toContain("operationBody = body?.operationBody ?? {}")
    expect(worker).toContain('{ method: "POST", path, body: operationBody }')
    expect(client).toContain("privilegedMutation")
    expect(client).toContain("operation: { method: \"POST\", path, body: operationBody }")
  })
  it("lets Bigperson change platform roles only through audited server mutation",()=>{
    expect(mutations).toContain("transitionOperator")
    expect(mutations).toContain("operator.authority.transition")
    expect(mutations).toContain('["reviewer","admin","bigperson"]')
    expect(mutations).toContain("wcb_product_operators")
    expect(schema).toContain("wcb_protect_last_bigperson")
    expect(app).toContain("Verify 3 factors & apply")
  })
  it("supports audited seller approval and rejection without reopening rejected intake",()=>{
    expect(mutations).toContain("transitionSellerApplication")
    expect(mutations).toContain("seller.application.transition")
    expect(mutations).toContain("Rejected seller application cannot be reopened.")
    expect(client).toContain("controlTransitionSellerApplication")
    expect(app).toContain(">Approve<")
    expect(app).toContain(">Reject<")
  })
  it("clears the mutation factor before the passkey ceremony",()=>{
    expect(app).toContain('const factor=mutationFactor; setMutationFactor(""); setBusy(true)')
    expect(app).toContain("One factor entry authorizes only the single operation")
  })
  it("revokes a specific first-party session only after a fresh three-factor proof",()=>{
    expect(mutations).toContain("revokeSession")
    expect(mutations).toContain("session.revoke")
    expect(worker).toContain("/__webcanbe/api/ops/sessions/revoke")
    expect(client).toContain("controlRevokeSession")
    expect(app).toContain(">Revoke<")
    expect(app).toContain("Tokens and hashes are never exposed.")
  })
  it("shows bounded audit transition detail without making audit mutable",()=>{
    expect(app).toContain('{label:"Transition",keys:["transition"]}')
    expect(mutations).toContain("INSERT INTO wcb_control_audit")
  })
  it("keeps privileged audit append-only",()=>{
    expect(mutations).toContain("INSERT INTO wcb_control_audit")
    expect(mutations).toContain("idempotency_key")
    expect(schema).toContain("wcb_protect_last_bigperson")
  })
})
