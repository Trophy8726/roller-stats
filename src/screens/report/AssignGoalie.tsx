import { useState } from 'react';
import type { Goalie } from '../../domain/types';
import { useSync } from '../../events/SyncContext';
import { t } from '../../i18n/fr';

interface Props {
  code: string;
  /** Entries against us with no goalie (not on an empty net). */
  unassigned: number;
  /** Entries of this game still waiting to be sent from this device. */
  pending: number;
  goalies: Goalie[];
  /** How many entries the last assignment filled (null: none done yet). */
  assignedCount: number | null;
  onAssigned: (n: number) => void;
  /** Re-fetch the game's events so the report shows the new goalie. */
  onDone: () => Promise<void>;
}

/** "Attribuer un gardien": fills the missing goalie on this game's entries. The database only allows filling, never replacing. */
export function AssignGoalie({ code, unassigned, pending, goalies, assignedCount, onAssigned, onDone }: Props) {
  const { remote } = useSync();
  const [goalieId, setGoalieId] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const blocked = pending > 0 ? t.report.assignPending : goalies.length === 0 ? t.report.assignNoGoalie : null;

  async function assign() {
    if (!goalieId) return;
    setBusy(true);
    setFailed(false);
    try {
      onAssigned(await remote.assignGoalie(code, goalieId));
      await onDone();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card stack no-print">
      <h2>{t.report.assignTitle}</h2>
      {unassigned > 0 && <p className="muted">{t.report.assignHint(unassigned)}</p>}
      {assignedCount !== null && <p role="status">{t.report.assignDone(assignedCount)}</p>}
      {failed && (
        <p className="notice" role="alert">
          {t.errors.server}
        </p>
      )}
      {unassigned > 0 &&
        (blocked ? (
          <p className="muted">{blocked}</p>
        ) : (
          <div className="row">
            <label className="field">
              {t.report.assignChoose}
              <select className="input" value={goalieId} onChange={(e) => setGoalieId(e.target.value)}>
                <option value="">{t.misc.goalieChoose}</option>
                {goalies.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn btn--primary" disabled={!goalieId || busy} onClick={() => void assign()}>
              {t.report.assignButton}
            </button>
          </div>
        ))}
    </section>
  );
}
