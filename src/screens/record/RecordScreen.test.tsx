import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { Game, Goalie, Role } from '../../domain/types';
import { t } from '../../i18n/fr';
import { saveSetup, type RecordSetup } from '../../settings';
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

  it('warns when going back from P2 to P1, since the ends flip back', async () => {
    renderRecord();
    fireEvent.click(await screen.findByRole('button', { name: 'P2' }));
    fireEvent.click(screen.getByRole('button', { name: t.record.halftimeOk }));
    fireEvent.click(screen.getByRole('button', { name: 'P1' }));
    expect(screen.getByRole('dialog', { name: t.record.backToP1Title })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t.record.halftimeOk }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps the current period and side when the role or side is changed mid-game', async () => {
    const d = renderRecord();
    fireEvent.click(await screen.findByRole('button', { name: 'P2' }));
    fireEvent.click(screen.getByRole('button', { name: t.record.halftimeOk }));
    fireEvent.click(screen.getByRole('button', { name: t.setup.change }));
    // The previous choices are pre-selected.
    expect(screen.getByRole('button', { name: t.roles.all })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: t.setup.defendLeft })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: t.roles.shots_for }));
    fireEvent.click(screen.getByRole('button', { name: t.setup.start }));
    expect(screen.getByRole('button', { name: 'P2' })).toHaveAttribute('aria-pressed', 'true');
    // Still P2 with defendP1 'left': a tap near the left goal is stored near x = 1.
    await tapRink(40, 100);
    fireEvent.click(screen.getByRole('button', { name: t.results.goal }));
    await waitFor(() => expect(d.fr.rows.size).toBe(1));
    expect(rows(d)[0]).toMatchObject({ period: 2, x: 0.9, device_role: 'shots_for' });
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

function renderWith(opts: { role?: Role; goalies?: Goalie[]; game?: Partial<Game>; setup?: Partial<RecordSetup> } = {}) {
  const d = makeDeps({ games: [gameFx(opts.game)], goalies: opts.goalies });
  saveSetup('AB23', { role: opts.role ?? 'all', defendP1: 'left', period: 1, ...opts.setup });
  renderWithSync(<RecordScreen code="AB23" />, d.deps);
  return d;
}
const stored = (d: ReturnType<typeof renderWith>) => d.deps.store.load('AB23');
const openMisc = async () => fireEvent.click(await screen.findByRole('button', { name: t.misc.tab }));
const mallet = [{ id: 'g1', name: 'François Mallet' }];

describe('states and the Divers tab', () => {
  beforeEach(() => localStorage.clear());

  it('a shot against carries the goalie chosen in Divers, and the banner shows him', async () => {
    const d = renderWith({ goalies: mallet });
    expect(await screen.findByText(t.state.goalieUnset)).toBeInTheDocument();
    await openMisc();
    await screen.findByRole('option', { name: 'François Mallet' });
    fireEvent.change(screen.getByLabelText(t.misc.goalieTitle), { target: { value: 'g1' } });
    expect(await screen.findByText(t.state.goalie('François Mallet'))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t.modes.shot_against }));
    await tapRink(40, 100);
    fireEvent.click(screen.getByRole('button', { name: t.results.save }));
    await waitFor(async () => expect((await stored(d)).some((e) => e.kind === 'shot_against')).toBe(true));
    expect((await stored(d)).find((e) => e.kind === 'shot_against')).toMatchObject({ goalie_id: 'g1', empty_net: false });
  });

  it('"Notre filet désert" flags the next shots against and leaves them without a goalie', async () => {
    const d = renderWith({ goalies: mallet });
    await openMisc();
    await screen.findByRole('option', { name: t.state.ourNetEmpty });
    fireEvent.change(screen.getByLabelText(t.misc.goalieTitle), { target: { value: '__empty__' } });
    expect(await screen.findByText(t.state.ourNetEmpty, { selector: '.banner' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t.modes.shot_against }));
    await tapRink(40, 100);
    fireEvent.click(screen.getByRole('button', { name: t.results.goal }));
    await waitFor(async () => expect((await stored(d)).some((e) => e.kind === 'shot_against')).toBe(true));
    expect((await stored(d)).find((e) => e.kind === 'shot_against')).toMatchObject({ goalie_id: null, empty_net: true });
  });

  it('undoing the last change brings the previous state back', async () => {
    renderWith({ goalies: mallet });
    await openMisc();
    await screen.findByRole('option', { name: 'François Mallet' });
    fireEvent.change(screen.getByLabelText(t.misc.goalieTitle), { target: { value: 'g1' } });
    await screen.findByText(t.state.goalie('François Mallet'));
    fireEvent.click(screen.getByRole('button', { name: t.record.undoLast }));
    expect(await screen.findByText(t.state.goalieUnset)).toBeInTheDocument();
  });

  it('the opponent empty net flags our next shots for', async () => {
    const d = renderWith();
    await openMisc();
    fireEvent.click(screen.getByRole('button', { name: t.misc.theirNetToggle }));
    await waitFor(() => expect(document.querySelector('.banner')).toHaveTextContent(t.state.theirNetEmpty));
    fireEvent.click(screen.getByRole('button', { name: t.modes.shot_for }));
    await tapRink(360, 100);
    fireEvent.click(screen.getByRole('button', { name: t.results.goal }));
    await waitFor(async () => expect((await stored(d)).some((e) => e.kind === 'shot_for')).toBe(true));
    expect((await stored(d)).find((e) => e.kind === 'shot_for')).toMatchObject({ empty_net: true, goalie_id: null });
  });

  it('the numerical situation tags the shots that follow', async () => {
    const d = renderWith();
    await openMisc();
    fireEvent.click(within(screen.getByRole('group', { name: t.misc.strengthTitle })).getByRole('button', { name: t.strength.pp }));
    await waitFor(() => expect(document.querySelector('.banner')).toHaveTextContent(t.strength.pp));
    fireEvent.click(screen.getByRole('button', { name: t.modes.shot_for }));
    await tapRink(360, 100);
    fireEvent.click(screen.getByRole('button', { name: t.results.save }));
    await waitFor(async () => expect((await stored(d)).some((e) => e.kind === 'shot_for')).toBe(true));
    expect((await stored(d)).find((e) => e.kind === 'shot_for')).toMatchObject({ strength: 'pp' });
  });

  it('a CSC is recorded once even if the small button is double tapped, and shows in the recent list', async () => {
    const d = renderWith();
    await openMisc();
    const csc = screen.getByRole('button', { name: t.misc.ownGoalFor });
    act(() => {
      csc.click();
      csc.click();
    });
    await waitFor(async () => expect((await stored(d)).filter((e) => e.kind === 'own_goal_for')).toHaveLength(1));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });
    expect((await stored(d)).filter((e) => e.kind === 'own_goal_for')).toHaveLength(1);
    expect(screen.getByText(`P1 · ${t.kinds.own_goal_for}`)).toBeInTheDocument();
  });

  it('a penalty shot has no position and counts as a shot', async () => {
    const d = renderWith({ game: { overtime_possible: false } });
    await openMisc();
    fireEvent.click(screen.getByRole('button', { name: t.misc.penaltyAgainst }));
    fireEvent.click(screen.getByRole('button', { name: t.results.save }));
    await waitFor(async () => expect((await stored(d)).some((e) => e.penalty_shot)).toBe(true));
    expect((await stored(d)).find((e) => e.penalty_shot)).toMatchObject({ kind: 'shot_against', result: 'save', x: null, y: null });
  });

  it('records shootout attempts and shows the running count', async () => {
    const d = renderWith();
    await openMisc();
    fireEvent.click(within(screen.getByRole('group', { name: t.misc.shootoutUs })).getByRole('button', { name: t.results.goal }));
    expect(await screen.findByText(t.misc.shootoutCount('1/1', '0/0'))).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('group', { name: t.misc.shootoutThem })).getByRole('button', { name: t.results.save }));
    await waitFor(async () => expect((await stored(d)).map((e) => e.kind).sort()).toEqual(['shootout_against', 'shootout_for']));
  });

  it('has no shootout section when overtime is not possible', async () => {
    renderWith({ game: { overtime_possible: false } });
    await openMisc();
    expect(screen.queryByRole('group', { name: t.misc.shootoutUs })).toBeNull();
    expect(screen.queryByRole('button', { name: t.record.period(3) })).toBeNull();
  });

  it('adds a free note', async () => {
    const d = renderWith();
    await openMisc();
    fireEvent.change(screen.getByLabelText(t.misc.noteTitle), { target: { value: '  terrain glissant ' } });
    fireEvent.click(screen.getByRole('button', { name: t.misc.noteAdd }));
    await waitFor(async () => expect((await stored(d)).some((e) => e.kind === 'note')).toBe(true));
    expect((await stored(d)).find((e) => e.kind === 'note')).toMatchObject({ note: 'terrain glissant', result: 'note' });
  });

  it('a single-role tracker still gets the Divers tab', async () => {
    renderWith({ role: 'shots_against' });
    expect(await screen.findByRole('button', { name: t.misc.tab })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.modes.shot_for })).toBeNull();
  });

  it('clicking the banner opens the Divers tab', async () => {
    renderWith();
    fireEvent.click(await screen.findByText(t.state.goalieUnset));
    expect(await screen.findByLabelText(t.misc.goalieTitle)).toBeInTheDocument();
  });
});

describe('overtime', () => {
  beforeEach(() => localStorage.clear());

  it('asks which side we defend, then records shots in period 3 with the right orientation', async () => {
    const d = renderWith();
    fireEvent.click(await screen.findByRole('button', { name: t.record.period(3) }));
    const dialog = screen.getByRole('dialog', { name: t.record.overtimeSideTitle });
    fireEvent.click(within(dialog).getByRole('button', { name: t.setup.defendRight }));
    expect(screen.queryByRole('dialog')).toBeNull();
    // Defending the right side in overtime, we attack left: a tap at 90 % of the width is stored at 10 %.
    await tapRink(360, 100);
    fireEvent.click(screen.getByRole('button', { name: t.results.goal }));
    await waitFor(async () => expect((await stored(d)).some((e) => e.kind === 'shot_for')).toBe(true));
    expect((await stored(d)).find((e) => e.kind === 'shot_for')).toMatchObject({ period: 3, x: 0.1, y: 0.5 });
  });

  it('does not ask again when the side is already known, and warns about the ends instead', async () => {
    renderWith({ setup: { period: 2, defendOT: 'left' } });
    fireEvent.click(await screen.findByRole('button', { name: t.record.period(3) }));
    expect(screen.getByRole('dialog', { name: t.record.overtimeTitle })).toBeInTheDocument();
  });
});
