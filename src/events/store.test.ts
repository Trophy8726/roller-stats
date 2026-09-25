import { shotEv } from '../test/builders';
import { EventStore, memoryKV, mergeRemote, type StoredEvent } from './store';

const stored = (e: ReturnType<typeof shotEv>, extra: Partial<StoredEvent> = {}): StoredEvent => ({ ...e, sync: 'synced', mine: false, ...extra });

describe('EventStore', () => {
  it('adds an event as pending and mine', async () => {
    const s = new EventStore(memoryKV());
    const e = shotEv('shot_for', 'goal');
    expect(await s.add(e)).toEqual([{ ...e, sync: 'pending', mine: true }]);
  });

  it('loads events stored by v1 with the new columns filled in', async () => {
    const kv = memoryKV();
    const legacy = { ...shotEv('shot_for', 'goal'), sync: 'pending', mine: true } as Record<string, unknown>;
    for (const k of ['goalie_id', 'empty_net', 'strength', 'penalty_shot', 'note']) delete legacy[k];
    await kv.set('events:AB23', [legacy]);
    const [e] = await new EventStore(kv).load('AB23');
    expect(e).toMatchObject({ goalie_id: null, empty_net: false, strength: 'even', penalty_shot: false, note: null });
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

describe('EventStore.pendingCodes', () => {
  it('lists the games that still have pending events, and forgets them once synced', async () => {
    const s = new EventStore(memoryKV());
    const a = shotEv('shot_for', 'goal', { game_code: 'AAAA' });
    const b = shotEv('shot_for', 'goal', { game_code: 'BBBB' });
    await s.add(a);
    await s.add(b);
    expect((await s.pendingCodes()).sort()).toEqual(['AAAA', 'BBBB']);
    await s.markSynced('AAAA', [{ id: a.id, deleted_at: null }]);
    expect(await s.pendingCodes()).toEqual(['BBBB']);
  });

  it('lists a game again when a synced event is deleted', async () => {
    const s = new EventStore(memoryKV());
    const e = shotEv('shot_for', 'goal', { game_code: 'AAAA' });
    await s.add(e);
    await s.markSynced('AAAA', [{ id: e.id, deleted_at: null }]);
    expect(await s.pendingCodes()).toEqual([]);
    await s.softDelete('AAAA', e.id, '2026-09-24T19:00:00.000Z');
    expect(await s.pendingCodes()).toEqual(['AAAA']);
  });

  it('survives a reload (new store, same storage)', async () => {
    const kv = memoryKV();
    await new EventStore(kv).add(shotEv('shot_for', 'goal', { game_code: 'AAAA' }));
    expect(await new EventStore(kv).pendingCodes()).toEqual(['AAAA']);
  });

  it('rebuilds the index from event lists written before it existed', async () => {
    const kv = memoryKV();
    await kv.set('events:AAAA', [{ ...shotEv('shot_for', 'goal', { game_code: 'AAAA' }), sync: 'pending', mine: true }]);
    await kv.set('events:BBBB', [{ ...shotEv('shot_for', 'goal', { game_code: 'BBBB' }), sync: 'synced', mine: true }]);
    expect(await new EventStore(kv).pendingCodes()).toEqual(['AAAA']);
  });

  it('counts pending events across all games', async () => {
    const s = new EventStore(memoryKV());
    await s.add(shotEv('shot_for', 'goal', { game_code: 'AAAA' }));
    await s.add(shotEv('shot_for', 'goal', { game_code: 'AAAA' }));
    await s.add(shotEv('shot_for', 'goal', { game_code: 'BBBB' }));
    expect(await s.pendingTotal()).toBe(3);
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
  it('fills in a goalie attached on the server afterwards', () => {
    const e = shotEv('shot_against', 'goal');
    const [m] = mergeRemote([stored(e)], [{ ...e, goalie_id: 'g1' }]);
    expect(m.goalie_id).toBe('g1');
  });
  it('never replaces or removes a goalie that is already there', () => {
    const e = shotEv('shot_against', 'goal', { goalie_id: 'g1' });
    expect(mergeRemote([stored(e)], [{ ...e, goalie_id: 'g2' }])[0].goalie_id).toBe('g1');
    expect(mergeRemote([stored(e)], [{ ...e, goalie_id: null }])[0].goalie_id).toBe('g1');
  });
  it('sorts by time even when timestamp formats differ', () => {
    const early = shotEv('shot_for', 'goal', { recorded_at: '2026-09-24T18:00:00+00:00' });
    const late = shotEv('shot_for', 'save', { recorded_at: '2026-09-24T18:00:05.000Z' });
    expect(mergeRemote([stored(late)], [early]).map((e) => e.id)).toEqual([early.id, late.id]);
  });
});
