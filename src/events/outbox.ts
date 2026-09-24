import type { GameEvent } from '../domain/types';
import type { EventStore, StoredEvent } from './store';

/** Push every pending event in order. Stops at the first failure (usually: no network). Safe to call repeatedly. */
export async function flushOutbox(
  store: EventStore,
  push: (e: GameEvent) => Promise<void>,
  code: string,
): Promise<{ pushed: number; failed: boolean; events: StoredEvent[] }> {
  const pending = (await store.load(code)).filter((e) => e.sync === 'pending');
  let pushed = 0;
  for (const e of pending) {
    try {
      await push(e);
    } catch {
      return { pushed, failed: true, events: await store.load(code) };
    }
    await store.markSynced(code, [{ id: e.id, deleted_at: e.deleted_at }]);
    pushed++;
  }
  return { pushed, failed: false, events: await store.load(code) };
}
