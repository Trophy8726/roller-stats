import { useState, type FormEvent } from 'react';
import { useClub } from '../clubs/ClubContext';
import { useSync } from '../events/SyncContext';
import { t } from '../i18n/fr';
import { navigate } from '../router';

export function Onboarding() {
  const { clubs } = useSync();
  const club = useClub();
  const [name, setName] = useState('');
  const [team, setTeam] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !name.trim() || !team.trim()) return;
    setBusy(true);
    setError(false);
    try {
      const id = await clubs.create(name, team);
      await club.reload();
      club.select(id);
      navigate({ name: 'home' });
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <header className="topbar">
        <h1>{t.onboarding.title}</h1>
      </header>
      {error && (
        <p className="notice" role="alert">
          {t.errors.server}
        </p>
      )}
      <div className="grid">
        <section className="card stack">
          <h2>{t.onboarding.createTitle}</h2>
          <form className="stack" onSubmit={submit}>
            <label className="field">
              {t.onboarding.clubName}
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
            </label>
            <label className="field">
              {t.onboarding.teamName}
              <input className="input" value={team} onChange={(e) => setTeam(e.target.value)} required maxLength={60} />
            </label>
            <p className="muted">{t.onboarding.teamHint}</p>
            <button className="btn btn--primary" type="submit" disabled={busy}>
              {t.onboarding.create}
            </button>
          </form>
        </section>
        <section className="card stack">
          <h2>{t.onboarding.invitedTitle}</h2>
          <p>{t.onboarding.invitedText}</p>
        </section>
      </div>
    </main>
  );
}
