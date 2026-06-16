
-- Table daily_rituals
CREATE TABLE public.daily_rituals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  ritual_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Europe/Paris')::date,
  question text NOT NULL,
  ambiance text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (couple_id, ritual_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_rituals TO authenticated;
GRANT ALL ON public.daily_rituals TO service_role;

ALTER TABLE public.daily_rituals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rituals select couple" ON public.daily_rituals
  FOR SELECT TO authenticated
  USING (couple_id = public.couple_for_user(auth.uid()));

CREATE POLICY "rituals insert couple" ON public.daily_rituals
  FOR INSERT TO authenticated
  WITH CHECK (couple_id = public.couple_for_user(auth.uid()));

CREATE POLICY "rituals update couple" ON public.daily_rituals
  FOR UPDATE TO authenticated
  USING (couple_id = public.couple_for_user(auth.uid()))
  WITH CHECK (couple_id = public.couple_for_user(auth.uid()));

CREATE INDEX idx_daily_rituals_couple_date ON public.daily_rituals(couple_id, ritual_date DESC);

-- Table daily_entries
CREATE TABLE public.daily_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ritual_id uuid NOT NULL REFERENCES public.daily_rituals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mood_emoji text,
  mood_word text,
  answer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ritual_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_entries TO authenticated;
GRANT ALL ON public.daily_entries TO service_role;

ALTER TABLE public.daily_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entries select couple" ON public.daily_entries
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.daily_rituals r
    WHERE r.id = ritual_id AND r.couple_id = public.couple_for_user(auth.uid())
  ));

CREATE POLICY "entries insert own" ON public.daily_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.daily_rituals r
      WHERE r.id = ritual_id AND r.couple_id = public.couple_for_user(auth.uid())
    )
  );

CREATE POLICY "entries update own" ON public.daily_entries
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "entries delete own" ON public.daily_entries
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER trg_daily_entries_updated
  BEFORE UPDATE ON public.daily_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_daily_entries_ritual ON public.daily_entries(ritual_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_rituals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_entries;
ALTER TABLE public.daily_rituals REPLICA IDENTITY FULL;
ALTER TABLE public.daily_entries REPLICA IDENTITY FULL;

-- Fonction streak : nombre de jours consécutifs (terminant aujourd'hui ou hier)
-- où les DEUX membres du couple ont posté une entrée.
CREATE OR REPLACE FUNCTION public.couple_streak(_couple_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _today date := (now() AT TIME ZONE 'Europe/Paris')::date;
  _check date;
  _streak int := 0;
  _user_a uuid;
  _user_b uuid;
  _ok boolean;
BEGIN
  SELECT user_a, user_b INTO _user_a, _user_b
  FROM public.couples WHERE id = _couple_id;
  IF _user_a IS NULL OR _user_b IS NULL THEN RETURN 0; END IF;

  -- Démarre à aujourd'hui ; si rien aujourd'hui, démarre à hier
  _check := _today;
  SELECT EXISTS (
    SELECT 1 FROM public.daily_rituals r
    WHERE r.couple_id = _couple_id AND r.ritual_date = _check
      AND (SELECT count(DISTINCT e.user_id) FROM public.daily_entries e
           WHERE e.ritual_id = r.id AND e.user_id IN (_user_a, _user_b)) = 2
  ) INTO _ok;
  IF NOT _ok THEN
    _check := _today - 1;
  END IF;

  LOOP
    SELECT EXISTS (
      SELECT 1 FROM public.daily_rituals r
      WHERE r.couple_id = _couple_id AND r.ritual_date = _check
        AND (SELECT count(DISTINCT e.user_id) FROM public.daily_entries e
             WHERE e.ritual_id = r.id AND e.user_id IN (_user_a, _user_b)) = 2
    ) INTO _ok;
    EXIT WHEN NOT _ok;
    _streak := _streak + 1;
    _check := _check - 1;
  END LOOP;

  RETURN _streak;
END;
$$;

GRANT EXECUTE ON FUNCTION public.couple_streak(uuid) TO authenticated;
