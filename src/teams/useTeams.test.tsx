import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SyncProvider } from '../events/SyncContext';
import { makeDeps } from '../test/fakes';
import type { Team } from './api';
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

  it('ignores a stale list that resolves after the club changed', async () => {
    const d = makeDeps({ teams: [{ id: 't-a', club_id: 'club-a', name: 'A1', archived_at: null }, { id: 't-b', club_id: 'club-b', name: 'B1', archived_at: null }] });
    const realList = d.ft.api.list;
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    d.ft.api.list = async (clubId) => {
      if (clubId === 'club-a') await gate;
      return realList(clubId);
    };
    const wrapper = ({ children }: { children: ReactNode }) => <SyncProvider deps={d.deps}>{children}</SyncProvider>;
    const { result, rerender } = renderHook(({ id }: { id: string }) => useTeams(id), { wrapper, initialProps: { id: 'club-a' } });
    rerender({ id: 'club-b' });
    await waitFor(() => expect(result.current.teams.map((x: Team) => x.name)).toEqual(['B1']));
    await act(async () => {
      release();
      await gate;
    });
    expect(result.current.teams.map((x: Team) => x.name)).toEqual(['B1']);
  });

  it('is not loading without a club', async () => {
    const d = makeDeps();
    const wrapper = ({ children }: { children: ReactNode }) => <SyncProvider deps={d.deps}>{children}</SyncProvider>;
    const { result } = renderHook(() => useTeams(undefined), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.teams).toEqual([]);
  });
});
