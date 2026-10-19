import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SyncProvider } from '../events/SyncContext';
import { makeDeps } from '../test/fakes';
import { DuplicateTeamError } from './api';
import { useTeams } from './useTeams';

function setup() {
  const d = makeDeps();
  const wrapper = ({ children }: { children: ReactNode }) => <SyncProvider deps={d.deps}>{children}</SyncProvider>;
  return { d, ...renderHook(() => useTeams('club-1'), { wrapper }) };
}

describe('useTeams', () => {
  it('lists the active teams and adds one', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.active.map((x) => x.name)).toEqual(['N2']));
    await act(async () => {
      await result.current.add('U17');
    });
    expect(result.current.active.map((x) => x.name)).toEqual(['N2', 'U17']);
  });

  it('hides archived teams from the active list', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.setArchived('team-1', true);
    });
    expect(result.current.active).toEqual([]);
    expect(result.current.teams).toHaveLength(1);
  });

  it('refuses a duplicate name', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await expect(result.current.add(' n2 ')).rejects.toBeInstanceOf(DuplicateTeamError);
  });
});
