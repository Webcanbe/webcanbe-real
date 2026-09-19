-- Phase 5 account profile persistence.
-- Provider identity mapping remains issuer+subject; email is never used as an automatic account-linking authority.

CREATE TABLE IF NOT EXISTS wcb_user_profiles (
  user_id uuid PRIMARY KEY,
  display_name text NOT NULL CHECK(length(display_name) BETWEEN 1 AND 120),
  email text CHECK(email IS NULL OR length(email) BETWEEN 3 AND 320),
  email_verified boolean NOT NULL DEFAULT false,
  picture_url text CHECK(picture_url IS NULL OR length(picture_url) <= 1000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

REVOKE ALL PRIVILEGES ON TABLE wcb_user_profiles FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE wcb_user_profiles TO webcanbe_runtime;
