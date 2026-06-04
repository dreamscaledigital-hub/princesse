
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS complicity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'round1',
  ADD COLUMN IF NOT EXISTS minigame_id text,
  ADD COLUMN IF NOT EXISTS minigame_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS minigame_round integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS finale_scores jsonb NOT NULL DEFAULT '{"1":0,"2":0}'::jsonb;

ALTER TABLE public.custom_dares
  ADD COLUMN IF NOT EXISTS level text NOT NULL DEFAULT 'simple';
