import { useEffect, useState, type FormEvent } from 'react';
import { makeGoalieState } from '../domain/factory';
import type { Competition, Game, SheetSide, Venue } from '../domain/types';
import { useBackgroundSync, usePendingTotal, useSync } from '../events/SyncContext';
import { isValidCode, normalizeCode } from '../games/code';
import { useGoalies } from '../goalies/useGoalies';
import { t } from '../i18n/fr';
import { href, navigate } from '../router';
import { loadTeamName, saveTeamName, todayIso } from '../settings';
import { formatDate } from '../stats/format';
import { SyncChip } from '../ui/SyncChip';
import { GoalieRoster } from './GoalieRoster';

const COMPETITIONS: Competition[] = ['championnat', 'coupe', 'playoffs'];
const VENUES: Venue[] = ['home', 'away', 'neutral'];
const SHEET_SIDES: SheetSide[] = ['home', 'visitor'];
const EMPTY_NET = '__empty__';
/** Extra time and shootouts exist in the league and the cup, and only in the finals of the playoffs (ticked by hand). */
const overtimeByDefault = (c: Competition) => c !== 'playoffs';

type Tab = 'games' | 'goalies';

export function Home() {
  const { games, store } = useSync();
  const roster = useGoalies();
  const [tab, setTab] = useState<Tab>('games');
  const [team, setTeam] = useState(loadTeamName);
  const [opponent, setOpponent] = useState('');
  const [date, setDate] = useState(todayIso);
  const [competition, setCompetition] = useState<Competition>('championnat');
  const [venue, setVenue] = useState<Venue>('home');
  const [sheetSide, setSheetSide] = useState<SheetSide>('home');
  const [overtime, setOvertime] = useState(true);
  const [startGoalie, setStartGoalie] = useState('');
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

  function pickCompetition(c: Competition) {
    setCompetition(c);
    setOvertime(overtimeByDefault(c));
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!team.trim() || !opponent.trim()) return;
    setBusy(true);
    setError(null);
    try {
      saveTeamName(team.trim());
      const game = await games.create({
        team_name: team.trim(),
        opponent: opponent.trim(),
        game_date: date,
        home: venue === 'home',
        venue,
        competition,
        sheet_side: venue === 'neutral' ? sheetSide : null,
        overtime_possible: overtime,
      });
      // The game exists from here on: always show its code, even if the starting goalie cannot be recorded.
      setCreated(game);
      if (startGoalie) {
        try {
          await store.add(makeGoalieState({ code: game.code, period: 1, role: 'all' }, startGoalie === EMPTY_NET ? null : startGoalie));
          void bg.run();
        } catch {
          setError(t.home.startGoalieFailed);
        }
      }
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
      <div className="seg" role="group" aria-label={t.home.tabs}>
        <button type="button" aria-pressed={tab === 'games'} onClick={() => setTab('games')}>
          {t.home.tabGames}
        </button>
        <button type="button" aria-pressed={tab === 'goalies'} onClick={() => setTab('goalies')}>
          {t.home.tabGoalies}
        </button>
      </div>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {tab === 'goalies' ? (
        <GoalieRoster roster={roster} />
      ) : (
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
                <div className="seg" role="group" aria-label={t.home.competition}>
                  {COMPETITIONS.map((c) => (
                    <button key={c} type="button" aria-pressed={competition === c} onClick={() => pickCompetition(c)}>
                      {t.competitions[c]}
                    </button>
                  ))}
                </div>
                <div className="seg" role="group" aria-label={t.home.venue}>
                  {VENUES.map((v) => (
                    <button key={v} type="button" aria-pressed={venue === v} onClick={() => setVenue(v)}>
                      {t.venues[v]}
                    </button>
                  ))}
                </div>
                {venue === 'neutral' && (
                  <div className="stack">
                    <span className="muted">{t.home.sheetSide}</span>
                    <div className="seg" role="group" aria-label={t.home.sheetSide}>
                      {SHEET_SIDES.map((s) => (
                        <button key={s} type="button" aria-pressed={sheetSide === s} onClick={() => setSheetSide(s)}>
                          {t.sheetSides[s]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <label className="row">
                  <input type="checkbox" checked={overtime} onChange={(e) => setOvertime(e.target.checked)} />
                  {t.home.overtimePossible}
                </label>
                <label className="field">
                  {t.home.startGoalie}
                  <select className="input" value={startGoalie} onChange={(e) => setStartGoalie(e.target.value)}>
                    <option value="">{t.home.startGoalieLater}</option>
                    {roster.goalies.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                    <option value={EMPTY_NET}>{t.home.startGoalieEmpty}</option>
                  </select>
                </label>
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
                        {formatDate(g.game_date)} · {t.competitions[g.competition]} · {t.venuesShort[g.venue]} · {g.code}
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
      )}
    </main>
  );
}
