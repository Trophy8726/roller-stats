import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import type { AuthApi, User } from '../auth/api';
import { AuthProvider } from '../auth/AuthContext';
import { toRow } from '../domain/factory';
import { AGAINST_KINDS, type Game, type GameEvent, type Goalie } from '../domain/types';
import type { GamesApi } from '../games/api';
import { DuplicateGoalieError, type GoaliesApi } from '../goalies/api';
import type { Remote } from '../events/remote';
import { EventStore, memoryKV } from '../events/store';
import { SyncProvider, type SyncDeps } from '../events/SyncContext';

export function fakeRemote() {
  const rows = new Map<string, GameEvent>();
  const listeners = new Set<(e: GameEvent) => void>();
  let online = true;
  const guard = () => {
    if (!online) throw new Error('offline');
  };
  const remote: Remote = {
    async push(e) {
      guard();
      const r = toRow(e);
      const existing = rows.get(r.id);
      rows.set(r.id, existing ? { ...existing, deleted_at: r.deleted_at ?? existing.deleted_at } : r);
    },
    async fetchEvents(code) {
      guard();
      return [...rows.values()].filter((r) => r.game_code === code);
    },
    async fetchAllEvents() {
      guard();
      return [...rows.values()].filter((r) => !r.deleted_at);
    },
    subscribe(code, onEvent, onStatus) {
      const l = (e: GameEvent) => {
        if (e.game_code === code) onEvent(e);
      };
      listeners.add(l);
      onStatus(true);
      return () => listeners.delete(l);
    },
    async assignGoalie(code, goalieId) {
      guard();
      let n = 0;
      for (const [id, r] of rows) {
        if (r.game_code === code && !r.goalie_id && !r.empty_net && !r.deleted_at && AGAINST_KINDS.includes(r.kind)) {
          const next = { ...r, goalie_id: goalieId };
          rows.set(id, next);
          listeners.forEach((l) => l(next));
          n++;
        }
      }
      return n;
    },
  };
  return {
    remote,
    rows,
    setOnline: (v: boolean) => (online = v),
    emit: (e: GameEvent) => listeners.forEach((l) => l(e)),
  };
}

export function fakeGames(initial: Game[] = []) {
  const games = [...initial];
  let failing = false;
  const guard = () => {
    if (failing) throw new Error('down');
  };
  const api: GamesApi = {
    async create(input) {
      guard();
      const g: Game = { code: 'K7QX', ...input };
      games.push(g);
      return g;
    },
    async get(code) {
      guard();
      return games.find((g) => g.code === code) ?? null;
    },
    async list() {
      guard();
      return [...games];
    },
  };
  return { api, games, setFailing: (v: boolean) => (failing = v) };
}

export function fakeGoalies(initial: Goalie[] = []) {
  const list = [...initial];
  let failing = false;
  let n = 0;
  const guard = () => {
    if (failing) throw new Error('down');
  };
  const clash = (name: string, except?: string) =>
    list.some((g) => g.id !== except && g.name.trim().toLowerCase() === name.trim().toLowerCase());
  const api: GoaliesApi = {
    async list() {
      guard();
      return [...list].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    },
    async add(name) {
      guard();
      if (clash(name)) throw new DuplicateGoalieError('duplicate');
      const g = { id: `goalie-${++n}`, name: name.trim() };
      list.push(g);
      return { ...g };
    },
    async rename(id, name) {
      guard();
      if (clash(name, id)) throw new DuplicateGoalieError('duplicate');
      const g = list.find((x) => x.id === id);
      if (!g) throw new Error('unknown goalie');
      g.name = name.trim();
      return { ...g };
    },
  };
  return { api, list, setFailing: (v: boolean) => (failing = v) };
}

export const TEST_USER: User = { id: 'user-1', email: 'paul@example.com', name: 'Paul' };

export function fakeAuth(initial: User | null) {
  let current = initial;
  const listeners = new Set<(u: User | null) => void>();
  const api: AuthApi = {
    current: async () => current,
    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    signInWithGoogle: vi.fn(async () => {}),
    signOut: vi.fn(async () => {
      current = null;
      listeners.forEach((l) => l(null));
    }),
  };
  return {
    api,
    userId: () => current?.id ?? '',
    setUser(u: User | null) {
      current = u;
      listeners.forEach((l) => l(u));
    },
  };
}

export function makeDeps(opts: { games?: Game[]; goalies?: Goalie[]; user?: User | null } = {}) {
  const fr = fakeRemote();
  const fg = fakeGames(opts.games);
  const fgo = fakeGoalies(opts.goalies);
  const fa = fakeAuth(opts.user === undefined ? TEST_USER : opts.user);
  const deps: SyncDeps = { store: new EventStore(memoryKV()), remote: fr.remote, games: fg.api, goalies: fgo.api, auth: fa.api };
  return { deps, fr, fg, fgo, fa };
}

/** Renders `ui` as a signed-in screen (or signed out with `user: null`), without waiting for the session read. */
export function renderWithSync(ui: ReactElement, deps: SyncDeps, opts: { user?: User | null } = {}) {
  const user = opts.user === undefined ? TEST_USER : opts.user;
  return render(
    <SyncProvider deps={deps}>
      <AuthProvider initialUser={user}>{ui}</AuthProvider>
    </SyncProvider>,
  );
}
