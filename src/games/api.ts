import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeGame } from '../domain/normalize';
import type { Competition, Game, SheetSide, Venue } from '../domain/types';
import { generateCode } from './code';

export interface NewGame {
  team_name: string;
  opponent: string;
  game_date: string;
  /** Kept for v1 compatibility: `venue === 'home'`. */
  home: boolean;
  venue: Venue;
  competition: Competition;
  sheet_side: SheetSide | null;
  overtime_possible: boolean;
}

export interface GamesApi {
  create(input: NewGame): Promise<Game>;
  get(code: string): Promise<Game | null>;
  list(): Promise<Game[]>;
}

export class ApiError extends Error {}

const COLS = 'code,team_name,opponent,game_date,home,venue,competition,sheet_side,overtime_possible,created_at';
type Row = Parameters<typeof normalizeGame>[0];

export function supabaseGames(client: SupabaseClient, rand: () => number = Math.random): GamesApi {
  return {
    async create(input) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateCode(rand);
        const { error } = await client.from('games').insert({ code, ...input });
        if (!error) return { code, ...input };
        if (error.code !== '23505') throw new ApiError(error.message);
      }
      throw new ApiError('Impossible de générer un code unique');
    },
    async get(code) {
      const { data, error } = await client.from('games').select(COLS).eq('code', code).maybeSingle();
      if (error) throw new ApiError(error.message);
      return data ? normalizeGame(data as Row) : null;
    },
    async list() {
      const { data, error } = await client
        .from('games')
        .select(COLS)
        .order('game_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw new ApiError(error.message);
      return ((data ?? []) as Row[]).map(normalizeGame);
    },
  };
}
