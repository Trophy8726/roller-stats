import type { SupabaseClient } from '@supabase/supabase-js';
import { shotEv } from '../test/builders';
import { PAGE, pageAll, supabaseRemote } from './remote';

describe('pageAll', () => {
  it('fetches every page when there are more than 1000 rows', async () => {
    const all = Array.from({ length: 2500 }, (_, i) => shotEv('shot_for', 'save', { id: `r${i}` }));
    const calls: number[] = [];
    const rows = await pageAll(async (from) => {
      calls.push(from);
      return { data: all.slice(from, from + PAGE), error: null };
    });
    expect(rows).toHaveLength(2500);
    expect(calls).toEqual([0, 1000, 2000]);
  });

  it('throws on error', async () => {
    await expect(pageAll(async () => ({ data: null, error: { message: 'boom' } }))).rejects.toThrow('boom');
  });
});

describe('supabaseRemote.push', () => {
  it('treats "already exists" as success and then sends the deletion', async () => {
    const calls: string[] = [];
    const client = {
      from: () => ({
        insert: async () => {
          calls.push('insert');
          return { error: { code: '23505', message: 'duplicate' } };
        },
        update: (v: unknown) => ({
          eq: async () => {
            calls.push(`update ${JSON.stringify(v)}`);
            return { error: null };
          },
        }),
      }),
    } as unknown as SupabaseClient;
    await supabaseRemote(client).push(shotEv('shot_for', 'goal', { deleted_at: '2026-09-24T19:00:00.000Z' }));
    expect(calls).toEqual(['insert', 'update {"deleted_at":"2026-09-24T19:00:00.000Z"}']);
  });

  it('throws on network errors so the event stays pending', async () => {
    const client = { from: () => ({ insert: async () => ({ error: { code: '', message: 'Failed to fetch' } }) }) } as unknown as SupabaseClient;
    await expect(supabaseRemote(client).push(shotEv('shot_for', 'goal'))).rejects.toThrow('Failed to fetch');
  });
});

describe('supabaseRemote.assignGoalie', () => {
  function stub(result: { data: unknown[] | null; error: { message: string } | null }) {
    const calls: string[] = [];
    const q: Record<string, unknown> = {
      update: (v: unknown) => (calls.push(`update ${JSON.stringify(v)}`), q),
      eq: (c: string, v: unknown) => (calls.push(`eq ${c}=${v}`), q),
      is: (c: string, v: unknown) => (calls.push(`is ${c}=${v}`), q),
      in: (c: string, v: unknown[]) => (calls.push(`in ${c}=${v.join(',')}`), q),
      select: async () => result,
    };
    return { calls, client: { from: () => q } as unknown as SupabaseClient };
  }

  it("fills the goalie on this game's live shots against that have none, and returns how many", async () => {
    const { calls, client } = stub({ data: [{ id: 'a' }, { id: 'b' }], error: null });
    expect(await supabaseRemote(client).assignGoalie('AB23', 'g1')).toBe(2);
    expect(calls).toEqual([
      'update {"goalie_id":"g1"}', 'eq game_code=AB23', 'is goalie_id=null', 'eq empty_net=false', 'is deleted_at=null',
      'in kind=shot_against,own_goal_against,shootout_against',
    ]);
  });
  it('throws on a server error', async () => {
    const { client } = stub({ data: null, error: { message: 'denied' } });
    await expect(supabaseRemote(client).assignGoalie('AB23', 'g1')).rejects.toThrow('denied');
  });
});
