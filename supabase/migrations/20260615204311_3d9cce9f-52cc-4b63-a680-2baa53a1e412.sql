
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_style text NOT NULL DEFAULT 'lorelei',
  ADD COLUMN IF NOT EXISTS avatar_options jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'profiles'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles';
  END IF;
END $$;

ALTER TABLE public.profiles REPLICA IDENTITY FULL;
