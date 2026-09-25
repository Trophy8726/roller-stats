import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameEvent } from '../domain/types';
import { flushOutbox, withTimeout } from './outbox';
import type { StoredEvent } from './store';
import { useSync } from './SyncContext';

const RETRY_MS = 5000;

export interface GameEventsState {
  events: StoredEvent[];
  pending: number;
  connected: boolean;
  loadError: boolean;
  record(e: GameEvent): void;
  remove(id: string): void;
  /** Re-fetches this game's server rows and merges them. */
  refresh(): Promise<void>;
}

/** Events only change through add/sync/delete/goalie assignment, so id + sync state + deletion + goalie identify a list's content. */
function sameEvents(a: StoredEvent[], b: StoredEvent[]): boolean {
  return a.length === b.length && a.every((e, i) => e.id === b[i].id && e.sync === b[i].sync && e.deleted_at === b[i].deleted_at && e.goalie_id === b[i].goalie_id);
}

export function useGameEvents(code: string): GameEventsState {
  const { store, remote } = useSync();
  const [events, setEvents] = useState<StoredEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const flushing = useRef(false);
  const flushAgain = useRef(false);
  const shown = useRef<StoredEvent[]>([]);
  // Guards every async setState below: an in-flight call from a previous
  // `code` (or from after unmount) must not overwrite another game's state.
  const activeCode = useRef<string | null>(null);
  const isActive = (forCode: string) => activeCode.current === forCode;

  /** Shows `evs` for `forCode`, skipping the re-render when nothing changed (idle 5 s retries). */
  const show = useCallback((forCode: string, evs: StoredEvent[]) => {
    if (activeCode.current !== forCode || sameEvents(shown.current, evs)) return;
    shown.current = evs;
    setEvents(evs);
  }, []);

  const loadErrorRef = useRef(false);
  const showLoadError = useCallback((v: boolean) => {
    if (loadErrorRef.current === v) return;
    loadErrorRef.current = v;
    setLoadError(v);
  }, []);

  const flush = useCallback(async () => {
    if (flushing.current) {
      // Folded into the running flush: it makes one more pass when done.
      flushAgain.current = true;
      return;
    }
    flushing.current = true;
    try {
      for (;;) {
        flushAgain.current = false;
        const r = await flushOutbox(store, (e) => withTimeout(remote.push(e)), code);
        show(code, r.events);
        // Go again if asked during this pass, or if it succeeded but events were added meanwhile.
        const leftover = !r.failed && r.events.some((e) => e.sync === 'pending');
        if (!flushAgain.current && !leftover) break;
      }
    } finally {
      flushing.current = false;
    }
  }, [store, remote, code, show]);

  const refetch = useCallback(async () => {
    try {
      const rows = await remote.fetchEvents(code);
      const evs = await store.mergeRemote(code, rows);
      show(code, evs);
      if (isActive(code)) showLoadError(false);
    } catch {
      if (isActive(code)) showLoadError(true);
    }
  }, [store, remote, code, show, showLoadError]);

  useEffect(() => {
    activeCode.current = code;
    shown.current = [];
    void store.load(code).then((evs) => show(code, evs));
    void refetch();
    void flush();
    const unsubscribe = remote.subscribe(
      code,
      (e) => {
        void store.mergeRemote(code, [e]).then((evs) => show(code, evs));
      },
      (ok) => {
        if (isActive(code)) setConnected(ok);
        if (ok) {
          void refetch();
          void flush();
        }
      },
    );
    const onOnline = () => {
      void flush();
      void refetch();
    };
    window.addEventListener('online', onOnline);
    const timer = window.setInterval(() => void flush(), RETRY_MS);
    return () => {
      activeCode.current = null;
      unsubscribe();
      window.removeEventListener('online', onOnline);
      window.clearInterval(timer);
    };
  }, [code, store, remote, flush, refetch, show]);

  const record = useCallback(
    (e: GameEvent) => {
      void store.add(e).then((evs) => {
        show(code, evs);
        void flush();
      });
    },
    [store, flush, code, show],
  );

  const remove = useCallback(
    (id: string) => {
      void store.softDelete(code, id, new Date().toISOString()).then((evs) => {
        show(code, evs);
        void flush();
      });
    },
    [store, code, flush, show],
  );

  return { events, pending: events.filter((e) => e.sync === 'pending').length, connected, loadError, record, remove, refresh: refetch };
}
