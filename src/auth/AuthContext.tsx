import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useSync } from '../events/SyncContext';
import { authErrorFromUrl, cleanAuthParams, type AuthApi, type User } from './api';

export type AuthState = { status: 'loading' } | { status: 'signedOut'; error: boolean } | { status: 'signedIn'; user: User };

const Ctx = createContext<{ state: AuthState; api: AuthApi } | null>(null);

const fromUser = (u: User | null, error = false): AuthState => (u ? { status: 'signedIn', user: u } : { status: 'signedOut', error });

/** `initialUser` skips the first async read (tests only). */
export function AuthProvider({ initialUser, children }: { initialUser?: User | null; children: ReactNode }) {
  const { auth } = useSync();
  const [state, setState] = useState<AuthState>(initialUser === undefined ? { status: 'loading' } : fromUser(initialUser));

  useEffect(() => {
    let alive = true;
    const failed = authErrorFromUrl() !== null;
    auth
      .current()
      .then((u) => {
        if (!alive) return;
        cleanAuthParams();
        setState(fromUser(u, failed && !u));
      })
      .catch(() => {
        if (alive) setState({ status: 'signedOut', error: false });
      });
    const off = auth.onChange((u) => {
      if (!alive) return;
      setState((prev) => {
        if (prev.status === 'signedIn' && u && prev.user.id === u.id) return prev;
        // supabase-js emits INITIAL_SESSION (null) after current() resolved: keep the failure flag.
        if (!u && prev.status === 'signedOut') return prev;
        return fromUser(u);
      });
    });
    return () => {
      alive = false;
      off();
    };
  }, [auth]);

  return <Ctx.Provider value={{ state, api: auth }}>{children}</Ctx.Provider>;
}

export function useAuth(): { state: AuthState; api: AuthApi } {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
