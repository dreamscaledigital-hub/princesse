
CREATE TABLE IF NOT EXISTS public.duels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  p1_id text NOT NULL,
  p1_name text NOT NULL DEFAULT 'Joueur 1',
  p2_id text,
  p2_name text,
  gage text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'lobby',
  current_round int NOT NULL DEFAULT 1,
  total_rounds int NOT NULL DEFAULT 5,
  p1_score int NOT NULL DEFAULT 0,
  p2_score int NOT NULL DEFAULT 0,
  signal_at timestamptz,
  round_winner_id text,
  game_winner_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.duels TO anon, authenticated;
GRANT ALL ON public.duels TO service_role;

ALTER TABLE public.duels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "duels open access" ON public.duels FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.duels;
ALTER TABLE public.duels REPLICA IDENTITY FULL;

-- Lance un round : délai aléatoire entre 2000ms et 5500ms avant le signal
CREATE OR REPLACE FUNCTION public.start_duel_round(_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.duels
  SET status = 'ready',
      signal_at = now() + ((2000 + floor(random() * 3500))::int || ' milliseconds')::interval,
      round_winner_id = NULL
  WHERE code = _code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_duel_round(text) TO anon, authenticated;

-- Enregistre un tap : gère faux départ (tap avant signal_at) et victoire (3 points)
CREATE OR REPLACE FUNCTION public.register_tap(_code text, _player_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.duels%ROWTYPE;
  is_p1 boolean;
  new_p1 int;
  new_p2 int;
  winner text;
  game_winner text;
BEGIN
  SELECT * INTO d FROM public.duels WHERE code = _code FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF d.status <> 'ready' THEN RETURN 'too_late'; END IF;

  is_p1 := (d.p1_id = _player_id);
  new_p1 := d.p1_score;
  new_p2 := d.p2_score;

  -- Faux départ : le tap est avant signal_at → l'autre gagne le round
  IF now() < d.signal_at THEN
    IF is_p1 THEN
      new_p2 := new_p2 + 1;
      winner := d.p2_id;
    ELSE
      new_p1 := new_p1 + 1;
      winner := d.p1_id;
    END IF;
  ELSE
    -- Tap valide : le premier qui tape gagne
    IF d.round_winner_id IS NOT NULL THEN RETURN 'lost'; END IF;
    IF is_p1 THEN
      new_p1 := new_p1 + 1;
    ELSE
      new_p2 := new_p2 + 1;
    END IF;
    winner := _player_id;
  END IF;

  -- Victoire finale au premier à 3
  IF new_p1 >= 3 THEN
    game_winner := d.p1_id;
  ELSIF new_p2 >= 3 THEN
    game_winner := d.p2_id;
  ELSE
    game_winner := NULL;
  END IF;

  UPDATE public.duels
  SET p1_score = new_p1,
      p2_score = new_p2,
      round_winner_id = winner,
      game_winner_id = game_winner,
      status = CASE WHEN game_winner IS NOT NULL THEN 'game_over' ELSE 'round_result' END
  WHERE code = _code;

  IF now() < d.signal_at THEN RETURN 'false_start'; END IF;
  IF winner = _player_id THEN RETURN 'won'; END IF;
  RETURN 'lost';
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_tap(text, text) TO anon, authenticated;
