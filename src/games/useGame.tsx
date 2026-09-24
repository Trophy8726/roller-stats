import { useEffect, useState, type ReactNode } from 'react';
import type { Game } from '../domain/types';
import { useSync } from '../events/SyncContext';
import { t } from '../i18n/fr';
import { loadCachedGame, saveCachedGame } from '../settings';

export type GameState = { status: 'loading' } | { status: 'missing' } | { status: 'error' } | { status: 'ok'; game: Game };

export function useGame(code: string): GameState {
  const { games } = useSync();
  const [state, setState] = useState<GameState>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    games
      .get(code)
      .then((g) => {
        if (!alive) return;
        if (g) saveCachedGame(g);
        setState(g ? { status: 'ok', game: g } : { status: 'missing' });
      })
      .catch(() => {
        if (!alive) return;
        const cached = loadCachedGame(code);
        setState(cached ? { status: 'ok', game: cached } : { status: 'error' });
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
