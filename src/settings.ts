import type { User } from './auth/api';
import type { Membership } from './clubs/api';
import { normalizeGame } from './domain/normalize';
import type { Game, Goalie, Period, Role, Side } from './domain/types';

export interface RecordSetup {
  role: Role;
  defendP1: Side;
  period: Period;
  /** Overtime only: the side we defend, asked when entering "Prol." */
  defendOT?: Side;
}

// localStorage can throw in private mode: every access is guarded.
const store = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string | null): void {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  },
};

function readJson<T>(k: string): T | null {
  const raw = store.get(k);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const loadSetup = (code: string): RecordSetup | null => readJson<RecordSetup>(`setup:${code}`);
export const saveSetup = (code: string, s: RecordSetup | null): void => store.set(`setup:${code}`, s ? JSON.stringify(s) : null);
export const loadCachedGame = (code: string): Game | null => {
  const g = readJson<Parameters<typeof normalizeGame>[0]>(`game:${code}`);
  return g ? normalizeGame(g) : null;
};
export const saveCachedGame = (g: Game): void => store.set(`game:${g.code}`, JSON.stringify(g));
export const loadCachedGoalies = (clubId: string): Goalie[] => readJson<Goalie[]>(`goalies:${clubId}`) ?? [];
export const saveCachedGoalies = (clubId: string, g: Goalie[]): void => store.set(`goalies:${clubId}`, JSON.stringify(g));
export const loadLastTeam = (clubId: string): string | null => store.get(`lastTeam:${clubId}`);
export const saveLastTeam = (clubId: string, teamId: string): void => store.set(`lastTeam:${clubId}`, teamId);
/** An invitation opened while signed out: kept across the Google round trip, then cleared once used. */
export const savePendingInvite = (token: string): void => store.set('pendingInvite', token);
export const loadPendingInvite = (): string | null => store.get('pendingInvite');
export const clearPendingInvite = (): void => store.set('pendingInvite', null);
export const loadMemberships = (userId: string): Membership[] => readJson<Membership[]>(`memberships:${userId}`) ?? [];
export const saveMemberships = (userId: string, list: Membership[]): void => store.set(`memberships:${userId}`, JSON.stringify(list));
export const loadCurrentClub = (userId: string): string | null => store.get(`club:${userId}`);
export const saveCurrentClub = (userId: string, clubId: string): void => store.set(`club:${userId}`, clubId);
/** The last signed-in user, so the app opens signed in offline when supabase-js cannot refresh an expired token. */
export const loadCachedUser = (): User | null => readJson<User>('user');
export const saveCachedUser = (u: User | null): void => store.set('user', u ? JSON.stringify(u) : null);
/** The session supabase-js keeps under `key`, parsed (null if absent or unreadable). */
export const loadStoredSession = (key: string): { user?: { id?: unknown } } | null => readJson(key);
/** Local date (not UTC) as YYYY-MM-DD. */
export const todayIso = (): string => new Date().toLocaleDateString('sv-SE');
