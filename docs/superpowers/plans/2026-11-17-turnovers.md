# Turnovers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record where the team loses and recovers the puck during play (new « Turnover » tab and tablet role), and show those positions on the game and season reports.

**Architecture:** A new event kind `turnover` (results `lost` / `recovered`, rink coordinates like a shot) and a new device role `turnovers`, allowed by a small database migration. The recorder gets a Turnover tab with the same tap-then-result flow as shots. A shared `TurnoverCard` draws the dots on the game report and the season report; the shot maps are narrowed to shots only.

**Tech Stack:** React 19, TypeScript, Vite, Vitest + Testing Library, Supabase Postgres (check constraints), `scripts/smoke.mjs` on staging.

**Spec:** `docs/superpowers/specs/2026-11-17-turnovers-design.md`

## Global Constraints

- Work on branch `feat/turnovers`, created from `feat/v3`. It is merged to `main` only **after** the v3 cut-over, on the user's request, never in the same deploy.
- Never run anything on the production Supabase project (`ibgyycalrtnwtfmlzrwk`). `migration-v3b.sql` is applied on staging by the user (SQL Editor); production only on the user's request after the v3 cut-over.
- Kind `turnover`, results `lost` | `recovered`, role `turnovers`. Coordinates x, y required and normalized (our attack goes right); `dot` null, `goalie_id` null, `penalty_shot` false, `empty_net` false, `strength` stamped as for every event.
- French UI copy (exact): tab and role « Turnover »; results « Perdu » / « Récupéré »; hint « Touchez l'endroit de la perte ou de la récupération »; report card title « Turnovers »; season card title « Turnovers (matchs sélectionnés) ».
- Tab order: Tir pour · Tir contre · Turnover · Engagement · Divers. Role order in setup: Tirs pour · Tirs contre · Turnover · Engagements · Tout.
- Marker for `lost`: the existing orange circle (`#FC8D62`). Marker for `recovered`: green (`#66C2A5`) **triangle**. Colours stay paired with a shape.
- Turnovers never appear on a shot map and never count in a shot, faceoff or goalie stat.
- All strings go in `src/i18n/fr.ts`.

## Review Focus

1. A turnover event must not show on the game or season **shot** map (today `filterShotMarkers` keeps every kind except faceoff) — pinned in Task 2.
2. Double tap on Perdu / Récupéré must record a single event (same `tapRef` guard as shots) — pinned in Task 3.
3. Changing tab with a pending rink tap drops the tap (no turnover recorded under the wrong mode) — pinned in Task 3.
4. A turnover tap in period 2 is stored with the period-2 orientation (ends flip like shots) — pinned in Task 3.
5. A deleted (undone) turnover disappears from the report map and its counts — pinned in Task 2 and Task 4.

---

### Task 1: Database — allow turnovers

**Files:**
- Create: `supabase/migration-v3b.sql`
- Modify: `scripts/smoke.mjs` (after the « member records an event » checks, ~line 88)
- Modify: `README.md` (line 7 schema list; new « Version 3 — turnovers » section after the v3 cut-over section)

**Interfaces:**
- Produces: events accept `kind = 'turnover'`, `result in ('lost','recovered')`, `device_role = 'turnovers'`.

- [ ] **Step 1: Write `supabase/migration-v3b.sql`**

Header comment in the style of `migration-v3a.sql` (where to run it; run once, after migration-v3a; old app versions keep working). Wrapped in `begin; … commit;`. It:
- drops and re-adds `event_shape` with every clause of `migration-v2.sql:53-67` unchanged, plus:

```sql
  or (kind = 'turnover' and result in ('lost','recovered') and dot is null and not penalty_shot and not empty_net
      and x is not null and y is not null and x between 0 and 1 and y between 0 and 1)
```
- drops `events_device_role_check` (the inline check from `schema.sql:21`; the drop fails loudly if the name differs, and the transaction rolls back) and re-adds it under the same name with `device_role in ('shots_for','shots_against','turnovers','faceoffs','all')`.

`events_goalie_rules` needs no change (a turnover has no goalie).

- [ ] **Step 2: Add smoke checks**

Using the existing `row()` helper and client `a` (member of the club):
- `check('member records a turnover', …)` — insert `row({ kind: 'turnover', result: 'recovered', device_role: 'turnovers', x: 0.4, y: 0.3 })`, expect no error.
- `check('turnover without position refused (23514)', …)` — `row({ kind: 'turnover', result: 'lost', x: null, y: null })`, expect `r.error?.code === '23514'`.
- `check('turnover with a shot result refused (23514)', …)` — `row({ kind: 'turnover', result: 'goal' })`, expect `23514`.

- [ ] **Step 3: README**

Line 7: add `then supabase/migration-v3b.sql`. New section « Version 3 — turnovers »: the definition from the spec (one paragraph, in French like the rest of the user-facing text), and the release order: (1) v3 cut-over done, (2) run `migration-v3b.sql` on production, (3) merge `feat/turnovers` to main and push. Note that a tablet still on the old version can show turnovers on its shot map until it reloads.

- [ ] **Step 4: Ask the user to run `migration-v3b.sql` on staging, then run the smoke test**

Run: `node --dns-result-order=ipv4first --network-family-autoselection-attempt-timeout=2000 scripts/smoke.mjs`
Expected: every check passes, including the 3 new ones (92/92).

- [ ] **Step 5: Commit**

```bash
git add supabase/migration-v3b.sql scripts/smoke.mjs README.md
git commit -m "feat(db): turnover events and the turnovers role"
```

---

### Task 2: Domain, markers and filters

**Files:**
- Modify: `src/domain/types.ts`, `src/domain/factory.ts`, `src/i18n/fr.ts`, `src/rink/ResultMarker.tsx`, `src/rink/markers.ts`, `src/rink/Legend.tsx`, `src/screens/record/describe.ts`, `src/test/builders.ts`
- Test: `src/domain/factory.test.ts`, `src/rink/markers.test.ts`, `src/screens/record/describe.test.ts`, `src/rink/Rink.test.tsx` (or a new `src/rink/Legend.test.tsx`)

**Interfaces:**
- Produces:
  - `types.ts`: `Kind` gains `'turnover'`; `export type TurnoverResult = 'lost' | 'recovered'`; `export const TURNOVER_RESULTS: readonly TurnoverResult[] = ['lost', 'recovered']`; `MarkResult = ShotResult | FaceoffResult | 'recovered'`; `Role` gains `'turnovers'`.
  - `factory.ts`: `makeTurnover(ctx: EventContext, p: Point, result: TurnoverResult): GameEvent` (coordinates rounded like `makeShot`).
  - `builders.ts`: `turnoverEv(result: TurnoverResult, opts?: Partial<GameEvent>): GameEvent` (default x 0.5, y 0.5, period 1).
  - `markers.ts`: `export type TurnoverFilter = 'lost' | 'recovered' | 'both'`; `filterTurnoverMarkers(events: GameEvent[], period: PeriodFilter, which: TurnoverFilter): RinkMarker[]`; `filterShotMarkers` keeps only `shot_for` / `shot_against`.
  - `Legend`: optional `counts?: Partial<Record<MarkResult, number>>`; when given, each label reads « Perdu · 12 ».
  - `fr.ts`: `roles.turnovers`, `modes.turnover` = 'Turnover'; `kinds.turnover` = 'Turnover'; `results.recovered` = 'Récupéré'; `record.tapTurnover`; `report.turnovers` = 'Turnovers'; `report.lost` = 'Perdus', `report.recovered` = 'Récupérés' (filter labels); `season.turnovers` = 'Turnovers (matchs sélectionnés)'.

- [ ] **Step 1: Write the failing tests**

`factory.test.ts`:
```ts
it('makeTurnover keeps the rounded position and no goalie', () => {
  const e = makeTurnover({ code: 'AB23', period: 2, role: 'turnovers' }, { x: 0.12345, y: 0.6789 }, 'recovered');
  expect(e).toMatchObject({ kind: 'turnover', result: 'recovered', period: 2, x: 0.123, y: 0.679, dot: null,
    goalie_id: null, empty_net: false, penalty_shot: false, device_role: 'turnovers' });
});
```
`markers.test.ts` (add a live turnover, a deleted turnover and a recovered one to `evs`):
```ts
it('never puts a turnover on the shot map', () =>
  expect(filterShotMarkers(evs, 'all', 'both').every((m) => m.result !== 'recovered')).toBe(true));
it('keeps only live turnovers', () => expect(filterTurnoverMarkers(evs, 'all', 'both')).toHaveLength(2));
it('filters turnovers by result', () => expect(filterTurnoverMarkers(evs, 'all', 'lost').map((m) => m.result)).toEqual(['lost']));
it('filters turnovers by period', () => /* recovered one in period 2 */ expect(filterTurnoverMarkers(evs, 2, 'both').map((m) => m.result)).toEqual(['recovered']));
```
The existing « keeps only live shots » test must still expect 2.

`describe.test.ts`: `describeEvent(turnoverEv('lost', { period: 2 }), new Map())` → `'P2 · Turnover · Perdu'`; recovered → `'P1 · Turnover · Récupéré'`.

Legend test: `render(<Legend results={TURNOVER_RESULTS} counts={{ lost: 12, recovered: 3 }} />)` shows `Perdu · 12` and `Récupéré · 3`; the `recovered` swatch is a `polygon[data-result="recovered"]`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/domain/factory.test.ts src/rink src/screens/record/describe.test.ts`
Expected: FAIL (`makeTurnover` / `filterTurnoverMarkers` / `turnoverEv` not exported).

- [ ] **Step 3: Implement**

Types, factory, builder, i18n keys as in Interfaces. `RESULT_COLOR.recovered = '#66C2A5'`; `ResultMarker` case `'recovered'`: an upward triangle `<polygon data-result="recovered" …>` centred on (cx, cy), roughly the visual size of the blocked square (≈ 10 × size wide), same outline. `describeEvent` needs no new case (default branch). `filterShotMarkers`: replace the `kind !== 'faceoff'` test with `kind === 'shot_for' || kind === 'shot_against'`.

- [ ] **Step 4: Run the whole suite and the type check**

Run: `npx vitest run` then `npm run build`
Expected: all tests pass; build succeeds (the build catches every `Record<MarkResult, …>` / `Record<Role, …>` missing a key).

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat(turnovers): event kind, marker and filters; shot maps keep shots only"
```

---

### Task 3: Recorder — Turnover tab and role

**Files:**
- Modify: `src/screens/record/Recorder.tsx`, `src/screens/record/SetupPanel.tsx`
- Test: `src/screens/record/RecordScreen.test.tsx`

**Interfaces:**
- Consumes: `makeTurnover`, `TURNOVER_RESULTS`, `TurnoverResult`, `t.modes.turnover`, `t.roles.turnovers`, `t.record.tapTurnover` (Task 2).
- Produces: `Mode` gains `'turnover'`; `initialMode('turnovers') === 'turnover'`.

- [ ] **Step 1: Write the failing tests** (in `RecordScreen.test.tsx`, using `renderRecord`, `tapRink`)

```ts
it('records a turnover once, even if Perdu is tapped twice', async () => {
  const d = renderRecord();
  fireEvent.click(await screen.findByRole('button', { name: t.modes.turnover }));
  expect(screen.getByText(t.record.tapTurnover)).toBeInTheDocument();
  await tapRink(100, 50);
  const lost = screen.getByRole('button', { name: t.results.lost });
  act(() => { lost.click(); lost.click(); });
  await waitFor(async () => expect((await d.deps.store.load('AB23')).filter((e) => !e.deleted_at)).toHaveLength(1));
  expect((await d.deps.store.load('AB23'))[0]).toMatchObject({ kind: 'turnover', result: 'lost', x: 0.25, y: 0.25 });
});
it('places the Turnover tab between Tir contre and Engagement', async () => {
  renderRecord();
  const tabs = within(await screen.findByRole('group', { name: t.record.modeLabel })).getAllByRole('button').map((b) => b.textContent);
  expect(tabs).toEqual([t.modes.shot_for, t.modes.shot_against, t.modes.turnover, t.modes.faceoff, t.misc.tab]);
});
it('a Turnover tracker sees only Turnover and Divers, and records Récupéré', async () => {
  renderRecord('turnovers');
  const tabs = within(await screen.findByRole('group', { name: t.record.modeLabel })).getAllByRole('button').map((b) => b.textContent);
  expect(tabs).toEqual([t.modes.turnover, t.misc.tab]);
  await tapRink(300, 100);
  fireEvent.click(screen.getByRole('button', { name: t.results.recovered }));
  expect(await screen.findByText(`P1 · ${t.kinds.turnover} · ${t.results.recovered}`)).toBeInTheDocument();
});
it('drops a pending turnover tap when the tab changes', async () => { /* tap in Turnover, switch to Tir pour: no result buttons, nothing stored */ });
it('stores a period-2 turnover with the flipped orientation', async () => {
  /* setup period 2 (defendP1 'left' → we attack left in P2); tap at x=100 of 400 → stored x 0.75 */
});
```
Setup panel test: the role buttons read, in order, Tirs pour · Tirs contre · Turnover · Engagements · Tout.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/screens/record`
Expected: FAIL (no Turnover button).

- [ ] **Step 3: Implement**

`Recorder.tsx`: `type Mode = ShotKind | 'turnover' | 'faceoff' | 'misc'`; `ALL_MODES` in the order above; `modeLabel` uses `t.modes[m]` for `'turnover'`; `initialMode` maps `'turnovers'` → `'turnover'`. The Turnover tab reuses the shot rink path: rink taps set `tap`, markers are the live turnovers of the current period, the result row is `<ResultButtons results={TURNOVER_RESULTS} onPick={pickTurnover} onCancel={clear} />`, the hint is `t.record.tapTurnover`. `pickTurnover(r: TurnoverResult)` mirrors `pickShot` (reads `tapRef`, clears, records `makeTurnover(ctx, p, r)`). `SetupPanel.tsx`: `ROLES = ['shots_for', 'shots_against', 'turnovers', 'faceoffs', 'all']`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/screens/record` then `npx vitest run`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/screens/record
git commit -m "feat(record): Turnover tab and tablet role"
```

---

### Task 4: Game and season reports

**Files:**
- Create: `src/screens/report/TurnoverCard.tsx`
- Modify: `src/screens/report/ReportScreen.tsx` (after the shot map card, ~line 159), `src/screens/SeasonScreen.tsx` (after the season shot map card, ~line 227)
- Test: `src/screens/report/ReportScreen.test.tsx`, `src/screens/SeasonScreen.test.tsx`

**Interfaces:**
- Consumes: `filterTurnoverMarkers`, `TurnoverFilter`, `PeriodFilter`, `Legend counts`, `TURNOVER_RESULTS`, i18n keys (Task 2).
- Produces: `TurnoverCard({ events, title, leftLabel, rightLabel, periods }: { events: GameEvent[]; title: string; leftLabel: string; rightLabel: string; periods: PeriodFilter[] | null })` — `periods` null hides the period filter (season).

- [ ] **Step 1: Write the failing tests**

`ReportScreen.test.tsx` (with `renderReportWith`):
- with `turnoverEv('lost')`, `turnoverEv('lost', { x: 0.8 })`, `turnoverEv('recovered', { period: 2 })`, `turnoverEv('recovered', { deleted_at: '2026-11-01T20:00:00Z' })` and one `shotEv`: the « Turnovers » card shows `Perdu · 2` and `Récupéré · 1`; its rink has 3 markers; the shot map rink still has 1 marker.
- clicking « Perdus » in the card leaves 2 markers; clicking « P2 » with « Les deux » leaves 1.
- a game with no turnover still shows the card, with `Perdu · 0` and `Récupéré · 0` (the card stays so a printed report always has the section).

`SeasonScreen.test.tsx`: turnovers of an included game show on the « Turnovers (matchs sélectionnés) » map; those of an unticked game do not.

Count markers within the card: `within(screen.getByRole('heading', { name: t.report.turnovers }).closest('section')!)`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/screens/report src/screens/SeasonScreen.test.tsx`
Expected: FAIL (no Turnovers heading).

- [ ] **Step 3: Implement `TurnoverCard`**

A `section.card.stack` laid out like the report's shot map card: heading, then (no-print) a period `seg` when `periods` is non-null and a Perdus / Récupérés / Les deux `seg`; the print-only filter caption when a filter is active (reuse `t.report.mapFilterCaption`); `<Rink attackRight … markers={filterTurnoverMarkers(events, period, which)} />`; `<Legend results={TURNOVER_RESULTS} counts={…} />` where counts are the filtered markers counted by result. Report: `periods = periodFilters`, labels team/opponent. Season: `periods = null`, labels `t.report.us` / `t.report.them`, events = the included games' events (same expression as the season shot map).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run` then `npm run build`
Expected: all pass, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/screens
git commit -m "feat(report): turnover map on the game and season reports"
```

---

### Task 5: Staging acceptance with the user

- [ ] **Step 1:** Start the dev server (`npm run dev`, staging) and give the user this checklist:
  1. Tablet A role « Turnover »: only Turnover and Divers tabs; tap + Perdu / Récupéré record and show in « Dernières saisies ».
  2. Tablet B role « Tout »: the tab sits between Tir contre and Engagement; turnovers from A appear live on its Turnover rink.
  3. In P2, a tap at the same spot of the screen lands at the mirrored place on the report map.
  4. Report: the Turnovers card counts and filters; the shot map shows no turnover; print preview shows the card.
  5. Season: the turnover map follows the ticked games.
- [ ] **Step 2:** Fix what the user reports (one commit per fix), then hand over to superpowers:finishing-a-development-branch — the merge waits for the v3 cut-over.
