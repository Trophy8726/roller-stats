import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameEvent } from '../domain/types';
import { flushOutbox } from './outbox';
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
}

export function useGameEvents(code: string): GameEventsState {
  const { store, remote } = useSync();
  const [events, setEvents] = useState<StoredEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const flushing = useRef(false);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      const r = await flushOutbox(store, (e) => remote.push(e), code);
      setEvents(r.events);
    } finally {
      flushing.current = false;
    }
  }, [store, remote, code]);

  const refetch = useCallback(async () => {
    try {
      const rows = await remote.fetchEvents(code);
      setEvents(await store.mergeRemote(code, rows));
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [store, remote, code]);

  useEffect(() => {
    let alive = true;
    void store.load(code).then((evs) => {
      if (alive) setEvents(evs);
    });
    void refetch();
    void flush();
    const unsubscribe = remote.subscribe(
      code,
      (e) => {
        void store.mergeRemote(code, [e]).then((evs) => {
          if (alive) setEvents(evs);
        });
      },
      (ok) => {
        setConnected(ok);
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
      alive = false;
      unsubscribe();
      window.removeEventListener('online', onOnline);
      window.clearInterval(timer);
    };
  }, [code, store, remote, flush, refetch]);

  const record = useCallback(
    (e: GameEvent) => {
      void store.add(e).then((evs) => {
        setEvents(evs);
        void flush();
      });
    },
    [store, flush],
  );

  const remove = useCallback(
    (id: string) => {
      void store.softDelete(code, id, new Date().toISOString()).then((evs) => {
        setEvents(evs);
        void flush();
      });
    },
    [store, code, flush],
  );

  return { events, pending: events.filter((e) => e.sync === 'pending').length, connected, loadError, record, remove };
}
