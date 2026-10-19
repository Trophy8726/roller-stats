import type { Session, SupabaseClient } from '@supabase/supabase-js';

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface AuthApi {
  /** The session kept on this device, after any `?code=` from Google has been exchanged. */
  current(): Promise<User | null>;
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

export function supabaseAuth(client: SupabaseClient): AuthApi {
  return {
    async current() {
      const { data } = await client.auth.getSession();
      return toUser(data.session);
    },
    onChange(cb) {
      const { data } = client.auth.onAuthStateChange((_event, session) => cb(toUser(session)));
      return () => data.subscription.unsubscribe();
    },
    async signInWithGoogle() {
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectUrl() } });
      if (error) throw new Error(error.message);
    },
    async signOut() {
      // 'local' ends the session on this device only, and works without network.
      await client.auth.signOut({ scope: 'local' });
    },
  };
}
