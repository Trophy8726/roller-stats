import { fireEvent, screen, within } from '@testing-library/react';
import { t } from '../i18n/fr';
import { gameFx, shotEv } from '../test/builders';
import { makeDeps, renderWithSync } from '../test/fakes';
import { SeasonScreen } from './SeasonScreen';

function renderSeason() {
  const d = makeDeps({
    games: [gameFx({ code: 'AAAA', opponent: 'Rouen', game_date: '2026-09-20' }), gameFx({ code: 'BBBB', opponent: 'Caen', game_date: '2026-09-27' })],
  });
  [
    shotEv('shot_for', 'goal', { game_code: 'AAAA' }),
    shotEv('shot_for', 'goal', { game_code: 'AAAA' }),
    shotEv('shot_against', 'save', { game_code: 'BBBB' }),
  ].forEach((e) => d.fr.rows.set(e.id, e));
  return renderWithSync(<SeasonScreen />, d.deps);
}

describe('SeasonScreen', () => {
  it('lists every game with its score, newest first', async () => {
    renderSeason();
    const table = await screen.findByRole('table', { name: t.season.byGame });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((r) => within(r).getAllByRole('cell')[0].textContent)).toEqual(['Caen', 'Rouen']);
    expect(within(rows[1]).getByText('2 – 0')).toBeInTheDocument();
  });

  it('shows per-game averages', async () => {
    renderSeason();
    const totals = await screen.findByRole('table', { name: t.season.totals });
    const goals = within(totals).getByRole('row', { name: new RegExp(t.report.levels.goals) });
    expect(within(goals).getAllByRole('cell').map((c) => c.textContent)).toEqual(['2', '1', '0', '0']);
  });

  it('limits the combined map to the selected games', async () => {
    const { container } = renderSeason();
    await screen.findByRole('table', { name: t.season.byGame });
    const count = () => container.querySelector('svg.rink')!.querySelectorAll('[data-result]').length;
    expect(count()).toBe(3);
    fireEvent.click(screen.getByRole('checkbox', { name: /Rouen/ }));
    expect(count()).toBe(1);
  });
});
