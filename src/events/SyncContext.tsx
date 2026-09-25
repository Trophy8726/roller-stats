import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { supabaseGoalies, type GoaliesApi } from '../goalies/api';
import { supabaseGames, type GamesApi } from '../games/api';
import { supabase } from '../lib/supabase';
import { createBackgroundSync, type BackgroundSync } from './backgroundSync';
import { idbKV } from './idbKV';
import { supabaseRemote, type Remote } from './remote';
import { EventStore } from './store';

export interface SyncDeps {
  store: EventStore;
  remote: Remote;
  games: GamesApi;
  goalies: GoaliesApi;
}

const Ctx = createContext<SyncDeps | null>(null);
const BgCtx = createContext<BackgroundSync | null>(null);

/** Provides the sync dependencies and runs the app-wide background flusher for every game's outbox. */
export function SyncProvider({ deps, children }: { deps: SyncDeps; children: ReactNode }) {
  const { store, remote } = deps;
  const bg = useMemo(() => createBackgroundSync(store, remote), [store, remote]);
  useEffect(() => bg.start(), [bg]);
  return (
    <Ctx.Provider value={deps}>
      <BgCtx.Provider value={bg}>{children}</BgCtx.Provider>
    </Ctx.Provider>
  );
}

export function useSync(): SyncDeps {
  const deps = useContext(Ctx);
  if (!deps) throw new Error('useSync must be used inside SyncProvider');
  return deps;
}

export function useBackgroundSync(): BackgroundSync {
  const bg = useContext(BgCtx);
  if (!bg) throw new Error('useBackgroundSync must be used inside SyncProvider');
  return bg;
}

/** Events recorded on this device and not yet on the server, across all games. */
export function usePendingTotal(): number {
  const bg = useBackgroundSync();
  return useSyncExternalStore(bg.subscribe, bg.pending);
}

export function defaultSyncDeps(): SyncDeps {
  return { store: new EventStore(idbKV()), remote: supabaseRemote(supabase), games: supabaseGames(supabase), goalies: supabaseGoalies(supabase) };
}
