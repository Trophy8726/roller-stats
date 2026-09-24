import { flushOutbox, withTimeout } from './outbox';
import type { Remote } from './remote';
import type { EventStore } from './store';

export const BACKGROUND_RETRY_MS = 5000;

export interface BackgroundSync {
  /** One pass over every game with pending events. Calls made during a pass are folded into one extra pass. */
  run(): Promise<void>;
  /** Runs now, on each browser 'online' event and every `intervalMs`. Returns a stop function. */
  start(): () => void;
  /** Events still waiting to be sent, as of the last pass. */
  pending(): number;
  subscribe(listener: () => void): () => void;
}

/**
 * Sends every game's pending events, whether or not that game's screen is open
 * (spec §8: events sync whenever a connection exists). Per-game hooks may flush
 * in parallel: pushes are idempotent upserts.
 */
export function createBackgroundSync(store: EventStore, remote: Remote, intervalMs = BACKGROUND_RETRY_MS): BackgroundSync {
  let current: Promise<void> | null = null;
  let again = false;
  let total = 0;
  const listeners = new Set<() => void>();

  async function pass() {
    for (const code of await store.pendingCodes()) {
      await flushOutbox(store, (e) => withTimeout(remote.push(e)), code);
    }
    const n = await store.pendingTotal();
    if (n !== total) {
      total = n;
      listeners.forEach((l) => l());
    }
  }

  async function loop() {
    try {
      do {
        again = false;
        await pass();
      } while (again);
    } catch {
      /* storage error: the next trigger retries */
    } finally {
      current = null;
    }
  }

  function run(): Promise<void> {
    if (current) {
      again = true;
      return current;
    }
    current = loop();
    return current;
  }

  return {
    run,
    start() {
      const onOnline = () => void run();
      window.addEventListener('online', onOnline);
      const timer = window.setInterval(() => void run(), intervalMs);
      void run();
      return () => {
        window.removeEventListener('online', onOnline);
        window.clearInterval(timer);
      };
    },
    pending: () => total,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
