import { shotEv } from '../test/builders';
import { EventStore, memoryKV, mergeRemote, type StoredEvent } from './store';

const stored = (e: ReturnType<typeof shotEv>, extra: Partial<StoredEvent> = {}): StoredEvent => ({ ...e, sync: 'synced', mine: false, ...extra });

describe('EventStore', () => {
  it('adds an event as pending and mine', async () => {
    const s = new EventStore(memoryKV());
    const e = shotEv('shot_for', 'goal');
    expect(await s.add(e)).toEqual([{ ...e, sync: 'pending', mine: true }]);
  });

  it('ignores the same id twice', async () => {
    const s = new EventStore(memoryKV());
    const e = shotEv('shot_for', 'goal');
    await s.add(e);
    expect(await s.add(e)).toHaveLength(1);
  });

  it('keeps pending events across a page reload (new store, same storage)', async () => {
    const kv = memoryKV();
    const e = shotEv('shot_for', 'goal');
    await new EventStore(kv).add(e);
    expect(await new EventStore(kv).load('AB23')).toEqual([expect.objectContaining({ id: e.id, sync: 'pending' })]);
  });

  it('serializes concurrent writes', async () => {
    const s = new EventStore(memoryKV());
    await Promise.all([s.add(shotEv('shot_for', 'goal')), s.add(shotEv('shot_for', 'save')), s.add(shotEv('shot_for', 'missed'))]);
    expect(await s.load('AB23')).toHaveLength(3);
  });

  it('soft delete sets deleted_at and marks the event pending again', async () => {
    const s = new EventStore(memoryKV());
    const e = shotEv('shot_for', 'goal');
    await s.add(e);
    await s.markSynced('AB23', [{ id: e.id, deleted_at: null }]);
    const [after] = await s.softDelete('AB23', e.id, '2026-09-24T19:00:00.000Z');
    expect(after).toMatchObject({ deleted_at: '2026-09-24T19:00:00.000Z', sync: 'pending' });
  });

  it('does not mark synced if the event was deleted while it was being pushed', async () => {
    const s = new EventStore(memoryKV());
    const e = shotEv('shot_for', 'goal');
    await s.add(e);
    await s.softDelete('AB23', e.id, '2026-09-24T19:00:00.000Z');
    const [after] = await s.markSynced('AB23', [{ id: e.id, deleted_at: null }]);
    expect(after.sync).toBe('pending');
  });
});

describe('mergeRemote', () => {
  it('adds events from other devices as synced and not mine', () => {
    const r = shotEv('shot_against', 'save');
    expect(mergeRemote([], [r])).toEqual([{ ...r, sync: 'synced', mine: false }]);
  });
  it('applies a deletion made on another device', () => {
    const e = shotEv('shot_for', 'goal');
    const [m] = mergeRemote([stored(e, { mine: true })], [{ ...e, deleted_at: '2026-09-24T19:00:00Z' }]);
    expect(m).toMatchObject({ deleted_at: '2026-09-24T19:00:00Z', mine: true });
  });
  it('keeps an event that was already deleted before it ever reached this device', () => {
    const r = shotEv('shot_for', 'goal', { deleted_at: '2026-09-24T19:00:00Z' });
    expect(mergeRemote([], [r])[0].deleted_at).toBe('2026-09-24T19:00:00Z');
  });
  it('never un-deletes a local deletion because of an older remote copy', () => {
    const e = shotEv('shot_for', 'goal');
    const [m] = mergeRemote([stored(e, { deleted_at: '2026-09-24T19:00:00Z', sync: 'pending' })], [e]);
    expect(m.deleted_at).toBe('2026-09-24T19:00:00Z');
  });
  it('sorts by time even when timestamp formats differ', () => {
    const early = shotEv('shot_for', 'goal', { recorded_at: '2026-09-24T18:00:00+00:00' });
    const late = shotEv('shot_for', 'save', { recorded_at: '2026-09-24T18:00:05.000Z' });
    expect(mergeRemote([stored(late)], [early]).map((e) => e.id)).toEqual([early.id, late.id]);
  });
});
