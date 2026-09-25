import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseGames } from './api';

type InsertResult = { error: { code: string; message: string } | null };

function fakeClient(results: InsertResult[]) {
  const inserted: unknown[] = [];
  const client = {
    from: () => ({
      insert: async (row: unknown) => {
        inserted.push(row);
        return results.shift() ?? { error: null };
      },
    }),
  };
  return { client: client as unknown as SupabaseClient, inserted };
}

const input = {
  team_name: 'Nous', opponent: 'Rouen', game_date: '2026-09-24', home: true,
  venue: 'home' as const, competition: 'coupe' as const, sheet_side: null, overtime_possible: true,
};

describe('supabaseGames.create', () => {
  it('retries with a new code when the code already exists', async () => {
    const { client, inserted } = fakeClient([{ error: { code: '23505', message: 'duplicate' } }, { error: null }]);
    const values = [0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5];
    const game = await supabaseGames(client, () => values.shift()!).create(input);
    expect(inserted).toHaveLength(2);
    expect(game).toEqual({ code: 'SSSS', ...input });
  });

  it('throws on any other error', async () => {
    const { client } = fakeClient([{ error: { code: '42501', message: 'denied' } }]);
    await expect(supabaseGames(client).create(input)).rejects.toThrow('denied');
  });
});

describe('supabaseGames.get', () => {
  it('fills the v2 fields of a row saved by v1', async () => {
    const row = { code: 'AB23', team_name: 'Nous', opponent: 'Rouen', game_date: '2026-09-24', home: false };
    const client = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) }) } as unknown as SupabaseClient;
    expect(await supabaseGames(client).get('AB23')).toMatchObject({ venue: 'away', competition: 'championnat', overtime_possible: true });
  });
});
