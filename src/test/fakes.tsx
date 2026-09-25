import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { toRow } from '../domain/factory';
import { normalizeGame } from '../domain/normalize';
import type { Game, GameEvent } from '../domain/types';
import type { GamesApi } from '../games/api';
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
      const g = normalizeGame({ code: 'K7QX', ...input });
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

export function makeDeps(opts: { games?: Game[] } = {}) {
  const fr = fakeRemote();
  const fg = fakeGames(opts.games);
  const deps: SyncDeps = { store: new EventStore(memoryKV()), remote: fr.remote, games: fg.api };
  return { deps, fr, fg };
}

export function renderWithSync(ui: ReactElement, deps: SyncDeps) {
  return render(<SyncProvider deps={deps}>{ui}</SyncProvider>);
}
