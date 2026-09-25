import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { t } from '../i18n/fr';
import { gameFx, shotEv, stateEv } from '../test/builders';
import { makeDeps, renderWithSync } from '../test/fakes';
import { SeasonScreen } from './SeasonScreen';

function renderSeason(extraGames: ReturnType<typeof gameFx>[] = []) {
  const d = makeDeps({
    games: [
      gameFx({ code: 'AAAA', opponent: 'Rouen', game_date: '2026-09-20' }),
      gameFx({ code: 'BBBB', opponent: 'Caen', game_date: '2026-09-27' }),
      ...extraGames,
    ],
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

  const gamesCard = () => screen.getByText(t.season.games, { selector: 'span' }).nextElementSibling?.textContent;
  const goalsRow = () => {
    const totals = screen.getByRole('table', { name: t.season.totals });
    return within(within(totals).getByRole('row', { name: new RegExp(t.report.levels.goals) }))
      .getAllByRole('cell')
      .map((c) => c.textContent);
  };

  it('leaves a game with no entries out of the season stats, unticked', async () => {
    renderSeason([gameFx({ code: 'CCCC', opponent: 'Test', game_date: '2026-09-22' })]);
    await screen.findByRole('table', { name: t.season.byGame });
    expect(gamesCard()).toBe('2');
    expect(goalsRow()).toEqual(['2', '1', '0', '0']);
    expect(screen.getByRole('checkbox', { name: /Test/ })).not.toBeChecked();
  });

  it('applies the game selection to the totals and averages, not only the map', async () => {
    renderSeason();
    await screen.findByRole('table', { name: t.season.byGame });
    fireEvent.click(screen.getByRole('checkbox', { name: /Rouen/ }));
    expect(gamesCard()).toBe('1');
    expect(goalsRow()).toEqual(['0', '0', '0', '0']);
  });
});

describe('season v2', () => {
  function renderMixed() {
    const d = makeDeps({
      games: [
        gameFx({ code: 'AAAA', opponent: 'Rouen', game_date: '2026-09-20' }),
        gameFx({ code: 'BBBB', opponent: 'Caen', competition: 'coupe', game_date: '2026-09-27' }),
      ],
      goalies: [{ id: 'g1', name: 'François Mallet' }, { id: 'g2', name: 'Bernard' }],
    });
    [
      shotEv('shot_against', 'save', { game_code: 'AAAA', goalie_id: 'g1' }),
      shotEv('shot_against', 'goal', { game_code: 'AAAA', goalie_id: 'g1' }),
      shotEv('shot_against', 'save', { game_code: 'BBBB', goalie_id: 'g2' }),
    ].forEach((e) => d.fr.rows.set(e.id, e));
    return renderWithSync(<SeasonScreen />, d.deps);
  }

  it('shows Championnat by default and switches competition', async () => {
    renderMixed();
    const byGame = () => screen.getByRole('table', { name: t.season.byGame });
    await screen.findByRole('table', { name: t.season.byGame });
    expect(within(byGame()).getByText('Rouen')).toBeInTheDocument();
    expect(within(byGame()).queryByText('Caen')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: t.competitions.coupe }));
    expect(await within(byGame()).findByText('Caen')).toBeInTheDocument();
    expect(within(byGame()).queryByText('Rouen')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: t.season.allCompetitions }));
    expect(await within(byGame()).findByText('Rouen')).toBeInTheDocument();
    expect(within(byGame()).getByText('Caen')).toBeInTheDocument();
  });

  it('lists the goalies of the games in view, per competition', async () => {
    renderMixed();
    const goalies = () => screen.getByRole('table', { name: t.season.goalies });
    const row = await within(await screen.findByRole('table', { name: t.season.goalies })).findByRole('row', { name: /François Mallet/ });
    expect(within(row).getAllByRole('cell').map((c) => c.textContent)).toEqual(['1', '2', '1', '1', '50 %', '0']);
    expect(within(goalies()).queryByRole('row', { name: /Bernard/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: t.season.allCompetitions }));
    expect(await within(goalies()).findByRole('row', { name: /Bernard/ })).toBeInTheDocument();
  });

  it('a game that only has a goalie state gives its goalie no game played', async () => {
    const d = makeDeps({
      games: [
        gameFx({ code: 'AAAA', opponent: 'Rouen', game_date: '2026-09-20' }),
        gameFx({ code: 'CCCC', opponent: 'Test', game_date: '2026-09-22' }),
      ],
      goalies: [{ id: 'g1', name: 'François Mallet' }, { id: 'g2', name: 'Bernard' }],
    });
    [
      shotEv('shot_against', 'save', { game_code: 'AAAA', goalie_id: 'g1' }),
      stateEv('state_our_goalie', 'goalie', { game_code: 'AAAA', goalie_id: 'g1' }),
      stateEv('state_our_goalie', 'goalie', { game_code: 'CCCC', goalie_id: 'g2' }),
    ].forEach((e) => d.fr.rows.set(e.id, e));
    renderWithSync(<SeasonScreen />, d.deps);
    const table = await screen.findByRole('table', { name: t.season.goalies });
    expect(await within(table).findByRole('row', { name: /François Mallet/ })).toBeInTheDocument();
    expect(within(table).queryByRole('row', { name: /Bernard/ })).toBeNull();
    expect(screen.getByRole('checkbox', { name: /Test/ })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Test/ })).toBeDisabled();
  });

  it('an unticked game leaves the goalie table too', async () => {
    renderMixed();
    await within(await screen.findByRole('table', { name: t.season.goalies })).findByRole('row', { name: /François Mallet/ });
    fireEvent.click(screen.getByRole('checkbox', { name: /Rouen/ }));
    await waitFor(() => expect(screen.queryByRole('table', { name: t.season.goalies })).toBeNull());
  });
});
