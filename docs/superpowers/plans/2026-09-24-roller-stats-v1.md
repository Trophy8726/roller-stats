# Roller Stats v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (chosen by the user) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. On approval, copy this file into the repo as `docs/superpowers/plans/2026-09-24-roller-stats-v1.md` and commit it as the first step.

## Context

A semi-pro inline hockey player wants a tablet/laptop web app so that about 3 people watching a game can record **shots for/against (location + result)** and **faceoffs (dot + won/lost)** per period. Everyone types the same **match code**, all data merges in Supabase, and the coach gets a live game report and a season view. The design was agreed in brainstorming and written to the spec. This plan turns it into working software.

Decisions made after the spec (they amend it):
- **Visual style:** black / white / greyscale, following the reference dashboard: light grey gradient background, white cards with 24px corners, near-black highlight cards, black pill buttons, Inter font, big bold numbers. Color only comes from **ColorBrewer Set2**, and only for results: Goal `#FC8D62` ★, Save `#66C2A5` ●, Missed `#8DA0CB` ✕, Blocked `#B3B3B3` ■. Faceoffs: Won `#66C2A5`, Lost `#FC8D62`. Every color also has a distinct shape, so the app stays readable for colorblind people.
- **Hosting:** GitHub Pages, public repo `Trophy8726/roller-stats`, deployed by GitHub Actions on push to `main`. The user performs that push to `main` themselves.
- **Access (spec correction):** the season view has to list every game, so anyone with the app URL can read all stats and add or undo events. There are no logins in v1, and the data is low-sensitivity. The upgrade path is Supabase anonymous auth plus a team password.
- **Implementation details:** each event is sent with a plain `insert`, and a `23505` error ("already exists") counts as success. This needs only INSERT permission, where an upsert would also need UPDATE. The CSV uses `;` separators and decimal commas so French Excel opens it correctly.

**Goal:** Ship a French, touch-first PWA where several devices record shots and faceoffs into one Supabase game by match code, with live game and season reports.

**Architecture:** React SPA with hash routing, hosted statically. Each tap goes to IndexedDB first (outbox), then to Supabase `events` via an insert that is safe to repeat. Supabase Realtime pushes other devices' events, which are merged by `id`. All metrics are computed from the event list by pure functions.

**Tech Stack:** Vite, React 19, TypeScript, Vitest + Testing Library + jsdom, @supabase/supabase-js v2, idb-keyval, vite-plugin-pwa, @fontsource-variable/inter, GitHub Actions + Pages.

**Spec:** `docs/superpowers/specs/2026-09-24-roller-stats-design.md` (branch `worktree-design-spec` of `C:\Users\volo3\dev\roller-stats`). Execution happens in a new worktree branched from `worktree-design-spec`.

## Global Constraints

- All UI text is French and comes from `src/i18n/fr.ts`. No hard-coded strings in components.
- Greyscale tokens from `src/styles/theme.css` everywhere. Set2 colors appear **only** in `src/rink/ResultMarker.tsx` (`RESULT_COLOR`) and always with a shape.
- Stored coordinates are normalized: `x, y ∈ [0,1]`, and **our attack always goes to the right** (`x = 1` is the opponent's goal).
- Supabase URL `https://ibgyycalrtnwtfmlzrwk.supabase.co` and publishable key `sb_publishable_1ifZJNFPoei1CZQQr7jcIw_1n_cWr1s` live in `src/config.ts`. Never use or ask for the secret / service_role key.
- Vite `base: '/roller-stats/'`. Hash routes only (`#/`, `#/saisie/CODE`, `#/rapport/CODE`, `#/saison`), so GitHub Pages never returns a 404.
- Touch targets ≥ 44px. Result buttons ≥ 64px high.
- Events are never hard-deleted. Undo sets `deleted_at`.
- Match code alphabet: `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no 0/O/1/I/L), 4 characters.
- Node ≥ 22 (local machine has 24.13). Run all commands from the worktree root.
- Commit after every task with a message ending in `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Double tap on a result button** → exactly one event is recorded (Task 10 test).
2. **Rink tapped, then mode or period changed before a result is picked** → no event is recorded and the result bar disappears (Task 10 test).
3. **Wifi drops and the tablet reloads the page mid-game** → pending events are still on the device and get sent later (Task 6 reload test), and the game still opens from its local cache (Task 9 `useGame` cache test).
4. **Code typed in lowercase or with spaces** (`" k7qx "`) → accepted as `K7QX` (Task 9 test).
5. **Season with more than 1,000 events** (PostgREST returns 1,000 rows per request) → every event is fetched (Task 7 `pageAll` test).

---

## File map

```
roller-stats/
  package.json, tsconfig.json, vite.config.ts, index.html, .gitignore
  public/icon.svg
  supabase/schema.sql                 tables, RLS, grants, realtime (user pastes it once)
  scripts/smoke.mjs                   checks RLS rules against the real Supabase project
  .github/workflows/deploy.yml        GitHub Pages deploy
  src/
    main.tsx, App.tsx, router.ts, config.ts, settings.ts
    i18n/fr.ts                        every UI string
    styles/theme.css                  tokens + component classes
    domain/types.ts                   GameEvent, Game, Role, Period, ...
    domain/factory.ts                 uuid(), makeShot(), makeFaceoff(), toRow()
    rink/coords.ts                    attacksRight(), orient(), endLabels()
    rink/dots.ts                      DOTS, DOT_IDS, dotZone()
    rink/Rink.tsx                     SVG rink, taps, dots, markers
    rink/ResultMarker.tsx             Set2 color + shape per result
    rink/Legend.tsx
    rink/markers.ts                   filterShotMarkers()
    stats/game.ts                     computeGameStats(), faceoffsByDot()
    stats/season.ts                   computeSeasonStats()
    stats/format.ts                   formatPct(), formatNumber(), formatDate()
    stats/csv.ts                      eventsToCsv(), downloadCsv(), slug()
    games/code.ts                     generateCode(), normalizeCode(), isValidCode()
    games/api.ts                      GamesApi, supabaseGames()
    games/useGame.tsx                 useGame(), GameGate
    lib/supabase.ts                   Supabase client
    events/store.ts                   EventStore, mergeRemote(), memoryKV()
    events/idbKV.ts                   IndexedDB KV
    events/outbox.ts                  flushOutbox()
    events/remote.ts                  Remote, supabaseRemote(), pageAll()
    events/SyncContext.tsx            SyncProvider, useSync(), defaultSyncDeps()
    events/useGameEvents.ts           live event list + record/remove
    ui/StatCard.tsx, ui/SyncChip.tsx, ui/ResultButtons.tsx
    screens/Home.tsx
    screens/record/RecordScreen.tsx, SetupPanel.tsx, Recorder.tsx
    screens/report/ReportScreen.tsx, LevelsTable.tsx, FaceoffTable.tsx
    screens/SeasonScreen.tsx
    test/setup.ts, test/builders.ts, test/fakes.tsx
```

---

### Task 1: Project scaffold, theme, French strings, router

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `public/icon.svg`
- Create: `src/main.tsx`, `src/App.tsx`, `src/router.ts`, `src/i18n/fr.ts`, `src/styles/theme.css`, `src/test/setup.ts`
- Test: `src/router.test.ts`

**Interfaces:**
- Produces: `type Route`, `parseRoute(hash: string): Route`, `href(r: Route): string`, `navigate(r: Route): void`, `useRoute(): Route`; `t` (French strings); the CSS classes used by every screen.

- [ ] **Step 1: Write the config files**

`package.json`:
```json
{
  "name": "roller-stats",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "smoke": "node scripts/smoke.mjs"
  }
}
```

Then install (latest versions):
```bash
npm install react react-dom @fontsource-variable/inter
npm install -D vite @vitejs/plugin-react typescript vitest jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom @testing-library/user-event @types/react @types/react-dom @types/node
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "types": ["vitest/globals", "@testing-library/jest-dom", "node"]
  },
  "include": ["src", "vite.config.ts"]
}
```

`vite.config.ts`:
```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/roller-stats/',
  plugins: [react()],
  test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test/setup.ts'] },
});
```

`src/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```

`.gitignore`:
```
node_modules
dist
dev-dist
.DS_Store
```

`index.html`:
```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#1E1E1E" />
    <link rel="icon" href="icon.svg" type="image/svg+xml" />
    <title>Roller Stats</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`public/icon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#1E1E1E"/><rect x="16" y="28" width="32" height="10" fill="#F5F5F5"/><ellipse cx="32" cy="38" rx="16" ry="7" fill="#F5F5F5"/><ellipse cx="32" cy="28" rx="16" ry="7" fill="#B3B3B3"/></svg>
```

- [ ] **Step 2: Write the French strings** — `src/i18n/fr.ts`:
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
  },
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
    period: (p: number) => `P${p}`,
    tapShot: "Touchez l'endroit du tir",
    tapDot: "Touchez le point d'engagement",
    cancel: 'Annuler',
    undoLast: 'Annuler la dernière saisie',
    recent: 'Dernières saisies',
    none: 'Aucune saisie.',
    delete: 'Supprimer',
    halftimeTitle: 'Mi-temps : les équipes ont changé de côté',
    halftimeOk: 'Compris',
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
    partial: 'Données partielles : certaines saisies ne sont pas encore synchronisées.',
  },
  season: {
    title: 'Saison',
    games: 'Matchs',
    totals: 'Totaux de la saison',
    perGame: '/ match',
    byGame: 'Match par match',
    map: 'Carte des tirs (matchs sélectionnés)',
    date: 'Date',
    opponent: 'Adversaire',
    venue: 'Lieu',
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
  errors: {
    loading: 'Chargement…',
    unknownCode: 'Code inconnu. Vérifiez le code du match.',
    badCode: 'Le code fait 4 caractères (lettres et chiffres).',
    server:
      "Serveur injoignable. Vérifiez la connexion. Si l'équipe n'a pas joué depuis plus de 7 jours, le projet Supabase est peut-être en pause : ouvrez supabase.com, choisissez le projet puis « Restore ».",
  },
} as const;
```

- [ ] **Step 3: Write the theme** — `src/styles/theme.css`:
```css
:root {
  --surface: #ffffff;
  --surface-muted: #f4f4f4;
  --surface-glass: rgba(255, 255, 255, 0.55);
  --surface-dark: #1e1e1e;
  --text: #111111;
  --text-muted: #6e6e6e;
  --text-on-dark: #f5f5f5;
  --text-on-dark-muted: #a8a8a8;
  --line: #1a1a1a;
  --line-soft: #9a9a9a;
  --border: #dadada;
  --radius-lg: 24px;
  --radius-md: 16px;
  --radius-sm: 12px;
  --shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 8px 24px rgba(0, 0, 0, 0.06);
  --gap: 16px;
  --font: 'Inter Variable', system-ui, -apple-system, 'Segoe UI', sans-serif;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: var(--font);
  color: var(--text);
  background: linear-gradient(135deg, #f4f4f4 0%, #d9d9d9 100%) fixed;
  -webkit-font-smoothing: antialiased;
}
h1 { font-size: 28px; font-weight: 700; margin: 0; letter-spacing: -0.02em; }
h2 { font-size: 18px; font-weight: 600; margin: 0; }
.page { max-width: 1280px; margin: 0 auto; padding: 16px; display: flex; flex-direction: column; gap: var(--gap); }
.topbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.topbar__spacer { flex: 1; }
.stack { display: flex; flex-direction: column; gap: 12px; }
.row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.grid { display: grid; gap: var(--gap); grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
.card { background: var(--surface); border-radius: var(--radius-lg); padding: 20px; box-shadow: var(--shadow); min-width: 0; }
.card--glass { background: var(--surface-glass); border: 1px solid rgba(255, 255, 255, 0.7); backdrop-filter: blur(12px); }
.card--dark { background: var(--surface-dark); color: var(--text-on-dark); }
.card--dark .muted { color: var(--text-on-dark-muted); }
.muted { color: var(--text-muted); }
.btn {
  appearance: none; border: 1px solid var(--line); background: var(--surface); color: var(--text);
  border-radius: 999px; padding: 10px 18px; font: inherit; font-weight: 500; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; min-height: 44px;
}
.btn:disabled { opacity: 0.4; cursor: default; }
.btn--primary { background: var(--surface-dark); color: var(--text-on-dark); border-color: var(--surface-dark); }
.btn--big { min-height: 64px; font-size: 18px; padding: 12px 24px; border-radius: var(--radius-md); flex: 1; }
.btn--cancel { flex: 0 0 72px; }
.btn--icon { width: 44px; padding: 0; }
.seg { display: inline-flex; background: var(--surface); border-radius: 999px; padding: 4px; gap: 4px; box-shadow: var(--shadow); }
.seg button { border: 0; background: transparent; border-radius: 999px; padding: 10px 18px; font: inherit; font-weight: 600; min-height: 44px; cursor: pointer; color: var(--text-muted); }
.seg button[aria-pressed='true'] { background: var(--surface-dark); color: var(--text-on-dark); }
.chip { display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; padding: 6px 12px; background: var(--surface); font-size: 14px; font-weight: 500; }
.chip--dark { background: var(--surface-dark); color: var(--text-on-dark); letter-spacing: 0.15em; }
.dot-status { width: 8px; height: 8px; border-radius: 50%; background: var(--line-soft); }
.dot-status--ok { background: var(--line); }
.stat-big { font-size: 44px; font-weight: 700; letter-spacing: -0.03em; line-height: 1.1; }
.code-display { font-size: 56px; font-weight: 800; letter-spacing: 0.25em; }
.field { display: flex; flex-direction: column; gap: 6px; font-size: 14px; color: var(--text-muted); }
.input { font: inherit; font-size: 16px; color: var(--text); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px 14px; background: var(--surface); min-height: 44px; }
.input--code { font-size: 32px; font-weight: 700; letter-spacing: 0.3em; text-transform: uppercase; text-align: center; }
.notice { margin: 0; border-radius: var(--radius-md); padding: 12px 16px; background: var(--surface-dark); color: var(--text-on-dark); }
.table-wrap { overflow-x: auto; }
.table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
.table th, .table td { padding: 10px 8px; text-align: right; border-bottom: 1px solid var(--border); white-space: nowrap; }
.table th:first-child, .table td:first-child { text-align: left; }
.table thead th { font-size: 13px; color: var(--text-muted); font-weight: 500; }
.table tbody th { font-weight: 500; }
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.list li { display: flex; align-items: center; gap: 8px; justify-content: space-between; padding: 8px 10px; border-radius: var(--radius-sm); background: var(--surface-muted); }
.rink { display: block; width: 100%; height: auto; aspect-ratio: 2 / 1; touch-action: manipulation; user-select: none; -webkit-user-select: none; }
.rink__label { font-size: 11px; font-weight: 700; fill: #9a9a9a; letter-spacing: 0.08em; text-transform: uppercase; }
.rink__dottext { font-size: 11px; font-weight: 600; fill: #111111; }
.rink__dot--interactive { cursor: pointer; }
.record { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: var(--gap); align-items: start; }
@media (max-width: 900px) { .record { grid-template-columns: minmax(0, 1fr); } }
.actionbar { display: flex; gap: 12px; align-items: stretch; min-height: 64px; flex-wrap: wrap; }
.actionbar__hint { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--text-muted); border: 1.5px dashed var(--line-soft); border-radius: var(--radius-md); }
.overlay { position: fixed; inset: 0; background: rgba(20, 20, 20, 0.94); color: var(--text-on-dark); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px; padding: 24px; z-index: 10; text-align: center; }
.overlay .rink { max-width: 720px; }
.legend { display: flex; gap: 16px; flex-wrap: wrap; font-size: 14px; align-items: center; }
.legend span { display: inline-flex; gap: 6px; align-items: center; }
.checks { display: flex; flex-wrap: wrap; gap: 8px; }
.checks label { display: inline-flex; gap: 6px; align-items: center; padding: 6px 12px; border-radius: 999px; background: var(--surface-muted); min-height: 44px; }
```

- [ ] **Step 4: Write the failing router test** — `src/router.test.ts`:
```ts
import { href, parseRoute, type Route } from './router';

describe('parseRoute', () => {
  it('defaults to home', () => {
    expect(parseRoute('')).toEqual({ name: 'home' });
    expect(parseRoute('#/nimporte')).toEqual({ name: 'home' });
  });
  it('parses record and report routes, uppercasing the code', () => {
    expect(parseRoute('#/saisie/k7qx')).toEqual({ name: 'record', code: 'K7QX' });
    expect(parseRoute('#/rapport/K7QX')).toEqual({ name: 'report', code: 'K7QX' });
  });
  it('parses the season route', () => {
    expect(parseRoute('#/saison')).toEqual({ name: 'season' });
  });
  it('round-trips through href', () => {
    const routes: Route[] = [
      { name: 'home' },
      { name: 'season' },
      { name: 'record', code: 'AB23' },
      { name: 'report', code: 'AB23' },
    ];
    for (const r of routes) expect(parseRoute(href(r))).toEqual(r);
  });
});
```

- [ ] **Step 5: Run it to verify it fails**

Run: `npx vitest run src/router.test.ts`
Expected: FAIL (cannot resolve `./router`).

- [ ] **Step 6: Implement** — `src/router.ts`:
```ts
import { useSyncExternalStore } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'season' }
  | { name: 'record'; code: string }
  | { name: 'report'; code: string };

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'saisie' && parts[1]) return { name: 'record', code: parts[1].toUpperCase() };
  if (parts[0] === 'rapport' && parts[1]) return { name: 'report', code: parts[1].toUpperCase() };
  if (parts[0] === 'saison') return { name: 'season' };
  return { name: 'home' };
}

export function href(r: Route): string {
  switch (r.name) {
    case 'home':
      return '#/';
    case 'season':
      return '#/saison';
    case 'record':
      return `#/saisie/${r.code}`;
    case 'report':
      return `#/rapport/${r.code}`;
  }
}

export function navigate(r: Route): void {
  window.location.hash = href(r);
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return parseRoute(hash);
}
```

`src/App.tsx` (temporary shell, replaced in Task 9):
```tsx
import { t } from './i18n/fr';
import { useRoute } from './router';

export function App() {
  const route = useRoute();
  return (
    <main className="page">
      <h1>{t.appName}</h1>
      <p className="muted">{route.name}</p>
    </main>
  );
}
```

`src/main.tsx`:
```tsx
import '@fontsource-variable/inter';
import './styles/theme.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 7: Run tests and build**

Run: `npm test && npm run build`
Expected: 4 tests PASS. Build writes `dist/`.

- [ ] **Step 8: Commit**
```bash
git add -A
git commit -m "feat: scaffold Vite React app with theme, French strings and hash router"
```

---

### Task 2: Domain types, event factory, rink coordinates, faceoff dots

**Files:**
- Create: `src/domain/types.ts`, `src/domain/factory.ts`, `src/rink/coords.ts`, `src/rink/dots.ts`
- Test: `src/domain/factory.test.ts`, `src/rink/coords.test.ts`, `src/rink/dots.test.ts`

**Interfaces:**
- Produces (used by every later task):
  - types `Period = 1 | 2`, `Side = 'left' | 'right'`, `ShotKind`, `Kind`, `ShotResult`, `FaceoffResult`, `EventResult`, `DotId`, `Zone`, `Role`, `Point`, `GameEvent`, `Game`; consts `SHOT_RESULTS`, `FACEOFF_RESULTS`
  - `uuid(): string`, `makeShot(ctx: EventContext, kind: ShotKind, p: Point, result: ShotResult): GameEvent`, `makeFaceoff(ctx: EventContext, dot: DotId, result: FaceoffResult): GameEvent`, `toRow(e: GameEvent): GameEvent`, `interface EventContext { code: string; period: Period; role: Role; now?: Date; id?: string }`
  - `attacksRight(defendP1: Side, period: Period): boolean`, `orient(p: Point, attackRight: boolean): Point`, `endLabels(us: string, them: string, attackRight: boolean): { left: string; right: string }`
  - `DOTS: Record<DotId, Point>`, `DOT_IDS: DotId[]`, `dotZone(d: DotId): Zone`

- [ ] **Step 1: Write types** — `src/domain/types.ts`:
```ts
export type Period = 1 | 2;
export type Side = 'left' | 'right';
export type ShotKind = 'shot_for' | 'shot_against';
export type Kind = ShotKind | 'faceoff';
export type ShotResult = 'goal' | 'save' | 'missed' | 'blocked';
export type FaceoffResult = 'won' | 'lost';
export type EventResult = ShotResult | FaceoffResult;
export type DotId = 'center' | 'off_top' | 'off_bottom' | 'def_top' | 'def_bottom';
export type Zone = 'off' | 'neutral' | 'def';
export type Role = 'shots_for' | 'shots_against' | 'faceoffs' | 'all';

export const SHOT_RESULTS: readonly ShotResult[] = ['goal', 'save', 'missed', 'blocked'];
export const FACEOFF_RESULTS: readonly FaceoffResult[] = ['won', 'lost'];

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
}

export interface Game {
  code: string;
  team_name: string;
  opponent: string;
  game_date: string; // YYYY-MM-DD
  home: boolean;
  created_at?: string;
}
```

- [ ] **Step 2: Write failing tests**

`src/rink/coords.test.ts`:
```ts
import { attacksRight, endLabels, orient } from './coords';

describe('attacksRight', () => {
  it.each([
    ['left', 1, true],
    ['left', 2, false],
    ['right', 1, false],
    ['right', 2, true],
  ] as const)('defendP1=%s period=%s -> %s', (side, period, expected) => {
    expect(attacksRight(side, period)).toBe(expected);
  });
});

describe('orient', () => {
  it('keeps the point when we attack right', () => {
    expect(orient({ x: 0.9, y: 0.2 }, true)).toEqual({ x: 0.9, y: 0.2 });
  });
  it('rotates 180° when we attack left', () => {
    const r = orient({ x: 0.9, y: 0.2 }, false);
    expect(r.x).toBeCloseTo(0.1);
    expect(r.y).toBeCloseTo(0.8);
  });
  it('is its own inverse', () => {
    const p = { x: 0.37, y: 0.61 };
    const r = orient(orient(p, false), false);
    expect(r.x).toBeCloseTo(p.x);
    expect(r.y).toBeCloseTo(p.y);
  });
  it('stores a shot near the opponent goal near x=1 in both periods', () => {
    // Tracker sees us attacking left in P1 (we defend right): taps near the left goal.
    expect(orient({ x: 0.08, y: 0.5 }, attacksRight('right', 1)).x).toBeCloseTo(0.92);
    // Same tracker in P2 sees us attacking right: taps near the right goal.
    expect(orient({ x: 0.92, y: 0.5 }, attacksRight('right', 2)).x).toBeCloseTo(0.92);
  });
});

describe('endLabels', () => {
  it('puts our name on the end we defend', () => {
    expect(endLabels('Nous', 'Rouen', true)).toEqual({ left: 'Nous', right: 'Rouen' });
    expect(endLabels('Nous', 'Rouen', false)).toEqual({ left: 'Rouen', right: 'Nous' });
  });
});
```

`src/rink/dots.test.ts`:
```ts
import { orient } from './coords';
import { DOTS, DOT_IDS, dotZone } from './dots';

describe('faceoff dots', () => {
  it('has 5 dots', () => expect(DOT_IDS).toHaveLength(5));
  it('maps dots to zones', () => {
    expect(dotZone('center')).toBe('neutral');
    expect(dotZone('off_top')).toBe('off');
    expect(dotZone('off_bottom')).toBe('off');
    expect(dotZone('def_top')).toBe('def');
    expect(dotZone('def_bottom')).toBe('def');
  });
  it('puts offensive dots in the right half (our attack)', () => {
    expect(DOTS.off_top.x).toBeGreaterThan(0.5);
    expect(DOTS.def_top.x).toBeLessThan(0.5);
  });
  it('is symmetric under the 180° rotation, so a rotated rink shows dots at the same places', () => {
    for (const id of DOT_IDS) {
      const r = orient(DOTS[id], false);
      const match = DOT_IDS.some((o) => Math.abs(DOTS[o].x - r.x) < 1e-9 && Math.abs(DOTS[o].y - r.y) < 1e-9);
      expect(match).toBe(true);
    }
  });
});
```

`src/domain/factory.test.ts`:
```ts
import { makeFaceoff, makeShot, toRow, uuid } from './factory';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ctx = { code: 'AB23', period: 2 as const, role: 'all' as const, now: new Date('2026-09-24T18:00:00Z'), id: 'id-1' };

describe('makeShot', () => {
  it('builds a normalized shot event with rounded coordinates', () => {
    expect(makeShot(ctx, 'shot_for', { x: 0.912345, y: 0.5 }, 'goal')).toEqual({
      id: 'id-1', game_code: 'AB23', kind: 'shot_for', period: 2, x: 0.912, y: 0.5, dot: null,
      result: 'goal', device_role: 'all', recorded_at: '2026-09-24T18:00:00.000Z', deleted_at: null,
    });
  });
});

describe('makeFaceoff', () => {
  it('builds a faceoff with a dot and no coordinates', () => {
    expect(makeFaceoff(ctx, 'off_top', 'won')).toMatchObject({ kind: 'faceoff', x: null, y: null, dot: 'off_top', result: 'won' });
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
  it('drops local-only fields', () => {
    const e = { ...makeShot(ctx, 'shot_for', { x: 0.5, y: 0.5 }, 'save'), sync: 'pending', mine: true };
    expect(Object.keys(toRow(e)).sort()).toEqual(
      ['deleted_at', 'device_role', 'dot', 'game_code', 'id', 'kind', 'period', 'recorded_at', 'result', 'x', 'y'].sort(),
    );
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/rink src/domain`
Expected: FAIL (modules not found).

- [ ] **Step 4: Implement**

`src/rink/coords.ts`:
```ts
import type { Period, Point, Side } from '../domain/types';

/** True when, on this device and in this period, our team attacks toward the right of the screen. */
export function attacksRight(defendP1: Side, period: Period): boolean {
  const p1 = defendP1 === 'left';
  return period === 1 ? p1 : !p1;
}

/** Converts screen ↔ normalized (our attack right). A 180° rotation; applying it twice is a no-op. */
export function orient(p: Point, attackRight: boolean): Point {
  return attackRight ? { x: p.x, y: p.y } : { x: 1 - p.x, y: 1 - p.y };
}

/** Team name shown on each end: the team defending that end. */
export function endLabels(us: string, them: string, attackRight: boolean): { left: string; right: string } {
  return attackRight ? { left: us, right: them } : { left: them, right: us };
}
```

`src/rink/dots.ts`:
```ts
import type { DotId, Point, Zone } from '../domain/types';

/** Faceoff dots in the normalized frame (our attack right, y=0 is the top board). */
export const DOTS: Record<DotId, Point> = {
  center: { x: 0.5, y: 0.5 },
  off_top: { x: 0.8, y: 0.27 },
  off_bottom: { x: 0.8, y: 0.73 },
  def_top: { x: 0.2, y: 0.27 },
  def_bottom: { x: 0.2, y: 0.73 },
};

export const DOT_IDS = Object.keys(DOTS) as DotId[];

export function dotZone(d: DotId): Zone {
  if (d === 'center') return 'neutral';
  return d.startsWith('off') ? 'off' : 'def';
}
```

`src/domain/factory.ts`:
```ts
import type { DotId, FaceoffResult, GameEvent, Period, Point, Role, ShotKind, ShotResult } from './types';

export interface EventContext {
  code: string;
  period: Period;
  role: Role;
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

function base(ctx: EventContext) {
  return {
    id: ctx.id ?? uuid(),
    game_code: ctx.code,
    period: ctx.period,
    device_role: ctx.role,
    recorded_at: (ctx.now ?? new Date()).toISOString(),
    deleted_at: null,
  };
}

export function makeShot(ctx: EventContext, kind: ShotKind, p: Point, result: ShotResult): GameEvent {
  const b = base(ctx);
  return { id: b.id, game_code: b.game_code, kind, period: b.period, x: round3(p.x), y: round3(p.y), dot: null, result, device_role: b.device_role, recorded_at: b.recorded_at, deleted_at: null };
}

export function makeFaceoff(ctx: EventContext, dot: DotId, result: FaceoffResult): GameEvent {
  const b = base(ctx);
  return { id: b.id, game_code: b.game_code, kind: 'faceoff', period: b.period, x: null, y: null, dot, result, device_role: b.device_role, recorded_at: b.recorded_at, deleted_at: null };
}

/** Exactly the columns of the `events` table (drops local fields like `sync`, `mine`). */
export function toRow(e: GameEvent): GameEvent {
  return {
    id: e.id, game_code: e.game_code, kind: e.kind, period: e.period, x: e.x, y: e.y, dot: e.dot,
    result: e.result, device_role: e.device_role, recorded_at: e.recorded_at, deleted_at: e.deleted_at,
  };
}
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 6: Commit**
```bash
git add -A
git commit -m "feat: domain types, event factory and normalized rink coordinates"
```

---

### Task 3: Game statistics and French number formatting

**Files:**
- Create: `src/stats/game.ts`, `src/stats/format.ts`, `src/test/builders.ts`
- Test: `src/stats/game.test.ts`, `src/stats/format.test.ts`

**Interfaces:**
- Consumes: `GameEvent`, `dotZone`, `DOT_IDS`
- Produces: `ShotLevels { attempts; unblocked; onGoal; goals }`, `WinLoss { won; lost; pct: number | null }`, `PeriodStats`, `GameStats { p1; p2; total; score: { us; them } }`, `periodStats(events)`, `computeGameStats(events)`, `faceoffsByDot(events): Record<DotId, WinLoss>`, `ratio(n, d)`; `formatPct(v: number | null): string`, `formatNumber(n: number): string`, `formatDate(iso: string): string`; test builders `shotEv`, `faceoffEv`, `gameFx`

- [ ] **Step 1: Write the test builders** — `src/test/builders.ts`:
```ts
import type { DotId, FaceoffResult, Game, GameEvent, ShotKind, ShotResult } from '../domain/types';

let seq = 0;
const at = () => new Date(Date.UTC(2026, 8, 24, 18, 0, ++seq)).toISOString();

export function shotEv(kind: ShotKind, result: ShotResult, opts: Partial<GameEvent> = {}): GameEvent {
  return { id: `e${++seq}`, game_code: 'AB23', kind, period: 1, x: 0.5, y: 0.5, dot: null, result, device_role: 'all', recorded_at: at(), deleted_at: null, ...opts };
}

export function faceoffEv(dot: DotId, result: FaceoffResult, opts: Partial<GameEvent> = {}): GameEvent {
  return { id: `e${++seq}`, game_code: 'AB23', kind: 'faceoff', period: 1, x: null, y: null, dot, result, device_role: 'all', recorded_at: at(), deleted_at: null, ...opts };
}

export function gameFx(opts: Partial<Game> = {}): Game {
  return { code: 'AB23', team_name: 'Nous', opponent: 'Rouen', game_date: '2026-09-24', home: true, ...opts };
}
```

- [ ] **Step 2: Write failing tests**

`src/stats/game.test.ts`:
```ts
import { faceoffEv, shotEv } from '../test/builders';
import { computeGameStats, faceoffsByDot } from './game';

describe('computeGameStats', () => {
  it('counts the four shot levels', () => {
    const s = computeGameStats([
      shotEv('shot_for', 'goal'), shotEv('shot_for', 'save'), shotEv('shot_for', 'save'),
      shotEv('shot_for', 'missed'), shotEv('shot_for', 'blocked'),
    ]);
    expect(s.total.shotsFor).toEqual({ attempts: 5, unblocked: 4, onGoal: 3, goals: 1 });
  });

  it('computes both save percentages, shooting % and the score', () => {
    const s = computeGameStats([
      shotEv('shot_against', 'save'), shotEv('shot_against', 'save'), shotEv('shot_against', 'save'),
      shotEv('shot_against', 'goal'), shotEv('shot_for', 'goal'), shotEv('shot_for', 'save'),
    ]);
    expect(s.total.ourSavePct).toBeCloseTo(0.75);
    expect(s.total.oppSavePct).toBeCloseTo(0.5);
    expect(s.total.shootingPct).toBeCloseTo(0.5);
    expect(s.score).toEqual({ us: 1, them: 1 });
  });

  it('returns null percentages when nothing can be divided', () => {
    const s = computeGameStats([]);
    expect(s.total.ourSavePct).toBeNull();
    expect(s.total.shootingPct).toBeNull();
    expect(s.total.faceoffs.pct).toBeNull();
  });

  it('splits by period', () => {
    const s = computeGameStats([
      shotEv('shot_for', 'goal', { period: 1 }),
      shotEv('shot_for', 'goal', { period: 2 }),
      shotEv('shot_for', 'save', { period: 2 }),
    ]);
    expect(s.p1.shotsFor.goals).toBe(1);
    expect(s.p2.shotsFor.onGoal).toBe(2);
    expect(s.total.shotsFor.onGoal).toBe(3);
  });

  it('ignores soft-deleted events', () => {
    expect(computeGameStats([shotEv('shot_for', 'goal', { deleted_at: '2026-09-24T18:10:00Z' })]).score.us).toBe(0);
  });

  it('computes faceoff % overall and per zone', () => {
    const s = computeGameStats([
      faceoffEv('off_top', 'won'), faceoffEv('off_bottom', 'lost'),
      faceoffEv('center', 'won'), faceoffEv('def_top', 'won'),
    ]);
    expect(s.total.faceoffs).toEqual({ won: 3, lost: 1, pct: 0.75 });
    expect(s.total.faceoffsByZone.off).toEqual({ won: 1, lost: 1, pct: 0.5 });
    expect(s.total.faceoffsByZone.neutral.pct).toBe(1);
    expect(s.total.faceoffsByZone.def.won).toBe(1);
  });
});

describe('faceoffsByDot', () => {
  it('counts per dot, null % for unused dots', () => {
    const d = faceoffsByDot([faceoffEv('center', 'won'), faceoffEv('center', 'lost')]);
    expect(d.center).toEqual({ won: 1, lost: 1, pct: 0.5 });
    expect(d.off_top.pct).toBeNull();
  });
});
```

`src/stats/format.test.ts`:
```ts
import { formatDate, formatNumber, formatPct } from './format';

describe('format', () => {
  it('formats percentages the French way', () => {
    expect(formatPct(0.9167)).toBe('91,7 %');
    expect(formatPct(1)).toBe('100 %');
    expect(formatPct(null)).toBe('—');
  });
  it('formats numbers with a decimal comma', () => {
    expect(formatNumber(2.5)).toBe('2,5');
    expect(formatNumber(3)).toBe('3');
  });
  it('formats ISO dates as dd/mm/yyyy', () => {
    expect(formatDate('2026-09-24')).toBe('24/09/2026');
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/stats`
Expected: FAIL (modules not found).

- [ ] **Step 4: Implement**

`src/stats/game.ts`:
```ts
import type { DotId, FaceoffResult, GameEvent, ShotResult, Zone } from '../domain/types';
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
  ourSavePct: number | null;
  oppSavePct: number | null;
  shootingPct: number | null;
  faceoffs: WinLoss;
  faceoffsByZone: Record<Zone, WinLoss>;
}
export interface GameStats {
  p1: PeriodStats;
  p2: PeriodStats;
  total: PeriodStats;
  score: { us: number; them: number };
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

export function periodStats(events: GameEvent[]): PeriodStats {
  const evs = live(events);
  const shots = (k: GameEvent['kind']) => evs.filter((e) => e.kind === k).map((e) => e.result as ShotResult);
  const f = shotLevels(shots('shot_for'));
  const a = shotLevels(shots('shot_against'));
  const fo = evs.filter((e) => e.kind === 'faceoff' && e.dot !== null);
  const zone = (z: Zone) => winLoss(fo.filter((e) => dotZone(e.dot as DotId) === z).map((e) => e.result as FaceoffResult));
  return {
    shotsFor: f,
    shotsAgainst: a,
    ourSavePct: ratio(a.onGoal - a.goals, a.onGoal),
    oppSavePct: ratio(f.onGoal - f.goals, f.onGoal),
    shootingPct: ratio(f.goals, f.onGoal),
    faceoffs: winLoss(fo.map((e) => e.result as FaceoffResult)),
    faceoffsByZone: { off: zone('off'), neutral: zone('neutral'), def: zone('def') },
  };
}

export function computeGameStats(events: GameEvent[]): GameStats {
  const total = periodStats(events);
  return {
    p1: periodStats(events.filter((e) => e.period === 1)),
    p2: periodStats(events.filter((e) => e.period === 2)),
    total,
    score: { us: total.shotsFor.goals, them: total.shotsAgainst.goals },
  };
}

export function faceoffsByDot(events: GameEvent[]): Record<DotId, WinLoss> {
  const fo = live(events).filter((e) => e.kind === 'faceoff');
  return Object.fromEntries(
    DOT_IDS.map((id) => [id, winLoss(fo.filter((e) => e.dot === id).map((e) => e.result as FaceoffResult))]),
  ) as Record<DotId, WinLoss>;
}
```

`src/stats/format.ts`:
```ts
export function formatPct(v: number | null): string {
  if (v === null) return '—';
  return `${(v * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 6: Commit**
```bash
git add -A
git commit -m "feat: game statistics (4 shot levels, save %, faceoff % by zone) and French formatting"
```

---

### Task 4: Season statistics and CSV export

**Files:**
- Create: `src/stats/season.ts`, `src/stats/csv.ts`
- Test: `src/stats/season.test.ts`, `src/stats/csv.test.ts`

**Interfaces:**
- Consumes: `computeGameStats`, `periodStats`, `ShotLevels`, `PeriodStats`, `GameStats`, `Game`, `GameEvent`
- Produces: `SeasonGameRow { game: Game; stats: GameStats }`, `SeasonStats { games: number; rows: SeasonGameRow[]; total: PeriodStats; avgFor: ShotLevels; avgAgainst: ShotLevels }`, `computeSeasonStats(games, events)`; `eventsToCsv(events, games): string`, `downloadCsv(filename, csv): void`, `slug(s): string`

- [ ] **Step 1: Write failing tests**

`src/stats/season.test.ts`:
```ts
import { gameFx, shotEv } from '../test/builders';
import { computeSeasonStats } from './season';

const a = gameFx({ code: 'AAAA', opponent: 'Rouen', game_date: '2026-09-20' });
const b = gameFx({ code: 'BBBB', opponent: 'Caen', game_date: '2026-09-27' });

describe('computeSeasonStats', () => {
  it('builds one row per game, newest first, each with its own stats', () => {
    const s = computeSeasonStats([a, b], [
      shotEv('shot_for', 'goal', { game_code: 'AAAA' }),
      shotEv('shot_for', 'goal', { game_code: 'AAAA' }),
      shotEv('shot_against', 'goal', { game_code: 'BBBB' }),
    ]);
    expect(s.rows.map((r) => r.game.code)).toEqual(['BBBB', 'AAAA']);
    expect(s.rows[1].stats.score).toEqual({ us: 2, them: 0 });
    expect(s.rows[0].stats.score).toEqual({ us: 0, them: 1 });
  });

  it('totals and averages per game', () => {
    const s = computeSeasonStats([a, b], [
      shotEv('shot_for', 'goal', { game_code: 'AAAA' }),
      shotEv('shot_for', 'goal', { game_code: 'AAAA' }),
    ]);
    expect(s.games).toBe(2);
    expect(s.total.shotsFor.goals).toBe(2);
    expect(s.avgFor.goals).toBe(1);
  });

  it('ignores events of games not in the list', () => {
    const s = computeSeasonStats([a], [shotEv('shot_for', 'goal', { game_code: 'ZZZZ' })]);
    expect(s.total.shotsFor.goals).toBe(0);
  });

  it('handles an empty season', () => {
    const s = computeSeasonStats([], []);
    expect(s.games).toBe(0);
    expect(s.avgFor).toEqual({ attempts: 0, unblocked: 0, onGoal: 0, goals: 0 });
  });
});
```

`src/stats/csv.test.ts`:
```ts
import { gameFx, shotEv } from '../test/builders';
import { eventsToCsv, slug } from './csv';

describe('eventsToCsv', () => {
  const game = gameFx({ code: 'AB23', opponent: 'Rouen;B', game_date: '2026-09-24' });

  it('writes a BOM, a French header and ; separated rows with decimal commas', () => {
    const csv = eventsToCsv([shotEv('shot_for', 'goal', { x: 0.912, y: 0.5 })], [game]);
    const lines = csv.replace('\uFEFF', '').trim().split('\r\n');
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(lines[0]).toBe('match;date;adversaire;type;periode;x;y;point;resultat;role;enregistre_le');
    expect(lines[1]).toMatch(/^AB23;2026-09-24;"Rouen;B";shot_for;1;0,912;0,5;;goal;all;/);
  });

  it('leaves out deleted events', () => {
    const csv = eventsToCsv([shotEv('shot_for', 'goal', { deleted_at: '2026-09-24T19:00:00Z' })], [game]);
    expect(csv.trim().split('\r\n')).toHaveLength(1);
  });
});

describe('slug', () => {
  it('makes file-safe names', () => expect(slug('Évreux HC 2')).toBe('evreux-hc-2'));
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/stats`
Expected: season/csv tests FAIL.

- [ ] **Step 3: Implement**

`src/stats/season.ts`:
```ts
import type { Game, GameEvent } from '../domain/types';
import { computeGameStats, periodStats, type GameStats, type PeriodStats, type ShotLevels } from './game';

export interface SeasonGameRow {
  game: Game;
  stats: GameStats;
}
export interface SeasonStats {
  games: number;
  rows: SeasonGameRow[];
  total: PeriodStats;
  avgFor: ShotLevels;
  avgAgainst: ShotLevels;
}

function average(l: ShotLevels, n: number): ShotLevels {
  if (n === 0) return { attempts: 0, unblocked: 0, onGoal: 0, goals: 0 };
  return { attempts: l.attempts / n, unblocked: l.unblocked / n, onGoal: l.onGoal / n, goals: l.goals / n };
}

export function computeSeasonStats(games: Game[], events: GameEvent[]): SeasonStats {
  const byCode = new Map<string, GameEvent[]>();
  for (const e of events) {
    const list = byCode.get(e.game_code) ?? [];
    list.push(e);
    byCode.set(e.game_code, list);
  }
  const sorted = [...games].sort((x, y) => y.game_date.localeCompare(x.game_date));
  const rows = sorted.map((game) => ({ game, stats: computeGameStats(byCode.get(game.code) ?? []) }));
  const relevant = games.flatMap((g) => byCode.get(g.code) ?? []);
  const total = periodStats(relevant);
  return {
    games: games.length,
    rows,
    total,
    avgFor: average(total.shotsFor, games.length),
    avgAgainst: average(total.shotsAgainst, games.length),
  };
}
```

`src/stats/csv.ts`:
```ts
import type { Game, GameEvent } from '../domain/types';

const HEADER = ['match', 'date', 'adversaire', 'type', 'periode', 'x', 'y', 'point', 'resultat', 'role', 'enregistre_le'];

const num = (n: number | null) => (n === null ? '' : String(n).replace('.', ','));
const esc = (s: string) => (/[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** CSV for French Excel: UTF-8 BOM, `;` separator, decimal comma. Deleted events are excluded. */
export function eventsToCsv(events: GameEvent[], games: Game[]): string {
  const byCode = new Map(games.map((g) => [g.code, g]));
  const rows = events
    .filter((e) => !e.deleted_at)
    .map((e) => {
      const g = byCode.get(e.game_code);
      return [e.game_code, g?.game_date ?? '', g?.opponent ?? '', e.kind, String(e.period), num(e.x), num(e.y), e.dot ?? '', e.result, e.device_role, e.recorded_at]
        .map(esc)
        .join(';');
    });
  return '\uFEFF' + [HEADER.join(';'), ...rows].join('\r\n') + '\r\n';
}

export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 5: Commit**
```bash
git add -A
git commit -m "feat: season statistics and French-Excel CSV export"
```

---

### Task 5: Supabase schema, client, match codes, games API, smoke test

**Files:**
- Create: `supabase/schema.sql`, `src/config.ts`, `src/lib/supabase.ts`, `src/games/code.ts`, `src/games/api.ts`, `scripts/smoke.mjs`
- Test: `src/games/code.test.ts`, `src/games/api.test.ts`

**Interfaces:**
- Consumes: `Game`
- Produces: `generateCode(rand?: () => number): string`, `normalizeCode(s): string`, `isValidCode(s): boolean`, `CODE_ALPHABET`; `interface NewGame { team_name; opponent; game_date; home }`, `interface GamesApi { create(input: NewGame): Promise<Game>; get(code: string): Promise<Game | null>; list(): Promise<Game[]> }`, `supabaseGames(client: SupabaseClient, rand?: () => number): GamesApi`, `class ApiError`; `supabase` client

- [ ] **Step 1: Install**

Run: `npm install @supabase/supabase-js`

- [ ] **Step 2: Write the schema** — `supabase/schema.sql`:
```sql
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
```

- [ ] **Step 3: USER ACTION (pause here and ask the user).** Ask the user to open supabase.com → project → **SQL Editor** → New query, paste the contents of `supabase/schema.sql`, click **Run**, and reply "done". Continue after they confirm.

- [ ] **Step 4: Write the config and client**

`src/config.ts`:
```ts
// Public values: the publishable key is meant to ship in browser code. Never put the secret key here.
export const SUPABASE_URL = 'https://ibgyycalrtnwtfmlzrwk.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_1ifZJNFPoei1CZQQr7jcIw_1n_cWr1s';
```

`src/lib/supabase.ts`:
```ts
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL } from '../config';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
```

- [ ] **Step 5: Write failing tests**

`src/games/code.test.ts`:
```ts
import { CODE_ALPHABET, generateCode, isValidCode, normalizeCode } from './code';

describe('match codes', () => {
  it('has no ambiguous characters', () => {
    for (const c of '01OIL') expect(CODE_ALPHABET).not.toContain(c);
    expect(CODE_ALPHABET).toHaveLength(31);
  });
  it('generates 4 characters from the alphabet', () => {
    for (let i = 0; i < 50; i++) expect(isValidCode(generateCode())).toBe(true);
  });
  it('is deterministic with an injected random source', () => {
    expect(generateCode(() => 0)).toBe('AAAA');
    expect(generateCode(() => 0.5)).toBe('SSSS');
  });
  it('normalizes typed input', () => {
    expect(normalizeCode(' k7 qx ')).toBe('K7QX');
  });
  it('validates', () => {
    expect(isValidCode('K7QX')).toBe(true);
    expect(isValidCode('K7Q')).toBe(false);
    expect(isValidCode('K0QX')).toBe(false);
  });
});
```

`src/games/api.test.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseGames } from './api';

type InsertResult = { error: { code: string; message: string } | null };

function fakeClient(results: InsertResult[]) {
  const inserted: unknown[] = [];
  const client = {
    from: () => ({
      insert: async (row: unknown) => {
        inserted.push(row);
        return results.shift() ?? { error: null };
      },
    }),
  };
  return { client: client as unknown as SupabaseClient, inserted };
}

const input = { team_name: 'Nous', opponent: 'Rouen', game_date: '2026-09-24', home: true };

describe('supabaseGames.create', () => {
  it('retries with a new code when the code already exists', async () => {
    const { client, inserted } = fakeClient([{ error: { code: '23505', message: 'duplicate' } }, { error: null }]);
    const values = [0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5];
    const game = await supabaseGames(client, () => values.shift()!).create(input);
    expect(inserted).toHaveLength(2);
    expect(game).toEqual({ code: 'SSSS', ...input });
  });

  it('throws on any other error', async () => {
    const { client } = fakeClient([{ error: { code: '42501', message: 'denied' } }]);
    await expect(supabaseGames(client).create(input)).rejects.toThrow('denied');
  });
});
```

- [ ] **Step 6: Run to verify failure**

Run: `npx vitest run src/games`
Expected: FAIL (modules not found).

- [ ] **Step 7: Implement**

`src/games/code.ts`:
```ts
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateCode(rand: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < 4; i++) s += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)];
  return s;
}

export function normalizeCode(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase();
}

export function isValidCode(s: string): boolean {
  return /^[A-HJKMNP-Z2-9]{4}$/.test(s);
}
```

`src/games/api.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Game } from '../domain/types';
import { generateCode } from './code';

export interface NewGame {
  team_name: string;
  opponent: string;
  game_date: string;
  home: boolean;
}

export interface GamesApi {
  create(input: NewGame): Promise<Game>;
  get(code: string): Promise<Game | null>;
  list(): Promise<Game[]>;
}

export class ApiError extends Error {}

const COLS = 'code,team_name,opponent,game_date,home,created_at';

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
      return (data as Game | null) ?? null;
    },
    async list() {
      const { data, error } = await client
        .from('games')
        .select(COLS)
        .order('game_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw new ApiError(error.message);
      return (data ?? []) as Game[];
    },
  };
}
```

- [ ] **Step 8: Run unit tests**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 9: Write the smoke script** — `scripts/smoke.mjs`:
```js
// Checks the real Supabase project's rules with the publishable key. Usage: npm run smoke
import { createClient } from '@supabase/supabase-js';

const sb = createClient('https://ibgyycalrtnwtfmlzrwk.supabase.co', 'sb_publishable_1ifZJNFPoei1CZQQr7jcIw_1n_cWr1s', {
  auth: { persistSession: false },
});
const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const code = 'Z' + Array.from({ length: 3 }, () => A[Math.floor(Math.random() * A.length)]).join('');
function check(label, ok, detail = '') {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label} ${detail}`);
  if (!ok) process.exitCode = 1;
}

let r = await sb.from('games').insert({ code, team_name: 'SMOKE', opponent: 'SMOKE', game_date: '2026-01-01', home: true });
check('insert game', !r.error, r.error?.message);

const id = crypto.randomUUID();
const ev = { id, game_code: code, kind: 'shot_for', period: 1, x: 0.9, y: 0.5, dot: null, result: 'goal', device_role: 'all', recorded_at: new Date().toISOString(), deleted_at: null };
r = await sb.from('events').insert(ev);
check('insert event', !r.error, r.error?.message);
r = await sb.from('events').insert(ev);
check('duplicate insert reports 23505', r.error?.code === '23505', r.error?.code);
r = await sb.from('events').insert({ ...ev, id: crypto.randomUUID(), result: 'won' });
check('malformed event rejected', !!r.error, r.error?.code);
r = await sb.from('events').update({ deleted_at: new Date().toISOString() }).eq('id', id);
check('soft delete allowed', !r.error, r.error?.message);
r = await sb.from('events').update({ result: 'save' }).eq('id', id);
check('other updates refused', !!r.error, r.error?.code);
r = await sb.from('events').delete().eq('id', id).select();
check('hard delete refused', !!r.error || (r.data?.length ?? 0) === 0, r.error?.code);
r = await sb.from('events').select('id,deleted_at').eq('id', id).single();
check('row still present and soft-deleted', !!r.data?.deleted_at, JSON.stringify(r.data));

console.log(`\nCleanup — paste in Supabase SQL Editor:\ndelete from events where game_code='${code}'; delete from games where code='${code}';`);
```

- [ ] **Step 10: Run the smoke test against the real project**

Run: `npm run smoke`
Expected: 8 lines starting with `OK`. Show the user the printed cleanup SQL and ask them to run it. If a check FAILs, stop and fix `schema.sql` before continuing. The user can rerun only the changed statements.

- [ ] **Step 11: Commit**
```bash
git add -A
git commit -m "feat: Supabase schema with RLS, match codes, games API and smoke test"
```

---

### Task 6: Local event store and outbox

**Files:**
- Create: `src/events/store.ts`, `src/events/outbox.ts`
- Test: `src/events/store.test.ts`, `src/events/outbox.test.ts`

**Interfaces:**
- Consumes: `GameEvent`, `toRow`
- Produces: `type SyncState = 'pending' | 'synced'`, `interface StoredEvent extends GameEvent { sync: SyncState; mine: boolean }`, `interface KV { get(key: string): Promise<unknown>; set(key: string, value: unknown): Promise<void> }`, `memoryKV(): KV`, `mergeRemote(local: StoredEvent[], remote: GameEvent[]): StoredEvent[]`, class `EventStore` with `load(code)`, `add(e)`, `softDelete(code, id, at)`, `markSynced(code, pushed: { id: string; deleted_at: string | null }[])`, `mergeRemote(code, remote)` (all return `Promise<StoredEvent[]>`); `flushOutbox(store: EventStore, push: (e: GameEvent) => Promise<void>, code: string): Promise<{ pushed: number; failed: boolean; events: StoredEvent[] }>`

- [ ] **Step 1: Write failing tests**

`src/events/store.test.ts`:
```ts
import { shotEv } from '../test/builders';
import { EventStore, memoryKV, mergeRemote, type StoredEvent } from './store';

const stored = (e: ReturnType<typeof shotEv>, extra: Partial<StoredEvent> = {}): StoredEvent => ({ ...e, sync: 'synced', mine: false, ...extra });

describe('EventStore', () => {
  it('adds an event as pending and mine', async () => {
    const s = new EventStore(memoryKV());
    const e = shotEv('shot_for', 'goal');
    expect(await s.add(e)).toEqual([{ ...e, sync: 'pending', mine: true }]);
  });

  it('ignores the same id twice', async () => {
    const s = new EventStore(memoryKV());
    const e = shotEv('shot_for', 'goal');
    await s.add(e);
    expect(await s.add(e)).toHaveLength(1);
  });

  it('keeps pending events across a page reload (new store, same storage)', async () => {
    const kv = memoryKV();
    const e = shotEv('shot_for', 'goal');
    await new EventStore(kv).add(e);
    expect(await new EventStore(kv).load('AB23')).toEqual([expect.objectContaining({ id: e.id, sync: 'pending' })]);
  });

  it('serializes concurrent writes', async () => {
    const s = new EventStore(memoryKV());
    await Promise.all([s.add(shotEv('shot_for', 'goal')), s.add(shotEv('shot_for', 'save')), s.add(shotEv('shot_for', 'missed'))]);
    expect(await s.load('AB23')).toHaveLength(3);
  });

  it('soft delete sets deleted_at and marks the event pending again', async () => {
    const s = new EventStore(memoryKV());
    const e = shotEv('shot_for', 'goal');
    await s.add(e);
    await s.markSynced('AB23', [{ id: e.id, deleted_at: null }]);
    const [after] = await s.softDelete('AB23', e.id, '2026-09-24T19:00:00.000Z');
    expect(after).toMatchObject({ deleted_at: '2026-09-24T19:00:00.000Z', sync: 'pending' });
  });

  it('does not mark synced if the event was deleted while it was being pushed', async () => {
    const s = new EventStore(memoryKV());
    const e = shotEv('shot_for', 'goal');
    await s.add(e);
    await s.softDelete('AB23', e.id, '2026-09-24T19:00:00.000Z');
    const [after] = await s.markSynced('AB23', [{ id: e.id, deleted_at: null }]);
    expect(after.sync).toBe('pending');
  });
});

describe('mergeRemote', () => {
  it('adds events from other devices as synced and not mine', () => {
    const r = shotEv('shot_against', 'save');
    expect(mergeRemote([], [r])).toEqual([{ ...r, sync: 'synced', mine: false }]);
  });
  it('applies a deletion made on another device', () => {
    const e = shotEv('shot_for', 'goal');
    const [m] = mergeRemote([stored(e, { mine: true })], [{ ...e, deleted_at: '2026-09-24T19:00:00Z' }]);
    expect(m).toMatchObject({ deleted_at: '2026-09-24T19:00:00Z', mine: true });
  });
  it('keeps an event that was already deleted before it ever reached this device', () => {
    const r = shotEv('shot_for', 'goal', { deleted_at: '2026-09-24T19:00:00Z' });
    expect(mergeRemote([], [r])[0].deleted_at).toBe('2026-09-24T19:00:00Z');
  });
  it('never un-deletes a local deletion because of an older remote copy', () => {
    const e = shotEv('shot_for', 'goal');
    const [m] = mergeRemote([stored(e, { deleted_at: '2026-09-24T19:00:00Z', sync: 'pending' })], [e]);
    expect(m.deleted_at).toBe('2026-09-24T19:00:00Z');
  });
  it('sorts by time even when timestamp formats differ', () => {
    const early = shotEv('shot_for', 'goal', { recorded_at: '2026-09-24T18:00:00+00:00' });
    const late = shotEv('shot_for', 'save', { recorded_at: '2026-09-24T18:00:05.000Z' });
    expect(mergeRemote([stored(late)], [early]).map((e) => e.id)).toEqual([early.id, late.id]);
  });
});
```

`src/events/outbox.test.ts`:
```ts
import { toRow } from '../domain/factory';
import type { GameEvent } from '../domain/types';
import { shotEv } from '../test/builders';
import { flushOutbox } from './outbox';
import { EventStore, memoryKV } from './store';

function server() {
  const rows = new Map<string, GameEvent>();
  let online = true;
  const push = async (e: GameEvent) => {
    if (!online) throw new Error('offline');
    const r = toRow(e);
    const existing = rows.get(r.id);
    rows.set(r.id, existing ? { ...existing, deleted_at: r.deleted_at ?? existing.deleted_at } : r);
  };
  return { rows, push, setOnline: (v: boolean) => (online = v) };
}

describe('flushOutbox', () => {
  it('pushes pending events and marks them synced', async () => {
    const s = new EventStore(memoryKV());
    const srv = server();
    await s.add(shotEv('shot_for', 'goal'));
    const r = await flushOutbox(s, srv.push, 'AB23');
    expect(r).toMatchObject({ pushed: 1, failed: false });
    expect(r.events[0].sync).toBe('synced');
    expect(srv.rows.size).toBe(1);
  });

  it('keeps events pending while offline and sends them later', async () => {
    const s = new EventStore(memoryKV());
    const srv = server();
    srv.setOnline(false);
    await s.add(shotEv('shot_for', 'goal'));
    expect((await flushOutbox(s, srv.push, 'AB23')).failed).toBe(true);
    expect((await s.load('AB23'))[0].sync).toBe('pending');
    srv.setOnline(true);
    expect((await flushOutbox(s, srv.push, 'AB23')).pushed).toBe(1);
  });

  it('never duplicates when flushed twice concurrently', async () => {
    const s = new EventStore(memoryKV());
    const srv = server();
    await s.add(shotEv('shot_for', 'goal'));
    await Promise.all([flushOutbox(s, srv.push, 'AB23'), flushOutbox(s, srv.push, 'AB23')]);
    expect(srv.rows.size).toBe(1);
  });

  it('sends a deletion made after the event was synced', async () => {
    const s = new EventStore(memoryKV());
    const srv = server();
    const e = shotEv('shot_for', 'goal');
    await s.add(e);
    await flushOutbox(s, srv.push, 'AB23');
    await s.softDelete('AB23', e.id, '2026-09-24T19:00:00.000Z');
    await flushOutbox(s, srv.push, 'AB23');
    expect(srv.rows.get(e.id)?.deleted_at).toBe('2026-09-24T19:00:00.000Z');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/events`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

`src/events/store.ts`:
```ts
import type { GameEvent } from '../domain/types';

export type SyncState = 'pending' | 'synced';
export interface StoredEvent extends GameEvent {
  sync: SyncState;
  /** Recorded on this device (drives the "last entries" list and undo). */
  mine: boolean;
}

export interface KV {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

export function memoryKV(): KV {
  const m = new Map<string, unknown>();
  return {
    get: async (k) => structuredClone(m.get(k)),
    set: async (k, v) => {
      m.set(k, structuredClone(v));
    },
  };
}

const byTime = (a: GameEvent, b: GameEvent) => Date.parse(a.recorded_at) - Date.parse(b.recorded_at);

/** Merge rows from the server into the local list. Deletion is one-way: once deleted, always deleted. */
export function mergeRemote(local: StoredEvent[], remote: GameEvent[]): StoredEvent[] {
  const byId = new Map(local.map((e) => [e.id, e]));
  for (const r of remote) {
    const l = byId.get(r.id);
    if (!l) byId.set(r.id, { ...r, sync: 'synced', mine: false });
    else if (r.deleted_at && !l.deleted_at) byId.set(r.id, { ...l, deleted_at: r.deleted_at });
  }
  return [...byId.values()].sort(byTime);
}

export class EventStore {
  private chain: Promise<unknown> = Promise.resolve();

  constructor(private kv: KV) {}

  private key(code: string) {
    return `events:${code}`;
  }

  async load(code: string): Promise<StoredEvent[]> {
    return ((await this.kv.get(this.key(code))) as StoredEvent[] | undefined) ?? [];
  }

  /** All writes go through one queue so concurrent taps never overwrite each other. */
  private update(code: string, fn: (evs: StoredEvent[]) => StoredEvent[]): Promise<StoredEvent[]> {
    const next = this.chain.then(async () => {
      const evs = fn(await this.load(code));
      await this.kv.set(this.key(code), evs);
      return evs;
    });
    this.chain = next.catch(() => undefined);
    return next;
  }

  add(e: GameEvent): Promise<StoredEvent[]> {
    return this.update(e.game_code, (evs) => (evs.some((x) => x.id === e.id) ? evs : [...evs, { ...e, sync: 'pending', mine: true }]));
  }

  softDelete(code: string, id: string, at: string): Promise<StoredEvent[]> {
    return this.update(code, (evs) => evs.map((e) => (e.id === id && !e.deleted_at ? { ...e, deleted_at: at, sync: 'pending' } : e)));
  }

  markSynced(code: string, pushed: { id: string; deleted_at: string | null }[]): Promise<StoredEvent[]> {
    return this.update(code, (evs) =>
      evs.map((e) => (pushed.some((p) => p.id === e.id && p.deleted_at === e.deleted_at) ? { ...e, sync: 'synced' } : e)),
    );
  }

  mergeRemote(code: string, remote: GameEvent[]): Promise<StoredEvent[]> {
    return this.update(code, (evs) => mergeRemote(evs, remote));
  }
}
```

`src/events/outbox.ts`:
```ts
import type { GameEvent } from '../domain/types';
import type { EventStore, StoredEvent } from './store';

/** Push every pending event in order. Stops at the first failure (usually: no network). Safe to call repeatedly. */
export async function flushOutbox(
  store: EventStore,
  push: (e: GameEvent) => Promise<void>,
  code: string,
): Promise<{ pushed: number; failed: boolean; events: StoredEvent[] }> {
  const pending = (await store.load(code)).filter((e) => e.sync === 'pending');
  let pushed = 0;
  for (const e of pending) {
    try {
      await push(e);
    } catch {
      return { pushed, failed: true, events: await store.load(code) };
    }
    await store.markSynced(code, [{ id: e.id, deleted_at: e.deleted_at }]);
    pushed++;
  }
  return { pushed, failed: false, events: await store.load(code) };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 5: Commit**
```bash
git add -A
git commit -m "feat: local event store with outbox, merge rules and soft delete"
```

---

### Task 7: Supabase remote, sync context, live event hook

**Files:**
- Create: `src/events/remote.ts`, `src/events/idbKV.ts`, `src/events/SyncContext.tsx`, `src/events/useGameEvents.ts`, `src/test/fakes.tsx`
- Modify: `src/main.tsx` (wrap `<App />` in `SyncProvider`)
- Test: `src/events/remote.test.ts`, `src/events/useGameEvents.test.tsx`

**Interfaces:**
- Consumes: `EventStore`, `flushOutbox`, `toRow`, `GamesApi`, `supabaseGames`, `supabase`
- Produces:
  - `interface Remote { push(e: GameEvent): Promise<void>; fetchEvents(code: string): Promise<GameEvent[]>; fetchAllEvents(): Promise<GameEvent[]>; subscribe(code: string, onEvent: (e: GameEvent) => void, onStatus: (connected: boolean) => void): () => void }`
  - `supabaseRemote(client)`, `pageAll(fetchPage)`, `PAGE = 1000`
  - `interface SyncDeps { store: EventStore; remote: Remote; games: GamesApi }`, `SyncProvider({ deps, children })`, `useSync(): SyncDeps`, `defaultSyncDeps(): SyncDeps`
  - `useGameEvents(code): { events: StoredEvent[]; pending: number; connected: boolean; loadError: boolean; record(e: GameEvent): void; remove(id: string): void }`
  - test fakes `fakeRemote()` → `{ remote, rows, setOnline, emit }`, `fakeGames(initial?)` → `{ api, games, setFailing }`, `makeDeps({ games? })` → `{ deps, fr, fg }`, `renderWithSync(ui, deps)`

- [ ] **Step 1: Install**

Run: `npm install idb-keyval`

- [ ] **Step 2: Write the fakes** — `src/test/fakes.tsx` (a `.tsx` file, because it renders JSX):
```tsx
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { toRow } from '../domain/factory';
import type { Game, GameEvent } from '../domain/types';
import type { GamesApi } from '../games/api';
import type { Remote } from '../events/remote';
import { EventStore, memoryKV } from '../events/store';
import { SyncProvider, type SyncDeps } from '../events/SyncContext';

export function fakeRemote() {
  const rows = new Map<string, GameEvent>();
  const listeners = new Set<(e: GameEvent) => void>();
  let online = true;
  const guard = () => {
    if (!online) throw new Error('offline');
  };
  const remote: Remote = {
    async push(e) {
      guard();
      const r = toRow(e);
      const existing = rows.get(r.id);
      rows.set(r.id, existing ? { ...existing, deleted_at: r.deleted_at ?? existing.deleted_at } : r);
    },
    async fetchEvents(code) {
      guard();
      return [...rows.values()].filter((r) => r.game_code === code);
    },
    async fetchAllEvents() {
      guard();
      return [...rows.values()].filter((r) => !r.deleted_at);
    },
    subscribe(code, onEvent, onStatus) {
      const l = (e: GameEvent) => {
        if (e.game_code === code) onEvent(e);
      };
      listeners.add(l);
      onStatus(true);
      return () => listeners.delete(l);
    },
  };
  return {
    remote,
    rows,
    setOnline: (v: boolean) => (online = v),
    emit: (e: GameEvent) => listeners.forEach((l) => l(e)),
  };
}

export function fakeGames(initial: Game[] = []) {
  const games = [...initial];
  let failing = false;
  const guard = () => {
    if (failing) throw new Error('down');
  };
  const api: GamesApi = {
    async create(input) {
      guard();
      const g = { code: 'K7QX', ...input };
      games.push(g);
      return g;
    },
    async get(code) {
      guard();
      return games.find((g) => g.code === code) ?? null;
    },
    async list() {
      guard();
      return [...games];
    },
  };
  return { api, games, setFailing: (v: boolean) => (failing = v) };
}

export function makeDeps(opts: { games?: Game[] } = {}) {
  const fr = fakeRemote();
  const fg = fakeGames(opts.games);
  const deps: SyncDeps = { store: new EventStore(memoryKV()), remote: fr.remote, games: fg.api };
  return { deps, fr, fg };
}

export function renderWithSync(ui: ReactElement, deps: SyncDeps) {
  return render(<SyncProvider deps={deps}>{ui}</SyncProvider>);
}
```

- [ ] **Step 3: Write failing tests**

`src/events/remote.test.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { shotEv } from '../test/builders';
import { PAGE, pageAll, supabaseRemote } from './remote';

describe('pageAll', () => {
  it('fetches every page when there are more than 1000 rows', async () => {
    const all = Array.from({ length: 2500 }, (_, i) => shotEv('shot_for', 'save', { id: `r${i}` }));
    const calls: number[] = [];
    const rows = await pageAll(async (from) => {
      calls.push(from);
      return { data: all.slice(from, from + PAGE), error: null };
    });
    expect(rows).toHaveLength(2500);
    expect(calls).toEqual([0, 1000, 2000]);
  });

  it('throws on error', async () => {
    await expect(pageAll(async () => ({ data: null, error: { message: 'boom' } }))).rejects.toThrow('boom');
  });
});

describe('supabaseRemote.push', () => {
  it('treats "already exists" as success and then sends the deletion', async () => {
    const calls: string[] = [];
    const client = {
      from: () => ({
        insert: async () => {
          calls.push('insert');
          return { error: { code: '23505', message: 'duplicate' } };
        },
        update: (v: unknown) => ({
          eq: async () => {
            calls.push(`update ${JSON.stringify(v)}`);
            return { error: null };
          },
        }),
      }),
    } as unknown as SupabaseClient;
    await supabaseRemote(client).push(shotEv('shot_for', 'goal', { deleted_at: '2026-09-24T19:00:00.000Z' }));
    expect(calls).toEqual(['insert', 'update {"deleted_at":"2026-09-24T19:00:00.000Z"}']);
  });

  it('throws on network errors so the event stays pending', async () => {
    const client = { from: () => ({ insert: async () => ({ error: { code: '', message: 'Failed to fetch' } }) }) } as unknown as SupabaseClient;
    await expect(supabaseRemote(client).push(shotEv('shot_for', 'goal'))).rejects.toThrow('Failed to fetch');
  });
});
```

`src/events/useGameEvents.test.tsx`:
```tsx
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { shotEv } from '../test/builders';
import { makeDeps } from '../test/fakes';
import { SyncProvider } from './SyncContext';
import { useGameEvents } from './useGameEvents';

function setup() {
  const { deps, fr } = makeDeps();
  const wrapper = ({ children }: { children: ReactNode }) => <SyncProvider deps={deps}>{children}</SyncProvider>;
  const hook = renderHook(() => useGameEvents('AB23'), { wrapper });
  return { fr, ...hook };
}

describe('useGameEvents', () => {
  it('records locally, then syncs to the server', async () => {
    const { result, fr } = setup();
    act(() => result.current.record(shotEv('shot_for', 'goal')));
    await waitFor(() => expect(result.current.events).toHaveLength(1));
    await waitFor(() => expect(result.current.pending).toBe(0));
    expect(fr.rows.size).toBe(1);
  });

  it('keeps events pending offline and flushes when the browser is back online', async () => {
    const { result, fr } = setup();
    await waitFor(() => expect(result.current.connected).toBe(true));
    fr.setOnline(false);
    act(() => result.current.record(shotEv('shot_for', 'goal')));
    await waitFor(() => expect(result.current.pending).toBe(1));
    fr.setOnline(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(result.current.pending).toBe(0));
    expect(fr.rows.size).toBe(1);
  });

  it('shows events recorded on other devices', async () => {
    const { result, fr } = setup();
    await waitFor(() => expect(result.current.connected).toBe(true));
    act(() => fr.emit(shotEv('shot_against', 'save')));
    await waitFor(() => expect(result.current.events).toHaveLength(1));
    expect(result.current.events[0].mine).toBe(false);
  });

  it('applies an undo made on another device', async () => {
    const { result, fr } = setup();
    const e = shotEv('shot_for', 'goal');
    act(() => result.current.record(e));
    await waitFor(() => expect(result.current.pending).toBe(0));
    act(() => fr.emit({ ...e, deleted_at: '2026-09-24T19:00:00.000Z' }));
    await waitFor(() => expect(result.current.events[0].deleted_at).toBe('2026-09-24T19:00:00.000Z'));
  });

  it('sends a local undo to the server', async () => {
    const { result, fr } = setup();
    const e = shotEv('shot_for', 'goal');
    act(() => result.current.record(e));
    await waitFor(() => expect(result.current.pending).toBe(0));
    act(() => result.current.remove(e.id));
    await waitFor(() => expect(fr.rows.get(e.id)?.deleted_at).not.toBeNull());
  });
});
```

- [ ] **Step 4: Run to verify failure**

Run: `npx vitest run src/events`
Expected: new tests FAIL (modules not found).

- [ ] **Step 5: Implement**

`src/events/remote.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { toRow } from '../domain/factory';
import type { GameEvent } from '../domain/types';

export interface Remote {
  push(e: GameEvent): Promise<void>;
  fetchEvents(code: string): Promise<GameEvent[]>;
  fetchAllEvents(): Promise<GameEvent[]>;
  subscribe(code: string, onEvent: (e: GameEvent) => void, onStatus: (connected: boolean) => void): () => void;
}

/** PostgREST returns at most 1000 rows per request. */
export const PAGE = 1000;
const COLS = 'id,game_code,kind,period,x,y,dot,result,device_role,recorded_at,deleted_at';

type Page = { data: unknown[] | null; error: { message: string } | null };

export async function pageAll(fetchPage: (from: number) => PromiseLike<Page>): Promise<GameEvent[]> {
  const out: GameEvent[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await fetchPage(from);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as GameEvent[]));
    if (!data || data.length < PAGE) return out;
  }
}

export function supabaseRemote(client: SupabaseClient): Remote {
  return {
    async push(e) {
      const row = toRow(e);
      const ins = await client.from('events').insert(row);
      // 23505 = this id is already on the server (an earlier push succeeded): fine.
      if (ins.error && ins.error.code !== '23505') throw new Error(ins.error.message);
      if (row.deleted_at) {
        const up = await client.from('events').update({ deleted_at: row.deleted_at }).eq('id', row.id);
        if (up.error) throw new Error(up.error.message);
      }
    },
    fetchEvents(code) {
      return pageAll((from) =>
        client.from('events').select(COLS).eq('game_code', code).order('id').range(from, from + PAGE - 1),
      );
    },
    fetchAllEvents() {
      return pageAll((from) =>
        client.from('events').select(COLS).is('deleted_at', null).order('id').range(from, from + PAGE - 1),
      );
    },
    subscribe(code, onEvent, onStatus) {
      const channel = client
        .channel(`events:${code}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `game_code=eq.${code}` }, (payload) => {
          const row = payload.new as Partial<GameEvent>;
          if (row && typeof row.id === 'string') onEvent(row as GameEvent);
        })
        .subscribe((status) => onStatus(status === 'SUBSCRIBED'));
      return () => {
        void client.removeChannel(channel);
      };
    },
  };
}
```

`src/events/idbKV.ts`:
```ts
import { get, set } from 'idb-keyval';
import type { KV } from './store';

export function idbKV(): KV {
  return { get: (k) => get(k), set: (k, v) => set(k, v) };
}
```

`src/events/SyncContext.tsx`:
```tsx
import { createContext, useContext, type ReactNode } from 'react';
import { supabaseGames, type GamesApi } from '../games/api';
import { supabase } from '../lib/supabase';
import { idbKV } from './idbKV';
import { supabaseRemote, type Remote } from './remote';
import { EventStore } from './store';

export interface SyncDeps {
  store: EventStore;
  remote: Remote;
  games: GamesApi;
}

const Ctx = createContext<SyncDeps | null>(null);

export function SyncProvider({ deps, children }: { deps: SyncDeps; children: ReactNode }) {
  return <Ctx.Provider value={deps}>{children}</Ctx.Provider>;
}

export function useSync(): SyncDeps {
  const deps = useContext(Ctx);
  if (!deps) throw new Error('useSync must be used inside SyncProvider');
  return deps;
}

export function defaultSyncDeps(): SyncDeps {
  return { store: new EventStore(idbKV()), remote: supabaseRemote(supabase), games: supabaseGames(supabase) };
}
```

`src/events/useGameEvents.ts`:
```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameEvent } from '../domain/types';
import { flushOutbox } from './outbox';
import type { StoredEvent } from './store';
import { useSync } from './SyncContext';

const RETRY_MS = 5000;

export interface GameEventsState {
  events: StoredEvent[];
  pending: number;
  connected: boolean;
  loadError: boolean;
  record(e: GameEvent): void;
  remove(id: string): void;
}

export function useGameEvents(code: string): GameEventsState {
  const { store, remote } = useSync();
  const [events, setEvents] = useState<StoredEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const flushing = useRef(false);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      const r = await flushOutbox(store, (e) => remote.push(e), code);
      setEvents(r.events);
    } finally {
      flushing.current = false;
    }
  }, [store, remote, code]);

  const refetch = useCallback(async () => {
    try {
      const rows = await remote.fetchEvents(code);
      setEvents(await store.mergeRemote(code, rows));
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [store, remote, code]);

  useEffect(() => {
    let alive = true;
    void store.load(code).then((evs) => {
      if (alive) setEvents(evs);
    });
    void refetch();
    void flush();
    const unsubscribe = remote.subscribe(
      code,
      (e) => {
        void store.mergeRemote(code, [e]).then((evs) => {
          if (alive) setEvents(evs);
        });
      },
      (ok) => {
        setConnected(ok);
        if (ok) {
          void refetch();
          void flush();
        }
      },
    );
    const onOnline = () => {
      void flush();
      void refetch();
    };
    window.addEventListener('online', onOnline);
    const timer = window.setInterval(() => void flush(), RETRY_MS);
    return () => {
      alive = false;
      unsubscribe();
      window.removeEventListener('online', onOnline);
      window.clearInterval(timer);
    };
  }, [code, store, remote, flush, refetch]);

  const record = useCallback(
    (e: GameEvent) => {
      void store.add(e).then((evs) => {
        setEvents(evs);
        void flush();
      });
    },
    [store, flush],
  );

  const remove = useCallback(
    (id: string) => {
      void store.softDelete(code, id, new Date().toISOString()).then((evs) => {
        setEvents(evs);
        void flush();
      });
    },
    [store, code, flush],
  );

  return { events, pending: events.filter((e) => e.sync === 'pending').length, connected, loadError, record, remove };
}
```

`src/main.tsx` (replace):
```tsx
import '@fontsource-variable/inter';
import './styles/theme.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { defaultSyncDeps, SyncProvider } from './events/SyncContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SyncProvider deps={defaultSyncDeps()}>
      <App />
    </SyncProvider>
  </StrictMode>,
);
```

- [ ] **Step 6: Run tests and build**

Run: `npm test && npm run build`
Expected: all PASS, build OK.

- [ ] **Step 7: Commit**
```bash
git add -A
git commit -m "feat: Supabase remote with paging, realtime subscription and live event hook"
```

---

### Task 8: Rink component, result markers, legend

**Files:**
- Create: `src/rink/Rink.tsx`, `src/rink/ResultMarker.tsx`, `src/rink/Legend.tsx`, `src/rink/markers.ts`, `src/ui/ResultButtons.tsx`
- Test: `src/rink/Rink.test.tsx`, `src/rink/markers.test.ts`

**Interfaces:**
- Consumes: `orient`, `DOTS`, `DOT_IDS`, `t`, `GameEvent`
- Produces:
  - `RINK_W = 400`, `RINK_H = 200`, `interface RinkMarker { id: string; x: number; y: number; result: EventResult }`
  - `Rink(props: { attackRight: boolean; leftLabel?: string; rightLabel?: string; markers?: RinkMarker[]; pending?: Point | null; dotMode?: 'plain' | 'interactive'; dotText?: Partial<Record<DotId, string>>; selectedDot?: DotId | null; onTap?: (p: Point) => void; onDotTap?: (d: DotId) => void })`. The svg has `role="group"` and `aria-label={t.rink.label}`. Interactive dots are `role="button"` with `aria-label={t.dots[id]}`.
  - `RESULT_COLOR`, `ResultMarker({ cx, cy, result, size? })` (each marker carries `data-result`), `Legend({ results })`
  - `type PeriodFilter = 'all' | 1 | 2`, `type SideFilter = 'for' | 'against' | 'both'`, `filterShotMarkers(events, period, side): RinkMarker[]`
  - `ResultButtons({ results, onPick, onCancel })`

- [ ] **Step 1: Write failing tests**

`src/rink/markers.test.ts`:
```ts
import { faceoffEv, shotEv } from '../test/builders';
import { filterShotMarkers } from './markers';

describe('filterShotMarkers', () => {
  const evs = [
    shotEv('shot_for', 'goal', { period: 1 }),
    shotEv('shot_against', 'save', { period: 2 }),
    shotEv('shot_for', 'missed', { period: 2, deleted_at: '2026-09-24T19:00:00Z' }),
    faceoffEv('center', 'won'),
  ];
  it('keeps only live shots', () => expect(filterShotMarkers(evs, 'all', 'both')).toHaveLength(2));
  it('filters by period', () => expect(filterShotMarkers(evs, 2, 'both').map((m) => m.result)).toEqual(['save']));
  it('filters by side', () => expect(filterShotMarkers(evs, 'all', 'for').map((m) => m.result)).toEqual(['goal']));
});
```

`src/rink/Rink.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { t } from '../i18n/fr';
import { Rink } from './Rink';

function mockRect(el: Element) {
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 200, right: 400, bottom: 200, x: 0, y: 0, toJSON() {} }) as DOMRect;
}

describe('Rink', () => {
  it('reports a normalized tap when we attack right', () => {
    const onTap = vi.fn();
    render(<Rink attackRight onTap={onTap} />);
    const svg = screen.getByRole('group', { name: t.rink.label });
    mockRect(svg);
    fireEvent.click(svg, { clientX: 360, clientY: 50 });
    expect(onTap).toHaveBeenCalledWith({ x: 0.9, y: 0.25 });
  });

  it('rotates the tap when we attack left', () => {
    const onTap = vi.fn();
    render(<Rink attackRight={false} onTap={onTap} />);
    const svg = screen.getByRole('group', { name: t.rink.label });
    mockRect(svg);
    fireEvent.click(svg, { clientX: 360, clientY: 50 });
    const p = onTap.mock.calls[0][0];
    expect(p.x).toBeCloseTo(0.1);
    expect(p.y).toBeCloseTo(0.75);
  });

  it('reports dot taps with the normalized dot id and does not also report a rink tap', () => {
    const onDotTap = vi.fn();
    const onTap = vi.fn();
    render(<Rink attackRight={false} dotMode="interactive" onDotTap={onDotTap} onTap={onTap} />);
    fireEvent.click(screen.getByRole('button', { name: t.dots.off_top }));
    expect(onDotTap).toHaveBeenCalledWith('off_top');
    expect(onTap).not.toHaveBeenCalled();
  });

  it('shows the team defending each end', () => {
    render(<Rink attackRight leftLabel="Nous" rightLabel="Rouen" />);
    expect(screen.getByText('Nous')).toBeInTheDocument();
    expect(screen.getByText('Rouen')).toBeInTheDocument();
  });

  it('draws one shaped marker per event', () => {
    const { container } = render(
      <Rink attackRight markers={[{ id: 'a', x: 0.9, y: 0.5, result: 'goal' }, { id: 'b', x: 0.8, y: 0.4, result: 'blocked' }]} />,
    );
    expect(container.querySelectorAll('[data-result="goal"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-result="blocked"]')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/rink`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

`src/rink/ResultMarker.tsx`:
```tsx
import type { EventResult } from '../domain/types';

/** ColorBrewer Set2. The only place colors are allowed; always paired with a shape. */
export const RESULT_COLOR: Record<EventResult, string> = {
  goal: '#FC8D62',
  save: '#66C2A5',
  missed: '#8DA0CB',
  blocked: '#B3B3B3',
  won: '#66C2A5',
  lost: '#FC8D62',
};
const OUTLINE = '#1A1A1A';

export function starPoints(cx: number, cy: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

const xPath = (cx: number, cy: number, d: number) => `M${cx - d} ${cy - d} L${cx + d} ${cy + d} M${cx + d} ${cy - d} L${cx - d} ${cy + d}`;

export function ResultMarker({ cx, cy, result, size = 1 }: { cx: number; cy: number; result: EventResult; size?: number }) {
  const c = RESULT_COLOR[result];
  switch (result) {
    case 'goal':
      return <polygon data-result="goal" points={starPoints(cx, cy, 8 * size, 3.6 * size)} fill={c} stroke={OUTLINE} strokeWidth={1} />;
    case 'missed':
      return (
        <g data-result="missed">
          <path d={xPath(cx, cy, 4.5 * size)} stroke={OUTLINE} strokeWidth={4.5} strokeLinecap="round" />
          <path d={xPath(cx, cy, 4.5 * size)} stroke={c} strokeWidth={2.5} strokeLinecap="round" />
        </g>
      );
    case 'blocked':
      return <rect data-result="blocked" x={cx - 4.5 * size} y={cy - 4.5 * size} width={9 * size} height={9 * size} fill={c} stroke={OUTLINE} strokeWidth={1} />;
    default:
      return <circle data-result={result} cx={cx} cy={cy} r={5 * size} fill={c} stroke={OUTLINE} strokeWidth={1} />;
  }
}
```

`src/rink/Legend.tsx`:
```tsx
import type { EventResult } from '../domain/types';
import { t } from '../i18n/fr';
import { ResultMarker } from './ResultMarker';

export function Legend({ results }: { results: readonly EventResult[] }) {
  return (
    <div className="legend">
      {results.map((r) => (
        <span key={r}>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <ResultMarker cx={10} cy={10} result={r} />
          </svg>
          {t.results[r]}
        </span>
      ))}
    </div>
  );
}
```

`src/rink/markers.ts`:
```ts
import type { GameEvent } from '../domain/types';
import type { RinkMarker } from './Rink';

export type PeriodFilter = 'all' | 1 | 2;
export type SideFilter = 'for' | 'against' | 'both';

export function filterShotMarkers(events: GameEvent[], period: PeriodFilter, side: SideFilter): RinkMarker[] {
  return events
    .filter(
      (e) =>
        !e.deleted_at &&
        e.kind !== 'faceoff' &&
        e.x !== null &&
        e.y !== null &&
        (period === 'all' || e.period === period) &&
        (side === 'both' || (side === 'for' ? e.kind === 'shot_for' : e.kind === 'shot_against')),
    )
    .map((e) => ({ id: e.id, x: e.x as number, y: e.y as number, result: e.result }));
}
```

`src/rink/Rink.tsx`:
```tsx
import type { KeyboardEvent, MouseEvent } from 'react';
import type { DotId, EventResult, Point } from '../domain/types';
import { t } from '../i18n/fr';
import { orient } from './coords';
import { DOTS, DOT_IDS } from './dots';
import { ResultMarker } from './ResultMarker';

export const RINK_W = 400;
export const RINK_H = 200;

export interface RinkMarker {
  id: string;
  x: number;
  y: number;
  result: EventResult;
}

export interface RinkProps {
  attackRight: boolean;
  leftLabel?: string;
  rightLabel?: string;
  markers?: RinkMarker[];
  pending?: Point | null;
  dotMode?: 'plain' | 'interactive';
  dotText?: Partial<Record<DotId, string>>;
  selectedDot?: DotId | null;
  onTap?: (p: Point) => void;
  onDotTap?: (d: DotId) => void;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function RinkLines() {
  return (
    <g>
      <rect x={1} y={1} width={398} height={198} rx={40} fill="#FFFFFF" stroke="#1A1A1A" strokeWidth={2} />
      <line x1={200} y1={1} x2={200} y2={199} stroke="#1A1A1A" strokeWidth={1.5} />
      <circle cx={200} cy={100} r={30} fill="none" stroke="#9A9A9A" strokeWidth={1} />
      <line x1={35} y1={12} x2={35} y2={188} stroke="#9A9A9A" strokeWidth={1} />
      <line x1={365} y1={12} x2={365} y2={188} stroke="#9A9A9A" strokeWidth={1} />
      <path d="M35 82 A18 18 0 0 1 35 118 Z" fill="#EDEDED" stroke="#9A9A9A" strokeWidth={1} />
      <path d="M365 82 A18 18 0 0 0 365 118 Z" fill="#EDEDED" stroke="#9A9A9A" strokeWidth={1} />
      <rect x={25} y={91.5} width={10} height={17} fill="none" stroke="#1A1A1A" strokeWidth={1.5} />
      <rect x={365} y={91.5} width={10} height={17} fill="none" stroke="#1A1A1A" strokeWidth={1.5} />
    </g>
  );
}

export function Rink({ attackRight, leftLabel, rightLabel, markers = [], pending = null, dotMode = 'plain', dotText, selectedDot = null, onTap, onDotTap }: RinkProps) {
  const toSvg = (p: Point) => {
    const s = orient(p, attackRight);
    return { x: s.x * RINK_W, y: s.y * RINK_H };
  };

  function handleClick(e: MouseEvent<SVGSVGElement>) {
    if (!onTap) return;
    const r = e.currentTarget.getBoundingClientRect();
    onTap(orient({ x: clamp01((e.clientX - r.left) / r.width), y: clamp01((e.clientY - r.top) / r.height) }, attackRight));
  }

  const interactive = dotMode === 'interactive';
  const p = pending ? toSvg(pending) : null;

  return (
    <svg className="rink" viewBox={`0 0 ${RINK_W} ${RINK_H}`} role="group" aria-label={t.rink.label} onClick={handleClick}>
      <RinkLines />
      {leftLabel && (
        <text x={100} y={190} textAnchor="middle" className="rink__label">
          {leftLabel}
        </text>
      )}
      {rightLabel && (
        <text x={300} y={190} textAnchor="middle" className="rink__label">
          {rightLabel}
        </text>
      )}
      {DOT_IDS.map((id) => {
        const c = toSvg(DOTS[id]);
        const handlers = interactive
          ? {
              role: 'button',
              'aria-label': t.dots[id],
              tabIndex: 0,
              onClick: (ev: MouseEvent) => {
                ev.stopPropagation();
                onDotTap?.(id);
              },
              onKeyDown: (ev: KeyboardEvent) => {
                if (ev.key === 'Enter' || ev.key === ' ') onDotTap?.(id);
              },
            }
          : {};
        return (
          <g key={id} className={interactive ? 'rink__dot rink__dot--interactive' : 'rink__dot'} {...handlers}>
            <circle cx={c.x} cy={c.y} r={22} fill="none" stroke="#CFCFCF" strokeWidth={1} />
            {interactive && <circle cx={c.x} cy={c.y} r={20} fill={selectedDot === id ? 'rgba(30,30,30,0.15)' : 'transparent'} />}
            <circle cx={c.x} cy={c.y} r={interactive ? 6 : 3.5} fill="#1A1A1A" />
            {dotText?.[id] && (
              <text x={c.x} y={c.y - 27} textAnchor="middle" className="rink__dottext">
                {dotText[id]}
              </text>
            )}
          </g>
        );
      })}
      {markers.map((m) => {
        const c = toSvg(m);
        return <ResultMarker key={m.id} cx={c.x} cy={c.y} result={m.result} />;
      })}
      {p && <circle cx={p.x} cy={p.y} r={9} fill="none" stroke="#1A1A1A" strokeWidth={2} strokeDasharray="3 2" data-testid="pending-tap" />}
    </svg>
  );
}
```

`src/ui/ResultButtons.tsx`:
```tsx
import type { EventResult } from '../domain/types';
import { t } from '../i18n/fr';
import { ResultMarker } from '../rink/ResultMarker';

export function ResultButtons<R extends EventResult>({ results, onPick, onCancel }: { results: readonly R[]; onPick: (r: R) => void; onCancel: () => void }) {
  return (
    <div className="actionbar">
      {results.map((r) => (
        <button key={r} type="button" className="btn btn--big" onClick={() => onPick(r)}>
          <svg width="24" height="24" viewBox="0 0 20 20" aria-hidden="true">
            <ResultMarker cx={10} cy={10} result={r} />
          </svg>
          {t.results[r]}
        </button>
      ))}
      <button type="button" className="btn btn--big btn--cancel" onClick={onCancel} aria-label={t.record.cancel}>
        ✕
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 5: Commit**
```bash
git add -A
git commit -m "feat: SVG rink with orientation-aware taps, faceoff dots and Set2 result markers"
```

---

### Task 9: Device settings, game loading, home screen

**Files:**
- Create: `src/settings.ts`, `src/games/useGame.tsx`, `src/ui/StatCard.tsx`, `src/ui/SyncChip.tsx`, `src/screens/Home.tsx`
- Modify: `src/App.tsx`
- Test: `src/settings.test.ts`, `src/games/useGame.test.tsx`, `src/screens/Home.test.tsx`

**Interfaces:**
- Consumes: `useSync`, `GamesApi`, `normalizeCode`, `isValidCode`, `href`, `navigate`, `formatDate`, `t`
- Produces:
  - `interface RecordSetup { role: Role; defendP1: Side; period: Period }`, `loadTeamName()`, `saveTeamName(n)`, `loadSetup(code): RecordSetup | null`, `saveSetup(code, s: RecordSetup | null)`, `loadCachedGame(code): Game | null`, `saveCachedGame(g)`, `todayIso(): string`
  - `type GameState`, `useGame(code): GameState`, `GameGate({ code, children: (g: Game) => ReactNode })`
  - `StatCard({ label, value, sub? })`, `SyncChip({ pending, connected })`, `Home()`

- [ ] **Step 1: Write failing tests**

`src/settings.test.ts`:
```ts
import { gameFx } from './test/builders';
import { loadCachedGame, loadSetup, loadTeamName, saveCachedGame, saveSetup, saveTeamName, todayIso } from './settings';

describe('settings', () => {
  beforeEach(() => localStorage.clear());
  it('remembers the team name', () => {
    expect(loadTeamName()).toBe('');
    saveTeamName('Nous');
    expect(loadTeamName()).toBe('Nous');
  });
  it('stores the setup per game and can clear it', () => {
    saveSetup('AB23', { role: 'all', defendP1: 'left', period: 2 });
    expect(loadSetup('AB23')).toEqual({ role: 'all', defendP1: 'left', period: 2 });
    expect(loadSetup('ZZZZ')).toBeNull();
    saveSetup('AB23', null);
    expect(loadSetup('AB23')).toBeNull();
  });
  it('survives corrupted storage', () => {
    localStorage.setItem('setup:AB23', '{oops');
    expect(loadSetup('AB23')).toBeNull();
  });
  it('caches games for offline reloads', () => {
    saveCachedGame(gameFx());
    expect(loadCachedGame('AB23')).toEqual(gameFx());
  });
  it('gives today as YYYY-MM-DD', () => expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/));
});
```

`src/games/useGame.test.tsx`:
```tsx
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SyncProvider } from '../events/SyncContext';
import { saveCachedGame } from '../settings';
import { gameFx } from '../test/builders';
import { makeDeps } from '../test/fakes';
import { useGame } from './useGame';

function run(code: string, setupDeps: (d: ReturnType<typeof makeDeps>) => void = () => {}) {
  const d = makeDeps({ games: [gameFx()] });
  setupDeps(d);
  const wrapper = ({ children }: { children: ReactNode }) => <SyncProvider deps={d.deps}>{children}</SyncProvider>;
  return renderHook(() => useGame(code), { wrapper });
}

describe('useGame', () => {
  beforeEach(() => localStorage.clear());
  it('loads a known game', async () => {
    const { result } = run('AB23');
    await waitFor(() => expect(result.current).toEqual({ status: 'ok', game: gameFx() }));
  });
  it('reports an unknown code', async () => {
    const { result } = run('ZZZZ');
    await waitFor(() => expect(result.current.status).toBe('missing'));
  });
  it('reports a server error when nothing is cached', async () => {
    const { result } = run('AB23', (d) => d.fg.setFailing(true));
    await waitFor(() => expect(result.current.status).toBe('error'));
  });
  it('falls back to the cached game when offline (tablet reloaded mid-game)', async () => {
    saveCachedGame(gameFx());
    const { result } = run('AB23', (d) => d.fg.setFailing(true));
    await waitFor(() => expect(result.current).toEqual({ status: 'ok', game: gameFx() }));
  });
});
```

`src/screens/Home.test.tsx`:
```tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { t } from '../i18n/fr';
import { gameFx } from '../test/builders';
import { makeDeps, renderWithSync } from '../test/fakes';
import { Home } from './Home';

function renderHome(games = [gameFx({ code: 'K7QX' })]) {
  const d = makeDeps({ games });
  renderWithSync(<Home />, d.deps);
  return d;
}

describe('Home', () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '';
  });

  it('joins an existing game with a lowercase, spaced code', async () => {
    renderHome();
    await userEvent.type(screen.getByLabelText(t.home.codeLabel), ' k7qx ');
    await userEvent.click(screen.getByRole('button', { name: t.home.joinButton }));
    await waitFor(() => expect(window.location.hash).toBe('#/saisie/K7QX'));
  });

  it('shows an error for an unknown code', async () => {
    renderHome([]);
    await userEvent.type(screen.getByLabelText(t.home.codeLabel), 'ZZZZ');
    await userEvent.click(screen.getByRole('button', { name: t.home.joinButton }));
    expect(await screen.findByText(t.errors.unknownCode)).toBeInTheDocument();
  });

  it('rejects malformed codes', async () => {
    renderHome();
    await userEvent.type(screen.getByLabelText(t.home.codeLabel), 'AB1');
    await userEvent.click(screen.getByRole('button', { name: t.home.joinButton }));
    expect(await screen.findByText(t.errors.badCode)).toBeInTheDocument();
  });

  it('creates a game, shows its code and remembers the team name', async () => {
    renderHome([]);
    await userEvent.type(screen.getByLabelText(t.home.team), 'Nous');
    await userEvent.type(screen.getByLabelText(t.home.opponent), 'Rouen');
    await userEvent.click(screen.getByRole('button', { name: t.home.create }));
    expect(await screen.findByText('K7QX')).toBeInTheDocument();
    expect(localStorage.getItem('teamName')).toBe('Nous');
  });

  it('explains when the server is unreachable', async () => {
    const d = makeDeps();
    d.fg.setFailing(true);
    renderWithSync(<Home />, d.deps);
    expect(await screen.findByText(t.errors.server)).toBeInTheDocument();
  });

  it('lists recent games with links', async () => {
    renderHome([gameFx({ code: 'K7QX', opponent: 'Caen' })]);
    expect(await screen.findByText('Caen')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t.nav.report })).toHaveAttribute('href', '#/rapport/K7QX');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/settings.test.ts src/games src/screens`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

`src/settings.ts`:
```ts
import type { Game, Period, Role, Side } from './domain/types';

export interface RecordSetup {
  role: Role;
  defendP1: Side;
  period: Period;
}

// localStorage can throw in private mode: every access is guarded.
const store = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string | null): void {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  },
};

function readJson<T>(k: string): T | null {
  const raw = store.get(k);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const loadTeamName = (): string => store.get('teamName') ?? '';
export const saveTeamName = (n: string): void => store.set('teamName', n);
export const loadSetup = (code: string): RecordSetup | null => readJson<RecordSetup>(`setup:${code}`);
export const saveSetup = (code: string, s: RecordSetup | null): void => store.set(`setup:${code}`, s ? JSON.stringify(s) : null);
export const loadCachedGame = (code: string): Game | null => readJson<Game>(`game:${code}`);
export const saveCachedGame = (g: Game): void => store.set(`game:${g.code}`, JSON.stringify(g));
/** Local date (not UTC) as YYYY-MM-DD. */
export const todayIso = (): string => new Date().toLocaleDateString('sv-SE');
```

`src/games/useGame.tsx`:
```tsx
import { useEffect, useState, type ReactNode } from 'react';
import type { Game } from '../domain/types';
import { useSync } from '../events/SyncContext';
import { t } from '../i18n/fr';
import { loadCachedGame, saveCachedGame } from '../settings';

export type GameState = { status: 'loading' } | { status: 'missing' } | { status: 'error' } | { status: 'ok'; game: Game };

export function useGame(code: string): GameState {
  const { games } = useSync();
  const [state, setState] = useState<GameState>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    games
      .get(code)
      .then((g) => {
        if (!alive) return;
        if (g) saveCachedGame(g);
        setState(g ? { status: 'ok', game: g } : { status: 'missing' });
      })
      .catch(() => {
        if (!alive) return;
        const cached = loadCachedGame(code);
        setState(cached ? { status: 'ok', game: cached } : { status: 'error' });
      });
    return () => {
      alive = false;
    };
  }, [games, code]);
  return state;
}

export function GameGate({ code, children }: { code: string; children: (g: Game) => ReactNode }) {
  const s = useGame(code);
  if (s.status === 'ok') return <>{children(s.game)}</>;
  return (
    <main className="page">
      {s.status === 'loading' && <p className="muted">{t.errors.loading}</p>}
      {s.status === 'missing' && <p className="notice" role="alert">{t.errors.unknownCode}</p>}
      {s.status === 'error' && <p className="notice" role="alert">{t.errors.server}</p>}
      {s.status !== 'loading' && (
        <div className="row">
          <a className="btn" href="#/">
            {t.nav.home}
          </a>
        </div>
      )}
    </main>
  );
}
```

`src/ui/StatCard.tsx`:
```tsx
export function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <section className="card stack">
      <span className="muted">{label}</span>
      <span className="stat-big">{value}</span>
      {sub && <span className="muted">{sub}</span>}
    </section>
  );
}
```

`src/ui/SyncChip.tsx`:
```tsx
import { t } from '../i18n/fr';

export function SyncChip({ pending, connected }: { pending: number; connected: boolean }) {
  const label = pending > 0 ? t.sync.pending(pending) : connected ? t.sync.synced : t.sync.offline;
  return (
    <span className="chip" role="status">
      <span className={`dot-status${connected && pending === 0 ? ' dot-status--ok' : ''}`} />
      {label}
    </span>
  );
}
```

`src/screens/Home.tsx`:
```tsx
import { useEffect, useState, type FormEvent } from 'react';
import type { Game } from '../domain/types';
import { useSync } from '../events/SyncContext';
import { isValidCode, normalizeCode } from '../games/code';
import { t } from '../i18n/fr';
import { href, navigate } from '../router';
import { loadTeamName, saveTeamName, todayIso } from '../settings';
import { formatDate } from '../stats/format';

export function Home() {
  const { games } = useSync();
  const [team, setTeam] = useState(loadTeamName);
  const [opponent, setOpponent] = useState('');
  const [date, setDate] = useState(todayIso);
  const [home, setHome] = useState(true);
  const [created, setCreated] = useState<Game | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<Game[]>([]);

  useEffect(() => {
    games.list().then(setRecent).catch(() => setError(t.errors.server));
  }, [games]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!team.trim() || !opponent.trim()) return;
    setBusy(true);
    setError(null);
    try {
      saveTeamName(team.trim());
      setCreated(await games.create({ team_name: team.trim(), opponent: opponent.trim(), game_date: date, home }));
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
        <a className="btn" href={href({ name: 'season' })}>
          {t.nav.season}
        </a>
      </header>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
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
              <div className="seg" role="group" aria-label={t.home.venue}>
                <button type="button" aria-pressed={home} onClick={() => setHome(true)}>
                  {t.home.homeGame}
                </button>
                <button type="button" aria-pressed={!home} onClick={() => setHome(false)}>
                  {t.home.awayGame}
                </button>
              </div>
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
                      {formatDate(g.game_date)} · {g.code}
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
    </main>
  );
}
```

`src/App.tsx` (replace):
```tsx
import { useRoute } from './router';
import { Home } from './screens/Home';

export function App() {
  const route = useRoute();
  switch (route.name) {
    default:
      return <Home />;
  }
}
```

- [ ] **Step 4: Run tests and build**

Run: `npm test && npm run build`
Expected: all PASS, build OK.

- [ ] **Step 5: Commit**
```bash
git add -A
git commit -m "feat: home screen (create/join game), device settings and offline game cache"
```

---

### Task 10: Recording screen

**Files:**
- Create: `src/screens/record/RecordScreen.tsx`, `src/screens/record/SetupPanel.tsx`, `src/screens/record/Recorder.tsx`
- Modify: `src/App.tsx`
- Test: `src/screens/record/RecordScreen.test.tsx`

**Interfaces:**
- Consumes: `GameGate`, `loadSetup`, `saveSetup`, `RecordSetup`, `useGameEvents`, `Rink`, `ResultButtons`, `SyncChip`, `makeShot`, `makeFaceoff`, `attacksRight`, `endLabels`, `SHOT_RESULTS`, `FACEOFF_RESULTS`, `href`, `t`
- Produces: `RecordScreen({ code })`, `initialMode(role): Mode`

- [ ] **Step 1: Write failing tests** — `src/screens/record/RecordScreen.test.tsx`:
```tsx
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { Role } from '../../domain/types';
import { t } from '../../i18n/fr';
import { saveSetup } from '../../settings';
import { gameFx } from '../../test/builders';
import { makeDeps, renderWithSync } from '../../test/fakes';
import { RecordScreen } from './RecordScreen';

function renderRecord(role: Role = 'all') {
  const d = makeDeps({ games: [gameFx()] });
  saveSetup('AB23', { role, defendP1: 'left', period: 1 });
  renderWithSync(<RecordScreen code="AB23" />, d.deps);
  return d.fr;
}

async function tapRink(x: number, y: number) {
  const svg = await screen.findByRole('group', { name: t.rink.label });
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 200, right: 400, bottom: 200, x: 0, y: 0, toJSON() {} }) as DOMRect;
  fireEvent.click(svg, { clientX: x, clientY: y });
}

const rows = (fr: ReturnType<typeof renderRecord>) => [...fr.rows.values()];

describe('RecordScreen', () => {
  beforeEach(() => localStorage.clear());

  it('asks for role and side when this device has no setup', async () => {
    const d = makeDeps({ games: [gameFx()] });
    renderWithSync(<RecordScreen code="AB23" />, d.deps);
    expect(await screen.findByText(t.setup.chooseRole)).toBeInTheDocument();
    const start = screen.getByRole('button', { name: t.setup.start });
    expect(start).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: t.roles.shots_for }));
    fireEvent.click(screen.getByRole('button', { name: t.setup.defendLeft }));
    fireEvent.click(start);
    expect(await screen.findByText(t.record.tapShot)).toBeInTheDocument();
  });

  it('records a shot once, even if the result button is tapped twice', async () => {
    const fr = renderRecord();
    await tapRink(360, 100);
    const goal = screen.getByRole('button', { name: t.results.goal });
    fireEvent.click(goal);
    fireEvent.click(goal);
    await waitFor(() => expect(fr.rows.size).toBe(1));
    expect(rows(fr)[0]).toMatchObject({ kind: 'shot_for', result: 'goal', period: 1, x: 0.9, y: 0.5 });
  });

  it('drops a half-finished tap when the mode changes', async () => {
    renderRecord();
    await tapRink(360, 100);
    expect(screen.getByRole('button', { name: t.results.goal })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t.modes.shot_against }));
    expect(screen.queryByRole('button', { name: t.results.goal })).toBeNull();
  });

  it('records a faceoff on a dot', async () => {
    const fr = renderRecord();
    fireEvent.click(await screen.findByRole('button', { name: t.modes.faceoff }));
    fireEvent.click(screen.getByRole('button', { name: t.dots.off_top }));
    fireEvent.click(screen.getByRole('button', { name: t.results.won }));
    await waitFor(() => expect(fr.rows.size).toBe(1));
    expect(rows(fr)[0]).toMatchObject({ kind: 'faceoff', dot: 'off_top', result: 'won' });
  });

  it('warns at half-time, drops a pending tap and flips the ends', async () => {
    const fr = renderRecord();
    await tapRink(360, 100);
    fireEvent.click(screen.getByRole('button', { name: 'P2' }));
    expect(screen.queryByRole('button', { name: t.results.goal })).toBeNull();
    expect(screen.getByRole('dialog', { name: t.record.halftimeTitle })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t.record.halftimeOk }));
    // In P2 we attack left on this device: a tap near the left goal is stored near x = 1.
    await tapRink(40, 100);
    fireEvent.click(screen.getByRole('button', { name: t.results.save }));
    await waitFor(() => expect(fr.rows.size).toBe(1));
    expect(rows(fr)[0]).toMatchObject({ period: 2, x: 0.9 });
  });

  it('undoes the last entry of this device', async () => {
    const fr = renderRecord();
    await tapRink(360, 100);
    fireEvent.click(screen.getByRole('button', { name: t.results.goal }));
    await waitFor(() => expect(fr.rows.size).toBe(1));
    fireEvent.click(screen.getByRole('button', { name: t.record.undoLast }));
    await waitFor(() => expect(rows(fr)[0].deleted_at).not.toBeNull());
  });

  it('shows only the relevant buttons for a single-role tracker', async () => {
    renderRecord('shots_against');
    await screen.findByRole('group', { name: t.rink.label });
    expect(screen.queryByRole('button', { name: t.modes.shot_for })).toBeNull();
    await tapRink(40, 100);
    fireEvent.click(screen.getByRole('button', { name: t.results.blocked }));
    expect(await screen.findByText(`P1 · ${t.modes.shot_against} · ${t.results.blocked}`)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/screens/record`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`src/screens/record/RecordScreen.tsx`:
```tsx
import { useState } from 'react';
import type { Game } from '../../domain/types';
import { GameGate } from '../../games/useGame';
import { loadSetup, saveSetup, type RecordSetup } from '../../settings';
import { Recorder } from './Recorder';
import { SetupPanel } from './SetupPanel';

export function RecordScreen({ code }: { code: string }) {
  return <GameGate code={code}>{(game) => <RecordFlow game={game} />}</GameGate>;
}

function RecordFlow({ game }: { game: Game }) {
  const [setup, setSetup] = useState<RecordSetup | null>(() => loadSetup(game.code));
  const update = (s: RecordSetup | null) => {
    saveSetup(game.code, s);
    setSetup(s);
  };
  return setup ? <Recorder game={game} setup={setup} onSetupChange={update} /> : <SetupPanel game={game} onDone={update} />;
}
```

`src/screens/record/SetupPanel.tsx`:
```tsx
import { useState } from 'react';
import type { Game, Role, Side } from '../../domain/types';
import { t } from '../../i18n/fr';
import { attacksRight, endLabels } from '../../rink/coords';
import { Rink } from '../../rink/Rink';
import type { RecordSetup } from '../../settings';

const ROLES: Role[] = ['shots_for', 'shots_against', 'faceoffs', 'all'];
const SIDES: Side[] = ['left', 'right'];

export function SetupPanel({ game, onDone }: { game: Game; onDone: (s: RecordSetup) => void }) {
  const [role, setRole] = useState<Role | null>(null);
  const [side, setSide] = useState<Side | null>(null);
  const attackRight = side ? attacksRight(side, 1) : true;
  const labels = endLabels(game.team_name, game.opponent, attackRight);

  return (
    <main className="page">
      <header className="topbar">
        <a className="btn" href="#/">
          {t.nav.home}
        </a>
        <h1>{t.setup.title}</h1>
        <span className="chip chip--dark">{game.code}</span>
      </header>
      <section className="card stack">
        <h2>{t.setup.chooseRole}</h2>
        <div className="row">
          {ROLES.map((r) => (
            <button key={r} type="button" className={`btn btn--big${role === r ? ' btn--primary' : ''}`} aria-pressed={role === r} onClick={() => setRole(r)}>
              {t.roles[r]}
            </button>
          ))}
        </div>
      </section>
      <section className="card stack">
        <h2>{t.setup.chooseSide}</h2>
        <p className="muted">{t.setup.sideHint}</p>
        <div className="row">
          {SIDES.map((s) => (
            <button key={s} type="button" className={`btn btn--big${side === s ? ' btn--primary' : ''}`} aria-pressed={side === s} onClick={() => setSide(s)}>
              {s === 'left' ? t.setup.defendLeft : t.setup.defendRight}
            </button>
          ))}
        </div>
        {side && <Rink attackRight={attackRight} leftLabel={labels.left} rightLabel={labels.right} />}
      </section>
      <button
        type="button"
        className="btn btn--primary btn--big"
        disabled={!role || !side}
        onClick={() => {
          if (role && side) onDone({ role, defendP1: side, period: 1 });
        }}
      >
        {t.setup.start}
      </button>
    </main>
  );
}
```

`src/screens/record/Recorder.tsx`:
```tsx
import { useRef, useState } from 'react';
import { makeFaceoff, makeShot } from '../../domain/factory';
import { FACEOFF_RESULTS, SHOT_RESULTS, type DotId, type FaceoffResult, type Game, type Period, type Point, type Role, type ShotKind, type ShotResult } from '../../domain/types';
import { useGameEvents } from '../../events/useGameEvents';
import { t } from '../../i18n/fr';
import { attacksRight, endLabels } from '../../rink/coords';
import { Rink } from '../../rink/Rink';
import { href } from '../../router';
import type { RecordSetup } from '../../settings';
import { ResultButtons } from '../../ui/ResultButtons';
import { SyncChip } from '../../ui/SyncChip';

type Mode = ShotKind | 'faceoff';
const MODES: Mode[] = ['shot_for', 'shot_against', 'faceoff'];
const PERIODS: Period[] = [1, 2];

export function initialMode(role: Role): Mode {
  if (role === 'shots_against') return 'shot_against';
  if (role === 'faceoffs') return 'faceoff';
  return 'shot_for';
}

export function Recorder({ game, setup, onSetupChange }: { game: Game; setup: RecordSetup; onSetupChange: (s: RecordSetup | null) => void }) {
  const { events, pending, connected, record, remove } = useGameEvents(game.code);
  const [mode, setMode] = useState<Mode>(() => initialMode(setup.role));
  const [tap, setTapState] = useState<Point | null>(null);
  const [dot, setDotState] = useState<DotId | null>(null);
  const [halftime, setHalftime] = useState(false);
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

  const attackRight = attacksRight(setup.defendP1, setup.period);
  const labels = endLabels(game.team_name, game.opponent, attackRight);
  const ctx = { code: game.code, period: setup.period, role: setup.role };

  function changeMode(m: Mode) {
    clear();
    setMode(m);
  }
  function changePeriod(p: Period) {
    if (p === setup.period) return;
    clear();
    onSetupChange({ ...setup, period: p });
    if (p === 2) setHalftime(true);
  }
  function pickShot(r: ShotResult) {
    const p = tapRef.current;
    if (!p || mode === 'faceoff') return;
    clear();
    record(makeShot(ctx, mode, p, r));
  }
  function pickFaceoff(r: FaceoffResult) {
    const d = dotRef.current;
    if (!d) return;
    clear();
    record(makeFaceoff(ctx, d, r));
  }

  const live = events.filter((e) => !e.deleted_at);
  const markers =
    mode === 'faceoff'
      ? []
      : live
          .filter((e) => e.kind === mode && e.period === setup.period && e.x !== null && e.y !== null)
          .map((e) => ({ id: e.id, x: e.x as number, y: e.y as number, result: e.result }));
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
          {PERIODS.map((p) => (
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

      {setup.role === 'all' && (
        <div className="seg" role="group" aria-label={t.record.modeLabel}>
          {MODES.map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => changeMode(m)}>
              {t.modes[m]}
            </button>
          ))}
        </div>
      )}

      <div className="record">
        <section className="card stack">
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
                  <span>{`${t.record.period(e.period)} · ${t.modes[e.kind]} · ${t.results[e.result]}`}</span>
                  <button type="button" className="btn btn--icon" aria-label={t.record.delete} onClick={() => remove(e.id)}>
                    ✕
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

      {halftime && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label={t.record.halftimeTitle}>
          <h1>{t.record.halftimeTitle}</h1>
          <Rink attackRight={attackRight} leftLabel={labels.left} rightLabel={labels.right} />
          <button type="button" className="btn btn--big" onClick={() => setHalftime(false)}>
            {t.record.halftimeOk}
          </button>
        </div>
      )}
    </main>
  );
}
```

`src/App.tsx` (replace):
```tsx
import { useRoute } from './router';
import { Home } from './screens/Home';
import { RecordScreen } from './screens/record/RecordScreen';

export function App() {
  const route = useRoute();
  switch (route.name) {
    case 'record':
      return <RecordScreen key={route.code} code={route.code} />;
    default:
      return <Home />;
  }
}
```

- [ ] **Step 4: Run tests and build**

Run: `npm test && npm run build`
Expected: all PASS, build OK.

- [ ] **Step 5: Manual touch check.** Run `npm run dev -- --host`. Open the printed network URL on a tablet (or use a narrow browser window at 1024×768), create a game, record 10 shots, and check that each one takes under 3 seconds. Note any problem areas for the final review.

- [ ] **Step 6: Commit**
```bash
git add -A
git commit -m "feat: recording screen with roles, orientation, half-time flip and undo"
```

---

### Task 11: Game report screen

**Files:**
- Create: `src/screens/report/ReportScreen.tsx`, `src/screens/report/LevelsTable.tsx`, `src/screens/report/FaceoffTable.tsx`
- Modify: `src/App.tsx`
- Test: `src/screens/report/ReportScreen.test.tsx`

**Interfaces:**
- Consumes: `GameGate`, `useGameEvents`, `computeGameStats`, `faceoffsByDot`, `GameStats`, `WinLoss`, `formatPct`, `formatDate`, `eventsToCsv`, `downloadCsv`, `slug`, `Rink`, `Legend`, `filterShotMarkers`, `PeriodFilter`, `SideFilter`, `StatCard`, `SyncChip`, `DOT_IDS`
- Produces: `ReportScreen({ code })`, `LevelsTable({ stats })`, `FaceoffTable({ stats })`

- [ ] **Step 1: Write failing test** — `src/screens/report/ReportScreen.test.tsx`:
```tsx
import { fireEvent, screen, within } from '@testing-library/react';
import { t } from '../../i18n/fr';
import { faceoffEv, gameFx, shotEv } from '../../test/builders';
import { makeDeps, renderWithSync } from '../../test/fakes';
import { ReportScreen } from './ReportScreen';

function renderReport() {
  const d = makeDeps({ games: [gameFx()] });
  [
    shotEv('shot_for', 'goal'),
    shotEv('shot_against', 'save'),
    shotEv('shot_against', 'save'),
    shotEv('shot_against', 'goal', { period: 2 }),
    shotEv('shot_against', 'blocked', { period: 2 }),
    faceoffEv('center', 'won'),
    faceoffEv('off_top', 'lost'),
  ].forEach((e) => d.fr.rows.set(e.id, e));
  const view = renderWithSync(<ReportScreen code="AB23" />, d.deps);
  return { ...d, ...view };
}

describe('ReportScreen', () => {
  it('shows the score, both save percentages and faceoff %', async () => {
    renderReport();
    expect(await screen.findByText('1 – 1')).toBeInTheDocument();
    const card = (label: string) => within(screen.getByText(label).closest('section')!);
    expect(card(t.report.ourSave).getByText('66,7 %')).toBeInTheDocument(); // our goalie: 2 saves / 3 on goal
    expect(card(t.report.oppSave).getByText('0 %')).toBeInTheDocument(); // their goalie: 0 saves / 1 on goal
    expect(card(t.report.shooting).getByText('100 %')).toBeInTheDocument(); // 1 goal / 1 on goal
  });

  it('shows the four shot levels per period', async () => {
    renderReport();
    await screen.findByText('1 – 1');
    const row = screen.getByRole('row', { name: new RegExp(t.report.levels.attempts) });
    expect(within(row).getAllByRole('cell').map((c) => c.textContent)).toEqual(['1', '0', '1', '2', '2', '4']);
  });

  it('filters the shot map by side', async () => {
    const { container } = renderReport();
    await screen.findByText('1 – 1');
    const map = () => container.querySelectorAll('svg.rink')[0].querySelectorAll('[data-result]').length;
    expect(map()).toBe(5);
    fireEvent.click(screen.getByRole('button', { name: t.report.for }));
    expect(map()).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/screens/report`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`src/screens/report/LevelsTable.tsx`:
```tsx
import { t } from '../../i18n/fr';
import type { GameStats } from '../../stats/game';

const LEVELS = ['attempts', 'unblocked', 'onGoal', 'goals'] as const;

export function LevelsTable({ stats }: { stats: GameStats }) {
  const cols = [stats.p1, stats.p2, stats.total];
  const heads = ['P1', 'P2', t.report.total];
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th />
            <th colSpan={3}>{t.report.us}</th>
            <th colSpan={3}>{t.report.them}</th>
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

`src/screens/report/FaceoffTable.tsx`:
```tsx
import { t } from '../../i18n/fr';
import { formatPct } from '../../stats/format';
import type { GameStats, WinLoss } from '../../stats/game';

export function FaceoffTable({ stats }: { stats: GameStats }) {
  const z = stats.total.faceoffsByZone;
  const rows: [string, WinLoss][] = [
    [t.report.total, stats.total.faceoffs],
    ['P1', stats.p1.faceoffs],
    ['P2', stats.p2.faceoffs],
    [t.report.zones.off, z.off],
    [t.report.zones.neutral, z.neutral],
    [t.report.zones.def, z.def],
  ];
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th />
            <th>{t.report.won}</th>
            <th>{t.report.lost}</th>
            <th>%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, w]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{w.won}</td>
              <td>{w.lost}</td>
              <td>{formatPct(w.pct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

`src/screens/report/ReportScreen.tsx`:
```tsx
import { useMemo, useState } from 'react';
import { SHOT_RESULTS, type DotId, type Game } from '../../domain/types';
import { useGameEvents } from '../../events/useGameEvents';
import { GameGate } from '../../games/useGame';
import { t } from '../../i18n/fr';
import { DOT_IDS } from '../../rink/dots';
import { Legend } from '../../rink/Legend';
import { filterShotMarkers, type PeriodFilter, type SideFilter } from '../../rink/markers';
import { Rink } from '../../rink/Rink';
import { href } from '../../router';
import { downloadCsv, eventsToCsv, slug } from '../../stats/csv';
import { formatDate, formatPct } from '../../stats/format';
import { computeGameStats, faceoffsByDot } from '../../stats/game';
import { StatCard } from '../../ui/StatCard';
import { SyncChip } from '../../ui/SyncChip';
import { FaceoffTable } from './FaceoffTable';
import { LevelsTable } from './LevelsTable';

const PERIOD_FILTERS: PeriodFilter[] = ['all', 1, 2];
const SIDE_FILTERS: SideFilter[] = ['both', 'for', 'against'];
const sideLabel = (s: SideFilter) => (s === 'both' ? t.report.both : s === 'for' ? t.report.for : t.report.against);

export function ReportScreen({ code }: { code: string }) {
  return <GameGate code={code}>{(game) => <Report game={game} />}</GameGate>;
}

function Report({ game }: { game: Game }) {
  const { events, pending, connected, loadError } = useGameEvents(game.code);
  const stats = useMemo(() => computeGameStats(events), [events]);
  const byDot = useMemo(() => faceoffsByDot(events), [events]);
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [side, setSide] = useState<SideFilter>('both');

  const dotText: Partial<Record<DotId, string>> = {};
  for (const id of DOT_IDS) {
    const w = byDot[id];
    if (w.won + w.lost > 0) dotText[id] = `${formatPct(w.pct)} · ${w.won}/${w.won + w.lost}`;
  }
  const fo = stats.total.faceoffs;

  return (
    <main className="page">
      <header className="topbar">
        <a className="btn" href="#/">
          {t.nav.home}
        </a>
        <h1>{t.report.title}</h1>
        <span className="topbar__spacer" />
        <SyncChip pending={pending} connected={connected} />
        <a className="btn" href={href({ name: 'record', code: game.code })}>
          {t.nav.record}
        </a>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => downloadCsv(`match-${game.game_date}-${slug(game.opponent)}.csv`, eventsToCsv(events, [game]))}
        >
          {t.report.exportCsv}
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
            {formatDate(game.game_date)} · {game.home ? t.season.home : t.season.away} · {game.code}
          </span>
          <div className="row">
            <span>{game.team_name}</span>
            <span className="stat-big">{`${stats.score.us} – ${stats.score.them}`}</span>
            <span>{game.opponent}</span>
          </div>
        </section>
        <StatCard label={t.report.ourSave} value={formatPct(stats.total.ourSavePct)} sub={`P1 ${formatPct(stats.p1.ourSavePct)} · P2 ${formatPct(stats.p2.ourSavePct)}`} />
        <StatCard label={t.report.oppSave} value={formatPct(stats.total.oppSavePct)} sub={`P1 ${formatPct(stats.p1.oppSavePct)} · P2 ${formatPct(stats.p2.oppSavePct)}`} />
        <StatCard label={t.report.shooting} value={formatPct(stats.total.shootingPct)} />
        <StatCard label={t.report.faceoffs} value={formatPct(fo.pct)} sub={`${fo.won}/${fo.won + fo.lost}`} />
      </div>

      <section className="card stack">
        <h2>{t.report.shotsTitle}</h2>
        <LevelsTable stats={stats} />
      </section>

      <section className="card stack">
        <div className="row">
          <h2>{t.report.shotMap}</h2>
          <span className="topbar__spacer" />
          <div className="seg" role="group" aria-label={t.record.periodLabel}>
            {PERIOD_FILTERS.map((p) => (
              <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)}>
                {p === 'all' ? t.report.allPeriods : t.record.period(p)}
              </button>
            ))}
          </div>
          <div className="seg" role="group" aria-label={t.report.shotMap}>
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
    </main>
  );
}
```

`src/App.tsx` (replace):
```tsx
import { useRoute } from './router';
import { Home } from './screens/Home';
import { RecordScreen } from './screens/record/RecordScreen';
import { ReportScreen } from './screens/report/ReportScreen';

export function App() {
  const route = useRoute();
  switch (route.name) {
    case 'record':
      return <RecordScreen key={route.code} code={route.code} />;
    case 'report':
      return <ReportScreen key={route.code} code={route.code} />;
    default:
      return <Home />;
  }
}
```

- [ ] **Step 4: Run tests and build**

Run: `npm test && npm run build`
Expected: all PASS, build OK.

- [ ] **Step 5: Commit**
```bash
git add -A
git commit -m "feat: live game report with shot levels, save %, faceoff % by zone and maps"
```

---

### Task 12: Season screen

**Files:**
- Create: `src/screens/SeasonScreen.tsx`
- Modify: `src/App.tsx`
- Test: `src/screens/SeasonScreen.test.tsx`

**Interfaces:**
- Consumes: `useSync`, `computeSeasonStats`, `formatPct`, `formatNumber`, `formatDate`, `eventsToCsv`, `downloadCsv`, `Rink`, `Legend`, `filterShotMarkers`, `SideFilter`, `StatCard`, `href`, `t`
- Produces: `SeasonScreen()`

- [ ] **Step 1: Write failing test** — `src/screens/SeasonScreen.test.tsx`:
```tsx
import { fireEvent, screen, within } from '@testing-library/react';
import { t } from '../i18n/fr';
import { gameFx, shotEv } from '../test/builders';
import { makeDeps, renderWithSync } from '../test/fakes';
import { SeasonScreen } from './SeasonScreen';

function renderSeason() {
  const d = makeDeps({
    games: [gameFx({ code: 'AAAA', opponent: 'Rouen', game_date: '2026-09-20' }), gameFx({ code: 'BBBB', opponent: 'Caen', game_date: '2026-09-27' })],
  });
  [
    shotEv('shot_for', 'goal', { game_code: 'AAAA' }),
    shotEv('shot_for', 'goal', { game_code: 'AAAA' }),
    shotEv('shot_against', 'save', { game_code: 'BBBB' }),
  ].forEach((e) => d.fr.rows.set(e.id, e));
  return renderWithSync(<SeasonScreen />, d.deps);
}

describe('SeasonScreen', () => {
  it('lists every game with its score, newest first', async () => {
    renderSeason();
    const table = await screen.findByRole('table', { name: t.season.byGame });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((r) => within(r).getAllByRole('cell')[0].textContent)).toEqual(['Caen', 'Rouen']);
    expect(within(rows[1]).getByText('2 – 0')).toBeInTheDocument();
  });

  it('shows per-game averages', async () => {
    renderSeason();
    const totals = await screen.findByRole('table', { name: t.season.totals });
    const goals = within(totals).getByRole('row', { name: new RegExp(t.report.levels.goals) });
    expect(within(goals).getAllByRole('cell').map((c) => c.textContent)).toEqual(['2', '1', '0', '0']);
  });

  it('limits the combined map to the selected games', async () => {
    const { container } = renderSeason();
    await screen.findByRole('table', { name: t.season.byGame });
    const count = () => container.querySelector('svg.rink')!.querySelectorAll('[data-result]').length;
    expect(count()).toBe(3);
    fireEvent.click(screen.getByRole('checkbox', { name: /Rouen/ }));
    expect(count()).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/screens/SeasonScreen.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — `src/screens/SeasonScreen.tsx`:
```tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SHOT_RESULTS, type Game, type GameEvent } from '../domain/types';
import { useSync } from '../events/SyncContext';
import { t } from '../i18n/fr';
import { Legend } from '../rink/Legend';
import { filterShotMarkers, type SideFilter } from '../rink/markers';
import { Rink } from '../rink/Rink';
import { href } from '../router';
import { downloadCsv, eventsToCsv } from '../stats/csv';
import { formatDate, formatNumber, formatPct } from '../stats/format';
import { computeSeasonStats } from '../stats/season';
import { StatCard } from '../ui/StatCard';

const LEVELS = ['attempts', 'unblocked', 'onGoal', 'goals'] as const;
const SIDE_FILTERS: SideFilter[] = ['both', 'for', 'against'];
const sideLabel = (s: SideFilter) => (s === 'both' ? t.report.both : s === 'for' ? t.report.for : t.report.against);

export function SeasonScreen() {
  const { games, remote } = useSync();
  const [data, setData] = useState<{ games: Game[]; events: GameEvent[] } | null>(null);
  const [error, setError] = useState(false);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [side, setSide] = useState<SideFilter>('both');

  const load = useCallback(async () => {
    setError(false);
    try {
      const [g, e] = await Promise.all([games.list(), remote.fetchAllEvents()]);
      setData({ games: g, events: e });
    } catch {
      setError(true);
    }
  }, [games, remote]);

  useEffect(() => {
    void load();
  }, [load]);

  const season = useMemo(() => (data ? computeSeasonStats(data.games, data.events) : null), [data]);
  const toggle = (code: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  return (
    <main className="page">
      <header className="topbar">
        <a className="btn" href="#/">
          {t.nav.home}
        </a>
        <h1>{t.season.title}</h1>
        <span className="topbar__spacer" />
        <button type="button" className="btn" onClick={() => void load()}>
          {t.season.refresh}
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={!data}
          onClick={() => data && downloadCsv('saison.csv', eventsToCsv(data.events, data.games))}
        >
          {t.report.exportCsv}
        </button>
      </header>

      {error && (
        <p className="notice" role="alert">
          {t.errors.server}
        </p>
      )}
      {!season && !error && <p className="muted">{t.errors.loading}</p>}
      {season && data && season.games === 0 && <p className="muted">{t.season.empty}</p>}

      {season && data && season.games > 0 && (
        <>
          <div className="grid">
            <StatCard label={t.season.games} value={String(season.games)} />
            <StatCard label={t.report.ourSave} value={formatPct(season.total.ourSavePct)} />
            <StatCard label={t.report.shooting} value={formatPct(season.total.shootingPct)} />
            <StatCard label={t.report.faceoffs} value={formatPct(season.total.faceoffs.pct)} />
          </div>

          <section className="card stack">
            <h2>{t.season.totals}</h2>
            <div className="table-wrap">
              <table className="table" aria-label={t.season.totals}>
                <thead>
                  <tr>
                    <th />
                    <th>{t.report.us}</th>
                    <th>{t.season.perGame}</th>
                    <th>{t.report.them}</th>
                    <th>{t.season.perGame}</th>
                  </tr>
                </thead>
                <tbody>
                  {LEVELS.map((l) => (
                    <tr key={l}>
                      <th scope="row">{t.report.levels[l]}</th>
                      <td>{season.total.shotsFor[l]}</td>
                      <td>{formatNumber(season.avgFor[l])}</td>
                      <td>{season.total.shotsAgainst[l]}</td>
                      <td>{formatNumber(season.avgAgainst[l])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card stack">
            <h2>{t.season.byGame}</h2>
            <div className="table-wrap">
              <table className="table" aria-label={t.season.byGame}>
                <thead>
                  <tr>
                    <th>{t.season.opponent}</th>
                    <th>{t.season.date}</th>
                    <th>{t.season.venue}</th>
                    <th>{t.season.score}</th>
                    <th>{t.season.sogFor}</th>
                    <th>{t.season.sogAgainst}</th>
                    <th>{t.season.savePct}</th>
                    <th>{t.season.faceoffPct}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {season.rows.map(({ game, stats }) => (
                    <tr key={game.code}>
                      <td>{game.opponent}</td>
                      <td>{formatDate(game.game_date)}</td>
                      <td>{game.home ? t.season.home : t.season.away}</td>
                      <td>{`${stats.score.us} – ${stats.score.them}`}</td>
                      <td>{stats.total.shotsFor.onGoal}</td>
                      <td>{stats.total.shotsAgainst.onGoal}</td>
                      <td>{formatPct(stats.total.ourSavePct)}</td>
                      <td>{formatPct(stats.total.faceoffs.pct)}</td>
                      <td>
                        <a className="btn" href={href({ name: 'report', code: game.code })}>
                          {t.nav.report}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card stack">
            <div className="row">
              <h2>{t.season.map}</h2>
              <span className="topbar__spacer" />
              <div className="seg" role="group" aria-label={t.season.map}>
                {SIDE_FILTERS.map((s) => (
                  <button key={s} type="button" aria-pressed={side === s} onClick={() => setSide(s)}>
                    {sideLabel(s)}
                  </button>
                ))}
              </div>
            </div>
            <div className="checks">
              {season.rows.map(({ game }) => (
                <label key={game.code}>
                  <input type="checkbox" checked={!excluded.has(game.code)} onChange={() => toggle(game.code)} />
                  {`${formatDate(game.game_date)} ${game.opponent}`}
                </label>
              ))}
            </div>
            <Rink
              attackRight
              leftLabel={t.report.us}
              rightLabel={t.report.them}
              markers={filterShotMarkers(data.events.filter((e) => !excluded.has(e.game_code)), 'all', side)}
            />
            <Legend results={SHOT_RESULTS} />
          </section>
        </>
      )}
    </main>
  );
}
```

`src/App.tsx` (replace, final):
```tsx
import { useRoute } from './router';
import { Home } from './screens/Home';
import { RecordScreen } from './screens/record/RecordScreen';
import { ReportScreen } from './screens/report/ReportScreen';
import { SeasonScreen } from './screens/SeasonScreen';

export function App() {
  const route = useRoute();
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

- [ ] **Step 4: Run tests and build**

Run: `npm test && npm run build`
Expected: all PASS, build OK.

- [ ] **Step 5: Commit**
```bash
git add -A
git commit -m "feat: season view with totals, per-game averages, game table and combined shot map"
```

---

### Task 13: Installable PWA and GitHub Pages deployment

**Files:**
- Modify: `vite.config.ts`
- Create: `.github/workflows/deploy.yml`, `README.md`

**Interfaces:**
- Consumes: the whole app
- Produces: `dist/manifest.webmanifest`, `dist/sw.js`, a Pages deploy workflow

- [ ] **Step 1: Install**

Run: `npm install -D vite-plugin-pwa`

- [ ] **Step 2: Configure** — `vite.config.ts` (replace):
```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/roller-stats/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Roller Stats',
        short_name: 'Roller Stats',
        lang: 'fr',
        start_url: '/roller-stats/',
        scope: '/roller-stats/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#ECECEC',
        theme_color: '#1E1E1E',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
  test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test/setup.ts'] },
});
```

- [ ] **Step 3: Build and verify the PWA output**

Run: `npm run build && ls dist`
Expected: `manifest.webmanifest`, `sw.js`, `index.html`, and `assets/` are present.

- [ ] **Step 4: Write the workflow** — `.github/workflows/deploy.yml`. Check each action's latest major version on GitHub Marketplace before committing, and bump the version if a newer major exists:
```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 5: Write `README.md`**:
```markdown
# Roller Stats

Web app to record inline hockey shots and faceoffs on several tablets at once, merged by match code.

- App: https://trophy8726.github.io/roller-stats/
- Dev: `npm install`, `npm run dev`, `npm test`
- Database: Supabase project `ibgyycalrtnwtfmlzrwk`. Schema in `supabase/schema.sql`; `npm run smoke` checks its rules.
- Free Supabase projects pause after 7 days without activity: supabase.com → project → Restore.
- Deploys automatically on every push to `main` (GitHub Actions → Pages).
```

- [ ] **Step 6: Commit**
```bash
git add -A
git commit -m "feat: installable PWA and GitHub Pages deployment workflow"
```

- [ ] **Step 7: Create the GitHub repo and enable Pages**
```bash
gh repo create Trophy8726/roller-stats --public --source . --remote origin --description "Inline hockey shot & faceoff tracker"
gh api -X POST repos/Trophy8726/roller-stats/pages -f build_type=workflow
git push -u origin HEAD
```
If the Pages API call fails because the repo has no branch yet, run it again after the user's push in Step 8, then re-run the workflow with `gh workflow run deploy.yml`.

- [ ] **Step 8: USER ACTION.** Ask the user to publish to `main` themselves. The agent does not push to main. They type in the Claude prompt: `! git push origin HEAD:main`. Then watch the deploy with `gh run watch` until the deploy job succeeds.

---

### Task 14: End-to-end verification on the real stack

**Files:** none (verification only; fix bugs found here in the owning file with a test first)

- [ ] **Step 1: Unit suite and build:** `npm test && npm run build` → all green.
- [ ] **Step 2: Database rules:** `npm run smoke` → 8 × `OK`. The user runs the printed cleanup SQL.
- [ ] **Step 3: Two-device sync, live.** Use the claude-in-chrome tools on the deployed URL `https://trophy8726.github.io/roller-stats/` (or `npm run dev` + `http://localhost:5173/roller-stats/`) with two tabs:
  1. Tab A: create a game "TEST E2E". Note the code.
  2. Tab B: join with the code in lowercase. Pick role *Tirs contre*, "Nous défendons à droite".
  3. Tab A: role *Tout*, "Nous défendons à gauche". Record 1 goal for and 1 faceoff won.
  4. Tab B: record 2 saves and 1 goal against.
  5. Open the report in a third tab. Expected: score 1 – 1, our save % 66,7 %, faceoff % 100 %, 4 markers on the shot map, and every shot for on the right half.
  6. Tab A: *Annuler la dernière saisie*. The report updates within ~2 s with no reload.
  7. Record a GIF of steps 3–6 (`e2e_sync.gif`).
- [ ] **Step 4: Offline check (manual, by the user on a tablet):** enable airplane mode, record 3 shots (the chip shows "3 en attente"), reload the page (it still opens), disable airplane mode, and check that the chip returns to "Synchronisé" and the report shows the 3 shots.
- [ ] **Step 5: Cleanup:** give the user the SQL to delete the E2E game: `delete from events where game_code='XXXX'; delete from games where code='XXXX';`
- [ ] **Step 6: Final whole-branch review** (subagent-driven-development's final reviewer), then report the URL to the user.
