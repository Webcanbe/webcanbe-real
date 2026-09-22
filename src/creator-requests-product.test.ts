import fs from "node:fs"
import { describe, expect, it } from "vitest"

const app=fs.readFileSync("src/App.tsx","utf8"), shell=fs.readFileSync("src/app-shell.tsx","utf8"), shellState=fs.readFileSync("src/shellState.ts","utf8"), creator=fs.readFileSync("src/creator-shell.tsx","utf8"), control=fs.readFileSync("src/control-requests.tsx","utf8"), worker=fs.readFileSync("worker/index.js","utf8"), requests=fs.readFileSync("worker/requests.js","utf8"), migration=fs.readFileSync("deployment/hosted/migrations/20260922230000_wcb_requests.sql","utf8")
describe("Creator operating context and Bigperson requests",()=>{
  it("keeps one context switch in the ordinary shell and seller operations in a separate shell",()=>{
    expect(shellState).toContain("Creator Studio");for(const label of ["Listings","Submissions","Sales","Orders","Earnings","Payouts","Analytics","Reviews & Issues","Creator Settings"])expect(shell).not.toContain(`label: \"${label}\"`)
    expect(app).toContain("<CreatorEnvironment path={basePath}/>");expect(creator).toContain("Webcanbe Creator");expect(creator).toContain("Back to Webcanbe")
    for(const route of ["/seller","/seller/projects","/seller/listings","/seller/submissions","/seller/sales","/seller/orders","/seller/earnings","/seller/payouts","/seller/analytics","/seller/issues","/seller/settings","/seller/projects/new"])expect(creator).toContain(route)
  })
  it("renders all application gates and only real approved creator metrics",()=>{
    for(const state of ["Apply to become a creator","Your creator application is in review","Your creator application was not approved","Creator Overview"])expect(creator).toContain(state)
    expect(creator).toContain("Published listings");expect(creator).toContain("In review");expect(creator).toContain("Ready releases");expect(creator).toContain("View analytics unavailable");expect(creator).not.toContain("fake")
  })
  it("provides persisted request queues without lowering linked high-risk authority",()=>{
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.wcb_requests");expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.wcb_request_events");expect(migration).toContain("wcb_immutable_request_events")
    expect(control).toContain("Requests");expect(control).toContain("Internal note");expect(control).toContain("Requester response");expect(worker).toContain("consumeBigpersonOperation")
    expect(requests).not.toMatch(/UPDATE wcb_(orders|listings|product_operators)/)
  })
})
