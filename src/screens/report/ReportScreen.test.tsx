import { fireEvent, screen, within } from '@testing-library/react';
import { t } from '../../i18n/fr';
import { faceoffEv, gameFx, shotEv } from '../../test/builders';
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
