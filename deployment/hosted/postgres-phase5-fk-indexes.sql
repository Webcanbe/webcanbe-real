-- Phase 5 foreign-key covering indexes.
-- Generated from the production PostgreSQL foreign-key catalog after the Bigperson schema migration.
-- These indexes support FK maintenance and common provenance joins without changing product authority.

CREATE INDEX IF NOT EXISTS wcb_artifacts_project_idx ON wcb_artifacts(project_id);
CREATE INDEX IF NOT EXISTS wcb_bigperson_challenges_user_idx ON wcb_bigperson_challenges(user_id);
CREATE INDEX IF NOT EXISTS wcb_control_audit_step_up_idx ON wcb_control_audit(step_up_evidence_id);
CREATE INDEX IF NOT EXISTS wcb_deploy_intents_project_idx ON wcb_deploy_intents(project_id);
CREATE INDEX IF NOT EXISTS wcb_editor_capabilities_project_idx ON wcb_editor_capabilities(project_id);
CREATE INDEX IF NOT EXISTS wcb_entitlements_release_idx ON wcb_license_entitlements(release_id);
CREATE INDEX IF NOT EXISTS wcb_listing_publications_catalog_release_idx ON wcb_listing_publications(catalog_project_id, release_id);
CREATE INDEX IF NOT EXISTS wcb_listing_publications_result_idx ON wcb_listing_publications(result_id);
CREATE INDEX IF NOT EXISTS wcb_listings_catalog_release_idx ON wcb_listings(catalog_project_id, release_id);
CREATE INDEX IF NOT EXISTS wcb_step_up_operator_idx ON wcb_operator_step_up_evidence(operator_user_id);
CREATE INDEX IF NOT EXISTS wcb_ready_catalog_release_idx ON wcb_ready_qualifications(catalog_project_id, release_id);
CREATE INDEX IF NOT EXISTS wcb_assessment_leases_worker_idx ON wcb_seller_assessment_leases(worker_id);
CREATE INDEX IF NOT EXISTS wcb_assessment_results_review_idx ON wcb_seller_assessment_results(review_decision_id);
CREATE INDEX IF NOT EXISTS wcb_github_admissions_application_idx ON wcb_seller_github_admissions(seller_application_id);
CREATE INDEX IF NOT EXISTS wcb_github_admissions_source_project_idx ON wcb_seller_github_admissions(source_project_id);
CREATE INDEX IF NOT EXISTS wcb_release_promotions_request_idx ON wcb_seller_release_promotions(assessment_request_id);
CREATE INDEX IF NOT EXISTS wcb_release_promotions_catalog_release_idx ON wcb_seller_release_promotions(catalog_project_id, release_id);
CREATE INDEX IF NOT EXISTS wcb_release_promotions_review_idx ON wcb_seller_release_promotions(review_decision_id);
CREATE INDEX IF NOT EXISTS wcb_release_promotions_submission_idx ON wcb_seller_release_promotions(submission_id);
CREATE INDEX IF NOT EXISTS wcb_seller_submissions_source_project_idx ON wcb_seller_submissions(source_project_id);
CREATE INDEX IF NOT EXISTS wcb_zip_admissions_application_idx ON wcb_seller_zip_admissions(seller_application_id);
