-- Phase 5 release-rights verification.
-- A release cannot be commercially/publicly published until an admin records
-- immutable evidence that publication/distribution rights were reviewed.
CREATE TABLE IF NOT EXISTS public.wcb_release_rights_verifications (
  verification_id uuid PRIMARY KEY,
  release_id uuid NOT NULL UNIQUE REFERENCES public.wcb_project_releases(release_id),
  catalog_project_id uuid NOT NULL,
  rights_basis text NOT NULL CHECK(rights_basis IN ('first_party_original','seller_rights_reviewed','open_source_compatible')),
  license_expression text NOT NULL CHECK(length(license_expression) BETWEEN 1 AND 200),
  source_evidence jsonb NOT NULL CHECK(jsonb_typeof(source_evidence)='object'),
  dependency_evidence jsonb NOT NULL CHECK(jsonb_typeof(dependency_evidence)='object'),
  asset_evidence jsonb NOT NULL CHECK(jsonb_typeof(asset_evidence)='object'),
  verification_status text NOT NULL CHECK(verification_status='verified'),
  verified_by uuid NOT NULL REFERENCES public.wcb_product_operators(user_id),
  idempotency_key text NOT NULL CHECK(idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$'),
  verified_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(verified_by,idempotency_key),
  FOREIGN KEY(catalog_project_id,release_id) REFERENCES public.wcb_project_releases(catalog_project_id,release_id)
);

CREATE OR REPLACE FUNCTION public.wcb_refuse_release_rights_verification_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'ReleaseRightsVerification is immutable';
END
$$;

DROP TRIGGER IF EXISTS wcb_immutable_release_rights_verification ON public.wcb_release_rights_verifications;
CREATE TRIGGER wcb_immutable_release_rights_verification
BEFORE UPDATE OR DELETE ON public.wcb_release_rights_verifications
FOR EACH ROW EXECUTE FUNCTION public.wcb_refuse_release_rights_verification_mutation();

REVOKE ALL ON TABLE public.wcb_release_rights_verifications FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.wcb_release_rights_verifications TO webcanbe_runtime;
