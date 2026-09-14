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
