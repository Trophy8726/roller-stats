import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSync } from '../events/SyncContext';
import { byTeamName, type Team } from './api';

export interface TeamsState {
  teams: Team[];
  /** Not archived: the ones offered when creating a game. */
  active: Team[];
  loading: boolean;
  error: boolean;
  reload(): Promise<void>;
  add(name: string): Promise<Team>;
  rename(id: string, name: string): Promise<Team>;
  setArchived(id: string, archived: boolean): Promise<Team>;
}

export function useTeams(clubId: string | undefined): TeamsState {
  const { teams: api } = useSync();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const listRef = useRef<Team[]>([]);
  const alive = useRef(true);

  const remember = useCallback((list: Team[]) => {
    listRef.current = list;
    setTeams(list);
  }, []);

  const reload = useCallback(async () => {
    if (!clubId) return;
    try {
      const list = await api.list(clubId);
      if (!alive.current) return;
      remember(list);
      setError(false);
    } catch {
      if (alive.current) setError(true);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [api, clubId, remember]);

  useEffect(() => {
    alive.current = true;
    remember([]);
    setLoading(true);
    void reload();
    return () => {
      alive.current = false;
    };
  }, [reload, remember]);

  const replace = useCallback((x: Team) => remember(listRef.current.map((y) => (y.id === x.id ? x : y)).sort(byTeamName)), [remember]);

  const add = useCallback(
    async (name: string) => {
      if (!clubId) throw new Error('no club');
      const x = await api.add(clubId, name);
      if (alive.current) remember([...listRef.current, x].sort(byTeamName));
      return x;
    },
    [api, clubId, remember],
  );
  const rename = useCallback(
    async (id: string, name: string) => {
      const x = await api.rename(id, name);
      if (alive.current) replace(x);
      return x;
    },
    [api, replace],
  );
  const setArchived = useCallback(
    async (id: string, archived: boolean) => {
      const x = await api.setArchived(id, archived);
      if (alive.current) replace(x);
      return x;
    },
    [api, replace],
  );

  const active = useMemo(() => teams.filter((x) => !x.archived_at), [teams]);
  return { teams, active, loading, error, reload, add, rename, setArchived };
}
