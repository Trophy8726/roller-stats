import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { Game, GameEvent, Goalie } from '../../domain/types';
import { t } from '../../i18n/fr';
import { faceoffEv, gameFx, noteEv, ownGoalEv, penaltyEv, shootoutEv, shotEv } from '../../test/builders';
import { makeDeps, renderWithSync } from '../../test/fakes';
import { ReportScreen } from './ReportScreen';

function renderReport() {
  const d = makeDeps({ games: [gameFx()] });
  [
    shotEv('shot_for', 'goal'),
    shotEv('shot_against', 'save'),
    shotEv('shot_against', 'save'),
    shotEv('shot_against', 'goal', { period: 2 }),
    shotEv('shot_against', 'blocked', { period: 2 }),
    faceoffEv('center', 'won'),
    faceoffEv('off_top', 'lost'),
  ].forEach((e) => d.fr.rows.set(e.id, e));
  const view = renderWithSync(<ReportScreen code="AB23" />, d.deps);
  return { ...d, ...view };
}

describe('ReportScreen', () => {
  it('shows the score, both save percentages and faceoff %', async () => {
    renderReport();
    expect(await screen.findByText('1 – 1')).toBeInTheDocument();
    const card = (label: string) => within(screen.getByText(label).closest('section')!);
    expect(card(t.report.ourSave).getByText('66,7 %')).toBeInTheDocument(); // our goalie: 2 saves / 3 on goal
    expect(card(t.report.oppSave).getByText('0 %')).toBeInTheDocument(); // their goalie: 0 saves / 1 on goal
    expect(card(t.report.shooting).getByText('100 %')).toBeInTheDocument(); // 1 goal / 1 on goal
  });

  it('shows the four shot levels per period', async () => {
    renderReport();
    await screen.findByText('1 – 1');
    const row = screen.getByRole('row', { name: new RegExp(t.report.levels.attempts) });
    expect(within(row).getAllByRole('cell').map((c) => c.textContent)).toEqual(['1', '0', '1', '2', '2', '4']);
  });

  it('filters the shot map by side', async () => {
    const { container } = renderReport();
    await screen.findByText('1 – 1');
    const map = () => container.querySelectorAll('svg.rink')[0].querySelectorAll('[data-result]').length;
    expect(map()).toBe(5);
    fireEvent.click(screen.getByRole('button', { name: t.report.for }));
    expect(map()).toBe(1);
  });
});

function renderReportWith(events: GameEvent[], opts: { goalies?: Goalie[]; game?: Partial<Game> } = {}) {
  const d = makeDeps({ games: [gameFx(opts.game)], goalies: opts.goalies });
  events.forEach((e) => d.fr.rows.set(e.id, e));
  const view = renderWithSync(<ReportScreen code="AB23" />, d.deps);
  return { ...d, ...view };
}
const mallet = [{ id: 'g1', name: 'François Mallet' }];

describe('report v2', () => {
  beforeEach(() => localStorage.clear());

  it('shows a line per goalie, keeping empty-net shots and CSC out of the save %', async () => {
    renderReportWith(
      [
        shotEv('shot_against', 'save', { goalie_id: 'g1' }), shotEv('shot_against', 'save', { goalie_id: 'g1' }),
        shotEv('shot_against', 'goal', { goalie_id: 'g1' }), shotEv('shot_against', 'goal', { empty_net: true }),
        ownGoalEv('own_goal_against', { goalie_id: 'g1' }),
      ],
      { goalies: mallet },
    );
    const table = await screen.findByRole('table', { name: t.report.goaliesTitle });
    const row = await within(table).findByRole('row', { name: /François Mallet/ });
    expect(within(row).getAllByRole('cell').map((c) => c.textContent)).toEqual(['3', '2', '1', '66,7 %', '1']);
  });

  it('puts shots without a goalie on the "Non renseigné" line and attaches a goalie on request', async () => {
    const d = renderReportWith(
      [shotEv('shot_against', 'save'), shotEv('shot_against', 'goal'), shotEv('shot_against', 'goal', { empty_net: true })],
      { goalies: mallet },
    );
    const table = await screen.findByRole('table', { name: t.report.goaliesTitle });
    expect(within(table).getByRole('row', { name: new RegExp(t.goalies.unset) })).toBeInTheDocument();
    expect(screen.getByText(t.report.assignHint(2))).toBeInTheDocument();
    await screen.findByRole('option', { name: 'François Mallet' });
    fireEvent.change(screen.getByLabelText(t.report.assignChoose), { target: { value: 'g1' } });
    fireEvent.click(screen.getByRole('button', { name: t.report.assignButton }));
    expect(await screen.findByText(t.report.assignDone(2))).toBeInTheDocument();
    const rows = [...d.fr.rows.values()];
    expect(rows.filter((r) => r.goalie_id === 'g1')).toHaveLength(2);
    expect(rows.find((r) => r.empty_net)?.goalie_id).toBeNull();
    await waitFor(() => expect(screen.queryByText(t.report.assignHint(2))).toBeNull());
    expect(within(await screen.findByRole('table', { name: t.report.goaliesTitle })).getByRole('row', { name: /François Mallet/ })).toBeInTheDocument();
  });

  it('does not offer to attach a goalie while entries are still waiting to be sent', async () => {
    const d = makeDeps({ games: [gameFx()], goalies: mallet });
    d.fr.setOnline(false);
    await d.deps.store.add(shotEv('shot_against', 'goal'));
    renderWithSync(<ReportScreen code="AB23" />, d.deps);
    expect(await screen.findByText(t.report.assignPending)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.report.assignButton })).toBeNull();
  });

  it('adds own goals to the score, shows the shootout and the extras', async () => {
    renderReportWith([
      shotEv('shot_for', 'goal'), ownGoalEv('own_goal_for'), ownGoalEv('own_goal_against'),
      shootoutEv('shootout_for', 'goal'), shootoutEv('shootout_against', 'save'),
    ]);
    expect(await screen.findByText('2 – 1')).toBeInTheDocument();
    expect(screen.getByText(t.report.shootoutScore(1, 0))).toBeInTheDocument();
    expect(screen.getByText(t.report.ownGoalsLine(1, 1))).toBeInTheDocument();
    expect(screen.getByText(t.report.shootoutLine('1/1', '0/1'))).toBeInTheDocument();
  });

  it('shows the shots by numerical situation', async () => {
    renderReportWith([shotEv('shot_for', 'goal', { strength: 'pp' }), shotEv('shot_against', 'save', { strength: 'pk' })]);
    const table = await screen.findByRole('table', { name: t.report.strengthTitle });
    const pp = within(table).getByRole('row', { name: new RegExp(t.strength.pp) });
    // The table is there before the events are loaded: wait for the numbers.
    await waitFor(() => expect(within(pp).getAllByRole('cell').map((c) => c.textContent)).toEqual(['1', '1', '1', '0', '0', '0']));
  });

  it('shows an overtime column only when there was overtime', async () => {
    const first = renderReportWith([shotEv('shot_for', 'goal')]);
    await screen.findByText('1 – 0');
    expect(screen.queryByRole('columnheader', { name: t.record.period(3) })).toBeNull();
    first.unmount();
    renderReportWith([shotEv('shot_for', 'goal', { period: 3 })]);
    expect((await screen.findAllByRole('columnheader', { name: t.record.period(3) })).length).toBeGreaterThan(0);
  });

  it('lists penalty shots and notes, and shows the competition in the header', async () => {
    renderReportWith([penaltyEv('shot_for', 'goal'), noteEv('terrain glissant', { period: 2 })], { game: { competition: 'coupe', venue: 'neutral' } });
    expect(await screen.findByText(/terrain glissant/)).toBeInTheDocument();
    // A substring match: the label contains parentheses, which a RegExp would read as a group.
    expect(screen.getByText(t.kinds.penalty_for, { exact: false })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${t.competitions.coupe} · ${t.venuesShort.neutral}`))).toBeInTheDocument();
  });

  it('exports to PDF through the print dialog and titles the page for the file name', async () => {
    const print = vi.fn();
    window.print = print;
    renderReportWith([shotEv('shot_for', 'goal')]);
    fireEvent.click(await screen.findByRole('button', { name: t.report.exportPdf }));
    expect(print).toHaveBeenCalledTimes(1);
    expect(document.title).toContain(t.report.title);
  });
});
