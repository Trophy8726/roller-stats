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
