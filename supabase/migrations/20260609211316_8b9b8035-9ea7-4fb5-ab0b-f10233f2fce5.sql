
-- Profiles (1 row per auth user)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Mon amour',
  avatar_emoji text NOT NULL DEFAULT '💕',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Couples
CREATE TABLE public.couples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT couples_distinct CHECK (user_a <> user_b),
  CONSTRAINT couples_unique_a UNIQUE (user_a),
  CONSTRAINT couples_unique_b UNIQUE (user_b)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.couples TO authenticated;
GRANT ALL ON public.couples TO service_role;
ALTER TABLE public.couples ENABLE ROW LEVEL SECURITY;

-- Helper: is uid in a couple with given other user?
CREATE OR REPLACE FUNCTION public.couple_for_user(_uid uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.couples WHERE user_a = _uid OR user_b = _uid LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.partner_of(_uid uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN user_a = _uid THEN user_b ELSE user_a END
  FROM public.couples WHERE user_a = _uid OR user_b = _uid LIMIT 1;
$$;

-- Pairing codes (one-time use, 15min ttl)
CREATE TABLE public.pairing_codes (
  code text PRIMARY KEY,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  consumed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  consumed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pairing_codes TO authenticated;
GRANT ALL ON public.pairing_codes TO service_role;
ALTER TABLE public.pairing_codes ENABLE ROW LEVEL SECURITY;

-- Push subscriptions
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Add owner_couple_id to rooms (nullable; existing rooms stay anonymous-compatible)
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS owner_couple_id uuid REFERENCES public.couples(id) ON DELETE SET NULL;

-- RLS POLICIES

-- profiles: user sees own + partner's profile; can update only own.
CREATE POLICY "profiles read self or partner" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR id = public.partner_of(auth.uid())
  );
CREATE POLICY "profiles insert self" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "profiles update self" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- couples: members can read/update/delete their couple; insert via consume-code function only (still allow self-insert with own uid as one side, for fallback)
CREATE POLICY "couples read members" ON public.couples
  FOR SELECT TO authenticated
  USING (user_a = auth.uid() OR user_b = auth.uid());
CREATE POLICY "couples insert by member" ON public.couples
  FOR INSERT TO authenticated
  WITH CHECK (user_a = auth.uid() OR user_b = auth.uid());
CREATE POLICY "couples update members" ON public.couples
  FOR UPDATE TO authenticated
  USING (user_a = auth.uid() OR user_b = auth.uid())
  WITH CHECK (user_a = auth.uid() OR user_b = auth.uid());
CREATE POLICY "couples delete members" ON public.couples
  FOR DELETE TO authenticated
  USING (user_a = auth.uid() OR user_b = auth.uid());

-- pairing_codes: creator can manage; anyone authenticated can read by code (to consume); consumer updates the row.
CREATE POLICY "pairing_codes read all auth" ON public.pairing_codes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "pairing_codes insert self" ON public.pairing_codes
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "pairing_codes update consume" ON public.pairing_codes
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "pairing_codes delete creator" ON public.pairing_codes
  FOR DELETE TO authenticated USING (created_by = auth.uid());

-- push_subscriptions: strictly self
CREATE POLICY "push read self" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "push insert self" ON public.push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "push update self" ON public.push_subscriptions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "push delete self" ON public.push_subscriptions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1), 'Mon amour')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger for profiles
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER profiles_touch_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Atomic pair function: consume a code, create a couple
CREATE OR REPLACE FUNCTION public.consume_pairing_code(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.pairing_codes;
  _couple_id uuid;
  _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  -- Already in a couple?
  SELECT id INTO _couple_id FROM public.couples WHERE user_a = _me OR user_b = _me LIMIT 1;
  IF _couple_id IS NOT NULL THEN RETURN _couple_id; END IF;

  SELECT * INTO _row FROM public.pairing_codes
   WHERE code = upper(_code) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'code introuvable'; END IF;
  IF _row.consumed_by IS NOT NULL THEN RAISE EXCEPTION 'code déjà utilisé'; END IF;
  IF _row.expires_at < now() THEN RAISE EXCEPTION 'code expiré'; END IF;
  IF _row.created_by = _me THEN RAISE EXCEPTION 'c''est ton propre code'; END IF;

  -- Is creator already paired?
  IF EXISTS (SELECT 1 FROM public.couples WHERE user_a = _row.created_by OR user_b = _row.created_by) THEN
    RAISE EXCEPTION 'l''autre personne est déjà appairée';
  END IF;

  INSERT INTO public.couples (user_a, user_b) VALUES (_row.created_by, _me)
  RETURNING id INTO _couple_id;

  UPDATE public.pairing_codes SET consumed_by = _me, consumed_at = now() WHERE code = _row.code;

  RETURN _couple_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.consume_pairing_code(text) TO authenticated;
