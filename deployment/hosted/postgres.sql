-- PostgreSQL 17+; run as a schema owner during an explicit migration.
-- The API role is server-only. Never expose this database or role to projects.
CREATE TABLE IF NOT EXISTS wcb_sessions (
  session_id uuid PRIMARY KEY, user_id uuid NOT NULL, expires_at timestamptz NOT NULL, active boolean NOT NULL DEFAULT true
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
  user_id uuid PRIMARY KEY, active boolean NOT NULL DEFAULT true, epoch bigint NOT NULL DEFAULT 1
);
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
