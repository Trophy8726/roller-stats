import type { Strength } from '../../domain/types';
import { t } from '../../i18n/fr';
import type { GameStats } from '../../stats/game';

const ORDER: Strength[] = ['even', 'pp', 'pk'];

export function StrengthTable({ stats }: { stats: GameStats }) {
  const c = t.report.strengthCols;
  const heads = [c.attempts, c.onGoal, c.goals];
  return (
    <div className="table-wrap">
      <table className="table" aria-label={t.report.strengthTitle}>
        <thead>
          <tr>
            <th />
            <th colSpan={3}>{t.report.us}</th>
            <th colSpan={3}>{t.report.them}</th>
          </tr>
          <tr>
            <th>{c.situation}</th>
            {[...heads, ...heads].map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ORDER.map((s) => {
            const { shotsFor: f, shotsAgainst: a } = stats.byStrength[s];
            return (
              <tr key={s}>
                <th scope="row">{t.strength[s]}</th>
                <td>{f.attempts}</td>
                <td>{f.onGoal}</td>
                <td>{f.goals}</td>
                <td>{a.attempts}</td>
                <td>{a.onGoal}</td>
                <td>{a.goals}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
