import { useClub } from '../clubs/ClubContext';
import { t } from '../i18n/fr';

/** The current club; a selector only when the account belongs to several clubs. */
export function ClubSwitcher() {
  const { memberships, current, select } = useClub();
  if (!current) return null;
  if (memberships.length < 2) return <span className="chip">{current.clubName}</span>;
  return (
    <select className="input" aria-label={t.clubs.switch} value={current.clubId} onChange={(e) => select(e.target.value)}>
      {memberships.map((m) => (
        <option key={m.clubId} value={m.clubId}>
          {m.clubName}
        </option>
      ))}
    </select>
  );
}
