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
