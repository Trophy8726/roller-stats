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
