
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  phase TEXT NOT NULL DEFAULT 'lobby',
  current_turn INT NOT NULL DEFAULT 0,
  current_player INT NOT NULL DEFAULT 1,
  current_dare TEXT,
  current_dare_for INT,
  score_1 INT NOT NULL DEFAULT 0,
  score_2 INT NOT NULL DEFAULT 0,
  turn_order JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  slot INT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Toi',
  client_id TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(room_id, slot)
);

CREATE TABLE public.answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  player_slot INT NOT NULL,
  question_index INT NOT NULL,
  answer_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(room_id, player_slot, question_index)
);

CREATE TABLE public.guesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  turn_index INT NOT NULL,
  guesser_slot INT NOT NULL,
  chosen_text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(room_id, turn_index)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rooms TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.players TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.answers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guesses TO anon, authenticated;
GRANT ALL ON public.rooms, public.players, public.answers, public.guesses TO service_role;

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read rooms" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "public insert rooms" ON public.rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "public update rooms" ON public.rooms FOR UPDATE USING (true);

CREATE POLICY "public read players" ON public.players FOR SELECT USING (true);
CREATE POLICY "public insert players" ON public.players FOR INSERT WITH CHECK (true);
CREATE POLICY "public update players" ON public.players FOR UPDATE USING (true);

CREATE POLICY "public read answers" ON public.answers FOR SELECT USING (true);
CREATE POLICY "public insert answers" ON public.answers FOR INSERT WITH CHECK (true);
CREATE POLICY "public update answers" ON public.answers FOR UPDATE USING (true);

CREATE POLICY "public read guesses" ON public.guesses FOR SELECT USING (true);
CREATE POLICY "public insert guesses" ON public.guesses FOR INSERT WITH CHECK (true);
CREATE POLICY "public update guesses" ON public.guesses FOR UPDATE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.answers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.guesses;

ALTER TABLE public.rooms REPLICA IDENTITY FULL;
ALTER TABLE public.players REPLICA IDENTITY FULL;
ALTER TABLE public.answers REPLICA IDENTITY FULL;
ALTER TABLE public.guesses REPLICA IDENTITY FULL;
