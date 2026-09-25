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
