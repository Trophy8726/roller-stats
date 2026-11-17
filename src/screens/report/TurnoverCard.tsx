import { useState } from 'react';
import { TURNOVER_RESULTS, type GameEvent, type MarkResult } from '../../domain/types';
import { t } from '../../i18n/fr';
import { Legend } from '../../rink/Legend';
import { filterTurnoverMarkers, type PeriodFilter, type TurnoverFilter } from '../../rink/markers';
import { Rink } from '../../rink/Rink';

const FILTERS: TurnoverFilter[] = ['both', 'lost', 'recovered'];
const filterLabel = (f: TurnoverFilter) => (f === 'both' ? t.report.both : f === 'lost' ? t.report.lost : t.report.recovered);

/** Where the puck was lost and recovered. `periods`: the period filter buttons, or null for none (season). */
export function TurnoverCard({ events, title, leftLabel, rightLabel, periods }: {
  events: GameEvent[];
  title: string;
  leftLabel: string;
  rightLabel: string;
  periods: PeriodFilter[] | null;
}) {
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [which, setWhich] = useState<TurnoverFilter>('both');
  const markers = filterTurnoverMarkers(events, periods ? period : 'all', which);
  const counts: Partial<Record<MarkResult, number>> = { lost: 0, recovered: 0 };
  for (const m of markers) counts[m.result] = (counts[m.result] ?? 0) + 1;
  const periodText = period === 'all' ? t.report.allPeriods : t.record.period(period);

  return (
    <section className="card stack">
      <div className="row">
        <h2>{title}</h2>
        <span className="topbar__spacer" />
        {periods && (
          <div className="seg no-print" role="group" aria-label={t.record.periodLabel}>
            {periods.map((p) => (
              <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)}>
                {p === 'all' ? t.report.allPeriods : t.record.period(p)}
              </button>
            ))}
          </div>
        )}
        <div className="seg no-print" role="group" aria-label={title}>
          {FILTERS.map((f) => (
            <button key={f} type="button" aria-pressed={which === f} onClick={() => setWhich(f)}>
              {filterLabel(f)}
            </button>
          ))}
        </div>
      </div>
      {/* The filter buttons are hidden on paper: say which filter the printed map shows. */}
      {((periods && period !== 'all') || which !== 'both') && (
        <p className="print-only">{t.report.mapFilterCaption(periodText, filterLabel(which))}</p>
      )}
      <Rink attackRight leftLabel={leftLabel} rightLabel={rightLabel} markers={markers} />
      {/* Only the results in view: a filtered-out result shown as 0 would be wrong on a printed report. */}
      <Legend results={which === 'both' ? TURNOVER_RESULTS : [which]} counts={counts} />
    </section>
  );
}
