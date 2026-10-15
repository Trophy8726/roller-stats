import { SUPABASE_KEY, SUPABASE_URL } from './config';

describe('config', () => {
  it('reads the Supabase project from the env files', () => {
    expect(SUPABASE_URL).toMatch(/^https:\/\/[a-z0-9]+\.supabase\.co$/);
    expect(SUPABASE_KEY).toMatch(/^sb_publishable_/);
  });
});
