-- Phase 5 one-time browser-to-editor session handoff.
-- Tokens are random bearer values that are stored only as SHA-256 digests.
-- They are short-lived, single-use, and bound to the originating DB session,
-- internal user, and exact project. The browser never receives the real
-- __Host-wcb-session token as JavaScript-readable data.
CREATE TABLE IF NOT EXISTS wcb_editor_handoffs (
  token_hash text PRIMARY KEY CHECK(token_hash ~ '^[a-f0-9]{64}$'),
  session_id uuid NOT NULL REFERENCES wcb_sessions(session_id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES wcb_projects(project_id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK(consumed_at IS NULL OR consumed_at >= created_at)
);

CREATE INDEX IF NOT EXISTS wcb_editor_handoffs_session_expiry
  ON wcb_editor_handoffs(session_id, expires_at);

REVOKE ALL PRIVILEGES ON TABLE wcb_editor_handoffs FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE wcb_editor_handoffs TO webcanbe_runtime;
