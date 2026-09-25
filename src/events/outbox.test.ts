import { toRow } from '../domain/factory';
import type { GameEvent } from '../domain/types';
import { shotEv } from '../test/builders';
import { flushOutbox, withTimeout } from './outbox';
import { EventStore, memoryKV } from './store';

function server() {
  const rows = new Map<string, GameEvent>();
  let online = true;
  const push = async (e: GameEvent) => {
    if (!online) throw new Error('offline');
    const r = toRow(e);
    const existing = rows.get(r.id);
    rows.set(r.id, existing ? { ...existing, deleted_at: r.deleted_at ?? existing.deleted_at } : r);
  };
  return { rows, push, setOnline: (v: boolean) => (online = v) };
}

describe('flushOutbox', () => {
  it('pushes pending events and marks them synced', async () => {
    const s = new EventStore(memoryKV());
    const srv = server();
    await s.add(shotEv('shot_for', 'goal'));
    const r = await flushOutbox(s, srv.push, 'AB23');
    expect(r).toMatchObject({ pushed: 1, failed: false });
    expect(r.events[0].sync).toBe('synced');
    expect(srv.rows.size).toBe(1);
  });

  it('keeps events pending while offline and sends them later', async () => {
    const s = new EventStore(memoryKV());
    const srv = server();
    srv.setOnline(false);
    await s.add(shotEv('shot_for', 'goal'));
    expect((await flushOutbox(s, srv.push, 'AB23')).failed).toBe(true);
    expect((await s.load('AB23'))[0].sync).toBe('pending');
    srv.setOnline(true);
    expect((await flushOutbox(s, srv.push, 'AB23')).pushed).toBe(1);
  });

  it('never duplicates when flushed twice concurrently', async () => {
    const s = new EventStore(memoryKV());
    const srv = server();
    await s.add(shotEv('shot_for', 'goal'));
    await Promise.all([flushOutbox(s, srv.push, 'AB23'), flushOutbox(s, srv.push, 'AB23')]);
    expect(srv.rows.size).toBe(1);
  });

  it('sends a deletion made after the event was synced', async () => {
    const s = new EventStore(memoryKV());
    const srv = server();
    const e = shotEv('shot_for', 'goal');
    await s.add(e);
    await flushOutbox(s, srv.push, 'AB23');
    await s.softDelete('AB23', e.id, '2026-09-24T19:00:00.000Z');
    await flushOutbox(s, srv.push, 'AB23');
    expect(srv.rows.get(e.id)?.deleted_at).toBe('2026-09-24T19:00:00.000Z');
  });
});

describe('withTimeout', () => {
  it('rejects a request that never answers, so the outbox lock is released', async () => {
    await expect(withTimeout(new Promise(() => {}), 10)).rejects.toThrow('timeout');
  });
  it('passes through a result or an error that arrives in time', async () => {
    await expect(withTimeout(Promise.resolve(3), 1000)).resolves.toBe(3);
    await expect(withTimeout(Promise.reject(new Error('offline')), 1000)).rejects.toThrow('offline');
  });
});
