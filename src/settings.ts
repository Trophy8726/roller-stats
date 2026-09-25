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

export const loadTeamName = (): string => store.get('teamName') ?? '';
export const saveTeamName = (n: string): void => store.set('teamName', n);
export const loadSetup = (code: string): RecordSetup | null => readJson<RecordSetup>(`setup:${code}`);
export const saveSetup = (code: string, s: RecordSetup | null): void => store.set(`setup:${code}`, s ? JSON.stringify(s) : null);
export const loadCachedGame = (code: string): Game | null => {
  const g = readJson<Parameters<typeof normalizeGame>[0]>(`game:${code}`);
  return g ? normalizeGame(g) : null;
};
export const saveCachedGame = (g: Game): void => store.set(`game:${g.code}`, JSON.stringify(g));
export const loadCachedGoalies = (): Goalie[] => readJson<Goalie[]>('goalies') ?? [];
export const saveCachedGoalies = (g: Goalie[]): void => store.set('goalies', JSON.stringify(g));
/** Local date (not UTC) as YYYY-MM-DD. */
export const todayIso = (): string => new Date().toLocaleDateString('sv-SE');
