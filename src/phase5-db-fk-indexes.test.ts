import fs from "node:fs"
import { describe, expect, it } from "vitest"

const migration = fs.readFileSync("deployment/hosted/postgres-phase5-fk-indexes.sql", "utf8")
const schema = fs.readFileSync("deployment/hosted/postgres.sql", "utf8")

const required = [
  "wcb_artifacts(project_id)",
  "wcb_bigperson_challenges(user_id)",
  "wcb_control_audit(step_up_evidence_id)",
  "wcb_deploy_intents(project_id)",
  "wcb_editor_capabilities(project_id)",
  "wcb_license_entitlements(release_id)",
  "wcb_listing_publications(catalog_project_id, release_id)",
  "wcb_listing_publications(result_id)",
  "wcb_listings(catalog_project_id, release_id)",
  "wcb_operator_step_up_evidence(operator_user_id)",
  "wcb_ready_qualifications(catalog_project_id, release_id)",
  "wcb_seller_assessment_leases(worker_id)",
  "wcb_seller_assessment_results(review_decision_id)",
  "wcb_seller_github_admissions(seller_application_id)",
  "wcb_seller_github_admissions(source_project_id)",
  "wcb_seller_release_promotions(assessment_request_id)",
  "wcb_seller_release_promotions(catalog_project_id, release_id)",
  "wcb_seller_release_promotions(review_decision_id)",
  "wcb_seller_release_promotions(submission_id)",
  "wcb_seller_submissions(source_project_id)",
  "wcb_seller_zip_admissions(seller_application_id)",
]

describe("Phase 5 PostgreSQL FK index hardening", () => {
  it("covers every production FK reported by the advisor without destructive DDL", () => {
    expect(migration.match(/CREATE INDEX IF NOT EXISTS/g)?.length).toBe(21)
    for (const target of required) expect(migration.replace(/\s+/g, " ")).toContain(target)
    expect(migration).not.toMatch(/\bDROP\b|\bDELETE\b|\bTRUNCATE\b/i)
  })

  it("keeps the same indexes in the canonical fresh-install schema", () => {
    expect(schema).toContain("wcb_phase5_fk_covering_indexes")
    for (const target of required) expect(schema.replace(/\s+/g, " ")).toContain(target)
  })
})
