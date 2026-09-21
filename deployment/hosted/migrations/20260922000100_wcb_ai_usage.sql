BEGIN;

ALTER TABLE public.wcb_ai_included_grants ALTER COLUMN subscription_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.wcb_ai_usage_reservations (
  reservation_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.wcb_projects(project_id),
  idempotency_key text NOT NULL CHECK(idempotency_key ~ '^[A-Za-z0-9_-]{8,160}$'),
  cost integer NOT NULL CHECK(cost IN (1,3)),
  expected_revision text NOT NULL CHECK(expected_revision ~ '^rev_[a-f0-9-]{36}$'),
  allocations jsonb NOT NULL CHECK(jsonb_typeof(allocations)='array'),
  status text NOT NULL CHECK(status IN ('reserved','committed','released')),
  outcome jsonb CHECK(outcome IS NULL OR jsonb_typeof(outcome)='object'),
  created_at timestamptz NOT NULL,
  settled_at timestamptz,
  UNIQUE(user_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS wcb_ai_usage_active_user_idx ON public.wcb_ai_usage_reservations(user_id,created_at) WHERE status IN ('reserved','committed');

REVOKE ALL ON public.wcb_ai_usage_reservations FROM PUBLIC, anon, authenticated;
ALTER TABLE public.wcb_ai_usage_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY wcb_ai_usage_reservations_server ON public.wcb_ai_usage_reservations TO webcanbe_runtime USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON public.wcb_ai_usage_reservations TO webcanbe_runtime;

COMMIT;
