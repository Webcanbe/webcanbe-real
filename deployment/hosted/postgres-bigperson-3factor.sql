BEGIN;

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
  UNIQUE(google_issuer, google_subject)
);

CREATE TABLE IF NOT EXISTS wcb_bigperson_passkeys (
  credential_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES wcb_user_profiles(user_id) ON DELETE CASCADE,
  webauthn_user_id text NOT NULL,
  public_key bytea NOT NULL,
  counter bigint NOT NULL DEFAULT 0 CHECK(counter >= 0),
  transports text[] NOT NULL DEFAULT ARRAY[]::text[],
  device_type text NOT NULL,
  backed_up boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_used_at timestamptz
);

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

CREATE INDEX IF NOT EXISTS wcb_bigperson_passkeys_user_idx ON wcb_bigperson_passkeys(user_id,active);
CREATE INDEX IF NOT EXISTS wcb_bigperson_challenges_session_idx ON wcb_bigperson_challenges(session_id,expires_at);

COMMIT;
