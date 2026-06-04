
-- Custom questions and dares for "Prépare tes pièges" phase
CREATE TABLE public.custom_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  author_slot integer NOT NULL,
  text text NOT NULL,
  correct_answer text NOT NULL,
  wrongs jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_questions TO anon, authenticated;
GRANT ALL ON public.custom_questions TO service_role;
ALTER TABLE public.custom_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read custom_questions" ON public.custom_questions FOR SELECT USING (true);
CREATE POLICY "public insert custom_questions" ON public.custom_questions FOR INSERT WITH CHECK (true);
CREATE POLICY "public update custom_questions" ON public.custom_questions FOR UPDATE USING (true);
CREATE POLICY "public delete custom_questions" ON public.custom_questions FOR DELETE USING (true);

CREATE TABLE public.custom_dares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  author_slot integer NOT NULL,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_dares TO anon, authenticated;
GRANT ALL ON public.custom_dares TO service_role;
ALTER TABLE public.custom_dares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read custom_dares" ON public.custom_dares FOR SELECT USING (true);
CREATE POLICY "public insert custom_dares" ON public.custom_dares FOR INSERT WITH CHECK (true);
CREATE POLICY "public update custom_dares" ON public.custom_dares FOR UPDATE USING (true);
CREATE POLICY "public delete custom_dares" ON public.custom_dares FOR DELETE USING (true);

-- Track who is "ready" in the secrets phase
ALTER TABLE public.rooms ADD COLUMN secrets_ready jsonb NOT NULL DEFAULT '[]'::jsonb;
-- Mixed turn plan for phase 2
ALTER TABLE public.rooms ADD COLUMN turn_plan jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER PUBLICATION supabase_realtime ADD TABLE public.custom_questions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.custom_dares;
