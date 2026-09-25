import type { SupabaseClient } from '@supabase/supabase-js';
import { toRow } from '../domain/factory';
import { AGAINST_KINDS, type GameEvent } from '../domain/types';

export interface Remote {
  push(e: GameEvent): Promise<void>;
  fetchEvents(code: string): Promise<GameEvent[]>;
  fetchAllEvents(): Promise<GameEvent[]>;
  subscribe(code: string, onEvent: (e: GameEvent) => void, onStatus: (connected: boolean) => void): () => void;
  /** Fills the goalie on this game's live shots/CSC/shootout attempts against that have none and are not on an empty net. Returns how many. */
  assignGoalie(code: string, goalieId: string): Promise<number>;
}

/** PostgREST returns at most 1000 rows per request. */
export const PAGE = 1000;
const COLS = 'id,game_code,kind,period,x,y,dot,result,device_role,recorded_at,deleted_at,goalie_id,empty_net,strength,penalty_shot,note';

type Page = { data: unknown[] | null; error: { message: string } | null };

export async function pageAll(fetchPage: (from: number) => PromiseLike<Page>): Promise<GameEvent[]> {
  const out: GameEvent[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await fetchPage(from);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as GameEvent[]));
    if (!data || data.length < PAGE) return out;
  }
}

export function supabaseRemote(client: SupabaseClient): Remote {
  return {
    async push(e) {
      const row = toRow(e);
      const ins = await client.from('events').insert(row);
      // 23505 = this id is already on the server (an earlier push succeeded): fine.
      if (ins.error && ins.error.code !== '23505') throw new Error(ins.error.message);
      if (row.deleted_at) {
        const up = await client.from('events').update({ deleted_at: row.deleted_at }).eq('id', row.id);
        if (up.error) throw new Error(up.error.message);
      }
    },
    fetchEvents(code) {
      return pageAll((from) =>
        client.from('events').select(COLS).eq('game_code', code).order('id').range(from, from + PAGE - 1),
      );
    },
    fetchAllEvents() {
      return pageAll((from) =>
        client.from('events').select(COLS).is('deleted_at', null).order('id').range(from, from + PAGE - 1),
      );
    },
    async assignGoalie(code, goalieId) {
      const { data, error } = await client
        .from('events')
        .update({ goalie_id: goalieId })
        .eq('game_code', code)
        .is('goalie_id', null)
        .eq('empty_net', false)
        .is('deleted_at', null)
        .in('kind', [...AGAINST_KINDS])
        .select('id');
      if (error) throw new Error(error.message);
      return data?.length ?? 0;
    },
    subscribe(code, onEvent, onStatus) {
      const channel = client
        .channel(`events:${code}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `game_code=eq.${code}` }, (payload) => {
          const row = payload.new as Partial<GameEvent>;
          if (row && typeof row.id === 'string') onEvent(row as GameEvent);
        })
        .subscribe((status) => onStatus(status === 'SUBSCRIBED'));
      return () => {
        void client.removeChannel(channel);
      };
    },
  };
}
