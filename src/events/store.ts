import type { GameEvent } from '../domain/types';

export type SyncState = 'pending' | 'synced';
export interface StoredEvent extends GameEvent {
  sync: SyncState;
  /** Recorded on this device (drives the "last entries" list and undo). */
  mine: boolean;
}

export interface KV {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

export function memoryKV(): KV {
  const m = new Map<string, unknown>();
  return {
    get: async (k) => structuredClone(m.get(k)),
    set: async (k, v) => {
      m.set(k, structuredClone(v));
    },
  };
}

const byTime = (a: GameEvent, b: GameEvent) => Date.parse(a.recorded_at) - Date.parse(b.recorded_at);

/** Merge rows from the server into the local list. Deletion is one-way: once deleted, always deleted. */
export function mergeRemote(local: StoredEvent[], remote: GameEvent[]): StoredEvent[] {
  const byId = new Map(local.map((e) => [e.id, e]));
  for (const r of remote) {
    const l = byId.get(r.id);
    if (!l) byId.set(r.id, { ...r, sync: 'synced', mine: false });
    else if (r.deleted_at && !l.deleted_at) byId.set(r.id, { ...l, deleted_at: r.deleted_at });
  }
  return [...byId.values()].sort(byTime);
}

export class EventStore {
  private chain: Promise<unknown> = Promise.resolve();

  constructor(private kv: KV) {}

  private key(code: string) {
    return `events:${code}`;
  }

  async load(code: string): Promise<StoredEvent[]> {
    return ((await this.kv.get(this.key(code))) as StoredEvent[] | undefined) ?? [];
  }

  /** All writes go through one queue so concurrent taps never overwrite each other. */
  private update(code: string, fn: (evs: StoredEvent[]) => StoredEvent[]): Promise<StoredEvent[]> {
    const next = this.chain.then(async () => {
      const evs = fn(await this.load(code));
      await this.kv.set(this.key(code), evs);
      return evs;
    });
    this.chain = next.catch(() => undefined);
    return next;
  }

  add(e: GameEvent): Promise<StoredEvent[]> {
    return this.update(e.game_code, (evs) => (evs.some((x) => x.id === e.id) ? evs : [...evs, { ...e, sync: 'pending', mine: true }]));
  }

  softDelete(code: string, id: string, at: string): Promise<StoredEvent[]> {
    return this.update(code, (evs) => evs.map((e) => (e.id === id && !e.deleted_at ? { ...e, deleted_at: at, sync: 'pending' } : e)));
  }

  markSynced(code: string, pushed: { id: string; deleted_at: string | null }[]): Promise<StoredEvent[]> {
    return this.update(code, (evs) =>
      evs.map((e) => (pushed.some((p) => p.id === e.id && p.deleted_at === e.deleted_at) ? { ...e, sync: 'synced' } : e)),
    );
  }

  mergeRemote(code: string, remote: GameEvent[]): Promise<StoredEvent[]> {
    return this.update(code, (evs) => mergeRemote(evs, remote));
  }
}
