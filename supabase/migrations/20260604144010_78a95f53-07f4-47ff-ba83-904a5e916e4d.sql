-- 1) Drop elevated privileges from increment_tap; rooms already allows public update via RLS.
create or replace function public.increment_tap(_room_id uuid, _slot int, _delta int)
returns void language plpgsql security invoker set search_path = public as $$
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

-- 2) Allow cleanup of session data.
create policy "public delete rooms" on public.rooms for delete using (true);
create policy "public delete players" on public.players for delete using (true);
create policy "public delete answers" on public.answers for delete using (true);
create policy "public delete guesses" on public.guesses for delete using (true);

grant delete on public.rooms, public.players, public.answers, public.guesses to anon, authenticated;