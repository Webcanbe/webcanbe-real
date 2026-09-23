BEGIN;

CREATE TABLE IF NOT EXISTS public.wcb_build_league_participants (
  user_id uuid PRIMARY KEY,
  referral_code text NOT NULL UNIQUE CHECK (referral_code ~ '^[a-z0-9]{12}$'),
  referred_by uuid REFERENCES public.wcb_build_league_participants(user_id),
  joined_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (referred_by IS DISTINCT FROM user_id)
);
CREATE INDEX IF NOT EXISTS wcb_build_league_referrer_idx ON public.wcb_build_league_participants(referred_by);

CREATE TABLE IF NOT EXISTS public.wcb_build_league_events (
  event_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.wcb_build_league_participants(user_id),
  kind text NOT NULL CHECK (length(kind) BETWEEN 3 AND 48),
  project_id uuid,
  event_key text NOT NULL CHECK (length(event_key) BETWEEN 1 AND 160),
  source text NOT NULL CHECK (source IN ('client','product','referral')),
  points integer NOT NULL DEFAULT 0 CHECK (points BETWEEN 0 AND 30),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(user_id,kind,event_key)
);
CREATE INDEX IF NOT EXISTS wcb_build_league_events_user_idx ON public.wcb_build_league_events(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS wcb_build_league_events_kind_idx ON public.wcb_build_league_events(kind,user_id);

CREATE TABLE IF NOT EXISTS public.wcb_build_league_visits (
  referrer_user_id uuid NOT NULL REFERENCES public.wcb_build_league_participants(user_id),
  visitor_hash text NOT NULL CHECK (visitor_hash ~ '^[a-f0-9]{64}$'),
  first_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(referrer_user_id,visitor_hash)
);

CREATE TABLE IF NOT EXISTS public.wcb_build_league_entries (
  user_id uuid PRIMARY KEY REFERENCES public.wcb_build_league_participants(user_id),
  project_id uuid NOT NULL,
  statement text NOT NULL CHECK (length(statement) BETWEEN 20 AND 1000),
  submitted_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE OR REPLACE FUNCTION public.wcb_build_league_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'Build League evidence is append-only'; END $$;
DROP TRIGGER IF EXISTS wcb_build_league_events_immutable ON public.wcb_build_league_events;
CREATE TRIGGER wcb_build_league_events_immutable BEFORE UPDATE OR DELETE ON public.wcb_build_league_events FOR EACH ROW EXECUTE FUNCTION public.wcb_build_league_immutable();
DROP TRIGGER IF EXISTS wcb_build_league_visits_immutable ON public.wcb_build_league_visits;
CREATE TRIGGER wcb_build_league_visits_immutable BEFORE UPDATE OR DELETE ON public.wcb_build_league_visits FOR EACH ROW EXECUTE FUNCTION public.wcb_build_league_immutable();
DROP TRIGGER IF EXISTS wcb_build_league_entries_immutable ON public.wcb_build_league_entries;
CREATE TRIGGER wcb_build_league_entries_immutable BEFORE UPDATE OR DELETE ON public.wcb_build_league_entries FOR EACH ROW EXECUTE FUNCTION public.wcb_build_league_immutable();

REVOKE ALL ON public.wcb_build_league_participants, public.wcb_build_league_events, public.wcb_build_league_visits, public.wcb_build_league_entries FROM PUBLIC, anon, authenticated;
ALTER TABLE public.wcb_build_league_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wcb_build_league_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wcb_build_league_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wcb_build_league_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY wcb_build_league_participants_server ON public.wcb_build_league_participants TO webcanbe_runtime USING (true) WITH CHECK (true);
CREATE POLICY wcb_build_league_events_server ON public.wcb_build_league_events TO webcanbe_runtime USING (true) WITH CHECK (true);
CREATE POLICY wcb_build_league_visits_server ON public.wcb_build_league_visits TO webcanbe_runtime USING (true) WITH CHECK (true);
CREATE POLICY wcb_build_league_entries_server ON public.wcb_build_league_entries TO webcanbe_runtime USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON public.wcb_build_league_participants TO webcanbe_runtime;
GRANT SELECT, INSERT ON public.wcb_build_league_events, public.wcb_build_league_visits, public.wcb_build_league_entries TO webcanbe_runtime;
COMMIT;
