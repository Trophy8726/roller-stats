import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SyncProvider } from '../events/SyncContext';
import { makeDeps } from '../test/fakes';
import { DuplicateGoalieError } from './api';
import { useGoalies } from './useGoalies';

function setup(goalies = [{ id: 'g1', name: 'Mallet' }]) {
  const d = makeDeps({ goalies });
  const wrapper = ({ children }: { children: ReactNode }) => <SyncProvider deps={d.deps}>{children}</SyncProvider>;
  return { ...d, ...renderHook(() => useGoalies(), { wrapper }) };
}

describe('useGoalies', () => {
  beforeEach(() => localStorage.clear());

  it('loads the roster and maps ids to names', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.goalies).toEqual([{ id: 'g1', name: 'Mallet' }]);
    expect(result.current.names.get('g1')).toBe('Mallet');
  });

  it('adds a goalie, keeps the list sorted and remembers it for offline use', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.add('Bernard');
    });
    expect(result.current.goalies.map((g) => g.name)).toEqual(['Bernard', 'Mallet']);
    expect(JSON.parse(localStorage.getItem('goalies') ?? '[]')).toHaveLength(2);
  });

  it('refuses a name already in the list, whatever the case or spacing', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await expect(result.current.add('  mallet ')).rejects.toBeInstanceOf(DuplicateGoalieError);
    });
    expect(result.current.goalies).toHaveLength(1);
  });

  it('renames a goalie in place', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.rename('g1', 'François Mallet');
    });
    expect(result.current.names.get('g1')).toBe('François Mallet');
  });

  it('falls back to the remembered roster when the server is down', async () => {
    localStorage.setItem('goalies', JSON.stringify([{ id: 'g9', name: 'Cache' }]));
    const d = makeDeps({ goalies: [] });
    d.fgo.setFailing(true);
    const wrapper = ({ children }: { children: ReactNode }) => <SyncProvider deps={d.deps}>{children}</SyncProvider>;
    const { result } = renderHook(() => useGoalies(), { wrapper });
    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.goalies).toEqual([{ id: 'g9', name: 'Cache' }]);
  });
});
