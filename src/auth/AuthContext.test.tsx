import { act, render, screen } from '@testing-library/react';
import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js';
import { authErrorFromUrl, cleanAuthParams, supabaseAuth } from './api';
import { saveCachedUser } from '../settings';
import { AuthProvider, useAuth } from './AuthContext';
import { makeDeps, TEST_USER } from '../test/fakes';
import { SyncProvider } from '../events/SyncContext';

function Probe() {
  const { state } = useAuth();
  return <p>{state.status === 'signedIn' ? `in:${state.user.name}` : state.status === 'signedOut' ? `out:${state.error}` : 'loading'}</p>;
}

function renderProbe(user: typeof TEST_USER | null) {
  const d = makeDeps({ user });
  render(
    <SyncProvider deps={d.deps}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </SyncProvider>,
  );
  return d;
}

describe('AuthProvider', () => {
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('starts loading, then reports the stored session', async () => {
    renderProbe(TEST_USER);
    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(await screen.findByText(`in:${TEST_USER.name}`)).toBeInTheDocument();
  });

  it('reports signed out, and follows sign-in and sign-out events', async () => {
    const d = renderProbe(null);
    expect(await screen.findByText('out:false')).toBeInTheDocument();
    d.fa.setUser(TEST_USER);
    expect(await screen.findByText(`in:${TEST_USER.name}`)).toBeInTheDocument();
    d.fa.setUser(null);
    expect(await screen.findByText('out:false')).toBeInTheDocument();
  });

  it('flags a failed Google round trip and cleans the URL', async () => {
    window.history.replaceState(null, '', '/roller-stats/?error=access_denied&error_description=cancelled#/');
    renderProbe(null);
    expect(await screen.findByText('out:true')).toBeInTheDocument();
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('#/');
  });

  it('keeps the failure flag when the initial auth event reports no session', async () => {
    window.history.replaceState(null, '', '/roller-stats/?error=access_denied#/');
    const d = renderProbe(null);
    expect(await screen.findByText('out:true')).toBeInTheDocument();
    act(() => d.fa.setUser(null));
    expect(screen.getByText('out:true')).toBeInTheDocument();
  });
});

describe('AuthProvider over supabase-js (offline cold start)', () => {
  const KEY = 'sb-test-auth-token';
  beforeEach(() => localStorage.clear());

  function renderOver(session: Session | null) {
    let emit: (e: AuthChangeEvent, s: Session | null) => void = () => {};
    const client = {
      auth: {
        getSession: async () => ({ data: { session }, error: null }),
        onAuthStateChange: (cb: typeof emit) => {
          emit = cb;
          return { data: { subscription: { unsubscribe: () => {} } } };
        },
      },
    } as unknown as SupabaseClient;
    const d = makeDeps({ user: null });
    d.deps.auth = supabaseAuth(client, KEY);
    render(
      <SyncProvider deps={d.deps}>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </SyncProvider>,
    );
    return { emit: (e: AuthChangeEvent, s: Session | null) => act(() => emit(e, s)) };
  }

  it('an expired token offline (no session from getSession, INITIAL_SESSION null) keeps the remembered user signed in', async () => {
    localStorage.setItem(KEY, JSON.stringify({ user: { id: TEST_USER.id } }));
    saveCachedUser(TEST_USER);
    const r = renderOver(null);
    expect(await screen.findByText(`in:${TEST_USER.name}`)).toBeInTheDocument();
    r.emit('INITIAL_SESSION', null);
    expect(screen.getByText(`in:${TEST_USER.name}`)).toBeInTheDocument();
    r.emit('SIGNED_OUT', null);
    expect(await screen.findByText('out:false')).toBeInTheDocument();
  });

  it('without a stored session it shows signed out', async () => {
    saveCachedUser(TEST_USER);
    renderOver(null);
    expect(await screen.findByText('out:false')).toBeInTheDocument();
  });
});

describe('auth URL helpers', () => {
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('removes only the auth parameters', () => {
    window.history.replaceState(null, '', '/roller-stats/?code=abc&keep=1#/saison');
    cleanAuthParams();
    expect(window.location.search).toBe('?keep=1');
    expect(window.location.hash).toBe('#/saison');
  });

  it('reads the error description', () => {
    window.history.replaceState(null, '', '/roller-stats/?error=access_denied');
    expect(authErrorFromUrl()).toBe('access_denied');
  });
});
