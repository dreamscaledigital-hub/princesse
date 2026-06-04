CREATE OR REPLACE FUNCTION public.minigame_patch(_room_id uuid, _patch jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _state jsonb;
  _round integer;
  _choice_1 text;
  _choice_2 text;
  _winner integer;
  _level text;
  _dare_count integer;
  _seed text;
  _wheel_index integer;
BEGIN
  SELECT COALESCE(minigame_state, '{}'::jsonb) || COALESCE(_patch, '{}'::jsonb), minigame_round
  INTO _state, _round
  FROM public.rooms
  WHERE id = _room_id
  FOR UPDATE;

  IF _state IS NULL THEN
    RETURN;
  END IF;

  IF _state ->> 'phase' = 'play'
    AND COALESCE((_state ->> 'sent_1')::boolean, false)
    AND COALESCE((_state ->> 'sent_2')::boolean, false)
    AND NULLIF(_state ->> 'choice_1', '') IS NOT NULL
    AND NULLIF(_state ->> 'choice_2', '') IS NOT NULL
  THEN
    _choice_1 := _state ->> 'choice_1';
    _choice_2 := _state ->> 'choice_2';

    IF _choice_1 = _choice_2 THEN
      _winner := 0;
    ELSIF (_choice_1 = 'rock' AND _choice_2 = 'scissors')
       OR (_choice_1 = 'paper' AND _choice_2 = 'rock')
       OR (_choice_1 = 'scissors' AND _choice_2 = 'paper') THEN
      _winner := 1;
    ELSE
      _winner := 2;
    END IF;

    IF _winner = 0 THEN
      _state := jsonb_set(_state, '{phase}', to_jsonb('reveal'::text), true);
    ELSE
      _level := COALESCE(NULLIF(_state ->> 'level', ''), 'easy');
      _dare_count := CASE _level
        WHEN 'hard' THEN 6
        ELSE 7
      END;
      _seed := _room_id::text || '-' || COALESCE(_round, 0)::text || '-' || _level || '-' || _choice_1 || '-' || _choice_2 || '-' || _winner::text;
      _wheel_index := ((('x' || substr(md5(_seed), 1, 8))::bit(32)::bigint % _dare_count)::integer);

      _state := _state || jsonb_build_object(
        'phase', 'dare',
        'winner_slot', _winner,
        'wheel_index', _wheel_index
      );
    END IF;
  END IF;

  UPDATE public.rooms
  SET minigame_state = _state
  WHERE id = _room_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.minigame_patch(uuid, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.minigame_patch(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.minigame_patch(uuid, jsonb) TO service_role;