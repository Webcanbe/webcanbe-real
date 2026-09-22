BEGIN;

CREATE TABLE IF NOT EXISTS public.wcb_requests (
  request_id uuid PRIMARY KEY,
  request_number text NOT NULL UNIQUE CHECK(request_number ~ '^WCB-REQ-[A-Z0-9]{6}$'),
  requester_user_id uuid,
  requester_email text CHECK(requester_email IS NULL OR length(requester_email) BETWEEN 3 AND 320),
  category text NOT NULL CHECK(category IN (
    'general_support','account_help','seller_support','billing','bug_report','sales',
    'partnership','security_report','privacy_request','refund_request','payment_dispute','payout_issue'
  )),
  subject text NOT NULL CHECK(length(subject) BETWEEN 3 AND 160),
  description text NOT NULL CHECK(length(description) BETWEEN 10 AND 5000),
  status text NOT NULL DEFAULT 'open' CHECK(status IN (
    'open','triaged','in_progress','waiting_on_user','waiting_internal','resolved','closed','reopened'
  )),
  priority text NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
  assigned_operator_user_id uuid,
  workspace_id uuid,
  project_id uuid,
  listing_id uuid REFERENCES public.wcb_listings(listing_id),
  submission_id uuid REFERENCES public.wcb_seller_submissions(submission_id),
  release_id uuid REFERENCES public.wcb_project_releases(release_id),
  order_id uuid REFERENCES public.wcb_orders(order_id),
  subscription_id uuid REFERENCES public.wcb_subscriptions(subscription_id),
  payout_batch_id uuid REFERENCES public.wcb_payout_batches(batch_id),
  safe_context jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(safe_context)='object'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS wcb_requests_requester_idx ON public.wcb_requests(requester_user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS wcb_requests_queue_idx ON public.wcb_requests(status,priority,updated_at DESC);
CREATE INDEX IF NOT EXISTS wcb_requests_assignee_idx ON public.wcb_requests(assigned_operator_user_id,updated_at DESC);

CREATE TABLE IF NOT EXISTS public.wcb_request_events (
  event_id uuid PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.wcb_requests(request_id),
  actor_user_id uuid,
  actor_kind text NOT NULL CHECK(actor_kind IN ('requester','public','operator','system')),
  event_type text NOT NULL CHECK(event_type IN (
    'created','assigned','priority_changed','status_changed','internal_note_added',
    'requester_response_recorded','authoritative_action_linked'
  )),
  visibility text NOT NULL CHECK(visibility IN ('requester','internal')),
  event_data jsonb NOT NULL CHECK(jsonb_typeof(event_data)='object'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS wcb_request_events_request_idx ON public.wcb_request_events(request_id,created_at,event_id);

CREATE OR REPLACE FUNCTION public.wcb_refuse_request_event_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'request history is append-only'; END $$;
DROP TRIGGER IF EXISTS wcb_immutable_request_events ON public.wcb_request_events;
CREATE TRIGGER wcb_immutable_request_events BEFORE UPDATE OR DELETE ON public.wcb_request_events
  FOR EACH ROW EXECUTE FUNCTION public.wcb_refuse_request_event_mutation();

REVOKE ALL ON public.wcb_requests, public.wcb_request_events FROM PUBLIC, anon, authenticated, webcanbe_runtime;
ALTER TABLE public.wcb_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wcb_request_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY wcb_requests_server ON public.wcb_requests TO webcanbe_runtime USING (true) WITH CHECK (true);
CREATE POLICY wcb_request_events_server ON public.wcb_request_events TO webcanbe_runtime USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON public.wcb_requests TO webcanbe_runtime;
GRANT SELECT, INSERT ON public.wcb_request_events TO webcanbe_runtime;

COMMIT;
