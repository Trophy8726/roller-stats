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
