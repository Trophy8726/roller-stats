import type { SupabaseClient } from '@supabase/supabase-js';
import { InvalidInviteError, LastOwnerError, supabaseClubs } from './api';
import { DuplicateTeamError, supabaseTeams } from '../teams/api';

function stubRpc(error: { code: string; message: string }) {
  return { rpc: async () => ({ data: null, error }) } as unknown as SupabaseClient;
}
function stubTable(error: { code: string; message: string }) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  Object.assign(chain, { insert: self, update: self, delete: self, eq: self, select: self, single: async () => ({ data: null, error }), then: (r: (v: unknown) => void) => r({ data: null, error }) });
  return { from: () => chain } as unknown as SupabaseClient;
}

describe('clubs api errors', () => {
  it('maps RS002 to InvalidInviteError', async () => {
    await expect(supabaseClubs(stubRpc({ code: 'RS002', message: 'invalid invite' })).join('x')).rejects.toBeInstanceOf(InvalidInviteError);
  });
  it('maps RS001 to LastOwnerError', async () => {
    await expect(supabaseClubs(stubTable({ code: 'RS001', message: 'last owner' })).remove('c', 'u')).rejects.toBeInstanceOf(LastOwnerError);
  });
  it('maps 23505 on teams to DuplicateTeamError', async () => {
    await expect(supabaseTeams(stubTable({ code: '23505', message: 'dup' })).add('c', 'N2')).rejects.toBeInstanceOf(DuplicateTeamError);
  });
});
