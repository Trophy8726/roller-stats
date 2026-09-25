import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SyncProvider } from '../events/SyncContext';
import { saveCachedGame } from '../settings';
import { gameFx } from '../test/builders';
import { makeDeps } from '../test/fakes';
import { useGame } from './useGame';

function run(code: string, setupDeps: (d: ReturnType<typeof makeDeps>) => void = () => {}) {
  const d = makeDeps({ games: [gameFx()] });
  setupDeps(d);
  const wrapper = ({ children }: { children: ReactNode }) => <SyncProvider deps={d.deps}>{children}</SyncProvider>;
  return renderHook(() => useGame(code), { wrapper });
}

describe('useGame', () => {
  beforeEach(() => localStorage.clear());
  it('loads a known game', async () => {
    const { result } = run('AB23');
    await waitFor(() => expect(result.current).toEqual({ status: 'ok', game: gameFx() }));
  });
  it('reports an unknown code', async () => {
    const { result } = run('ZZZZ');
    await waitFor(() => expect(result.current.status).toBe('missing'));
  });
  it('reports a server error when nothing is cached', async () => {
    const { result } = run('AB23', (d) => d.fg.setFailing(true));
    await waitFor(() => expect(result.current.status).toBe('error'));
  });
  it('falls back to the cached game when offline (tablet reloaded mid-game)', async () => {
    saveCachedGame(gameFx());
    const { result } = run('AB23', (d) => d.fg.setFailing(true));
    await waitFor(() => expect(result.current).toEqual({ status: 'ok', game: gameFx() }));
  });
  it('shows the cached game at once and refreshes it in the background', async () => {
    saveCachedGame(gameFx({ opponent: 'Ancien nom' }));
    const { result } = run('AB23');
    expect(result.current).toEqual({ status: 'ok', game: gameFx({ opponent: 'Ancien nom' }) });
    await waitFor(() => expect(result.current).toEqual({ status: 'ok', game: gameFx() }));
  });
});
