-- Roller Stats schema. Supabase dashboard → SQL Editor → New query → paste → Run. Run once.
create table public.games (
  code        text primary key check (code ~ '^[A-HJKMNP-Z2-9]{4}$'),
  team_name   text not null check (char_length(team_name) between 1 and 60),
  opponent    text not null check (char_length(opponent) between 1 and 60),
  game_date   date not null,
  home        boolean not null,
  created_at  timestamptz not null default now()
);

create table public.events (
  id          uuid primary key,
  game_code   text not null references public.games(code),
  kind        text not null check (kind in ('shot_for','shot_against','faceoff')),
  period      smallint not null check (period in (1,2)),
  x           real,
  y           real,
  dot         text,
  result      text not null,
  device_role text not null check (device_role in ('shots_for','shots_against','faceoffs','all')),
  recorded_at timestamptz not null,
  deleted_at  timestamptz,
  constraint event_shape check (
    (kind in ('shot_for','shot_against') and result in ('goal','save','missed','blocked')
      and x between 0 and 1 and y between 0 and 1 and dot is null)
    or
    (kind = 'faceoff' and result in ('won','lost')
      and dot in ('center','off_top','off_bottom','def_top','def_bottom') and x is null and y is null)
  )
);
create index events_game_code_idx on public.events (game_code);

alter table public.games  enable row level security;
alter table public.events enable row level security;

-- Explicit privileges: read + insert, and only deleted_at may be updated (soft delete). No hard delete.
revoke all on public.games, public.events from anon, authenticated;
grant usage on schema public to anon;
grant select, insert on public.games  to anon;
grant select, insert on public.events to anon;
grant update (deleted_at) on public.events to anon;

create policy "games read"         on public.games  for select to anon using (true);
create policy "games insert"       on public.games  for insert to anon with check (true);
create policy "events read"        on public.events for select to anon using (true);
create policy "events insert"      on public.events for insert to anon with check (true);
create policy "events soft delete" on public.events for update to anon using (true) with check (deleted_at is not null);

alter publication supabase_realtime add table public.events;
