import type { SupabaseClient } from '@supabase/supabase-js';
import type { Goalie } from '../domain/types';

/** The roster already has a goalie with this name (case and outer spaces ignored). */
export class DuplicateGoalieError extends Error {}

export interface GoaliesApi {
  list(): Promise<Goalie[]>;
  add(name: string): Promise<Goalie>;
  rename(id: string, name: string): Promise<Goalie>;
}

const COLS = 'id,name,created_at';
const byName = (a: Goalie, b: Goalie) => a.name.localeCompare(b.name, 'fr');
const fail = (e: { code?: string; message: string }): never => {
  throw e.code === '23505' ? new DuplicateGoalieError(e.message) : new Error(e.message);
};

export function supabaseGoalies(client: SupabaseClient): GoaliesApi {
  return {
    async list() {
      const { data, error } = await client.from('goalies').select(COLS);
      if (error) fail(error);
      return ((data ?? []) as Goalie[]).sort(byName);
    },
    async add(name) {
      const { data, error } = await client.from('goalies').insert({ name: name.trim() }).select(COLS).single();
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
