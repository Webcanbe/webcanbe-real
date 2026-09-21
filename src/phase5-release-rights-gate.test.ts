import fs from "node:fs"
import { describe, expect, it } from "vitest"

const schema = fs.readFileSync("deployment/hosted/postgres.sql","utf8")
const migration = fs.readFileSync("deployment/hosted/migrations/202609211920_release_rights_verification.sql","utf8")
const mutations = fs.readFileSync("worker/control-mutations.js","utf8")
const worker = fs.readFileSync("worker/index.js","utf8")
const read = fs.readFileSync("worker/control-read.js","utf8")
const readiness = fs.readFileSync("worker/readiness.js","utf8")
const client = fs.readFileSync("src/hostedProductClient.ts","utf8")
const app = fs.readFileSync("src/App.tsx","utf8")

describe("Phase 5 release publication rights gate", () => {
  it("stores one immutable verified rights record per exact release", () => {
    for (const source of [schema,migration]) {
      expect(source).toContain("wcb_release_rights_verifications")
      expect(source).toContain("release_id uuid NOT NULL UNIQUE")
      expect(source).toContain("FOREIGN KEY(catalog_project_id,release_id)")
      expect(source).toContain("verification_status text NOT NULL CHECK(verification_status='verified')")
      expect(source).toContain("wcb_immutable_release_rights_verification")
    }
    expect(migration).toContain("REVOKE ALL ON TABLE public.wcb_release_rights_verifications FROM PUBLIC, anon, authenticated")
    expect(migration).toContain("GRANT SELECT, INSERT ON TABLE public.wcb_release_rights_verifications TO webcanbe_runtime")
  })

  it("requires a fresh admin-or-Bigperson operation and complete reviewed evidence", () => {
    const slice = mutations.split("export async function verifyReleaseRights",2)[1].split("export async function publishPromotedListing",1)[0]
    expect(slice).toContain('await role(db,session,"admin")')
    expect(slice).toContain("await evidence(db,session,evidenceId)")
    expect(slice).toContain("value.reviewed!==true||value.unresolvedCount!==0")
    expect(slice).toContain("first_party_repo")
    expect(slice).toContain("sellerAttested")
    expect(slice).toContain("openSourceCompatible")
    expect(slice).toContain("release.rights.verify")
    expect(slice).toContain("INSERT INTO wcb_release_rights_verifications")
    expect(slice).toContain("releaseSnapshotHash:String(release.snapshot_hash)")
    expect(slice).toContain("sourceContentHash:String(release.source_content_hash)")
  })

  it("blocks Listing publication unless the promoted release has verified rights evidence", () => {
    const slice = mutations.split("export async function publishPromotedListing",2)[1].split("export async function grantTestEntitlement",1)[0]
    expect(slice).toContain("JOIN wcb_release_rights_verifications")
    expect(slice).toContain('lineage.rights_status==="verified"')
    expect(slice).toContain("rightsVerificationId")
    expect(slice).toContain("Listing publication does not match one promoted immutable release.")
  })

  it("exposes the rights ceremony only through the privileged operation boundary", () => {
    expect(worker).toContain("/__webcanbe/api/ops/releases/rights/verify")
    expect(worker).toContain("verifyReleaseRights")
    expect(client).toContain("controlVerifyReleaseRights")
    expect(client).toContain("/__webcanbe/api/ops/releases/rights/verify")
    expect(app).toContain("Verify release rights")
    expect(app).toContain("Listing publication is blocked")
  })

  it("shows immutable evidence in Control and requires the table in production readiness", () => {
    expect(read).toContain("wcb_release_rights_verifications")
    expect(read).toContain("rights")
    expect(readiness).toContain('"wcb_release_rights_verifications"')
  })
})
