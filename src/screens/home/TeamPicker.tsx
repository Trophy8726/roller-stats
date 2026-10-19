import { useEffect, useState } from 'react';
import { t } from '../../i18n/fr';
import { loadLastTeam } from '../../settings';
import { DuplicateTeamError, type Team } from '../../teams/api';
import { useTeams } from '../../teams/useTeams';

const NEW_TEAM = '__new__';

/** « Notre équipe »: the club's active teams, the last one used preselected, and « + Nouvelle équipe… ». */
export function TeamPicker({ clubId, value, onChange }: { clubId: string; value: Team | null; onChange: (team: Team | null) => void }) {
  const { active, loading, add } = useTeams(clubId);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Keep the selection valid: the remembered team may have been archived since.
  useEffect(() => {
    if (loading || (value && active.some((x) => x.id === value.id))) return;
    const remembered = active.find((x) => x.id === loadLastTeam(clubId));
    onChange(remembered ?? active[0] ?? null);
  }, [loading, active, value, clubId, onChange]);

  async function addTeam() {
    if (busy || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const team = await add(name);
      onChange(team);
      setAdding(false);
      setName('');
    } catch (e) {
      setError(e instanceof DuplicateTeamError ? t.home.teamDuplicate : t.errors.server);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <label className="field">
        {t.home.team}
        <select
          className="input"
          value={adding ? NEW_TEAM : (value?.id ?? '')}
          onChange={(e) => {
            if (e.target.value === NEW_TEAM) {
              setAdding(true);
              return;
            }
            setAdding(false);
            onChange(active.find((x) => x.id === e.target.value) ?? null);
          }}
        >
          {!loading && active.length === 0 && <option value="">{t.home.noTeam}</option>}
          {active.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
          <option value={NEW_TEAM}>{t.home.newTeam}</option>
        </select>
      </label>
      {adding && (
        <div className="row">
          <input
            className="input"
            aria-label={t.home.newTeamName}
            value={name}
            maxLength={60}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
          />
          <button type="button" className="btn" disabled={busy || !name.trim()} onClick={() => void addTeam()}>
            {t.home.addTeam}
          </button>
        </div>
      )}
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
