# Roller Stats v3 — Phase 0 + Release 1a Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google accounts, clubs (owner/member roles, invite links, several clubs per account), club teams, per-club data and database-enforced access rules to the live v2 app, plus a staging environment to test it — release 1a of the v3 phase 1 spec.

**Architecture:** Same React SPA + Supabase + offline outbox. Supabase Auth (Google, PKCE) gives each device a persisted session; every table gains a `club_id` (events inherit it through their game) and Postgres RLS checks club membership on every request, through `security definer` helper functions. Multi-step operations (create a club, join by token, read/regenerate the invite) are SQL functions called with `rpc`. The UI gains an auth gate, an onboarding screen, a join screen, a club switcher, an account menu and a "Club" tab. Release 1b (custom competitions, opponent suggestions, season filters, GDPR) gets its own plan later.

**Tech Stack:** unchanged (Vite 8, React 19, TypeScript 7, Vitest 5 + Testing Library, @supabase/supabase-js 2, idb-keyval, vite-plugin-pwa).

**Spec:** `docs/superpowers/specs/2026-10-15-roller-stats-v3-phase1-design.md` (French, validated by the user on 2026-10-15). Sections 1–8 and 10–11 apply to this plan; section 9 (1b) does not. Work on branch `feat/v3` (already created, holds the spec).

## Global Constraints

- All UI text is French and comes from `src/i18n/fr.ts`. No hard-coded strings in components.
- Greyscale tokens from `src/styles/theme.css` only; touch targets ≥ 44px (existing `.btn`, `.input`, `.seg button` already comply).
- Vite `base: '/roller-stats/'`, hash routes only (`#/…`). The Google redirect returns to `/roller-stats/?code=…` (PKCE), never to a `#` fragment.
- Supabase URL and publishable key come from Vite env files: `.env` = production, `.env.development` = staging. Never use, request or commit the secret (service_role) key. Smoke-test passwords live only in the git-ignored `.env.smoke.local`.
- `npm run smoke` must refuse to run against production.
- Events are never hard-deleted; an event may only change `deleted_at` (one-way) and `goalie_id` (fill once). Every v2 database rule stays in force.
- **No entry is ever removed from the device outbox unless the server accepted it** — not on sign-out, not on a refused push, not on an expired session.
- Roles are exactly `owner` (UI: « Responsable ») and `member` (UI: « Membre »). A club always keeps at least one owner (enforced by the database, SQLSTATE `RS001`). An invalid or regenerated invite token raises `RS002`.
- The anonymous role (`anon`) has no access to any table after the migration.
- Commit after every task, on `feat/v3`. Commit messages end with a blank line then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push to `main` (a push to `main` deploys to production).
- Steps marked **[User]** are done by the user in a web dashboard (Supabase, Google Cloud). The executor stops, gives the user the exact instructions from the step, and waits for confirmation or the requested values.

## Review Focus

1. **Coming back from Google with an invite link** must land on the join screen for that club, not on onboarding nor on the home of another club. (Task 5, test « returns to the invitation after the Google round trip ».)
2. **A remembered current club the user no longer belongs to** (removed, left, other account on the same tablet) must fall back to another membership, or to onboarding when there is none — never show a club the user cannot read. (Task 4, test « falls back when the remembered club is gone ».)
3. **A remembered or default team that has been archived** must not be preselected in the new-game form; the first active team is chosen instead. (Task 6, test « skips an archived remembered team ».)
4. **A push refused by the database (42501)** keeps the entry in the outbox and shows « Envoi refusé : accès au club retiré »; when access comes back the entry is sent. (Task 9, test « keeps refused entries and sends them once access is back ».)
5. **Signing out with entries still pending** warns first, and after sign-out the entries are still in the outbox. (Task 7, test « warns before signing out with pending entries and keeps them ».)

---

## File map

| File | Responsibility | Task |
|---|---|---|
| `.env`, `.env.development`, `src/config.ts`, `src/vite-env.d.ts`, `.gitignore` | Supabase project per mode | 1 |
| `supabase/migration-v3a.sql` | Tables, data move, RLS, SQL functions | 2 |
| `supabase/claim-v3a.sql` | Makes the user owner of the two migrated clubs | 2 |
| `scripts/smoke.mjs` | RLS checks, staging only | 2 |
| `src/lib/supabase.ts` | Client with persisted session, PKCE | 3 |
| `src/auth/api.ts` | `AuthApi`, `User`, Supabase implementation, URL helpers | 3 |
| `src/auth/AuthContext.tsx` | `AuthProvider`, `useAuth` | 3 |
| `src/screens/Login.tsx` | Sign-in screen | 3 |
| `src/router.ts` | `join` route | 3 |
| `src/clubs/api.ts` | `ClubsApi`, types, errors, Supabase implementation | 4 |
| `src/teams/api.ts` | `TeamsApi`, `Team`, `DuplicateTeamError`, Supabase implementation | 4 |
| `src/clubs/ClubContext.tsx` | `ClubProvider`, `useClub` (memberships, current club, offline cache) | 4 |
| `src/teams/useTeams.ts` | Team list hook | 4 |
| `src/settings.ts` | New device-memory keys | 3, 4, 6 |
| `src/test/fakes.tsx` | Fakes for auth, clubs, teams; shells | 3, 4 |
| `src/App.tsx` | Auth gate, club gate, pending invite | 3, 5 |
| `src/screens/Onboarding.tsx` | « Créer mon club » / « J'ai été invité » | 5 |
| `src/screens/JoinScreen.tsx` | Invitation confirmation | 5 |
| `src/games/api.ts`, `src/goalies/api.ts`, `src/goalies/useGoalies.ts`, `src/events/remote.ts`, `src/domain/types.ts` | Club-scoped data | 6 |
| `src/screens/home/TeamPicker.tsx` | Team dropdown with « + Nouvelle équipe… » | 6 |
| `src/screens/Home.tsx`, `SeasonScreen.tsx`, `record/Recorder.tsx`, `report/ReportScreen.tsx` | Use the current club / the game's club | 6 |
| `src/ui/ClubSwitcher.tsx`, `src/ui/AccountMenu.tsx` | Top bar additions | 7 |
| `src/screens/ClubPanel.tsx` | « Club » tab | 8 |
| `src/events/outbox.ts`, `backgroundSync.ts`, `useGameEvents.ts`, `SyncContext.tsx`, `src/ui/SyncChip.tsx` | Refused pushes | 9 |
| `README.md` | Staging, env files, cut-over checklist | 10 |

---

### Task 1: Phase 0 — staging project and environment files

**Files:**
- Create: `.env`, `.env.development`, `src/config.test.ts`
- Modify: `src/config.ts`, `src/vite-env.d.ts`, `.gitignore`

**Interfaces:**
- Produces: `SUPABASE_URL`, `SUPABASE_KEY` (unchanged names, now read from `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_KEY`). Vitest runs in mode `test`, which loads only `.env` (production values; tests never call the network).

- [ ] **Step 1: [User] Create the staging Supabase project**

Give the user these instructions and wait for the two values:

1. supabase.com → **New project**. Name `roller-stats-staging`, region **Europe (Paris or Frankfurt)**, any database password (keep it).
2. **SQL Editor → New query**: paste and run `supabase/schema.sql`, then `supabase/migration-v2.sql` (both from the repo).
3. **Project Settings → API**: copy the **Project URL** and the **publishable** key (starts with `sb_publishable_`). Never the secret key.
4. **Authentication → Sign In / Providers → Email**: enabled (used only by the smoke test users). **Authentication → Users → Add user → Create new user**, tick **Auto Confirm User**, twice: `smoke-a@roller-stats.test` and `smoke-b@roller-stats.test`, each with a password of your choice.
5. Send back the URL and the publishable key (not the passwords).

- [ ] **Step 2: Write the failing test**

`src/config.test.ts`:

```ts
import { SUPABASE_KEY, SUPABASE_URL } from './config';

describe('config', () => {
  it('reads the Supabase project from the env files', () => {
    expect(SUPABASE_URL).toMatch(/^https:\/\/[a-z0-9]+\.supabase\.co$/);
    expect(SUPABASE_KEY).toMatch(/^sb_publishable_/);
  });
});
```

- [ ] **Step 3: Run it — it passes today (values are hard-coded), so make the env version fail first**

Run: `npx vitest run src/config.test.ts`
Expected: PASS (baseline). Continue: the next step replaces the constants; the test guards the env wiring.

- [ ] **Step 4: Implement**

`.env` (production — public values, committed):

```
VITE_SUPABASE_URL=https://ibgyycalrtnwtfmlzrwk.supabase.co
VITE_SUPABASE_KEY=sb_publishable_1ifZJNFPoei1CZQQr7jcIw_1n_cWr1s
```

`.env.development` (staging — values from Step 1, committed):

```
VITE_SUPABASE_URL=<staging Project URL from Step 1>
VITE_SUPABASE_KEY=<staging publishable key from Step 1>
```

(The two `<…>` are the literal values the user sent in Step 1; write them, not the brackets.)

`src/config.ts`:

```ts
// Public values: the publishable key is meant to ship in browser code. Never put the secret key here.
// `.env` holds production (build, tests); `.env.development` holds staging (npm run dev).
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is missing: see .env / .env.development`);
  return value;
}

export const SUPABASE_URL = required('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL);
export const SUPABASE_KEY = required('VITE_SUPABASE_KEY', import.meta.env.VITE_SUPABASE_KEY);
```

`src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

`.gitignore` — append:

```
.env*.local
```

- [ ] **Step 5: Run the whole suite and the build**

Run: `npm test` then `npm run build`
Expected: all tests PASS; build succeeds. Then `grep -c ibgyycalrtnwtfmlzrwk dist/assets/*.js` prints a non-zero count (production URL baked into the production build).

- [ ] **Step 6: Commit**

```bash
git add .env .env.development .gitignore src/config.ts src/config.test.ts src/vite-env.d.ts
git commit -m "chore: read the Supabase project from env files, staging for npm run dev"
```

---

### Task 2: Database migration v3a, claim script and smoke test

**Files:**
- Create: `supabase/migration-v3a.sql`, `supabase/claim-v3a.sql`
- Rewrite: `scripts/smoke.mjs`

**Interfaces:**
- Produces (SQL, used by Tasks 4–8):
  - tables `profiles(id, display_name, created_at)`, `clubs(id, name, sport, plan, created_at)`, `club_members(club_id, user_id, role, joined_at)`, `club_invites(club_id, token, created_at)`, `teams(id, club_id, name, archived_at, created_at)`;
  - new columns `games.club_id`, `games.team_id`, `games.created_by`, `goalies.club_id`, `events.created_by`;
  - functions `create_club(club_name text, team_name text) → uuid`, `invite_info(invite_token text) → table(club_id uuid, club_name text)`, `join_club(invite_token text) → uuid`, `club_invite(club uuid) → text`, `regenerate_invite(club uuid) → text`;
  - errors: SQLSTATE `RS001` (last owner), `RS002` (invalid invite), `42501` (not allowed), `23505` (duplicate name).

- [ ] **Step 1: Write `supabase/migration-v3a.sql`**

```sql
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
create function public.club_members_keep_owner() returns trigger language plpgsql set search_path = '' as $$
begin
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
  if new.archived_at is distinct from old.archived_at and not public.is_owner(old.club_id) then
    raise exception 'only an owner can archive a team' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger teams_guard_archive before update on public.teams for each row execute function public.teams_guard_archive();

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
```

- [ ] **Step 2: Write `supabase/claim-v3a.sql`**

```sql
-- Run AFTER the v3a deploy, once you have signed in with Google on the new app.
-- Replace the address on the marked line with the Google address you signed in with, then Run.
-- It makes that account owner ("Responsable") of the two clubs created by migration-v3a.sql. Nothing stays behind.
do $$
declare uid uuid;
begin
  select id into uid from auth.users
  where lower(email) = lower('ADRESSE_GOOGLE@gmail.com');  -- <- your Google address here
  if uid is null then
    raise exception 'No account with this address yet: sign in with Google on the app first, then run this again.';
  end if;
  insert into public.club_members (club_id, user_id, role)
    select c.id, uid, 'owner' from public.clubs c where c.name in ('Aix-en-Provence', 'Maisons-Laffitte')
  on conflict (club_id, user_id) do update set role = 'owner';
end $$;
```

- [ ] **Step 3: Rewrite `scripts/smoke.mjs`**

The new file has three parts: the header and v3a checks below (written out in full), then the existing v2 block, then the cleanup line.

```js
// Checks the v3a database rules on the STAGING Supabase project. Usage: npm run smoke
// Needs .env.development (staging URL + publishable key, committed) and the git-ignored .env.smoke.local:
//   SMOKE_A_EMAIL=...  SMOKE_A_PASSWORD=...  SMOKE_B_EMAIL=...  SMOKE_B_PASSWORD=...
// (two users created in the staging dashboard: Authentication → Users → Add user, Auto Confirm).
import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function readEnv(file) {
  const out = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}
const production = readEnv('.env');
const env = { ...readEnv('.env.development'), ...readEnv('.env.smoke.local') };
if (!env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL === production.VITE_SUPABASE_URL) {
  console.error('Refusing to run: .env.development must point at the staging project, never at production.');
  process.exit(1);
}
for (const k of ['SMOKE_A_EMAIL', 'SMOKE_A_PASSWORD', 'SMOKE_B_EMAIL', 'SMOKE_B_PASSWORD']) {
  if (!env[k]) {
    console.error(`${k} is missing from .env.smoke.local`);
    process.exit(1);
  }
}

const client = () => createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_KEY, { auth: { persistSession: false } });
async function signedIn(email, password) {
  const c = client();
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) {
    console.error(`Sign-in failed for ${email}: ${error.message}`);
    process.exit(1);
  }
  return { c, id: data.user.id };
}
function check(label, ok, detail = '') {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label} ${detail}`);
  if (!ok) process.exitCode = 1;
}

const { c: a, id: aId } = await signedIn(env.SMOKE_A_EMAIL, env.SMOKE_A_PASSWORD);
const { c: b, id: bId } = await signedIn(env.SMOKE_B_EMAIL, env.SMOKE_B_PASSWORD);
const anon = client();
const sb = a; // the v2 block below runs as user A, inside A's club
const tag = Math.random().toString(36).slice(2, 8);
const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => 'Z' + Array.from({ length: 3 }, () => A[Math.floor(Math.random() * A.length)]).join('');

// ---- clubs and teams ------------------------------------------------------
let r = await a.rpc('create_club', { club_name: `SMOKE ${tag}`, team_name: 'N2' });
check('create_club', !r.error && typeof r.data === 'string', r.error?.message);
const clubId = r.data;
r = await a.from('teams').select('id').eq('club_id', clubId).single();
const teamId = r.data?.id;
check('create_club also creates the first team', !r.error && !!teamId, r.error?.message);
r = await a.from('club_members').select('role').eq('club_id', clubId).eq('user_id', aId).single();
check('creator is owner', r.data?.role === 'owner', r.error?.message);
r = await a.rpc('club_invite', { club: clubId });
const token = r.data;
check('owner reads the invite token', !r.error && typeof token === 'string' && token.length === 64, r.error?.message);

const code = newCode();
const game = { code, club_id: clubId, team_id: teamId, team_name: 'N2', opponent: 'SMOKE', game_date: '2026-01-01', home: true };
r = await a.from('games').insert(game);
check('member creates a game in his club', !r.error, r.error?.message);
const row = (over) => ({
  id: crypto.randomUUID(), game_code: code, kind: 'shot_against', period: 1, x: 0.1, y: 0.5, dot: null, result: 'save',
  device_role: 'all', recorded_at: new Date().toISOString(), deleted_at: null,
  goalie_id: null, empty_net: false, strength: 'even', penalty_shot: false, note: null, ...over,
});
const first = row({});
r = await a.from('events').insert(first);
check('member records an event', !r.error, r.error?.message);
r = await a.from('events').select('created_by').eq('id', first.id).single();
check('created_by is stamped with the author', r.data?.created_by === aId, JSON.stringify(r.data));
const spoofed = row({ created_by: bId });
r = await a.from('events').insert(spoofed);
r = await a.from('events').select('created_by').eq('id', spoofed.id).single();
check('a client cannot choose created_by', r.data?.created_by === aId, JSON.stringify(r.data));

// ---- signed out -----------------------------------------------------------
r = await anon.from('games').select('code').eq('code', code);
check('signed out: no game visible', !!r.error || r.data.length === 0, r.error?.code);
r = await anon.from('events').insert(row({}));
check('signed out: insert refused', !!r.error, r.error?.code);
r = await anon.rpc('create_club', { club_name: 'x', team_name: 'y' });
check('signed out: create_club refused', !!r.error, r.error?.code);

// ---- another club ---------------------------------------------------------
r = await b.from('games').select('code').eq('code', code);
check('other account: game invisible', !r.error && r.data.length === 0, r.error?.message);
r = await b.from('events').select('id').eq('game_code', code);
check('other account: events invisible', !r.error && r.data.length === 0, r.error?.message);
r = await b.from('events').insert(row({}));
check('other account: event insert refused (42501)', r.error?.code === '42501', r.error?.code);
r = await b.from('games').insert({ ...game, code: newCode() });
check('other account: game insert refused', !!r.error, r.error?.code);
r = await b.rpc('club_invite', { club: clubId });
check('non-member cannot read the invite token', !!r.error, r.error?.code);
r = await b.rpc('create_club', { club_name: `SMOKE ${tag} B`, team_name: 'X' });
const clubB = r.data;
r = await b.from('teams').select('id').eq('club_id', clubB).single();
const teamB = r.data?.id;
r = await a.from('games').insert({ ...game, code: newCode(), team_id: teamB });
check('a game cannot use the team of another club', !!r.error, r.error?.code);

// ---- joining ---------------------------------------------------------------
r = await b.rpc('invite_info', { invite_token: token });
check('invite_info names the club', !r.error && r.data?.[0]?.club_name === `SMOKE ${tag}`, r.error?.message);
r = await b.rpc('join_club', { invite_token: token });
check('join_club with a valid token', !r.error && r.data === clubId, r.error?.message);
r = await b.rpc('join_club', { invite_token: token });
check('joining twice is harmless', !r.error && r.data === clubId, r.error?.message);
r = await b.from('club_members').select('role').eq('club_id', clubId).eq('user_id', bId).single();
check('joiner is a member, not an owner', r.data?.role === 'member', JSON.stringify(r.data));
r = await b.from('games').select('code').eq('code', code);
check('member now sees the game', !r.error && r.data.length === 1, r.error?.message);
r = await b.from('events').insert(row({}));
check('member records an event in the club game', !r.error, r.error?.message);
r = await b.rpc('club_invite', { club: clubId });
check('member cannot read the invite token', !!r.error, r.error?.code);
r = await b.rpc('regenerate_invite', { club: clubId });
check('member cannot regenerate the invite', !!r.error, r.error?.code);
r = await b.from('club_members').update({ role: 'owner' }).eq('club_id', clubId).eq('user_id', bId).select();
check('member cannot promote himself', !!r.error || r.data.length === 0, r.error?.code);
r = await b.from('clubs').update({ name: 'hacked' }).eq('id', clubId).select();
check('member cannot rename the club', !!r.error || r.data.length === 0, r.error?.code);
r = await b.from('teams').insert({ club_id: clubId, name: 'U17' }).select('id').single();
const u17 = r.data?.id;
check('member adds a team', !r.error && !!u17, r.error?.message);
r = await b.from('teams').insert({ club_id: clubId, name: ' u17 ' });
check('duplicate team name refused (23505)', r.error?.code === '23505', r.error?.code);
r = await b.from('teams').update({ name: 'U17 B' }).eq('id', u17).select('id');
check('member renames a team', !r.error && r.data.length === 1, r.error?.message);
r = await b.from('teams').update({ archived_at: new Date().toISOString() }).eq('id', u17).select('id');
check('member cannot archive a team', !!r.error, r.error?.code);
r = await a.from('teams').update({ archived_at: new Date().toISOString() }).eq('id', u17).select('id');
check('owner archives a team', !r.error && r.data.length === 1, r.error?.message);
r = await b.from('profiles').select('display_name').eq('id', aId);
check('members see each other in profiles', !r.error && r.data.length === 1, r.error?.message);

// ---- owners -----------------------------------------------------------------
r = await a.from('club_members').delete().eq('club_id', clubId).eq('user_id', aId).select();
check('last owner cannot leave (RS001)', r.error?.code === 'RS001', r.error?.code);
r = await a.from('club_members').update({ role: 'member' }).eq('club_id', clubId).eq('user_id', aId).select();
check('last owner cannot step down (RS001)', r.error?.code === 'RS001', r.error?.code);
r = await a.from('club_members').update({ role: 'owner' }).eq('club_id', clubId).eq('user_id', bId).select();
check('owner promotes a member', !r.error && r.data.length === 1, r.error?.message);
r = await a.from('club_members').update({ role: 'member' }).eq('club_id', clubId).eq('user_id', aId).select();
check('an owner may step down when another owner exists', !r.error && r.data.length === 1, r.error?.message);
r = await b.from('club_members').update({ role: 'owner' }).eq('club_id', clubId).eq('user_id', aId).select();
check('restore A as owner', !r.error && r.data.length === 1, r.error?.message);
r = await a.rpc('regenerate_invite', { club: clubId });
check('owner regenerates the invite', !r.error && typeof r.data === 'string' && r.data !== token, r.error?.message);
r = await b.rpc('invite_info', { invite_token: token });
check('old token no longer resolves', !r.error && r.data.length === 0, r.error?.message);
r = await b.rpc('join_club', { invite_token: token });
check('old token cannot join (RS002)', r.error?.code === 'RS002', r.error?.code);
r = await a.from('club_members').delete().eq('club_id', clubId).eq('user_id', bId).select();
check('owner removes a member', !r.error && r.data.length === 1, r.error?.message);
r = await b.from('games').select('code').eq('code', code);
check('removed member no longer sees the game', !r.error && r.data.length === 0, r.error?.message);
r = await b.from('events').insert(row({}));
check('removed member: insert refused (42501)', r.error?.code === '42501', r.error?.code);
```

Then append, unchanged, the **existing v1 event block** of the current `scripts/smoke.mjs`: from `const id = crypto.randomUUID();` through the check `'row still present and soft-deleted'`. It uses `sb` and `code`, both defined above.

Then append the **existing v2 block**, from the line `// ---- v2 rules ----` down to and including the check `'empty_net cannot be edited'`, with exactly these edits:

1. Delete the line `const tag = Math.random().toString(36).slice(2, 8);` (already declared above). Keep `const goalieName = …`.
2. Delete the `const row = (over) => …` definition (already declared above).
3. Every `.from('goalies').insert({ name: X })` becomes `.from('goalies').insert({ club_id: clubId, name: X })` (three occurrences).
4. The `code2` game insert becomes:
   `r = await sb.from('games').insert({ code: code2, club_id: clubId, team_id: teamId, team_name: 'SMOKE', opponent: 'SMOKE', game_date: '2026-01-01', home: false }).select('venue').single();`

Finish the file with:

```js
console.log(
  `\nCleanup (staging) — paste in the SQL Editor:\n` +
    `delete from events where game_code in (select code from games where club_id in ('${clubId}','${clubB}'));\n` +
    `delete from games where club_id in ('${clubId}','${clubB}'); delete from goalies where club_id in ('${clubId}','${clubB}');\n` +
    `delete from clubs where id in ('${clubId}','${clubB}');`,
);
```

- [ ] **Step 4: [User] Apply the migration on staging and create the smoke credentials file**

Give the user these instructions:

1. Staging project → **SQL Editor → New query**: paste `supabase/migration-v3a.sql`, **Run**. Expected: `Success. No rows returned`.
2. In the repo folder, create `.env.smoke.local` (it is git-ignored) with:
   ```
   SMOKE_A_EMAIL=smoke-a@roller-stats.test
   SMOKE_A_PASSWORD=<password chosen in Task 1>
   SMOKE_B_EMAIL=smoke-b@roller-stats.test
   SMOKE_B_PASSWORD=<password chosen in Task 1>
   ```

- [ ] **Step 5: Run the smoke test against staging**

Run: `npm run smoke`
Expected: every line starts with `OK`, exit code 0. If a line says `FAIL`, fix `migration-v3a.sql`. Then ask the user to recreate the staging project (or drop the v3a objects) and re-run Steps 4–5. Never run any of this against production.

- [ ] **Step 6: Commit**

```bash
git add supabase/migration-v3a.sql supabase/claim-v3a.sql scripts/smoke.mjs
git commit -m "feat(db): v3a clubs, teams, accounts and per-club access rules, staging smoke test"
```

---

### Task 3: Authentication — Supabase session, AuthProvider, login screen, join route

**Files:**
- Create: `src/auth/api.ts`, `src/auth/AuthContext.tsx`, `src/auth/AuthContext.test.tsx`, `src/screens/Login.tsx`, `src/screens/Login.test.tsx`
- Modify: `src/lib/supabase.ts`, `src/events/SyncContext.tsx`, `src/main.tsx`, `src/App.tsx`, `src/router.ts`, `src/router.test.ts`, `src/settings.ts`, `src/settings.test.ts`, `src/i18n/fr.ts`, `src/test/fakes.tsx`

**Interfaces:**
- Produces:
  - `src/auth/api.ts`: `interface User { id: string; email: string; name: string }`; `interface AuthApi { current(): Promise<User | null>; onChange(cb: (u: User | null) => void): () => void; signInWithGoogle(): Promise<void>; signOut(): Promise<void> }`; `supabaseAuth(client): AuthApi`; `redirectUrl(): string`; `cleanAuthParams(): void`; `authErrorFromUrl(): string | null`.
  - `src/auth/AuthContext.tsx`: `type AuthState = { status: 'loading' } | { status: 'signedOut'; error: boolean } | { status: 'signedIn'; user: User }`; `AuthProvider({ initialUser?: User | null; children })` (reads the api from `useSync().auth`); `useAuth(): { state: AuthState; api: AuthApi }`.
  - `SyncDeps` gains `auth: AuthApi`.
  - `Route` gains `{ name: 'join'; token: string }`, `href({ name: 'join', token })` = `#/rejoindre/<token>` (token case kept).
  - `settings`: `savePendingInvite(token: string): void`, `loadPendingInvite(): string | null`, `clearPendingInvite(): void` (read and clear are separate so a React initializer stays pure).
  - `fakes`: `TEST_USER`, `fakeAuth(user)`, `makeDeps({ user })` returns `fa`; `renderWithSync(ui, deps, opts?)` wraps `AuthProvider`.

- [ ] **Step 1: [User] Google sign-in on staging**

Give the user these instructions:

1. console.cloud.google.com → create a project « Roller Stats ».
2. **APIs & Services → OAuth consent screen**: External, app name « Roller Stats », support email = yours, developer email = yours. Save. Then add your own Google address as a **test user**, plus those of the volunteers who will test staging.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**: type **Web application**. **Authorized redirect URIs**: `<staging Project URL>/auth/v1/callback`, and also `https://ibgyycalrtnwtfmlzrwk.supabase.co/auth/v1/callback` (production, used at cut-over). Copy the client ID and the client secret.
4. Supabase staging → **Authentication → Sign In / Providers → Google**: enable, paste the client ID and secret, save.
5. Supabase staging → **Authentication → URL Configuration**: Site URL `http://localhost:5173/roller-stats/`. Add the same address under **Redirect URLs**.

- [ ] **Step 2: Write the failing tests**

`src/router.test.ts` — add inside the existing `describe`:

```ts
  it('parses and builds the invitation route, keeping the token case', () => {
    expect(parseRoute('#/rejoindre/abcDEF123')).toEqual({ name: 'join', token: 'abcDEF123' });
    expect(href({ name: 'join', token: 'abcDEF123' })).toBe('#/rejoindre/abcDEF123');
  });
```

`src/settings.test.ts` — add:

```ts
  it('keeps a pending invitation until it is cleared', () => {
    expect(loadPendingInvite()).toBeNull();
    savePendingInvite('tok');
    expect(loadPendingInvite()).toBe('tok');
    expect(loadPendingInvite()).toBe('tok');
    clearPendingInvite();
    expect(loadPendingInvite()).toBeNull();
  });
```

(and add `savePendingInvite, loadPendingInvite, clearPendingInvite` to its import from `./settings`).

`src/auth/AuthContext.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { authErrorFromUrl, cleanAuthParams } from './api';
import { AuthProvider, useAuth } from './AuthContext';
import { makeDeps, TEST_USER } from '../test/fakes';
import { SyncProvider } from '../events/SyncContext';

function Probe() {
  const { state } = useAuth();
  return <p>{state.status === 'signedIn' ? `in:${state.user.name}` : state.status === 'signedOut' ? `out:${state.error}` : 'loading'}</p>;
}

function renderProbe(user: typeof TEST_USER | null) {
  const d = makeDeps({ user });
  render(
    <SyncProvider deps={d.deps}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </SyncProvider>,
  );
  return d;
}

describe('AuthProvider', () => {
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('starts loading, then reports the stored session', async () => {
    renderProbe(TEST_USER);
    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(await screen.findByText(`in:${TEST_USER.name}`)).toBeInTheDocument();
  });

  it('reports signed out, and follows sign-in and sign-out events', async () => {
    const d = renderProbe(null);
    expect(await screen.findByText('out:false')).toBeInTheDocument();
    d.fa.setUser(TEST_USER);
    expect(await screen.findByText(`in:${TEST_USER.name}`)).toBeInTheDocument();
    d.fa.setUser(null);
    expect(await screen.findByText('out:false')).toBeInTheDocument();
  });

  it('flags a failed Google round trip and cleans the URL', async () => {
    window.history.replaceState(null, '', '/roller-stats/?error=access_denied&error_description=cancelled#/');
    renderProbe(null);
    expect(await screen.findByText('out:true')).toBeInTheDocument();
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('#/');
  });
});

describe('auth URL helpers', () => {
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('removes only the auth parameters', () => {
    window.history.replaceState(null, '', '/roller-stats/?code=abc&keep=1#/saison');
    cleanAuthParams();
    expect(window.location.search).toBe('?keep=1');
    expect(window.location.hash).toBe('#/saison');
  });

  it('reads the error description', () => {
    window.history.replaceState(null, '', '/roller-stats/?error=access_denied');
    expect(authErrorFromUrl()).toBe('access_denied');
  });
});
```

`src/screens/Login.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { t } from '../i18n/fr';
import { loadPendingInvite } from '../settings';
import { makeDeps, renderWithSync } from '../test/fakes';
import { Login } from './Login';

describe('Login', () => {
  beforeEach(() => localStorage.clear());

  it('starts the Google sign-in', async () => {
    const d = makeDeps({ user: null });
    renderWithSync(<Login error={false} inviteToken={null} />, d.deps, { user: null });
    await userEvent.click(screen.getByRole('button', { name: t.auth.google }));
    expect(d.fa.api.signInWithGoogle).toHaveBeenCalledTimes(1);
    expect(loadPendingInvite()).toBeNull();
  });

  it('keeps the invitation across the Google round trip', async () => {
    const d = makeDeps({ user: null });
    renderWithSync(<Login error={false} inviteToken="tok123" />, d.deps, { user: null });
    expect(screen.getByText(t.auth.invitePending)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: t.auth.google }));
    expect(loadPendingInvite()).toBe('tok123');
  });

  it('explains a failed sign-in', () => {
    const d = makeDeps({ user: null });
    renderWithSync(<Login error inviteToken={null} />, d.deps, { user: null });
    expect(screen.getByRole('alert')).toHaveTextContent(t.auth.failed);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/router.test.ts src/settings.test.ts src/auth src/screens/Login.test.tsx`
Expected: FAIL (modules `./api`, `./AuthContext`, `./Login` not found; `join` route unknown; `savePendingInvite` not exported).

- [ ] **Step 4: Implement**

`src/lib/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL } from '../config';

// The session is kept on the device (localStorage) so the app opens signed in without network.
// PKCE: Google sends the browser back with `?code=`, which leaves the `#/…` routes alone.
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
});
```

`src/auth/api.ts`:

```ts
import type { Session, SupabaseClient } from '@supabase/supabase-js';

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface AuthApi {
  /** The session kept on this device, after any `?code=` from Google has been exchanged. */
  current(): Promise<User | null>;
  onChange(cb: (u: User | null) => void): () => void;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
}

export function toUser(s: Session | null): User | null {
  if (!s) return null;
  const meta = (s.user.user_metadata ?? {}) as Record<string, unknown>;
  const email = s.user.email ?? '';
  const name = (typeof meta.full_name === 'string' && meta.full_name) || (typeof meta.name === 'string' && meta.name) || email.split('@')[0];
  return { id: s.user.id, email, name };
}

/** Where Google sends the browser back: the app root (the hash route is not kept). */
export const redirectUrl = (): string => `${window.location.origin}${import.meta.env.BASE_URL}`;

const AUTH_PARAMS = ['code', 'error', 'error_code', 'error_description'];

export function authErrorFromUrl(): string | null {
  return new URL(window.location.href).searchParams.get('error');
}

/** Removes what Google and Supabase added to the address, keeping the hash route. */
export function cleanAuthParams(): void {
  const url = new URL(window.location.href);
  if (!AUTH_PARAMS.some((p) => url.searchParams.has(p))) return;
  AUTH_PARAMS.forEach((p) => url.searchParams.delete(p));
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
}

export function supabaseAuth(client: SupabaseClient): AuthApi {
  return {
    async current() {
      const { data } = await client.auth.getSession();
      return toUser(data.session);
    },
    onChange(cb) {
      const { data } = client.auth.onAuthStateChange((_event, session) => cb(toUser(session)));
      return () => data.subscription.unsubscribe();
    },
    async signInWithGoogle() {
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectUrl() } });
      if (error) throw new Error(error.message);
    },
    async signOut() {
      // 'local' ends the session on this device only, and works without network.
      await client.auth.signOut({ scope: 'local' });
    },
  };
}
```

`src/auth/AuthContext.tsx`:

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useSync } from '../events/SyncContext';
import { authErrorFromUrl, cleanAuthParams, type AuthApi, type User } from './api';

export type AuthState = { status: 'loading' } | { status: 'signedOut'; error: boolean } | { status: 'signedIn'; user: User };

const Ctx = createContext<{ state: AuthState; api: AuthApi } | null>(null);

const fromUser = (u: User | null, error = false): AuthState => (u ? { status: 'signedIn', user: u } : { status: 'signedOut', error });

/** `initialUser` skips the first async read (tests only). */
export function AuthProvider({ initialUser, children }: { initialUser?: User | null; children: ReactNode }) {
  const { auth } = useSync();
  const [state, setState] = useState<AuthState>(initialUser === undefined ? { status: 'loading' } : fromUser(initialUser));

  useEffect(() => {
    let alive = true;
    const failed = authErrorFromUrl() !== null;
    auth
      .current()
      .then((u) => {
        if (!alive) return;
        cleanAuthParams();
        setState(fromUser(u, failed && !u));
      })
      .catch(() => {
        if (alive) setState({ status: 'signedOut', error: false });
      });
    const off = auth.onChange((u) => {
      if (alive) setState((prev) => (prev.status === 'signedIn' && u && prev.user.id === u.id ? prev : fromUser(u)));
    });
    return () => {
      alive = false;
      off();
    };
  }, [auth]);

  return <Ctx.Provider value={{ state, api: auth }}>{children}</Ctx.Provider>;
}

export function useAuth(): { state: AuthState; api: AuthApi } {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
```

`src/router.ts` — add the route (type, parse, href):

```ts
export type Route =
  | { name: 'home' }
  | { name: 'season' }
  | { name: 'record'; code: string }
  | { name: 'report'; code: string }
  | { name: 'join'; token: string };
```

In `parseRoute`, before the `saison` line:

```ts
  if (parts[0] === 'rejoindre' && parts[1]) return { name: 'join', token: parts[1] };
```

In `href`, add the case:

```ts
    case 'join':
      return `#/rejoindre/${r.token}`;
```

`src/settings.ts` — add:

```ts
/** An invitation opened while signed out: kept across the Google round trip, then cleared once used. */
export const savePendingInvite = (token: string): void => store.set('pendingInvite', token);
export const loadPendingInvite = (): string | null => store.get('pendingInvite');
export const clearPendingInvite = (): void => store.set('pendingInvite', null);
```

`src/i18n/fr.ts` — add a top-level key (after `nav`):

```ts
  auth: {
    intro: 'Les statistiques de vos matchs de roller hockey, saisies en direct sur plusieurs tablettes. Connectez-vous pour retrouver les matchs de votre club.',
    google: 'Continuer avec Google',
    failed: 'La connexion Google a échoué ou a été annulée. Réessayez.',
    invitePending: 'Connectez-vous pour rejoindre le club qui vous a invité.',
  },
```

`src/screens/Login.tsx`:

```tsx
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { t } from '../i18n/fr';
import { savePendingInvite } from '../settings';

export function Login({ error, inviteToken }: { error: boolean; inviteToken: string | null }) {
  const { api } = useAuth();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(error);

  async function signIn() {
    if (inviteToken) savePendingInvite(inviteToken);
    setBusy(true);
    setFailed(false);
    try {
      await api.signInWithGoogle(); // the browser leaves for Google
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <section className="card stack">
        <h1>{t.appName}</h1>
        <p className="muted">{t.auth.intro}</p>
        {inviteToken && <p>{t.auth.invitePending}</p>}
        {failed && (
          <p className="notice" role="alert">
            {t.auth.failed}
          </p>
        )}
        <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void signIn()}>
          {t.auth.google}
        </button>
      </section>
    </main>
  );
}
```

`src/events/SyncContext.tsx` — `SyncDeps` gains `auth`, and `defaultSyncDeps` builds it:

```ts
import { supabaseAuth, type AuthApi } from '../auth/api';
// …
export interface SyncDeps {
  store: EventStore;
  remote: Remote;
  games: GamesApi;
  goalies: GoaliesApi;
  auth: AuthApi;
}
// …
export function defaultSyncDeps(): SyncDeps {
  return {
    store: new EventStore(idbKV()),
    remote: supabaseRemote(supabase),
    games: supabaseGames(supabase),
    goalies: supabaseGoalies(supabase),
    auth: supabaseAuth(supabase),
  };
}
```

`src/main.tsx` — wrap `App`:

```tsx
import { AuthProvider } from './auth/AuthContext';
// …
    <SyncProvider deps={defaultSyncDeps()}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </SyncProvider>
```

`src/App.tsx` (club gate comes in Task 5):

```tsx
import { useAuth } from './auth/AuthContext';
import { t } from './i18n/fr';
import { useRoute } from './router';
import { Home } from './screens/Home';
import { Login } from './screens/Login';
import { RecordScreen } from './screens/record/RecordScreen';
import { ReportScreen } from './screens/report/ReportScreen';
import { SeasonScreen } from './screens/SeasonScreen';

export function Splash() {
  return (
    <main className="page">
      <p className="muted">{t.errors.loading}</p>
    </main>
  );
}

export function App() {
  const { state } = useAuth();
  const route = useRoute();
  if (state.status === 'loading') return <Splash />;
  if (state.status === 'signedOut') return <Login error={state.error} inviteToken={route.name === 'join' ? route.token : null} />;
  switch (route.name) {
    case 'record':
      return <RecordScreen key={route.code} code={route.code} />;
    case 'report':
      return <ReportScreen key={route.code} code={route.code} />;
    case 'season':
      return <SeasonScreen />;
    default:
      return <Home />;
  }
}
```

`src/test/fakes.tsx` — add the auth fake, extend `makeDeps` and `renderWithSync`:

```tsx
import type { AuthApi, User } from '../auth/api';
import { AuthProvider } from '../auth/AuthContext';

export const TEST_USER: User = { id: 'user-1', email: 'paul@example.com', name: 'Paul' };

export function fakeAuth(initial: User | null) {
  let current = initial;
  const listeners = new Set<(u: User | null) => void>();
  const api: AuthApi = {
    current: async () => current,
    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    signInWithGoogle: vi.fn(async () => {}),
    signOut: vi.fn(async () => {
      current = null;
      listeners.forEach((l) => l(null));
    }),
  };
  return {
    api,
    userId: () => current?.id ?? '',
    setUser(u: User | null) {
      current = u;
      listeners.forEach((l) => l(u));
    },
  };
}
```

`makeDeps` gains a `user` option (default `TEST_USER`; `null` = signed out) and returns `fa`:

```tsx
export function makeDeps(opts: { games?: Game[]; goalies?: Goalie[]; user?: User | null } = {}) {
  const fr = fakeRemote();
  const fg = fakeGames(opts.games);
  const fgo = fakeGoalies(opts.goalies);
  const fa = fakeAuth(opts.user === undefined ? TEST_USER : opts.user);
  const deps: SyncDeps = { store: new EventStore(memoryKV()), remote: fr.remote, games: fg.api, goalies: fgo.api, auth: fa.api };
  return { deps, fr, fg, fgo, fa };
}

/** Renders `ui` as a signed-in screen (or signed out with `user: null`), without waiting for the session read. */
export function renderWithSync(ui: ReactElement, deps: SyncDeps, opts: { user?: User | null } = {}) {
  const user = opts.user === undefined ? TEST_USER : opts.user;
  return render(
    <SyncProvider deps={deps}>
      <AuthProvider initialUser={user}>{ui}</AuthProvider>
    </SyncProvider>,
  );
}
```

Every test file that builds `SyncDeps` by hand (search: `grep -rn "goalies: " src --include=*.test.tsx --include=*.test.ts`) adds `auth: fakeAuth(TEST_USER).api` to the object.

- [ ] **Step 5: Run the tests and the build**

Run: `npm test` then `npm run build`
Expected: all PASS; build succeeds.

- [ ] **Step 6: [User] Check the Google round trip on staging**

Run `npm run dev`. The user opens `http://localhost:5173/roller-stats/` and clicks « Continuer avec Google ». They should come back signed in on the existing home page. The page stays empty for now: the staging database denies every read until Tasks 4–6. The address bar must show no `?code=`. The user then cancels a second sign-in on the Google page and should see the failure message.

- [ ] **Step 7: Commit**

```bash
git add src/auth src/lib/supabase.ts src/events/SyncContext.tsx src/main.tsx src/App.tsx src/router.ts src/router.test.ts src/settings.ts src/settings.test.ts src/i18n/fr.ts src/screens/Login.tsx src/screens/Login.test.tsx src/test/fakes.tsx
git add -u src
git commit -m "feat(auth): Google sign-in with a persisted PKCE session, login screen, invitation route"
```

---

### Task 4: Clubs and teams — APIs, current-club provider, team hook

**Files:**
- Create: `src/clubs/api.ts`, `src/teams/api.ts`, `src/clubs/ClubContext.tsx`, `src/clubs/ClubContext.test.tsx`, `src/teams/useTeams.ts`, `src/teams/useTeams.test.tsx`, `src/clubs/api.test.ts`
- Modify: `src/settings.ts`, `src/settings.test.ts`, `src/events/SyncContext.tsx`, `src/test/fakes.tsx`

**Interfaces:**
- Consumes: SQL functions and tables from Task 2; `SyncDeps`, `useSync` (Task 3).
- Produces:
  - `src/clubs/api.ts`:
    ```ts
    export type ClubRole = 'owner' | 'member';
    export interface Membership { clubId: string; clubName: string; role: ClubRole }
    export interface Member { userId: string; name: string; role: ClubRole; joinedAt: string }
    export class InvalidInviteError extends Error {}
    export class LastOwnerError extends Error {}
    export interface ClubsApi {
      mine(userId: string): Promise<Membership[]>;            // sorted by club name (fr)
      create(clubName: string, teamName: string): Promise<string>; // new club id
      inviteInfo(token: string): Promise<{ clubId: string; clubName: string } | null>;
      join(token: string): Promise<string>;                    // club id; InvalidInviteError
      members(clubId: string): Promise<Member[]>;              // owners first, then by name
      setRole(clubId: string, userId: string, role: ClubRole): Promise<void>; // LastOwnerError
      remove(clubId: string, userId: string): Promise<void>;   // also "leave"; LastOwnerError
      rename(clubId: string, name: string): Promise<void>;
      invite(clubId: string): Promise<string>;                 // owners only
      regenerateInvite(clubId: string): Promise<string>;       // owners only
    }
    export function supabaseClubs(client: SupabaseClient): ClubsApi;
    ```
  - `src/teams/api.ts`:
    ```ts
    export interface Team { id: string; club_id: string; name: string; archived_at: string | null }
    export class DuplicateTeamError extends Error {}
    export interface TeamsApi {
      list(clubId: string): Promise<Team[]>;                   // all teams, sorted by name (fr)
      add(clubId: string, name: string): Promise<Team>;        // DuplicateTeamError
      rename(id: string, name: string): Promise<Team>;         // DuplicateTeamError
      setArchived(id: string, archived: boolean): Promise<Team>;
    }
    export function supabaseTeams(client: SupabaseClient): TeamsApi;
    ```
  - `SyncDeps` gains `clubs: ClubsApi; teams: TeamsApi`.
  - `src/clubs/ClubContext.tsx`: `interface ClubState { status: 'loading' | 'ready' | 'error'; memberships: Membership[]; current: Membership | null; select(clubId: string): void; reload(): Promise<void> }`; `ClubProvider({ userId, initial?, children })`; `useClub(): ClubState`.
  - `src/teams/useTeams.ts`: `interface TeamsState { teams: Team[]; active: Team[]; loading: boolean; error: boolean; reload(): Promise<void>; add(name: string): Promise<Team>; rename(id: string, name: string): Promise<Team>; setArchived(id: string, archived: boolean): Promise<Team> }`; `useTeams(clubId: string | undefined): TeamsState`.
  - `settings`: `loadMemberships(userId)`, `saveMemberships(userId, list)`, `loadCurrentClub(userId)`, `saveCurrentClub(userId, clubId)`.
  - `fakes`: `fakeClubs`, `fakeTeams`; `makeDeps` returns `fc`, `ft`; default data: club `club-1` « Aix » (TEST_USER owner), team `team-1` « N2 »; `renderWithSync` also wraps `ClubProvider` (current = club-1) when signed in; option `memberships`.

- [ ] **Step 1: Write the failing tests**

`src/clubs/api.test.ts` (error mapping on a stub client, like `src/games/api.test.ts`):

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { InvalidInviteError, LastOwnerError, supabaseClubs } from './api';
import { DuplicateTeamError, supabaseTeams } from '../teams/api';

function stubRpc(error: { code: string; message: string }) {
  return { rpc: async () => ({ data: null, error }) } as unknown as SupabaseClient;
}
function stubTable(error: { code: string; message: string }) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  Object.assign(chain, { insert: self, update: self, delete: self, eq: self, select: self, single: async () => ({ data: null, error }), then: (r: (v: unknown) => void) => r({ data: null, error }) });
  return { from: () => chain } as unknown as SupabaseClient;
}

describe('clubs api errors', () => {
  it('maps RS002 to InvalidInviteError', async () => {
    await expect(supabaseClubs(stubRpc({ code: 'RS002', message: 'invalid invite' })).join('x')).rejects.toBeInstanceOf(InvalidInviteError);
  });
  it('maps RS001 to LastOwnerError', async () => {
    await expect(supabaseClubs(stubTable({ code: 'RS001', message: 'last owner' })).remove('c', 'u')).rejects.toBeInstanceOf(LastOwnerError);
  });
  it('maps 23505 on teams to DuplicateTeamError', async () => {
    await expect(supabaseTeams(stubTable({ code: '23505', message: 'dup' })).add('c', 'N2')).rejects.toBeInstanceOf(DuplicateTeamError);
  });
});
```

`src/clubs/ClubContext.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '../auth/AuthContext';
import { SyncProvider } from '../events/SyncContext';
import { saveCurrentClub, saveMemberships } from '../settings';
import { makeDeps, TEST_USER } from '../test/fakes';
import { ClubProvider, useClub } from './ClubContext';

function Probe() {
  const c = useClub();
  return (
    <>
      <p>{`${c.status}:${c.current?.clubName ?? 'none'}:${c.memberships.length}`}</p>
      <button type="button" onClick={() => c.select('club-2')}>
        switch
      </button>
    </>
  );
}

function renderProbe(d = makeDeps()) {
  render(
    <SyncProvider deps={d.deps}>
      <AuthProvider initialUser={TEST_USER}>
        <ClubProvider userId={TEST_USER.id}>
          <Probe />
        </ClubProvider>
      </AuthProvider>
    </SyncProvider>,
  );
  return d;
}

describe('ClubProvider', () => {
  beforeEach(() => localStorage.clear());

  it('loads the memberships and picks the first club', async () => {
    renderProbe();
    expect(screen.getByText('loading:none:0')).toBeInTheDocument();
    expect(await screen.findByText('ready:Aix:1')).toBeInTheDocument();
  });

  it('remembers the chosen club per account', async () => {
    const d = makeDeps();
    await d.fc.api.create('Maisons-Laffitte', 'U20'); // becomes club-2, TEST_USER owner
    renderProbe(d);
    await screen.findByText('ready:Aix:2');
    await userEvent.click(screen.getByRole('button', { name: 'switch' }));
    expect(await screen.findByText('ready:Maisons-Laffitte:2')).toBeInTheDocument();
    expect(localStorage.getItem(`club:${TEST_USER.id}`)).toBe('club-2');
  });

  it('falls back when the remembered club is gone', async () => {
    saveCurrentClub(TEST_USER.id, 'club-removed');
    renderProbe();
    expect(await screen.findByText('ready:Aix:1')).toBeInTheDocument();
  });

  it('opens offline from the cached memberships', async () => {
    saveMemberships(TEST_USER.id, [{ clubId: 'club-1', clubName: 'Aix', role: 'owner' }]);
    const d = makeDeps();
    d.fc.setFailing(true);
    renderProbe(d);
    expect(screen.getByText('ready:Aix:1')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('ready:Aix:1')).toBeInTheDocument());
  });

  it('reports an error when nothing is cached and the server is down', async () => {
    const d = makeDeps();
    d.fc.setFailing(true);
    renderProbe(d);
    expect(await screen.findByText('error:none:0')).toBeInTheDocument();
  });
});
```

`src/teams/useTeams.test.tsx`:

```tsx
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SyncProvider } from '../events/SyncContext';
import { makeDeps } from '../test/fakes';
import { DuplicateTeamError } from './api';
import { useTeams } from './useTeams';

function setup() {
  const d = makeDeps();
  const wrapper = ({ children }: { children: ReactNode }) => <SyncProvider deps={d.deps}>{children}</SyncProvider>;
  return { d, ...renderHook(() => useTeams('club-1'), { wrapper }) };
}

describe('useTeams', () => {
  it('lists the active teams and adds one', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.active.map((x) => x.name)).toEqual(['N2']));
    await act(async () => {
      await result.current.add('U17');
    });
    expect(result.current.active.map((x) => x.name)).toEqual(['N2', 'U17']);
  });

  it('hides archived teams from the active list', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.setArchived('team-1', true);
    });
    expect(result.current.active).toEqual([]);
    expect(result.current.teams).toHaveLength(1);
  });

  it('refuses a duplicate name', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await expect(result.current.add(' n2 ')).rejects.toBeInstanceOf(DuplicateTeamError);
  });
});
```

`src/settings.test.ts` — add:

```ts
  it('keeps the memberships and the current club per account', () => {
    expect(loadMemberships('u1')).toEqual([]);
    saveMemberships('u1', [{ clubId: 'c', clubName: 'Aix', role: 'owner' }]);
    expect(loadMemberships('u1')).toEqual([{ clubId: 'c', clubName: 'Aix', role: 'owner' }]);
    expect(loadMemberships('u2')).toEqual([]);
    saveCurrentClub('u1', 'c');
    expect(loadCurrentClub('u1')).toBe('c');
    expect(loadCurrentClub('u2')).toBeNull();
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/clubs src/teams src/settings.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement the APIs**

`src/clubs/api.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

export type ClubRole = 'owner' | 'member';

export interface Membership {
  clubId: string;
  clubName: string;
  role: ClubRole;
}

export interface Member {
  userId: string;
  name: string;
  role: ClubRole;
  joinedAt: string;
}

/** The invitation token is unknown or has been regenerated (SQLSTATE RS002). */
export class InvalidInviteError extends Error {}
/** The club would be left without an owner (SQLSTATE RS001). */
export class LastOwnerError extends Error {}

export interface ClubsApi {
  mine(userId: string): Promise<Membership[]>;
  create(clubName: string, teamName: string): Promise<string>;
  inviteInfo(token: string): Promise<{ clubId: string; clubName: string } | null>;
  join(token: string): Promise<string>;
  members(clubId: string): Promise<Member[]>;
  setRole(clubId: string, userId: string, role: ClubRole): Promise<void>;
  remove(clubId: string, userId: string): Promise<void>;
  rename(clubId: string, name: string): Promise<void>;
  invite(clubId: string): Promise<string>;
  regenerateInvite(clubId: string): Promise<string>;
}

const fail = (e: { code?: string; message: string }): never => {
  if (e.code === 'RS001') throw new LastOwnerError(e.message);
  if (e.code === 'RS002') throw new InvalidInviteError(e.message);
  throw new Error(e.message);
};

const byClubName = (a: Membership, b: Membership) => a.clubName.localeCompare(b.clubName, 'fr');
const ownersFirst = (a: Member, b: Member) => (a.role === b.role ? a.name.localeCompare(b.name, 'fr') : a.role === 'owner' ? -1 : 1);

type MembershipRow = { role: ClubRole; clubs: { id: string; name: string } };
type MemberRow = { user_id: string; role: ClubRole; joined_at: string; profiles: { display_name: string } | null };

export function supabaseClubs(client: SupabaseClient): ClubsApi {
  return {
    async mine(userId) {
      const { data, error } = await client.from('club_members').select('role, clubs(id, name)').eq('user_id', userId);
      if (error) fail(error);
      return ((data ?? []) as unknown as MembershipRow[]).map((r) => ({ clubId: r.clubs.id, clubName: r.clubs.name, role: r.role })).sort(byClubName);
    },
    async create(clubName, teamName) {
      const { data, error } = await client.rpc('create_club', { club_name: clubName.trim(), team_name: teamName.trim() });
      if (error) fail(error);
      return data as string;
    },
    async inviteInfo(token) {
      const { data, error } = await client.rpc('invite_info', { invite_token: token });
      if (error) fail(error);
      const row = ((data ?? []) as { club_id: string; club_name: string }[])[0];
      return row ? { clubId: row.club_id, clubName: row.club_name } : null;
    },
    async join(token) {
      const { data, error } = await client.rpc('join_club', { invite_token: token });
      if (error) fail(error);
      return data as string;
    },
    async members(clubId) {
      const { data, error } = await client.from('club_members').select('user_id, role, joined_at, profiles(display_name)').eq('club_id', clubId);
      if (error) fail(error);
      return ((data ?? []) as unknown as MemberRow[])
        .map((r) => ({ userId: r.user_id, name: r.profiles?.display_name || '—', role: r.role, joinedAt: r.joined_at }))
        .sort(ownersFirst);
    },
    async setRole(clubId, userId, role) {
      const { error } = await client.from('club_members').update({ role }).eq('club_id', clubId).eq('user_id', userId);
      if (error) fail(error);
    },
    async remove(clubId, userId) {
      const { error } = await client.from('club_members').delete().eq('club_id', clubId).eq('user_id', userId);
      if (error) fail(error);
    },
    async rename(clubId, name) {
      const { error } = await client.from('clubs').update({ name: name.trim() }).eq('id', clubId);
      if (error) fail(error);
    },
    async invite(clubId) {
      const { data, error } = await client.rpc('club_invite', { club: clubId });
      if (error) fail(error);
      return data as string;
    },
    async regenerateInvite(clubId) {
      const { data, error } = await client.rpc('regenerate_invite', { club: clubId });
      if (error) fail(error);
      return data as string;
    },
  };
}
```

`src/teams/api.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

export interface Team {
  id: string;
  club_id: string;
  name: string;
  archived_at: string | null;
}

/** The club already has a team with this name (case and outer spaces ignored). */
export class DuplicateTeamError extends Error {}

export interface TeamsApi {
  list(clubId: string): Promise<Team[]>;
  add(clubId: string, name: string): Promise<Team>;
  rename(id: string, name: string): Promise<Team>;
  setArchived(id: string, archived: boolean): Promise<Team>;
}

const COLS = 'id,club_id,name,archived_at';
export const byTeamName = (a: Team, b: Team) => a.name.localeCompare(b.name, 'fr');
const fail = (e: { code?: string; message: string }): never => {
  throw e.code === '23505' ? new DuplicateTeamError(e.message) : new Error(e.message);
};

export function supabaseTeams(client: SupabaseClient): TeamsApi {
  return {
    async list(clubId) {
      const { data, error } = await client.from('teams').select(COLS).eq('club_id', clubId);
      if (error) fail(error);
      return ((data ?? []) as Team[]).sort(byTeamName);
    },
    async add(clubId, name) {
      const { data, error } = await client.from('teams').insert({ club_id: clubId, name: name.trim() }).select(COLS).single();
      if (error) fail(error);
      return data as Team;
    },
    async rename(id, name) {
      const { data, error } = await client.from('teams').update({ name: name.trim() }).eq('id', id).select(COLS).single();
      if (error) fail(error);
      return data as Team;
    },
    async setArchived(id, archived) {
      const { data, error } = await client
        .from('teams')
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq('id', id)
        .select(COLS)
        .single();
      if (error) fail(error);
      return data as Team;
    },
  };
}
```

`src/events/SyncContext.tsx` — `SyncDeps` gains `clubs: ClubsApi; teams: TeamsApi`; `defaultSyncDeps` adds `clubs: supabaseClubs(supabase), teams: supabaseTeams(supabase)` (imports from `../clubs/api` and `../teams/api`).

- [ ] **Step 4: Implement settings, provider and hook**

`src/settings.ts` — add (import `type Membership` from `./clubs/api`):

```ts
export const loadMemberships = (userId: string): Membership[] => readJson<Membership[]>(`memberships:${userId}`) ?? [];
export const saveMemberships = (userId: string, list: Membership[]): void => store.set(`memberships:${userId}`, JSON.stringify(list));
export const loadCurrentClub = (userId: string): string | null => store.get(`club:${userId}`);
export const saveCurrentClub = (userId: string, clubId: string): void => store.set(`club:${userId}`, clubId);
```

`src/clubs/ClubContext.tsx`:

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSync } from '../events/SyncContext';
import { loadCurrentClub, loadMemberships, saveCurrentClub, saveMemberships } from '../settings';
import type { Membership } from './api';

export interface ClubState {
  /** 'error': no copy on the device and the server could not be reached. */
  status: 'loading' | 'ready' | 'error';
  memberships: Membership[];
  /** The remembered club if still a membership, else the first one; null when the account has no club. */
  current: Membership | null;
  select(clubId: string): void;
  reload(): Promise<void>;
}

const Ctx = createContext<ClubState | null>(null);

/** `initial` skips the first server read (tests only). The last list seen is kept on the device for offline starts. */
export function ClubProvider({ userId, initial, children }: { userId: string; initial?: Membership[]; children: ReactNode }) {
  const { clubs } = useSync();
  const [memberships, setMemberships] = useState<Membership[]>(() => initial ?? loadMemberships(userId));
  const [status, setStatus] = useState<ClubState['status']>(() => (initial || loadMemberships(userId).length > 0 ? 'ready' : 'loading'));
  const [currentId, setCurrentId] = useState<string | null>(() => loadCurrentClub(userId));

  const reload = useCallback(async () => {
    try {
      const list = await clubs.mine(userId);
      saveMemberships(userId, list);
      setMemberships(list);
      setStatus('ready');
    } catch {
      setStatus((s) => (s === 'ready' ? 'ready' : 'error'));
    }
  }, [clubs, userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const select = useCallback(
    (clubId: string) => {
      saveCurrentClub(userId, clubId);
      setCurrentId(clubId);
    },
    [userId],
  );

  const value = useMemo<ClubState>(() => {
    const current = memberships.find((m) => m.clubId === currentId) ?? memberships[0] ?? null;
    return { status, memberships, current, select, reload };
  }, [status, memberships, currentId, select, reload]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useClub(): ClubState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useClub must be used inside ClubProvider');
  return v;
}
```

`src/teams/useTeams.ts`:

```ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSync } from '../events/SyncContext';
import { byTeamName, type Team } from './api';

export interface TeamsState {
  teams: Team[];
  /** Not archived: the ones offered when creating a game. */
  active: Team[];
  loading: boolean;
  error: boolean;
  reload(): Promise<void>;
  add(name: string): Promise<Team>;
  rename(id: string, name: string): Promise<Team>;
  setArchived(id: string, archived: boolean): Promise<Team>;
}

export function useTeams(clubId: string | undefined): TeamsState {
  const { teams: api } = useSync();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const listRef = useRef<Team[]>([]);
  const alive = useRef(true);

  const remember = useCallback((list: Team[]) => {
    listRef.current = list;
    setTeams(list);
  }, []);

  const reload = useCallback(async () => {
    if (!clubId) return;
    try {
      const list = await api.list(clubId);
      if (!alive.current) return;
      remember(list);
      setError(false);
    } catch {
      if (alive.current) setError(true);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [api, clubId, remember]);

  useEffect(() => {
    alive.current = true;
    remember([]);
    setLoading(true);
    void reload();
    return () => {
      alive.current = false;
    };
  }, [reload, remember]);

  const replace = useCallback((x: Team) => remember(listRef.current.map((y) => (y.id === x.id ? x : y)).sort(byTeamName)), [remember]);

  const add = useCallback(
    async (name: string) => {
      if (!clubId) throw new Error('no club');
      const x = await api.add(clubId, name);
      if (alive.current) remember([...listRef.current, x].sort(byTeamName));
      return x;
    },
    [api, clubId, remember],
  );
  const rename = useCallback(
    async (id: string, name: string) => {
      const x = await api.rename(id, name);
      if (alive.current) replace(x);
      return x;
    },
    [api, replace],
  );
  const setArchived = useCallback(
    async (id: string, archived: boolean) => {
      const x = await api.setArchived(id, archived);
      if (alive.current) replace(x);
      return x;
    },
    [api, replace],
  );

  const active = useMemo(() => teams.filter((x) => !x.archived_at), [teams]);
  return { teams, active, loading, error, reload, add, rename, setArchived };
}
```

- [ ] **Step 5: Implement the fakes and the club-aware test shell**

`src/test/fakes.tsx` — add (imports: `ClubProvider` from `../clubs/ClubContext`; `InvalidInviteError, LastOwnerError, type ClubRole, type ClubsApi, type Member, type Membership` from `../clubs/api`; `DuplicateTeamError, type Team, type TeamsApi` from `../teams/api`):

```tsx
export const DEFAULT_TEAM: Team = { id: 'team-1', club_id: 'club-1', name: 'N2', archived_at: null };
export const DEFAULT_MEMBERSHIP: Membership = { clubId: 'club-1', clubName: 'Aix', role: 'owner' };

export function fakeTeams(initial: Team[] = [DEFAULT_TEAM]) {
  const list = initial.map((x) => ({ ...x }));
  let failing = false;
  let n = 0;
  const guard = () => {
    if (failing) throw new Error('down');
  };
  const clash = (clubId: string, name: string, except?: string) =>
    list.some((x) => x.club_id === clubId && x.id !== except && x.name.trim().toLowerCase() === name.trim().toLowerCase());
  const find = (id: string) => {
    const x = list.find((y) => y.id === id);
    if (!x) throw new Error('unknown team');
    return x;
  };
  const api: TeamsApi = {
    async list(clubId) {
      guard();
      return list.filter((x) => x.club_id === clubId).map((x) => ({ ...x })).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    },
    async add(clubId, name) {
      guard();
      if (clash(clubId, name)) throw new DuplicateTeamError('duplicate');
      const x = { id: `team-new-${++n}`, club_id: clubId, name: name.trim(), archived_at: null };
      list.push(x);
      return { ...x };
    },
    async rename(id, name) {
      guard();
      const x = find(id);
      if (clash(x.club_id, name, id)) throw new DuplicateTeamError('duplicate');
      x.name = name.trim();
      return { ...x };
    },
    async setArchived(id, archived) {
      guard();
      const x = find(id);
      x.archived_at = archived ? '2026-10-15T12:00:00Z' : null;
      return { ...x };
    },
  };
  return { api, list, setFailing: (v: boolean) => (failing = v) };
}

type FakeMember = Member & { clubId: string };

export function fakeClubs(teams: Team[], me: () => string) {
  const clubs = [{ id: 'club-1', name: 'Aix' }];
  const members: FakeMember[] = [{ clubId: 'club-1', userId: TEST_USER.id, name: TEST_USER.name, role: 'owner', joinedAt: '2026-10-01T00:00:00Z' }];
  const invites = new Map<string, string>([['club-1', 'token-club-1']]);
  let failing = false;
  let n = 1;
  const guard = () => {
    if (failing) throw new Error('down');
  };
  const clubName = (id: string) => clubs.find((c) => c.id === id)?.name ?? '?';
  const findMember = (clubId: string, userId: string) => {
    const m = members.find((x) => x.clubId === clubId && x.userId === userId);
    if (!m) throw new Error('unknown member');
    return m;
  };
  const otherOwner = (clubId: string, userId: string) => members.some((x) => x.clubId === clubId && x.role === 'owner' && x.userId !== userId);
  const api: ClubsApi = {
    async mine(userId) {
      guard();
      return members
        .filter((m) => m.userId === userId)
        .map((m) => ({ clubId: m.clubId, clubName: clubName(m.clubId), role: m.role }))
        .sort((a, b) => a.clubName.localeCompare(b.clubName, 'fr'));
    },
    async create(name, teamName) {
      guard();
      const id = `club-${++n}`;
      clubs.push({ id, name: name.trim() });
      members.push({ clubId: id, userId: me(), name: TEST_USER.name, role: 'owner', joinedAt: '2026-10-15T00:00:00Z' });
      teams.push({ id: `team-${id}`, club_id: id, name: teamName.trim(), archived_at: null });
      invites.set(id, `token-${id}`);
      return id;
    },
    async inviteInfo(token) {
      guard();
      const hit = [...invites].find(([, tok]) => tok === token);
      return hit ? { clubId: hit[0], clubName: clubName(hit[0]) } : null;
    },
    async join(token) {
      guard();
      const hit = [...invites].find(([, tok]) => tok === token);
      if (!hit) throw new InvalidInviteError('invalid invite');
      if (!members.some((m) => m.clubId === hit[0] && m.userId === me())) {
        members.push({ clubId: hit[0], userId: me(), name: TEST_USER.name, role: 'member', joinedAt: '2026-10-15T00:00:00Z' });
      }
      return hit[0];
    },
    async members(clubId) {
      guard();
      return members
        .filter((m) => m.clubId === clubId)
        .map(({ userId, name, role, joinedAt }) => ({ userId, name, role, joinedAt }))
        .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name, 'fr') : a.role === 'owner' ? -1 : 1));
    },
    async setRole(clubId, userId, role: ClubRole) {
      guard();
      const m = findMember(clubId, userId);
      if (m.role === 'owner' && role !== 'owner' && !otherOwner(clubId, userId)) throw new LastOwnerError('last owner');
      m.role = role;
    },
    async remove(clubId, userId) {
      guard();
      const m = findMember(clubId, userId);
      if (m.role === 'owner' && !otherOwner(clubId, userId)) throw new LastOwnerError('last owner');
      members.splice(members.indexOf(m), 1);
    },
    async rename(clubId, name) {
      guard();
      const c = clubs.find((x) => x.id === clubId);
      if (c) c.name = name.trim();
    },
    async invite(clubId) {
      guard();
      return invites.get(clubId) ?? '';
    },
    async regenerateInvite(clubId) {
      guard();
      const tok = `token-${clubId}-${++n}`;
      invites.set(clubId, tok);
      return tok;
    },
  };
  return { api, clubs, members, invites, setFailing: (v: boolean) => (failing = v) };
}
```

Update `makeDeps` (add the `teams` option) and `renderWithSync` (add the `memberships` option):

```tsx
export function makeDeps(opts: { games?: Game[]; goalies?: Goalie[]; teams?: Team[]; user?: User | null } = {}) {
  const fr = fakeRemote();
  const fg = fakeGames(opts.games);
  const fgo = fakeGoalies(opts.goalies);
  const fa = fakeAuth(opts.user === undefined ? TEST_USER : opts.user);
  const ft = fakeTeams(opts.teams);
  const fc = fakeClubs(ft.list, () => fa.userId());
  const deps: SyncDeps = {
    store: new EventStore(memoryKV()), remote: fr.remote, games: fg.api, goalies: fgo.api, auth: fa.api, clubs: fc.api, teams: ft.api,
  };
  return { deps, fr, fg, fgo, fa, ft, fc };
}

export function renderWithSync(ui: ReactElement, deps: SyncDeps, opts: { user?: User | null; memberships?: Membership[] } = {}) {
  const user = opts.user === undefined ? TEST_USER : opts.user;
  return render(
    <SyncProvider deps={deps}>
      <AuthProvider initialUser={user}>
        {user ? (
          <ClubProvider userId={user.id} initial={opts.memberships ?? [DEFAULT_MEMBERSHIP]}>
            {ui}
          </ClubProvider>
        ) : (
          ui
        )}
      </AuthProvider>
    </SyncProvider>,
  );
}
```

Test files that build `SyncDeps` by hand get `clubs: fakeClubs([], () => TEST_USER.id).api, teams: fakeTeams().api` as well.

- [ ] **Step 6: Run the tests**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/clubs src/teams src/settings.ts src/settings.test.ts src/events/SyncContext.tsx src/test/fakes.tsx
git add -u src
git commit -m "feat(clubs): clubs and teams APIs, current-club provider with offline cache, team hook"
```

---

### Task 5: App gate, onboarding and the invitation screen

**Files:**
- Create: `src/screens/Onboarding.tsx`, `src/screens/JoinScreen.tsx`, `src/App.test.tsx`, `src/screens/JoinScreen.test.tsx`
- Modify: `src/App.tsx`, `src/i18n/fr.ts`, `src/test/fakes.tsx`

**Interfaces:**
- Consumes: `useAuth` (Task 3); `ClubProvider`, `useClub`, `ClubsApi`, `InvalidInviteError` (Task 4); `loadPendingInvite`, `clearPendingInvite` (Task 3).
- Produces: `Onboarding()`, `JoinScreen({ token })`; `renderApp(deps, user)` in fakes (renders `App` inside `SyncProvider` + `AuthProvider initialUser`, without a `ClubProvider`: `App` owns it).

- [ ] **Step 1: Write the failing tests**

`src/test/fakes.tsx` — add (import `App` from `../App`):

```tsx
export function renderApp(deps: SyncDeps, user: User | null = TEST_USER) {
  return render(
    <SyncProvider deps={deps}>
      <AuthProvider initialUser={user}>
        <App />
      </AuthProvider>
    </SyncProvider>,
  );
}
```

`src/App.test.tsx`:

```tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { t } from './i18n/fr';
import { savePendingInvite } from './settings';
import { makeDeps, renderApp, TEST_USER } from './test/fakes';

describe('App gate', () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '';
  });

  it('shows the login screen when signed out', () => {
    renderApp(makeDeps({ user: null }).deps, null);
    expect(screen.getByRole('button', { name: t.auth.google })).toBeInTheDocument();
  });

  it('shows the onboarding when the account has no club', async () => {
    const d = makeDeps();
    d.fc.members.length = 0;
    renderApp(d.deps);
    expect(await screen.findByRole('heading', { name: t.onboarding.createTitle })).toBeInTheDocument();
  });

  it('creates a club with its first team and opens it', async () => {
    const d = makeDeps();
    d.fc.members.length = 0;
    renderApp(d.deps);
    await userEvent.type(await screen.findByLabelText(t.onboarding.clubName), 'Rouen');
    await userEvent.type(screen.getByLabelText(t.onboarding.teamName), 'N1');
    await userEvent.click(screen.getByRole('button', { name: t.onboarding.create }));
    expect(await screen.findByRole('heading', { name: t.home.newGame })).toBeInTheDocument();
    expect(d.ft.list.some((x) => x.name === 'N1')).toBe(true);
    expect(localStorage.getItem(`club:${TEST_USER.id}`)).toBe('club-2');
  });

  it('returns to the invitation after the Google round trip', async () => {
    const d = makeDeps();
    d.fc.members.length = 0;
    savePendingInvite('token-club-1');
    renderApp(d.deps);
    expect(await screen.findByText(t.join.question('Aix'))).toBeInTheDocument();
    expect(window.location.hash).toBe('#/rejoindre/token-club-1');
  });

  it('opens the home of the current club', async () => {
    renderApp(makeDeps().deps);
    expect(await screen.findByRole('heading', { name: t.home.newGame })).toBeInTheDocument();
  });

  it('explains when the clubs cannot be loaded and retries', async () => {
    const d = makeDeps();
    d.fc.setFailing(true);
    renderApp(d.deps);
    expect(await screen.findByText(t.errors.server)).toBeInTheDocument();
    d.fc.setFailing(false);
    await userEvent.click(screen.getByRole('button', { name: t.ui.retry }));
    await waitFor(() => expect(screen.getByRole('heading', { name: t.home.newGame })).toBeInTheDocument());
  });
});
```

`src/screens/JoinScreen.test.tsx`:

```tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { t } from '../i18n/fr';
import { makeDeps, renderApp, TEST_USER } from '../test/fakes';

describe('JoinScreen', () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '';
  });

  it('joins the club after confirmation and opens it', async () => {
    const d = makeDeps();
    await d.fc.api.create('Maisons-Laffitte', 'U20'); // club-2, token-club-2
    d.fc.members.splice(d.fc.members.findIndex((m) => m.clubId === 'club-2'), 1); // TEST_USER not in club-2
    window.location.hash = '#/rejoindre/token-club-2';
    renderApp(d.deps);
    await userEvent.click(await screen.findByRole('button', { name: t.join.confirm }));
    await waitFor(() => expect(window.location.hash).toBe('#/'));
    expect(d.fc.members.some((m) => m.clubId === 'club-2' && m.userId === TEST_USER.id && m.role === 'member')).toBe(true);
    expect(localStorage.getItem(`club:${TEST_USER.id}`)).toBe('club-2');
  });

  it('says so when already a member', async () => {
    window.location.hash = '#/rejoindre/token-club-1';
    renderApp(makeDeps().deps);
    expect(await screen.findByText(t.join.already('Aix'))).toBeInTheDocument();
  });

  it('explains an invalid or regenerated link', async () => {
    window.location.hash = '#/rejoindre/old-token';
    renderApp(makeDeps().deps);
    expect(await screen.findByText(t.join.invalid)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/App.test.tsx src/screens/JoinScreen.test.tsx`
Expected: FAIL (`t.onboarding`, `t.join`, `t.ui.retry` undefined; screens missing).

- [ ] **Step 3: Add the strings**

`src/i18n/fr.ts` — add top-level keys:

```ts
  onboarding: {
    title: 'Bienvenue',
    createTitle: 'Créer mon club',
    clubName: 'Nom du club',
    teamName: 'Nom de la première équipe',
    teamHint: "Par exemple N2 ou U17. Vous pourrez en ajouter d'autres.",
    create: 'Créer le club',
    invitedTitle: "J'ai été invité",
    invitedText: "Demandez le lien d'invitation au responsable de votre club, puis ouvrez-le sur cet appareil.",
  },
  join: {
    title: 'Invitation',
    question: (club: string) => `Rejoindre le club ${club} ?`,
    confirm: 'Rejoindre',
    invalid: "Ce lien d'invitation n'est plus valable. Demandez-en un nouveau au responsable du club.",
    already: (club: string) => `Vous êtes déjà membre du club ${club}.`,
    open: 'Ouvrir le club',
  },
```

and extend `ui`: `ui: { close: '✕', retry: 'Réessayer' },`.

- [ ] **Step 4: Implement the screens**

`src/screens/Onboarding.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import { useClub } from '../clubs/ClubContext';
import { useSync } from '../events/SyncContext';
import { t } from '../i18n/fr';
import { navigate } from '../router';

export function Onboarding() {
  const { clubs } = useSync();
  const club = useClub();
  const [name, setName] = useState('');
  const [team, setTeam] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !name.trim() || !team.trim()) return;
    setBusy(true);
    setError(false);
    try {
      const id = await clubs.create(name, team);
      await club.reload();
      club.select(id);
      navigate({ name: 'home' });
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <header className="topbar">
        <h1>{t.onboarding.title}</h1>
      </header>
      {error && (
        <p className="notice" role="alert">
          {t.errors.server}
        </p>
      )}
      <div className="grid">
        <section className="card stack">
          <h2>{t.onboarding.createTitle}</h2>
          <form className="stack" onSubmit={submit}>
            <label className="field">
              {t.onboarding.clubName}
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
            </label>
            <label className="field">
              {t.onboarding.teamName}
              <input className="input" value={team} onChange={(e) => setTeam(e.target.value)} required maxLength={60} />
            </label>
            <p className="muted">{t.onboarding.teamHint}</p>
            <button className="btn btn--primary" type="submit" disabled={busy}>
              {t.onboarding.create}
            </button>
          </form>
        </section>
        <section className="card stack">
          <h2>{t.onboarding.invitedTitle}</h2>
          <p>{t.onboarding.invitedText}</p>
        </section>
      </div>
    </main>
  );
}
```

`src/screens/JoinScreen.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { InvalidInviteError } from '../clubs/api';
import { useClub } from '../clubs/ClubContext';
import { useSync } from '../events/SyncContext';
import { t } from '../i18n/fr';
import { navigate } from '../router';

type State = { status: 'loading' } | { status: 'invalid' } | { status: 'error' } | { status: 'ready'; clubId: string; clubName: string };

export function JoinScreen({ token }: { token: string }) {
  const { clubs } = useSync();
  const club = useClub();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    clubs
      .inviteInfo(token)
      .then((info) => {
        if (alive) setState(info ? { status: 'ready', ...info } : { status: 'invalid' });
      })
      .catch(() => {
        if (alive) setState({ status: 'error' });
      });
    return () => {
      alive = false;
    };
  }, [clubs, token]);

  function open(clubId: string) {
    club.select(clubId);
    navigate({ name: 'home' });
  }

  async function join() {
    if (state.status !== 'ready' || busy) return;
    setBusy(true);
    try {
      const id = await clubs.join(token);
      await club.reload();
      open(id);
    } catch (e) {
      setState(e instanceof InvalidInviteError ? { status: 'invalid' } : { status: 'error' });
      setBusy(false);
    }
  }

  const already = state.status === 'ready' && club.memberships.some((m) => m.clubId === state.clubId);

  return (
    <main className="page">
      <header className="topbar">
        <h1>{t.join.title}</h1>
      </header>
      <section className="card stack">
        {state.status === 'loading' && <p className="muted">{t.errors.loading}</p>}
        {state.status === 'invalid' && (
          <p className="notice" role="alert">
            {t.join.invalid}
          </p>
        )}
        {state.status === 'error' && (
          <p className="notice" role="alert">
            {t.errors.server}
          </p>
        )}
        {state.status === 'ready' && already && (
          <>
            <p>{t.join.already(state.clubName)}</p>
            <button type="button" className="btn btn--primary" onClick={() => open(state.clubId)}>
              {t.join.open}
            </button>
          </>
        )}
        {state.status === 'ready' && !already && (
          <>
            <h2>{t.join.question(state.clubName)}</h2>
            <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void join()}>
              {t.join.confirm}
            </button>
          </>
        )}
        {state.status !== 'ready' && state.status !== 'loading' && (
          <a className="btn" href="#/">
            {t.nav.home}
          </a>
        )}
      </section>
    </main>
  );
}
```

`src/App.tsx` — replace the signed-in branch with the club gate:

```tsx
import { useEffect, useState } from 'react';
import { useAuth } from './auth/AuthContext';
import { ClubProvider, useClub } from './clubs/ClubContext';
import { t } from './i18n/fr';
import { navigate, useRoute } from './router';
import { Home } from './screens/Home';
import { JoinScreen } from './screens/JoinScreen';
import { Login } from './screens/Login';
import { Onboarding } from './screens/Onboarding';
import { RecordScreen } from './screens/record/RecordScreen';
import { ReportScreen } from './screens/report/ReportScreen';
import { SeasonScreen } from './screens/SeasonScreen';
import { clearPendingInvite, loadPendingInvite } from './settings';

export function Splash() {
  return (
    <main className="page">
      <p className="muted">{t.errors.loading}</p>
    </main>
  );
}

function SignedIn() {
  const route = useRoute();
  const club = useClub();
  // An invitation opened before the Google round trip: go back to it once, then forget it.
  const [pending, setPending] = useState(loadPendingInvite);
  useEffect(() => {
    if (!pending) return;
    clearPendingInvite();
    setPending(null);
    navigate({ name: 'join', token: pending });
  }, [pending]);

  if (route.name === 'join') return <JoinScreen key={route.token} token={route.token} />;
  if (pending) return <Splash />;
  if (club.status === 'loading') return <Splash />;
  if (club.status === 'error') {
    return (
      <main className="page">
        <p className="notice" role="alert">
          {t.errors.server}
        </p>
        <div className="row">
          <button type="button" className="btn" onClick={() => void club.reload()}>
            {t.ui.retry}
          </button>
        </div>
      </main>
    );
  }
  if (!club.current) return <Onboarding />;
  switch (route.name) {
    case 'record':
      return <RecordScreen key={route.code} code={route.code} />;
    case 'report':
      return <ReportScreen key={route.code} code={route.code} />;
    case 'season':
      return <SeasonScreen key={club.current.clubId} />;
    default:
      return <Home key={club.current.clubId} />;
  }
}

export function App() {
  const { state } = useAuth();
  const route = useRoute();
  if (state.status === 'loading') return <Splash />;
  if (state.status === 'signedOut') return <Login error={state.error} inviteToken={route.name === 'join' ? route.token : null} />;
  return (
    <ClubProvider key={state.user.id} userId={state.user.id}>
      <SignedIn />
    </ClubProvider>
  );
}
```

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: all PASS. (Home still lists every game: scoping comes in Task 6.)

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/screens/Onboarding.tsx src/screens/JoinScreen.tsx src/screens/JoinScreen.test.tsx src/i18n/fr.ts src/test/fakes.tsx
git commit -m "feat(clubs): club gate, onboarding (create a club) and invitation screen"
```

---

### Task 6: Club-scoped data — games, goalies, season, team picker

**Files:**
- Create: `src/screens/home/TeamPicker.tsx`
- Modify: `src/domain/types.ts`, `src/games/api.ts`, `src/goalies/api.ts`, `src/goalies/useGoalies.ts`, `src/events/remote.ts`, `src/settings.ts`, `src/screens/Home.tsx`, `src/screens/SeasonScreen.tsx`, `src/screens/record/Recorder.tsx`, `src/screens/report/ReportScreen.tsx`, `src/i18n/fr.ts`, `src/test/fakes.tsx`, `src/test/builders.ts`
- Test: `src/screens/Home.test.tsx`, `src/goalies/useGoalies.test.tsx`, `src/screens/SeasonScreen.test.tsx`, `src/settings.test.ts`, `src/games/api.test.ts`, `src/events/remote.test.ts`

**Interfaces:**
- Consumes: `useClub` (Task 4), `useTeams`, `Team`, `DuplicateTeamError` (Task 4).
- Produces:
  - `Game` gains `club_id?: string; team_id?: string` (optional: a game cached by v2 has neither).
  - `Goalie` gains `club_id?: string`.
  - `NewGame` gains `club_id: string; team_id: string`. `GamesApi.list(clubId: string)`.
  - `GoaliesApi.list(clubId: string)`, `GoaliesApi.add(clubId: string, name: string)`; `rename` unchanged.
  - `useGoalies(clubId: string | undefined)` (same `GoaliesState`; the device copy is kept per club).
  - `Remote.fetchGamesEvents(codes: string[]): Promise<GameEvent[]>` replaces `fetchAllEvents()` (live events of those games only).
  - `settings`: `loadCachedGoalies(clubId)`, `saveCachedGoalies(clubId, list)`, `loadLastTeam(clubId)`, `saveLastTeam(clubId, teamId)`; `loadTeamName` / `saveTeamName` removed.
  - `TeamPicker({ clubId, value, onChange })` with `value: Team | null`, `onChange: (t: Team | null) => void`.

- [ ] **Step 1: Write the failing tests**

`src/test/builders.ts` — `gameFx` gains `club_id: 'club-1', team_id: 'team-1'` in its defaults.

`src/screens/Home.test.tsx` — replace the test `'creates a game, shows its code and remembers the team name'` with:

```tsx
  it('creates a game for the chosen team and remembers it', async () => {
    const d = renderHome([]);
    const picker = await screen.findByLabelText(t.home.team);
    await waitFor(() => expect(picker).toHaveValue('team-1'));
    await userEvent.type(screen.getByLabelText(t.home.opponent), 'Rouen');
    await userEvent.click(screen.getByRole('button', { name: t.home.create }));
    expect(await screen.findByText('K7QX')).toBeInTheDocument();
    expect(d.fg.games[0]).toMatchObject({ club_id: 'club-1', team_id: 'team-1', team_name: 'N2', opponent: 'Rouen' });
    expect(localStorage.getItem('lastTeam:club-1')).toBe('team-1');
  });

  it('adds a team on the spot and selects it', async () => {
    renderHome([]);
    const picker = await screen.findByLabelText(t.home.team);
    await userEvent.selectOptions(picker, t.home.newTeam);
    await userEvent.type(screen.getByLabelText(t.home.newTeamName), 'U17');
    await userEvent.click(screen.getByRole('button', { name: t.home.addTeam }));
    await waitFor(() => expect(screen.getByRole('option', { name: 'U17' })).toBeInTheDocument());
    expect((screen.getByLabelText(t.home.team) as HTMLSelectElement).selectedOptions[0].text).toBe('U17');
  });

  it('refuses a team name the club already has', async () => {
    renderHome([]);
    await userEvent.selectOptions(await screen.findByLabelText(t.home.team), t.home.newTeam);
    await userEvent.type(screen.getByLabelText(t.home.newTeamName), ' n2 ');
    await userEvent.click(screen.getByRole('button', { name: t.home.addTeam }));
    expect(await screen.findByText(t.home.teamDuplicate)).toBeInTheDocument();
  });

  it('skips an archived remembered team', async () => {
    localStorage.setItem('lastTeam:club-1', 'team-old');
    const d = makeDeps({
      games: [],
      teams: [
        { id: 'team-old', club_id: 'club-1', name: 'N3', archived_at: '2026-01-01T00:00:00Z' },
        { id: 'team-1', club_id: 'club-1', name: 'N2', archived_at: null },
      ],
    });
    renderWithSync(<Home />, d.deps);
    const picker = await screen.findByLabelText(t.home.team);
    await waitFor(() => expect(picker).toHaveValue('team-1'));
    expect(screen.queryByRole('option', { name: 'N3' })).toBeNull();
  });

  it('lists only the games of the current club', async () => {
    renderHome([gameFx({ code: 'K7QX', opponent: 'Caen' }), gameFx({ code: 'ZZZZ', opponent: 'Paris', club_id: 'club-9' })]);
    expect(await screen.findByText('Caen')).toBeInTheDocument();
    expect(screen.queryByText('Paris')).toBeNull();
  });
```

and make `renderHome` return `d`. In the same file, remove any typing into a « Notre équipe » text input (the field is now a select).

`src/goalies/useGoalies.test.tsx` — every `useGoalies()` becomes `useGoalies('club-1')`. Add:

```tsx
  it('keeps a separate device copy per club', async () => {
    const { result } = setup(); // the file's existing helper rendering useGoalies('club-1') with one goalie
    await waitFor(() => expect(result.current.goalies).toHaveLength(1));
    expect(JSON.parse(localStorage.getItem('goalies:club-1') ?? '[]')).toHaveLength(1);
    expect(localStorage.getItem('goalies:club-2')).toBeNull();
  });

  it('loads nothing without a club', async () => {
    const d = makeDeps({ goalies: [{ id: 'g1', name: 'Mallet', club_id: 'club-1' }] });
    const wrapper = ({ children }: { children: ReactNode }) => <SyncProvider deps={d.deps}>{children}</SyncProvider>;
    const { result } = renderHook(() => useGoalies(undefined), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.goalies).toEqual([]);
  });
```

`src/screens/SeasonScreen.test.tsx` — add:

```tsx
  it('only counts the games of the current club', async () => {
    const d = makeDeps({ games: [gameFx({ code: 'AAAA' }), gameFx({ code: 'BBBB', club_id: 'club-9', opponent: 'Ailleurs' })] });
    await d.fr.remote.push(shotEv('shot_for', 'goal', { game_code: 'AAAA' }));
    await d.fr.remote.push(shotEv('shot_for', 'goal', { game_code: 'BBBB' }));
    renderWithSync(<SeasonScreen />, d.deps);
    expect(await screen.findByRole('table', { name: t.season.byGame })).toBeInTheDocument();
    expect(screen.queryByText('Ailleurs')).toBeNull();
  });
```

`src/events/remote.test.ts` — replace any `fetchAllEvents` test with:

```ts
  it('fetches the events of the given games only, nothing for an empty list', async () => {
    const calls: string[][] = [];
    const client = {
      from: () => ({
        select: () => ({
          in: (_col: string, codes: string[]) => {
            calls.push(codes);
            return { is: () => ({ order: () => ({ range: async () => ({ data: [], error: null }) }) }) };
          },
        }),
      }),
    } as unknown as SupabaseClient;
    const r = supabaseRemote(client);
    expect(await r.fetchGamesEvents([])).toEqual([]);
    expect(calls).toEqual([]);
    await r.fetchGamesEvents(['AAAA', 'BBBB']);
    expect(calls).toEqual([['AAAA', 'BBBB']]);
  });
```

(import `type SupabaseClient` from `@supabase/supabase-js` if the file does not already).

`src/games/api.test.ts` and `src/goalies` tests: every existing `list()` call becomes `list('club-1')` and every goalies `add(name)` becomes `add('club-1', name)`; the inserted row for a game now includes `club_id` and `team_id` (assert them where the test inspects the insert payload).

`src/settings.test.ts` — delete the team-name test and its imports; add:

```ts
  it('keeps the goalie copy and the last team per club', () => {
    saveCachedGoalies('c1', [{ id: 'g', name: 'Mallet' }]);
    expect(loadCachedGoalies('c1')).toEqual([{ id: 'g', name: 'Mallet' }]);
    expect(loadCachedGoalies('c2')).toEqual([]);
    saveLastTeam('c1', 't1');
    expect(loadLastTeam('c1')).toBe('t1');
    expect(loadLastTeam('c2')).toBeNull();
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test`
Expected: FAIL on the new tests (no team select, `fetchGamesEvents` missing, settings exports missing) and type errors where signatures changed.

- [ ] **Step 3: Implement the data layer**

`src/domain/types.ts` — in `Game` after `overtime_possible`:

```ts
  /** v3: the club and team of the game. Absent only from a copy cached on the device by v2. */
  club_id?: string;
  team_id?: string;
```

and in `Goalie`: `club_id?: string;`.

`src/games/api.ts`:
- `NewGame` gains `club_id: string;` and `team_id: string;`.
- `GamesApi.list(clubId: string): Promise<Game[]>`.
- `COLS` becomes `'code,team_name,opponent,game_date,home,venue,competition,sheet_side,overtime_possible,club_id,team_id,created_at'`.
- `list(clubId)` adds `.eq('club_id', clubId)` right after `.select(COLS)`.

`src/goalies/api.ts`:
- `GoaliesApi`: `list(clubId: string): Promise<Goalie[]>; add(clubId: string, name: string): Promise<Goalie>;` (rename unchanged).
- `COLS = 'id,name,club_id,created_at'`.
- `list(clubId)`: `client.from('goalies').select(COLS).eq('club_id', clubId)`.
- `add(clubId, name)`: `client.from('goalies').insert({ club_id: clubId, name: name.trim() }).select(COLS).single()`.

`src/events/remote.ts` — in the interface replace `fetchAllEvents(): Promise<GameEvent[]>;` by:

```ts
  /** Live events of these games (the season view). Chunked so the request address stays short. */
  fetchGamesEvents(codes: string[]): Promise<GameEvent[]>;
```

and in `supabaseRemote` replace `fetchAllEvents()` by:

```ts
    async fetchGamesEvents(codes) {
      const out: GameEvent[] = [];
      for (let i = 0; i < codes.length; i += 100) {
        const chunk = codes.slice(i, i + 100);
        out.push(
          ...(await pageAll((from) =>
            client.from('events').select(COLS).in('game_code', chunk).is('deleted_at', null).order('id').range(from, from + PAGE - 1),
          )),
        );
      }
      return out;
    },
```

`src/settings.ts` — remove `loadTeamName`, `saveTeamName`, `loadCachedGoalies`, `saveCachedGoalies`, then add:

```ts
export const loadCachedGoalies = (clubId: string): Goalie[] => readJson<Goalie[]>(`goalies:${clubId}`) ?? [];
export const saveCachedGoalies = (clubId: string, g: Goalie[]): void => store.set(`goalies:${clubId}`, JSON.stringify(g));
export const loadLastTeam = (clubId: string): string | null => store.get(`lastTeam:${clubId}`);
export const saveLastTeam = (clubId: string, teamId: string): void => store.set(`lastTeam:${clubId}`, teamId);
```

`src/goalies/useGoalies.ts` — signature `useGoalies(clubId: string | undefined): GoaliesState`, and:
- initial state: `useState<Goalie[]>(() => (clubId ? loadCachedGoalies(clubId) : []))`;
- `remember` saves with `if (clubId) saveCachedGoalies(clubId, list);` (add `clubId` to its deps);
- `reload` starts with `if (!clubId) { setLoading(false); return; }` and calls `api.list(clubId)`;
- `add` calls `api.add(clubId, name)` after `if (!clubId) throw new Error('no club');`;
- the mount effect also resets the list when the club changes: first line `remember(clubId ? loadCachedGoalies(clubId) : []);` with `clubId` in the dependency list.

`src/test/fakes.tsx`:
- `fakeRemote`: rename `fetchAllEvents()` to `fetchGamesEvents(codes)` returning `[...rows.values()].filter((r) => codes.includes(r.game_code) && !r.deleted_at)`.
- `fakeGames.list(clubId)`: `return games.filter((g) => !g.club_id || g.club_id === clubId);`.
- `fakeGoalies.list(clubId)` filters `(g) => !g.club_id || g.club_id === clubId`; `add(clubId, name)` stores `club_id: clubId`.

- [ ] **Step 4: Implement the screens**

`src/i18n/fr.ts`:
- `home` gains `newTeam: '+ Nouvelle équipe…'`, `newTeamName: 'Nom de la nouvelle équipe'`, `addTeam: 'Ajouter'`, `teamDuplicate: 'Cette équipe existe déjà dans le club.'`, `noTeam: "Aucune équipe active : ajoutez-en une."`.
- `errors.unknownCode` becomes `"Code inconnu, ou match d'un club dont vous n'êtes pas membre."`.

`src/screens/home/TeamPicker.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { t } from '../../i18n/fr';
import { loadLastTeam } from '../../settings';
import { DuplicateTeamError, type Team } from '../../teams/api';
import { useTeams } from '../../teams/useTeams';

const NEW_TEAM = '__new__';

/** « Notre équipe »: the club's active teams, the last one used preselected, and « + Nouvelle équipe… ». */
export function TeamPicker({ clubId, value, onChange }: { clubId: string; value: Team | null; onChange: (team: Team | null) => void }) {
  const { active, loading, add } = useTeams(clubId);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Keep the selection valid: the remembered team may have been archived since.
  useEffect(() => {
    if (loading || (value && active.some((x) => x.id === value.id))) return;
    const remembered = active.find((x) => x.id === loadLastTeam(clubId));
    onChange(remembered ?? active[0] ?? null);
  }, [loading, active, value, clubId, onChange]);

  async function addTeam() {
    if (busy || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const team = await add(name);
      onChange(team);
      setAdding(false);
      setName('');
    } catch (e) {
      setError(e instanceof DuplicateTeamError ? t.home.teamDuplicate : t.errors.server);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <label className="field">
        {t.home.team}
        <select
          className="input"
          value={adding ? NEW_TEAM : (value?.id ?? '')}
          onChange={(e) => {
            if (e.target.value === NEW_TEAM) {
              setAdding(true);
              return;
            }
            setAdding(false);
            onChange(active.find((x) => x.id === e.target.value) ?? null);
          }}
        >
          {!loading && active.length === 0 && <option value="">{t.home.noTeam}</option>}
          {active.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
          <option value={NEW_TEAM}>{t.home.newTeam}</option>
        </select>
      </label>
      {adding && (
        <div className="row">
          <input
            className="input"
            aria-label={t.home.newTeamName}
            value={name}
            maxLength={60}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
          />
          <button type="button" className="btn" disabled={busy || !name.trim()} onClick={() => void addTeam()}>
            {t.home.addTeam}
          </button>
        </div>
      )}
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
```

`src/screens/Home.tsx`:
- Imports: replace `import { loadTeamName, saveTeamName, todayIso } from '../settings';` with `import { saveLastTeam, todayIso } from '../settings';`; add `import { useClub } from '../clubs/ClubContext';`, `import type { Team } from '../teams/api';`, `import { TeamPicker } from './home/TeamPicker';`.
- Replace `const roster = useGoalies();` with:
  ```tsx
  const { current } = useClub();
  const clubId = current?.clubId ?? '';
  const roster = useGoalies(clubId || undefined);
  ```
- Replace `const [team, setTeam] = useState(loadTeamName);` with `const [team, setTeam] = useState<Team | null>(null);`.
- The recent-games effect becomes:
  ```tsx
  useEffect(() => {
    if (!clubId) return;
    games.list(clubId).then(setRecent).catch(() => setError(t.errors.server));
  }, [games, clubId]);
  ```
- In `onCreate`: the guard becomes `if (!team || !opponent.trim()) return;`; replace `saveTeamName(team.trim());` with `saveLastTeam(clubId, team.id);`; in `games.create({...})` replace `team_name: team.trim(),` with `team_name: team.name, club_id: clubId, team_id: team.id,`.
- Replace the « Notre équipe » `<label className="field">…<input … value={team} …/></label>` block with `<TeamPicker clubId={clubId} value={team} onChange={setTeam} />`.

`src/screens/SeasonScreen.tsx`:
- Add `import { useClub } from '../clubs/ClubContext';` and at the top of the component `const { current } = useClub(); const clubId = current?.clubId;`.
- `load` becomes:
  ```tsx
  const load = useCallback(async () => {
    if (!clubId) return;
    setError(false);
    try {
      const g = await games.list(clubId);
      const e = await remote.fetchGamesEvents(g.map((x) => x.code));
      setData({ games: g, events: e });
    } catch {
      setError(true);
    }
  }, [games, remote, clubId]);
  ```
- `const { names } = useGoalies();` becomes `const { names } = useGoalies(clubId);`.

`src/screens/record/Recorder.tsx`: `useGoalies()` → `useGoalies(game.club_id)`.
`src/screens/report/ReportScreen.tsx`: `useGoalies()` → `useGoalies(game.club_id)`.

- [ ] **Step 5: Run the tests and the build**

Run: `npm test` then `npm run build`
Expected: all PASS; build succeeds (no remaining reference to `fetchAllEvents`, `loadTeamName`, `saveTeamName`: check with `grep -rn "fetchAllEvents\|TeamName(" src` → no output).

- [ ] **Step 6: Commit**

```bash
git add -A src
git commit -m "feat(clubs): games, goalies and season scoped to the current club, team picker"
```

---

### Task 7: Club switcher and account menu

**Files:**
- Create: `src/ui/ClubSwitcher.tsx`, `src/ui/AccountMenu.tsx`, `src/ui/AccountMenu.test.tsx`, `src/ui/ClubSwitcher.test.tsx`
- Modify: `src/screens/Home.tsx`, `src/i18n/fr.ts`

**Interfaces:**
- Consumes: `useClub` (Task 4), `useAuth` (Task 3), `useSync().store.pendingTotal()` (existing, `src/events/store.ts`).
- Produces: `ClubSwitcher()`, `AccountMenu()`.

- [ ] **Step 1: Write the failing tests**

`src/ui/ClubSwitcher.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { t } from '../i18n/fr';
import { makeDeps, renderWithSync, TEST_USER } from '../test/fakes';
import { ClubSwitcher } from './ClubSwitcher';

describe('ClubSwitcher', () => {
  beforeEach(() => localStorage.clear());

  it('shows only the club name with a single club', () => {
    renderWithSync(<ClubSwitcher />, makeDeps().deps);
    expect(screen.getByText('Aix')).toBeInTheDocument();
    expect(screen.queryByLabelText(t.clubs.switch)).toBeNull();
  });

  it('switches club when there are several', async () => {
    const d = makeDeps();
    await d.fc.api.create('Maisons-Laffitte', 'U20'); // the fake server agrees with the initial list below
    renderWithSync(<ClubSwitcher />, d.deps, {
      memberships: [
        { clubId: 'club-1', clubName: 'Aix', role: 'owner' },
        { clubId: 'club-2', clubName: 'Maisons-Laffitte', role: 'owner' },
      ],
    });
    await userEvent.selectOptions(await screen.findByLabelText(t.clubs.switch), 'Maisons-Laffitte');
    expect(localStorage.getItem(`club:${TEST_USER.id}`)).toBe('club-2');
  });
});
```

`src/ui/AccountMenu.test.tsx`:

```tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { t } from '../i18n/fr';
import { shotEv } from '../test/builders';
import { makeDeps, renderWithSync, TEST_USER } from '../test/fakes';
import { AccountMenu } from './AccountMenu';

describe('AccountMenu', () => {
  it('shows the account and signs out', async () => {
    const d = makeDeps();
    renderWithSync(<AccountMenu />, d.deps);
    await userEvent.click(screen.getByRole('button', { name: TEST_USER.name }));
    expect(screen.getByText(TEST_USER.email)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: t.account.signOut }));
    expect(d.fa.api.signOut).toHaveBeenCalledTimes(1);
  });

  it('warns before signing out with pending entries and keeps them', async () => {
    const d = makeDeps();
    d.fr.setOnline(false);
    await d.deps.store.add(shotEv('shot_for', 'goal', { game_code: 'K7QX' }));
    renderWithSync(<AccountMenu />, d.deps);
    await userEvent.click(screen.getByRole('button', { name: TEST_USER.name }));
    await userEvent.click(screen.getByRole('button', { name: t.account.signOut }));
    expect(await screen.findByText(t.account.pendingWarning(1))).toBeInTheDocument();
    expect(d.fa.api.signOut).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: t.account.signOutAnyway }));
    await waitFor(() => expect(d.fa.api.signOut).toHaveBeenCalledTimes(1));
    expect(await d.deps.store.pendingTotal()).toBe(1);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/ui`
Expected: FAIL (modules and strings missing).

- [ ] **Step 3: Implement**

`src/i18n/fr.ts` — add top-level keys:

```ts
  clubs: {
    switch: 'Club',
  },
  account: {
    signOut: 'Se déconnecter',
    pendingWarning: (n: number) =>
      `${n} saisie${n > 1 ? 's' : ''} pas encore envoyée${n > 1 ? 's' : ''}. Elle${n > 1 ? 's' : ''} reste${n > 1 ? 'nt' : ''} sur cet appareil et partir${n > 1 ? 'ont' : 'a'} à la prochaine connexion. Mieux vaut attendre le réseau.`,
    wait: 'Attendre',
    signOutAnyway: 'Se déconnecter quand même',
  },
```

`src/ui/ClubSwitcher.tsx`:

```tsx
import { useClub } from '../clubs/ClubContext';
import { t } from '../i18n/fr';

/** The current club; a selector only when the account belongs to several clubs. */
export function ClubSwitcher() {
  const { memberships, current, select } = useClub();
  if (!current) return null;
  if (memberships.length < 2) return <span className="chip">{current.clubName}</span>;
  return (
    <select className="input" aria-label={t.clubs.switch} value={current.clubId} onChange={(e) => select(e.target.value)}>
      {memberships.map((m) => (
        <option key={m.clubId} value={m.clubId}>
          {m.clubName}
        </option>
      ))}
    </select>
  );
}
```

`src/ui/AccountMenu.tsx`:

```tsx
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useSync } from '../events/SyncContext';
import { t } from '../i18n/fr';

/** The signed-in account. Signing out never touches the outbox: pending entries stay on the device. */
export function AccountMenu() {
  const { state, api } = useAuth();
  const { store } = useSync();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(0);
  if (state.status !== 'signedIn') return null;

  // Read the outbox at click time, not the background-sync counter, which may not have run yet.
  async function signOut() {
    const n = await store.pendingTotal();
    if (n === 0) {
      await api.signOut();
      return;
    }
    setPending(n);
    setConfirming(true);
  }

  return (
    <div className="stack">
      <button type="button" className="btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {state.user.name}
      </button>
      {open && (
        <div className="card stack">
          <span className="muted">{state.user.email}</span>
          {confirming ? (
            <>
              <p className="notice" role="alert">
                {t.account.pendingWarning(pending)}
              </p>
              <div className="row">
                <button type="button" className="btn btn--primary" onClick={() => setConfirming(false)}>
                  {t.account.wait}
                </button>
                <button type="button" className="btn" onClick={() => void api.signOut()}>
                  {t.account.signOutAnyway}
                </button>
              </div>
            </>
          ) : (
            <button type="button" className="btn" onClick={() => void signOut()}>
              {t.account.signOut}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

`src/screens/Home.tsx` — in the header, after `<h1>{t.appName}</h1>` add `<ClubSwitcher />`, and after the « Saison » link add `<AccountMenu />` (imports from `../ui/ClubSwitcher` and `../ui/AccountMenu`).

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/ClubSwitcher.tsx src/ui/ClubSwitcher.test.tsx src/ui/AccountMenu.tsx src/ui/AccountMenu.test.tsx src/screens/Home.tsx src/i18n/fr.ts
git commit -m "feat(clubs): club switcher and account menu with a pending-entries warning"
```

---

### Task 8: The « Club » tab

**Files:**
- Create: `src/screens/ClubPanel.tsx`, `src/screens/ClubPanel.test.tsx`
- Modify: `src/screens/Home.tsx`, `src/i18n/fr.ts`

**Interfaces:**
- Consumes: `ClubsApi`, `Member`, `LastOwnerError` (Task 4); `useClub` (Task 4); `useTeams`, `DuplicateTeamError` (Task 4); `useAuth` (Task 3); `href` (Task 3).
- Produces: `ClubPanel()`; Home tab `'club'`.

- [ ] **Step 1: Write the failing tests**

`src/screens/ClubPanel.test.tsx`:

```tsx
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { t } from '../i18n/fr';
import { makeDeps, renderWithSync, TEST_USER } from '../test/fakes';
import { ClubPanel } from './ClubPanel';

function withVolunteer() {
  const d = makeDeps();
  d.fc.members.push({ clubId: 'club-1', userId: 'user-2', name: 'Léa', role: 'member', joinedAt: '2026-10-10T00:00:00Z' });
  return d;
}

describe('ClubPanel — owner', () => {
  beforeEach(() => localStorage.clear());

  it('lists members with their roles', async () => {
    renderWithSync(<ClubPanel />, withVolunteer().deps);
    const list = await screen.findByRole('list', { name: t.club.members });
    expect(within(list).getByText(`${TEST_USER.name} ${t.club.you}`)).toBeInTheDocument();
    expect(within(list).getByText('Léa')).toBeInTheDocument();
    expect(within(list).getAllByText(t.club.roles.member)).toHaveLength(1);
  });

  it('shows the invitation link and regenerates it after confirmation', async () => {
    const d = withVolunteer();
    renderWithSync(<ClubPanel />, d.deps);
    const link = await screen.findByLabelText(t.club.invite);
    expect((link as HTMLInputElement).value).toMatch(/#\/rejoindre\/token-club-1$/);
    await userEvent.click(screen.getByRole('button', { name: t.club.regenerate }));
    expect(screen.getByText(t.club.regenerateConfirm)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: t.club.confirm }));
    await waitFor(() => expect((screen.getByLabelText(t.club.invite) as HTMLInputElement).value).not.toMatch(/token-club-1$/));
  });

  it('promotes and removes a member', async () => {
    const d = withVolunteer();
    renderWithSync(<ClubPanel />, d.deps);
    await userEvent.click(await screen.findByRole('button', { name: `${t.club.makeOwner} Léa` }));
    await waitFor(() => expect(d.fc.members.find((m) => m.userId === 'user-2')?.role).toBe('owner'));
    await userEvent.click(screen.getByRole('button', { name: `${t.club.remove} Léa` }));
    await userEvent.click(screen.getByRole('button', { name: t.club.confirm }));
    await waitFor(() => expect(d.fc.members.some((m) => m.userId === 'user-2')).toBe(false));
  });

  it('archives and reactivates a team', async () => {
    const d = withVolunteer();
    renderWithSync(<ClubPanel />, d.deps);
    await userEvent.click(await screen.findByRole('button', { name: `${t.club.archive} N2` }));
    await waitFor(() => expect(d.ft.list[0].archived_at).not.toBeNull());
    await userEvent.click(screen.getByRole('button', { name: `${t.club.unarchive} N2` }));
    await waitFor(() => expect(d.ft.list[0].archived_at).toBeNull());
  });

  it('explains why the last owner cannot leave', async () => {
    renderWithSync(<ClubPanel />, withVolunteer().deps);
    await userEvent.click(await screen.findByRole('button', { name: t.club.leave }));
    await userEvent.click(screen.getByRole('button', { name: t.club.confirm }));
    expect(await screen.findByText(t.club.lastOwner)).toBeInTheDocument();
  });
});

describe('ClubPanel — member', () => {
  it('hides the owner tools and lets the member leave', async () => {
    const d = withVolunteer();
    d.fc.members[0].role = 'member';
    d.fc.members[1].role = 'owner';
    renderWithSync(<ClubPanel />, d.deps, { memberships: [{ clubId: 'club-1', clubName: 'Aix', role: 'member' }] });
    await screen.findByRole('list', { name: t.club.members });
    expect(screen.queryByLabelText(t.club.invite)).toBeNull();
    expect(screen.queryByRole('button', { name: `${t.club.archive} N2` })).toBeNull();
    expect(screen.getByRole('button', { name: `${t.club.renameTeam} N2` })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: t.club.leave }));
    await userEvent.click(screen.getByRole('button', { name: t.club.confirm }));
    await waitFor(() => expect(d.fc.members.some((m) => m.userId === TEST_USER.id)).toBe(false));
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/screens/ClubPanel.test.tsx`
Expected: FAIL (module and `t.club` missing).

- [ ] **Step 3: Add the strings**

`src/i18n/fr.ts`:
- `home.tabClub: 'Club'`
- new top-level key:

```ts
  club: {
    members: 'Membres',
    you: '(vous)',
    roles: { owner: 'Responsable', member: 'Membre' },
    makeOwner: 'Nommer responsable',
    makeMember: 'Retirer le rôle de responsable',
    remove: 'Retirer du club',
    removeConfirm: (name: string) => `Retirer ${name} du club ?`,
    confirm: 'Confirmer',
    cancel: 'Annuler',
    invite: "Lien d'invitation",
    inviteHint: "Envoyez ce lien aux bénévoles : en l'ouvrant, ils rejoignent le club comme membres.",
    copy: 'Copier',
    copied: 'Lien copié',
    regenerate: 'Régénérer',
    regenerateConfirm: "L'ancien lien ne fonctionnera plus. Régénérer le lien ?",
    teams: 'Équipes',
    teamName: "Nom de l'équipe",
    addTeam: 'Ajouter une équipe',
    renameTeam: 'Renommer',
    save: 'Enregistrer',
    archive: 'Archiver',
    unarchive: 'Réactiver',
    archived: 'archivée',
    clubName: 'Nom du club',
    renameClub: 'Renommer le club',
    leave: 'Quitter le club',
    leaveConfirm: 'Quitter ce club ? Vous ne verrez plus ses matchs.',
    lastOwner: "Vous êtes le dernier responsable : nommez d'abord un autre responsable.",
  },
```

- [ ] **Step 4: Implement `src/screens/ClubPanel.tsx`**

```tsx
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { LastOwnerError, type ClubRole, type Member } from '../clubs/api';
import { useClub } from '../clubs/ClubContext';
import { useSync } from '../events/SyncContext';
import { t } from '../i18n/fr';
import { href, navigate } from '../router';
import { DuplicateTeamError } from '../teams/api';
import { useTeams } from '../teams/useTeams';

type Pending = { kind: 'remove'; member: Member } | { kind: 'regenerate' } | { kind: 'leave' } | null;

const inviteUrl = (token: string) => `${window.location.origin}${import.meta.env.BASE_URL}${href({ name: 'join', token })}`;

export function ClubPanel() {
  const { clubs } = useSync();
  const { state } = useAuth();
  const club = useClub();
  const me = state.status === 'signedIn' ? state.user.id : '';
  const clubId = club.current?.clubId ?? '';
  const owner = club.current?.role === 'owner';
  const teams = useTeams(clubId || undefined);
  const [members, setMembers] = useState<Member[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [newTeam, setNewTeam] = useState('');
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [teamDraft, setTeamDraft] = useState('');
  const [clubDraft, setClubDraft] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fail = (e: unknown) => setMessage(e instanceof LastOwnerError ? t.club.lastOwner : e instanceof DuplicateTeamError ? t.home.teamDuplicate : t.errors.server);

  const load = useCallback(async () => {
    if (!clubId) return;
    try {
      setMembers(await clubs.members(clubId));
      if (owner) setToken(await clubs.invite(clubId));
    } catch (e) {
      fail(e);
    }
  }, [clubs, clubId, owner]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<unknown>) {
    setMessage(null);
    try {
      await action();
      await load();
    } catch (e) {
      fail(e);
    }
  }

  async function confirm() {
    const p = pending;
    setPending(null);
    if (!p) return;
    if (p.kind === 'remove') await run(() => clubs.remove(clubId, p.member.userId));
    if (p.kind === 'regenerate') await run(async () => setToken(await clubs.regenerateInvite(clubId)));
    if (p.kind === 'leave') {
      setMessage(null);
      try {
        await clubs.remove(clubId, me);
        await club.reload();
        navigate({ name: 'home' });
      } catch (e) {
        fail(e);
      }
    }
  }

  async function addTeam(e: FormEvent) {
    e.preventDefault();
    if (!newTeam.trim()) return;
    await run(async () => {
      await teams.add(newTeam);
      setNewTeam('');
    });
  }

  const setRole = (m: Member, role: ClubRole) => run(() => clubs.setRole(clubId, m.userId, role));

  return (
    <section className="card stack">
      {message && (
        <p className="notice" role="alert">
          {message}
        </p>
      )}
      {pending && (
        <div className="notice stack" role="alert">
          <span>
            {pending.kind === 'remove' ? t.club.removeConfirm(pending.member.name) : pending.kind === 'regenerate' ? t.club.regenerateConfirm : t.club.leaveConfirm}
          </span>
          <div className="row">
            <button type="button" className="btn" onClick={() => void confirm()}>
              {t.club.confirm}
            </button>
            <button type="button" className="btn" onClick={() => setPending(null)}>
              {t.club.cancel}
            </button>
          </div>
        </div>
      )}

      {owner && (
        <section className="stack">
          <h2>{t.club.clubName}</h2>
          {clubDraft === null ? (
            <div className="row">
              <strong>{club.current?.clubName}</strong>
              <button type="button" className="btn" onClick={() => setClubDraft(club.current?.clubName ?? '')}>
                {t.club.renameClub}
              </button>
            </div>
          ) : (
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                if (!clubDraft.trim()) return;
                void run(async () => {
                  await clubs.rename(clubId, clubDraft);
                  await club.reload();
                  setClubDraft(null);
                });
              }}
            >
              <input className="input" aria-label={t.club.clubName} value={clubDraft} maxLength={80} onChange={(e) => setClubDraft(e.target.value)} />
              <button type="submit" className="btn btn--primary">
                {t.club.save}
              </button>
            </form>
          )}
        </section>
      )}

      <section className="stack">
        <h2>{t.club.members}</h2>
        <ul className="list" aria-label={t.club.members}>
          {members.map((m) => (
            <li key={m.userId}>
              <span>
                <strong>{m.userId === me ? `${m.name} ${t.club.you}` : m.name}</strong> <span className="muted">{t.club.roles[m.role]}</span>
              </span>
              {owner && m.userId !== me && (
                <span className="row">
                  <button type="button" className="btn" aria-label={`${m.role === 'owner' ? t.club.makeMember : t.club.makeOwner} ${m.name}`} onClick={() => void setRole(m, m.role === 'owner' ? 'member' : 'owner')}>
                    {m.role === 'owner' ? t.club.makeMember : t.club.makeOwner}
                  </button>
                  <button type="button" className="btn" aria-label={`${t.club.remove} ${m.name}`} onClick={() => setPending({ kind: 'remove', member: m })}>
                    {t.club.remove}
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {owner && token && (
        <section className="stack">
          <label className="field">
            {t.club.invite}
            <input className="input" readOnly value={inviteUrl(token)} onFocus={(e) => e.target.select()} />
          </label>
          <p className="muted">{t.club.inviteHint}</p>
          <div className="row">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                void navigator.clipboard?.writeText(inviteUrl(token)).then(() => setCopied(true));
              }}
            >
              {copied ? t.club.copied : t.club.copy}
            </button>
            <button type="button" className="btn" onClick={() => setPending({ kind: 'regenerate' })}>
              {t.club.regenerate}
            </button>
          </div>
        </section>
      )}

      <section className="stack">
        <h2>{t.club.teams}</h2>
        <ul className="list" aria-label={t.club.teams}>
          {teams.teams.map((x) => (
            <li key={x.id}>
              {editingTeam === x.id ? (
                <form
                  className="row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!teamDraft.trim()) return;
                    void run(async () => {
                      await teams.rename(x.id, teamDraft);
                      setEditingTeam(null);
                    });
                  }}
                >
                  <input className="input" aria-label={t.club.teamName} value={teamDraft} maxLength={60} onChange={(e) => setTeamDraft(e.target.value)} />
                  <button type="submit" className="btn btn--primary">
                    {t.club.save}
                  </button>
                </form>
              ) : (
                <>
                  <span>
                    {x.name} {x.archived_at && <span className="muted">{t.club.archived}</span>}
                  </span>
                  <span className="row">
                    <button
                      type="button"
                      className="btn"
                      aria-label={`${t.club.renameTeam} ${x.name}`}
                      onClick={() => {
                        setEditingTeam(x.id);
                        setTeamDraft(x.name);
                      }}
                    >
                      {t.club.renameTeam}
                    </button>
                    {owner && (
                      <button
                        type="button"
                        className="btn"
                        aria-label={`${x.archived_at ? t.club.unarchive : t.club.archive} ${x.name}`}
                        onClick={() => void run(() => teams.setArchived(x.id, !x.archived_at))}
                      >
                        {x.archived_at ? t.club.unarchive : t.club.archive}
                      </button>
                    )}
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
        <form className="row" onSubmit={(e) => void addTeam(e)}>
          <input className="input" aria-label={t.club.teamName} value={newTeam} maxLength={60} onChange={(e) => setNewTeam(e.target.value)} />
          <button type="submit" className="btn">
            {t.club.addTeam}
          </button>
        </form>
      </section>

      <div className="row">
        <button type="button" className="btn" onClick={() => setPending({ kind: 'leave' })}>
          {t.club.leave}
        </button>
      </div>
    </section>
  );
}
```

`src/screens/Home.tsx`:
- `type Tab = 'games' | 'goalies' | 'club';`
- in the `.seg` tab group add a third button:
  ```tsx
  <button type="button" aria-pressed={tab === 'club'} onClick={() => setTab('club')}>
    {t.home.tabClub}
  </button>
  ```
- the tab body becomes `{tab === 'goalies' ? <GoalieRoster roster={roster} /> : tab === 'club' ? <ClubPanel /> : (<div className="grid">…</div>)}` (import `ClubPanel` from `./ClubPanel`).

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/screens/ClubPanel.tsx src/screens/ClubPanel.test.tsx src/screens/Home.tsx src/i18n/fr.ts
git commit -m "feat(clubs): Club tab (members, roles, invitation link, teams, leave)"
```

---

### Task 9: Refused pushes stay in the outbox and are shown

**Files:**
- Modify: `src/events/remote.ts`, `src/events/outbox.ts`, `src/events/backgroundSync.ts`, `src/events/useGameEvents.ts`, `src/events/SyncContext.tsx`, `src/ui/SyncChip.tsx`, `src/screens/Home.tsx`, `src/screens/record/Recorder.tsx`, `src/screens/report/ReportScreen.tsx`, `src/i18n/fr.ts`, `src/test/fakes.tsx`
- Test: `src/events/outbox.test.ts`, `src/events/backgroundSync.test.ts`, `src/events/useGameEvents.test.tsx`

**Interfaces:**
- Produces:
  - `src/events/remote.ts`: `export class PushRefusedError extends Error {}`, thrown by `push` on SQLSTATE `42501`.
  - `flushOutbox(...)` result gains `refused: boolean` (the pass stopped on a `PushRefusedError`).
  - `BackgroundSync.refused(): boolean`; `useSyncRefused(): boolean` in `SyncContext.tsx`.
  - `GameEventsState.refused: boolean`.
  - `SyncChip({ pending, connected, refused? })`.
  - `fakeRemote` gains `setRefusing(v: boolean)`.

- [ ] **Step 1: Write the failing tests**

`src/events/outbox.test.ts` — add:

```ts
  it('reports a refused push and keeps the entry pending', async () => {
    const store = new EventStore(memoryKV());
    await store.add(shotEv('shot_for', 'goal', { game_code: 'K7QX' }));
    const r = await flushOutbox(store, async () => {
      throw new PushRefusedError('42501');
    }, 'K7QX');
    expect(r).toMatchObject({ pushed: 0, failed: true, refused: true });
    expect(r.events[0].sync).toBe('pending');
  });

  it('a network failure is not a refusal', async () => {
    const store = new EventStore(memoryKV());
    await store.add(shotEv('shot_for', 'goal', { game_code: 'K7QX' }));
    const r = await flushOutbox(store, async () => {
      throw new Error('offline');
    }, 'K7QX');
    expect(r.refused).toBe(false);
  });
```

(import `PushRefusedError` from `./remote`, and `EventStore`, `memoryKV`, `shotEv` if not already imported).

`src/events/useGameEvents.test.tsx` — add, reusing the file's existing `setup` / wrapper pattern:

```tsx
  it('keeps refused entries and sends them once access is back', async () => {
    const d = makeDeps();
    d.fr.setRefusing(true);
    const wrapper = ({ children }: { children: ReactNode }) => <SyncProvider deps={d.deps}>{children}</SyncProvider>;
    const { result } = renderHook(() => useGameEvents('K7QX'), { wrapper });
    act(() => result.current.record(shotEv('shot_for', 'goal', { game_code: 'K7QX' })));
    await waitFor(() => expect(result.current.refused).toBe(true));
    expect(result.current.pending).toBe(1);
    expect(d.fr.rows.size).toBe(0);
    d.fr.setRefusing(false);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(result.current.pending).toBe(0));
    expect(result.current.refused).toBe(false);
    expect(d.fr.rows.size).toBe(1);
  });
```

`src/events/backgroundSync.test.ts` — add:

```ts
  it('exposes whether the last pass was refused', async () => {
    const d = makeDeps();
    d.fr.setRefusing(true);
    await d.deps.store.add(shotEv('shot_for', 'goal', { game_code: 'K7QX' }));
    const bg = createBackgroundSync(d.deps.store, d.deps.remote, 60_000);
    await bg.run();
    expect(bg.refused()).toBe(true);
    expect(bg.pending()).toBe(1);
    d.fr.setRefusing(false);
    await bg.run();
    expect(bg.refused()).toBe(false);
    expect(bg.pending()).toBe(0);
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/events`
Expected: FAIL (`PushRefusedError`, `setRefusing`, `refused` missing).

- [ ] **Step 3: Implement**

`src/events/remote.ts` — add after the imports:

```ts
/** The database refused the entry for lack of rights (SQLSTATE 42501): e.g. removed from the club. The entry stays in the outbox. */
export class PushRefusedError extends Error {}
```

and in `push`:

```ts
      if (ins.error && ins.error.code !== '23505') {
        throw ins.error.code === '42501' ? new PushRefusedError(ins.error.message) : new Error(ins.error.message);
      }
```

`src/events/outbox.ts`:

```ts
import { PushRefusedError } from './remote';
// …
): Promise<{ pushed: number; failed: boolean; refused: boolean; events: StoredEvent[] }> {
  const pending = (await store.load(code)).filter((e) => e.sync === 'pending');
  let pushed = 0;
  for (const e of pending) {
    try {
      await push(e);
    } catch (err) {
      return { pushed, failed: true, refused: err instanceof PushRefusedError, events: await store.load(code) };
    }
    await store.markSynced(code, [{ id: e.id, deleted_at: e.deleted_at }]);
    pushed++;
  }
  return { pushed, failed: false, refused: false, events: await store.load(code) };
}
```

`src/events/backgroundSync.ts` — add `refused(): boolean;` to the interface, then:

```ts
  let refused = false;
  // …
  async function pass() {
    let anyRefused = false;
    for (const code of await store.pendingCodes()) {
      const r = await flushOutbox(store, (e) => withTimeout(remote.push(e)), code);
      if (r.refused) anyRefused = true;
    }
    const n = await store.pendingTotal();
    if (n !== total || anyRefused !== refused) {
      total = n;
      refused = anyRefused;
      listeners.forEach((l) => l());
    }
  }
```

and in the returned object: `refused: () => refused,`.

`src/events/SyncContext.tsx` — add:

```ts
/** The last background pass was refused by the database (rights), entries are kept. */
export function useSyncRefused(): boolean {
  const bg = useBackgroundSync();
  return useSyncExternalStore(bg.subscribe, bg.refused);
}
```

`src/events/useGameEvents.ts`:
- add `refused: boolean;` to `GameEventsState`;
- add `const [refused, setRefused] = useState(false);`;
- inside the flush loop, right after `show(code, r.events);`: `if (isActive(code)) setRefused(r.refused);`;
- return `refused` in the result object.

`src/test/fakes.tsx` — in `fakeRemote`: `let refusing = false;`; in `push`, after `guard();`: `if (refusing) throw new PushRefusedError('42501');`; return `setRefusing: (v: boolean) => (refusing = v)` (import `PushRefusedError` from `../events/remote`).

`src/i18n/fr.ts` — `sync.refused: 'Envoi refusé : accès au club retiré'`.

`src/ui/SyncChip.tsx`:

```tsx
export function SyncChip({ pending, connected, refused = false }: { pending: number; connected: boolean; refused?: boolean }) {
  const label = refused && pending > 0 ? t.sync.refused : pending > 0 ? t.sync.pending(pending) : connected ? t.sync.synced : t.sync.offline;
  // …unchanged markup
}
```

Pass the flag:
- `src/screens/Home.tsx`: `const refused = useSyncRefused();` and `{pending > 0 && <SyncChip pending={pending} connected={false} refused={refused} />}`.
- `src/screens/record/Recorder.tsx`: destructure `refused` from `useGameEvents(game.code)` and pass `refused={refused}` to `SyncChip`.
- `src/screens/report/ReportScreen.tsx`: same.

- [ ] **Step 4: Run the tests and the build**

Run: `npm test` then `npm run build`
Expected: all PASS; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add -u src
git commit -m "feat(sync): a push refused by the database stays in the outbox and is shown"
```

---

### Task 10: Documentation, staging acceptance, production cut-over checklist

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update `README.md`**

Replace the "Database" bullet of the top list with:

```markdown
- Databases: production Supabase `ibgyycalrtnwtfmlzrwk` (`.env`), staging (`.env.development`, used by `npm run dev`). Schema: `supabase/schema.sql` (v1), then `supabase/migration-v2.sql`, then `supabase/migration-v3a.sql`. `npm run smoke` checks the access rules **on staging only** (needs `.env.smoke.local`, see `scripts/smoke.mjs`).
```

Add a section after "Version 2":

```markdown
## Version 3 — release 1a (accounts and clubs)

Sign-in with Google. Each account belongs to one or more clubs (roles: Responsable, Membre) and only sees their data. A club has teams (N2, U20…), its own goalie roster, and an invitation link that the Responsable can regenerate.

Spec: `docs/superpowers/specs/2026-10-15-roller-stats-v3-phase1-design.md`. Plan: `docs/superpowers/plans/2026-10-15-roller-stats-v3-phase1a.md`.

### Production cut-over (a day without games; the app is down a few minutes between steps 2 and 4)

1. Supabase production → Authentication → Sign In / Providers → Google: same client ID and secret as staging. URL Configuration: Site URL `https://trophy8726.github.io/roller-stats/`, same address under Redirect URLs.
2. SQL Editor: run `supabase/migration-v3a.sql`. It stops with an error if a game other than 9MKH, B9NG, QSFA exists: decide its club first. From here on, the v2 app no longer works.
3. Merge `feat/v3` into `main` and push (the deploy runs on push). Wait for the "Deploy to GitHub Pages" run to succeed.
4. Open the app, sign in with Google. Then in the SQL Editor run `supabase/claim-v3a.sql` with your Google address on the marked line. Reload the app: both clubs appear.
5. Maisons-Laffitte hand-over: Club tab → copy the invitation link → send it to the future Responsable → once they have joined, « Nommer responsable » → « Quitter le club ».
```

- [ ] **Step 2: [User] Staging acceptance**

Run `npm run dev` (staging). The user checks, with two Google accounts (two browsers or a tablet and a phone):
1. Account 1: onboarding → create « Club test » with team « N2 » → the home shows the club.
2. Club tab → copy the invitation link → open it with account 2 (signed out: Google round trip, then the « Rejoindre le club Club test ? » screen) → Rejoindre.
3. Both accounts open the same new game (created by account 1) and record shots; each sees the other's shots live.
4. Account 2 turns its Wi-Fi off, records 3 shots (« 3 en attente »), turns it back on: they are sent.
5. Account 1 removes account 2 from the club while account 2 has 1 pending shot offline; account 2 goes back online: the chip shows « Envoi refusé : accès au club retiré » and the shot stays on the device.
6. Account 1 regenerates the link; the old link shows « Ce lien d'invitation n'est plus valable… ».

Wait for the user's go before Step 3.

- [ ] **Step 3: Final verification**

Run: `npm test`, `npm run build`, `npm run smoke`
Expected: all tests PASS, build succeeds, every smoke line `OK`.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: v3a staging, env files and production cut-over"
```

The cut-over itself (README steps 1–5) is run with the user, only when they ask: it changes production and stops the v2 app.
