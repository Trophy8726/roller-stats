# Roller Stats

Web app to record inline hockey shots and faceoffs on several tablets at once, merged by match code.

- App: https://trophy8726.github.io/roller-stats/
- Dev: `npm install`, `npm run dev`, `npm test`
- Database: Supabase project `ibgyycalrtnwtfmlzrwk`. Schema in `supabase/schema.sql` (v1), then `supabase/migration-v2.sql`; `npm run smoke` checks the rules of both.
- Free Supabase projects pause after 7 days without activity: supabase.com → project → Restore.
- Deploys automatically on every push to `main` (GitHub Actions → Pages).

## Version 2

Adds a goalie roster with per-goalie statistics (cumulated over the season, empty-net shots and own goals left out), competitions (Championnat, Coupe de France, Playoffs) and venues (Domicile, Extérieur, Terrain neutre), shared match states (goalie in net, opponent net empty, numerical situation) shown in a permanent banner, a "Divers" tab (own goals, penalty shots, shootouts, free notes), overtime, attaching a goalie to past entries that have none, and a PDF export of the match report through the print dialog.

Spec: `docs/superpowers/specs/2026-09-25-roller-stats-v2-design.md`. Plan: `docs/superpowers/plans/2026-09-25-roller-stats-v2.md`.

### Deployment order (important)

1. Run `supabase/migration-v2.sql` once in the Supabase SQL Editor. It keeps every existing row and the v1 app keeps working while it is applied.
2. Run `npm run smoke` and check that every line says `OK`.
3. Merge to `main` (the deploy runs on push). Deploying **before** the migration breaks recording, because v2 sends the new columns.
