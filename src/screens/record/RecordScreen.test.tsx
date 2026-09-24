import { fireEvent, screen, waitFor } from '@testing-library/react';
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
  return d.fr;
}

async function tapRink(x: number, y: number) {
  const svg = await screen.findByRole('group', { name: t.rink.label });
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 200, right: 400, bottom: 200, x: 0, y: 0, toJSON() {} }) as DOMRect;
  fireEvent.click(svg, { clientX: x, clientY: y });
}

const rows = (fr: ReturnType<typeof renderRecord>) => [...fr.rows.values()];

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
    const fr = renderRecord();
    await tapRink(360, 100);
    const goal = screen.getByRole('button', { name: t.results.goal });
    fireEvent.click(goal);
    fireEvent.click(goal);
    await waitFor(() => expect(fr.rows.size).toBe(1));
    expect(rows(fr)[0]).toMatchObject({ kind: 'shot_for', result: 'goal', period: 1, x: 0.9, y: 0.5 });
  });

  it('drops a half-finished tap when the mode changes', async () => {
    renderRecord();
    await tapRink(360, 100);
    expect(screen.getByRole('button', { name: t.results.goal })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t.modes.shot_against }));
    expect(screen.queryByRole('button', { name: t.results.goal })).toBeNull();
  });

  it('records a faceoff on a dot', async () => {
    const fr = renderRecord();
    fireEvent.click(await screen.findByRole('button', { name: t.modes.faceoff }));
    fireEvent.click(screen.getByRole('button', { name: t.dots.off_top }));
    fireEvent.click(screen.getByRole('button', { name: t.results.won }));
    await waitFor(() => expect(fr.rows.size).toBe(1));
    expect(rows(fr)[0]).toMatchObject({ kind: 'faceoff', dot: 'off_top', result: 'won' });
  });

  it('warns at half-time, drops a pending tap and flips the ends', async () => {
    const fr = renderRecord();
    await tapRink(360, 100);
    fireEvent.click(screen.getByRole('button', { name: 'P2' }));
    expect(screen.queryByRole('button', { name: t.results.goal })).toBeNull();
    expect(screen.getByRole('dialog', { name: t.record.halftimeTitle })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t.record.halftimeOk }));
    // In P2 we attack left on this device: a tap near the left goal is stored near x = 1.
    await tapRink(40, 100);
    fireEvent.click(screen.getByRole('button', { name: t.results.save }));
    await waitFor(() => expect(fr.rows.size).toBe(1));
    expect(rows(fr)[0]).toMatchObject({ period: 2, x: 0.9 });
  });

  it('undoes the last entry of this device', async () => {
    const fr = renderRecord();
    await tapRink(360, 100);
    fireEvent.click(screen.getByRole('button', { name: t.results.goal }));
    await waitFor(() => expect(fr.rows.size).toBe(1));
    fireEvent.click(screen.getByRole('button', { name: t.record.undoLast }));
    await waitFor(() => expect(rows(fr)[0].deleted_at).not.toBeNull());
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
