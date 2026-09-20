-- Phase 5 operator timestamp hardening.
-- The live Bigperson bootstrap upsert maintains updated_at on authority changes.
-- Backfill existing operator rows before enforcing the column contract.

ALTER TABLE wcb_product_operators
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE wcb_product_operators
SET updated_at = clock_timestamp()
WHERE updated_at IS NULL;

ALTER TABLE wcb_product_operators
  ALTER COLUMN updated_at SET DEFAULT clock_timestamp();

ALTER TABLE wcb_product_operators
  ALTER COLUMN updated_at SET NOT NULL;
