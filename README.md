# Roller Stats

Web app to record inline hockey shots and faceoffs on several tablets at once, merged by match code.

- App: https://trophy8726.github.io/roller-stats/
- Dev: `npm install`, `npm run dev`, `npm test`
- Databases: production Supabase `ibgyycalrtnwtfmlzrwk` (`.env`), staging (`.env.development`, used by `npm run dev`). Schema: `supabase/schema.sql` (v1), then `supabase/migration-v2.sql`, then `supabase/migration-v3a.sql`. `npm run smoke` checks the access rules **on staging only** (needs `.env.smoke.local`, see `scripts/smoke.mjs`). On a network where Node times out on the first address, run it as `node --dns-result-order=ipv4first --network-family-autoselection-attempt-timeout=2000 scripts/smoke.mjs`.
- Free Supabase projects pause after 7 days without activity: supabase.com → project → Restore.
- Deploys automatically on every push to `main` (GitHub Actions → Pages).

## Version 2

Adds a goalie roster with per-goalie statistics (cumulated over the season, empty-net shots and own goals left out), competitions (Championnat, Coupe de France, Playoffs) and venues (Domicile, Extérieur, Terrain neutre), shared match states (goalie in net, opponent net empty, numerical situation) shown in a permanent banner, a "Divers" tab (own goals, penalty shots, shootouts, free notes), overtime, attaching a goalie to past entries that have none, and a PDF export of the match report through the print dialog.

Spec: `docs/superpowers/specs/2026-09-25-roller-stats-v2-design.md`. Plan: `docs/superpowers/plans/2026-09-25-roller-stats-v2.md`.

### Deployment order (important)

1. Run `supabase/migration-v2.sql` once in the Supabase SQL Editor. It keeps every existing row and the v1 app keeps working while it is applied.
2. Run `npm run smoke` and check that every line says `OK`.
3. Merge to `main` (the deploy runs on push). Deploying **before** the migration breaks recording, because v2 sends the new columns.

## Version 3 — release 1a (accounts and clubs)

Sign-in with Google. Each account belongs to one or more clubs (roles: Responsable, Membre) and only sees their data. A club has teams (N2, U20…), its own goalie roster, and an invitation link that the Responsable can regenerate.

Spec: `docs/superpowers/specs/2026-10-15-roller-stats-v3-phase1-design.md`. Plan: `docs/superpowers/plans/2026-10-15-roller-stats-v3-phase1a.md`.

### Production cut-over (a day without games; the app is down a few minutes between steps 2 and 4)

1. Supabase production → Authentication → Sign In / Providers → Google: same client ID and secret as staging. URL Configuration: Site URL `https://trophy8726.github.io/roller-stats/`, same address under Redirect URLs.
2. SQL Editor: run `supabase/migration-v3a.sql`. It stops with an error if a game other than 9MKH, B9NG, QSFA exists: decide its club first. From here on, the v2 app no longer works.
3. Merge `feat/v3` into `main` and push (the deploy runs on push). Wait for the "Deploy to GitHub Pages" run to succeed.
4. Open the app, sign in with Google. Then in the SQL Editor run `supabase/claim-v3a.sql` with your Google address on the marked line. Reload the app: both clubs appear.
5. Maisons-Laffitte hand-over: Club tab → copy the invitation link → send it to the future Responsable → once they have joined, « Nommer responsable » → « Quitter le club ».
