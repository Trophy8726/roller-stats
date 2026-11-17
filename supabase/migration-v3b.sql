-- Roller Stats v3b migration: turnovers (lost / recovered puck during play) and the « Turnover » tablet role.
-- Supabase dashboard → SQL Editor → New query → paste → Run. Run ONCE, after migration-v3a.sql.
-- Only widens three checks: apps that do not know turnovers yet keep working.
begin;

alter table public.events drop constraint events_kind_check;
alter table public.events add constraint events_kind_check check (kind in (
  'shot_for','shot_against','turnover','faceoff','own_goal_for','own_goal_against',
  'shootout_for','shootout_against','note','state_our_goalie','state_their_net','state_strength'));

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
  or (kind = 'turnover' and result in ('lost','recovered') and dot is null and not penalty_shot and not empty_net
      and x is not null and y is not null and x between 0 and 1 and y between 0 and 1)
);

-- The inline check of schema.sql: if Postgres named it differently, this fails and nothing is changed.
alter table public.events drop constraint events_device_role_check;
alter table public.events add constraint events_device_role_check
  check (device_role in ('shots_for','shots_against','turnovers','faceoffs','all'));

commit;
