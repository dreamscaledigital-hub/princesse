-- Table des duels (jeu Tap éclair)
create table if not exists duels (
  id           uuid primary key default gen_random_uuid(),
  code         text unique not null,
  p1_id        text not null,
  p1_name      text not null default 'Joueur 1',
  p2_id        text,
  p2_name      text default 'Joueur 2',
  gage         text not null default '',
  p1_score     int  not null default 0,
  p2_score     int  not null default 0,
  status       text not null default 'lobby',
  current_round int not null default 0,
  total_rounds  int not null default 5,
  round_winner_id text,
  game_winner_id  text,
  signal_at    timestamptz,
  created_at   timestamptz default now()
);

alter table duels enable row level security;
create policy "duels_public" on duels for all to anon, authenticated using (true) with check (true);

-- Fonction : démarrer un round avec délai aléatoire côté serveur
create or replace function start_duel_round(_code text)
returns void language plpgsql security definer as $$
declare
  delay_ms int := 2000 + floor(random() * 3500)::int; -- 2 à 5.5 secondes
begin
  update duels set
    status          = 'ready',
    round_winner_id = null,
    signal_at       = now() + (delay_ms || ' milliseconds')::interval
  where code = _code;
end;
$$;

-- Fonction : enregistrer un tap (atomique — premier arrivé gagne)
create or replace function register_tap(_code text, _player_id text)
returns text language plpgsql security definer as $$
declare
  d             duels%rowtype;
  winner_score  int;
  loser_score   int;
  new_status    text;
  game_over     bool := false;
begin
  select * into d from duels where code = _code for update;

  -- Faux départ : taper avant le signal
  if d.signal_at is null or now() < d.signal_at then
    -- Le joueur qui fausse-parte perd le round
    update duels set
      round_winner_id = case when _player_id = p1_id then p2_id else p1_id end,
      p1_score = case when _player_id = p2_id then p1_score + 1 else p1_score end,
      p2_score = case when _player_id = p1_id then p2_score + 1 else p2_score end,
      status = 'round_result'
    where code = _code;
    return 'false_start';
  end if;

  -- Déjà quelqu'un a tapé
  if d.round_winner_id is not null then
    return 'lost';
  end if;

  -- Ce joueur gagne le round
  if _player_id = d.p1_id then
    winner_score := d.p1_score + 1;
    loser_score  := d.p2_score;
  else
    winner_score := d.p2_score + 1;
    loser_score  := d.p1_score;
  end if;

  -- Partie terminée ? (3 victoires ou dernier round)
  if winner_score >= 3 or (d.current_round >= d.total_rounds) then
    game_over := true;
    new_status := 'game_over';
  else
    new_status := 'round_result';
  end if;

  update duels set
    round_winner_id = _player_id,
    p1_score = case when _player_id = p1_id then winner_score else loser_score end,
    p2_score = case when _player_id = p2_id then winner_score else loser_score end,
    status   = new_status,
    game_winner_id = case when game_over then _player_id else null end
  where code = _code;

  return 'won';
end;
$$;
