
-- 1) Tighten duels INSERT: require owner_user_id = auth.uid()
DROP POLICY IF EXISTS "duels insert authed" ON public.duels;
CREATE POLICY "duels insert owner" ON public.duels
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

-- 2) Add UPDATE policy on chat-photos storage objects for couple members
CREATE POLICY "chat-photos update couple members" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'chat-photos'
    AND (storage.foldername(name))[1]::uuid = public.couple_for_user(auth.uid())
  )
  WITH CHECK (
    bucket_id = 'chat-photos'
    AND (storage.foldername(name))[1]::uuid = public.couple_for_user(auth.uid())
  );
