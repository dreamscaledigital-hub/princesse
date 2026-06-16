ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pensee_sound text NOT NULL DEFAULT 'clochette';
