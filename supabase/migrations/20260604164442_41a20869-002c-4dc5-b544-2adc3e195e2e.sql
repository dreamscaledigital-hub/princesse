CREATE OR REPLACE FUNCTION public.minigame_patch(_room_id uuid, _patch jsonb)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.rooms
  SET minigame_state = (
    WITH merged AS (
      SELECT COALESCE(minigame_state, '{}'::jsonb) || COALESCE(_patch, '{}'::jsonb) AS state
    )
    SELECT CASE
      WHEN state ->> 'phase' = 'play'
        AND COALESCE((state ->> 'sent_1')::boolean, false)
        AND COALESCE((state ->> 'sent_2')::boolean, false)
        AND NULLIF(state ->> 'choice_1', '') IS NOT NULL
        AND NULLIF(state ->> 'choice_2', '') IS NOT NULL
      THEN jsonb_set(state, '{phase}', to_jsonb('reveal'::text), true)
      ELSE state
    END
    FROM merged
  )
  WHERE id = _room_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.minigame_patch(uuid, jsonb) TO anon, authenticated, service_role;