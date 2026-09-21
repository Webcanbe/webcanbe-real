-- Correct production/default-privilege spillover for the release-rights table.
REVOKE ALL ON TABLE public.wcb_release_rights_verifications FROM PUBLIC, anon, authenticated, webcanbe_runtime;
GRANT SELECT, INSERT ON TABLE public.wcb_release_rights_verifications TO webcanbe_runtime;
