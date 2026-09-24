import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { GameEvent } from '../domain/types';
import { shotEv } from '../test/builders';
import { makeDeps } from '../test/fakes';
import { SyncProvider } from './SyncContext';
import { useGameEvents } from './useGameEvents';

function setup() {
  const { deps, fr } = makeDeps();
  const wrapper = ({ children }: { children: ReactNode }) => <SyncProvider deps={deps}>{children}</SyncProvider>;
  const hook = renderHook(() => useGameEvents('AB23'), { wrapper });
  return { fr, ...hook };
}

describe('useGameEvents', () => {
  it('records locally, then syncs to the server', async () => {
    const { result, fr } = setup();
    act(() => result.current.record(shotEv('shot_for', 'goal')));
    await waitFor(() => expect(result.current.events).toHaveLength(1));
    await waitFor(() => expect(result.current.pending).toBe(0));
    expect(fr.rows.size).toBe(1);
  });

  it('keeps events pending offline and flushes when the browser is back online', async () => {
    const { result, fr } = setup();
    await waitFor(() => expect(result.current.connected).toBe(true));
    fr.setOnline(false);
    act(() => result.current.record(shotEv('shot_for', 'goal')));
    await waitFor(() => expect(result.current.pending).toBe(1));
    fr.setOnline(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(result.current.pending).toBe(0));
    expect(fr.rows.size).toBe(1);
  });

  it('shows events recorded on other devices', async () => {
    const { result, fr } = setup();
    await waitFor(() => expect(result.current.connected).toBe(true));
    act(() => fr.emit(shotEv('shot_against', 'save')));
    await waitFor(() => expect(result.current.events).toHaveLength(1));
    expect(result.current.events[0].mine).toBe(false);
  });

  it('applies an undo made on another device', async () => {
    const { result, fr } = setup();
    const e = shotEv('shot_for', 'goal');
    act(() => result.current.record(e));
    await waitFor(() => expect(result.current.pending).toBe(0));
    act(() => fr.emit({ ...e, deleted_at: '2026-09-24T19:00:00.000Z' }));
    await waitFor(() => expect(result.current.events[0].deleted_at).toBe('2026-09-24T19:00:00.000Z'));
  });

  it('sends a local undo to the server', async () => {
    const { result, fr } = setup();
    const e = shotEv('shot_for', 'goal');
    act(() => result.current.record(e));
    await waitFor(() => expect(result.current.pending).toBe(0));
    act(() => result.current.remove(e.id));
    await waitFor(() => expect(fr.rows.get(e.id)?.deleted_at).not.toBeNull());
  });

  it('ignores a stale fetch for the previous code after switching games', async () => {
    const { deps, fr } = makeDeps();
    let resolveStale!: (rows: GameEvent[]) => void;
    const stale = new Promise<GameEvent[]>((resolve) => {
      resolveStale = resolve;
    });
    const originalFetchEvents = fr.remote.fetchEvents.bind(fr.remote);
    fr.remote.fetchEvents = (code: string) => (code === 'AB23' ? stale : originalFetchEvents(code));

    const wrapper = ({ children }: { children: ReactNode }) => <SyncProvider deps={deps}>{children}</SyncProvider>;
    const { result, rerender } = renderHook(({ code }) => useGameEvents(code), {
      wrapper,
      initialProps: { code: 'AB23' },
    });

    rerender({ code: 'CD45' });
    await waitFor(() => expect(result.current.connected).toBe(true));

    resolveStale([shotEv('shot_for', 'goal', { id: 'stale-ab23' })]);
    // The merge always writes to local storage for AB23, whether or not the
    // hook (now watching CD45) is still allowed to display it. Waiting on
    // this write is a deterministic signal that the guarded setEvents call
    // has already run (or been skipped), so the assertion below isn't racing it.
    await waitFor(async () => expect(await deps.store.load('AB23')).toHaveLength(1));

    expect(result.current.events.every((e) => e.game_code !== 'AB23')).toBe(true);
  });
});
