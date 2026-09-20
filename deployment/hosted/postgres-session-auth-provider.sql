-- Phase 5 DB session auth-provider backfill.
-- Older DB-backed sessions were issued with issuer/subject provenance but
-- omitted auth_provider at the Worker handoff. Restore only known providers.

UPDATE wcb_sessions
SET auth_provider = CASE
  WHEN auth_issuer = 'https://accounts.google.com' THEN 'google'
  WHEN auth_issuer = 'https://securetoken.google.com/webcanbe-b607e' THEN 'firebase'
  ELSE auth_provider
END
WHERE auth_provider IS NULL
  AND auth_issuer IN (
    'https://accounts.google.com',
    'https://securetoken.google.com/webcanbe-b607e'
  );
