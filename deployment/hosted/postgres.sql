-- PostgreSQL 17+; run as a schema owner during an explicit migration.
-- The API role is server-only. Never expose this database or role to projects.
CREATE TABLE IF NOT EXISTS wcb_sessions (
  session_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS wcb_workspace_members (
  workspace_id uuid NOT NULL, user_id uuid NOT NULL, role text NOT NULL CHECK(role IN ('owner','editor','viewer')),
  epoch bigint NOT NULL DEFAULT 1, active boolean NOT NULL DEFAULT true, PRIMARY KEY(workspace_id,user_id)
);
CREATE TABLE IF NOT EXISTS wcb_projects (
  project_id uuid PRIMARY KEY, workspace_id uuid NOT NULL, deleted boolean NOT NULL DEFAULT false,
  revision text, files jsonb, history jsonb, source_epoch bigint NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS wcb_project_members (
  project_id uuid NOT NULL REFERENCES wcb_projects, user_id uuid NOT NULL, role text NOT NULL CHECK(role IN ('owner','editor','viewer')),
  epoch bigint NOT NULL DEFAULT 1, active boolean NOT NULL DEFAULT true, PRIMARY KEY(project_id,user_id)
);
CREATE TABLE IF NOT EXISTS wcb_artifacts (
  workspace_id uuid NOT NULL, project_id uuid NOT NULL REFERENCES wcb_projects, revision text NOT NULL, generation uuid NOT NULL, digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),
  payload jsonb NOT NULL, retired boolean NOT NULL DEFAULT false, PRIMARY KEY(workspace_id,project_id,revision,generation,digest)
);
CREATE TABLE IF NOT EXISTS wcb_runner_pool (id integer PRIMARY KEY CHECK(id=1));
INSERT INTO wcb_runner_pool VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS wcb_runner_leases (
  generation uuid PRIMARY KEY, controller uuid NOT NULL, epoch bigint NOT NULL DEFAULT 1,
  host_id text NOT NULL, owner_json jsonb NOT NULL, request_hash text NOT NULL, session_id uuid NOT NULL, request_key text NOT NULL,
  workspace_id uuid NOT NULL, project_id uuid NOT NULL, deadline timestamptz NOT NULL, lease_until timestamptz NOT NULL,
  state text NOT NULL CHECK(state IN ('allocating','running','stopping','stopped','quarantined')),
  UNIQUE(session_id,request_key)
);
CREATE INDEX IF NOT EXISTS wcb_unsettled_leases ON wcb_runner_leases(state,lease_until);
-- Revocation retains metadata/tombstones so a delayed request cannot resurrect a job/object.
-- Database backup/PITR, encrypted disks, TLS CA, credentials and grants are operator-owned.

CREATE TABLE IF NOT EXISTS wcb_disabled_users (user_id uuid PRIMARY KEY);
ALTER TABLE wcb_sessions ADD COLUMN IF NOT EXISTS token_hash text UNIQUE;
ALTER TABLE wcb_sessions ADD COLUMN IF NOT EXISTS csrf_hash text;
ALTER TABLE wcb_sessions ADD COLUMN IF NOT EXISTS created_at timestamptz;
UPDATE wcb_sessions SET created_at = expires_at - interval '7 days' WHERE created_at IS NULL;
ALTER TABLE wcb_sessions ALTER COLUMN created_at SET DEFAULT clock_timestamp();
ALTER TABLE wcb_sessions ALTER COLUMN created_at SET NOT NULL;
CREATE TABLE IF NOT EXISTS wcb_user_profiles (
  user_id uuid PRIMARY KEY,
  display_name text NOT NULL CHECK(length(display_name) BETWEEN 1 AND 120),
  email text CHECK(email IS NULL OR length(email) BETWEEN 3 AND 320),
  email_verified boolean NOT NULL DEFAULT false,
  picture_url text CHECK(picture_url IS NULL OR length(picture_url) <= 1000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS wcb_identity_accounts (issuer text NOT NULL, subject text NOT NULL, user_id uuid NOT NULL, active boolean NOT NULL DEFAULT true, PRIMARY KEY(issuer,subject));
CREATE TABLE IF NOT EXISTS wcb_login_attempts (state_hash text PRIMARY KEY, binding_hash text NOT NULL, nonce text NOT NULL, verifier text NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS wcb_identity_lock (id integer PRIMARY KEY CHECK(id=1));
INSERT INTO wcb_identity_lock VALUES(1) ON CONFLICT DO NOTHING;

ALTER TABLE wcb_projects ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'Hosted project';
CREATE TABLE IF NOT EXISTS wcb_editor_capabilities (
  preview_id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES wcb_projects,
  token_hash text NOT NULL, grant_json jsonb NOT NULL, expires_at timestamptz NOT NULL,
  revoked boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS wcb_drafts (
  project_id uuid NOT NULL REFERENCES wcb_projects, user_id uuid NOT NULL,
  version bigint NOT NULL, payload jsonb NOT NULL, PRIMARY KEY(project_id,user_id)
);

-- Phase 3 product domain. Listings may move to a different release, but a
-- published release row and its byte-exact source snapshot are immutable.
CREATE TABLE IF NOT EXISTS wcb_catalog_projects (
  catalog_project_id uuid PRIMARY KEY, source_project_id uuid NOT NULL, owner_workspace_id uuid NOT NULL, created_by uuid NOT NULL,
  slug text NOT NULL UNIQUE, title text NOT NULL, summary text NOT NULL,
  status text NOT NULL CHECK(status IN ('active','archived')), public_metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS wcb_project_releases (
  release_id uuid PRIMARY KEY, catalog_project_id uuid NOT NULL REFERENCES wcb_catalog_projects, version text NOT NULL,
  status text NOT NULL CHECK(status='published'), source_project_id uuid NOT NULL, source_revision_id text NOT NULL,
  source_content_hash text NOT NULL CHECK(source_content_hash ~ '^[a-f0-9]{64}$'), snapshot_hash text NOT NULL CHECK(snapshot_hash ~ '^[a-f0-9]{64}$'),
  files jsonb NOT NULL, history jsonb NOT NULL, created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(catalog_project_id,version), UNIQUE(catalog_project_id,release_id)
);
CREATE OR REPLACE FUNCTION wcb_refuse_project_release_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'ProjectRelease is immutable'; END
$$;
DROP TRIGGER IF EXISTS wcb_immutable_project_release ON wcb_project_releases;
CREATE TRIGGER wcb_immutable_project_release BEFORE UPDATE OR DELETE ON wcb_project_releases
  FOR EACH ROW EXECUTE FUNCTION wcb_refuse_project_release_mutation();
CREATE TABLE IF NOT EXISTS wcb_listings (
  listing_id uuid PRIMARY KEY, catalog_project_id uuid NOT NULL, release_id uuid NOT NULL, slug text NOT NULL UNIQUE,
  title text NOT NULL, summary text NOT NULL, status text NOT NULL CHECK(status IN ('draft','published','archived')),
  availability text NOT NULL CHECK(availability IN ('available','unavailable')), tags jsonb NOT NULL DEFAULT '[]', demo_metadata jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(catalog_project_id),
  FOREIGN KEY(catalog_project_id,release_id) REFERENCES wcb_project_releases(catalog_project_id,release_id)
);
CREATE TABLE IF NOT EXISTS wcb_license_entitlements (
  entitlement_id uuid PRIMARY KEY, user_id uuid NOT NULL, release_id uuid NOT NULL REFERENCES wcb_project_releases,
  provider text NOT NULL, provider_reference text NOT NULL UNIQUE, status text NOT NULL CHECK(status IN ('active','revoked','invalid')),
  granted_at timestamptz NOT NULL DEFAULT clock_timestamp(), revoked_at timestamptz, UNIQUE(user_id,release_id,provider)
);
CREATE TABLE IF NOT EXISTS wcb_product_operators (
  user_id uuid PRIMARY KEY,
  active boolean NOT NULL DEFAULT true,
  epoch bigint NOT NULL DEFAULT 1,
  role text NOT NULL DEFAULT 'admin' CHECK(role IN ('reviewer','admin','bigperson')),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE wcb_product_operators ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'admin';
ALTER TABLE wcb_product_operators ADD COLUMN IF NOT EXISTS updated_at timestamptz;
UPDATE wcb_product_operators SET updated_at=clock_timestamp() WHERE updated_at IS NULL;
ALTER TABLE wcb_product_operators ALTER COLUMN updated_at SET DEFAULT clock_timestamp();
ALTER TABLE wcb_product_operators ALTER COLUMN updated_at SET NOT NULL;
DO $
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='wcb_product_operators_role_check' AND conrelid='wcb_product_operators'::regclass) THEN
    ALTER TABLE wcb_product_operators ADD CONSTRAINT wcb_product_operators_role_check CHECK(role IN ('reviewer','admin','bigperson'));
  END IF;
END
$;
CREATE OR REPLACE FUNCTION wcb_protect_last_bigperson() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $
BEGIN
  IF OLD.active AND OLD.role='bigperson' AND (TG_OP='DELETE' OR NOT NEW.active OR NEW.role<>'bigperson') THEN
    IF NOT EXISTS (SELECT 1 FROM public.wcb_product_operators WHERE active AND role='bigperson' AND user_id<>OLD.user_id) THEN
      RAISE EXCEPTION 'The final active bigperson cannot be removed or demoted';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END
$;
DROP TRIGGER IF EXISTS wcb_protect_last_bigperson_trigger ON wcb_product_operators;
CREATE TRIGGER wcb_protect_last_bigperson_trigger BEFORE UPDATE OR DELETE ON wcb_product_operators
  FOR EACH ROW EXECUTE FUNCTION wcb_protect_last_bigperson();
CREATE TABLE IF NOT EXISTS wcb_operator_step_up_evidence (
  evidence_id uuid PRIMARY KEY, operator_user_id uuid NOT NULL REFERENCES wcb_product_operators,
  session_id uuid NOT NULL, authority text NOT NULL CHECK(authority='control_high_risk'),
  verified_at timestamptz NOT NULL, expires_at timestamptz NOT NULL, active boolean NOT NULL DEFAULT true,
  CHECK(expires_at>verified_at)
);
CREATE TABLE IF NOT EXISTS wcb_control_audit (
  audit_id uuid PRIMARY KEY, actor_user_id uuid NOT NULL REFERENCES wcb_product_operators,
  actor_authority text NOT NULL CHECK(actor_authority='product_operator'), action text NOT NULL,
  target_type text NOT NULL, target_id uuid NOT NULL, transition jsonb NOT NULL CHECK(jsonb_typeof(transition)='object'),
  step_up_evidence_id uuid NOT NULL REFERENCES wcb_operator_step_up_evidence,
  idempotency_key text NOT NULL CHECK(idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(actor_user_id,idempotency_key)
);
CREATE OR REPLACE FUNCTION wcb_refuse_control_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Control audit evidence is append-only'; END
$$;
DROP TRIGGER IF EXISTS wcb_immutable_control_audit ON wcb_control_audit;
CREATE TRIGGER wcb_immutable_control_audit BEFORE UPDATE OR DELETE ON wcb_control_audit
  FOR EACH ROW EXECUTE FUNCTION wcb_refuse_control_audit_mutation();
CREATE TABLE IF NOT EXISTS wcb_entitlement_materializations (
  entitlement_id uuid PRIMARY KEY REFERENCES wcb_license_entitlements, workspace_id uuid NOT NULL, user_id uuid NOT NULL,
  workspace_project_id uuid NOT NULL UNIQUE, idempotency_key text NOT NULL, project_name text NOT NULL,
  status text NOT NULL CHECK(status IN ('pending','ready','failed')), attempts integer NOT NULL DEFAULT 0,
  last_error text, created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(user_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS wcb_pending_materializations ON wcb_entitlement_materializations(status,created_at);

-- Seller intake is deliberately separate from catalog/release/listing. An
-- approved seller can freeze an authorized source revision for later review,
-- but this migration creates no execution or publication path for submissions.
CREATE TABLE IF NOT EXISTS wcb_seller_applications (
  application_id uuid PRIMARY KEY, user_id uuid NOT NULL UNIQUE,
  status text NOT NULL CHECK(status IN ('pending','approved','rejected')),
  decision_by uuid, decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS wcb_seller_submissions (
  submission_id uuid PRIMARY KEY, seller_application_id uuid NOT NULL REFERENCES wcb_seller_applications,
  seller_user_id uuid NOT NULL, workspace_id uuid NOT NULL, source_project_id uuid NOT NULL REFERENCES wcb_projects,
  source_revision_id text NOT NULL, source_content_hash text NOT NULL CHECK(source_content_hash ~ '^[a-f0-9]{64}$'),
  snapshot_hash text NOT NULL CHECK(snapshot_hash ~ '^[a-f0-9]{64}$'), files jsonb NOT NULL, history jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(seller_application_id,source_project_id,source_revision_id)
);
CREATE OR REPLACE FUNCTION wcb_refuse_seller_submission_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'SellerSubmission snapshot is immutable'; END
$$;
DROP TRIGGER IF EXISTS wcb_immutable_seller_submission ON wcb_seller_submissions;
CREATE TRIGGER wcb_immutable_seller_submission BEFORE UPDATE OR DELETE ON wcb_seller_submissions
  FOR EACH ROW EXECUTE FUNCTION wcb_refuse_seller_submission_mutation();
CREATE TABLE IF NOT EXISTS wcb_seller_submission_states (
  submission_id uuid PRIMARY KEY REFERENCES wcb_seller_submissions,
  status text NOT NULL CHECK(status='pending_review'), updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS wcb_seller_submission_review_queue ON wcb_seller_submission_states(status,updated_at);
-- ZIP admission is immutable artifact provenance only. Archive members are
-- validated/inflated without execution, then committed through wcb_projects
-- and the same seller-submission quarantine path in one transaction.
CREATE TABLE IF NOT EXISTS wcb_seller_zip_admissions (
  admission_id uuid PRIMARY KEY, archive_id uuid NOT NULL UNIQUE, archive_name text NOT NULL,
  archive_sha256 text NOT NULL CHECK(archive_sha256 ~ '^[a-f0-9]{64}$'), archive_bytes bigint NOT NULL CHECK(archive_bytes>0),
  seller_application_id uuid NOT NULL REFERENCES wcb_seller_applications, seller_user_id uuid NOT NULL,
  workspace_id uuid NOT NULL, source_project_id uuid NOT NULL UNIQUE REFERENCES wcb_projects,
  source_revision_id text NOT NULL, source_content_hash text NOT NULL CHECK(source_content_hash ~ '^[a-f0-9]{64}$'),
  snapshot_hash text NOT NULL CHECK(snapshot_hash ~ '^[a-f0-9]{64}$'),
  submission_id uuid NOT NULL UNIQUE REFERENCES wcb_seller_submissions,
  idempotency_key text NOT NULL CHECK(idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(seller_user_id,archive_sha256), UNIQUE(seller_user_id,idempotency_key)
);
CREATE OR REPLACE FUNCTION wcb_refuse_seller_zip_admission_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'SellerZipAdmission provenance is immutable'; END
$$;
DROP TRIGGER IF EXISTS wcb_immutable_seller_zip_admission ON wcb_seller_zip_admissions;
CREATE TRIGGER wcb_immutable_seller_zip_admission BEFORE UPDATE OR DELETE ON wcb_seller_zip_admissions
  FOR EACH ROW EXECUTE FUNCTION wcb_refuse_seller_zip_admission_mutation();
CREATE TABLE IF NOT EXISTS wcb_seller_github_admissions (
  github_admission_id uuid PRIMARY KEY, zip_admission_id uuid NOT NULL UNIQUE REFERENCES wcb_seller_zip_admissions,
  archive_id uuid NOT NULL, repository text NOT NULL CHECK(repository ~ '^[a-z0-9][a-z0-9-]{0,38}/[a-z0-9][a-z0-9_.-]{0,99}$'),
  commit_sha text NOT NULL CHECK(commit_sha ~ '^[a-f0-9]{40}$'), archive_sha256 text NOT NULL CHECK(archive_sha256 ~ '^[a-f0-9]{64}$'),
  seller_application_id uuid NOT NULL REFERENCES wcb_seller_applications, seller_user_id uuid NOT NULL,
  workspace_id uuid NOT NULL, source_project_id uuid NOT NULL REFERENCES wcb_projects,
  source_revision_id text NOT NULL, source_content_hash text NOT NULL CHECK(source_content_hash ~ '^[a-f0-9]{64}$'),
  snapshot_hash text NOT NULL CHECK(snapshot_hash ~ '^[a-f0-9]{64}$'), submission_id uuid NOT NULL UNIQUE REFERENCES wcb_seller_submissions,
  idempotency_key text NOT NULL CHECK(idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(seller_user_id,repository,commit_sha), UNIQUE(seller_user_id,idempotency_key)
);
CREATE OR REPLACE FUNCTION wcb_refuse_seller_github_admission_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'SellerGitHubAdmission provenance is immutable'; END
$$;
DROP TRIGGER IF EXISTS wcb_immutable_seller_github_admission ON wcb_seller_github_admissions;
CREATE TRIGGER wcb_immutable_seller_github_admission BEFORE UPDATE OR DELETE ON wcb_seller_github_admissions
  FOR EACH ROW EXECUTE FUNCTION wcb_refuse_seller_github_admission_mutation();
CREATE TABLE IF NOT EXISTS wcb_seller_review_decisions (
  decision_id uuid PRIMARY KEY, submission_id uuid NOT NULL UNIQUE REFERENCES wcb_seller_submissions,
  seller_application_id uuid NOT NULL, seller_user_id uuid NOT NULL, source_project_id uuid NOT NULL,
  source_revision_id text NOT NULL, source_content_hash text NOT NULL CHECK(source_content_hash ~ '^[a-f0-9]{64}$'),
  submission_snapshot_hash text NOT NULL CHECK(submission_snapshot_hash ~ '^[a-f0-9]{64}$'),
  decision text NOT NULL CHECK(decision IN ('approved_for_next_stage','rejected')),
  reviewer_user_id uuid NOT NULL, idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(reviewer_user_id,idempotency_key)
);
CREATE OR REPLACE FUNCTION wcb_refuse_seller_review_decision_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'SellerReviewDecision is immutable'; END
$$;
DROP TRIGGER IF EXISTS wcb_immutable_seller_review_decision ON wcb_seller_review_decisions;
CREATE TRIGGER wcb_immutable_seller_review_decision BEFORE UPDATE OR DELETE ON wcb_seller_review_decisions
  FOR EACH ROW EXECUTE FUNCTION wcb_refuse_seller_review_decision_mutation();
-- Admission records only bind an approved immutable snapshot to a future
-- isolated assessment. Execution state belongs to a later, separate boundary.
CREATE TABLE IF NOT EXISTS wcb_seller_assessment_requests (
  assessment_request_id uuid PRIMARY KEY, submission_id uuid NOT NULL UNIQUE REFERENCES wcb_seller_submissions,
  seller_user_id uuid NOT NULL, source_project_id uuid NOT NULL, source_revision_id text NOT NULL,
  source_content_hash text NOT NULL CHECK(source_content_hash ~ '^[a-f0-9]{64}$'),
  submission_snapshot_hash text NOT NULL CHECK(submission_snapshot_hash ~ '^[a-f0-9]{64}$'),
  review_decision_id uuid NOT NULL UNIQUE REFERENCES wcb_seller_review_decisions,
  status text NOT NULL CHECK(status='requested'), admitted_by uuid NOT NULL, idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(admitted_by,idempotency_key)
);
CREATE OR REPLACE FUNCTION wcb_refuse_seller_assessment_request_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'SellerAssessmentRequest is immutable'; END
$$;
DROP TRIGGER IF EXISTS wcb_immutable_seller_assessment_request ON wcb_seller_assessment_requests;
CREATE TRIGGER wcb_immutable_seller_assessment_request BEFORE UPDATE OR DELETE ON wcb_seller_assessment_requests
  FOR EACH ROW EXECUTE FUNCTION wcb_refuse_seller_assessment_request_mutation();
-- Worker provisioning is a server-only seam. Credentials are stored only as
-- digests; browser product routes have no assessment claim endpoint.
CREATE TABLE IF NOT EXISTS wcb_assessment_workers (
  worker_id uuid PRIMARY KEY, credential_hash text NOT NULL CHECK(credential_hash ~ '^[a-f0-9]{64}$'),
  active boolean NOT NULL DEFAULT true, epoch bigint NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS wcb_seller_assessment_leases (
  assessment_request_id uuid PRIMARY KEY REFERENCES wcb_seller_assessment_requests,
  submission_id uuid NOT NULL, seller_user_id uuid NOT NULL, source_project_id uuid NOT NULL,
  source_revision_id text NOT NULL, source_content_hash text NOT NULL CHECK(source_content_hash ~ '^[a-f0-9]{64}$'),
  submission_snapshot_hash text NOT NULL CHECK(submission_snapshot_hash ~ '^[a-f0-9]{64}$'),
  worker_id uuid NOT NULL REFERENCES wcb_assessment_workers, generation bigint NOT NULL CHECK(generation>0),
  claimed_at timestamptz NOT NULL, lease_until timestamptz NOT NULL CHECK(lease_until>claimed_at),
  state text NOT NULL CHECK(state IN ('leased','cancelled','completed')), cancelled_at timestamptz, completed_at timestamptz,
  CHECK((state='leased' AND cancelled_at IS NULL AND completed_at IS NULL) OR (state='cancelled' AND cancelled_at IS NOT NULL AND completed_at IS NULL) OR (state='completed' AND cancelled_at IS NULL AND completed_at IS NOT NULL))
);
ALTER TABLE wcb_seller_assessment_leases ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE wcb_seller_assessment_leases ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE wcb_seller_assessment_leases DROP CONSTRAINT IF EXISTS wcb_seller_assessment_leases_state_check;
ALTER TABLE wcb_seller_assessment_leases ADD CONSTRAINT wcb_seller_assessment_leases_state_check CHECK(state IN ('leased','cancelled','completed'));
ALTER TABLE wcb_seller_assessment_leases DROP CONSTRAINT IF EXISTS wcb_seller_assessment_leases_cancelled_check;
ALTER TABLE wcb_seller_assessment_leases DROP CONSTRAINT IF EXISTS wcb_seller_assessment_leases_terminal_check;
ALTER TABLE wcb_seller_assessment_leases ADD CONSTRAINT wcb_seller_assessment_leases_terminal_check CHECK((state='leased' AND cancelled_at IS NULL AND completed_at IS NULL) OR (state='cancelled' AND cancelled_at IS NOT NULL AND completed_at IS NULL) OR (state='completed' AND cancelled_at IS NULL AND completed_at IS NOT NULL));
CREATE INDEX IF NOT EXISTS wcb_expired_seller_assessment_leases ON wcb_seller_assessment_leases(state,lease_until);
CREATE OR REPLACE FUNCTION wcb_guard_seller_assessment_lease() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.assessment_request_id IS DISTINCT FROM OLD.assessment_request_id OR NEW.submission_id IS DISTINCT FROM OLD.submission_id
    OR NEW.seller_user_id IS DISTINCT FROM OLD.seller_user_id OR NEW.source_project_id IS DISTINCT FROM OLD.source_project_id
    OR NEW.source_revision_id IS DISTINCT FROM OLD.source_revision_id OR NEW.source_content_hash IS DISTINCT FROM OLD.source_content_hash
    OR NEW.submission_snapshot_hash IS DISTINCT FROM OLD.submission_snapshot_hash THEN
    RAISE EXCEPTION 'Assessment lease provenance is immutable';
  END IF;
  IF OLD.state IN ('cancelled','completed') THEN RAISE EXCEPTION 'Terminal assessment lease cannot be changed'; END IF;
  IF NEW.generation < OLD.generation OR NEW.generation > OLD.generation+1 THEN RAISE EXCEPTION 'Invalid assessment lease generation'; END IF;
  RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS wcb_guard_seller_assessment_lease ON wcb_seller_assessment_leases;
CREATE TRIGGER wcb_guard_seller_assessment_lease BEFORE UPDATE OR DELETE ON wcb_seller_assessment_leases
  FOR EACH ROW EXECUTE FUNCTION wcb_guard_seller_assessment_lease();
CREATE TABLE IF NOT EXISTS wcb_seller_assessment_results (
  result_id uuid PRIMARY KEY, assessment_request_id uuid NOT NULL REFERENCES wcb_seller_assessment_requests,
  submission_id uuid NOT NULL, seller_user_id uuid NOT NULL, source_project_id uuid NOT NULL,
  source_revision_id text NOT NULL, source_content_hash text NOT NULL CHECK(source_content_hash ~ '^[a-f0-9]{64}$'),
  submission_snapshot_hash text NOT NULL CHECK(submission_snapshot_hash ~ '^[a-f0-9]{64}$'),
  review_decision_id uuid NOT NULL REFERENCES wcb_seller_review_decisions, admitted_by uuid NOT NULL, admission_created_at timestamptz NOT NULL,
  worker_id uuid NOT NULL REFERENCES wcb_assessment_workers, lease_generation bigint NOT NULL CHECK(lease_generation>0),
  result_status text NOT NULL CHECK(result_status IN ('passed','failed','errored')),
  assessment_metadata jsonb NOT NULL CHECK(jsonb_typeof(assessment_metadata)='object'),
  artifact_refs jsonb NOT NULL CHECK(jsonb_typeof(artifact_refs)='array'),
  result_digest text NOT NULL CHECK(result_digest ~ '^[a-f0-9]{64}$'),
  idempotency_key text NOT NULL CHECK(idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$'), completed_at timestamptz NOT NULL,
  UNIQUE(assessment_request_id,lease_generation), UNIQUE(worker_id,idempotency_key)
);
CREATE OR REPLACE FUNCTION wcb_refuse_seller_assessment_result_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'SellerAssessmentResult is immutable'; END
$$;
DROP TRIGGER IF EXISTS wcb_immutable_seller_assessment_result ON wcb_seller_assessment_results;
CREATE TRIGGER wcb_immutable_seller_assessment_result BEFORE UPDATE OR DELETE ON wcb_seller_assessment_results
  FOR EACH ROW EXECUTE FUNCTION wcb_refuse_seller_assessment_result_mutation();
CREATE TABLE IF NOT EXISTS wcb_seller_release_promotions (
  promotion_id uuid PRIMARY KEY, result_id uuid NOT NULL UNIQUE REFERENCES wcb_seller_assessment_results,
  assessment_request_id uuid NOT NULL REFERENCES wcb_seller_assessment_requests, submission_id uuid NOT NULL REFERENCES wcb_seller_submissions,
  seller_user_id uuid NOT NULL, source_project_id uuid NOT NULL, source_revision_id text NOT NULL,
  source_content_hash text NOT NULL CHECK(source_content_hash ~ '^[a-f0-9]{64}$'),
  submission_snapshot_hash text NOT NULL CHECK(submission_snapshot_hash ~ '^[a-f0-9]{64}$'),
  review_decision_id uuid NOT NULL REFERENCES wcb_seller_review_decisions,
  catalog_project_id uuid NOT NULL, release_id uuid NOT NULL UNIQUE, version text NOT NULL,
  promoted_by uuid NOT NULL REFERENCES wcb_product_operators, idempotency_key text NOT NULL CHECK(idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(promoted_by,idempotency_key),
  FOREIGN KEY(catalog_project_id,release_id) REFERENCES wcb_project_releases(catalog_project_id,release_id)
);
CREATE OR REPLACE FUNCTION wcb_refuse_seller_release_promotion_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'SellerReleasePromotion is immutable'; END
$$;
DROP TRIGGER IF EXISTS wcb_immutable_seller_release_promotion ON wcb_seller_release_promotions;
CREATE TRIGGER wcb_immutable_seller_release_promotion BEFORE UPDATE OR DELETE ON wcb_seller_release_promotions
  FOR EACH ROW EXECUTE FUNCTION wcb_refuse_seller_release_promotion_mutation();
CREATE TABLE IF NOT EXISTS wcb_listing_publications (
  publication_id uuid PRIMARY KEY, promotion_id uuid NOT NULL UNIQUE REFERENCES wcb_seller_release_promotions,
  result_id uuid NOT NULL REFERENCES wcb_seller_assessment_results, seller_user_id uuid NOT NULL,
  catalog_project_id uuid NOT NULL UNIQUE, release_id uuid NOT NULL UNIQUE, listing_id uuid NOT NULL UNIQUE REFERENCES wcb_listings,
  status text NOT NULL CHECK(status='published'), published_by uuid NOT NULL REFERENCES wcb_product_operators,
  idempotency_key text NOT NULL CHECK(idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$'),
  published_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(published_by,idempotency_key),
  FOREIGN KEY(catalog_project_id,release_id) REFERENCES wcb_project_releases(catalog_project_id,release_id)
);
CREATE OR REPLACE FUNCTION wcb_refuse_listing_publication_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'ListingPublication is immutable'; END
$$;
DROP TRIGGER IF EXISTS wcb_immutable_listing_publication ON wcb_listing_publications;
CREATE TRIGGER wcb_immutable_listing_publication BEFORE UPDATE OR DELETE ON wcb_listing_publications
  FOR EACH ROW EXECUTE FUNCTION wcb_refuse_listing_publication_mutation();
CREATE OR REPLACE FUNCTION wcb_guard_published_listing_release() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status='published' AND NEW.release_id IS DISTINCT FROM OLD.release_id THEN
    RAISE EXCEPTION 'Published Listing release binding is immutable';
  END IF;
  RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS wcb_guard_published_listing_release ON wcb_listings;
CREATE TRIGGER wcb_guard_published_listing_release BEFORE UPDATE ON wcb_listings
  FOR EACH ROW EXECUTE FUNCTION wcb_guard_published_listing_release();

-- Ready is immutable release/evidence qualification, never a seller assertion
-- or publication/payment transition.
CREATE TABLE IF NOT EXISTS wcb_ready_qualifications (
  qualification_id uuid PRIMARY KEY, release_id uuid NOT NULL UNIQUE REFERENCES wcb_project_releases,
  catalog_project_id uuid NOT NULL, promotion_id uuid NOT NULL UNIQUE REFERENCES wcb_seller_release_promotions,
  assessment_result_id uuid NOT NULL UNIQUE REFERENCES wcb_seller_assessment_results,
  source_project_id uuid NOT NULL, source_revision_id text NOT NULL,
  source_content_hash text NOT NULL CHECK(source_content_hash ~ '^[a-f0-9]{64}$'),
  snapshot_hash text NOT NULL CHECK(snapshot_hash ~ '^[a-f0-9]{64}$'),
  assessment_result_digest text NOT NULL CHECK(assessment_result_digest ~ '^[a-f0-9]{64}$'),
  qualification_status text NOT NULL CHECK(qualification_status IN ('ready','partial','code_only')),
  compatibility_evidence jsonb NOT NULL CHECK(jsonb_typeof(compatibility_evidence)='object'),
  reasons jsonb NOT NULL CHECK(jsonb_typeof(reasons)='array'),
  qualification_version text NOT NULL CHECK(length(qualification_version) BETWEEN 1 AND 100),
  qualified_by uuid NOT NULL REFERENCES wcb_product_operators,
  idempotency_key text NOT NULL CHECK(idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$'),
  qualified_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(qualified_by,idempotency_key),
  FOREIGN KEY(catalog_project_id,release_id) REFERENCES wcb_project_releases(catalog_project_id,release_id)
);
CREATE OR REPLACE FUNCTION wcb_refuse_ready_qualification_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Ready qualification provenance is immutable'; END
$$;
DROP TRIGGER IF EXISTS wcb_immutable_ready_qualification ON wcb_ready_qualifications;
CREATE TRIGGER wcb_immutable_ready_qualification BEFORE UPDATE OR DELETE ON wcb_ready_qualifications
  FOR EACH ROW EXECUTE FUNCTION wcb_refuse_ready_qualification_mutation();

-- Explicit project membership remains authority. The share row is durable
-- provenance for the bounded grant and allows exact revocation.
CREATE TABLE IF NOT EXISTS wcb_project_shares (
  share_id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES wcb_projects, workspace_id uuid NOT NULL,
  owner_user_id uuid NOT NULL, recipient_user_id uuid NOT NULL,
  permission text NOT NULL CHECK(permission IN ('view','edit')), membership_epoch bigint NOT NULL CHECK(membership_epoch>0),
  workspace_membership_epoch bigint NOT NULL CHECK(workspace_membership_epoch>0),
  idempotency_key text NOT NULL CHECK(idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), revoked_at timestamptz,
  UNIQUE(owner_user_id,idempotency_key), UNIQUE(project_id,recipient_user_id)
);
CREATE OR REPLACE FUNCTION wcb_guard_project_share() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.share_id IS DISTINCT FROM OLD.share_id OR NEW.project_id IS DISTINCT FROM OLD.project_id
    OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
    OR NEW.recipient_user_id IS DISTINCT FROM OLD.recipient_user_id OR NEW.permission IS DISTINCT FROM OLD.permission
    OR NEW.membership_epoch IS DISTINCT FROM OLD.membership_epoch OR NEW.workspace_membership_epoch IS DISTINCT FROM OLD.workspace_membership_epoch
    OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
    OR NEW.created_at IS DISTINCT FROM OLD.created_at OR OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL THEN
    RAISE EXCEPTION 'Project share provenance is immutable';
  END IF;
  RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS wcb_guard_project_share ON wcb_project_shares;
CREATE TRIGGER wcb_guard_project_share BEFORE UPDATE OR DELETE ON wcb_project_shares
  FOR EACH ROW EXECUTE FUNCTION wcb_guard_project_share();

-- Phase-3 deploy is an inert, immutable request contract. Provider execution
-- and credentials are deliberately absent until Phase 5.
CREATE TABLE IF NOT EXISTS wcb_deploy_intents (
  deploy_intent_id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES wcb_projects, workspace_id uuid NOT NULL,
  requested_by uuid NOT NULL, source_revision_id text NOT NULL,
  source_content_hash text NOT NULL CHECK(source_content_hash ~ '^[a-f0-9]{64}$'),
  status text NOT NULL CHECK(status='requested'), history jsonb NOT NULL CHECK(jsonb_typeof(history)='array'),
  idempotency_key text NOT NULL CHECK(idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(requested_by,idempotency_key)
);
CREATE OR REPLACE FUNCTION wcb_refuse_deploy_intent_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Deploy intent provenance is immutable'; END
$$;
DROP TRIGGER IF EXISTS wcb_immutable_deploy_intent ON wcb_deploy_intents;
CREATE TRIGGER wcb_immutable_deploy_intent BEFORE UPDATE OR DELETE ON wcb_deploy_intents
  FOR EACH ROW EXECUTE FUNCTION wcb_refuse_deploy_intent_mutation();


-- Bigperson privileged authentication. Control authorization requires the current
-- Google-authenticated first-party session plus the separate factor and a verified
-- WebAuthn assertion for every privileged operation.
ALTER TABLE wcb_sessions ADD COLUMN IF NOT EXISTS auth_issuer text;
ALTER TABLE wcb_sessions ADD COLUMN IF NOT EXISTS auth_subject text;
ALTER TABLE wcb_sessions ADD COLUMN IF NOT EXISTS auth_provider text;

CREATE TABLE IF NOT EXISTS wcb_bigperson_security (
  user_id uuid PRIMARY KEY REFERENCES wcb_user_profiles(user_id) ON DELETE RESTRICT,
  google_issuer text NOT NULL,
  google_subject text NOT NULL,
  factor_salt text NOT NULL,
  factor_digest text NOT NULL,
  factor_version bigint NOT NULL DEFAULT 1 CHECK(factor_version > 0),
  enrolled_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(google_issuer,google_subject)
);
CREATE TABLE IF NOT EXISTS wcb_bigperson_passkeys (
  credential_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES wcb_user_profiles(user_id) ON DELETE CASCADE,
  webauthn_user_id text NOT NULL,
  public_key bytea NOT NULL,
  counter bigint NOT NULL DEFAULT 0 CHECK(counter>=0),
  transports text[] NOT NULL DEFAULT ARRAY[]::text[],
  device_type text NOT NULL,
  backed_up boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_used_at timestamptz
);
CREATE INDEX IF NOT EXISTS wcb_bigperson_passkeys_user_idx ON wcb_bigperson_passkeys(user_id,active);
CREATE TABLE IF NOT EXISTS wcb_bigperson_challenges (
  challenge_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES wcb_user_profiles(user_id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES wcb_sessions(session_id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK(purpose IN ('register','operation')),
  challenge text NOT NULL,
  operation_method text,
  operation_path text,
  operation_body_hash text,
  factor_verified_at timestamptz NOT NULL,
  pending_factor_salt text,
  pending_factor_digest text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS wcb_bigperson_challenges_session_idx ON wcb_bigperson_challenges(session_id,expires_at);


-- wcb_phase5_fk_covering_indexes
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
