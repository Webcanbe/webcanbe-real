BEGIN;

ALTER TABLE public.wcb_payment_identities
  ADD COLUMN IF NOT EXISTS ai_pack_order_id uuid REFERENCES public.wcb_ai_pack_orders(ai_pack_order_id);

ALTER TABLE public.wcb_ai_purchased_credits
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revocation_reason text CHECK(revocation_reason IN ('refund','dispute'));

CREATE INDEX IF NOT EXISTS wcb_ai_purchased_credits_spendable_user_idx
  ON public.wcb_ai_purchased_credits(user_id,created_at,credit_id)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.wcb_payment_reversals (
  provider text NOT NULL CHECK(provider='paypal'),
  kind text NOT NULL CHECK(kind IN ('refund','dispute')),
  provider_id text NOT NULL,
  provider_capture_id text NOT NULL,
  currency text CHECK(currency IS NULL OR currency='USD'),
  occurred_at timestamptz NOT NULL,
  PRIMARY KEY(provider,kind,provider_id)
);
CREATE INDEX IF NOT EXISTS wcb_payment_reversals_capture_idx
  ON public.wcb_payment_reversals(provider,provider_capture_id,occurred_at);

REVOKE ALL ON public.wcb_payment_reversals FROM PUBLIC, anon, authenticated, webcanbe_runtime;
ALTER TABLE public.wcb_payment_reversals ENABLE ROW LEVEL SECURITY;
CREATE POLICY wcb_payment_reversals_server ON public.wcb_payment_reversals TO webcanbe_runtime USING (true) WITH CHECK (true);
GRANT SELECT, INSERT ON public.wcb_payment_reversals TO webcanbe_runtime;

COMMIT;
