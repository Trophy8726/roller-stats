import type { SupabaseClient } from '@supabase/supabase-js';
import type { Goalie } from '../domain/types';

/** The roster already has a goalie with this name (case and outer spaces ignored). */
export class DuplicateGoalieError extends Error {}

export interface GoaliesApi {
  list(clubId: string): Promise<Goalie[]>;
  add(clubId: string, name: string): Promise<Goalie>;
  rename(id: string, name: string): Promise<Goalie>;
}

const COLS = 'id,name,club_id,created_at';
const byName = (a: Goalie, b: Goalie) => a.name.localeCompare(b.name, 'fr');
const fail = (e: { code?: string; message: string }): never => {
  throw e.code === '23505' ? new DuplicateGoalieError(e.message) : new Error(e.message);
};

export function supabaseGoalies(client: SupabaseClient): GoaliesApi {
  return {
    async list(clubId) {
      const { data, error } = await client.from('goalies').select(COLS).eq('club_id', clubId);
      if (error) fail(error);
      return ((data ?? []) as Goalie[]).sort(byName);
    },
    async add(clubId, name) {
      const { data, error } = await client.from('goalies').insert({ club_id: clubId, name: name.trim() }).select(COLS).single();
      if (error) fail(error);
      return data as Goalie;
    },
    async rename(id, name) {
      const { data, error } = await client.from('goalies').update({ name: name.trim() }).eq('id', id).select(COLS).single();
      if (error) fail(error);
      return data as Goalie;
    },
  };
}
