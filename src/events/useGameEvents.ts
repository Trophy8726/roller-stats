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
  // Guards every async setState below: an in-flight call from a previous
  // `code` (or from after unmount) must not overwrite another game's state.
  const activeCode = useRef<string | null>(null);
  const isActive = (forCode: string) => activeCode.current === forCode;

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      const r = await flushOutbox(store, (e) => remote.push(e), code);
      if (isActive(code)) setEvents(r.events);
    } finally {
      flushing.current = false;
    }
  }, [store, remote, code]);

  const refetch = useCallback(async () => {
    try {
      const rows = await remote.fetchEvents(code);
      const evs = await store.mergeRemote(code, rows);
      if (isActive(code)) {
        setEvents(evs);
        setLoadError(false);
      }
    } catch {
      if (isActive(code)) setLoadError(true);
    }
  }, [store, remote, code]);

  useEffect(() => {
    activeCode.current = code;
    void store.load(code).then((evs) => {
      if (isActive(code)) setEvents(evs);
    });
    void refetch();
    void flush();
    const unsubscribe = remote.subscribe(
      code,
      (e) => {
        void store.mergeRemote(code, [e]).then((evs) => {
          if (isActive(code)) setEvents(evs);
        });
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
  }, [code, store, remote, flush, refetch]);

  const record = useCallback(
    (e: GameEvent) => {
      void store.add(e).then((evs) => {
        if (isActive(code)) setEvents(evs);
        void flush();
      });
    },
    [store, flush, code],
  );

  const remove = useCallback(
    (id: string) => {
      void store.softDelete(code, id, new Date().toISOString()).then((evs) => {
        if (isActive(code)) setEvents(evs);
        void flush();
      });
    },
    [store, code, flush],
  );

  return { events, pending: events.filter((e) => e.sync === 'pending').length, connected, loadError, record, remove };
}
