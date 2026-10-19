import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { loadCachedUser, loadStoredSession, saveCachedUser } from '../settings';

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface AuthApi {
  /** The session kept on this device, after any `?code=` from Google has been exchanged. */
  current(): Promise<User | null>;
  /** A user when one is known; null only when the session really ended (sign-out, revoked refresh token). */
  onChange(cb: (u: User | null) => void): () => void;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
}

export function toUser(s: Session | null): User | null {
  if (!s) return null;
  const meta = (s.user.user_metadata ?? {}) as Record<string, unknown>;
  const email = s.user.email ?? '';
  const name = (typeof meta.full_name === 'string' && meta.full_name) || (typeof meta.name === 'string' && meta.name) || email.split('@')[0];
  return { id: s.user.id, email, name };
}

/** Where Google sends the browser back: the app root (the hash route is not kept). */
export const redirectUrl = (): string => `${window.location.origin}${import.meta.env.BASE_URL}`;

const AUTH_PARAMS = ['code', 'error', 'error_code', 'error_description'];

export function authErrorFromUrl(): string | null {
  return new URL(window.location.href).searchParams.get('error');
}

/** Removes what Google and Supabase added to the address, keeping the hash route. */
export function cleanAuthParams(): void {
  const url = new URL(window.location.href);
  if (!AUTH_PARAMS.some((p) => url.searchParams.has(p))) return;
  AUTH_PARAMS.forEach((p) => url.searchParams.delete(p));
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
}

/** Where supabase-js keeps the session in localStorage (its default key). */
export const authStorageKey = (supabaseUrl: string): string => `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;

/**
 * Offline with an expired access token, supabase-js cannot refresh it: getSession() and
 * INITIAL_SESSION give no session while the session stays stored (it is removed only on
 * sign-out or when the server rejects the refresh token, which emits SIGNED_OUT). The device
 * then stays signed in as the last known user; auto-refresh restores a token once online.
 */
export function supabaseAuth(client: SupabaseClient, storageKey: string): AuthApi {
  const known = (u: User | null): User | null => {
    if (u) saveCachedUser(u);
    return u;
  };
  return {
    async current() {
      let session: Session | null = null;
      try {
        session = (await client.auth.getSession()).data.session;
      } catch {
        /* falls back to the stored session below */
      }
      const u = toUser(session);
      if (u) return known(u);
      const stored = loadStoredSession(storageKey);
      const cached = loadCachedUser();
      if (!stored || !cached) return null;
      const storedId = stored.user?.id;
      return typeof storedId === 'string' && storedId !== cached.id ? null : cached;
    },
    onChange(cb) {
      const { data } = client.auth.onAuthStateChange((event, session) => {
        const u = toUser(session);
        if (u) cb(known(u));
        else if (event === 'SIGNED_OUT') {
          saveCachedUser(null);
          cb(null);
        }
        // Any other event without a session (INITIAL_SESSION offline): keep the current state.
      });
      return () => data.subscription.unsubscribe();
    },
    async signInWithGoogle() {
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectUrl() } });
      if (error) throw new Error(error.message);
    },
    async signOut() {
      saveCachedUser(null);
      // 'local' ends the session on this device only, and works without network.
      await client.auth.signOut({ scope: 'local' });
    },
  };
}
