
-- Messages table for couple private chat
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text,
  image_path text,
  reactions jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_by jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX messages_couple_created_idx ON public.messages (couple_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages read couple members" ON public.messages
  FOR SELECT TO authenticated
  USING (couple_id = public.couple_for_user(auth.uid()));

CREATE POLICY "messages insert by sender in couple" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND couple_id = public.couple_for_user(auth.uid())
  );

CREATE POLICY "messages update couple members" ON public.messages
  FOR UPDATE TO authenticated
  USING (couple_id = public.couple_for_user(auth.uid()))
  WITH CHECK (couple_id = public.couple_for_user(auth.uid()));

CREATE POLICY "messages delete by sender" ON public.messages
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

CREATE TRIGGER messages_touch_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Storage policies for chat-photos bucket (bucket created via tool)
CREATE POLICY "chat-photos read couple members" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-photos'
    AND (storage.foldername(name))[1]::uuid = public.couple_for_user(auth.uid())
  );

CREATE POLICY "chat-photos insert couple members" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-photos'
    AND (storage.foldername(name))[1]::uuid = public.couple_for_user(auth.uid())
    AND owner = auth.uid()
  );

CREATE POLICY "chat-photos delete owner" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'chat-photos' AND owner = auth.uid());
