import type { GameEvent } from '../../domain/types';
import { t } from '../../i18n/fr';
import type { GameStats } from '../../stats/game';
import { describeEvent } from '../record/describe';

const time = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const fmt = (s: { goals: number; attempts: number }) => `${s.goals}/${s.attempts}`;

/** CSC, shootouts, penalty shots and notes: nothing is shown when the game had none. */
export function ExtrasCard({ stats, events, names }: { stats: GameStats; events: GameEvent[]; names: ReadonlyMap<string, string> }) {
  const live = events.filter((e) => !e.deleted_at);
  const penalties = live.filter((e) => e.penalty_shot);
  const notes = live.filter((e) => e.kind === 'note');
  const ownGoals = stats.ownGoals.for + stats.ownGoals.against;
  if (!stats.shootout && penalties.length === 0 && notes.length === 0 && ownGoals === 0) return null;
  return (
    <section className="card stack">
      <h2>{t.report.extrasTitle}</h2>
      {ownGoals > 0 && <p>{t.report.ownGoalsLine(stats.ownGoals.for, stats.ownGoals.against)}</p>}
      {stats.shootout && (
        <>
          <h2>{t.report.shootoutTitle}</h2>
          <p>{t.report.shootoutLine(fmt(stats.shootout.us), fmt(stats.shootout.them))}</p>
        </>
      )}
      {penalties.length > 0 && (
        <>
          <h2>{t.report.penaltiesTitle}</h2>
          <ul className="list">
            {penalties.map((e) => (
              <li key={e.id}>{describeEvent(e, names)}</li>
            ))}
          </ul>
        </>
      )}
      {notes.length > 0 && (
        <>
          <h2>{t.report.notesTitle}</h2>
          <ul className="list">
            {notes.map((e) => (
              <li key={e.id}>{`${t.record.period(e.period)} · ${time(e.recorded_at)} — ${e.note ?? ''}`}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
