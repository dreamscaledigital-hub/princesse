-- Notification matinale quotidienne
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS daily_notif_enabled boolean NOT NULL DEFAULT true;
