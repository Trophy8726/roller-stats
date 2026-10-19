-- Roller Stats v3a migration: accounts, clubs, teams, per-club access rules.
-- Supabase dashboard → SQL Editor → New query → paste → Run. Run ONCE, after schema.sql and migration-v2.sql.
-- From the moment it commits, the v2 app (no account) can no longer read or write: deploy v3a right after.
begin;

-- helpers -------------------------------------------------------------------
-- 64 hex characters from two v4 UUIDs: 244 random bits, no extension needed.
create function public.new_invite_token() returns text language sql volatile set search_path = '' as $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
$$;

-- profiles --------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  created_at   timestamptz not null default now()
);

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), ''), 80))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

insert into public.profiles (id, display_name)
  select id, left(coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email, '@', 1), ''), 80)
  from auth.users
on conflict (id) do nothing;

-- clubs, members, invites, teams ------------------------------------------------
create table public.clubs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 80),
  sport      text not null default 'roller' check (sport in ('roller')),
  plan       text not null default 'free' check (plan in ('free')),
  created_at timestamptz not null default now()
);

create table public.club_members (
  club_id   uuid not null references public.clubs(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  role      text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (club_id, user_id)
);
create index club_members_user_idx on public.club_members (user_id);

create table public.club_invites (
  club_id    uuid primary key references public.clubs(id) on delete cascade,
  token      text not null unique,
  created_at timestamptz not null default now()
);

create table public.teams (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (club_id, id)
);
create unique index teams_name_unique on public.teams (club_id, lower(btrim(name)));

-- existing tables -----------------------------------------------------------------
alter table public.games
  add column club_id    uuid references public.clubs(id),
  add column team_id    uuid,
  add column created_by uuid references auth.users(id) on delete set null;
-- The team must belong to the game's club.
alter table public.games add constraint games_team_fk foreign key (club_id, team_id) references public.teams (club_id, id);

alter table public.goalies add column club_id uuid references public.clubs(id);
drop index public.goalies_name_unique;
create unique index goalies_name_unique on public.goalies (club_id, lower(btrim(name)));

-- 1b note: deleting an account must clear created_by through a path that events_guard_update allows.
alter table public.events add column created_by uuid references auth.users(id) on delete set null;

-- The author is always the signed-in account, whatever the client sends.
create function public.stamp_created_by() returns trigger language plpgsql set search_path = '' as $$
begin
  new.created_by := auth.uid();
  return new;
end $$;
create trigger games_created_by before insert on public.games for each row execute function public.stamp_created_by();
create trigger events_created_by before insert on public.events for each row execute function public.stamp_created_by();

-- data: the two existing clubs ------------------------------------------------------
do $$
declare
  aix uuid; ml uuid; aix_team uuid; ml_team uuid; stray text;
begin
  select string_agg(code, ', ') into stray from public.games where code not in ('9MKH', 'B9NG', 'QSFA');
  if stray is not null then
    raise exception 'Games not covered by this migration: %. Decide their club, then edit the script.', stray;
  end if;
  insert into public.clubs (name) values ('Aix-en-Provence') returning id into aix;
  insert into public.clubs (name) values ('Maisons-Laffitte') returning id into ml;
  insert into public.teams (club_id, name) values (aix, 'N2') returning id into aix_team;
  insert into public.teams (club_id, name) values (ml, 'U20') returning id into ml_team;
  insert into public.club_invites (club_id, token) values (aix, public.new_invite_token()), (ml, public.new_invite_token());
  update public.games set club_id = aix, team_id = aix_team where code in ('9MKH', 'B9NG');
  update public.games set club_id = ml, team_id = ml_team where code = 'QSFA';
  update public.goalies set club_id = aix;
end $$;

alter table public.games alter column club_id set not null, alter column team_id set not null;
alter table public.goalies alter column club_id set not null;

-- membership checks (security definer: they read club_members past its own RLS) ------
create function public.is_member(c uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.club_members m where m.club_id = c and m.user_id = auth.uid())
$$;
create function public.is_owner(c uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.club_members m where m.club_id = c and m.user_id = auth.uid() and m.role = 'owner')
$$;
create function public.game_club(game text) returns uuid language sql stable security definer set search_path = '' as $$
  select g.club_id from public.games g where g.code = game
$$;
create function public.shares_club(other uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.club_members a join public.club_members b on b.club_id = a.club_id
    where a.user_id = auth.uid() and b.user_id = other)
$$;

-- guards ------------------------------------------------------------------------------
create function public.club_members_keep_owner() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- serialise membership changes per club, so two owners cannot demote each other concurrently
  perform 1 from public.clubs c where c.id = old.club_id for update;
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner')
     and exists (select 1 from public.clubs c where c.id = old.club_id)
     and not exists (select 1 from public.club_members m
                     where m.club_id = old.club_id and m.role = 'owner' and m.user_id <> old.user_id) then
    raise exception 'last owner of the club' using errcode = 'RS001';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger club_members_keep_owner before update or delete on public.club_members
  for each row execute function public.club_members_keep_owner();

create function public.teams_guard_archive() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.archived_at is not null and not public.is_owner(new.club_id) then
      raise exception 'only an owner can archive a team' using errcode = '42501';
    end if;
  elsif new.archived_at is distinct from old.archived_at and not public.is_owner(old.club_id) then
    raise exception 'only an owner can archive a team' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger teams_guard_archive before insert or update on public.teams for each row execute function public.teams_guard_archive();

-- operations in several steps -------------------------------------------------------------
create function public.create_club(club_name text, team_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); cid uuid;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  insert into public.clubs (name) values (btrim(club_name)) returning id into cid;
  insert into public.club_members (club_id, user_id, role) values (cid, uid, 'owner');
  insert into public.teams (club_id, name) values (cid, btrim(team_name));
  insert into public.club_invites (club_id, token) values (cid, public.new_invite_token());
  return cid;
end $$;

create function public.invite_info(invite_token text) returns table (club_id uuid, club_name text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name from public.club_invites i join public.clubs c on c.id = i.club_id where i.token = invite_token
$$;

create function public.join_club(invite_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); cid uuid;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select i.club_id into cid from public.club_invites i where i.token = invite_token;
  if cid is null then raise exception 'invalid invite' using errcode = 'RS002'; end if;
  insert into public.club_members (club_id, user_id, role) values (cid, uid, 'member')
  on conflict (club_id, user_id) do nothing;
  return cid;
end $$;

create function public.club_invite(club uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_owner(club) then raise exception 'owners only' using errcode = '42501'; end if;
  return (select i.token from public.club_invites i where i.club_id = club);
end $$;

create function public.regenerate_invite(club uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare tok text;
begin
  if not public.is_owner(club) then raise exception 'owners only' using errcode = '42501'; end if;
  update public.club_invites set token = public.new_invite_token(), created_at = now() where club_id = club returning token into tok;
  return tok;
end $$;

revoke execute on function public.create_club(text, text), public.invite_info(text), public.join_club(text),
  public.club_invite(uuid), public.regenerate_invite(uuid) from public, anon;
grant execute on function public.create_club(text, text), public.invite_info(text), public.join_club(text),
  public.club_invite(uuid), public.regenerate_invite(uuid) to authenticated;

-- helpers: not callable by signed-out clients (new_invite_token stays internal).
revoke execute on function public.game_club(text), public.is_member(uuid), public.is_owner(uuid), public.shares_club(uuid), public.new_invite_token() from public, anon;
grant execute on function public.game_club(text), public.is_member(uuid), public.is_owner(uuid), public.shares_club(uuid) to authenticated;

-- access rules ------------------------------------------------------------------------------
drop policy "games read" on public.games;
drop policy "games insert" on public.games;
drop policy "events read" on public.events;
drop policy "events insert" on public.events;
drop policy "events update" on public.events;
drop policy "goalies read" on public.goalies;
drop policy "goalies insert" on public.goalies;
drop policy "goalies rename" on public.goalies;

revoke all on public.games, public.events, public.goalies, public.profiles, public.clubs,
  public.club_members, public.club_invites, public.teams from anon, authenticated;

alter table public.profiles     enable row level security;
alter table public.clubs        enable row level security;
alter table public.club_members enable row level security;
alter table public.club_invites enable row level security;
alter table public.teams        enable row level security;

grant usage on schema public to authenticated;
grant select, insert on public.games to authenticated;
grant select, insert on public.events to authenticated;
grant update (deleted_at, goalie_id) on public.events to authenticated;
grant select, insert on public.goalies to authenticated;
grant update (name) on public.goalies to authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select on public.clubs to authenticated;
grant update (name) on public.clubs to authenticated;
grant select, delete on public.club_members to authenticated;
grant update (role) on public.club_members to authenticated;
grant select, insert on public.teams to authenticated;
grant update (name, archived_at) on public.teams to authenticated;
-- club_invites: no direct grant, only through club_invite / regenerate_invite / invite_info / join_club.

create policy "games read"   on public.games for select to authenticated using (public.is_member(club_id));
create policy "games insert" on public.games for insert to authenticated with check (public.is_member(club_id));

create policy "events read"   on public.events for select to authenticated using (public.is_member(public.game_club(game_code)));
create policy "events insert" on public.events for insert to authenticated with check (public.is_member(public.game_club(game_code)));
create policy "events update" on public.events for update to authenticated
  using (public.is_member(public.game_club(game_code))) with check (public.is_member(public.game_club(game_code)));

create policy "goalies read"   on public.goalies for select to authenticated using (public.is_member(club_id));
create policy "goalies insert" on public.goalies for insert to authenticated with check (public.is_member(club_id));
create policy "goalies rename" on public.goalies for update to authenticated using (public.is_member(club_id)) with check (public.is_member(club_id));

create policy "profiles read"   on public.profiles for select to authenticated using (id = auth.uid() or public.shares_club(id));
create policy "profiles update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "clubs read"   on public.clubs for select to authenticated using (public.is_member(id));
create policy "clubs rename" on public.clubs for update to authenticated using (public.is_owner(id)) with check (public.is_owner(id));

create policy "members read"   on public.club_members for select to authenticated using (public.is_member(club_id));
create policy "members role"   on public.club_members for update to authenticated using (public.is_owner(club_id)) with check (public.is_owner(club_id));
create policy "members remove" on public.club_members for delete to authenticated using (public.is_owner(club_id) or user_id = auth.uid());

create policy "teams read"   on public.teams for select to authenticated using (public.is_member(club_id));
create policy "teams insert" on public.teams for insert to authenticated with check (public.is_member(club_id));
create policy "teams update" on public.teams for update to authenticated using (public.is_member(club_id)) with check (public.is_member(club_id));

commit;
