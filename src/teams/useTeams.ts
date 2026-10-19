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
  /** The club the state belongs to: results for another club are dropped. */
  const club = useRef(clubId);

  const remember = useCallback((list: Team[]) => {
    listRef.current = list;
    setTeams(list);
  }, []);

  const reload = useCallback(async () => {
    if (!clubId) {
      setLoading(false);
      return;
    }
    try {
      const list = await api.list(clubId);
      if (club.current !== clubId) return;
      remember(list);
      setError(false);
    } catch {
      if (club.current === clubId) setError(true);
    } finally {
      if (club.current === clubId) setLoading(false);
    }
  }, [api, clubId, remember]);

  useEffect(() => {
    club.current = clubId;
    remember([]);
    setLoading(true);
    void reload();
    return () => {
      club.current = undefined;
    };
  }, [clubId, reload, remember]);

  const replace = useCallback((x: Team) => remember(listRef.current.map((y) => (y.id === x.id ? x : y)).sort(byTeamName)), [remember]);

  const add = useCallback(
    async (name: string) => {
      if (!clubId) throw new Error('no club');
      const x = await api.add(clubId, name);
      if (club.current === clubId) remember([...listRef.current, x].sort(byTeamName));
      return x;
    },
    [api, clubId, remember],
  );
  const rename = useCallback(
    async (id: string, name: string) => {
      const x = await api.rename(id, name);
      if (club.current === x.club_id) replace(x);
      return x;
    },
    [api, replace],
  );
  const setArchived = useCallback(
    async (id: string, archived: boolean) => {
      const x = await api.setArchived(id, archived);
      if (club.current === x.club_id) replace(x);
      return x;
    },
    [api, replace],
  );

  const active = useMemo(() => teams.filter((x) => !x.archived_at), [teams]);
  return { teams, active, loading, error, reload, add, rename, setArchived };
}
