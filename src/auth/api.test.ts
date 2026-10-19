import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js';
import { authStorageKey, supabaseAuth, type User } from './api';
import { loadCachedUser, saveCachedUser } from '../settings';

const KEY = 'sb-test-auth-token';
const U: User = { id: 'u1', email: 'ana@example.com', name: 'Ana' };
const session = { user: { id: 'u1', email: 'ana@example.com', user_metadata: { full_name: 'Ana' } } } as unknown as Session;

function stub(initial: Session | null) {
  let listener: ((e: AuthChangeEvent, s: Session | null) => void) | null = null;
  const auth = {
    getSession: vi.fn(async () => ({ data: { session: initial }, error: null })),
    onAuthStateChange: (cb: (e: AuthChangeEvent, s: Session | null) => void) => {
      listener = cb;
      return { data: { subscription: { unsubscribe: () => (listener = null) } } };
    },
    signOut: vi.fn(async () => {
      localStorage.removeItem(KEY);
      return { error: null };
    }),
    signInWithOAuth: vi.fn(async () => ({ error: null })),
  };
  return {
    client: { auth } as unknown as SupabaseClient,
    emit: (e: AuthChangeEvent, s: Session | null) => listener?.(e, s),
  };
}

const storeSession = () => localStorage.setItem(KEY, JSON.stringify({ access_token: 'a', refresh_token: 'r', user: { id: 'u1' } }));

describe('supabaseAuth', () => {
  beforeEach(() => localStorage.clear());

  it('derives the supabase-js storage key from the project URL', () => {
    expect(authStorageKey('https://ibgyycalrtnwtfmlzrwk.supabase.co')).toBe('sb-ibgyycalrtnwtfmlzrwk-auth-token');
  });

  it('remembers the user of a valid session', async () => {
    const s = stub(session);
    expect(await supabaseAuth(s.client, KEY).current()).toEqual(U);
    expect(loadCachedUser()).toEqual(U);
  });

  it('offline with an expired token: the stored session and the remembered user keep the device signed in', async () => {
    storeSession();
    saveCachedUser(U);
    const s = stub(null);
    expect(await supabaseAuth(s.client, KEY).current()).toEqual(U);
  });

  it('without a stored session (signed out), the remembered user is not used', async () => {
    saveCachedUser(U);
    const s = stub(null);
    expect(await supabaseAuth(s.client, KEY).current()).toBeNull();
  });

  it('a stored session of another account does not bring back the remembered user', async () => {
    localStorage.setItem(KEY, JSON.stringify({ user: { id: 'someone-else' } }));
    saveCachedUser(U);
    expect(await supabaseAuth(stub(null).client, KEY).current()).toBeNull();
  });

  it('a getSession failure falls back the same way', async () => {
    storeSession();
    saveCachedUser(U);
    const s = stub(null);
    (s.client.auth.getSession as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('offline'));
    expect(await supabaseAuth(s.client, KEY).current()).toEqual(U);
  });

  it('forwards a null user only on SIGNED_OUT, which forgets the remembered user', () => {
    const s = stub(null);
    const seen: (User | null)[] = [];
    supabaseAuth(s.client, KEY).onChange((u) => seen.push(u));
    s.emit('SIGNED_IN', session);
    expect(loadCachedUser()).toEqual(U);
    s.emit('INITIAL_SESSION', null);
    s.emit('TOKEN_REFRESHED', null);
    expect(seen).toEqual([U]);
    s.emit('SIGNED_OUT', null);
    expect(seen).toEqual([U, null]);
    expect(loadCachedUser()).toBeNull();
  });

  it('signOut forgets the remembered user', async () => {
    saveCachedUser(U);
    storeSession();
    const s = stub(session);
    await supabaseAuth(s.client, KEY).signOut();
    expect(loadCachedUser()).toBeNull();
    expect(s.client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});
