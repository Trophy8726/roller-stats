import { createContext, useContext, type ReactNode } from 'react';
import { supabaseGames, type GamesApi } from '../games/api';
import { supabase } from '../lib/supabase';
import { idbKV } from './idbKV';
import { supabaseRemote, type Remote } from './remote';
import { EventStore } from './store';

export interface SyncDeps {
  store: EventStore;
  remote: Remote;
  games: GamesApi;
}

const Ctx = createContext<SyncDeps | null>(null);

export function SyncProvider({ deps, children }: { deps: SyncDeps; children: ReactNode }) {
  return <Ctx.Provider value={deps}>{children}</Ctx.Provider>;
}

export function useSync(): SyncDeps {
  const deps = useContext(Ctx);
  if (!deps) throw new Error('useSync must be used inside SyncProvider');
  return deps;
}

export function defaultSyncDeps(): SyncDeps {
  return { store: new EventStore(idbKV()), remote: supabaseRemote(supabase), games: supabaseGames(supabase) };
}
