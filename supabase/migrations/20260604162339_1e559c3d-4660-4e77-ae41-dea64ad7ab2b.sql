CREATE OR REPLACE FUNCTION public.minigame_patch(_room_id uuid, _patch jsonb)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.rooms
  SET minigame_state = COALESCE(minigame_state, '{}'::jsonb) || _patch
  WHERE id = _room_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.minigame_patch(uuid, jsonb) TO anon, authenticated, service_role;