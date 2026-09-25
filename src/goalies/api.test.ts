import type { SupabaseClient } from '@supabase/supabase-js';
import { DuplicateGoalieError, supabaseGoalies } from './api';

const asClient = (from: unknown) => ({ from }) as unknown as SupabaseClient;
const dup = { code: '23505', message: 'duplicate key' };

describe('supabaseGoalies', () => {
  it('lists goalies sorted by name', async () => {
    const client = asClient(() => ({ select: async () => ({ data: [{ id: '2', name: 'Zoé' }, { id: '1', name: 'Alain' }], error: null }) }));
    expect((await supabaseGoalies(client).list()).map((g) => g.name)).toEqual(['Alain', 'Zoé']);
  });
  it('adds a goalie with a trimmed name', async () => {
    const rows: unknown[] = [];
    const client = asClient(() => ({
      insert: (row: { name: string }) => (rows.push(row), { select: () => ({ single: async () => ({ data: { id: '1', name: row.name }, error: null }) }) }),
    }));
    expect(await supabaseGoalies(client).add('  François Mallet ')).toEqual({ id: '1', name: 'François Mallet' });
    expect(rows).toEqual([{ name: 'François Mallet' }]);
  });
  it('reports a duplicate name with its own error', async () => {
    const client = asClient(() => ({ insert: () => ({ select: () => ({ single: async () => ({ data: null, error: dup }) }) }) }));
    await expect(supabaseGoalies(client).add('Mallet')).rejects.toBeInstanceOf(DuplicateGoalieError);
  });
  it('renames a goalie, and reports a duplicate too', async () => {
    const ok = asClient(() => ({ update: (v: { name: string }) => ({ eq: () => ({ select: () => ({ single: async () => ({ data: { id: '1', name: v.name }, error: null }) }) }) }) }));
    expect((await supabaseGoalies(ok).rename('1', ' Mallet F. ')).name).toBe('Mallet F.');
    const clash = asClient(() => ({ update: () => ({ eq: () => ({ select: () => ({ single: async () => ({ data: null, error: dup }) }) }) }) }));
    await expect(supabaseGoalies(clash).rename('1', 'X')).rejects.toBeInstanceOf(DuplicateGoalieError);
  });
  it('throws on any other error', async () => {
    const client = asClient(() => ({ select: async () => ({ data: null, error: { code: '42501', message: 'denied' } }) }));
    await expect(supabaseGoalies(client).list()).rejects.toThrow('denied');
  });
});
