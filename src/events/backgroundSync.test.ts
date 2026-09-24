import type { GameEvent } from '../domain/types';
import { shotEv } from '../test/builders';
import { fakeRemote } from '../test/fakes';
import { createBackgroundSync } from './backgroundSync';
import { EventStore, memoryKV } from './store';

function setup() {
  const store = new EventStore(memoryKV());
  const fr = fakeRemote();
  const bg = createBackgroundSync(store, fr.remote);
  return { store, fr, bg };
}

describe('createBackgroundSync', () => {
  it('pushes pending events of every game, even games no screen has open', async () => {
    const { store, fr, bg } = setup();
    fr.setOnline(false);
    await store.add(shotEv('shot_for', 'goal', { game_code: 'AAAA' }));
    await store.add(shotEv('shot_for', 'goal', { game_code: 'BBBB' }));
    await bg.run();
    expect(bg.pending()).toBe(2);
    expect(fr.rows.size).toBe(0);
    fr.setOnline(true);
    await bg.run();
    expect(fr.rows.size).toBe(2);
    expect(bg.pending()).toBe(0);
    expect(await store.pendingCodes()).toEqual([]);
  });

  it('notifies listeners only when the pending total changes', async () => {
    const { store, fr, bg } = setup();
    const seen: number[] = [];
    bg.subscribe(() => seen.push(bg.pending()));
    await bg.run();
    expect(seen).toEqual([]);
    fr.setOnline(false);
    await store.add(shotEv('shot_for', 'goal', { game_code: 'AAAA' }));
    await bg.run();
    await bg.run();
    expect(seen).toEqual([1]);
  });

  it('never runs two passes at once, but runs again when asked during a pass', async () => {
    const { store, fr, bg } = setup();
    let inFlight = 0;
    let maxInFlight = 0;
    const push = fr.remote.push.bind(fr.remote);
    fr.remote.push = async (e: GameEvent) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      await push(e);
      inFlight--;
    };
    await store.add(shotEv('shot_for', 'goal', { game_code: 'AAAA' }));
    const first = bg.run();
    // Recorded while the first pass is already running: must still be sent.
    await store.add(shotEv('shot_for', 'goal', { game_code: 'BBBB' }));
    const second = bg.run();
    await Promise.all([first, second]);
    expect(maxInFlight).toBe(1);
    expect(fr.rows.size).toBe(2);
  });

  it('flushes on the browser online event once started', async () => {
    const { store, fr, bg } = setup();
    fr.setOnline(false);
    await store.add(shotEv('shot_for', 'goal', { game_code: 'AAAA' }));
    const stop = bg.start();
    fr.setOnline(true);
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(fr.rows.size).toBe(1));
    stop();
  });
});
