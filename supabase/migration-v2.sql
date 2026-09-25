-- Roller Stats v2 migration.
-- Supabase dashboard → SQL Editor → New query → paste → Run. Run ONCE, before the v2 app goes online.
-- Non destructive: every v1 row is kept and the v1 app keeps working while this is applied.
begin;

-- games -----------------------------------------------------------------
alter table public.games
  add column competition       text    not null default 'championnat' check (competition in ('championnat','coupe','playoffs')),
  add column venue             text    not null default 'home'        check (venue in ('home','away','neutral')),
  add column sheet_side        text    check (sheet_side in ('home','visitor')),
  add column overtime_possible boolean not null default true;
update public.games set venue = case when home then 'home' else 'away' end;

-- Shim: a v1 tab that is still open only sends `home`: keep `venue` consistent with it.
create function public.games_sync_venue() returns trigger language plpgsql as $$
begin
  if new.home = false and new.venue = 'home' then new.venue := 'away'; end if;
  return new;
end $$;
create trigger games_sync_venue before insert on public.games for each row execute function public.games_sync_venue();

-- goalies ---------------------------------------------------------------
create table public.goalies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);
create unique index goalies_name_unique on public.goalies (lower(btrim(name)));
alter table public.goalies enable row level security;
revoke all on public.goalies from anon, authenticated;
grant select, insert on public.goalies to anon;
grant update (name) on public.goalies to anon;
create policy "goalies read"   on public.goalies for select to anon using (true);
create policy "goalies insert" on public.goalies for insert to anon with check (true);
create policy "goalies rename" on public.goalies for update to anon using (true) with check (true);

-- events ----------------------------------------------------------------
alter table public.events
  add column goalie_id    uuid    references public.goalies(id),
  add column empty_net    boolean not null default false,
  add column strength     text    not null default 'even' check (strength in ('even','pp','pk')),
  add column penalty_shot boolean not null default false,
  add column note         text    check (note is null or char_length(note) <= 200);

alter table public.events drop constraint if exists events_kind_check;
alter table public.events add constraint events_kind_check check (kind in (
  'shot_for','shot_against','faceoff','own_goal_for','own_goal_against',
  'shootout_for','shootout_against','note','state_our_goalie','state_their_net','state_strength'));
alter table public.events drop constraint if exists events_period_check;
alter table public.events add constraint events_period_check check (period in (1,2,3));

alter table public.events drop constraint event_shape;
alter table public.events add constraint event_shape check (
  (kind in ('shot_for','shot_against') and result in ('goal','save','missed','blocked') and dot is null and (
      (not penalty_shot and x is not null and y is not null and x between 0 and 1 and y between 0 and 1)
      or (penalty_shot and result in ('goal','save','missed') and x is null and y is null)))
  or (kind = 'faceoff' and result in ('won','lost')
      and dot is not null and dot in ('center','off_top','off_bottom','def_top','def_bottom') and x is null and y is null)
  or (kind in ('own_goal_for','own_goal_against') and result = 'goal' and dot is null and x is null and y is null)
  or (kind in ('shootout_for','shootout_against') and result in ('goal','save','missed')
      and dot is null and x is null and y is null)
  or (kind = 'note' and result = 'note' and note is not null and dot is null and x is null and y is null)
  or (kind = 'state_our_goalie' and dot is null and x is null and y is null
      and ((result = 'goalie' and goalie_id is not null) or (result = 'empty' and goalie_id is null)))
  or (kind = 'state_their_net' and result in ('present','empty') and dot is null and x is null and y is null)
  or (kind = 'state_strength' and result in ('even','pp','pk') and dot is null and x is null and y is null)
);

alter table public.events add constraint events_goalie_rules check ((goalie_id is null or kind in ('shot_against','own_goal_against','shootout_against','state_our_goalie')) and not (empty_net and goalie_id is not null));

-- Updates: soft delete (as in v1) and filling in a missing goalie, nothing else.
drop policy "events soft delete" on public.events;
grant update (deleted_at, goalie_id) on public.events to anon;
create policy "events update" on public.events for update to anon using (true) with check (true);

create function public.events_guard_update() returns trigger language plpgsql as $$
begin
  if (to_jsonb(new) - 'deleted_at' - 'goalie_id') is distinct from (to_jsonb(old) - 'deleted_at' - 'goalie_id') then
    raise exception 'events are immutable except deleted_at and goalie_id' using errcode = '42501';
  end if;
  if old.deleted_at is not null then
    if new.deleted_at is null then raise exception 'an event can be deleted, never restored' using errcode = '42501'; end if;
    new.deleted_at := old.deleted_at;
  end if;
  if new.goalie_id is distinct from old.goalie_id then
    if old.goalie_id is not null or new.goalie_id is null
       or old.kind not in ('shot_against','own_goal_against','shootout_against') or old.empty_net then
      raise exception 'a goalie can only be filled in on a shot against that has none' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger events_guard_update before update on public.events for each row execute function public.events_guard_update();

commit;
