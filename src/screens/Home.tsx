import { useEffect, useState, type FormEvent } from 'react';
import type { Game } from '../domain/types';
import { useBackgroundSync, usePendingTotal, useSync } from '../events/SyncContext';
import { isValidCode, normalizeCode } from '../games/code';
import { t } from '../i18n/fr';
import { href, navigate } from '../router';
import { loadTeamName, saveTeamName, todayIso } from '../settings';
import { formatDate } from '../stats/format';
import { SyncChip } from '../ui/SyncChip';

export function Home() {
  const { games } = useSync();
  const [team, setTeam] = useState(loadTeamName);
  const [opponent, setOpponent] = useState('');
  const [date, setDate] = useState(todayIso);
  const [home, setHome] = useState(true);
  const [created, setCreated] = useState<Game | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<Game[]>([]);
  const bg = useBackgroundSync();
  const pending = usePendingTotal();

  useEffect(() => {
    games.list().then(setRecent).catch(() => setError(t.errors.server));
  }, [games]);

  // Coming back from a game: refresh the backlog count (and try to send it) right away.
  useEffect(() => {
    void bg.run();
  }, [bg]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!team.trim() || !opponent.trim()) return;
    setBusy(true);
    setError(null);
    try {
      saveTeamName(team.trim());
      setCreated(await games.create({ team_name: team.trim(), opponent: opponent.trim(), game_date: date, home }));
    } catch {
      setError(t.errors.server);
    } finally {
      setBusy(false);
    }
  }

  async function onJoin(e: FormEvent) {
    e.preventDefault();
    const code = normalizeCode(joinCode);
    if (!isValidCode(code)) {
      setError(t.errors.badCode);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const g = await games.get(code);
      if (g) navigate({ name: 'record', code });
      else setError(t.errors.unknownCode);
    } catch {
      setError(t.errors.server);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <header className="topbar">
        <h1>{t.appName}</h1>
        <span className="topbar__spacer" />
        {pending > 0 && <SyncChip pending={pending} connected={false} />}
        <a className="btn" href={href({ name: 'season' })}>
          {t.nav.season}
        </a>
      </header>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      <div className="grid">
        <section className="card stack">
          <h2>{t.home.newGame}</h2>
          {created ? (
            <div className="card card--dark stack">
              <span className="muted">{t.home.codeTitle}</span>
              <span className="code-display">{created.code}</span>
              <span className="muted">{t.home.codeHint}</span>
              <div className="row">
                <a className="btn" href={href({ name: 'record', code: created.code })}>
                  {t.home.startRecording}
                </a>
              </div>
            </div>
          ) : (
            <form className="stack" onSubmit={onCreate}>
              <label className="field">
                {t.home.team}
                <input className="input" value={team} onChange={(e) => setTeam(e.target.value)} required maxLength={60} />
              </label>
              <label className="field">
                {t.home.opponent}
                <input className="input" value={opponent} onChange={(e) => setOpponent(e.target.value)} required maxLength={60} />
              </label>
              <label className="field">
                {t.home.date}
                <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </label>
              <div className="seg" role="group" aria-label={t.home.venue}>
                <button type="button" aria-pressed={home} onClick={() => setHome(true)}>
                  {t.home.homeGame}
                </button>
                <button type="button" aria-pressed={!home} onClick={() => setHome(false)}>
                  {t.home.awayGame}
                </button>
              </div>
              <button className="btn btn--primary" type="submit" disabled={busy}>
                {t.home.create}
              </button>
            </form>
          )}
        </section>
        <section className="card stack">
          <h2>{t.home.join}</h2>
          <form className="stack" onSubmit={onJoin}>
            <label className="field">
              {t.home.codeLabel}
              <input
                className="input input--code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                autoCapitalize="characters"
                autoComplete="off"
                placeholder="K7QX"
              />
            </label>
            <button className="btn btn--primary" type="submit" disabled={busy}>
              {t.home.joinButton}
            </button>
          </form>
        </section>
        <section className="card stack">
          <h2>{t.home.recent}</h2>
          {recent.length === 0 ? (
            <p className="muted">{t.home.noGames}</p>
          ) : (
            <ul className="list">
              {recent.slice(0, 8).map((g) => (
                <li key={g.code}>
                  <span>
                    <strong>{g.opponent}</strong>{' '}
                    <span className="muted">
                      {formatDate(g.game_date)} · {g.code}
                    </span>
                  </span>
                  <span className="row">
                    <a className="btn" href={href({ name: 'record', code: g.code })}>
                      {t.nav.record}
                    </a>
                    <a className="btn" href={href({ name: 'report', code: g.code })}>
                      {t.nav.report}
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
