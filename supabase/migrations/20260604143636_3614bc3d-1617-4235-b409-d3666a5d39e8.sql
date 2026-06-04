create or replace function public.increment_tap(_room_id uuid, _slot int, _delta int)
returns void language plpgsql security definer set search_path = public as $$
declare _key text;
begin
  if _slot = 1 then _key := 'taps_1'; else _key := 'taps_2'; end if;
  update public.rooms
  set minigame_state = jsonb_set(
    coalesce(minigame_state, '{}'::jsonb),
    array[_key],
    to_jsonb(coalesce((minigame_state ->> _key)::int, 0) + _delta),
    true
  )
  where id = _room_id;
end;$$;
grant execute on function public.increment_tap(uuid, int, int) to anon, authenticated, service_role;