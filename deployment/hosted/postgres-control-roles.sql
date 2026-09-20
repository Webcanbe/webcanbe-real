-- Phase 5 privileged platform-role migration.
-- Apply explicitly as schema owner before enabling the production Control surface.
-- URL obscurity is not an authorization boundary; these roles are enforced server-side.

ALTER TABLE wcb_product_operators
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'admin';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wcb_product_operators_role_check'
      AND conrelid = 'wcb_product_operators'::regclass
  ) THEN
    ALTER TABLE wcb_product_operators
      ADD CONSTRAINT wcb_product_operators_role_check
      CHECK (role IN ('reviewer','admin','bigperson'));
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION wcb_protect_last_bigperson() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.active AND OLD.role = 'bigperson'
     AND (TG_OP = 'DELETE' OR NOT NEW.active OR NEW.role <> 'bigperson') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.wcb_product_operators
      WHERE active AND role = 'bigperson' AND user_id <> OLD.user_id
    ) THEN
      RAISE EXCEPTION 'The final active bigperson cannot be removed or demoted';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END
$$;

DROP TRIGGER IF EXISTS wcb_protect_last_bigperson_trigger ON wcb_product_operators;
CREATE TRIGGER wcb_protect_last_bigperson_trigger
  BEFORE UPDATE OR DELETE ON wcb_product_operators
  FOR EACH ROW EXECUTE FUNCTION wcb_protect_last_bigperson();

CREATE INDEX IF NOT EXISTS wcb_active_operator_roles
  ON wcb_product_operators(role, active);
