import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import type { Role } from '../../domain/types';
import { t } from '../../i18n/fr';
import { saveSetup } from '../../settings';
import { gameFx } from '../../test/builders';
import { makeDeps, renderWithSync } from '../../test/fakes';
import { RecordScreen } from './RecordScreen';

function renderRecord(role: Role = 'all') {
  const d = makeDeps({ games: [gameFx()] });
  saveSetup('AB23', { role, defendP1: 'left', period: 1 });
  renderWithSync(<RecordScreen code="AB23" />, d.deps);
  return d;
}

async function tapRink(x: number, y: number) {
  const svg = await screen.findByRole('group', { name: t.rink.label });
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 200, right: 400, bottom: 200, x: 0, y: 0, toJSON() {} }) as DOMRect;
  fireEvent.click(svg, { clientX: x, clientY: y });
}

const rows = (d: ReturnType<typeof renderRecord>) => [...d.fr.rows.values()];

describe('RecordScreen', () => {
  beforeEach(() => localStorage.clear());

  it('asks for role and side when this device has no setup', async () => {
    const d = makeDeps({ games: [gameFx()] });
    renderWithSync(<RecordScreen code="AB23" />, d.deps);
    expect(await screen.findByText(t.setup.chooseRole)).toBeInTheDocument();
    const start = screen.getByRole('button', { name: t.setup.start });
    expect(start).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: t.roles.shots_for }));
    fireEvent.click(screen.getByRole('button', { name: t.setup.defendLeft }));
    fireEvent.click(start);
    expect(await screen.findByText(t.record.tapShot)).toBeInTheDocument();
  });

  it('records a shot once, even if the result button is tapped twice', async () => {
    const d = renderRecord();
    await tapRink(360, 100);
    const goal = screen.getByRole('button', { name: t.results.goal });
    // Both taps must land before React commits the re-render that unmounts this button,
    // otherwise the second tap would hit a detached node and prove nothing about the guard:
    // testing-library's fireEvent wraps each call in its own act(), which flushes a render
    // between the two clicks and unmounts ResultButtons after the first one. A single act()
    // around two raw native .click() calls keeps both handler invocations inside one batch,
    // so the button (and its onClick) is still there for the second click, and both calls
    // close over the same pre-click render — this is what actually exercises the tapRef guard.
    act(() => {
      goal.click();
      goal.click();
    });
    // Assert against the LOCAL store, not the fake remote's rows: useGameEvents/flushOutbox
    // has its own concurrency guard (a `flushing` in-flight lock) that can silently drop a
    // second, near-simultaneous push to the fake remote and never retry within the test's
    // lifetime (retries are on a 5s timer we don't advance) — so `fr.rows.size` can read 1
    // even when the component genuinely recorded two events. The local store reflects
    // exactly how many events were added, independent of that unrelated race.
    await waitFor(async () => {
      const evs = await d.deps.store.load('AB23');
      expect(evs.filter((e) => !e.deleted_at)).toHaveLength(1);
    });
    const evs = await d.deps.store.load('AB23');
    expect(evs[0]).toMatchObject({ kind: 'shot_for', result: 'goal', period: 1, x: 0.9, y: 0.5 });
  });

  it('drops a half-finished tap when the mode changes', async () => {
    renderRecord();
    await tapRink(360, 100);
    expect(screen.getByRole('button', { name: t.results.goal })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t.modes.shot_against }));
    expect(screen.queryByRole('button', { name: t.results.goal })).toBeNull();
  });

  it('records a faceoff on a dot', async () => {
    const d = renderRecord();
    fireEvent.click(await screen.findByRole('button', { name: t.modes.faceoff }));
    fireEvent.click(screen.getByRole('button', { name: t.dots.off_top }));
    fireEvent.click(screen.getByRole('button', { name: t.results.won }));
    await waitFor(() => expect(d.fr.rows.size).toBe(1));
    expect(rows(d)[0]).toMatchObject({ kind: 'faceoff', dot: 'off_top', result: 'won' });
  });

  it('records a faceoff once, even if the result button is tapped twice', async () => {
    const d = renderRecord();
    fireEvent.click(await screen.findByRole('button', { name: t.modes.faceoff }));
    fireEvent.click(screen.getByRole('button', { name: t.dots.off_top }));
    const won = screen.getByRole('button', { name: t.results.won });
    // Same single-batch double-tap as the shot test above, exercising dotRef this time.
    act(() => {
      won.click();
      won.click();
    });
    // Same reasoning as the shot test: check the local store, not the fake remote's rows.
    await waitFor(async () => {
      const evs = await d.deps.store.load('AB23');
      expect(evs.filter((e) => !e.deleted_at)).toHaveLength(1);
    });
    const evs = await d.deps.store.load('AB23');
    expect(evs[0]).toMatchObject({ kind: 'faceoff', dot: 'off_top', result: 'won' });
  });

  it('warns at half-time, drops a pending tap and flips the ends', async () => {
    const d = renderRecord();
    await tapRink(360, 100);
    fireEvent.click(screen.getByRole('button', { name: 'P2' }));
    expect(screen.queryByRole('button', { name: t.results.goal })).toBeNull();
    expect(screen.getByRole('dialog', { name: t.record.halftimeTitle })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t.record.halftimeOk }));
    // In P2 we attack left on this device: a tap near the left goal is stored near x = 1.
    await tapRink(40, 100);
    fireEvent.click(screen.getByRole('button', { name: t.results.save }));
    await waitFor(() => expect(d.fr.rows.size).toBe(1));
    expect(rows(d)[0]).toMatchObject({ period: 2, x: 0.9 });
  });

  it('undoes the last entry of this device', async () => {
    const d = renderRecord();
    await tapRink(360, 100);
    fireEvent.click(screen.getByRole('button', { name: t.results.goal }));
    await waitFor(() => expect(d.fr.rows.size).toBe(1));
    fireEvent.click(screen.getByRole('button', { name: t.record.undoLast }));
    await waitFor(() => expect(rows(d)[0].deleted_at).not.toBeNull());
  });

  it('shows only the relevant buttons for a single-role tracker', async () => {
    renderRecord('shots_against');
    await screen.findByRole('group', { name: t.rink.label });
    expect(screen.queryByRole('button', { name: t.modes.shot_for })).toBeNull();
    await tapRink(40, 100);
    fireEvent.click(screen.getByRole('button', { name: t.results.blocked }));
    expect(await screen.findByText(`P1 · ${t.modes.shot_against} · ${t.results.blocked}`)).toBeInTheDocument();
  });
});
