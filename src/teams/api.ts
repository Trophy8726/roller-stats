import type { SupabaseClient } from '@supabase/supabase-js';

export interface Team {
  id: string;
  club_id: string;
  name: string;
  archived_at: string | null;
}

/** The club already has a team with this name (case and outer spaces ignored). */
export class DuplicateTeamError extends Error {}

export interface TeamsApi {
  list(clubId: string): Promise<Team[]>;
  add(clubId: string, name: string): Promise<Team>;
  rename(id: string, name: string): Promise<Team>;
  setArchived(id: string, archived: boolean): Promise<Team>;
}

const COLS = 'id,club_id,name,archived_at';
export const byTeamName = (a: Team, b: Team) => a.name.localeCompare(b.name, 'fr');
const fail = (e: { code?: string; message: string }): never => {
  throw e.code === '23505' ? new DuplicateTeamError(e.message) : new Error(e.message);
};

export function supabaseTeams(client: SupabaseClient): TeamsApi {
  return {
    async list(clubId) {
      const { data, error } = await client.from('teams').select(COLS).eq('club_id', clubId);
      if (error) fail(error);
      return ((data ?? []) as Team[]).sort(byTeamName);
    },
    async add(clubId, name) {
      const { data, error } = await client.from('teams').insert({ club_id: clubId, name: name.trim() }).select(COLS).single();
      if (error) fail(error);
      return data as Team;
    },
    async rename(id, name) {
      const { data, error } = await client.from('teams').update({ name: name.trim() }).eq('id', id).select(COLS).single();
      if (error) fail(error);
      return data as Team;
    },
    async setArchived(id, archived) {
      const { data, error } = await client
        .from('teams')
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq('id', id)
        .select(COLS)
        .single();
      if (error) fail(error);
      return data as Team;
    },
  };
}
