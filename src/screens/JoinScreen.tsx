import { useEffect, useState } from 'react';
import { InvalidInviteError } from '../clubs/api';
import { useClub } from '../clubs/ClubContext';
import { useSync } from '../events/SyncContext';
import { t } from '../i18n/fr';
import { navigate } from '../router';

type State = { status: 'loading' } | { status: 'invalid' } | { status: 'error' } | { status: 'ready'; clubId: string; clubName: string };

export function JoinScreen({ token }: { token: string }) {
  const { clubs } = useSync();
  const club = useClub();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    clubs
      .inviteInfo(token)
      .then((info) => {
        if (alive) setState(info ? { status: 'ready', ...info } : { status: 'invalid' });
      })
      .catch(() => {
        if (alive) setState({ status: 'error' });
      });
    return () => {
      alive = false;
    };
  }, [clubs, token]);

  function open(clubId: string) {
    club.select(clubId);
    navigate({ name: 'home' });
  }

  async function join() {
    if (state.status !== 'ready' || busy) return;
    setBusy(true);
    try {
      const id = await clubs.join(token);
      await club.reload();
      open(id);
    } catch (e) {
      setState(e instanceof InvalidInviteError ? { status: 'invalid' } : { status: 'error' });
      setBusy(false);
    }
  }

  const already = state.status === 'ready' && club.memberships.some((m) => m.clubId === state.clubId);

  return (
    <main className="page">
      <header className="topbar">
        <h1>{t.join.title}</h1>
      </header>
      <section className="card stack">
        {state.status === 'loading' && <p className="muted">{t.errors.loading}</p>}
        {state.status === 'invalid' && (
          <p className="notice" role="alert">
            {t.join.invalid}
          </p>
        )}
        {state.status === 'error' && (
          <p className="notice" role="alert">
            {t.errors.server}
          </p>
        )}
        {state.status === 'ready' && already && (
          <>
            <p>{t.join.already(state.clubName)}</p>
            <button type="button" className="btn btn--primary" onClick={() => open(state.clubId)}>
              {t.join.open}
            </button>
          </>
        )}
        {state.status === 'ready' && !already && (
          <>
            <h2>{t.join.question(state.clubName)}</h2>
            <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void join()}>
              {t.join.confirm}
            </button>
          </>
        )}
        {state.status !== 'ready' && state.status !== 'loading' && (
          <a className="btn" href="#/">
            {t.nav.home}
          </a>
        )}
      </section>
    </main>
  );
}
