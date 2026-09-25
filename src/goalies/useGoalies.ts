import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Goalie } from '../domain/types';
import { useSync } from '../events/SyncContext';
import { loadCachedGoalies, saveCachedGoalies } from '../settings';

const byName = (a: Goalie, b: Goalie) => a.name.localeCompare(b.name, 'fr');

export interface GoaliesState {
  goalies: Goalie[];
  names: ReadonlyMap<string, string>;
  loading: boolean;
  error: boolean;
  reload(): Promise<void>;
  /** Rejects with DuplicateGoalieError when the name is already taken. */
  add(name: string): Promise<Goalie>;
  rename(id: string, name: string): Promise<Goalie>;
}

/** The goalie roster. The last copy seen is kept on the device, so the names are there even without network. */
export function useGoalies(): GoaliesState {
  const { goalies: api } = useSync();
  const [goalies, setGoalies] = useState<Goalie[]>(loadCachedGoalies);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const listRef = useRef(goalies);
  const alive = useRef(true);

  const remember = useCallback((list: Goalie[]) => {
    listRef.current = list;
    saveCachedGoalies(list);
    setGoalies(list);
  }, []);

  const reload = useCallback(async () => {
    try {
      const list = await api.list();
      if (!alive.current) return;
      remember(list);
      setError(false);
    } catch {
      if (alive.current) setError(true);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [api, remember]);

  useEffect(() => {
    alive.current = true;
    void reload();
    return () => {
      alive.current = false;
    };
  }, [reload]);

  const add = useCallback(
    async (name: string) => {
      const g = await api.add(name);
      if (alive.current) remember([...listRef.current, g].sort(byName));
      return g;
    },
    [api, remember],
  );

  const rename = useCallback(
    async (id: string, name: string) => {
      const g = await api.rename(id, name);
      if (alive.current) remember(listRef.current.map((x) => (x.id === id ? g : x)).sort(byName));
      return g;
    },
    [api, remember],
  );

  const names = useMemo(() => new Map(goalies.map((g) => [g.id, g.name])), [goalies]);
  return { goalies, names, loading, error, reload, add, rename };
}
