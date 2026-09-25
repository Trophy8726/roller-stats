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
import { computeGoalieStats } from '../stats/goalies';
import { computeSeasonStats, type CompetitionFilter } from '../stats/season';
import { StatCard } from '../ui/StatCard';
import { useGoalies } from '../goalies/useGoalies';
import { GoalieTable } from './report/GoalieTable';

const COMPETITION_FILTERS: CompetitionFilter[] = ['championnat', 'coupe', 'playoffs', 'all'];
const competitionLabel = (c: CompetitionFilter) => (c === 'all' ? t.season.allCompetitions : t.competitions[c]);
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

  const { names } = useGoalies();
  const [competition, setCompetition] = useState<CompetitionFilter>('championnat');
  const season = useMemo(() => (data ? computeSeasonStats(data.games, data.events, excluded, competition) : null), [data, excluded, competition]);
  const includedCodes = useMemo(() => new Set(season?.rows.filter((r) => r.included).map((r) => r.game.code)), [season]);
  const goalieLines = useMemo(
    () => (data ? computeGoalieStats(data.events.filter((e) => includedCodes.has(e.game_code)), names, { unset: t.goalies.unset, unknown: t.goalies.unknown }) : []),
    [data, includedCodes, names],
  );
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
          disabled={!data || !season}
          onClick={() => {
            // The file follows the view: the games of the chosen competition that are ticked, nothing else.
            if (!data || !season) return;
            const inView = data.events.filter((e) => includedCodes.has(e.game_code));
            downloadCsv(`saison-${competition === 'all' ? 'toutes' : competition}.csv`, eventsToCsv(inView, season.rows.map((r) => r.game), names));
          }}
        >
          {t.report.exportCsv}
        </button>
      </header>

      {data && (
        <div className="seg" role="group" aria-label={t.season.competitionFilter}>
          {COMPETITION_FILTERS.map((c) => (
            <button key={c} type="button" aria-pressed={competition === c} onClick={() => setCompetition(c)}>
              {competitionLabel(c)}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="notice" role="alert">
          {t.errors.server}
        </p>
      )}
      {!season && !error && <p className="muted">{t.errors.loading}</p>}
      {season && data && season.rows.length === 0 && (
        <p className="muted">{data.games.length === 0 ? t.season.empty : t.season.emptyCompetition}</p>
      )}

      {season && data && season.rows.length > 0 && (
        <>
          <section className="card stack">
            <h2>{t.season.selection}</h2>
            <p className="muted">{t.season.selectionHint}</p>
            <div className="checks">
              {season.rows.map(({ game, included, empty }) => (
                <label key={game.code}>
                  <input type="checkbox" checked={included} disabled={empty} onChange={() => toggle(game.code)} />
                  {`${formatDate(game.game_date)} ${game.opponent}`}
                </label>
              ))}
            </div>
          </section>

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
            <h2>{t.season.goalies}</h2>
            <GoalieTable lines={goalieLines} label={t.season.goalies} showGames />
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
                    <th>{t.season.competition}</th>
                    <th>{t.season.score}</th>
                    <th>{t.season.sogFor}</th>
                    <th>{t.season.sogAgainst}</th>
                    <th>{t.season.savePct}</th>
                    <th>{t.season.faceoffPct}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {season.rows.map(({ game, stats, included }) => (
                    <tr key={game.code} className={included ? undefined : 'muted'}>
                      <td>{game.opponent}</td>
                      <td>{formatDate(game.game_date)}</td>
                      <td>{t.venuesShort[game.venue]}</td>
                      <td>{t.competitions[game.competition]}</td>
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
            <Rink
              attackRight
              leftLabel={t.report.us}
              rightLabel={t.report.them}
              markers={filterShotMarkers(data.events.filter((e) => includedCodes.has(e.game_code)), 'all', side)}
            />
            <Legend results={SHOT_RESULTS} />
          </section>
        </>
      )}
    </main>
  );
}
