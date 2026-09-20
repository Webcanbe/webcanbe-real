-- Phase 5 production session creation timestamp hardening.
-- Existing DB-backed sessions predate the created_at column. Recover the
-- original issue time from the fixed 7-day production lifetime, then make
-- created_at authoritative for session freshness checks.

ALTER TABLE wcb_sessions
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

UPDATE wcb_sessions
SET created_at = expires_at - interval '7 days'
WHERE created_at IS NULL;

ALTER TABLE wcb_sessions
  ALTER COLUMN created_at SET DEFAULT clock_timestamp();

ALTER TABLE wcb_sessions
  ALTER COLUMN created_at SET NOT NULL;
