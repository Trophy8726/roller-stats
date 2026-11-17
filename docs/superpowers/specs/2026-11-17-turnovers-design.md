# Turnovers — design

## Why

The coach wants to see **where on the rink the team loses the puck and where it wins it back**. Position only: no link to what happened next (shot, goal), no player.

## Definition (agreed with the user)

A turnover is a change of possession **during play**:

- **Perdu**: we had the puck, they take it.
- **Récupéré**: they had the puck, we take it.

Never a turnover, either way: shots and their rebounds, faceoffs, dump-ins (« envoi en fond de zone »), dégagements, stoppages (puck frozen, out of the rink, whistle). The definition is shown nowhere in the app for now; it lives in this doc and the README.

## Goals

- Record a turnover in two taps (rink position, then Perdu / Récupéré), like a shot.
- A volunteer can take the job alone (dedicated role) or with everything else (« Tout »). Recording from a video replay with pauses is a normal use.
- See the dots on the game report and on the season report.

## Non-goals

- Linking a turnover to the next event, players, forced / unforced, time in the game.
- Any change to shot, faceoff or goalie stats.

## Anti-goals

- Turnover dots must never show up on the shot maps or count in any shot stat.

## Approaches considered

- **A. New « Turnover » tab plus a dedicated tablet role** — chosen. Turnovers are frequent (50+ a game); a dedicated volunteer, or someone replaying the video, can keep up.
- B. Same tab, « Tout » only — less work, but leaves turnovers to the volunteer already doing shots: patchy data.
- C. Perdu / Récupéré buttons on the shots rink — no tab switching, but 6 buttons per tap, crowded map, mis-taps in fast play.

## Design

### Data

- New event kind `turnover`, results `lost` | `recovered`. Coordinates x, y required (normalized like shots: our attack goes right), `dot` null, `goalie_id` null, `penalty_shot` false, `empty_net` false. `strength` stamped like every other event.
- New device role `turnovers`.
- Migration `supabase/migration-v3b.sql`: widen `events_kind_check` (from migration-v2) to allow `turnover`; rebuild `event_shape` with the turnover clause; replace the `device_role` check (inline on the column in schema.sql, so Postgres named it `events_device_role_check`) to allow `turnovers`. Applied on staging first, on production only after the v3 cut-over and on the user's request. A unit test (`src/domain/sqlChecks.test.ts`) checks that the migrations allow every kind and role the app sends.

### Recording

- Tabs, in order: **Tir pour · Tir contre · Turnover · Engagement · Divers**. The « Tout » role sees all of them.
- Role list in the setup panel: Tirs pour · Tirs contre · **Turnover** · Engagements · Tout. The Turnover role sees **Turnover · Divers**, like the other single roles.
- In the Turnover tab: tap the rink, then **Perdu** / **Récupéré** / Annuler. The rink shows the turnovers of the current period, as the shot tabs do. Hint text: « Touchez l'endroit de la perte ou de la récupération ».
- Recent list and undo work as for every event (« P1 · Turnover · Perdu », « P2 · Turnover · Récupéré », the same format as every other entry).

### Markers

- `lost`: the existing orange circle (same colour and shape as a lost faceoff).
- `recovered`: a new green marker with its own shape (my call: triangle), since colours are always paired with a shape.

### Game report

- A new « Turnovers » card after the shot map: rink with all turnovers, period filter (Tout / P1 / P2 / Prol.) and a Perdu / Récupéré / Les deux filter, a legend with the count for each result in view (a filtered-out result is left out, never shown as 0).
- The shot map filter (`filterShotMarkers`) is narrowed to `shot_for` / `shot_against` — today it takes every kind except faceoff, so turnovers would leak into it.

### Season report

- The same turnover card under the season shot map, over the included games (my call: the pattern across games is the point of the feature).

### Export

- The CSV already exports every event; turnovers appear with kind `turnover`. Nothing to add.

## Constraints

- Released after the v3 cut-over, never in the same deploy.
- An app on a device that has not updated yet would draw turnovers on its shot maps (old `filterShotMarkers`). The service worker updates on the next launch; acceptable, mentioned in the release notes for the user.
- Staging smoke test gains a check that a turnover can be inserted and an invalid one (no coordinates, wrong result) is refused.

## Left to the builder

- Wording of i18n strings not listed here (`src/i18n/fr.ts`).
- Exact triangle size so it reads like the other markers.
- Test layout, following the existing tests.
