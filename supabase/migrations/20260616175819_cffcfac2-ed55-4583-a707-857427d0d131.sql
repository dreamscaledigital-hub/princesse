ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS daily_notif_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pensee_sound text NOT NULL DEFAULT 'clochette';