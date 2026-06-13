-- 1. Restrict pairing_codes SELECT to creator or consumer
DROP POLICY IF EXISTS "pairing_codes read all auth" ON public.pairing_codes;
CREATE POLICY "pairing_codes read own"
  ON public.pairing_codes
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid() OR consumed_by = auth.uid());

-- 2. Restrict pairing_codes UPDATE to unconsumed rows, claiming as self.
-- Note: consume_pairing_code() is SECURITY DEFINER so it bypasses this and keeps working.
DROP POLICY IF EXISTS "pairing_codes update consume" ON public.pairing_codes;
CREATE POLICY "pairing_codes update consume"
  ON public.pairing_codes
  FOR UPDATE
  TO authenticated
  USING (consumed_at IS NULL AND created_by <> auth.uid())
  WITH CHECK (consumed_by = auth.uid());

-- 3. Remove couples from Realtime publication to stop broadcasting
-- membership changes to all subscribers. The hub already has a 4s poll fallback.
ALTER PUBLICATION supabase_realtime DROP TABLE public.couples;

-- 4. Lock down search_path on the only function still missing it.
ALTER FUNCTION public.touch_updated_at() SET search_path = public;