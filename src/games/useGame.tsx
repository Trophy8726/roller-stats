import { useEffect, useState, type ReactNode } from 'react';
import type { Game } from '../domain/types';
import { useSync } from '../events/SyncContext';
import { t } from '../i18n/fr';
import { loadCachedGame, saveCachedGame } from '../settings';

export type GameState = { status: 'loading' } | { status: 'missing' } | { status: 'error' } | { status: 'ok'; game: Game };

const initialState = (code: string): GameState => {
  const cached = loadCachedGame(code);
  return cached ? { status: 'ok', game: cached } : { status: 'loading' };
};

/** Cache first: a game already seen on this device renders at once; the server copy refreshes it in the background. */
export function useGame(code: string): GameState {
  const { games } = useSync();
  const [state, setState] = useState<GameState>(() => initialState(code));
  const [stateCode, setStateCode] = useState(code);
  if (stateCode !== code) {
    setStateCode(code);
    setState(initialState(code));
  }
  useEffect(() => {
    let alive = true;
    games
      .get(code)
      .then((g) => {
        if (!alive) return;
        if (g) {
          saveCachedGame(g);
          setState({ status: 'ok', game: g });
        } else if (!loadCachedGame(code)) {
          setState({ status: 'missing' });
        }
      })
      .catch(() => {
        if (!alive) return;
        if (!loadCachedGame(code)) setState({ status: 'error' });
      });
    return () => {
      alive = false;
    };
  }, [games, code]);
  return state;
}

export function GameGate({ code, children }: { code: string; children: (g: Game) => ReactNode }) {
  const s = useGame(code);
  if (s.status === 'ok') return <>{children(s.game)}</>;
  return (
    <main className="page">
      {s.status === 'loading' && <p className="muted">{t.errors.loading}</p>}
      {s.status === 'missing' && <p className="notice" role="alert">{t.errors.unknownCode}</p>}
      {s.status === 'error' && <p className="notice" role="alert">{t.errors.server}</p>}
      {s.status !== 'loading' && (
        <div className="row">
          <a className="btn" href="#/">
            {t.nav.home}
          </a>
        </div>
      )}
    </main>
  );
}
