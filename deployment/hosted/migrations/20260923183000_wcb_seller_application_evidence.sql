BEGIN;

CREATE TABLE IF NOT EXISTS public.wcb_seller_application_evidence (
  application_id uuid PRIMARY KEY REFERENCES public.wcb_seller_applications(application_id),
  seller_user_id uuid NOT NULL,
  contact_email text NOT NULL CHECK(length(contact_email) BETWEEN 3 AND 320),
  github_url text NOT NULL CHECK(length(github_url) BETWEEN 19 AND 500),
  archive_name text NOT NULL CHECK(length(archive_name) BETWEEN 5 AND 255),
  archive_sha256 text NOT NULL CHECK(archive_sha256 ~ '^[a-f0-9]{64}$'),
  archive_bytes bigint NOT NULL CHECK(archive_bytes BETWEEN 1 AND 10485760),
  archive bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(seller_user_id)
);

CREATE OR REPLACE FUNCTION public.wcb_refuse_seller_application_evidence_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'seller application evidence is immutable'; END $$;
DROP TRIGGER IF EXISTS wcb_immutable_seller_application_evidence ON public.wcb_seller_application_evidence;
CREATE TRIGGER wcb_immutable_seller_application_evidence BEFORE UPDATE OR DELETE ON public.wcb_seller_application_evidence
  FOR EACH ROW EXECUTE FUNCTION public.wcb_refuse_seller_application_evidence_mutation();

ALTER TABLE public.wcb_seller_application_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wcb_seller_application_evidence FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.wcb_seller_application_evidence TO webcanbe_runtime;
CREATE POLICY wcb_seller_evidence_runtime_select ON public.wcb_seller_application_evidence FOR SELECT TO webcanbe_runtime USING (true);
CREATE POLICY wcb_seller_evidence_runtime_insert ON public.wcb_seller_application_evidence FOR INSERT TO webcanbe_runtime WITH CHECK (true);
REVOKE ALL ON FUNCTION public.wcb_refuse_seller_application_evidence_mutation() FROM PUBLIC, anon, authenticated;

COMMIT;
