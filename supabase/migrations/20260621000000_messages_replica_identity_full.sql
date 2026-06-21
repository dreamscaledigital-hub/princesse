-- Supabase Realtime requires REPLICA IDENTITY FULL on tables using postgres_changes
-- with RLS policies that filter on non-PK columns (e.g. couple_id).
-- Without it, events may be silently dropped for some subscribers.
ALTER TABLE public.messages REPLICA IDENTITY FULL;
