import { t } from '../../i18n/fr';
import { formatPct } from '../../stats/format';
import type { GoalieLine } from '../../stats/goalies';

/** One line per goalie. Empty-net shots and CSC are already left out of the save % by `computeGoalieStats`. */
export function GoalieTable({ lines, label, showGames = false }: { lines: GoalieLine[]; label: string; showGames?: boolean }) {
  const c = t.report.goalieCols;
  if (lines.length === 0) return <p className="muted">{t.report.noGoalieLines}</p>;
  return (
    <div className="table-wrap">
      <table className="table" aria-label={label}>
        <thead>
          <tr>
            <th>{c.name}</th>
            {showGames && <th>{c.games}</th>}
            <th>{c.onGoal}</th>
            <th>{c.saves}</th>
            <th>{c.goalsAgainst}</th>
            <th>{c.savePct}</th>
            <th>{c.ownGoals}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.goalieId ?? 'unset'} className={l.goalieId === null ? 'muted' : undefined}>
              <th scope="row">{l.name}</th>
              {showGames && <td>{l.games}</td>}
              <td>{l.onGoal}</td>
              <td>{l.saves}</td>
              <td>{l.goalsAgainst}</td>
              <td>{formatPct(l.savePct)}</td>
              <td>{l.ownGoals}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
