# Roller Stats — Design (v1)

Date: 2026-09-24
Status: awaiting review

## 1. Purpose

A web app for an inline hockey team (semi-pro, 4 skaters + goalie, 2 periods) so that
several people watching a game can record shots and faceoffs on tablets or laptops, with
all their data merged in one place by a shared **match code**. Output is a per-game report
and a season view for the coaching staff.

**Success:** three trackers get through a full game without falling behind the play, and
the coach has one combined report within a minute of the final buzzer.

## 2. Scope

### In v1
- Shots **for** and **against**: rink location + result (`goal`, `save`, `missed`, `blocked`).
- Faceoffs: which of the 5 dots + result (`won`, `lost`).
- Every event tagged with period **P1 / P2**.
- Several devices on the same game via a match code, synced live.
- Per-game report, season view, CSV export.
- UI in **French**, touch-first, tablet landscape (works with a mouse on a laptop).

### Not in v1 (explicitly deferred)
- PP/PK tagging, individual player stats, turnovers, zone entries.
- Overtime / shootout.
- Video sync.
- User accounts or a team password.

## 3. Shot levels and metrics

Each shot is recorded once with one result. The four levels are derived:

| Level (FR label)                      | Results counted                  |
|---------------------------------------|----------------------------------|
| Tentatives de tir (shot attempts)     | goal + save + missed + blocked   |
| Tirs non bloqués (unblocked shots)    | goal + save + missed             |
| Tirs cadrés (shots on goal)           | goal + save                      |
| Buts (goals)                          | goal                             |

Rules: a shot hitting the post is `missed`. A blocked shot's location is the **shooter's
position**.

Derived:
- **Save %** (ours, from shots against): saves ÷ shots on goal against. The opponent goalie's
  save % is the same formula applied to shots for.
- **Shooting %**: goals ÷ shots on goal.
- **Faceoff %**: won ÷ (won + lost), overall, per period, and per zone (offensive / neutral /
  defensive, relative to us).

All metrics are shown per period (P1, P2) and in total. Every figure is computed from the
event list; no totals are stored anywhere.

## 4. Game-day flow

1. **Create a game** (one person): opponent name, date, home/away. Our team name is a
   per-device setting, remembered after first entry and stored on the game. The app shows a
   4-character **match code** (alphabet without ambiguous characters: no `0/O/1/I/L`).
2. **Join** (other devices): type the code → pick a **role**:
   - *Tirs pour* (shots for)
   - *Tirs contre* (shots against)
   - *Engagements* (faceoffs)
   - *Tout* (everything)
3. **Orientation** (every device): "Nous défendons : gauche / droite", as seen from where
   that tracker sits. Each end of the drawn rink is labeled with the name of the team
   defending it.
4. **Recording:**
   - Shot: tap the location on the rink → a result bar appears (*But / Arrêt / Raté / Bloqué*)
     → tap the result → saved. Target: under 3 seconds per event.
   - Faceoff: tap one of the 5 dots → *Gagné / Perdu*.
   - The *Tout* role shows a Pour / Contre / Engagement selector before the tap.
5. **Period switch:** a large P1 / P2 toggle at the top. Switching to P2 shows a
   full-screen warning, "Mi-temps : les équipes ont changé de côté", and the device's
   orientation flips automatically, including the end labels.
6. **Corrections:** an *Annuler* (undo last) button, plus a panel with the last ~10 events
   from this device, each deletable.
7. **Report:** live on any device via the code, during or after the game.

## 5. Rink coordinates

- The rink is drawn as an SVG, 2:1 aspect ratio (IIHF inline ≈ 40 × 20 m), showing goals,
  goal creases, the center line, the center dot and 4 end-zone faceoff dots.
- **Stored coordinates are normalized** so that **our attack always goes right**:
  `x, y ∈ [0, 1]`, where `x = 1` is the opponent's goal end.
- Converting a screen tap: if on this device, in this period, we attack to the right as
  displayed, keep `(x, y)`; otherwise store `(1 − x, 1 − y)`. This is a 180° rotation,
  which is exactly the difference between sitting on one side of the rink and the other,
  or between P1 and P2.
- Faceoff dots are stored as ids in the same normalized frame: `center`, `off_top`,
  `off_bottom`, `def_top`, `def_bottom`. Zone = `off_*` offensive, `center` neutral,
  `def_*` defensive.
- Reports always draw the rink in the normalized frame: shots for on the right half, shots
  against on the left.

## 6. Architecture

- **Frontend:** React + TypeScript + Vite, a single-page app, installable as a PWA so a
  tablet can pin it to the home screen.
- **Backend:** Supabase (Postgres + Realtime), called directly from the browser with the
  publishable key. No custom server.
- **Hosting:** static hosting (Netlify or GitHub Pages), chosen at deploy time.

### Units
| Unit | Responsibility |
|------|----------------|
| `rink/` | SVG rink component, tap → normalized coordinates, dot hit-testing, shot-map rendering |
| `events/` | event types, local store + outbox queue, sync with Supabase (push, subscribe) |
| `stats/` | pure functions: events → metrics per period/zone; game list → season aggregates |
| `screens/` | Accueil (create/join), Saisie (recording), Rapport (game), Saison (season) |
| `i18n/` | French strings in one file |

`stats/` and the coordinate transform are pure, side-effect-free, and unit-tested.

## 7. Data model (Supabase)

```sql
games (
  code        text primary key,       -- 4-char match code
  team_name   text not null,
  opponent    text not null,
  game_date   date not null,
  home        boolean not null,
  created_at  timestamptz default now()
)

events (
  id          uuid primary key,       -- generated on the device
  game_code   text not null references games(code),
  kind        text not null check (kind in ('shot_for','shot_against','faceoff')),
  period      smallint not null check (period in (1,2)),
  x           real,                   -- normalized, null for faceoffs
  y           real,
  dot         text,                   -- faceoff dot id, null for shots
  result      text not null,          -- goal|save|missed|blocked|won|lost
  device_role text not null,
  recorded_at timestamptz not null,   -- device clock
  deleted_at  timestamptz             -- soft delete (undo)
)
```

Deletion is **soft** (`deleted_at` set) so it arrives through Realtime as a filterable
UPDATE, which lets every device see undos live.

### Access rules (Row Level Security)
- Anonymous clients may `select` and `insert` on `games` and `events`.
- On `events`, anonymous clients may `update` only the `deleted_at` column (column-level
  grant). No hard `delete` and no other updates.
- A game's data is reachable only by knowing its code. This is accepted for v1; a team
  password can be added later.

## 8. Sync and offline behavior

- Every tap is written to local storage (IndexedDB) first, marked *pending*, and rendered
  immediately.
- An outbox pushes pending events to Supabase with an **upsert on `id`**, so resending is
  harmless and an event can never be counted twice. On success the event is marked *synced*.
- On failure (no network), the outbox retries with backoff and whenever the browser comes
  back online. A small indicator shows "n en attente" (n pending).
- Each device subscribes to Realtime changes on `events` filtered by `game_code` and merges
  them into its local store by `id`. On (re)connect it also does a full fetch for the game
  to catch anything missed.
- The worst case (everyone records separately with no live connection) is the same path:
  events sync whenever a connection exists, and the report merges them all by code.

## 9. Reports

**Rapport de match:**
- The header gives the teams, date, and score (from goals).
- A table of the 4 shot levels for and against, per period and total.
- Both goalies' save %, and shooting %.
- Faceoff %: total, per period, per zone.
- Shot map: shots colored by result, goals highlighted, filterable by period and for/against.
- Faceoff map: win % shown at each of the 5 dots.
- CSV export of the raw events.

**Saison:**
- A game-by-game table: date, opponent, score, shots on goal for/against, save %, faceoff %.
- Season totals and averages per game for every metric.
- A combined shot map across selected games.
- CSV export of all events.

## 10. Error handling

- Unknown code when joining → "Code inconnu" message, with no crash.
- Supabase unreachable → recording keeps working; pending counter visible; report shows
  local data plus a "données partielles" (partial data) notice until synced.
- Supabase project paused (free plan, 7 days of inactivity) → a clear message telling the
  team to click *Restore* in the Supabase dashboard.
- Device clock skew only affects `recorded_at` ordering in the corrections list; no metric
  depends on it.

## 11. Testing

- **Unit (Vitest):** coordinate transform (all 4 cases of side × period), dot → zone mapping,
  every metric in `stats/` against hand-built event lists, outbox idempotency (same event
  pushed twice → one row).
- **Integration:** against a real Supabase project, two browser tabs on one code: an event
  from tab A appears in tab B, an undo in A disappears in B, and an event made offline in A
  syncs after reconnect.
- **Manual:** one full simulated game on a tablet, checking the <3 s per event target.

## 12. Setup the user provides

- Supabase **Project URL** and **publishable key** (never the secret / service_role key).
- One SQL script (tables, RLS, Realtime publication) to be run in the Supabase SQL editor.
  It will be written during implementation.
