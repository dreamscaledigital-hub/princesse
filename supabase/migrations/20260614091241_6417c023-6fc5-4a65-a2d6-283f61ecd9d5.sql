
-- Helpers
CREATE OR REPLACE FUNCTION public.is_room_member(_room_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rooms r
    JOIN public.couples c ON c.id = r.owner_couple_id
    WHERE r.id = _room_id AND auth.uid() IS NOT NULL
      AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_room_code_member(_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rooms r
    JOIN public.couples c ON c.id = r.owner_couple_id
    WHERE r.code = _code AND auth.uid() IS NOT NULL
      AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
  );
$$;

-- ROOMS
DROP POLICY IF EXISTS "public read rooms" ON public.rooms;
DROP POLICY IF EXISTS "public insert rooms" ON public.rooms;
DROP POLICY IF EXISTS "public update rooms" ON public.rooms;
DROP POLICY IF EXISTS "public delete rooms" ON public.rooms;

CREATE POLICY "rooms read members" ON public.rooms FOR SELECT TO authenticated
USING (
  owner_couple_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.couples c WHERE c.id = owner_couple_id
    AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
  )
);
CREATE POLICY "rooms insert by couple member" ON public.rooms FOR INSERT TO authenticated
WITH CHECK (
  owner_couple_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.couples c WHERE c.id = owner_couple_id
    AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
  )
);
CREATE POLICY "rooms update members" ON public.rooms FOR UPDATE TO authenticated
USING (
  owner_couple_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.couples c WHERE c.id = owner_couple_id
    AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
  )
);
CREATE POLICY "rooms delete members" ON public.rooms FOR DELETE TO authenticated
USING (
  owner_couple_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.couples c WHERE c.id = owner_couple_id
    AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
  )
);

-- Generic helper for room-scoped child tables
-- PLAYERS
DROP POLICY IF EXISTS "public read players" ON public.players;
DROP POLICY IF EXISTS "public insert players" ON public.players;
DROP POLICY IF EXISTS "public update players" ON public.players;
DROP POLICY IF EXISTS "public delete players" ON public.players;
CREATE POLICY "players room members read" ON public.players FOR SELECT TO authenticated USING (public.is_room_member(room_id));
CREATE POLICY "players room members insert" ON public.players FOR INSERT TO authenticated WITH CHECK (public.is_room_member(room_id));
CREATE POLICY "players room members update" ON public.players FOR UPDATE TO authenticated USING (public.is_room_member(room_id)) WITH CHECK (public.is_room_member(room_id));
CREATE POLICY "players room members delete" ON public.players FOR DELETE TO authenticated USING (public.is_room_member(room_id));

-- ANSWERS
DROP POLICY IF EXISTS "public read answers" ON public.answers;
DROP POLICY IF EXISTS "public insert answers" ON public.answers;
DROP POLICY IF EXISTS "public update answers" ON public.answers;
DROP POLICY IF EXISTS "public delete answers" ON public.answers;
CREATE POLICY "answers room members read" ON public.answers FOR SELECT TO authenticated USING (public.is_room_member(room_id));
CREATE POLICY "answers room members insert" ON public.answers FOR INSERT TO authenticated WITH CHECK (public.is_room_member(room_id));
CREATE POLICY "answers room members update" ON public.answers FOR UPDATE TO authenticated USING (public.is_room_member(room_id)) WITH CHECK (public.is_room_member(room_id));
CREATE POLICY "answers room members delete" ON public.answers FOR DELETE TO authenticated USING (public.is_room_member(room_id));

-- GUESSES
DROP POLICY IF EXISTS "public read guesses" ON public.guesses;
DROP POLICY IF EXISTS "public insert guesses" ON public.guesses;
DROP POLICY IF EXISTS "public update guesses" ON public.guesses;
DROP POLICY IF EXISTS "public delete guesses" ON public.guesses;
CREATE POLICY "guesses room members read" ON public.guesses FOR SELECT TO authenticated USING (public.is_room_member(room_id));
CREATE POLICY "guesses room members insert" ON public.guesses FOR INSERT TO authenticated WITH CHECK (public.is_room_member(room_id));
CREATE POLICY "guesses room members update" ON public.guesses FOR UPDATE TO authenticated USING (public.is_room_member(room_id)) WITH CHECK (public.is_room_member(room_id));
CREATE POLICY "guesses room members delete" ON public.guesses FOR DELETE TO authenticated USING (public.is_room_member(room_id));

-- CUSTOM_QUESTIONS
DROP POLICY IF EXISTS "public read custom_questions" ON public.custom_questions;
DROP POLICY IF EXISTS "public insert custom_questions" ON public.custom_questions;
DROP POLICY IF EXISTS "public update custom_questions" ON public.custom_questions;
DROP POLICY IF EXISTS "public delete custom_questions" ON public.custom_questions;
CREATE POLICY "cq room members read" ON public.custom_questions FOR SELECT TO authenticated USING (public.is_room_member(room_id));
CREATE POLICY "cq room members insert" ON public.custom_questions FOR INSERT TO authenticated WITH CHECK (public.is_room_member(room_id));
CREATE POLICY "cq room members update" ON public.custom_questions FOR UPDATE TO authenticated USING (public.is_room_member(room_id)) WITH CHECK (public.is_room_member(room_id));
CREATE POLICY "cq room members delete" ON public.custom_questions FOR DELETE TO authenticated USING (public.is_room_member(room_id));

-- CUSTOM_DARES
DROP POLICY IF EXISTS "public read custom_dares" ON public.custom_dares;
DROP POLICY IF EXISTS "public insert custom_dares" ON public.custom_dares;
DROP POLICY IF EXISTS "public update custom_dares" ON public.custom_dares;
DROP POLICY IF EXISTS "public delete custom_dares" ON public.custom_dares;
CREATE POLICY "cd room members read" ON public.custom_dares FOR SELECT TO authenticated USING (public.is_room_member(room_id));
CREATE POLICY "cd room members insert" ON public.custom_dares FOR INSERT TO authenticated WITH CHECK (public.is_room_member(room_id));
CREATE POLICY "cd room members update" ON public.custom_dares FOR UPDATE TO authenticated USING (public.is_room_member(room_id)) WITH CHECK (public.is_room_member(room_id));
CREATE POLICY "cd room members delete" ON public.custom_dares FOR DELETE TO authenticated USING (public.is_room_member(room_id));

-- WISHLIST_ITEMS (room_code based)
DROP POLICY IF EXISTS "public read wishlist_items" ON public.wishlist_items;
DROP POLICY IF EXISTS "public insert wishlist_items" ON public.wishlist_items;
DROP POLICY IF EXISTS "public update wishlist_items" ON public.wishlist_items;
DROP POLICY IF EXISTS "public delete wishlist_items" ON public.wishlist_items;
CREATE POLICY "wl room members read" ON public.wishlist_items FOR SELECT TO authenticated USING (public.is_room_code_member(room_code));
CREATE POLICY "wl room members insert" ON public.wishlist_items FOR INSERT TO authenticated WITH CHECK (public.is_room_code_member(room_code));
CREATE POLICY "wl room members update" ON public.wishlist_items FOR UPDATE TO authenticated USING (public.is_room_code_member(room_code)) WITH CHECK (public.is_room_code_member(room_code));
CREATE POLICY "wl room members delete" ON public.wishlist_items FOR DELETE TO authenticated USING (public.is_room_code_member(room_code));

-- DUELS: add owner_user_id and scope to it
ALTER TABLE public.duels ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.duels ALTER COLUMN owner_user_id SET DEFAULT auth.uid();
DROP POLICY IF EXISTS "duels open access" ON public.duels;
CREATE POLICY "duels owner read" ON public.duels FOR SELECT TO authenticated
USING (
  owner_user_id = auth.uid()
  OR (p1_id IS NOT NULL AND p1_id = auth.uid()::text)
  OR (p2_id IS NOT NULL AND p2_id = auth.uid()::text)
);
CREATE POLICY "duels insert authed" ON public.duels FOR INSERT TO authenticated
WITH CHECK (owner_user_id IS NULL OR owner_user_id = auth.uid());
CREATE POLICY "duels owner update" ON public.duels FOR UPDATE TO authenticated
USING (
  owner_user_id = auth.uid()
  OR (p1_id IS NOT NULL AND p1_id = auth.uid()::text)
  OR (p2_id IS NOT NULL AND p2_id = auth.uid()::text)
);
CREATE POLICY "duels owner delete" ON public.duels FOR DELETE TO authenticated
USING (owner_user_id = auth.uid());

-- Revoke anon access — these tables are couple-private
REVOKE ALL ON public.rooms FROM anon;
REVOKE ALL ON public.players FROM anon;
REVOKE ALL ON public.answers FROM anon;
REVOKE ALL ON public.guesses FROM anon;
REVOKE ALL ON public.custom_questions FROM anon;
REVOKE ALL ON public.custom_dares FROM anon;
REVOKE ALL ON public.wishlist_items FROM anon;
REVOKE ALL ON public.duels FROM anon;
