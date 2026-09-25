# Roller Stats v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add goalie tracking (roster, per-goalie stats), empty-net and own-goal handling, competitions/venues, a "Divers" tab for rare events (states, CSC, penalty shots, shootouts, notes, overtime) and a printable PDF report, on top of the live v1.

**Architecture:** Same React SPA + Supabase + offline outbox. New event kinds live in the existing `events` table (append-only, soft delete, offline-safe). "States" (our goalie, opponent net, strength) are events; the current state is a pure fold over them, and every shot copies the state at the moment it is tapped (goalie, empty net, strength), so stats never depend on tablet clocks. New `goalies` table; `games` gets competition/venue/overtime columns. One non-destructive SQL migration, run by the user before the v2 app goes online.

**Tech Stack:** unchanged (Vite, React 19, TypeScript, Vitest + Testing Library, @supabase/supabase-js, idb-keyval, vite-plugin-pwa).

**Spec:** `docs/superpowers/specs/2026-09-25-roller-stats-v2-design.md` (French, validated by the user). Base code: v1 on `main` (commit 7377969); work on branch `feat/v2`.

## Global Constraints

- All UI text is French and comes from `src/i18n/fr.ts`. No hard-coded strings in components (icon glyphs such as `t.ui.close` included).
- Wording: never call our team "domicile". Use "Notre équipe / Nous" and "Adversaire / Eux". "Domicile / Extérieur / Terrain neutre" only describe the **venue**.
- Greyscale tokens from `src/styles/theme.css`. Set2 colours only in `src/rink/ResultMarker.tsx` (`RESULT_COLOR`), always with a shape.
- Stored coordinates are normalized: `x, y ∈ [0,1]`, our attack always goes right. Events without a position (`x`/`y` null): faceoffs, penalty shots, CSC, shootouts, notes, states.
- Events are never hard-deleted (undo = `deleted_at`). **Goalies are never deleted** (no delete UI, no delete grant); a name can be corrected.
- Every shot/faceoff/rare event copies the match state at recording time: `goalie_id` (only for kinds aimed at our net), `empty_net`, `strength`. Stats never re-derive it from timestamps.
- Goalie stats exclude `empty_net` shots and CSC; team stats keep empty-net shots; the score counts CSC; shootouts never count as shots or goals.
- Touch targets ≥ 44px; the four shot result buttons stay ≥ 64px. The "Divers" buttons are deliberately smaller.
- Vite `base: '/roller-stats/'`, hash routes only.
- Supabase URL/key stay in `src/config.ts`. Never use or ask for the secret key.
- The database migration must stay backward compatible (a v1 tab still open must keep working) and must be applied **before** v2 is deployed.
- Commit after every task. Commit messages end with (after a blank line):
  `Co-Authored-By: <model name> <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01XYP1C8TVdkzcJBYTJwNf7s`.
- Never push to `main`. Never leave build/test output files in the repo. `.superpowers/` is git-ignored scratch.

## Review Focus

1. **Empty net vs goalie stats:** a shot against with `empty_net` true must not appear in any goalie's shots faced / save % (and the same for the opponent goalie with shots for), yet still counts in team attempts/goals and in the score. (Task 4 stats tests, Task 6 recorder tests.)
2. **Goalie change mid-game:** the shot tapped right after a change carries the new goalie; an undone change restores the previous goalie; a shot with no goalie chosen lands on the "Non renseigné" line. (Tasks 2, 4, 6 tests.)
3. **Small "Divers" buttons double-tapped** (CSC, states, shootout, penalty result) must record exactly one event. (Task 6 test.)
4. **v1 data keeps rendering:** events without the new columns (goalie null, strength even, no note) and games cached by v1 (no venue/competition) must load, compute and render. (Tasks 2, 3, 4 tests.)
5. **CSC:** counts in the score only; never a shot for anyone; never in a goalie's save %; shown in the goalie table's CSC column and in the report's extras. (Tasks 4, 7 tests.)
6. **Retro-assignment** may only fill a missing goalie (never overwrite, never on shots for, never on empty-net shots, never while events are still pending on the device), and must be enforced by the database trigger, not only by the app. (Tasks 1, 3, 7.)
7. **Overtime:** entering "Prol." asks which side we defend (no rule assumed); shots keep normalizing correctly in period 3; the P3 column only appears when there is overtime. (Tasks 2, 4, 6, 7.)
8. **Season view:** defaults to Championnat; Coupe/Playoffs games and empty games never leak into it; goalie season lines respect the competition filter and unticked games. (Tasks 4, 8.)

---

## File map

```
supabase/migration-v2.sql                       NEW   one-shot, non destructive
scripts/smoke.mjs                               MOD   + v2 rule checks
src/domain/types.ts                             REWRITE
src/domain/normalize.ts                         NEW   normalizeGame(), normalizeEvent()
src/domain/matchState.ts                        NEW   MatchState, computeMatchState()
src/domain/factory.ts                           REWRITE  all event constructors + toRow
src/rink/coords.ts                              MOD   attacksRight(…, defendOT)
src/rink/{ResultMarker,Legend,Rink,markers}.tsx MOD   MarkResult typing, PeriodFilter incl. 3
src/ui/ResultButtons.tsx                        MOD   MarkResult typing
src/i18n/fr.ts                                  REWRITE  every v2 string
src/settings.ts                                 MOD   defendOT, cached goalies, normalized cached game
src/events/store.ts                             MOD   normalize on load, merge goalie_id
src/events/remote.ts                            MOD   columns, assignGoalie()
src/events/useGameEvents.ts                     MOD   goalie_id in sameEvents, refresh()
src/events/SyncContext.tsx                      MOD   goalies in SyncDeps
src/games/api.ts                                MOD   new columns
src/goalies/api.ts                              NEW   GoaliesApi, DuplicateGoalieError
src/goalies/useGoalies.ts                       NEW
src/stats/game.ts                               REWRITE
src/stats/goalies.ts                            NEW
src/stats/season.ts                             MOD   competition filter
src/stats/csv.ts                                MOD   + columns
src/screens/Home.tsx                            REWRITE
src/screens/GoalieRoster.tsx                    NEW
src/screens/record/describe.ts                  NEW
src/screens/record/{Recorder,MiscPanel,StateBanner,SidePrompt}.tsx   REWRITE/NEW
src/screens/report/{ReportScreen,LevelsTable}.tsx                    REWRITE/MOD
src/screens/report/{GoalieTable,StrengthTable,ExtrasCard,AssignGoalie}.tsx   NEW
src/screens/SeasonScreen.tsx                    MOD
src/styles/theme.css                            MOD   banner, small buttons, print
src/test/{builders.ts,fakes.tsx}                MOD
README.md                                       MOD
```

---

### Task 1: Database migration and smoke test

**Files:**
- Create: `supabase/migration-v2.sql`
- Modify: `scripts/smoke.mjs`

**Interfaces:**
- Produces (columns/tables every later task relies on):
  - `games`: `competition ('championnat'|'coupe'|'playoffs')`, `venue ('home'|'away'|'neutral')`, `sheet_side ('home'|'visitor'|null)`, `overtime_possible boolean`.
  - `goalies(id uuid, name text, created_at)`; unique on `lower(btrim(name))`; anon may select, insert, update `name` only.
  - `events`: `goalie_id uuid`, `empty_net boolean`, `strength ('even'|'pp'|'pk')`, `penalty_shot boolean`, `note text(≤200)`; `period ∈ {1,2,3}`; new kinds `own_goal_for`, `own_goal_against`, `shootout_for`, `shootout_against`, `note`, `state_our_goalie`, `state_their_net`, `state_strength`.
  - Update rules (trigger `events_guard_update`): only `deleted_at` (null → value, never back) and `goalie_id` (null → value, only on `shot_against`/`own_goal_against`/`shootout_against`, not on `empty_net` rows) may change.

- [ ] **Step 1: Write `supabase/migration-v2.sql`**

```sql
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
```

- [ ] **Step 2: Extend `scripts/smoke.mjs`.** Keep the existing 8 checks. Replace the final `console.log` (cleanup message) with the block below, so the whole file ends as follows (append after the existing `check('row still present and soft-deleted', …)` line):

```js
// ---- v2 rules ----------------------------------------------------------
const tag = Math.random().toString(36).slice(2, 8);
const goalieName = `SMOKE ${tag}`;
const row = (over) => ({
  id: crypto.randomUUID(), game_code: code, kind: 'shot_against', period: 1, x: 0.1, y: 0.5, dot: null, result: 'save',
  device_role: 'all', recorded_at: new Date().toISOString(), deleted_at: null,
  goalie_id: null, empty_net: false, strength: 'even', penalty_shot: false, note: null, ...over,
});
const bare = { x: null, y: null };

r = await sb.from('goalies').insert({ name: goalieName }).select('id').single();
check('insert goalie', !r.error && !!r.data?.id, r.error?.message);
const goalieId = r.data?.id;
r = await sb.from('goalies').insert({ name: `  ${goalieName.toUpperCase()} ` });
check('duplicate goalie name rejected (23505)', r.error?.code === '23505', r.error?.code);
r = await sb.from('goalies').insert({ name: `${goalieName} 2` }).select('id').single();
const goalie2 = r.data?.id;
check('insert second goalie', !r.error && !!goalie2, r.error?.message);
r = await sb.from('goalies').update({ name: `${goalieName} bis` }).eq('id', goalie2).select('id');
check('rename goalie allowed', !r.error && r.data?.length === 1, r.error?.message);
r = await sb.from('goalies').delete().eq('id', goalie2).select();
check('goalie delete refused', !!r.error || (r.data?.length ?? 0) === 0, r.error?.code);

r = await sb.from('events').insert(row({ period: 3 }));
check('overtime period accepted', !r.error, r.error?.message);
r = await sb.from('events').insert(row({ kind: 'shot_for', result: 'goal', penalty_shot: true, ...bare }));
check('penalty shot without position accepted', !r.error, r.error?.message);
r = await sb.from('events').insert(row({ ...bare }));
check('shot without position that is not a penalty rejected', !!r.error, r.error?.code);
r = await sb.from('events').insert(row({ kind: 'own_goal_against', result: 'goal', ...bare }));
check('own goal accepted', !r.error, r.error?.message);
r = await sb.from('events').insert(row({ kind: 'shootout_for', result: 'missed', ...bare }));
check('shootout attempt accepted', !r.error, r.error?.message);
r = await sb.from('events').insert(row({ kind: 'note', result: 'note', note: 'smoke', ...bare }));
check('note accepted', !r.error, r.error?.message);
r = await sb.from('events').insert(row({ kind: 'note', result: 'note', note: 'x'.repeat(201), ...bare }));
check('note over 200 characters rejected', !!r.error, r.error?.code);
r = await sb.from('events').insert(row({ kind: 'state_our_goalie', result: 'goalie', goalie_id: goalieId, ...bare }));
check('goalie state with a goalie accepted', !r.error, r.error?.message);
r = await sb.from('events').insert(row({ kind: 'state_our_goalie', result: 'goalie', goalie_id: null, ...bare }));
check('goalie state without a goalie rejected', !!r.error, r.error?.code);
r = await sb.from('events').insert(row({ kind: 'state_our_goalie', result: 'empty', goalie_id: null, ...bare }));
check('empty-net state accepted', !r.error, r.error?.message);
r = await sb.from('events').insert(row({ kind: 'state_strength', result: 'pp', strength: 'pp', ...bare }));
check('strength state accepted', !r.error, r.error?.message);

const open = row({ result: 'goal' });
r = await sb.from('events').insert(open);
check('insert shot against without goalie', !r.error, r.error?.message);
r = await sb.from('events').update({ goalie_id: goalieId }).eq('id', open.id).select('id');
check('goalie can be filled in on a shot against', !r.error && r.data?.length === 1, r.error?.message);
r = await sb.from('events').update({ goalie_id: goalie2 }).eq('id', open.id).select('id');
check('an attached goalie cannot be replaced', !!r.error, r.error?.code);
r = await sb.from('events').update({ goalie_id: null }).eq('id', open.id).select('id');
check('an attached goalie cannot be removed', !!r.error, r.error?.code);
const forShot = row({ kind: 'shot_for', x: 0.9 });
r = await sb.from('events').insert(forShot);
check('insert shot for', !r.error, r.error?.message);
r = await sb.from('events').update({ goalie_id: goalieId }).eq('id', forShot.id).select('id');
check('no goalie on a shot for', !!r.error, r.error?.code);
const emptyShot = row({ empty_net: true, result: 'goal' });
r = await sb.from('events').insert(emptyShot);
check('insert empty-net shot', !r.error, r.error?.message);
r = await sb.from('events').update({ goalie_id: goalieId }).eq('id', emptyShot.id).select('id');
check('no goalie on an empty-net shot', !!r.error, r.error?.code);
r = await sb.from('events').insert(row({ kind: 'state_their_net', result: 'empty', ...bare }));
check('state_their_net accepted', !r.error, r.error?.message);

const v1Event = { id: crypto.randomUUID(), game_code: code, kind: 'shot_for', period: 1, x: 0.9, y: 0.5, dot: null, result: 'goal', device_role: 'all', recorded_at: new Date().toISOString(), deleted_at: null };
r = await sb.from('events').insert(v1Event).select();
check('v1-style event (only v1 columns) accepted with defaults', !r.error && r.data?.[0]?.goalie_id === null && r.data?.[0]?.empty_net === false && r.data?.[0]?.strength === 'even' && r.data?.[0]?.penalty_shot === false, r.error?.message);

r = await sb.from('events').insert(row({ kind: 'shot_for', goalie_id: goalieId, x: 0.9 }));
check('shot for with goalie_id rejected', !!r.error, r.error?.code);
r = await sb.from('events').insert(row({ kind: 'shot_against', empty_net: true, goalie_id: goalieId, x: 0.1 }));
check('empty-net shot with goalie_id rejected', !!r.error, r.error?.code);

const code2 = 'Z' + Array.from({ length: 3 }, () => A[Math.floor(Math.random() * A.length)]).join('');
r = await sb.from('games').insert({ code: code2, team_name: 'SMOKE', opponent: 'SMOKE', game_date: '2026-01-01', home: false }).select('venue').single();
check('v1-style game insert (only home=false) gets venue away', !r.error && r.data?.venue === 'away', r.error?.message);

const gone = row({});
await sb.from('events').insert(gone);
const t1 = new Date().toISOString();
await sb.from('events').update({ deleted_at: t1 }).eq('id', gone.id);
r = await sb.from('events').select('deleted_at').eq('id', gone.id).single();
const t1Stored = r.data?.deleted_at;
r = await sb.from('events').update({ deleted_at: new Date().toISOString() }).eq('id', gone.id).select('deleted_at');
check('re-deleting an already deleted event is idempotent (same timestamp)', !r.error && r.data?.[0]?.deleted_at === t1Stored, r.error?.message);
r = await sb.from('events').update({ deleted_at: null }).eq('id', gone.id).select('id');
check('a deleted event cannot be restored', !!r.error, r.error?.code);
r = await sb.from('events').update({ empty_net: true }).eq('id', open.id).select('id');
check('empty_net cannot be edited', !!r.error, r.error?.code);

console.log(
  `\nCleanup — paste in Supabase SQL Editor:\n` +
    `delete from events where game_code in ('${code}','${code2}'); delete from games where code in ('${code}','${code2}'); delete from goalies where name like 'SMOKE ${tag}%';`,
);
```
(Delete the old trailing `console.log` cleanup line that this block replaces.)

- [ ] **Step 3: Check the SQL statically.** Run: `node -e "const s=require('fs').readFileSync('supabase/migration-v2.sql','utf8'); for (const k of ['begin;','commit;','events_guard_update','goalies_name_unique','event_shape']) if(!s.includes(k)) throw new Error('missing '+k); console.log('sql ok', s.length)"`
Expected: `sql ok <number>`. (The live run happens in Task 10, after the user applies the migration. Do NOT run `npm run smoke` now and make no network call to Supabase.)

- [ ] **Step 4: Commit**
```bash
git add supabase/migration-v2.sql scripts/smoke.mjs
git commit -m "feat: v2 database migration (goalies, states, overtime, guarded updates) and smoke checks"
```

---

### Task 2: Domain model, event constructors, strings

**Files:**
- Rewrite: `src/domain/types.ts`, `src/domain/factory.ts`, `src/i18n/fr.ts`
- Create: `src/domain/normalize.ts`, `src/domain/matchState.ts`, `src/screens/record/describe.ts`
- Modify: `src/rink/coords.ts`, `src/rink/ResultMarker.tsx`, `src/rink/Legend.tsx`, `src/rink/Rink.tsx`, `src/rink/markers.ts`, `src/ui/ResultButtons.tsx`, `src/settings.ts`, `src/screens/record/Recorder.tsx` (recent list only), `src/test/builders.ts`
- Test: `src/domain/normalize.test.ts`, `src/domain/matchState.test.ts`, `src/domain/factory.test.ts` (replace), `src/rink/coords.test.ts` (extend), `src/settings.test.ts` (extend)

**Interfaces:**
- Produces (used by every later task):
  - types: `Period = 1|2|3`, `Kind`, `ShotKind`, `OwnGoalKind`, `ShootoutKind`, `StateKind`, `OpenShotResult`, `MarkResult`, `Strength`, `StateResult`, `EventResult`, `Competition`, `Venue`, `SheetSide`, `Goalie {id; name; created_at?}`, `GameEvent` (+ `goalie_id`, `empty_net`, `strength`, `penalty_shot`, `note`), `Game` (+ `venue`, `competition`, `sheet_side`, `overtime_possible`); consts `SHOT_RESULTS`, `OPEN_SHOT_RESULTS`, `FACEOFF_RESULTS`, `AGAINST_KINDS`.
  - `normalizeGame(raw): Game`, `normalizeEvent<E extends GameEvent>(e: E): E`.
  - `MatchState {ourGoalieId: string|null; ourNetEmpty; theirNetEmpty; strength}`, `INITIAL_MATCH_STATE`, `computeMatchState(events: GameEvent[]): MatchState`.
  - `EventContext {code; period; role; state?: MatchState; now?; id?}`; constructors `makeShot(ctx, kind, p, result)`, `makePenaltyShot(ctx, kind: ShotKind, result: OpenShotResult)`, `makeFaceoff(ctx, dot, result)`, `makeOwnGoal(ctx, kind: OwnGoalKind)`, `makeShootout(ctx, kind: ShootoutKind, result: OpenShotResult)`, `makeNote(ctx, text)`, `makeGoalieState(ctx, goalieId: string|null)`, `makeTheirNetState(ctx, empty: boolean)`, `makeStrengthState(ctx, s: Strength)`, `toRow(e)`, `uuid()`.
  - `attacksRight(defendP1: Side, period: Period, defendOT?: Side): boolean`; `RecordSetup.defendOT?: Side`.
  - `describeEvent(e: GameEvent, names: ReadonlyMap<string, string>): string`.
  - Test builders: `shotEv`, `faceoffEv`, `penaltyEv(kind, result, opts?)`, `ownGoalEv(kind, opts?)`, `shootoutEv(kind, result, opts?)`, `noteEv(text, opts?)`, `stateEv(kind, result, opts?)`, `gameFx`.
  - `t` with every v2 string (see Step 6).

- [ ] **Step 1: Write the failing tests**

`src/domain/normalize.test.ts`:
```ts
import { gameFx, shotEv } from '../test/builders';
import { normalizeEvent, normalizeGame } from './normalize';

describe('normalizeGame', () => {
  it('fills the v2 fields of a game saved by v1', () => {
    const v1 = { code: 'AB23', team_name: 'Nous', opponent: 'Rouen', game_date: '2026-09-24', home: false };
    expect(normalizeGame(v1)).toEqual({ ...v1, venue: 'away', competition: 'championnat', sheet_side: null, overtime_possible: true });
    expect(normalizeGame({ ...v1, home: true }).venue).toBe('home');
  });
  it('keeps the v2 fields it is given', () => {
    const g = gameFx({ venue: 'neutral', competition: 'coupe', sheet_side: 'visitor', overtime_possible: false, home: false });
    expect(normalizeGame(g)).toEqual(g);
  });
});

describe('normalizeEvent', () => {
  it('fills the new columns of an event recorded by v1', () => {
    const legacy = { ...shotEv('shot_for', 'goal') } as Record<string, unknown>;
    for (const k of ['goalie_id', 'empty_net', 'strength', 'penalty_shot', 'note']) delete legacy[k];
    expect(normalizeEvent(legacy as never)).toMatchObject({ goalie_id: null, empty_net: false, strength: 'even', penalty_shot: false, note: null });
  });
  it('does not touch an event that already has them', () => {
    const e = shotEv('shot_against', 'save', { goalie_id: 'g1', empty_net: true, strength: 'pk' });
    expect(normalizeEvent(e)).toEqual(e);
  });
});
```

`src/domain/matchState.test.ts`:
```ts
import { stateEv } from '../test/builders';
import { computeMatchState, INITIAL_MATCH_STATE } from './matchState';

const at = (s: number) => new Date(Date.UTC(2026, 8, 24, 19, 0, s)).toISOString();

describe('computeMatchState', () => {
  it('starts with no goalie known, full nets and even strength', () => {
    expect(INITIAL_MATCH_STATE).toEqual({ ourGoalieId: null, ourNetEmpty: false, theirNetEmpty: false, strength: 'even' });
    expect(computeMatchState([])).toEqual(INITIAL_MATCH_STATE);
  });

  it('follows the latest goalie change', () => {
    const s = computeMatchState([
      stateEv('state_our_goalie', 'goalie', { goalie_id: 'g1', recorded_at: at(1) }),
      stateEv('state_our_goalie', 'goalie', { goalie_id: 'g2', recorded_at: at(2) }),
    ]);
    expect(s).toMatchObject({ ourGoalieId: 'g2', ourNetEmpty: false });
  });

  it('an empty net clears the goalie, and a new goalie fills it again', () => {
    const empty = computeMatchState([
      stateEv('state_our_goalie', 'goalie', { goalie_id: 'g1', recorded_at: at(1) }),
      stateEv('state_our_goalie', 'empty', { recorded_at: at(2) }),
    ]);
    expect(empty).toMatchObject({ ourGoalieId: null, ourNetEmpty: true });
    const back = computeMatchState([
      stateEv('state_our_goalie', 'empty', { recorded_at: at(1) }),
      stateEv('state_our_goalie', 'goalie', { goalie_id: 'g2', recorded_at: at(2) }),
    ]);
    expect(back).toMatchObject({ ourGoalieId: 'g2', ourNetEmpty: false });
  });

  it('ignores an undone change: the previous state comes back', () => {
    const s = computeMatchState([
      stateEv('state_our_goalie', 'goalie', { goalie_id: 'g1', recorded_at: at(1) }),
      stateEv('state_our_goalie', 'goalie', { goalie_id: 'g2', recorded_at: at(2), deleted_at: at(3) }),
    ]);
    expect(s.ourGoalieId).toBe('g1');
  });

  it('orders changes by recording time, not by list order', () => {
    const s = computeMatchState([
      stateEv('state_our_goalie', 'goalie', { goalie_id: 'g2', recorded_at: at(5) }),
      stateEv('state_our_goalie', 'goalie', { goalie_id: 'g1', recorded_at: at(1) }),
    ]);
    expect(s.ourGoalieId).toBe('g2');
  });

  it('tracks the opponent net and the strength independently', () => {
    const s = computeMatchState([
      stateEv('state_their_net', 'empty', { recorded_at: at(1) }),
      stateEv('state_strength', 'pp', { recorded_at: at(2) }),
      stateEv('state_our_goalie', 'goalie', { goalie_id: 'g1', recorded_at: at(3) }),
    ]);
    expect(s).toEqual({ ourGoalieId: 'g1', ourNetEmpty: false, theirNetEmpty: true, strength: 'pp' });
    const back = computeMatchState([
      stateEv('state_their_net', 'empty', { recorded_at: at(1) }),
      stateEv('state_their_net', 'present', { recorded_at: at(2) }),
      stateEv('state_strength', 'pk', { recorded_at: at(3) }),
      stateEv('state_strength', 'even', { recorded_at: at(4) }),
    ]);
    expect(back).toMatchObject({ theirNetEmpty: false, strength: 'even' });
  });

  it('ignores events that are not states', () => {
    expect(computeMatchState([stateEv('state_strength', 'pp', { kind: 'note' as never, recorded_at: at(1) })])).toEqual(INITIAL_MATCH_STATE);
  });
});
```

`src/domain/factory.test.ts` (replace the whole file):
```ts
import {
  makeFaceoff, makeGoalieState, makeNote, makeOwnGoal, makePenaltyShot, makeShootout, makeShot,
  makeStrengthState, makeTheirNetState, toRow, uuid,
} from './factory';
import type { MatchState } from './matchState';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ctx = { code: 'AB23', period: 2 as const, role: 'all' as const, now: new Date('2026-09-24T18:00:00Z'), id: 'id-1' };
const state = (over: Partial<MatchState> = {}): MatchState => ({ ourGoalieId: 'g1', ourNetEmpty: false, theirNetEmpty: false, strength: 'even', ...over });
const defaults = { goalie_id: null, empty_net: false, strength: 'even', penalty_shot: false, note: null };

describe('makeShot', () => {
  it('builds a normalized shot event with rounded coordinates', () => {
    expect(makeShot(ctx, 'shot_for', { x: 0.912345, y: 0.5 }, 'goal')).toEqual({
      id: 'id-1', game_code: 'AB23', kind: 'shot_for', period: 2, x: 0.912, y: 0.5, dot: null,
      result: 'goal', device_role: 'all', recorded_at: '2026-09-24T18:00:00.000Z', deleted_at: null, ...defaults,
    });
  });
  it('a shot against records our goalie, the empty-net flag and the strength', () => {
    const e = makeShot({ ...ctx, state: state({ strength: 'pk' }) }, 'shot_against', { x: 0.1, y: 0.5 }, 'save');
    expect(e).toMatchObject({ goalie_id: 'g1', empty_net: false, strength: 'pk' });
  });
  it('a shot against on our empty net has no goalie and is flagged, even with a stale goalie id', () => {
    const e = makeShot({ ...ctx, state: state({ ourNetEmpty: true }) }, 'shot_against', { x: 0.1, y: 0.5 }, 'goal');
    expect(e).toMatchObject({ goalie_id: null, empty_net: true });
  });
  it('a shot against with no goalie chosen has no goalie and is not flagged', () => {
    const e = makeShot({ ...ctx, state: state({ ourGoalieId: null }) }, 'shot_against', { x: 0.1, y: 0.5 }, 'goal');
    expect(e).toMatchObject({ goalie_id: null, empty_net: false });
  });
  it('a shot for carries the opponent net flag and never a goalie', () => {
    expect(makeShot({ ...ctx, state: state({ theirNetEmpty: true }) }, 'shot_for', { x: 0.9, y: 0.5 }, 'goal')).toMatchObject({ goalie_id: null, empty_net: true });
    expect(makeShot({ ...ctx, state: state() }, 'shot_for', { x: 0.9, y: 0.5 }, 'goal')).toMatchObject({ goalie_id: null, empty_net: false });
  });
});

describe('makePenaltyShot', () => {
  it('has no position, is flagged, and is attributed like a shot', () => {
    expect(makePenaltyShot({ ...ctx, state: state() }, 'shot_against', 'save')).toMatchObject({
      kind: 'shot_against', x: null, y: null, penalty_shot: true, result: 'save', goalie_id: 'g1',
    });
    expect(makePenaltyShot(ctx, 'shot_for', 'goal')).toMatchObject({ kind: 'shot_for', penalty_shot: true, goalie_id: null });
  });
});

describe('makeFaceoff', () => {
  it('builds a faceoff with a dot, no coordinates and the strength', () => {
    expect(makeFaceoff({ ...ctx, state: state({ strength: 'pp' }) }, 'off_top', 'won')).toMatchObject({
      kind: 'faceoff', x: null, y: null, dot: 'off_top', result: 'won', strength: 'pp', goalie_id: null,
    });
  });
});

describe('makeOwnGoal', () => {
  it('a goal against us is attributed to our goalie in net', () => {
    expect(makeOwnGoal({ ...ctx, state: state() }, 'own_goal_against')).toMatchObject({ kind: 'own_goal_against', result: 'goal', x: null, goalie_id: 'g1', empty_net: false });
  });
  it('a goal for us has no goalie', () => {
    expect(makeOwnGoal({ ...ctx, state: state() }, 'own_goal_for')).toMatchObject({ kind: 'own_goal_for', goalie_id: null });
  });
});

describe('makeShootout', () => {
  it('an attempt against us records our goalie', () => {
    expect(makeShootout({ ...ctx, state: state() }, 'shootout_against', 'save')).toMatchObject({ kind: 'shootout_against', result: 'save', goalie_id: 'g1', empty_net: false });
  });
  it('an attempt against us with our net marked empty has no goalie and is not flagged', () => {
    expect(makeShootout({ ...ctx, state: state({ ourNetEmpty: true }) }, 'shootout_against', 'goal')).toMatchObject({ goalie_id: null, empty_net: false });
  });
  it('an attempt for us has no goalie', () => {
    expect(makeShootout(ctx, 'shootout_for', 'goal')).toMatchObject({ kind: 'shootout_for', goalie_id: null });
  });
});

describe('makeNote', () => {
  it('trims the text and caps it at 200 characters', () => {
    expect(makeNote(ctx, '  glissant  ')).toMatchObject({ kind: 'note', result: 'note', note: 'glissant' });
    expect(makeNote(ctx, 'x'.repeat(300)).note).toHaveLength(200);
  });
});

describe('state events', () => {
  it('a goalie change carries the goalie, an empty net carries none', () => {
    expect(makeGoalieState(ctx, 'g2')).toMatchObject({ kind: 'state_our_goalie', result: 'goalie', goalie_id: 'g2' });
    expect(makeGoalieState(ctx, null)).toMatchObject({ kind: 'state_our_goalie', result: 'empty', goalie_id: null });
  });
  it('the opponent net and strength changes', () => {
    expect(makeTheirNetState(ctx, true)).toMatchObject({ kind: 'state_their_net', result: 'empty' });
    expect(makeTheirNetState(ctx, false)).toMatchObject({ kind: 'state_their_net', result: 'present' });
    expect(makeStrengthState(ctx, 'pk')).toMatchObject({ kind: 'state_strength', result: 'pk', strength: 'pk' });
  });
});

describe('uuid', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('returns a v4 uuid', () => expect(uuid()).toMatch(UUID_RE));
  it('works without crypto.randomUUID (plain http on a local network)', () => {
    vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array) => a.fill(171) });
    expect(uuid()).toMatch(UUID_RE);
  });
});

describe('toRow', () => {
  it('drops local-only fields and keeps every column', () => {
    const e = { ...makeShot(ctx, 'shot_for', { x: 0.5, y: 0.5 }, 'save'), sync: 'pending', mine: true };
    expect(Object.keys(toRow(e)).sort()).toEqual(
      ['deleted_at', 'device_role', 'dot', 'empty_net', 'game_code', 'goalie_id', 'id', 'kind', 'note', 'penalty_shot', 'period', 'recorded_at', 'result', 'strength', 'x', 'y'].sort(),
    );
  });
  it('fills the new columns of an event that predates them', () => {
    const legacy = { ...makeShot(ctx, 'shot_for', { x: 0.5, y: 0.5 }, 'save') } as Record<string, unknown>;
    for (const k of ['goalie_id', 'empty_net', 'strength', 'penalty_shot', 'note']) delete legacy[k];
    expect(toRow(legacy as never)).toMatchObject({ goalie_id: null, empty_net: false, strength: 'even', penalty_shot: false, note: null });
  });
});
```

Append to `src/rink/coords.test.ts` (new `describe` at the end of the file):
```ts
describe('attacksRight in overtime', () => {
  it('uses the side chosen for overtime', () => {
    expect(attacksRight('left', 3, 'left')).toBe(true);
    expect(attacksRight('left', 3, 'right')).toBe(false);
    expect(attacksRight('right', 3, 'left')).toBe(true);
  });
  it('falls back to the first-period side when none was chosen', () => {
    expect(attacksRight('left', 3)).toBe(true);
    expect(attacksRight('right', 3)).toBe(false);
  });
});
```
Append to `src/settings.test.ts` (inside the existing top-level, as a new `it` in the `describe('settings', …)` block):
```ts
  it('normalizes a game cached by v1 (no venue, competition or overtime flag)', () => {
    localStorage.setItem('game:AB23', JSON.stringify({ code: 'AB23', team_name: 'Nous', opponent: 'Rouen', game_date: '2026-09-24', home: false }));
    expect(loadCachedGame('AB23')).toMatchObject({ venue: 'away', competition: 'championnat', sheet_side: null, overtime_possible: true });
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/domain src/rink/coords.test.ts src/settings.test.ts`
Expected: FAIL (`normalize`, `matchState` not found; factory exports missing; `attacksRight` 3rd arg; cached game not normalized).

- [ ] **Step 3: Rewrite `src/domain/types.ts`**
```ts
export type Period = 1 | 2 | 3; // 3 = prolongation (extra time)
export type Side = 'left' | 'right';
export type ShotKind = 'shot_for' | 'shot_against';
export type OwnGoalKind = 'own_goal_for' | 'own_goal_against';
export type ShootoutKind = 'shootout_for' | 'shootout_against';
export type StateKind = 'state_our_goalie' | 'state_their_net' | 'state_strength';
export type Kind = ShotKind | 'faceoff' | OwnGoalKind | ShootoutKind | 'note' | StateKind;
export type ShotResult = 'goal' | 'save' | 'missed' | 'blocked';
/** A penalty shot or a shootout attempt is aimed at the goalie: it cannot be blocked. */
export type OpenShotResult = 'goal' | 'save' | 'missed';
export type FaceoffResult = 'won' | 'lost';
/** The results drawn as a coloured marker (Set2 colour + shape). */
export type MarkResult = ShotResult | FaceoffResult;
export type Strength = 'even' | 'pp' | 'pk';
export type StateResult = 'goalie' | 'empty' | 'present' | Strength;
export type EventResult = MarkResult | 'note' | StateResult;
export type DotId = 'center' | 'off_top' | 'off_bottom' | 'def_top' | 'def_bottom';
export type Zone = 'off' | 'neutral' | 'def';
export type Role = 'shots_for' | 'shots_against' | 'faceoffs' | 'all';
export type Competition = 'championnat' | 'coupe' | 'playoffs';
export type Venue = 'home' | 'away' | 'neutral';
export type SheetSide = 'home' | 'visitor';

export const SHOT_RESULTS: readonly ShotResult[] = ['goal', 'save', 'missed', 'blocked'];
export const OPEN_SHOT_RESULTS: readonly OpenShotResult[] = ['goal', 'save', 'missed'];
export const FACEOFF_RESULTS: readonly FaceoffResult[] = ['won', 'lost'];
/** Kinds aimed at our net: they belong to one of our goalies (unless the net was empty). */
export const AGAINST_KINDS: readonly Kind[] = ['shot_against', 'own_goal_against', 'shootout_against'];

export interface Point {
  x: number;
  y: number;
}

/** One row of the `events` table. Coordinates are normalized: our attack goes right. */
export interface GameEvent {
  id: string;
  game_code: string;
  kind: Kind;
  period: Period;
  x: number | null;
  y: number | null;
  dot: DotId | null;
  result: EventResult;
  device_role: Role;
  recorded_at: string;
  deleted_at: string | null;
  /** Our goalie in net when the event was recorded (kinds aimed at our net, and `state_our_goalie`). */
  goalie_id: string | null;
  /** The net the shot was aimed at was empty (ours for shots against, theirs for shots for). */
  empty_net: boolean;
  /** Numerical situation from our point of view when the event was recorded. */
  strength: Strength;
  penalty_shot: boolean;
  note: string | null;
}

export interface Game {
  code: string;
  team_name: string;
  opponent: string;
  game_date: string; // YYYY-MM-DD
  /** Kept for v1 compatibility: true only when `venue` is 'home'. */
  home: boolean;
  venue: Venue;
  competition: Competition;
  /** Neutral ground only: are we "domicile" or "visiteur" on the official match sheet. */
  sheet_side: SheetSide | null;
  overtime_possible: boolean;
  created_at?: string;
}

export interface Goalie {
  id: string;
  name: string;
  created_at?: string;
}
```

- [ ] **Step 4: Create `src/domain/normalize.ts`**
```ts
import type { Game, GameEvent } from './types';

type V2GameFields = 'venue' | 'competition' | 'sheet_side' | 'overtime_possible';

/** A game saved by v1 (localStorage cache, old rows) lacks the v2 fields. */
export function normalizeGame(raw: Omit<Game, V2GameFields> & Partial<Pick<Game, V2GameFields>>): Game {
  return {
    ...raw,
    venue: raw.venue ?? (raw.home ? 'home' : 'away'),
    competition: raw.competition ?? 'championnat',
    sheet_side: raw.sheet_side ?? null,
    overtime_possible: raw.overtime_possible ?? true,
  };
}

/** An event stored by v1 (IndexedDB on a device that has not synced yet) lacks the new columns. */
export function normalizeEvent<E extends GameEvent>(e: E): E {
  return {
    ...e,
    goalie_id: e.goalie_id ?? null,
    empty_net: e.empty_net ?? false,
    strength: e.strength ?? 'even',
    penalty_shot: e.penalty_shot ?? false,
    note: e.note ?? null,
  };
}
```

- [ ] **Step 5: Create `src/domain/matchState.ts`**
```ts
import type { GameEvent, Kind, Strength } from './types';

export interface MatchState {
  /** Our goalie in net (null: none chosen yet, or the net is empty). */
  ourGoalieId: string | null;
  ourNetEmpty: boolean;
  theirNetEmpty: boolean;
  strength: Strength;
}

export const INITIAL_MATCH_STATE: MatchState = { ourGoalieId: null, ourNetEmpty: false, theirNetEmpty: false, strength: 'even' };

const STATE_KINDS: readonly Kind[] = ['state_our_goalie', 'state_their_net', 'state_strength'];

/** The current state: the last non-deleted change of each kind, in recording order. */
export function computeMatchState(events: GameEvent[]): MatchState {
  const changes = events
    .filter((e) => !e.deleted_at && STATE_KINDS.includes(e.kind))
    .sort((a, b) => Date.parse(a.recorded_at) - Date.parse(b.recorded_at) || a.id.localeCompare(b.id));
  let s = INITIAL_MATCH_STATE;
  for (const e of changes) {
    if (e.kind === 'state_our_goalie') {
      s = e.result === 'empty' ? { ...s, ourGoalieId: null, ourNetEmpty: true } : { ...s, ourGoalieId: e.goalie_id, ourNetEmpty: false };
    } else if (e.kind === 'state_their_net') {
      s = { ...s, theirNetEmpty: e.result === 'empty' };
    } else {
      s = { ...s, strength: e.result as Strength };
    }
  }
  return s;
}
```

- [ ] **Step 6: Rewrite `src/domain/factory.ts`**
```ts
import { INITIAL_MATCH_STATE, type MatchState } from './matchState';
import type {
  DotId, FaceoffResult, GameEvent, Kind, OpenShotResult, OwnGoalKind, Period, Point, Role, ShootoutKind,
  ShotKind, ShotResult, Strength,
} from './types';

export interface EventContext {
  code: string;
  period: Period;
  role: Role;
  /** The match state when the event is recorded (defaults to "nothing known"). */
  state?: MatchState;
  now?: Date;
  id?: string;
}

/** crypto.randomUUID only exists on https/localhost; tablets testing over plain http need the fallback. */
export function uuid(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Which goalie faced the event and whether the net it was aimed at was empty. */
function attribution(kind: Kind, s: MatchState): { goalie_id: string | null; empty_net: boolean } {
  switch (kind) {
    case 'shot_for':
      return { goalie_id: null, empty_net: s.theirNetEmpty };
    case 'shot_against':
    case 'own_goal_against':
      return { goalie_id: s.ourNetEmpty ? null : s.ourGoalieId, empty_net: s.ourNetEmpty };
    case 'shootout_against':
      // A shootout is never on an empty net.
      return { goalie_id: s.ourNetEmpty ? null : s.ourGoalieId, empty_net: false };
    default:
      return { goalie_id: null, empty_net: false };
  }
}

function build(ctx: EventContext, kind: Kind, result: GameEvent['result'], extra: Partial<GameEvent> = {}): GameEvent {
  const s = ctx.state ?? INITIAL_MATCH_STATE;
  return {
    id: ctx.id ?? uuid(),
    game_code: ctx.code,
    kind,
    period: ctx.period,
    x: null,
    y: null,
    dot: null,
    result,
    device_role: ctx.role,
    recorded_at: (ctx.now ?? new Date()).toISOString(),
    deleted_at: null,
    ...attribution(kind, s),
    strength: s.strength,
    penalty_shot: false,
    note: null,
    ...extra,
  };
}

export function makeShot(ctx: EventContext, kind: ShotKind, p: Point, result: ShotResult): GameEvent {
  return build(ctx, kind, result, { x: round3(p.x), y: round3(p.y) });
}

/** A penalty shot during play: no position on the rink. */
export function makePenaltyShot(ctx: EventContext, kind: ShotKind, result: OpenShotResult): GameEvent {
  return build(ctx, kind, result, { penalty_shot: true });
}

export function makeFaceoff(ctx: EventContext, dot: DotId, result: FaceoffResult): GameEvent {
  return build(ctx, 'faceoff', result, { dot });
}

/** Own goal (CSC): a goal that is not a shot. */
export function makeOwnGoal(ctx: EventContext, kind: OwnGoalKind): GameEvent {
  return build(ctx, kind, 'goal');
}

export function makeShootout(ctx: EventContext, kind: ShootoutKind, result: OpenShotResult): GameEvent {
  return build(ctx, kind, result);
}

export function makeNote(ctx: EventContext, text: string): GameEvent {
  return build(ctx, 'note', 'note', { note: text.trim().slice(0, 200) });
}

/** `null`: our net is empty (goalie pulled). */
export function makeGoalieState(ctx: EventContext, goalieId: string | null): GameEvent {
  return goalieId ? build(ctx, 'state_our_goalie', 'goalie', { goalie_id: goalieId }) : build(ctx, 'state_our_goalie', 'empty');
}

export function makeTheirNetState(ctx: EventContext, empty: boolean): GameEvent {
  return build(ctx, 'state_their_net', empty ? 'empty' : 'present');
}

export function makeStrengthState(ctx: EventContext, s: Strength): GameEvent {
  return build(ctx, 'state_strength', s, { strength: s });
}

/** Exactly the columns of the `events` table (drops local fields like `sync`, `mine`; fills columns older events lack). */
export function toRow(e: GameEvent): GameEvent {
  return {
    id: e.id, game_code: e.game_code, kind: e.kind, period: e.period, x: e.x, y: e.y, dot: e.dot,
    result: e.result, device_role: e.device_role, recorded_at: e.recorded_at, deleted_at: e.deleted_at,
    goalie_id: e.goalie_id ?? null, empty_net: e.empty_net ?? false, strength: e.strength ?? 'even',
    penalty_shot: e.penalty_shot ?? false, note: e.note ?? null,
  };
}
```

- [ ] **Step 7: Update `src/rink/coords.ts` (`attacksRight`)**
```ts
/** True when, on this device and in this period, our team attacks toward the right of the screen. `defendOT`: the side chosen for overtime. */
export function attacksRight(defendP1: Side, period: Period, defendOT?: Side): boolean {
  if (period === 3) return (defendOT ?? defendP1) === 'left';
  const p1 = defendP1 === 'left';
  return period === 1 ? p1 : !p1;
}
```

- [ ] **Step 8: Update `src/settings.ts`.** Add `defendOT?: Side` to `RecordSetup` (with a comment `/** Overtime only: the side we defend, asked when entering "Prol." */`), import `normalizeGame`, and replace `loadCachedGame` with:
```ts
export const loadCachedGame = (code: string): Game | null => {
  const g = readJson<Parameters<typeof normalizeGame>[0]>(`game:${code}`);
  return g ? normalizeGame(g) : null;
};
```
(`import { normalizeGame } from './domain/normalize';`.)

- [ ] **Step 9: Tighten the marker typings** (these files accept only what they can draw):
  - `src/rink/ResultMarker.tsx`: `import type { MarkResult } from '../domain/types';` replacing the `EventResult` import; `RESULT_COLOR: Record<MarkResult, string>`; prop `result: MarkResult`.
  - `src/rink/Legend.tsx`: `results: readonly MarkResult[]` (import `MarkResult`).
  - `src/rink/Rink.tsx`: `RinkMarker.result: MarkResult` (import `MarkResult` instead of `EventResult`).
  - `src/ui/ResultButtons.tsx`: `R extends MarkResult` (import `MarkResult` instead of `EventResult`).
  - `src/rink/markers.ts`: `export type PeriodFilter = 'all' | Period;` (import `Period`), and map `result: e.result as MarkResult` (import `MarkResult`).

- [ ] **Step 10: Update `src/test/builders.ts` (replace the whole file)**
```ts
import type { DotId, FaceoffResult, Game, GameEvent, Kind, OpenShotResult, ShotKind, ShotResult, StateKind, StateResult } from '../domain/types';

let seq = 0;
const at = () => new Date(Date.UTC(2026, 8, 24, 18, 0, ++seq)).toISOString();

function blank(kind: Kind, result: GameEvent['result'], opts: Partial<GameEvent>): GameEvent {
  return {
    id: `e${++seq}`, game_code: 'AB23', kind, period: 1, x: null, y: null, dot: null, result, device_role: 'all',
    recorded_at: at(), deleted_at: null, goalie_id: null, empty_net: false, strength: 'even', penalty_shot: false, note: null, ...opts,
  };
}

export function shotEv(kind: ShotKind, result: ShotResult, opts: Partial<GameEvent> = {}): GameEvent {
  return blank(kind, result, { x: 0.5, y: 0.5, ...opts });
}
export function faceoffEv(dot: DotId, result: FaceoffResult, opts: Partial<GameEvent> = {}): GameEvent {
  return blank('faceoff', result, { dot, ...opts });
}
export function penaltyEv(kind: ShotKind, result: OpenShotResult, opts: Partial<GameEvent> = {}): GameEvent {
  return blank(kind, result, { penalty_shot: true, ...opts });
}
export function ownGoalEv(kind: 'own_goal_for' | 'own_goal_against', opts: Partial<GameEvent> = {}): GameEvent {
  return blank(kind, 'goal', opts);
}
export function shootoutEv(kind: 'shootout_for' | 'shootout_against', result: OpenShotResult, opts: Partial<GameEvent> = {}): GameEvent {
  return blank(kind, result, opts);
}
export function noteEv(text: string, opts: Partial<GameEvent> = {}): GameEvent {
  return blank('note', 'note', { note: text, ...opts });
}
export function stateEv(kind: StateKind, result: StateResult, opts: Partial<GameEvent> = {}): GameEvent {
  return blank(kind, result, opts);
}

export function gameFx(opts: Partial<Game> = {}): Game {
  return {
    code: 'AB23', team_name: 'Nous', opponent: 'Rouen', game_date: '2026-09-24', home: true,
    venue: 'home', competition: 'championnat', sheet_side: null, overtime_possible: true, ...opts,
  };
}
```

- [ ] **Step 11: Rewrite `src/i18n/fr.ts`** (v1 keys kept, v2 keys added; later tasks only use keys listed here):
```ts
export const t = {
  appName: 'Roller Stats',
  nav: { home: 'Accueil', season: 'Saison', report: 'Rapport', record: 'Saisie' },
  home: {
    newGame: 'Nouveau match',
    team: 'Notre équipe',
    opponent: 'Adversaire',
    date: 'Date',
    venue: 'Lieu',
    homeGame: 'Domicile',
    awayGame: 'Extérieur',
    create: 'Créer le match',
    codeTitle: 'Code du match',
    codeHint: 'Donnez ce code aux autres personnes qui saisissent.',
    startRecording: 'Commencer la saisie',
    join: 'Rejoindre un match',
    codeLabel: 'Code du match',
    joinButton: 'Rejoindre',
    recent: 'Matchs récents',
    noGames: 'Aucun match pour le moment.',
    tabs: 'Sections',
    tabGames: 'Matchs',
    tabGoalies: 'Gardiens',
    competition: 'Compétition',
    sheetSide: 'Sur la feuille de match, nous sommes :',
    overtimePossible: 'Prolongations et tirs au but possibles',
    startGoalie: 'Gardien de départ',
    startGoalieLater: 'Plus tard',
    startGoalieEmpty: 'Notre filet désert',
  },
  competitions: { championnat: 'Championnat', coupe: 'Coupe de France', playoffs: 'Playoffs' },
  venues: { home: 'Domicile', away: 'Extérieur', neutral: 'Terrain neutre' },
  venuesShort: { home: 'Dom.', away: 'Ext.', neutral: 'Neutre' },
  sheetSides: { home: 'Domicile', visitor: 'Visiteur' },
  roles: { shots_for: 'Tirs pour', shots_against: 'Tirs contre', faceoffs: 'Engagements', all: 'Tout' },
  setup: {
    title: 'Préparation',
    chooseRole: 'Votre rôle',
    chooseSide: 'De quel côté défendons-nous en 1re période ?',
    sideHint: 'Vu depuis votre place dans les tribunes.',
    defendLeft: 'Nous défendons à gauche',
    defendRight: 'Nous défendons à droite',
    start: 'Commencer',
    change: 'Changer de rôle ou de côté',
  },
  modes: { shot_for: 'Tir pour', shot_against: 'Tir contre', faceoff: 'Engagement' },
  kinds: {
    shot_for: 'Tir pour',
    shot_against: 'Tir contre',
    faceoff: 'Engagement',
    own_goal_for: 'CSC adversaire',
    own_goal_against: 'CSC de notre équipe',
    shootout_for: 'Tir au but (nous)',
    shootout_against: 'Tir au but (eux)',
    note: 'Note',
    state_our_goalie: 'Gardien',
    state_their_net: 'Filet adverse',
    state_strength: 'Situation',
    penalty_for: 'Tir de pénalty (nous)',
    penalty_against: 'Tir de pénalty (eux)',
  },
  results: { goal: 'But', save: 'Arrêt', missed: 'Raté', blocked: 'Bloqué', won: 'Gagné', lost: 'Perdu' },
  rink: { label: 'Patinoire' },
  dots: {
    center: 'Point central',
    off_top: 'Point offensif haut',
    off_bottom: 'Point offensif bas',
    def_top: 'Point défensif haut',
    def_bottom: 'Point défensif bas',
  },
  record: {
    periodLabel: 'Période',
    modeLabel: 'Type de saisie',
    period: (p: number) => (p === 3 ? 'Prol.' : `P${p}`),
    tapShot: "Touchez l'endroit du tir",
    tapDot: "Touchez le point d'engagement",
    cancel: 'Annuler',
    undoLast: 'Annuler la dernière saisie',
    recent: 'Dernières saisies',
    none: 'Aucune saisie.',
    delete: 'Supprimer',
    halftimeTitle: 'Mi-temps : les équipes ont changé de côté',
    halftimeOk: 'Compris',
    backToP1Title: 'Retour en 1re période : les équipes reprennent leur côté initial',
    backToP2Title: 'Retour en 2e période : les équipes reprennent leur côté',
    overtimeTitle: 'Prolongation : vérifiez le côté de votre équipe',
    overtimeSideTitle: 'Prolongation : de quel côté défendons-nous ?',
  },
  state: {
    label: 'État du match',
    goalie: (name: string) => `Gardien : ${name}`,
    goalieUnset: 'Gardien : non renseigné',
    ourNetEmpty: 'Notre filet désert',
    theirNetEmpty: 'Filet adverse désert',
    theirNetPresent: 'Gardien adverse présent',
  },
  strength: { even: 'Égalité', pp: 'Supériorité', pk: 'Infériorité' },
  misc: {
    tab: 'Divers',
    goalieTitle: 'Notre gardien en place',
    goalieChoose: '— Choisir —',
    goalieNone: "Aucun gardien dans l'effectif : ajoutez-en depuis l'accueil (onglet Gardiens).",
    netTitle: 'Filet adverse',
    theirNetToggle: 'Filet adverse désert',
    strengthTitle: 'Situation numérique',
    ownGoalTitle: 'But contre son camp (CSC)',
    ownGoalFor: 'CSC adversaire (but pour nous)',
    ownGoalAgainst: 'CSC de notre équipe (but contre nous)',
    penaltyTitle: 'Tir de pénalty',
    penaltyFor: 'Pour nous',
    penaltyAgainst: 'Contre nous',
    shootoutTitle: 'Tirs au but',
    shootoutUs: 'Nous',
    shootoutThem: 'Eux',
    shootoutCount: (us: string, them: string) => `Nous ${us} · Eux ${them}`,
    noteTitle: 'Note libre',
    notePlaceholder: 'Une remarque sur le match (200 caractères maximum)',
    noteAdd: 'Ajouter la note',
  },
  goalies: {
    title: "Effectif des gardiens",
    hint: 'Un gardien ajouté reste dans la base : ses statistiques gardent son nom.',
    nameLabel: 'Nom du gardien',
    add: 'Ajouter',
    rename: 'Corriger le nom',
    save: 'Enregistrer',
    cancel: 'Annuler',
    empty: 'Aucun gardien pour le moment.',
    duplicate: 'Ce gardien est déjà dans la liste.',
    unknown: 'Gardien inconnu',
    unset: 'Non renseigné',
  },
  sync: {
    synced: 'Synchronisé',
    pending: (n: number) => `${n} en attente`,
    offline: 'Hors ligne',
  },
  report: {
    title: 'Rapport de match',
    us: 'Nous',
    them: 'Eux',
    total: 'Total',
    shotsTitle: 'Tirs',
    levels: { attempts: 'Tentatives de tir', unblocked: 'Tirs non bloqués', onGoal: 'Tirs cadrés', goals: 'Buts' },
    ourSave: 'Arrêts % (notre gardien)',
    oppSave: 'Arrêts % (gardien adverse)',
    saveNote: 'hors cage vide',
    shooting: 'Réussite au tir',
    faceoffs: 'Engagements',
    won: 'Gagnés',
    lost: 'Perdus',
    zones: { off: 'Zone offensive', neutral: 'Zone neutre', def: 'Zone défensive' },
    shotMap: 'Carte des tirs',
    faceoffMap: 'Carte des engagements',
    allPeriods: 'Tout',
    for: 'Pour',
    against: 'Contre',
    both: 'Les deux',
    exportCsv: 'Exporter CSV',
    exportPdf: 'Exporter en PDF',
    pctHeader: '%',
    partial: 'Données partielles : certaines saisies ne sont pas encore synchronisées.',
    shootoutScore: (us: number, them: number) => `TAB ${us} – ${them}`,
    goaliesTitle: 'Gardiens',
    goalieCols: { name: 'Gardien', games: 'Matchs', onGoal: 'Tirs cadrés reçus', saves: 'Arrêts', goalsAgainst: 'Buts encaissés', savePct: 'Arrêts %', ownGoals: 'CSC' },
    strengthTitle: 'Situations',
    strengthCols: { situation: 'Situation', attempts: 'Tentatives', onGoal: 'Cadrés', goals: 'Buts' },
    extrasTitle: 'Événements rares',
    shootoutTitle: 'Tirs au but',
    shootoutLine: (us: string, them: string) => `Nous ${us} · Eux ${them}`,
    ownGoalsLine: (forUs: number, against: number) => `CSC adversaire : ${forUs} · CSC de notre équipe : ${against}`,
    penaltiesTitle: 'Tirs de pénalty',
    notesTitle: 'Notes',
    assignTitle: 'Attribuer un gardien',
    assignHint: (n: number) => `${n} saisie${n > 1 ? 's' : ''} sans gardien (tirs contre, CSC ou tirs au but).`,
    assignChoose: 'Gardien',
    assignButton: 'Attribuer aux saisies sans gardien',
    assignDone: (n: number) => `${n} saisie${n > 1 ? 's' : ''} attribuée${n > 1 ? 's' : ''}.`,
    assignPending: 'Attendez la fin de la synchronisation avant d’attribuer un gardien.',
    assignNoGoalie: "Ajoutez d'abord le gardien dans l'onglet Gardiens de l'accueil.",
  },
  season: {
    title: 'Saison',
    games: 'Matchs',
    totals: 'Totaux de la saison',
    perGame: '/ match',
    byGame: 'Match par match',
    map: 'Carte des tirs (matchs sélectionnés)',
    selection: 'Matchs pris en compte',
    selectionHint: 'Les matchs sans aucune saisie sont exclus. Décochez un match pour le retirer des statistiques de la saison.',
    competitionFilter: 'Compétition',
    allCompetitions: 'Toutes',
    goalies: 'Gardiens de la saison',
    date: 'Date',
    opponent: 'Adversaire',
    venue: 'Lieu',
    competition: 'Compétition',
    score: 'Score',
    sogFor: 'Tirs cadrés pour',
    sogAgainst: 'Tirs cadrés contre',
    savePct: 'Arrêts %',
    faceoffPct: 'Engagements %',
    home: 'Dom.',
    away: 'Ext.',
    refresh: 'Actualiser',
    empty: 'Aucun match enregistré.',
  },
  ui: { close: '✕' },
  errors: {
    loading: 'Chargement…',
    unknownCode: 'Code inconnu. Vérifiez le code du match.',
    badCode: 'Le code fait 4 caractères (lettres et chiffres).',
    server:
      "Serveur injoignable. Vérifiez la connexion. Si l'équipe n'a pas joué depuis plus de 7 jours, le projet Supabase est peut-être en pause : ouvrez supabase.com, choisissez le projet puis « Restore ».",
  },
} as const;
```

- [ ] **Step 12: Create `src/screens/record/describe.ts`**
```ts
import type { GameEvent, MarkResult } from '../../domain/types';
import { t } from '../../i18n/fr';

/** One line for the "last entries" list: "P2 · Tir contre · Arrêt". */
export function describeEvent(e: GameEvent, goalieNames: ReadonlyMap<string, string>): string {
  const kind = e.penalty_shot ? (e.kind === 'shot_for' ? t.kinds.penalty_for : t.kinds.penalty_against) : t.kinds[e.kind];
  const head = `${t.record.period(e.period)} · ${kind}`;
  switch (e.kind) {
    case 'note':
      return `${head} · ${e.note ?? ''}`;
    case 'state_our_goalie':
      return `${head} · ${e.goalie_id ? (goalieNames.get(e.goalie_id) ?? t.goalies.unknown) : t.state.ourNetEmpty}`;
    case 'state_their_net':
      return `${head} · ${e.result === 'empty' ? t.state.theirNetEmpty : t.state.theirNetPresent}`;
    case 'state_strength':
      return `${head} · ${t.strength[e.strength]}`;
    case 'own_goal_for':
    case 'own_goal_against':
      return head;
    default:
      return `${head} · ${t.results[e.result as MarkResult]}`;
  }
}
```

- [ ] **Step 13: Keep the app compiling.** In `src/screens/record/Recorder.tsx` replace the recent-list label (the `<span>` that uses `t.modes[e.kind]` / `t.results[e.result]`) with `describeEvent(e, NO_NAMES)`, add `import { describeEvent } from './describe';` and `const NO_NAMES: ReadonlyMap<string, string> = new Map();` at module level (the roster names arrive in Task 7). Then run `npx tsc --noEmit` and fix every remaining type error in the existing app/tests that comes from the wider types — expected ones: places typed `EventResult` that should be `MarkResult`, `t.results[...]` indexed with a wider union (cast to `MarkResult` after checking the kind), and `Period` loops (`[1, 2]` arrays typed `Period[]` are fine). Do not change behavior.

- [ ] **Step 14: Run everything**

Run: `npx tsc --noEmit && npm test`
Expected: PASS (all previous tests plus the new ones; the old `factory.test.ts` is fully replaced).

- [ ] **Step 15: Commit**
```bash
git add -A
git commit -m "feat: v2 domain model (goalies, states, CSC, shootouts, overtime), event constructors and strings"
```

### Task 3: Sync plumbing, games API, goalies API

**Files:**
- Modify: `src/events/store.ts`, `src/events/remote.ts`, `src/events/useGameEvents.ts`, `src/events/SyncContext.tsx`, `src/games/api.ts`, `src/settings.ts`, `src/screens/Home.tsx` (one-line compile patch), `src/test/fakes.tsx`
- Create: `src/goalies/api.ts`, `src/goalies/useGoalies.ts`
- Test: `src/events/store.test.ts`, `src/events/remote.test.ts`, `src/events/useGameEvents.test.tsx`, `src/games/api.test.ts` (extend/update), `src/goalies/api.test.ts`, `src/goalies/useGoalies.test.tsx`, `src/settings.test.ts` (extend)

**Interfaces:**
- Consumes: Task 2 types, `normalizeEvent`, `normalizeGame`, `AGAINST_KINDS`.
- Produces:
  - `EventStore.load()` returns normalized events; `mergeRemote` fills a missing `goalie_id` (never replaces/removes one).
  - `Remote.assignGoalie(code: string, goalieId: string): Promise<number>` (count of rows filled).
  - `GameEventsState.refresh(): Promise<void>` (re-fetch the game's server rows and merge).
  - `NewGame = { team_name; opponent; game_date; home; venue; competition; sheet_side; overtime_possible }`; `GamesApi` unchanged in shape, rows normalized.
  - `GoaliesApi { list(): Promise<Goalie[]>; add(name): Promise<Goalie>; rename(id, name): Promise<Goalie> }`, `DuplicateGoalieError`, `supabaseGoalies(client)`.
  - `SyncDeps.goalies: GoaliesApi`.
  - `useGoalies(): { goalies: Goalie[]; names: ReadonlyMap<string,string>; loading; error; reload(); add(name); rename(id, name) }` (add/rename reject with `DuplicateGoalieError`); roster cached in localStorage key `goalies`.
  - `loadCachedGoalies(): Goalie[]`, `saveCachedGoalies(g: Goalie[]): void`.
  - Test fakes: `fakeGoalies(initial?)` → `{ api, list, setFailing }`; `makeDeps({ games?, goalies? })` → `{ deps, fr, fg, fgo }`; the fake remote implements `assignGoalie` (fills matching rows, emits each changed row to subscribers).

- [ ] **Step 1: Write the failing tests**

Append to `src/events/store.test.ts` (inside the existing `describe('EventStore', …)` for the first, inside `describe('mergeRemote', …)` for the others; reuse the file's `stored` helper and imports, add `memoryKV`/`shotEv` imports if missing):
```ts
  it('loads events stored by v1 with the new columns filled in', async () => {
    const kv = memoryKV();
    const legacy = { ...shotEv('shot_for', 'goal'), sync: 'pending', mine: true } as Record<string, unknown>;
    for (const k of ['goalie_id', 'empty_net', 'strength', 'penalty_shot', 'note']) delete legacy[k];
    await kv.set('events:AB23', [legacy]);
    const [e] = await new EventStore(kv).load('AB23');
    expect(e).toMatchObject({ goalie_id: null, empty_net: false, strength: 'even', penalty_shot: false, note: null });
  });
```
```ts
  it('fills in a goalie attached on the server afterwards', () => {
    const e = shotEv('shot_against', 'goal');
    const [m] = mergeRemote([stored(e)], [{ ...e, goalie_id: 'g1' }]);
    expect(m.goalie_id).toBe('g1');
  });
  it('never replaces or removes a goalie that is already there', () => {
    const e = shotEv('shot_against', 'goal', { goalie_id: 'g1' });
    expect(mergeRemote([stored(e)], [{ ...e, goalie_id: 'g2' }])[0].goalie_id).toBe('g1');
    expect(mergeRemote([stored(e)], [{ ...e, goalie_id: null }])[0].goalie_id).toBe('g1');
  });
```

Append to `src/events/remote.test.ts`:
```ts
describe('supabaseRemote.assignGoalie', () => {
  function stub(result: { data: unknown[] | null; error: { message: string } | null }) {
    const calls: string[] = [];
    const q: Record<string, unknown> = {
      update: (v: unknown) => (calls.push(`update ${JSON.stringify(v)}`), q),
      eq: (c: string, v: unknown) => (calls.push(`eq ${c}=${v}`), q),
      is: (c: string, v: unknown) => (calls.push(`is ${c}=${v}`), q),
      in: (c: string, v: unknown[]) => (calls.push(`in ${c}=${v.join(',')}`), q),
      select: async () => result,
    };
    return { calls, client: { from: () => q } as unknown as SupabaseClient };
  }

  it("fills the goalie on this game's live shots against that have none, and returns how many", async () => {
    const { calls, client } = stub({ data: [{ id: 'a' }, { id: 'b' }], error: null });
    expect(await supabaseRemote(client).assignGoalie('AB23', 'g1')).toBe(2);
    expect(calls).toEqual([
      'update {"goalie_id":"g1"}', 'eq game_code=AB23', 'is goalie_id=null', 'eq empty_net=false', 'is deleted_at=null',
      'in kind=shot_against,own_goal_against,shootout_against',
    ]);
  });
  it('throws on a server error', async () => {
    const { client } = stub({ data: null, error: { message: 'denied' } });
    await expect(supabaseRemote(client).assignGoalie('AB23', 'g1')).rejects.toThrow('denied');
  });
});
```

Append to `src/events/useGameEvents.test.tsx` (inside its `describe`, using its `setup()` helper; import `act`, `waitFor`, `shotEv` if missing):
```tsx
  it('shows a goalie attached to an event afterwards', async () => {
    const { result, fr } = setup();
    await waitFor(() => expect(result.current.connected).toBe(true));
    const e = shotEv('shot_against', 'goal');
    act(() => fr.emit(e));
    await waitFor(() => expect(result.current.events).toHaveLength(1));
    act(() => fr.emit({ ...e, goalie_id: 'g1' }));
    await waitFor(() => expect(result.current.events[0].goalie_id).toBe('g1'));
  });

  it('refresh pulls the server rows again', async () => {
    const { result, fr } = setup();
    await waitFor(() => expect(result.current.connected).toBe(true));
    const e = shotEv('shot_against', 'goal');
    fr.rows.set(e.id, e);
    await act(async () => {
      await result.current.refresh();
    });
    await waitFor(() => expect(result.current.events).toHaveLength(1));
  });
```

Replace `src/games/api.test.ts`'s `input` constant and add a test (keep the two existing `create` tests):
```ts
const input = {
  team_name: 'Nous', opponent: 'Rouen', game_date: '2026-09-24', home: true,
  venue: 'home' as const, competition: 'coupe' as const, sheet_side: null, overtime_possible: true,
};
```
```ts
describe('supabaseGames.get', () => {
  it('fills the v2 fields of a row saved by v1', async () => {
    const row = { code: 'AB23', team_name: 'Nous', opponent: 'Rouen', game_date: '2026-09-24', home: false };
    const client = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) }) } as unknown as SupabaseClient;
    expect(await supabaseGames(client).get('AB23')).toMatchObject({ venue: 'away', competition: 'championnat', overtime_possible: true });
  });
});
```

`src/goalies/api.test.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { DuplicateGoalieError, supabaseGoalies } from './api';

const asClient = (from: unknown) => ({ from }) as unknown as SupabaseClient;
const dup = { code: '23505', message: 'duplicate key' };

describe('supabaseGoalies', () => {
  it('lists goalies sorted by name', async () => {
    const client = asClient(() => ({ select: async () => ({ data: [{ id: '2', name: 'Zoé' }, { id: '1', name: 'Alain' }], error: null }) }));
    expect((await supabaseGoalies(client).list()).map((g) => g.name)).toEqual(['Alain', 'Zoé']);
  });
  it('adds a goalie with a trimmed name', async () => {
    const rows: unknown[] = [];
    const client = asClient(() => ({
      insert: (row: { name: string }) => (rows.push(row), { select: () => ({ single: async () => ({ data: { id: '1', name: row.name }, error: null }) }) }),
    }));
    expect(await supabaseGoalies(client).add('  François Mallet ')).toEqual({ id: '1', name: 'François Mallet' });
    expect(rows).toEqual([{ name: 'François Mallet' }]);
  });
  it('reports a duplicate name with its own error', async () => {
    const client = asClient(() => ({ insert: () => ({ select: () => ({ single: async () => ({ data: null, error: dup }) }) }) }));
    await expect(supabaseGoalies(client).add('Mallet')).rejects.toBeInstanceOf(DuplicateGoalieError);
  });
  it('renames a goalie, and reports a duplicate too', async () => {
    const ok = asClient(() => ({ update: (v: { name: string }) => ({ eq: () => ({ select: () => ({ single: async () => ({ data: { id: '1', name: v.name }, error: null }) }) }) }) }));
    expect((await supabaseGoalies(ok).rename('1', ' Mallet F. ')).name).toBe('Mallet F.');
    const clash = asClient(() => ({ update: () => ({ eq: () => ({ select: () => ({ single: async () => ({ data: null, error: dup }) }) }) }) }));
    await expect(supabaseGoalies(clash).rename('1', 'X')).rejects.toBeInstanceOf(DuplicateGoalieError);
  });
  it('throws on any other error', async () => {
    const client = asClient(() => ({ select: async () => ({ data: null, error: { code: '42501', message: 'denied' } }) }));
    await expect(supabaseGoalies(client).list()).rejects.toThrow('denied');
  });
});
```

`src/goalies/useGoalies.test.tsx`:
```tsx
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SyncProvider } from '../events/SyncContext';
import { makeDeps } from '../test/fakes';
import { DuplicateGoalieError } from './api';
import { useGoalies } from './useGoalies';

function setup(goalies = [{ id: 'g1', name: 'Mallet' }]) {
  const d = makeDeps({ goalies });
  const wrapper = ({ children }: { children: ReactNode }) => <SyncProvider deps={d.deps}>{children}</SyncProvider>;
  return { ...d, ...renderHook(() => useGoalies(), { wrapper }) };
}

describe('useGoalies', () => {
  beforeEach(() => localStorage.clear());

  it('loads the roster and maps ids to names', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.goalies).toEqual([{ id: 'g1', name: 'Mallet' }]);
    expect(result.current.names.get('g1')).toBe('Mallet');
  });

  it('adds a goalie, keeps the list sorted and remembers it for offline use', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.add('Bernard');
    });
    expect(result.current.goalies.map((g) => g.name)).toEqual(['Bernard', 'Mallet']);
    expect(JSON.parse(localStorage.getItem('goalies') ?? '[]')).toHaveLength(2);
  });

  it('refuses a name already in the list, whatever the case or spacing', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await expect(result.current.add('  mallet ')).rejects.toBeInstanceOf(DuplicateGoalieError);
    });
    expect(result.current.goalies).toHaveLength(1);
  });

  it('renames a goalie in place', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.rename('g1', 'François Mallet');
    });
    expect(result.current.names.get('g1')).toBe('François Mallet');
  });

  it('falls back to the remembered roster when the server is down', async () => {
    localStorage.setItem('goalies', JSON.stringify([{ id: 'g9', name: 'Cache' }]));
    const d = makeDeps({ goalies: [] });
    d.fgo.setFailing(true);
    const wrapper = ({ children }: { children: ReactNode }) => <SyncProvider deps={d.deps}>{children}</SyncProvider>;
    const { result } = renderHook(() => useGoalies(), { wrapper });
    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.goalies).toEqual([{ id: 'g9', name: 'Cache' }]);
  });
});
```

Append to `src/settings.test.ts` (import `loadCachedGoalies`, `saveCachedGoalies`):
```ts
  it('remembers the goalie roster and survives corrupted storage', () => {
    expect(loadCachedGoalies()).toEqual([]);
    saveCachedGoalies([{ id: 'g1', name: 'Mallet' }]);
    expect(loadCachedGoalies()).toEqual([{ id: 'g1', name: 'Mallet' }]);
    localStorage.setItem('goalies', '{oops');
    expect(loadCachedGoalies()).toEqual([]);
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/events src/games src/goalies src/settings.test.ts`
Expected: FAIL (missing modules/exports: `goalies/api`, `useGoalies`, `assignGoalie`, `refresh`, `fgo`, cached goalies…).

- [ ] **Step 3: Implement**

`src/events/store.ts` — add `import { normalizeEvent } from '../domain/normalize';`, replace `mergeRemote` and `load`:
```ts
/** Merge rows from the server into the local list. Deletion is one-way, and a goalie can only be filled in, never replaced. */
export function mergeRemote(local: StoredEvent[], remote: GameEvent[]): StoredEvent[] {
  const byId = new Map(local.map((e) => [e.id, e]));
  for (const r of remote) {
    const l = byId.get(r.id);
    if (!l) {
      byId.set(r.id, { ...normalizeEvent(r), sync: 'synced', mine: false });
      continue;
    }
    let next = l;
    if (r.deleted_at && !l.deleted_at) next = { ...next, deleted_at: r.deleted_at };
    if (r.goalie_id && !l.goalie_id) next = { ...next, goalie_id: r.goalie_id };
    if (next !== l) byId.set(r.id, next);
  }
  return [...byId.values()].sort(byTime);
}
```
```ts
  async load(code: string): Promise<StoredEvent[]> {
    const evs = ((await this.kv.get(this.key(code))) as StoredEvent[] | undefined) ?? [];
    return evs.map(normalizeEvent);
  }
```

`src/events/remote.ts` — add `import { AGAINST_KINDS, type GameEvent } from '../domain/types';` (keep the existing `GameEvent` import merged), update `COLS`, the interface and the implementation:
```ts
const COLS = 'id,game_code,kind,period,x,y,dot,result,device_role,recorded_at,deleted_at,goalie_id,empty_net,strength,penalty_shot,note';
```
Interface: add
```ts
  /** Fills the goalie on this game's live shots/CSC/shootout attempts against that have none and are not on an empty net. Returns how many. */
  assignGoalie(code: string, goalieId: string): Promise<number>;
```
Implementation (inside the returned object):
```ts
    async assignGoalie(code, goalieId) {
      const { data, error } = await client
        .from('events')
        .update({ goalie_id: goalieId })
        .eq('game_code', code)
        .is('goalie_id', null)
        .eq('empty_net', false)
        .is('deleted_at', null)
        .in('kind', [...AGAINST_KINDS])
        .select('id');
      if (error) throw new Error(error.message);
      return data?.length ?? 0;
    },
```

`src/events/useGameEvents.ts` — `sameEvents` also compares the goalie; expose `refresh`:
```ts
function sameEvents(a: StoredEvent[], b: StoredEvent[]): boolean {
  return a.length === b.length && a.every((e, i) => e.id === b[i].id && e.sync === b[i].sync && e.deleted_at === b[i].deleted_at && e.goalie_id === b[i].goalie_id);
}
```
Add `refresh(): Promise<void>;` to `GameEventsState` and return `refresh: refetch` in the returned object.

`src/games/api.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeGame } from '../domain/normalize';
import type { Competition, Game, SheetSide, Venue } from '../domain/types';
import { generateCode } from './code';

export interface NewGame {
  team_name: string;
  opponent: string;
  game_date: string;
  /** Kept for v1 compatibility: `venue === 'home'`. */
  home: boolean;
  venue: Venue;
  competition: Competition;
  sheet_side: SheetSide | null;
  overtime_possible: boolean;
}

export interface GamesApi {
  create(input: NewGame): Promise<Game>;
  get(code: string): Promise<Game | null>;
  list(): Promise<Game[]>;
}

export class ApiError extends Error {}

const COLS = 'code,team_name,opponent,game_date,home,venue,competition,sheet_side,overtime_possible,created_at';
type Row = Parameters<typeof normalizeGame>[0];

export function supabaseGames(client: SupabaseClient, rand: () => number = Math.random): GamesApi {
  return {
    async create(input) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateCode(rand);
        const { error } = await client.from('games').insert({ code, ...input });
        if (!error) return { code, ...input };
        if (error.code !== '23505') throw new ApiError(error.message);
      }
      throw new ApiError('Impossible de générer un code unique');
    },
    async get(code) {
      const { data, error } = await client.from('games').select(COLS).eq('code', code).maybeSingle();
      if (error) throw new ApiError(error.message);
      return data ? normalizeGame(data as Row) : null;
    },
    async list() {
      const { data, error } = await client
        .from('games')
        .select(COLS)
        .order('game_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw new ApiError(error.message);
      return ((data ?? []) as Row[]).map(normalizeGame);
    },
  };
}
```

`src/goalies/api.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Goalie } from '../domain/types';

/** The roster already has a goalie with this name (case and outer spaces ignored). */
export class DuplicateGoalieError extends Error {}

export interface GoaliesApi {
  list(): Promise<Goalie[]>;
  add(name: string): Promise<Goalie>;
  rename(id: string, name: string): Promise<Goalie>;
}

const COLS = 'id,name,created_at';
const byName = (a: Goalie, b: Goalie) => a.name.localeCompare(b.name, 'fr');
const fail = (e: { code?: string; message: string }): never => {
  throw e.code === '23505' ? new DuplicateGoalieError(e.message) : new Error(e.message);
};

export function supabaseGoalies(client: SupabaseClient): GoaliesApi {
  return {
    async list() {
      const { data, error } = await client.from('goalies').select(COLS);
      if (error) fail(error);
      return ((data ?? []) as Goalie[]).sort(byName);
    },
    async add(name) {
      const { data, error } = await client.from('goalies').insert({ name: name.trim() }).select(COLS).single();
      if (error) fail(error);
      return data as Goalie;
    },
    async rename(id, name) {
      const { data, error } = await client.from('goalies').update({ name: name.trim() }).eq('id', id).select(COLS).single();
      if (error) fail(error);
      return data as Goalie;
    },
  };
}
```

`src/settings.ts` — add (import `Goalie` from `./domain/types`):
```ts
export const loadCachedGoalies = (): Goalie[] => readJson<Goalie[]>('goalies') ?? [];
export const saveCachedGoalies = (g: Goalie[]): void => store.set('goalies', JSON.stringify(g));
```

`src/goalies/useGoalies.ts`:
```ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Goalie } from '../domain/types';
import { useSync } from '../events/SyncContext';
import { loadCachedGoalies, saveCachedGoalies } from '../settings';

const byName = (a: Goalie, b: Goalie) => a.name.localeCompare(b.name, 'fr');

export interface GoaliesState {
  goalies: Goalie[];
  names: ReadonlyMap<string, string>;
  loading: boolean;
  error: boolean;
  reload(): Promise<void>;
  /** Rejects with DuplicateGoalieError when the name is already taken. */
  add(name: string): Promise<Goalie>;
  rename(id: string, name: string): Promise<Goalie>;
}

/** The goalie roster. The last copy seen is kept on the device, so the names are there even without network. */
export function useGoalies(): GoaliesState {
  const { goalies: api } = useSync();
  const [goalies, setGoalies] = useState<Goalie[]>(loadCachedGoalies);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const listRef = useRef(goalies);
  const alive = useRef(true);

  const remember = useCallback((list: Goalie[]) => {
    listRef.current = list;
    saveCachedGoalies(list);
    setGoalies(list);
  }, []);

  const reload = useCallback(async () => {
    try {
      const list = await api.list();
      if (!alive.current) return;
      remember(list);
      setError(false);
    } catch {
      if (alive.current) setError(true);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [api, remember]);

  useEffect(() => {
    alive.current = true;
    void reload();
    return () => {
      alive.current = false;
    };
  }, [reload]);

  const add = useCallback(
    async (name: string) => {
      const g = await api.add(name);
      if (alive.current) remember([...listRef.current, g].sort(byName));
      return g;
    },
    [api, remember],
  );

  const rename = useCallback(
    async (id: string, name: string) => {
      const g = await api.rename(id, name);
      if (alive.current) remember(listRef.current.map((x) => (x.id === id ? g : x)).sort(byName));
      return g;
    },
    [api, remember],
  );

  const names = useMemo(() => new Map(goalies.map((g) => [g.id, g.name])), [goalies]);
  return { goalies, names, loading, error, reload, add, rename };
}
```

`src/events/SyncContext.tsx` — add `import { supabaseGoalies, type GoaliesApi } from '../goalies/api';`, add `goalies: GoaliesApi;` to `SyncDeps`, and in `defaultSyncDeps()` add `goalies: supabaseGoalies(supabase)`.

`src/screens/Home.tsx` (temporary compile patch, the screen is rewritten in Task 5): in `onCreate`, call `games.create({ team_name: team.trim(), opponent: opponent.trim(), game_date: date, home, venue: home ? 'home' : 'away', competition: 'championnat', sheet_side: null, overtime_possible: true })`.

`src/test/fakes.tsx` — add imports (`AGAINST_KINDS`, `Goalie`, `DuplicateGoalieError`, `GoaliesApi`), implement `assignGoalie` on the fake remote (inside `const remote: Remote = { … }`):
```ts
    async assignGoalie(code, goalieId) {
      guard();
      let n = 0;
      for (const [id, r] of rows) {
        if (r.game_code === code && !r.goalie_id && !r.empty_net && !r.deleted_at && AGAINST_KINDS.includes(r.kind)) {
          const next = { ...r, goalie_id: goalieId };
          rows.set(id, next);
          listeners.forEach((l) => l(next));
          n++;
        }
      }
      return n;
    },
```
add `fakeGoalies` and update `makeDeps`:
```ts
export function fakeGoalies(initial: Goalie[] = []) {
  const list = [...initial];
  let failing = false;
  let n = 0;
  const guard = () => {
    if (failing) throw new Error('down');
  };
  const clash = (name: string, except?: string) =>
    list.some((g) => g.id !== except && g.name.trim().toLowerCase() === name.trim().toLowerCase());
  const api: GoaliesApi = {
    async list() {
      guard();
      return [...list].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    },
    async add(name) {
      guard();
      if (clash(name)) throw new DuplicateGoalieError('duplicate');
      const g = { id: `goalie-${++n}`, name: name.trim() };
      list.push(g);
      return { ...g };
    },
    async rename(id, name) {
      guard();
      if (clash(name, id)) throw new DuplicateGoalieError('duplicate');
      const g = list.find((x) => x.id === id);
      if (!g) throw new Error('unknown goalie');
      g.name = name.trim();
      return { ...g };
    },
  };
  return { api, list, setFailing: (v: boolean) => (failing = v) };
}

export function makeDeps(opts: { games?: Game[]; goalies?: Goalie[] } = {}) {
  const fr = fakeRemote();
  const fg = fakeGames(opts.games);
  const fgo = fakeGoalies(opts.goalies);
  const deps: SyncDeps = { store: new EventStore(memoryKV()), remote: fr.remote, games: fg.api, goalies: fgo.api };
  return { deps, fr, fg, fgo };
}
```
(`AGAINST_KINDS` is `readonly Kind[]`: `AGAINST_KINDS.includes(r.kind)` type-checks.)

- [ ] **Step 4: Run tests and type-check**

Run: `npx tsc --noEmit && npm test`
Expected: PASS. If an existing test builds a `SyncDeps` by hand or a `NewGame` without the new fields, add the missing fields (they are required).

- [ ] **Step 5: Commit**
```bash
git add -A
git commit -m "feat: goalies API and roster hook, retro-assignment call, v2 columns through the sync layer"
```

---

### Task 4: Statistics engine (game, goalies, season)

**Files:**
- Rewrite: `src/stats/game.ts`
- Create: `src/stats/goalies.ts`
- Modify: `src/stats/season.ts`
- Test: `src/stats/game.test.ts` (extend), `src/stats/goalies.test.ts` (new), `src/stats/season.test.ts` (extend)

**Interfaces:**
- Consumes: Task 2 types/builders.
- Produces:
  - `game.ts`: existing exports kept (`ShotLevels`, `WinLoss`, `PeriodStats`, `ratio`, `shotLevels`, `periodStats`, `faceoffsByDot`) plus `StrengthLine {shotsFor: ShotLevels; shotsAgainst: ShotLevels}`, `ShootoutSummary {us: {goals; attempts}; them: {goals; attempts}}`, and `GameStats { p1; p2; p3: PeriodStats; hasOvertime: boolean; total: PeriodStats; score: {us; them}; ownGoals: {for; against}; shootout: ShootoutSummary | null; byStrength: Record<Strength, StrengthLine> }`; `computeGameStats(events)`.
  - `goalies.ts`: `GoalieLine {goalieId: string|null; name; games; onGoal; saves; goalsAgainst; savePct: number|null; ownGoals}`, `computeGoalieStats(events, names: ReadonlyMap<string,string>, labels: {unset: string; unknown: string}): GoalieLine[]`, `countUnassigned(events): number`.
  - `season.ts`: `CompetitionFilter = Competition | 'all'`, `computeSeasonStats(games, events, excluded?, competition = 'championnat')`.

Rules (spec §7): team stats = every `shot_for`/`shot_against` (empty net, penalty shots and overtime included; CSC, shootouts, states, notes excluded). `ourSavePct`/`oppSavePct` ignore `empty_net` shots. Score = goals + CSC. Goalie lines ignore `empty_net` shots and CSC on an empty net, and show CSC in their own column.

- [ ] **Step 1: Write the failing tests**

Append to `src/stats/game.test.ts` (add `noteEv`, `ownGoalEv`, `penaltyEv`, `shootoutEv`, `stateEv` to the builders import):
```ts
describe('v2 rules', () => {
  it('keeps empty-net shots in the team stats but out of the goalie save %', () => {
    const s = computeGameStats([
      shotEv('shot_against', 'save'), shotEv('shot_against', 'goal'), shotEv('shot_against', 'goal', { empty_net: true }),
      shotEv('shot_for', 'goal', { empty_net: true }), shotEv('shot_for', 'save'), shotEv('shot_for', 'goal'),
    ]);
    expect(s.total.shotsAgainst).toEqual({ attempts: 3, unblocked: 3, onGoal: 3, goals: 2 });
    expect(s.total.ourSavePct).toBeCloseTo(0.5); // 1 save on 2 shots at a defended net
    expect(s.total.oppSavePct).toBeCloseTo(0.5);
    expect(s.total.shootingPct).toBeCloseTo(2 / 3);
    expect(s.score).toEqual({ us: 2, them: 2 });
  });

  it('counts own goals in the score only', () => {
    const s = computeGameStats([shotEv('shot_for', 'goal'), ownGoalEv('own_goal_for'), ownGoalEv('own_goal_against'), ownGoalEv('own_goal_against')]);
    expect(s.score).toEqual({ us: 2, them: 2 });
    expect(s.ownGoals).toEqual({ for: 1, against: 2 });
    expect(s.total.shotsFor.attempts).toBe(1);
    expect(s.total.shotsAgainst.attempts).toBe(0);
    expect(s.total.ourSavePct).toBeNull();
  });

  it('counts penalty shots as ordinary shots', () => {
    const s = computeGameStats([penaltyEv('shot_for', 'goal'), penaltyEv('shot_against', 'save')]);
    expect(s.total.shotsFor).toEqual({ attempts: 1, unblocked: 1, onGoal: 1, goals: 1 });
    expect(s.total.ourSavePct).toBe(1);
  });

  it('keeps shootouts out of shots and score and summarizes them', () => {
    const s = computeGameStats([
      shotEv('shot_for', 'goal'),
      shootoutEv('shootout_for', 'goal'), shootoutEv('shootout_for', 'missed'),
      shootoutEv('shootout_against', 'goal'), shootoutEv('shootout_against', 'save'), shootoutEv('shootout_against', 'save'),
    ]);
    expect(s.score).toEqual({ us: 1, them: 0 });
    expect(s.total.shotsFor.attempts).toBe(1);
    expect(s.shootout).toEqual({ us: { goals: 1, attempts: 2 }, them: { goals: 1, attempts: 3 } });
    expect(computeGameStats([shotEv('shot_for', 'goal')]).shootout).toBeNull();
  });

  it('reports overtime only when there is period-3 activity, with its own column', () => {
    expect(computeGameStats([shotEv('shot_for', 'goal')]).hasOvertime).toBe(false);
    const ot = computeGameStats([shotEv('shot_for', 'goal', { period: 3 }), shotEv('shot_for', 'save', { period: 1 })]);
    expect(ot.hasOvertime).toBe(true);
    expect(ot.p3.shotsFor.goals).toBe(1);
    expect(ot.total.shotsFor.onGoal).toBe(2);
  });

  it('splits shots by numerical situation and treats a missing value as even', () => {
    const legacy = { ...shotEv('shot_for', 'goal') } as Record<string, unknown>;
    delete legacy.strength;
    const s = computeGameStats([
      shotEv('shot_for', 'goal', { strength: 'pp' }),
      shotEv('shot_against', 'goal', { strength: 'pk' }), shotEv('shot_against', 'save', { strength: 'pk' }),
      legacy as never,
    ]);
    expect(s.byStrength.pp.shotsFor.goals).toBe(1);
    expect(s.byStrength.pk.shotsAgainst).toEqual({ attempts: 2, unblocked: 2, onGoal: 2, goals: 1 });
    expect(s.byStrength.even.shotsFor.goals).toBe(1);
  });

  it('ignores states and notes', () => {
    const s = computeGameStats([stateEv('state_strength', 'pp'), noteEv('glissant')]);
    expect(s.total.shotsFor.attempts + s.total.shotsAgainst.attempts).toBe(0);
    expect(s.score).toEqual({ us: 0, them: 0 });
  });
});
```

`src/stats/goalies.test.ts`:
```ts
import { noteEv, ownGoalEv, shootoutEv, shotEv, stateEv } from '../test/builders';
import { computeGoalieStats, countUnassigned } from './goalies';

const names = new Map([['g1', 'Mallet'], ['g2', 'Bernard']]);
const labels = { unset: 'Non renseigné', unknown: 'Gardien inconnu' };
const stats = (evs: Parameters<typeof computeGoalieStats>[0]) => computeGoalieStats(evs, names, labels);

describe('computeGoalieStats', () => {
  it('groups the shots faced by goalie and computes the save %', () => {
    const lines = stats([
      shotEv('shot_against', 'save', { goalie_id: 'g1' }), shotEv('shot_against', 'save', { goalie_id: 'g1' }),
      shotEv('shot_against', 'save', { goalie_id: 'g1' }), shotEv('shot_against', 'goal', { goalie_id: 'g1' }),
      shotEv('shot_against', 'missed', { goalie_id: 'g1' }), shotEv('shot_against', 'blocked', { goalie_id: 'g1' }),
      shotEv('shot_against', 'save', { goalie_id: 'g2', game_code: 'CD45' }),
    ]);
    expect(lines).toEqual([
      { goalieId: 'g2', name: 'Bernard', games: 1, onGoal: 1, saves: 1, goalsAgainst: 0, savePct: 1, ownGoals: 0 },
      { goalieId: 'g1', name: 'Mallet', games: 1, onGoal: 4, saves: 3, goalsAgainst: 1, savePct: 0.75, ownGoals: 0 },
    ]);
  });

  it('leaves empty-net shots out, and shows a CSC apart without touching the save %', () => {
    const lines = stats([
      shotEv('shot_against', 'save', { goalie_id: 'g1' }),
      shotEv('shot_against', 'goal', { goalie_id: null, empty_net: true }),
      ownGoalEv('own_goal_against', { goalie_id: 'g1' }),
      ownGoalEv('own_goal_against', { goalie_id: null, empty_net: true }),
      ownGoalEv('own_goal_for'),
    ]);
    expect(lines).toEqual([{ goalieId: 'g1', name: 'Mallet', games: 1, onGoal: 1, saves: 1, goalsAgainst: 0, savePct: 1, ownGoals: 1 }]);
  });

  it('puts shots with no goalie on a "not set" line, only when there are some', () => {
    expect(stats([shotEv('shot_against', 'save', { goalie_id: null })])).toEqual([
      { goalieId: null, name: 'Non renseigné', games: 1, onGoal: 1, saves: 1, goalsAgainst: 0, savePct: 1, ownGoals: 0 },
    ]);
    expect(stats([shotEv('shot_for', 'goal')])).toEqual([]);
  });

  it('counts the games a goalie played, including one set in net without a shot', () => {
    const lines = stats([
      shotEv('shot_against', 'save', { goalie_id: 'g1', game_code: 'AAAA' }),
      shotEv('shot_against', 'save', { goalie_id: 'g1', game_code: 'BBBB' }),
      stateEv('state_our_goalie', 'goalie', { goalie_id: 'g2', game_code: 'CCCC' }),
    ]);
    expect(lines.map((l) => [l.name, l.games])).toEqual([['Bernard', 1], ['Mallet', 2]]);
  });

  it('ignores deleted events and unrelated kinds', () => {
    expect(stats([
      shotEv('shot_against', 'goal', { goalie_id: 'g1', deleted_at: '2026-09-24T19:00:00Z' }),
      noteEv('x'), shootoutEv('shootout_against', 'save', { goalie_id: 'g1' }),
    ])).toEqual([]);
  });

  it('sorts goalies by name with the "not set" line last, and names an unknown goalie', () => {
    const lines = stats([
      shotEv('shot_against', 'save', { goalie_id: null }),
      shotEv('shot_against', 'save', { goalie_id: 'g1' }),
      shotEv('shot_against', 'save', { goalie_id: 'g-unknown' }),
      shotEv('shot_against', 'save', { goalie_id: 'g2' }),
    ]);
    expect(lines.map((l) => l.name)).toEqual(['Bernard', 'Gardien inconnu', 'Mallet', 'Non renseigné']);
  });
});

describe('countUnassigned', () => {
  it('counts live entries against us with no goalie and not on an empty net', () => {
    expect(countUnassigned([
      shotEv('shot_against', 'save'), ownGoalEv('own_goal_against'), shootoutEv('shootout_against', 'goal'),
      shotEv('shot_against', 'save', { empty_net: true }), shotEv('shot_against', 'save', { goalie_id: 'g1' }),
      shotEv('shot_against', 'save', { deleted_at: '2026-09-24T19:00:00Z' }), shotEv('shot_for', 'goal'),
    ])).toBe(3);
  });
});
```

Append to `src/stats/season.test.ts` (import `shotEv`, `gameFx` if missing):
```ts
describe('competition filter', () => {
  const champ = gameFx({ code: 'AAAA', game_date: '2026-09-20' });
  const cup = gameFx({ code: 'BBBB', competition: 'coupe', game_date: '2026-09-27' });
  const events = [
    shotEv('shot_for', 'goal', { game_code: 'AAAA' }),
    shotEv('shot_for', 'goal', { game_code: 'BBBB' }), shotEv('shot_for', 'goal', { game_code: 'BBBB' }),
  ];
  it('defaults to Championnat', () => {
    const s = computeSeasonStats([champ, cup], events);
    expect(s.rows.map((r) => r.game.code)).toEqual(['AAAA']);
    expect(s.total.shotsFor.goals).toBe(1);
  });
  it('shows another competition, or all of them', () => {
    expect(computeSeasonStats([champ, cup], events, new Set(), 'coupe').total.shotsFor.goals).toBe(2);
    expect(computeSeasonStats([champ, cup], events, new Set(), 'all').games).toBe(2);
  });
  it('treats a game without a competition as Championnat', () => {
    const v1 = { ...champ } as Record<string, unknown>;
    delete v1.competition;
    expect(computeSeasonStats([v1 as never], events, new Set(), 'championnat').games).toBe(1);
  });
});
```
(For the last test, `computeSeasonStats` compares `(g.competition ?? 'championnat')`.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/stats`
Expected: FAIL (`goalies` module missing; new fields/exports missing).

- [ ] **Step 3: Rewrite `src/stats/game.ts`**
```ts
import type { DotId, FaceoffResult, GameEvent, ShotResult, Strength, Zone } from '../domain/types';
import { DOT_IDS, dotZone } from '../rink/dots';

export interface ShotLevels {
  attempts: number;
  unblocked: number;
  onGoal: number;
  goals: number;
}
export interface WinLoss {
  won: number;
  lost: number;
  pct: number | null;
}
export interface PeriodStats {
  shotsFor: ShotLevels;
  shotsAgainst: ShotLevels;
  /** Our goalies: shots aimed at a defended net only (empty-net shots and CSC are left out). */
  ourSavePct: number | null;
  /** Their goalie, same rule. */
  oppSavePct: number | null;
  shootingPct: number | null;
  faceoffs: WinLoss;
  faceoffsByZone: Record<Zone, WinLoss>;
}
export interface StrengthLine {
  shotsFor: ShotLevels;
  shotsAgainst: ShotLevels;
}
export interface ShootoutSummary {
  us: { goals: number; attempts: number };
  them: { goals: number; attempts: number };
}
export interface GameStats {
  p1: PeriodStats;
  p2: PeriodStats;
  /** Overtime. */
  p3: PeriodStats;
  hasOvertime: boolean;
  total: PeriodStats;
  /** Goals (empty net, penalty shots and overtime included) + own goals. Shootouts do not count. */
  score: { us: number; them: number };
  ownGoals: { for: number; against: number };
  shootout: ShootoutSummary | null;
  byStrength: Record<Strength, StrengthLine>;
}

export const ratio = (n: number, d: number): number | null => (d === 0 ? null : n / d);

export function shotLevels(results: ShotResult[]): ShotLevels {
  const count = (r: ShotResult) => results.filter((x) => x === r).length;
  const goals = count('goal');
  const saves = count('save');
  const missed = count('missed');
  const blocked = count('blocked');
  return { attempts: goals + saves + missed + blocked, unblocked: goals + saves + missed, onGoal: goals + saves, goals };
}

function winLoss(results: FaceoffResult[]): WinLoss {
  const won = results.filter((r) => r === 'won').length;
  const lost = results.length - won;
  return { won, lost, pct: ratio(won, won + lost) };
}

const live = (events: GameEvent[]) => events.filter((e) => !e.deleted_at);
const results = (evs: GameEvent[]) => evs.map((e) => e.result as ShotResult);

export function periodStats(events: GameEvent[]): PeriodStats {
  const evs = live(events);
  const forShots = evs.filter((e) => e.kind === 'shot_for');
  const againstShots = evs.filter((e) => e.kind === 'shot_against');
  const f = shotLevels(results(forShots));
  const a = shotLevels(results(againstShots));
  // A goalie only faces shots aimed at a defended net.
  const fGoalie = shotLevels(results(forShots.filter((e) => !e.empty_net)));
  const aGoalie = shotLevels(results(againstShots.filter((e) => !e.empty_net)));
  const fo = evs.filter((e) => e.kind === 'faceoff' && e.dot !== null);
  const zone = (z: Zone) => winLoss(fo.filter((e) => dotZone(e.dot as DotId) === z).map((e) => e.result as FaceoffResult));
  return {
    shotsFor: f,
    shotsAgainst: a,
    ourSavePct: ratio(aGoalie.onGoal - aGoalie.goals, aGoalie.onGoal),
    oppSavePct: ratio(fGoalie.onGoal - fGoalie.goals, fGoalie.onGoal),
    shootingPct: ratio(f.goals, f.onGoal),
    faceoffs: winLoss(fo.map((e) => e.result as FaceoffResult)),
    faceoffsByZone: { off: zone('off'), neutral: zone('neutral'), def: zone('def') },
  };
}

function strengthLine(evs: GameEvent[], s: Strength): StrengthLine {
  const inS = evs.filter((e) => (e.strength ?? 'even') === s);
  return {
    shotsFor: shotLevels(results(inS.filter((e) => e.kind === 'shot_for'))),
    shotsAgainst: shotLevels(results(inS.filter((e) => e.kind === 'shot_against'))),
  };
}

function shootoutSummary(evs: GameEvent[]): ShootoutSummary | null {
  const mine = evs.filter((e) => e.kind === 'shootout_for');
  const theirs = evs.filter((e) => e.kind === 'shootout_against');
  if (mine.length + theirs.length === 0) return null;
  const goals = (l: GameEvent[]) => l.filter((e) => e.result === 'goal').length;
  return { us: { goals: goals(mine), attempts: mine.length }, them: { goals: goals(theirs), attempts: theirs.length } };
}

export function computeGameStats(events: GameEvent[]): GameStats {
  const evs = live(events);
  const total = periodStats(evs);
  const ownFor = evs.filter((e) => e.kind === 'own_goal_for').length;
  const ownAgainst = evs.filter((e) => e.kind === 'own_goal_against').length;
  return {
    p1: periodStats(evs.filter((e) => e.period === 1)),
    p2: periodStats(evs.filter((e) => e.period === 2)),
    p3: periodStats(evs.filter((e) => e.period === 3)),
    hasOvertime: evs.some((e) => e.period === 3),
    total,
    score: { us: total.shotsFor.goals + ownFor, them: total.shotsAgainst.goals + ownAgainst },
    ownGoals: { for: ownFor, against: ownAgainst },
    shootout: shootoutSummary(evs),
    byStrength: { even: strengthLine(evs, 'even'), pp: strengthLine(evs, 'pp'), pk: strengthLine(evs, 'pk') },
  };
}

export function faceoffsByDot(events: GameEvent[]): Record<DotId, WinLoss> {
  const fo = live(events).filter((e) => e.kind === 'faceoff');
  return Object.fromEntries(
    DOT_IDS.map((id) => [id, winLoss(fo.filter((e) => e.dot === id).map((e) => e.result as FaceoffResult))]),
  ) as Record<DotId, WinLoss>;
}
```

- [ ] **Step 4: Create `src/stats/goalies.ts`**
```ts
import { AGAINST_KINDS, type GameEvent } from '../domain/types';
import { ratio } from './game';

export interface GoalieLine {
  /** null: shots that no goalie was attached to ("Non renseigné"). */
  goalieId: string | null;
  name: string;
  /** Games where the goalie was in net (a shot faced or a change to him). */
  games: number;
  onGoal: number;
  saves: number;
  goalsAgainst: number;
  savePct: number | null;
  /** CSC against us while he was in net: shown apart, never in the save %. */
  ownGoals: number;
}

interface Acc {
  games: Set<string>;
  onGoal: number;
  saves: number;
  goalsAgainst: number;
  ownGoals: number;
}

/** Lines for one game or a whole season: our goalies only, empty-net shots and shootouts left out of the save %. */
export function computeGoalieStats(
  events: GameEvent[],
  names: ReadonlyMap<string, string>,
  labels: { unset: string; unknown: string },
): GoalieLine[] {
  const acc = new Map<string | null, Acc>();
  const get = (id: string | null) => {
    let a = acc.get(id);
    if (!a) {
      a = { games: new Set(), onGoal: 0, saves: 0, goalsAgainst: 0, ownGoals: 0 };
      acc.set(id, a);
    }
    return a;
  };
  for (const e of events) {
    if (e.deleted_at) continue;
    if (e.kind === 'state_our_goalie' && e.result === 'goalie') {
      get(e.goalie_id).games.add(e.game_code);
    } else if (e.kind === 'shot_against' && !e.empty_net) {
      const a = get(e.goalie_id ?? null);
      a.games.add(e.game_code);
      if (e.result === 'save') {
        a.onGoal++;
        a.saves++;
      } else if (e.result === 'goal') {
        a.onGoal++;
        a.goalsAgainst++;
      }
    } else if (e.kind === 'own_goal_against' && !e.empty_net) {
      const a = get(e.goalie_id ?? null);
      a.games.add(e.game_code);
      a.ownGoals++;
    }
  }
  const lines: GoalieLine[] = [];
  for (const [id, a] of acc) {
    // The "not set" line only exists when it has something to show.
    if (id === null && a.onGoal === 0 && a.ownGoals === 0) continue;
    lines.push({
      goalieId: id,
      name: id === null ? labels.unset : (names.get(id) ?? labels.unknown),
      games: a.games.size,
      onGoal: a.onGoal,
      saves: a.saves,
      goalsAgainst: a.goalsAgainst,
      savePct: ratio(a.saves, a.onGoal),
      ownGoals: a.ownGoals,
    });
  }
  return lines.sort((x, y) => (x.goalieId === null ? 1 : y.goalieId === null ? -1 : x.name.localeCompare(y.name, 'fr')));
}

/** Entries against us that a goalie can still be attached to (report's "Attribuer un gardien"). */
export function countUnassigned(events: GameEvent[]): number {
  return events.filter((e) => !e.deleted_at && AGAINST_KINDS.includes(e.kind) && !e.goalie_id && !e.empty_net).length;
}
```
(The goalie-stats test "ignores … shootout" relies on shootouts adding nothing: a shootout alone creates no line.)

- [ ] **Step 5: Update `src/stats/season.ts`** — add `Competition` to the type import, export the filter type, add the parameter and filter the games:
```ts
import type { Competition, Game, GameEvent } from '../domain/types';
```
```ts
export type CompetitionFilter = Competition | 'all';
```
Replace the function head and first lines with:
```ts
/** `excluded`: codes of games the user unticked. Games with no live events are always excluded. `competition`: which games to look at (Championnat by default). */
export function computeSeasonStats(
  games: Game[],
  events: GameEvent[],
  excluded: ReadonlySet<string> = new Set(),
  competition: CompetitionFilter = 'championnat',
): SeasonStats {
  const shown = competition === 'all' ? games : games.filter((g) => (g.competition ?? 'championnat') === competition);
  const byCode = new Map<string, GameEvent[]>();
  for (const e of events) {
    if (e.deleted_at) continue;
    const list = byCode.get(e.game_code) ?? [];
    list.push(e);
    byCode.set(e.game_code, list);
  }
  const sorted = [...shown].sort((x, y) => y.game_date.localeCompare(x.game_date));
```
(the rest of the function is unchanged).

- [ ] **Step 6: Run tests**

Run: `npx tsc --noEmit && npm test`
Expected: PASS. The v1 `ReportScreen`/`SeasonScreen` tests must still pass (they use `stats.p1/p2/total` and the default competition).

- [ ] **Step 7: Commit**
```bash
git add -A
git commit -m "feat: v2 statistics (empty net, CSC, penalty shots, shootouts, overtime, situations, goalie lines, competition filter)"
```

### Task 5: Home — competition, venue, starting goalie, goalie roster tab

**Files:**
- Rewrite: `src/screens/Home.tsx`
- Create: `src/screens/GoalieRoster.tsx`
- Test: `src/screens/Home.test.tsx` (extend)

**Interfaces:**
- Consumes: `useGoalies()` / `GoaliesState`, `DuplicateGoalieError`, `makeGoalieState`, `NewGame`, `useSync().store`, `useBackgroundSync().run`, `t`.
- Produces: `GoalieRoster({ roster }: { roster: GoaliesState })`. Creating a game with a starting goalie stores a `state_our_goalie` event (period 1, role `all`) for the new game and triggers a background sync.

Rules: competition default Championnat; "prolongations possibles" defaults to on for Championnat/Coupe and off for Playoffs (changing the competition resets it, the user can still tick it); the sheet-side question appears only on neutral ground; the starting goalie is one of: "Plus tard" (default, nothing recorded), a roster goalie, or "Notre filet désert".

- [ ] **Step 1: Write the failing tests** — append to `src/screens/Home.test.tsx` (it already imports `screen`, `userEvent`, `t`, `gameFx`, `makeDeps`, `renderWithSync`, `Home`; add `within` only if needed):
```tsx
describe('Home v2', () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '';
  });

  async function fillNames() {
    await userEvent.type(screen.getByLabelText(t.home.team), 'Nous');
    await userEvent.type(screen.getByLabelText(t.home.opponent), 'Rouen');
  }

  it('creates a playoffs game on neutral ground with the sheet side and the overtime box ticked by hand', async () => {
    const d = makeDeps();
    renderWithSync(<Home />, d.deps);
    await fillNames();
    expect(screen.getByLabelText(t.home.overtimePossible)).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: t.competitions.playoffs }));
    expect(screen.getByLabelText(t.home.overtimePossible)).not.toBeChecked();
    await userEvent.click(screen.getByLabelText(t.home.overtimePossible));
    expect(screen.queryByRole('button', { name: t.sheetSides.visitor })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: t.venues.neutral }));
    await userEvent.click(screen.getByRole('button', { name: t.sheetSides.visitor }));
    await userEvent.click(screen.getByRole('button', { name: t.home.create }));
    await screen.findByText('K7QX');
    expect(d.fg.games.at(-1)).toMatchObject({
      competition: 'playoffs', venue: 'neutral', home: false, sheet_side: 'visitor', overtime_possible: true,
    });
  });

  it('a league game at home has no sheet side and allows overtime by default', async () => {
    const d = makeDeps();
    renderWithSync(<Home />, d.deps);
    await fillNames();
    await userEvent.click(screen.getByRole('button', { name: t.home.create }));
    await screen.findByText('K7QX');
    expect(d.fg.games.at(-1)).toMatchObject({ competition: 'championnat', venue: 'home', home: true, sheet_side: null, overtime_possible: true });
  });

  it('records the starting goalie as a goalie change when the game is created', async () => {
    const d = makeDeps({ goalies: [{ id: 'g1', name: 'François Mallet' }] });
    renderWithSync(<Home />, d.deps);
    await fillNames();
    await screen.findByRole('option', { name: 'François Mallet' });
    await userEvent.selectOptions(screen.getByLabelText(t.home.startGoalie), 'g1');
    await userEvent.click(screen.getByRole('button', { name: t.home.create }));
    await screen.findByText('K7QX');
    const [ev] = await d.deps.store.load('K7QX');
    expect(ev).toMatchObject({ kind: 'state_our_goalie', result: 'goalie', goalie_id: 'g1', period: 1 });
  });

  it('"Notre filet désert" records an empty net as the starting state', async () => {
    const d = makeDeps();
    renderWithSync(<Home />, d.deps);
    await fillNames();
    await userEvent.selectOptions(screen.getByLabelText(t.home.startGoalie), t.home.startGoalieEmpty);
    await userEvent.click(screen.getByRole('button', { name: t.home.create }));
    await screen.findByText('K7QX');
    expect((await d.deps.store.load('K7QX'))[0]).toMatchObject({ kind: 'state_our_goalie', result: 'empty', goalie_id: null });
  });

  it('"Plus tard" (the default) records no starting state', async () => {
    const d = makeDeps();
    renderWithSync(<Home />, d.deps);
    await fillNames();
    await userEvent.click(screen.getByRole('button', { name: t.home.create }));
    await screen.findByText('K7QX');
    expect(await d.deps.store.load('K7QX')).toEqual([]);
  });

  it('lists the goalies, adds one and refuses a duplicate', async () => {
    const d = makeDeps({ goalies: [{ id: 'g1', name: 'Mallet' }] });
    renderWithSync(<Home />, d.deps);
    await userEvent.click(screen.getByRole('button', { name: t.home.tabGoalies }));
    expect(await screen.findByText('Mallet')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(t.goalies.nameLabel), 'Bernard');
    await userEvent.click(screen.getByRole('button', { name: t.goalies.add }));
    expect(await screen.findByText('Bernard')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(t.goalies.nameLabel), ' mallet');
    await userEvent.click(screen.getByRole('button', { name: t.goalies.add }));
    expect(await screen.findByText(t.goalies.duplicate)).toBeInTheDocument();
    expect(d.fgo.list).toHaveLength(2);
  });

  it('corrects a goalie name', async () => {
    const d = makeDeps({ goalies: [{ id: 'g1', name: 'Malet' }] });
    renderWithSync(<Home />, d.deps);
    await userEvent.click(screen.getByRole('button', { name: t.home.tabGoalies }));
    await userEvent.click(await screen.findByRole('button', { name: t.goalies.rename }));
    const input = screen.getByRole('textbox', { name: t.goalies.rename });
    await userEvent.clear(input);
    await userEvent.type(input, 'Mallet');
    await userEvent.click(screen.getByRole('button', { name: t.goalies.save }));
    expect(await screen.findByText('Mallet')).toBeInTheDocument();
    expect(d.fgo.list[0].name).toBe('Mallet');
  });

  it('offers no way to delete a goalie', async () => {
    renderWithSync(<Home />, makeDeps({ goalies: [{ id: 'g1', name: 'Mallet' }] }).deps);
    await userEvent.click(screen.getByRole('button', { name: t.home.tabGoalies }));
    await screen.findByText('Mallet');
    expect(screen.queryByRole('button', { name: /suppr|supprimer|delete/i })).toBeNull();
  });
});
```
(All identifiers used above are already imported by the existing v1 Home tests; add none unless `tsc` asks.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/screens/Home.test.tsx`
Expected: FAIL (no tabs, no competition/venue controls, no roster).

- [ ] **Step 3: Create `src/screens/GoalieRoster.tsx`**
```tsx
import { useState, type FormEvent } from 'react';
import { DuplicateGoalieError } from '../goalies/api';
import type { GoaliesState } from '../goalies/useGoalies';
import { t } from '../i18n/fr';

/** The roster tab: add a goalie, correct a name. There is no delete: a goalie's statistics keep his name. */
export function GoalieRoster({ roster }: { roster: GoaliesState }) {
  const { goalies, loading, error, add, rename } = roster;
  const [name, setName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const explain = (e: unknown) => (e instanceof DuplicateGoalieError ? t.goalies.duplicate : t.errors.server);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await add(name);
      setName('');
      setMessage(null);
    } catch (err) {
      setMessage(explain(err));
    }
  }

  async function save(id: string) {
    if (!draft.trim()) return;
    try {
      await rename(id, draft);
      setEditing(null);
      setMessage(null);
    } catch (err) {
      setMessage(explain(err));
    }
  }

  return (
    <section className="card stack">
      <h2>{t.goalies.title}</h2>
      <p className="muted">{t.goalies.hint}</p>
      {error && goalies.length === 0 && (
        <p className="notice" role="alert">
          {t.errors.server}
        </p>
      )}
      {message && (
        <p className="notice" role="alert">
          {message}
        </p>
      )}
      <form className="row" onSubmit={submit}>
        <label className="field">
          {t.goalies.nameLabel}
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </label>
        <button className="btn btn--primary" type="submit">
          {t.goalies.add}
        </button>
      </form>
      {!loading && goalies.length === 0 ? (
        <p className="muted">{t.goalies.empty}</p>
      ) : (
        <ul className="list">
          {goalies.map((g) => (
            <li key={g.id}>
              {editing === g.id ? (
                <>
                  <input className="input" aria-label={t.goalies.rename} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={60} />
                  <span className="row">
                    <button type="button" className="btn btn--primary" onClick={() => void save(g.id)}>
                      {t.goalies.save}
                    </button>
                    <button type="button" className="btn" onClick={() => setEditing(null)}>
                      {t.goalies.cancel}
                    </button>
                  </span>
                </>
              ) : (
                <>
                  <span>{g.name}</span>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setEditing(g.id);
                      setDraft(g.name);
                    }}
                  >
                    {t.goalies.rename}
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Rewrite `src/screens/Home.tsx`**
```tsx
import { useEffect, useState, type FormEvent } from 'react';
import { makeGoalieState } from '../domain/factory';
import type { Competition, Game, SheetSide, Venue } from '../domain/types';
import { useBackgroundSync, usePendingTotal, useSync } from '../events/SyncContext';
import { isValidCode, normalizeCode } from '../games/code';
import { useGoalies } from '../goalies/useGoalies';
import { t } from '../i18n/fr';
import { href, navigate } from '../router';
import { loadTeamName, saveTeamName, todayIso } from '../settings';
import { formatDate } from '../stats/format';
import { SyncChip } from '../ui/SyncChip';
import { GoalieRoster } from './GoalieRoster';

const COMPETITIONS: Competition[] = ['championnat', 'coupe', 'playoffs'];
const VENUES: Venue[] = ['home', 'away', 'neutral'];
const SHEET_SIDES: SheetSide[] = ['home', 'visitor'];
const EMPTY_NET = '__empty__';
/** Extra time and shootouts exist in the league and the cup, and only in the finals of the playoffs (ticked by hand). */
const overtimeByDefault = (c: Competition) => c !== 'playoffs';

type Tab = 'games' | 'goalies';

export function Home() {
  const { games, store } = useSync();
  const roster = useGoalies();
  const [tab, setTab] = useState<Tab>('games');
  const [team, setTeam] = useState(loadTeamName);
  const [opponent, setOpponent] = useState('');
  const [date, setDate] = useState(todayIso);
  const [competition, setCompetition] = useState<Competition>('championnat');
  const [venue, setVenue] = useState<Venue>('home');
  const [sheetSide, setSheetSide] = useState<SheetSide>('home');
  const [overtime, setOvertime] = useState(true);
  const [startGoalie, setStartGoalie] = useState('');
  const [created, setCreated] = useState<Game | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<Game[]>([]);
  const bg = useBackgroundSync();
  const pending = usePendingTotal();

  useEffect(() => {
    games.list().then(setRecent).catch(() => setError(t.errors.server));
  }, [games]);

  // Coming back from a game: refresh the backlog count (and try to send it) right away.
  useEffect(() => {
    void bg.run();
  }, [bg]);

  function pickCompetition(c: Competition) {
    setCompetition(c);
    setOvertime(overtimeByDefault(c));
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!team.trim() || !opponent.trim()) return;
    setBusy(true);
    setError(null);
    try {
      saveTeamName(team.trim());
      const game = await games.create({
        team_name: team.trim(),
        opponent: opponent.trim(),
        game_date: date,
        home: venue === 'home',
        venue,
        competition,
        sheet_side: venue === 'neutral' ? sheetSide : null,
        overtime_possible: overtime,
      });
      if (startGoalie) {
        await store.add(makeGoalieState({ code: game.code, period: 1, role: 'all' }, startGoalie === EMPTY_NET ? null : startGoalie));
        void bg.run();
      }
      setCreated(game);
    } catch {
      setError(t.errors.server);
    } finally {
      setBusy(false);
    }
  }

  async function onJoin(e: FormEvent) {
    e.preventDefault();
    const code = normalizeCode(joinCode);
    if (!isValidCode(code)) {
      setError(t.errors.badCode);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const g = await games.get(code);
      if (g) navigate({ name: 'record', code });
      else setError(t.errors.unknownCode);
    } catch {
      setError(t.errors.server);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <header className="topbar">
        <h1>{t.appName}</h1>
        <span className="topbar__spacer" />
        {pending > 0 && <SyncChip pending={pending} connected={false} />}
        <a className="btn" href={href({ name: 'season' })}>
          {t.nav.season}
        </a>
      </header>
      <div className="seg" role="group" aria-label={t.home.tabs}>
        <button type="button" aria-pressed={tab === 'games'} onClick={() => setTab('games')}>
          {t.home.tabGames}
        </button>
        <button type="button" aria-pressed={tab === 'goalies'} onClick={() => setTab('goalies')}>
          {t.home.tabGoalies}
        </button>
      </div>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {tab === 'goalies' ? (
        <GoalieRoster roster={roster} />
      ) : (
        <div className="grid">
          <section className="card stack">
            <h2>{t.home.newGame}</h2>
            {created ? (
              <div className="card card--dark stack">
                <span className="muted">{t.home.codeTitle}</span>
                <span className="code-display">{created.code}</span>
                <span className="muted">{t.home.codeHint}</span>
                <div className="row">
                  <a className="btn" href={href({ name: 'record', code: created.code })}>
                    {t.home.startRecording}
                  </a>
                </div>
              </div>
            ) : (
              <form className="stack" onSubmit={onCreate}>
                <label className="field">
                  {t.home.team}
                  <input className="input" value={team} onChange={(e) => setTeam(e.target.value)} required maxLength={60} />
                </label>
                <label className="field">
                  {t.home.opponent}
                  <input className="input" value={opponent} onChange={(e) => setOpponent(e.target.value)} required maxLength={60} />
                </label>
                <label className="field">
                  {t.home.date}
                  <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                </label>
                <div className="seg" role="group" aria-label={t.home.competition}>
                  {COMPETITIONS.map((c) => (
                    <button key={c} type="button" aria-pressed={competition === c} onClick={() => pickCompetition(c)}>
                      {t.competitions[c]}
                    </button>
                  ))}
                </div>
                <div className="seg" role="group" aria-label={t.home.venue}>
                  {VENUES.map((v) => (
                    <button key={v} type="button" aria-pressed={venue === v} onClick={() => setVenue(v)}>
                      {t.venues[v]}
                    </button>
                  ))}
                </div>
                {venue === 'neutral' && (
                  <div className="stack">
                    <span className="muted">{t.home.sheetSide}</span>
                    <div className="seg" role="group" aria-label={t.home.sheetSide}>
                      {SHEET_SIDES.map((s) => (
                        <button key={s} type="button" aria-pressed={sheetSide === s} onClick={() => setSheetSide(s)}>
                          {t.sheetSides[s]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <label className="row">
                  <input type="checkbox" checked={overtime} onChange={(e) => setOvertime(e.target.checked)} />
                  {t.home.overtimePossible}
                </label>
                <label className="field">
                  {t.home.startGoalie}
                  <select className="input" value={startGoalie} onChange={(e) => setStartGoalie(e.target.value)}>
                    <option value="">{t.home.startGoalieLater}</option>
                    {roster.goalies.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                    <option value={EMPTY_NET}>{t.home.startGoalieEmpty}</option>
                  </select>
                </label>
                <button className="btn btn--primary" type="submit" disabled={busy}>
                  {t.home.create}
                </button>
              </form>
            )}
          </section>
          <section className="card stack">
            <h2>{t.home.join}</h2>
            <form className="stack" onSubmit={onJoin}>
              <label className="field">
                {t.home.codeLabel}
                <input
                  className="input input--code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  autoCapitalize="characters"
                  autoComplete="off"
                  placeholder="K7QX"
                />
              </label>
              <button className="btn btn--primary" type="submit" disabled={busy}>
                {t.home.joinButton}
              </button>
            </form>
          </section>
          <section className="card stack">
            <h2>{t.home.recent}</h2>
            {recent.length === 0 ? (
              <p className="muted">{t.home.noGames}</p>
            ) : (
              <ul className="list">
                {recent.slice(0, 8).map((g) => (
                  <li key={g.code}>
                    <span>
                      <strong>{g.opponent}</strong>{' '}
                      <span className="muted">
                        {formatDate(g.game_date)} · {t.competitions[g.competition]} · {t.venuesShort[g.venue]} · {g.code}
                      </span>
                    </span>
                    <span className="row">
                      <a className="btn" href={href({ name: 'record', code: g.code })}>
                        {t.nav.record}
                      </a>
                      <a className="btn" href={href({ name: 'report', code: g.code })}>
                        {t.nav.report}
                      </a>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 5: Run tests and type-check**

Run: `npx tsc --noEmit && npm test`
Expected: PASS (the v1 Home tests keep passing: the labels they use still exist).

- [ ] **Step 6: Commit**
```bash
git add -A
git commit -m "feat: home with competition, venue, starting goalie and the goalie roster tab"
```

---

### Task 6: Recording screen — state banner, "Divers" tab, overtime

**Files:**
- Rewrite: `src/screens/record/Recorder.tsx`
- Create: `src/screens/record/MiscPanel.tsx`, `src/screens/record/StateBanner.tsx`, `src/screens/record/SidePrompt.tsx`
- Modify: `src/styles/theme.css`
- Test: `src/screens/record/RecordScreen.test.tsx` (extend)

**Interfaces:**
- Consumes: Task 2 constructors/`computeMatchState`/`describeEvent`, `useGoalies`, `useGameEvents`, `attacksRight(…, defendOT)`, `RecordSetup.defendOT`.
- Produces: the recording screen with (a) a permanent `StateBanner` (button that opens Divers), (b) a fourth mode "Divers" for every role, (c) `Prol.` in the period toggle when `game.overtime_possible`, with a side question the first time.
  - Every shot/faceoff/rare event is built with `ctx.state = computeMatchState(events)`.
  - `MiscPanel({ game, ctx: EventContext, state: MatchState, goalies: Goalie[], events: GameEvent[], onRecord })`: goalie `<select>` (label `t.misc.goalieTitle`, options: choose / roster / "Notre filet désert"), opponent-net toggle (`aria-pressed`), strength segmented control, CSC (2 small buttons), penalty shot (for/against then `ResultButtons` But/Arrêt/Raté), shootouts (only if `game.overtime_possible`; two `role="group"` rows named `t.misc.shootoutUs` / `t.misc.shootoutThem` with But/Arrêt/Raté buttons and a live counter), free note (input labelled `t.misc.noteTitle`, max 200).
  - Small buttons ignore a second tap on the same control within 600 ms (double tap = one event).

- [ ] **Step 1: Write the failing tests** — append to `src/screens/record/RecordScreen.test.tsx`. Add imports if missing: `act`, `within` (from `@testing-library/react`), `Game`, `Goalie`, `Role` (types), `RecordSetup`. The file already has `tapRink(x, y)` (clicks the rink with a mocked 400×200 rect), `saveSetup`, `makeDeps`, `renderWithSync`, `gameFx`, `RecordScreen`, `t`.
```tsx
function renderWith(opts: { role?: Role; goalies?: Goalie[]; game?: Partial<Game>; setup?: Partial<RecordSetup> } = {}) {
  const d = makeDeps({ games: [gameFx(opts.game)], goalies: opts.goalies });
  saveSetup('AB23', { role: opts.role ?? 'all', defendP1: 'left', period: 1, ...opts.setup });
  renderWithSync(<RecordScreen code="AB23" />, d.deps);
  return d;
}
const stored = (d: ReturnType<typeof renderWith>) => d.deps.store.load('AB23');
const openMisc = async () => fireEvent.click(await screen.findByRole('button', { name: t.misc.tab }));
const mallet = [{ id: 'g1', name: 'François Mallet' }];

describe('states and the Divers tab', () => {
  beforeEach(() => localStorage.clear());

  it('a shot against carries the goalie chosen in Divers, and the banner shows him', async () => {
    const d = renderWith({ goalies: mallet });
    expect(await screen.findByText(t.state.goalieUnset)).toBeInTheDocument();
    await openMisc();
    await screen.findByRole('option', { name: 'François Mallet' });
    fireEvent.change(screen.getByLabelText(t.misc.goalieTitle), { target: { value: 'g1' } });
    expect(await screen.findByText(t.state.goalie('François Mallet'))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t.modes.shot_against }));
    await tapRink(40, 100);
    fireEvent.click(screen.getByRole('button', { name: t.results.save }));
    await waitFor(async () => expect((await stored(d)).some((e) => e.kind === 'shot_against')).toBe(true));
    expect((await stored(d)).find((e) => e.kind === 'shot_against')).toMatchObject({ goalie_id: 'g1', empty_net: false });
  });

  it('"Notre filet désert" flags the next shots against and leaves them without a goalie', async () => {
    const d = renderWith({ goalies: mallet });
    await openMisc();
    await screen.findByRole('option', { name: t.state.ourNetEmpty });
    fireEvent.change(screen.getByLabelText(t.misc.goalieTitle), { target: { value: '__empty__' } });
    expect(await screen.findByText(t.state.ourNetEmpty, { selector: '.banner' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t.modes.shot_against }));
    await tapRink(40, 100);
    fireEvent.click(screen.getByRole('button', { name: t.results.goal }));
    await waitFor(async () => expect((await stored(d)).some((e) => e.kind === 'shot_against')).toBe(true));
    expect((await stored(d)).find((e) => e.kind === 'shot_against')).toMatchObject({ goalie_id: null, empty_net: true });
  });

  it('undoing the last change brings the previous state back', async () => {
    renderWith({ goalies: mallet });
    await openMisc();
    await screen.findByRole('option', { name: 'François Mallet' });
    fireEvent.change(screen.getByLabelText(t.misc.goalieTitle), { target: { value: 'g1' } });
    await screen.findByText(t.state.goalie('François Mallet'));
    fireEvent.click(screen.getByRole('button', { name: t.record.undoLast }));
    expect(await screen.findByText(t.state.goalieUnset)).toBeInTheDocument();
  });

  it('the opponent empty net flags our next shots for', async () => {
    const d = renderWith();
    await openMisc();
    fireEvent.click(screen.getByRole('button', { name: t.misc.theirNetToggle }));
    await waitFor(() => expect(document.querySelector('.banner')).toHaveTextContent(t.state.theirNetEmpty));
    fireEvent.click(screen.getByRole('button', { name: t.modes.shot_for }));
    await tapRink(360, 100);
    fireEvent.click(screen.getByRole('button', { name: t.results.goal }));
    await waitFor(async () => expect((await stored(d)).some((e) => e.kind === 'shot_for')).toBe(true));
    expect((await stored(d)).find((e) => e.kind === 'shot_for')).toMatchObject({ empty_net: true, goalie_id: null });
  });

  it('the numerical situation tags the shots that follow', async () => {
    const d = renderWith();
    await openMisc();
    fireEvent.click(within(screen.getByRole('group', { name: t.misc.strengthTitle })).getByRole('button', { name: t.strength.pp }));
    await waitFor(() => expect(document.querySelector('.banner')).toHaveTextContent(t.strength.pp));
    fireEvent.click(screen.getByRole('button', { name: t.modes.shot_for }));
    await tapRink(360, 100);
    fireEvent.click(screen.getByRole('button', { name: t.results.save }));
    await waitFor(async () => expect((await stored(d)).some((e) => e.kind === 'shot_for')).toBe(true));
    expect((await stored(d)).find((e) => e.kind === 'shot_for')).toMatchObject({ strength: 'pp' });
  });

  it('a CSC is recorded once even if the small button is double tapped, and shows in the recent list', async () => {
    const d = renderWith();
    await openMisc();
    const csc = screen.getByRole('button', { name: t.misc.ownGoalFor });
    act(() => {
      csc.click();
      csc.click();
    });
    await waitFor(async () => expect((await stored(d)).filter((e) => e.kind === 'own_goal_for')).toHaveLength(1));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });
    expect((await stored(d)).filter((e) => e.kind === 'own_goal_for')).toHaveLength(1);
    expect(screen.getByText(`P1 · ${t.kinds.own_goal_for}`)).toBeInTheDocument();
  });

  it('a penalty shot has no position and counts as a shot', async () => {
    const d = renderWith({ game: { overtime_possible: false } });
    await openMisc();
    fireEvent.click(screen.getByRole('button', { name: t.misc.penaltyAgainst }));
    fireEvent.click(screen.getByRole('button', { name: t.results.save }));
    await waitFor(async () => expect((await stored(d)).some((e) => e.penalty_shot)).toBe(true));
    expect((await stored(d)).find((e) => e.penalty_shot)).toMatchObject({ kind: 'shot_against', result: 'save', x: null, y: null });
  });

  it('records shootout attempts and shows the running count', async () => {
    const d = renderWith();
    await openMisc();
    fireEvent.click(within(screen.getByRole('group', { name: t.misc.shootoutUs })).getByRole('button', { name: t.results.goal }));
    expect(await screen.findByText(t.misc.shootoutCount('1/1', '0/0'))).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('group', { name: t.misc.shootoutThem })).getByRole('button', { name: t.results.save }));
    await waitFor(async () => expect((await stored(d)).map((e) => e.kind).sort()).toEqual(['shootout_against', 'shootout_for']));
  });

  it('has no shootout section when overtime is not possible', async () => {
    renderWith({ game: { overtime_possible: false } });
    await openMisc();
    expect(screen.queryByRole('group', { name: t.misc.shootoutUs })).toBeNull();
    expect(screen.queryByRole('button', { name: t.record.period(3) })).toBeNull();
  });

  it('adds a free note', async () => {
    const d = renderWith();
    await openMisc();
    fireEvent.change(screen.getByLabelText(t.misc.noteTitle), { target: { value: '  terrain glissant ' } });
    fireEvent.click(screen.getByRole('button', { name: t.misc.noteAdd }));
    await waitFor(async () => expect((await stored(d)).some((e) => e.kind === 'note')).toBe(true));
    expect((await stored(d)).find((e) => e.kind === 'note')).toMatchObject({ note: 'terrain glissant', result: 'note' });
  });

  it('a single-role tracker still gets the Divers tab', async () => {
    renderWith({ role: 'shots_against' });
    expect(await screen.findByRole('button', { name: t.misc.tab })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.modes.shot_for })).toBeNull();
  });

  it('clicking the banner opens the Divers tab', async () => {
    renderWith();
    fireEvent.click(await screen.findByText(t.state.goalieUnset));
    expect(await screen.findByLabelText(t.misc.goalieTitle)).toBeInTheDocument();
  });
});

describe('overtime', () => {
  beforeEach(() => localStorage.clear());

  it('asks which side we defend, then records shots in period 3 with the right orientation', async () => {
    const d = renderWith();
    fireEvent.click(await screen.findByRole('button', { name: t.record.period(3) }));
    const dialog = screen.getByRole('dialog', { name: t.record.overtimeSideTitle });
    fireEvent.click(within(dialog).getByRole('button', { name: t.setup.defendRight }));
    expect(screen.queryByRole('dialog')).toBeNull();
    // Defending the right side in overtime, we attack left: a tap at 90 % of the width is stored at 10 %.
    await tapRink(360, 100);
    fireEvent.click(screen.getByRole('button', { name: t.results.goal }));
    await waitFor(async () => expect((await stored(d)).some((e) => e.kind === 'shot_for')).toBe(true));
    expect((await stored(d)).find((e) => e.kind === 'shot_for')).toMatchObject({ period: 3, x: 0.1, y: 0.5 });
  });

  it('does not ask again when the side is already known, and warns about the ends instead', async () => {
    renderWith({ setup: { period: 2, defendOT: 'left' } });
    fireEvent.click(await screen.findByRole('button', { name: t.record.period(3) }));
    expect(screen.getByRole('dialog', { name: t.record.overtimeTitle })).toBeInTheDocument();
  });
});
```
Add `.banner` to the queries above by giving the banner element the class `banner` (Step 4). The two `findByText(..., { selector: '.banner' })` calls rely on it.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/screens/record`
Expected: FAIL (no banner, no Divers tab, no Prol. button).

- [ ] **Step 3: Create the small components**

`src/screens/record/StateBanner.tsx`:
```tsx
import type { MatchState } from '../../domain/matchState';
import { t } from '../../i18n/fr';

/** The current state of the match, always visible: who is in net, the opponent net, the numerical situation. */
export function StateBanner({ state, names, onOpen }: { state: MatchState; names: ReadonlyMap<string, string>; onOpen: () => void }) {
  const goalie = state.ourNetEmpty
    ? t.state.ourNetEmpty
    : state.ourGoalieId
      ? t.state.goalie(names.get(state.ourGoalieId) ?? t.goalies.unknown)
      : t.state.goalieUnset;
  const parts = [goalie, state.theirNetEmpty ? t.state.theirNetEmpty : null, state.strength !== 'even' ? t.strength[state.strength] : null].filter(
    (p): p is string => p !== null,
  );
  return (
    <button type="button" className={`banner${state.ourNetEmpty || state.theirNetEmpty ? ' banner--alert' : ''}`} title={t.state.label} onClick={onOpen}>
      {parts.join(' · ')}
    </button>
  );
}
```
The banner text must be exactly the joined parts (tests look for e.g. `Gardien : François Mallet` and `Notre filet désert`).

`src/screens/record/SidePrompt.tsx`:
```tsx
import type { Side } from '../../domain/types';
import { t } from '../../i18n/fr';

/** Asked when entering overtime for the first time on this device: no rule is assumed about the ends. */
export function SidePrompt({ onPick, onCancel }: { onPick: (s: Side) => void; onCancel: () => void }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={t.record.overtimeSideTitle}>
      <h1>{t.record.overtimeSideTitle}</h1>
      <p>{t.setup.sideHint}</p>
      <div className="row">
        <button type="button" className="btn btn--big" autoFocus onClick={() => onPick('left')}>
          {t.setup.defendLeft}
        </button>
        <button type="button" className="btn btn--big" onClick={() => onPick('right')}>
          {t.setup.defendRight}
        </button>
      </div>
      <button type="button" className="btn" onClick={onCancel}>
        {t.record.cancel}
      </button>
    </div>
  );
}
```

`src/screens/record/MiscPanel.tsx`:
```tsx
import { useRef, useState, type FormEvent } from 'react';
import {
  makeGoalieState, makeNote, makeOwnGoal, makePenaltyShot, makeShootout, makeStrengthState, makeTheirNetState,
  type EventContext,
} from '../../domain/factory';
import type { MatchState } from '../../domain/matchState';
import { OPEN_SHOT_RESULTS, type Game, type GameEvent, type Goalie, type OpenShotResult, type ShootoutKind, type ShotKind, type Strength } from '../../domain/types';
import { t } from '../../i18n/fr';
import { ResultButtons } from '../../ui/ResultButtons';

const EMPTY_NET = '__empty__';
const STRENGTHS: Strength[] = ['even', 'pp', 'pk'];
/** A second tap on the same control this soon is a double tap, not a second entry. */
const LOCKOUT_MS = 600;

interface Props {
  game: Game;
  ctx: EventContext;
  state: MatchState;
  goalies: Goalie[];
  events: GameEvent[];
  onRecord: (e: GameEvent) => void;
}

/** Rare events and the match states. Deliberately smaller buttons than the shot results. */
export function MiscPanel({ game, ctx, state, goalies, events, onRecord }: Props) {
  const [penalty, setPenalty] = useState<ShotKind | null>(null);
  const [note, setNote] = useState('');
  const last = useRef<Record<string, number>>({});

  /** Runs `fn` unless the same control fired a moment ago. */
  const once = (key: string, fn: () => void) => {
    const now = Date.now();
    if (now - (last.current[key] ?? -Infinity) < LOCKOUT_MS) return;
    last.current[key] = now;
    fn();
  };

  const goalieValue = state.ourNetEmpty ? EMPTY_NET : (state.ourGoalieId ?? '');
  const shootoutCount = (kind: ShootoutKind) => {
    const list = events.filter((e) => !e.deleted_at && e.kind === kind);
    return `${list.filter((e) => e.result === 'goal').length}/${list.length}`;
  };

  function submitNote(e: FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    once('note', () => {
      onRecord(makeNote(ctx, note));
      setNote('');
    });
  }

  const shootoutRow = (kind: ShootoutKind, label: string) => (
    <div className="row" role="group" aria-label={label}>
      <strong>{label}</strong>
      {OPEN_SHOT_RESULTS.map((r: OpenShotResult) => (
        <button key={r} type="button" className="btn btn--small" onClick={() => once(`${kind}:${r}`, () => onRecord(makeShootout(ctx, kind, r)))}>
          {t.results[r]}
        </button>
      ))}
    </div>
  );

  return (
    <div className="misc">
      <section className="stack">
        <h2>{t.misc.goalieTitle}</h2>
        <select
          className="input"
          aria-label={t.misc.goalieTitle}
          value={goalieValue}
          onChange={(e) => {
            const v = e.target.value;
            if (v) onRecord(makeGoalieState(ctx, v === EMPTY_NET ? null : v));
          }}
        >
          <option value="">{t.misc.goalieChoose}</option>
          {goalies.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
          <option value={EMPTY_NET}>{t.state.ourNetEmpty}</option>
        </select>
        {goalies.length === 0 && <p className="muted">{t.misc.goalieNone}</p>}
      </section>

      <section className="stack">
        <h2>{t.misc.netTitle}</h2>
        <div className="row">
          <button
            type="button"
            className="btn btn--small"
            aria-pressed={state.theirNetEmpty}
            onClick={() => once('their-net', () => onRecord(makeTheirNetState(ctx, !state.theirNetEmpty)))}
          >
            {t.misc.theirNetToggle}
          </button>
        </div>
      </section>

      <section className="stack">
        <h2>{t.misc.strengthTitle}</h2>
        <div className="seg" role="group" aria-label={t.misc.strengthTitle}>
          {STRENGTHS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={state.strength === s}
              onClick={() => {
                if (s !== state.strength) once('strength', () => onRecord(makeStrengthState(ctx, s)));
              }}
            >
              {t.strength[s]}
            </button>
          ))}
        </div>
      </section>

      <section className="stack">
        <h2>{t.misc.ownGoalTitle}</h2>
        <div className="row">
          <button type="button" className="btn btn--small" onClick={() => once('own-for', () => onRecord(makeOwnGoal(ctx, 'own_goal_for')))}>
            {t.misc.ownGoalFor}
          </button>
          <button type="button" className="btn btn--small" onClick={() => once('own-against', () => onRecord(makeOwnGoal(ctx, 'own_goal_against')))}>
            {t.misc.ownGoalAgainst}
          </button>
        </div>
      </section>

      <section className="stack">
        <h2>{t.misc.penaltyTitle}</h2>
        <div className="seg" role="group" aria-label={t.misc.penaltyTitle}>
          <button type="button" aria-pressed={penalty === 'shot_for'} onClick={() => setPenalty(penalty === 'shot_for' ? null : 'shot_for')}>
            {t.misc.penaltyFor}
          </button>
          <button type="button" aria-pressed={penalty === 'shot_against'} onClick={() => setPenalty(penalty === 'shot_against' ? null : 'shot_against')}>
            {t.misc.penaltyAgainst}
          </button>
        </div>
        {penalty && (
          <ResultButtons
            results={OPEN_SHOT_RESULTS}
            onPick={(r) =>
              once('penalty', () => {
                onRecord(makePenaltyShot(ctx, penalty, r));
                setPenalty(null);
              })
            }
            onCancel={() => setPenalty(null)}
          />
        )}
      </section>

      {game.overtime_possible && (
        <section className="stack">
          <h2>{t.misc.shootoutTitle}</h2>
          <p className="muted">{t.misc.shootoutCount(shootoutCount('shootout_for'), shootoutCount('shootout_against'))}</p>
          {shootoutRow('shootout_for', t.misc.shootoutUs)}
          {shootoutRow('shootout_against', t.misc.shootoutThem)}
        </section>
      )}

      <section className="stack">
        <h2>{t.misc.noteTitle}</h2>
        <form className="row" onSubmit={submitNote}>
          <input
            className="input"
            aria-label={t.misc.noteTitle}
            placeholder={t.misc.notePlaceholder}
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button type="submit" className="btn btn--small">
            {t.misc.noteAdd}
          </button>
        </form>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Rewrite `src/screens/record/Recorder.tsx`**
```tsx
import { useMemo, useRef, useState } from 'react';
import { makeFaceoff, makeShot } from '../../domain/factory';
import { computeMatchState } from '../../domain/matchState';
import {
  FACEOFF_RESULTS, SHOT_RESULTS, type DotId, type FaceoffResult, type Game, type Period, type Point, type Role, type ShotKind,
  type ShotResult, type Side,
} from '../../domain/types';
import { useGameEvents } from '../../events/useGameEvents';
import { useGoalies } from '../../goalies/useGoalies';
import { t } from '../../i18n/fr';
import { attacksRight, endLabels } from '../../rink/coords';
import { Rink } from '../../rink/Rink';
import { href } from '../../router';
import type { RecordSetup } from '../../settings';
import { ResultButtons } from '../../ui/ResultButtons';
import { SyncChip } from '../../ui/SyncChip';
import { describeEvent } from './describe';
import { MiscPanel } from './MiscPanel';
import { SidePrompt } from './SidePrompt';
import { StateBanner } from './StateBanner';

type Mode = ShotKind | 'faceoff' | 'misc';
const ALL_MODES: Mode[] = ['shot_for', 'shot_against', 'faceoff', 'misc'];
const modeLabel = (m: Mode) => (m === 'misc' ? t.misc.tab : t.modes[m]);

export function initialMode(role: Role): Mode {
  if (role === 'shots_against') return 'shot_against';
  if (role === 'faceoffs') return 'faceoff';
  return 'shot_for';
}

export function Recorder({ game, setup, onSetupChange }: { game: Game; setup: RecordSetup; onSetupChange: (s: RecordSetup | null) => void }) {
  const { events, pending, connected, record, remove } = useGameEvents(game.code);
  const { goalies, names } = useGoalies();
  const [mode, setMode] = useState<Mode>(() => initialMode(setup.role));
  const [tap, setTapState] = useState<Point | null>(null);
  const [dot, setDotState] = useState<DotId | null>(null);
  // Title of the overlay shown whenever the ends flip (P1 -> P2 and back, overtime), so a flip is never silent.
  const [flipNotice, setFlipNotice] = useState<string | null>(null);
  const [sidePrompt, setSidePrompt] = useState(false);
  // Refs make the selection single-use even if two taps land before React re-renders (double tap).
  const tapRef = useRef<Point | null>(null);
  const dotRef = useRef<DotId | null>(null);

  const setTap = (p: Point | null) => {
    tapRef.current = p;
    setTapState(p);
  };
  const setDot = (d: DotId | null) => {
    dotRef.current = d;
    setDotState(d);
  };
  const clear = () => {
    setTap(null);
    setDot(null);
  };

  const matchState = useMemo(() => computeMatchState(events), [events]);
  const periods: Period[] = game.overtime_possible ? [1, 2, 3] : [1, 2];
  const modes: Mode[] = setup.role === 'all' ? ALL_MODES : [initialMode(setup.role), 'misc'];
  const attackRight = attacksRight(setup.defendP1, setup.period, setup.defendOT);
  const labels = endLabels(game.team_name, game.opponent, attackRight);
  const ctx = { code: game.code, period: setup.period, role: setup.role, state: matchState };
  const shotMode = mode === 'shot_for' || mode === 'shot_against' ? mode : null;

  function changeMode(m: Mode) {
    clear();
    setMode(m);
  }
  function changePeriod(p: Period) {
    if (p === setup.period) return;
    clear();
    if (p === 3 && !setup.defendOT) {
      setSidePrompt(true);
      return;
    }
    const from = setup.period;
    onSetupChange({ ...setup, period: p });
    setFlipNotice(p === 1 ? t.record.backToP1Title : p === 2 ? (from === 3 ? t.record.backToP2Title : t.record.halftimeTitle) : t.record.overtimeTitle);
  }
  function chooseOvertimeSide(side: Side) {
    setSidePrompt(false);
    onSetupChange({ ...setup, period: 3, defendOT: side });
  }
  function pickShot(r: ShotResult) {
    const p = tapRef.current;
    if (!p || !shotMode) return;
    clear();
    record(makeShot(ctx, shotMode, p, r));
  }
  function pickFaceoff(r: FaceoffResult) {
    const d = dotRef.current;
    if (!d) return;
    clear();
    record(makeFaceoff(ctx, d, r));
  }

  const live = events.filter((e) => !e.deleted_at);
  const markers = shotMode
    ? live
        .filter((e) => e.kind === shotMode && e.period === setup.period && e.x !== null && e.y !== null)
        .map((e) => ({ id: e.id, x: e.x as number, y: e.y as number, result: e.result as ShotResult }))
    : [];
  const mine = live.filter((e) => e.mine);
  const lastTen = mine.slice(-10).reverse();

  return (
    <main className="page">
      <header className="topbar">
        <a className="btn" href="#/">
          {t.nav.home}
        </a>
        <span className="chip chip--dark">{game.code}</span>
        <strong>
          {game.team_name} – {game.opponent}
        </strong>
        <span className="topbar__spacer" />
        <div className="seg" role="group" aria-label={t.record.periodLabel}>
          {periods.map((p) => (
            <button key={p} type="button" aria-pressed={setup.period === p} onClick={() => changePeriod(p)}>
              {t.record.period(p)}
            </button>
          ))}
        </div>
        <SyncChip pending={pending} connected={connected} />
        <a className="btn" href={href({ name: 'report', code: game.code })}>
          {t.nav.report}
        </a>
      </header>

      <StateBanner state={matchState} names={names} onOpen={() => changeMode('misc')} />

      <div className="seg" role="group" aria-label={t.record.modeLabel}>
        {modes.map((m) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => changeMode(m)}>
            {modeLabel(m)}
          </button>
        ))}
      </div>

      <div className="record">
        <section className="card stack">
          {mode === 'misc' ? (
            <MiscPanel game={game} ctx={ctx} state={matchState} goalies={goalies} events={events} onRecord={record} />
          ) : (
            <>
              <Rink
                attackRight={attackRight}
                leftLabel={labels.left}
                rightLabel={labels.right}
                markers={markers}
                pending={mode === 'faceoff' ? null : tap}
                dotMode={mode === 'faceoff' ? 'interactive' : 'plain'}
                selectedDot={dot}
                onTap={mode === 'faceoff' ? undefined : setTap}
                onDotTap={mode === 'faceoff' ? setDot : undefined}
              />
              {mode !== 'faceoff' && tap && <ResultButtons results={SHOT_RESULTS} onPick={pickShot} onCancel={clear} />}
              {mode === 'faceoff' && dot && <ResultButtons results={FACEOFF_RESULTS} onPick={pickFaceoff} onCancel={clear} />}
              {!tap && !dot && (
                <div className="actionbar">
                  <div className="actionbar__hint">{mode === 'faceoff' ? t.record.tapDot : t.record.tapShot}</div>
                </div>
              )}
            </>
          )}
        </section>

        <aside className="card stack">
          <button
            type="button"
            className="btn btn--primary"
            disabled={mine.length === 0}
            onClick={() => {
              const last = mine[mine.length - 1];
              if (last) remove(last.id);
            }}
          >
            {t.record.undoLast}
          </button>
          <h2>{t.record.recent}</h2>
          {lastTen.length === 0 ? (
            <p className="muted">{t.record.none}</p>
          ) : (
            <ul className="list">
              {lastTen.map((e) => (
                <li key={e.id}>
                  <span>{describeEvent(e, names)}</span>
                  <button type="button" className="btn btn--icon" aria-label={t.record.delete} onClick={() => remove(e.id)}>
                    {t.ui.close}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="btn" onClick={() => onSetupChange(null)}>
            {t.setup.change}
          </button>
        </aside>
      </div>

      {flipNotice && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label={flipNotice}>
          <h1>{flipNotice}</h1>
          <Rink attackRight={attackRight} leftLabel={labels.left} rightLabel={labels.right} />
          <button type="button" className="btn btn--big" autoFocus onClick={() => setFlipNotice(null)}>
            {t.record.halftimeOk}
          </button>
        </div>
      )}
      {sidePrompt && <SidePrompt onPick={chooseOvertimeSide} onCancel={() => setSidePrompt(false)} />}
    </main>
  );
}
```
Notes for the implementer: (1) the existing v1 tests in `RecordScreen.test.tsx` must keep passing unchanged — in particular the ones that look for `P1`/`P2` buttons, the half-time dialog, undo, the single-use double-tap tests and the single-role tracker test; (2) `Recorder`'s `NO_NAMES` placeholder from Task 2 is gone; (3) the mode toggle now shows for every role.

- [ ] **Step 5: Add styles** — append to `src/styles/theme.css`:
```css
.banner { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--surface); color: var(--text); font: inherit; font-weight: 600; padding: 10px 16px; min-height: 44px; cursor: pointer; }
.banner--alert { background: var(--surface-dark); color: var(--text-on-dark); }
.btn--small { min-height: 44px; font-size: 14px; padding: 8px 14px; }
.btn[aria-pressed='true'] { background: var(--surface-dark); color: var(--text-on-dark); border-color: var(--surface-dark); }
.misc { display: flex; flex-direction: column; gap: 24px; }
.misc h2 { font-size: 16px; }
```

- [ ] **Step 6: Run tests and type-check**

Run: `npx tsc --noEmit && npm test`
Expected: PASS. Output must stay pristine (no `act()` warnings): use `findBy…`/`waitFor` as in the tests above.

- [ ] **Step 7: Commit**
```bash
git add -A
git commit -m "feat: recording screen with state banner, Divers tab (goalie, empty net, situation, CSC, penalty shot, shootout, note) and overtime"
```

### Task 7: Match report — goalies, situations, extras, retro-assignment, PDF, CSV

**Files:**
- Rewrite: `src/screens/report/ReportScreen.tsx`
- Modify: `src/screens/report/LevelsTable.tsx`, `src/stats/csv.ts`, `src/i18n/fr.ts` (one key), `src/styles/theme.css` (print)
- Create: `src/screens/report/GoalieTable.tsx`, `src/screens/report/StrengthTable.tsx`, `src/screens/report/ExtrasCard.tsx`, `src/screens/report/AssignGoalie.tsx`
- Test: `src/screens/report/ReportScreen.test.tsx` (extend), `src/stats/csv.test.ts` (update + extend)

**Interfaces:**
- Consumes: `computeGameStats` (`p3`, `hasOvertime`, `score`, `ownGoals`, `shootout`, `byStrength`), `computeGoalieStats`, `countUnassigned`, `useGoalies`, `useGameEvents().refresh`, `remote.assignGoalie`, `describeEvent`.
- Produces:
  - `GoalieTable({ lines: GoalieLine[]; label: string; showGames?: boolean })` — `<table aria-label={label}>`; columns name | (matchs) | cadrés reçus | arrêts | buts encaissés | arrêts % | CSC; "Non renseigné" row muted. Reused by Task 8.
  - `StrengthTable({ stats })`, `ExtrasCard({ stats, events, names })`, `AssignGoalie({ code, unassigned, pending, goalies, assignedCount, onAssigned, onDone })`.
  - `eventsToCsv(events, games, goalieNames?)` with 5 extra trailing columns `gardien;cage_vide;situation;tir_penalty;note` (existing column order unchanged).
  - CSS: `.no-print` and an A4 print stylesheet.

- [ ] **Step 1: Write the failing tests**

Update `src/stats/csv.test.ts`: the header expectation becomes
```ts
    expect(lines[0]).toBe('match;date;adversaire;type;periode;x;y;point;resultat;role;enregistre_le;gardien;cage_vide;situation;tir_penalty;note');
```
and add:
```ts
  it('adds the goalie name, the empty-net flag, the situation, the penalty flag and the note', () => {
    const csv = eventsToCsv(
      [
        shotEv('shot_against', 'save', { goalie_id: 'g1', strength: 'pk' }),
        shotEv('shot_against', 'goal', { empty_net: true }),
        penaltyEv('shot_for', 'goal'),
        noteEv('=SOMME(1;2)'),
      ],
      [game],
      new Map([['g1', 'François Mallet']]),
    );
    const rows = csv.replace('﻿', '').trim().split('\r\n').slice(1);
    expect(rows[0].endsWith(';François Mallet;;pk;;')).toBe(true);
    expect(rows[1].endsWith(';;oui;even;;')).toBe(true);
    expect(rows[2].endsWith(';;;even;oui;')).toBe(true);
    expect(rows[3]).toContain(`"'=SOMME(1;2)"`);
  });
  it('falls back to the goalie id when the name is unknown', () => {
    expect(eventsToCsv([shotEv('shot_against', 'save', { goalie_id: 'g9' })], [game])).toContain(';g9;');
  });
```
(import `penaltyEv`, `noteEv` from `../test/builders`.)

Append to `src/screens/report/ReportScreen.test.tsx` (add imports: `fireEvent`, `waitFor` (from `@testing-library/react`), `ownGoalEv`, `penaltyEv`, `noteEv`, `shootoutEv`, `gameFx`, `shotEv` (builders), types `Game`, `GameEvent`, `Goalie`):
```tsx
function renderReportWith(events: GameEvent[], opts: { goalies?: Goalie[]; game?: Partial<Game> } = {}) {
  const d = makeDeps({ games: [gameFx(opts.game)], goalies: opts.goalies });
  events.forEach((e) => d.fr.rows.set(e.id, e));
  const view = renderWithSync(<ReportScreen code="AB23" />, d.deps);
  return { ...d, ...view };
}
const mallet = [{ id: 'g1', name: 'François Mallet' }];

describe('report v2', () => {
  beforeEach(() => localStorage.clear());

  it('shows a line per goalie, keeping empty-net shots and CSC out of the save %', async () => {
    renderReportWith(
      [
        shotEv('shot_against', 'save', { goalie_id: 'g1' }), shotEv('shot_against', 'save', { goalie_id: 'g1' }),
        shotEv('shot_against', 'goal', { goalie_id: 'g1' }), shotEv('shot_against', 'goal', { empty_net: true }),
        ownGoalEv('own_goal_against', { goalie_id: 'g1' }),
      ],
      { goalies: mallet },
    );
    const table = await screen.findByRole('table', { name: t.report.goaliesTitle });
    const row = await within(table).findByRole('row', { name: /François Mallet/ });
    expect(within(row).getAllByRole('cell').map((c) => c.textContent)).toEqual(['3', '2', '1', '66,7 %', '1']);
  });

  it('puts shots without a goalie on the "Non renseigné" line and attaches a goalie on request', async () => {
    const d = renderReportWith(
      [shotEv('shot_against', 'save'), shotEv('shot_against', 'goal'), shotEv('shot_against', 'goal', { empty_net: true })],
      { goalies: mallet },
    );
    const table = await screen.findByRole('table', { name: t.report.goaliesTitle });
    expect(within(table).getByRole('row', { name: new RegExp(t.goalies.unset) })).toBeInTheDocument();
    expect(screen.getByText(t.report.assignHint(2))).toBeInTheDocument();
    await screen.findByRole('option', { name: 'François Mallet' });
    fireEvent.change(screen.getByLabelText(t.report.assignChoose), { target: { value: 'g1' } });
    fireEvent.click(screen.getByRole('button', { name: t.report.assignButton }));
    expect(await screen.findByText(t.report.assignDone(2))).toBeInTheDocument();
    const rows = [...d.fr.rows.values()];
    expect(rows.filter((r) => r.goalie_id === 'g1')).toHaveLength(2);
    expect(rows.find((r) => r.empty_net)?.goalie_id).toBeNull();
    await waitFor(() => expect(screen.queryByText(t.report.assignHint(2))).toBeNull());
    expect(within(await screen.findByRole('table', { name: t.report.goaliesTitle })).getByRole('row', { name: /François Mallet/ })).toBeInTheDocument();
  });

  it('does not offer to attach a goalie while entries are still waiting to be sent', async () => {
    const d = makeDeps({ games: [gameFx()], goalies: mallet });
    d.fr.setOnline(false);
    await d.deps.store.add(shotEv('shot_against', 'goal'));
    renderWithSync(<ReportScreen code="AB23" />, d.deps);
    expect(await screen.findByText(t.report.assignPending)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.report.assignButton })).toBeNull();
  });

  it('adds own goals to the score, shows the shootout and the extras', async () => {
    renderReportWith([
      shotEv('shot_for', 'goal'), ownGoalEv('own_goal_for'), ownGoalEv('own_goal_against'),
      shootoutEv('shootout_for', 'goal'), shootoutEv('shootout_against', 'save'),
    ]);
    expect(await screen.findByText('2 – 1')).toBeInTheDocument();
    expect(screen.getByText(t.report.shootoutScore(1, 0))).toBeInTheDocument();
    expect(screen.getByText(t.report.ownGoalsLine(1, 1))).toBeInTheDocument();
    expect(screen.getByText(t.report.shootoutLine('1/1', '0/1'))).toBeInTheDocument();
  });

  it('shows the shots by numerical situation', async () => {
    renderReportWith([shotEv('shot_for', 'goal', { strength: 'pp' }), shotEv('shot_against', 'save', { strength: 'pk' })]);
    const table = await screen.findByRole('table', { name: t.report.strengthTitle });
    const pp = within(table).getByRole('row', { name: new RegExp(t.strength.pp) });
    expect(within(pp).getAllByRole('cell').map((c) => c.textContent)).toEqual(['1', '1', '1', '0', '0', '0']);
  });

  it('shows an overtime column only when there was overtime', async () => {
    const first = renderReportWith([shotEv('shot_for', 'goal')]);
    await screen.findByText('1 – 0');
    expect(screen.queryByRole('columnheader', { name: t.record.period(3) })).toBeNull();
    first.unmount();
    renderReportWith([shotEv('shot_for', 'goal', { period: 3 })]);
    expect((await screen.findAllByRole('columnheader', { name: t.record.period(3) })).length).toBeGreaterThan(0);
  });

  it('lists penalty shots and notes, and shows the competition in the header', async () => {
    renderReportWith([penaltyEv('shot_for', 'goal'), noteEv('terrain glissant', { period: 2 })], { game: { competition: 'coupe', venue: 'neutral' } });
    expect(await screen.findByText(/terrain glissant/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(t.kinds.penalty_for))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${t.competitions.coupe} · ${t.venuesShort.neutral}`))).toBeInTheDocument();
  });

  it('exports to PDF through the print dialog and titles the page for the file name', async () => {
    const print = vi.fn();
    window.print = print;
    renderReportWith([shotEv('shot_for', 'goal')]);
    fireEvent.click(await screen.findByRole('button', { name: t.report.exportPdf }));
    expect(print).toHaveBeenCalledTimes(1);
    expect(document.title).toContain(t.report.title);
  });
});
```
(`within` must be imported from `@testing-library/react`; the existing v1 tests in this file keep passing unchanged.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/screens/report src/stats/csv.test.ts`
Expected: FAIL.

- [ ] **Step 3: `src/stats/csv.ts`** — new header and columns:
```ts
const HEADER = [
  'match', 'date', 'adversaire', 'type', 'periode', 'x', 'y', 'point', 'resultat', 'role', 'enregistre_le',
  'gardien', 'cage_vide', 'situation', 'tir_penalty', 'note',
];
```
```ts
/** CSV for French Excel: UTF-8 BOM, `;` separator, decimal comma. Deleted events are excluded. */
export function eventsToCsv(events: GameEvent[], games: Game[], goalieNames: ReadonlyMap<string, string> = new Map()): string {
  const byCode = new Map(games.map((g) => [g.code, g]));
  const rows = events
    .filter((e) => !e.deleted_at)
    .map((e) => {
      const g = byCode.get(e.game_code);
      return [
        e.game_code, g?.game_date ?? '', g?.opponent ?? '', e.kind, String(e.period), num(e.x), num(e.y), e.dot ?? '', e.result,
        e.device_role, e.recorded_at,
        e.goalie_id ? (goalieNames.get(e.goalie_id) ?? e.goalie_id) : '',
        e.empty_net ? 'oui' : '', e.strength ?? 'even', e.penalty_shot ? 'oui' : '', e.note ?? '',
      ]
        .map(esc)
        .join(';');
    });
  return '﻿' + [HEADER.join(';'), ...rows].join('\r\n') + '\r\n';
}
```
(keep `defuse`, `esc`, `num`, `downloadCsv`, `slug` as they are).

- [ ] **Step 4: Add the string** — in `src/i18n/fr.ts`, inside `report`, add `noGoalieLines: 'Aucun tir contre enregistré.',`.

- [ ] **Step 5: Update `src/screens/report/LevelsTable.tsx`** (overtime column when there was overtime):
```tsx
import { t } from '../../i18n/fr';
import type { GameStats } from '../../stats/game';

const LEVELS = ['attempts', 'unblocked', 'onGoal', 'goals'] as const;

export function LevelsTable({ stats }: { stats: GameStats }) {
  const cols = stats.hasOvertime ? [stats.p1, stats.p2, stats.p3, stats.total] : [stats.p1, stats.p2, stats.total];
  const heads = stats.hasOvertime
    ? [t.record.period(1), t.record.period(2), t.record.period(3), t.report.total]
    : [t.record.period(1), t.record.period(2), t.report.total];
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th />
            <th colSpan={cols.length}>{t.report.us}</th>
            <th colSpan={cols.length}>{t.report.them}</th>
          </tr>
          <tr>
            <th />
            {[...heads, ...heads].map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LEVELS.map((l) => (
            <tr key={l}>
              <th scope="row">{t.report.levels[l]}</th>
              {cols.map((c, i) => (
                <td key={`f${i}`}>{c.shotsFor[l]}</td>
              ))}
              {cols.map((c, i) => (
                <td key={`a${i}`}>{c.shotsAgainst[l]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 6: Create the new report components**

`src/screens/report/GoalieTable.tsx`:
```tsx
import { t } from '../../i18n/fr';
import { formatPct } from '../../stats/format';
import type { GoalieLine } from '../../stats/goalies';

/** One line per goalie. Empty-net shots and CSC are already left out of the save % by `computeGoalieStats`. */
export function GoalieTable({ lines, label, showGames = false }: { lines: GoalieLine[]; label: string; showGames?: boolean }) {
  const c = t.report.goalieCols;
  if (lines.length === 0) return <p className="muted">{t.report.noGoalieLines}</p>;
  return (
    <div className="table-wrap">
      <table className="table" aria-label={label}>
        <thead>
          <tr>
            <th>{c.name}</th>
            {showGames && <th>{c.games}</th>}
            <th>{c.onGoal}</th>
            <th>{c.saves}</th>
            <th>{c.goalsAgainst}</th>
            <th>{c.savePct}</th>
            <th>{c.ownGoals}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.goalieId ?? 'unset'} className={l.goalieId === null ? 'muted' : undefined}>
              <th scope="row">{l.name}</th>
              {showGames && <td>{l.games}</td>}
              <td>{l.onGoal}</td>
              <td>{l.saves}</td>
              <td>{l.goalsAgainst}</td>
              <td>{formatPct(l.savePct)}</td>
              <td>{l.ownGoals}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

`src/screens/report/StrengthTable.tsx`:
```tsx
import type { Strength } from '../../domain/types';
import { t } from '../../i18n/fr';
import type { GameStats } from '../../stats/game';

const ORDER: Strength[] = ['even', 'pp', 'pk'];

export function StrengthTable({ stats }: { stats: GameStats }) {
  const c = t.report.strengthCols;
  const heads = [c.attempts, c.onGoal, c.goals];
  return (
    <div className="table-wrap">
      <table className="table" aria-label={t.report.strengthTitle}>
        <thead>
          <tr>
            <th />
            <th colSpan={3}>{t.report.us}</th>
            <th colSpan={3}>{t.report.them}</th>
          </tr>
          <tr>
            <th>{c.situation}</th>
            {[...heads, ...heads].map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ORDER.map((s) => {
            const { shotsFor: f, shotsAgainst: a } = stats.byStrength[s];
            return (
              <tr key={s}>
                <th scope="row">{t.strength[s]}</th>
                <td>{f.attempts}</td>
                <td>{f.onGoal}</td>
                <td>{f.goals}</td>
                <td>{a.attempts}</td>
                <td>{a.onGoal}</td>
                <td>{a.goals}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

`src/screens/report/ExtrasCard.tsx`:
```tsx
import type { GameEvent } from '../../domain/types';
import { t } from '../../i18n/fr';
import type { GameStats } from '../../stats/game';
import { describeEvent } from '../record/describe';

const time = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const fmt = (s: { goals: number; attempts: number }) => `${s.goals}/${s.attempts}`;

/** CSC, shootouts, penalty shots and notes: nothing is shown when the game had none. */
export function ExtrasCard({ stats, events, names }: { stats: GameStats; events: GameEvent[]; names: ReadonlyMap<string, string> }) {
  const live = events.filter((e) => !e.deleted_at);
  const penalties = live.filter((e) => e.penalty_shot);
  const notes = live.filter((e) => e.kind === 'note');
  const ownGoals = stats.ownGoals.for + stats.ownGoals.against;
  if (!stats.shootout && penalties.length === 0 && notes.length === 0 && ownGoals === 0) return null;
  return (
    <section className="card stack">
      <h2>{t.report.extrasTitle}</h2>
      {ownGoals > 0 && <p>{t.report.ownGoalsLine(stats.ownGoals.for, stats.ownGoals.against)}</p>}
      {stats.shootout && (
        <>
          <h2>{t.report.shootoutTitle}</h2>
          <p>{t.report.shootoutLine(fmt(stats.shootout.us), fmt(stats.shootout.them))}</p>
        </>
      )}
      {penalties.length > 0 && (
        <>
          <h2>{t.report.penaltiesTitle}</h2>
          <ul className="list">
            {penalties.map((e) => (
              <li key={e.id}>{describeEvent(e, names)}</li>
            ))}
          </ul>
        </>
      )}
      {notes.length > 0 && (
        <>
          <h2>{t.report.notesTitle}</h2>
          <ul className="list">
            {notes.map((e) => (
              <li key={e.id}>{`${t.record.period(e.period)} · ${time(e.recorded_at)} — ${e.note ?? ''}`}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
```

`src/screens/report/AssignGoalie.tsx`:
```tsx
import { useState } from 'react';
import type { Goalie } from '../../domain/types';
import { useSync } from '../../events/SyncContext';
import { t } from '../../i18n/fr';

interface Props {
  code: string;
  /** Entries against us with no goalie (not on an empty net). */
  unassigned: number;
  /** Entries of this game still waiting to be sent from this device. */
  pending: number;
  goalies: Goalie[];
  /** How many entries the last assignment filled (null: none done yet). */
  assignedCount: number | null;
  onAssigned: (n: number) => void;
  /** Re-fetch the game's events so the report shows the new goalie. */
  onDone: () => Promise<void>;
}

/** "Attribuer un gardien": fills the missing goalie on this game's entries. The database only allows filling, never replacing. */
export function AssignGoalie({ code, unassigned, pending, goalies, assignedCount, onAssigned, onDone }: Props) {
  const { remote } = useSync();
  const [goalieId, setGoalieId] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const blocked = pending > 0 ? t.report.assignPending : goalies.length === 0 ? t.report.assignNoGoalie : null;

  async function assign() {
    if (!goalieId) return;
    setBusy(true);
    setFailed(false);
    try {
      onAssigned(await remote.assignGoalie(code, goalieId));
      await onDone();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card stack no-print">
      <h2>{t.report.assignTitle}</h2>
      {unassigned > 0 && <p className="muted">{t.report.assignHint(unassigned)}</p>}
      {assignedCount !== null && <p role="status">{t.report.assignDone(assignedCount)}</p>}
      {failed && (
        <p className="notice" role="alert">
          {t.errors.server}
        </p>
      )}
      {unassigned > 0 &&
        (blocked ? (
          <p className="muted">{blocked}</p>
        ) : (
          <div className="row">
            <label className="field">
              {t.report.assignChoose}
              <select className="input" value={goalieId} onChange={(e) => setGoalieId(e.target.value)}>
                <option value="">{t.misc.goalieChoose}</option>
                {goalies.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn btn--primary" disabled={!goalieId || busy} onClick={() => void assign()}>
              {t.report.assignButton}
            </button>
          </div>
        ))}
    </section>
  );
}
```

- [ ] **Step 7: Rewrite `src/screens/report/ReportScreen.tsx`**
```tsx
import { useEffect, useMemo, useState } from 'react';
import { SHOT_RESULTS, type DotId, type Game } from '../../domain/types';
import { useGameEvents } from '../../events/useGameEvents';
import { GameGate } from '../../games/useGame';
import { useGoalies } from '../../goalies/useGoalies';
import { t } from '../../i18n/fr';
import { DOT_IDS } from '../../rink/dots';
import { Legend } from '../../rink/Legend';
import { filterShotMarkers, type PeriodFilter, type SideFilter } from '../../rink/markers';
import { Rink } from '../../rink/Rink';
import { href } from '../../router';
import { downloadCsv, eventsToCsv, slug } from '../../stats/csv';
import { formatDate, formatPct } from '../../stats/format';
import { computeGameStats, faceoffsByDot } from '../../stats/game';
import { computeGoalieStats, countUnassigned } from '../../stats/goalies';
import { StatCard } from '../../ui/StatCard';
import { SyncChip } from '../../ui/SyncChip';
import { AssignGoalie } from './AssignGoalie';
import { ExtrasCard } from './ExtrasCard';
import { FaceoffTable } from './FaceoffTable';
import { GoalieTable } from './GoalieTable';
import { LevelsTable } from './LevelsTable';
import { StrengthTable } from './StrengthTable';

const SIDE_FILTERS: SideFilter[] = ['both', 'for', 'against'];
const sideLabel = (s: SideFilter) => (s === 'both' ? t.report.both : s === 'for' ? t.report.for : t.report.against);

export function ReportScreen({ code }: { code: string }) {
  return <GameGate code={code}>{(game) => <Report game={game} />}</GameGate>;
}

function Report({ game }: { game: Game }) {
  const { events, pending, connected, loadError, refresh } = useGameEvents(game.code);
  const { goalies, names } = useGoalies();
  const stats = useMemo(() => computeGameStats(events), [events]);
  const byDot = useMemo(() => faceoffsByDot(events), [events]);
  const goalieLines = useMemo(
    () => computeGoalieStats(events, names, { unset: t.goalies.unset, unknown: t.goalies.unknown }),
    [events, names],
  );
  const unassigned = useMemo(() => countUnassigned(events), [events]);
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [side, setSide] = useState<SideFilter>('both');
  const [assigned, setAssigned] = useState<number | null>(null);

  // The browser proposes the page title as the PDF file name.
  useEffect(() => {
    const previous = document.title;
    document.title = `${t.report.title} ${game.team_name} – ${game.opponent} ${formatDate(game.game_date)}`;
    return () => {
      document.title = previous;
    };
  }, [game.team_name, game.opponent, game.game_date]);

  const dotText: Partial<Record<DotId, string>> = {};
  for (const id of DOT_IDS) {
    const w = byDot[id];
    if (w.won + w.lost > 0) dotText[id] = `${formatPct(w.pct)} · ${w.won}/${w.won + w.lost}`;
  }
  const fo = stats.total.faceoffs;
  const periodFilters: PeriodFilter[] = stats.hasOvertime ? ['all', 1, 2, 3] : ['all', 1, 2];
  const saveSub = (p: 'ourSavePct' | 'oppSavePct') =>
    `${t.record.period(1)} ${formatPct(stats.p1[p])} · ${t.record.period(2)} ${formatPct(stats.p2[p])}${stats.hasOvertime ? ` · ${t.record.period(3)} ${formatPct(stats.p3[p])}` : ''} · ${t.report.saveNote}`;

  return (
    <main className="page">
      <header className="topbar">
        <a className="btn no-print" href="#/">
          {t.nav.home}
        </a>
        <h1>{t.report.title}</h1>
        <span className="topbar__spacer" />
        <span className="no-print">
          <SyncChip pending={pending} connected={connected} />
        </span>
        <a className="btn no-print" href={href({ name: 'record', code: game.code })}>
          {t.nav.record}
        </a>
        <button
          type="button"
          className="btn no-print"
          onClick={() => downloadCsv(`match-${game.game_date}-${slug(game.opponent)}.csv`, eventsToCsv(events, [game], names))}
        >
          {t.report.exportCsv}
        </button>
        <button type="button" className="btn btn--primary no-print" onClick={() => window.print()}>
          {t.report.exportPdf}
        </button>
      </header>

      {(pending > 0 || loadError) && (
        <p className="notice" role="status">
          {t.report.partial}
        </p>
      )}

      <div className="grid">
        <section className="card card--dark stack">
          <span className="muted">
            {formatDate(game.game_date)} · {t.competitions[game.competition]} · {t.venuesShort[game.venue]} · {game.code}
          </span>
          <div className="row">
            <span>{game.team_name}</span>
            <span className="stat-big">{`${stats.score.us} – ${stats.score.them}`}</span>
            <span>{game.opponent}</span>
          </div>
          {stats.shootout && <span>{t.report.shootoutScore(stats.shootout.us.goals, stats.shootout.them.goals)}</span>}
        </section>
        <StatCard label={t.report.ourSave} value={formatPct(stats.total.ourSavePct)} sub={saveSub('ourSavePct')} />
        <StatCard label={t.report.oppSave} value={formatPct(stats.total.oppSavePct)} sub={saveSub('oppSavePct')} />
        <StatCard label={t.report.shooting} value={formatPct(stats.total.shootingPct)} />
        <StatCard label={t.report.faceoffs} value={formatPct(fo.pct)} sub={`${fo.won}/${fo.won + fo.lost}`} />
      </div>

      <section className="card stack">
        <h2>{t.report.shotsTitle}</h2>
        <LevelsTable stats={stats} />
      </section>

      <section className="card stack">
        <h2>{t.report.strengthTitle}</h2>
        <StrengthTable stats={stats} />
      </section>

      <section className="card stack">
        <h2>{t.report.goaliesTitle}</h2>
        <GoalieTable lines={goalieLines} label={t.report.goaliesTitle} />
      </section>

      <ExtrasCard stats={stats} events={events} names={names} />

      <section className="card stack">
        <div className="row">
          <h2>{t.report.shotMap}</h2>
          <span className="topbar__spacer" />
          <div className="seg no-print" role="group" aria-label={t.record.periodLabel}>
            {periodFilters.map((p) => (
              <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)}>
                {p === 'all' ? t.report.allPeriods : t.record.period(p)}
              </button>
            ))}
          </div>
          <div className="seg no-print" role="group" aria-label={t.report.shotMap}>
            {SIDE_FILTERS.map((s) => (
              <button key={s} type="button" aria-pressed={side === s} onClick={() => setSide(s)}>
                {sideLabel(s)}
              </button>
            ))}
          </div>
        </div>
        <Rink attackRight leftLabel={game.team_name} rightLabel={game.opponent} markers={filterShotMarkers(events, period, side)} />
        <Legend results={SHOT_RESULTS} />
      </section>

      <section className="card stack">
        <h2>{t.report.faceoffs}</h2>
        <FaceoffTable stats={stats} />
        <h2>{t.report.faceoffMap}</h2>
        <Rink attackRight leftLabel={game.team_name} rightLabel={game.opponent} dotText={dotText} />
      </section>

      {(unassigned > 0 || assigned !== null) && (
        <AssignGoalie
          code={game.code}
          unassigned={unassigned}
          pending={pending}
          goalies={goalies}
          assignedCount={assigned}
          onAssigned={setAssigned}
          onDone={refresh}
        />
      )}
    </main>
  );
}
```
Notes: the v1 tests look up the tiles with `screen.getByText(t.report.ourSave).closest('section')` — keep the tile label text exactly `t.report.ourSave`/`oppSave`/`shooting`. The existing header assertions in v1 tests (`'1 – 1'`, levels row cells) must still pass.

- [ ] **Step 8: Print stylesheet** — append to `src/styles/theme.css`:
```css
@media print {
  @page { size: A4 portrait; margin: 12mm; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { background: #fff; }
  .no-print { display: none !important; }
  .page { max-width: none; padding: 0; gap: 12px; }
  .card { box-shadow: none; border: 1px solid var(--border); break-inside: avoid; }
  .card--glass { backdrop-filter: none; }
  .table-wrap { overflow: visible; }
  .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .rink { max-width: 100%; }
}
```

- [ ] **Step 9: Run tests and type-check**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 10: Commit**
```bash
git add -A
git commit -m "feat: match report with goalie and situation tables, extras, retro-assignment of a goalie, PDF export and richer CSV"
```

---

### Task 8: Season view — competition filter and goalie table

**Files:**
- Modify: `src/screens/SeasonScreen.tsx`
- Test: `src/screens/SeasonScreen.test.tsx` (extend)

**Interfaces:**
- Consumes: `computeSeasonStats(games, events, excluded, competition)`, `CompetitionFilter`, `computeGoalieStats`, `GoalieTable` (with `showGames`), `useGoalies`, `eventsToCsv(events, games, names)`, `t.competitions`, `t.venuesShort`.
- Produces: the season screen defaults to **Championnat**; a segmented filter (Championnat / Coupe de France / Playoffs / Toutes); the goalie table and every total follow the competition filter and the unticked games; the game table gains a competition column and the venue label.

- [ ] **Step 1: Write the failing tests** — append to `src/screens/SeasonScreen.test.tsx` (imports: `fireEvent`, `within`, `screen`, `waitFor` from Testing Library; `gameFx`, `shotEv`, `stateEv` from builders; `makeDeps`, `renderWithSync`; `SeasonScreen`; `t`):
```tsx
describe('season v2', () => {
  function renderMixed() {
    const d = makeDeps({
      games: [
        gameFx({ code: 'AAAA', opponent: 'Rouen', game_date: '2026-09-20' }),
        gameFx({ code: 'BBBB', opponent: 'Caen', competition: 'coupe', game_date: '2026-09-27' }),
      ],
      goalies: [{ id: 'g1', name: 'François Mallet' }, { id: 'g2', name: 'Bernard' }],
    });
    [
      shotEv('shot_against', 'save', { game_code: 'AAAA', goalie_id: 'g1' }),
      shotEv('shot_against', 'goal', { game_code: 'AAAA', goalie_id: 'g1' }),
      shotEv('shot_against', 'save', { game_code: 'BBBB', goalie_id: 'g2' }),
    ].forEach((e) => d.fr.rows.set(e.id, e));
    return renderWithSync(<SeasonScreen />, d.deps);
  }

  it('shows Championnat by default and switches competition', async () => {
    renderMixed();
    const byGame = () => screen.getByRole('table', { name: t.season.byGame });
    await screen.findByRole('table', { name: t.season.byGame });
    expect(within(byGame()).getByText('Rouen')).toBeInTheDocument();
    expect(within(byGame()).queryByText('Caen')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: t.competitions.coupe }));
    expect(await within(byGame()).findByText('Caen')).toBeInTheDocument();
    expect(within(byGame()).queryByText('Rouen')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: t.season.allCompetitions }));
    expect(await within(byGame()).findByText('Rouen')).toBeInTheDocument();
    expect(within(byGame()).getByText('Caen')).toBeInTheDocument();
  });

  it('lists the goalies of the games in view, per competition', async () => {
    renderMixed();
    const goalies = () => screen.getByRole('table', { name: t.season.goalies });
    const row = await within(await screen.findByRole('table', { name: t.season.goalies })).findByRole('row', { name: /François Mallet/ });
    expect(within(row).getAllByRole('cell').map((c) => c.textContent)).toEqual(['1', '2', '1', '1', '50 %', '0']);
    expect(within(goalies()).queryByRole('row', { name: /Bernard/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: t.season.allCompetitions }));
    expect(await within(goalies()).findByRole('row', { name: /Bernard/ })).toBeInTheDocument();
  });

  it('an unticked game leaves the goalie table too', async () => {
    renderMixed();
    await within(await screen.findByRole('table', { name: t.season.goalies })).findByRole('row', { name: /François Mallet/ });
    fireEvent.click(screen.getByRole('checkbox', { name: /Rouen/ }));
    await waitFor(() => expect(screen.queryByRole('table', { name: t.season.goalies })).toBeNull());
  });
});
```
(The last test relies on `GoalieTable` rendering a muted paragraph instead of a table when there are no lines.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/screens/SeasonScreen.test.tsx`
Expected: FAIL (no filter, no goalie table).

- [ ] **Step 3: Edit `src/screens/SeasonScreen.tsx`**
  - Imports: add `useGoalies` (`../goalies/useGoalies`), `computeGoalieStats` (`../stats/goalies`), `GoalieTable` (`./report/GoalieTable`), and change the season import to `import { computeSeasonStats, type CompetitionFilter } from '../stats/season';`.
  - Constants: `const COMPETITION_FILTERS: CompetitionFilter[] = ['championnat', 'coupe', 'playoffs', 'all'];` and `const competitionLabel = (c: CompetitionFilter) => (c === 'all' ? t.season.allCompetitions : t.competitions[c]);`.
  - State/derivations (inside `SeasonScreen`, next to the existing `side` state and `season`/`includedCodes` memos):
```tsx
  const { names } = useGoalies();
  const [competition, setCompetition] = useState<CompetitionFilter>('championnat');
  const season = useMemo(() => (data ? computeSeasonStats(data.games, data.events, excluded, competition) : null), [data, excluded, competition]);
  const includedCodes = useMemo(() => new Set(season?.rows.filter((r) => r.included).map((r) => r.game.code)), [season]);
  const goalieLines = useMemo(
    () => (data ? computeGoalieStats(data.events.filter((e) => includedCodes.has(e.game_code)), names, { unset: t.goalies.unset, unknown: t.goalies.unknown }) : []),
    [data, includedCodes, names],
  );
```
    (replace the existing `season` and `includedCodes` declarations with these).
  - CSV export button: `eventsToCsv(data.events, data.games, names)`.
  - Render the filter right under the header (before the "selection" card), only when `data` is loaded:
```tsx
      {data && (
        <div className="seg" role="group" aria-label={t.season.competitionFilter}>
          {COMPETITION_FILTERS.map((c) => (
            <button key={c} type="button" aria-pressed={competition === c} onClick={() => setCompetition(c)}>
              {competitionLabel(c)}
            </button>
          ))}
        </div>
      )}
```
  - The empty state condition stays `season.rows.length === 0` (it now also covers "no game in this competition").
  - Add the goalie section after the "totals" section:
```tsx
          <section className="card stack">
            <h2>{t.season.goalies}</h2>
            <GoalieTable lines={goalieLines} label={t.season.goalies} showGames />
          </section>
```
  - In the "by game" table: add a `<th>{t.season.competition}</th>` after the venue header, a `<td>{t.competitions[game.competition]}</td>` after the venue cell, and change the venue cell to `t.venuesShort[game.venue]`.

- [ ] **Step 4: Run tests and type-check**

Run: `npx tsc --noEmit && npm test`
Expected: PASS. The v1 season tests keep passing (their games are Championnat).

- [ ] **Step 5: Commit**
```bash
git add -A
git commit -m "feat: season view defaults to Championnat, competition filter and goalie season table"
```

---

### Task 9: Documentation, deployment and live verification

**Files:**
- Modify: `README.md`, `supabase/schema.sql` (header comment only)

This task is run by the controller with the user; it changes production data and needs the user twice. Do the steps in order.

- [ ] **Step 1: Docs.** In `supabase/schema.sql` change the first comment line to `-- Roller Stats schema (v1). A database created from this file needs supabase/migration-v2.sql applied afterwards.` In `README.md` add a "Version 2" section: what it adds (goalies, competitions, Divers tab, PDF), and the deployment order: **1) run `supabase/migration-v2.sql` in the Supabase SQL Editor, 2) `npm run smoke`, 3) merge to `main`** (deploying before the migration breaks recording, because v2 sends the new columns).

- [ ] **Step 2: Full local check.**
Run: `npx tsc --noEmit && npm test && npm run build`
Expected: all green, no warnings in the test output.

- [ ] **Step 3: Commit and push the branch (never `main`), then open a draft PR.**
```bash
git add -A
git commit -m "docs: v2 readme and migration order"
git push -u origin feat/v2
gh pr create --draft --base main --head feat/v2 --title "Roller Stats v2: goalies, empty net, CSC, competitions, Divers tab, PDF" --body "Spec: docs/superpowers/specs/2026-09-25-roller-stats-v2-design.md. Apply supabase/migration-v2.sql BEFORE merging (deploy runs on push to main)."
```

- [ ] **Step 4: USER ACTION — apply the migration.** Ask the user (in French) to open supabase.com → their project → SQL Editor → New query, paste `supabase/migration-v2.sql` (copy it to their Desktop first: `cp supabase/migration-v2.sql /c/Users/volo3/Desktop/roller-stats-migration-v2.sql`), click Run, and answer "fait". The live v1 site keeps working during this. Stop and wait.

- [ ] **Step 5: Live database rules.**
Run: `npm run smoke`
Expected: every line `OK` (the 8 v1 checks + the v2 checks). If a line is `FAIL`, stop: fix `migration-v2.sql` (write a corrective SQL file for the user; do not edit an already-applied migration silently) and re-run. Show the user the printed cleanup SQL at the end (they run it once testing is finished).

- [ ] **Step 6: Two-device live test on the v2 build, before it is online.** Serve the build (`npm run build`, then `npm run preview -- --host 127.0.0.1 --port 4173 --strictPort` in the background) and use the browser tools with two origins (`http://127.0.0.1:4173` and `http://localhost:4173`, separate storage = two devices; the deployed v1 site is not used). Verify, and record what you saw:
  1. Goalies tab: add "Test Gardien A" and "Test Gardien B"; a duplicate (" test gardien a ") is refused; rename works; no delete button.
  2. Create a game: Coupe de France, terrain neutre + "Visiteur", prolongations cochées, starting goalie "Test Gardien A". Device 2 joins by code.
  3. Device 1 banner shows "Gardien : Test Gardien A"; device 2 shows it within ~1 s. Device 2 changes to "Test Gardien B" in Divers: both banners update.
  4. Shots against on each side of the change carry the right goalie (report goalie table: A and B lines, totals right).
  5. "Notre filet désert" then a goal against: excluded from both goalies' save %, present in team shots and the score.
  6. CSC (both directions): score changes, no shot counted, CSC column filled, extras card shows them. Undo of a state change restores the previous banner on both devices.
  7. Supériorité on: shots tagged; the report's Situations table shows them.
  8. Prol.: side question appears once; a shot in Prol. lands on the correct side of the map and adds the Prol. column; shootout attempts show the running count and the "TAB x – y" line in the report.
  9. Penalty shot and a note appear in the extras card. CSV export opens with the new columns.
  10. Retro-assign: on a second scratch game where no goalie was chosen, record 3 shots against + 1 while "Notre filet désert", open the report, attach "Test Gardien A": 3 entries filled, the empty-net one untouched; the button disappears.
  11. PDF: click "Exporter en PDF" and confirm `window.print` was called; check the print CSS by loading the report at print media (`javascript_tool`: `matchMedia('print')` cannot be forced, so instead confirm the `.no-print` elements exist and the `@media print` rules are in the built CSS with a grep of `dist/assets/*.css`).
  Stop the preview server and close the tabs afterwards.

- [ ] **Step 7: USER ACTION — publish.** Tell the user the PR is ready and the migration is applied and tested; ask them to publish with `! git push origin feat/v2:main` (they reserved pushes to `main`). Then: `gh run watch` the deploy, check the site returns 200 and the new build is served (`curl -s https://trophy8726.github.io/roller-stats/ | grep -o 'index-[A-Za-z0-9_-]*\.js'` differs from before), and confirm `gh pr view` shows the PR merged/closed (close it with `gh pr close` if GitHub left it open after the direct push).

- [ ] **Step 8: The user's real match — attach François Mallet.** In the live app (browser tools, https://trophy8726.github.io/roller-stats/): Gardiens tab → add "François Mallet". Ask the user for the code of the match they entered (or find it in "Matchs récents"; do not guess between test games), open its report, use "Attribuer un gardien" → François Mallet, and check the goalie table shows him with the right shots and the unassigned line gone. Tell the user exactly how many entries were filled.

- [ ] **Step 9: Cleanup and report.** Give the user the cleanup SQL for the smoke/E2E data (their test games and the `Test Gardien …`/`SMOKE …` goalies), reminding them anonymous users cannot delete. Update the project memory file, delete the SDD workspace, and finish with `superpowers:finishing-a-development-branch` (the work is already on `main` via the user's push).

