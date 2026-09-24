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
  /** Every key in the storage (only used once, to rebuild the pending-games index). */
  keys?(): Promise<string[]>;
}

export function memoryKV(): KV {
  const m = new Map<string, unknown>();
  return {
    get: async (k) => structuredClone(m.get(k)),
    set: async (k, v) => {
      m.set(k, structuredClone(v));
    },
    keys: async () => [...m.keys()],
  };
}

const EVENTS_PREFIX = 'events:';
const PENDING_INDEX = 'pending-codes';
const hasPending = (evs: StoredEvent[]) => evs.some((e) => e.sync === 'pending');

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
    return `${EVENTS_PREFIX}${code}`;
  }

  async load(code: string): Promise<StoredEvent[]> {
    return ((await this.kv.get(this.key(code))) as StoredEvent[] | undefined) ?? [];
  }

  /** Runs on the write queue so it never interleaves with an update. */
  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const next = this.chain.then(job);
    this.chain = next.catch(() => undefined);
    return next;
  }

  /** Index of game codes with pending events. Rebuilt by scanning the storage if it was never written. */
  private async readIndex(): Promise<string[]> {
    const idx = (await this.kv.get(PENDING_INDEX)) as string[] | undefined;
    if (idx) return idx;
    const codes: string[] = [];
    for (const k of (await this.kv.keys?.()) ?? []) {
      if (!k.startsWith(EVENTS_PREFIX)) continue;
      const code = k.slice(EVENTS_PREFIX.length);
      if (hasPending(await this.load(code))) codes.push(code);
    }
    await this.kv.set(PENDING_INDEX, codes);
    return codes;
  }

  /** All writes go through one queue so concurrent taps never overwrite each other. */
  private update(code: string, fn: (evs: StoredEvent[]) => StoredEvent[]): Promise<StoredEvent[]> {
    return this.enqueue(async () => {
      const evs = fn(await this.load(code));
      await this.kv.set(this.key(code), evs);
      const idx = await this.readIndex();
      const listed = idx.includes(code);
      if (hasPending(evs) !== listed) await this.kv.set(PENDING_INDEX, listed ? idx.filter((c) => c !== code) : [...idx, code]);
      return evs;
    });
  }

  /** Codes of the games that still have events to send to the server. */
  pendingCodes(): Promise<string[]> {
    return this.enqueue(() => this.readIndex());
  }

  /** Number of events still to send, across every game. */
  async pendingTotal(): Promise<number> {
    let n = 0;
    for (const code of await this.pendingCodes()) n += (await this.load(code)).filter((e) => e.sync === 'pending').length;
    return n;
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
