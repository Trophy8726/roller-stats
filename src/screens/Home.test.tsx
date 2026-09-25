import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { t } from '../i18n/fr';
import { gameFx, shotEv } from '../test/builders';
import { makeDeps, renderWithSync } from '../test/fakes';
import { Home } from './Home';

function renderHome(games = [gameFx({ code: 'K7QX' })]) {
  const d = makeDeps({ games });
  renderWithSync(<Home />, d.deps);
  return d;
}

describe('Home', () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '';
  });

  it('joins an existing game with a lowercase, spaced code', async () => {
    renderHome();
    await userEvent.type(screen.getByLabelText(t.home.codeLabel), ' k7qx ');
    await userEvent.click(screen.getByRole('button', { name: t.home.joinButton }));
    await waitFor(() => expect(window.location.hash).toBe('#/saisie/K7QX'));
  });

  it('shows an error for an unknown code', async () => {
    renderHome([]);
    await userEvent.type(screen.getByLabelText(t.home.codeLabel), 'ZZZZ');
    await userEvent.click(screen.getByRole('button', { name: t.home.joinButton }));
    expect(await screen.findByText(t.errors.unknownCode)).toBeInTheDocument();
  });

  it('rejects malformed codes', async () => {
    renderHome();
    await userEvent.type(screen.getByLabelText(t.home.codeLabel), 'AB1');
    await userEvent.click(screen.getByRole('button', { name: t.home.joinButton }));
    expect(await screen.findByText(t.errors.badCode)).toBeInTheDocument();
  });

  it('creates a game, shows its code and remembers the team name', async () => {
    renderHome([]);
    await userEvent.type(screen.getByLabelText(t.home.team), 'Nous');
    await userEvent.type(screen.getByLabelText(t.home.opponent), 'Rouen');
    await userEvent.click(screen.getByRole('button', { name: t.home.create }));
    expect(await screen.findByText('K7QX')).toBeInTheDocument();
    expect(localStorage.getItem('teamName')).toBe('Nous');
  });

  it('explains when the server is unreachable', async () => {
    const d = makeDeps();
    d.fg.setFailing(true);
    renderWithSync(<Home />, d.deps);
    expect(await screen.findByText(t.errors.server)).toBeInTheDocument();
  });

  it('sends entries left pending by a closed game as soon as the connection is back, and shows the backlog', async () => {
    const d = makeDeps({ games: [gameFx({ code: 'K7QX' })] });
    d.fr.setOnline(false);
    // Recorded offline on the Saisie screen, which has since been closed.
    await d.deps.store.add(shotEv('shot_for', 'goal', { game_code: 'K7QX' }));
    renderWithSync(<Home />, d.deps);
    expect(await screen.findByText(t.sync.pending(1))).toBeInTheDocument();
    d.fr.setOnline(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(d.fr.rows.size).toBe(1));
    await waitFor(() => expect(screen.queryByText(t.sync.pending(1))).toBeNull());
  });

  it('lists recent games with links', async () => {
    renderHome([gameFx({ code: 'K7QX', opponent: 'Caen' })]);
    expect(await screen.findByText('Caen')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t.nav.report })).toHaveAttribute('href', '#/rapport/K7QX');
  });
});

describe('Home v2', () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '';
  });

  async function fillNames() {
    await userEvent.type(screen.getByLabelText(t.home.team), 'Nous');
    await userEvent.type(screen.getByLabelText(t.home.opponent), 'Rouen');
  }

  it('creates a playoffs game on neutral ground with the sheet side and the overtime box ticked by hand', async () => {
    const d = makeDeps();
    renderWithSync(<Home />, d.deps);
    await fillNames();
    expect(screen.getByLabelText(t.home.overtimePossible)).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: t.competitions.playoffs }));
    expect(screen.getByLabelText(t.home.overtimePossible)).not.toBeChecked();
    await userEvent.click(screen.getByLabelText(t.home.overtimePossible));
    expect(screen.queryByRole('button', { name: t.sheetSides.visitor })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: t.venues.neutral }));
    await userEvent.click(screen.getByRole('button', { name: t.sheetSides.visitor }));
    await userEvent.click(screen.getByRole('button', { name: t.home.create }));
    await screen.findByText('K7QX');
    expect(d.fg.games.at(-1)).toMatchObject({
      competition: 'playoffs', venue: 'neutral', home: false, sheet_side: 'visitor', overtime_possible: true,
    });
  });

  it('a league game at home has no sheet side and allows overtime by default', async () => {
    const d = makeDeps();
    renderWithSync(<Home />, d.deps);
    await fillNames();
    await userEvent.click(screen.getByRole('button', { name: t.home.create }));
    await screen.findByText('K7QX');
    expect(d.fg.games.at(-1)).toMatchObject({ competition: 'championnat', venue: 'home', home: true, sheet_side: null, overtime_possible: true });
  });

  it('records the starting goalie as a goalie change when the game is created', async () => {
    const d = makeDeps({ goalies: [{ id: 'g1', name: 'François Mallet' }] });
    renderWithSync(<Home />, d.deps);
    await fillNames();
    await screen.findByRole('option', { name: 'François Mallet' });
    await userEvent.selectOptions(screen.getByLabelText(t.home.startGoalie), 'g1');
    await userEvent.click(screen.getByRole('button', { name: t.home.create }));
    await screen.findByText('K7QX');
    const [ev] = await d.deps.store.load('K7QX');
    expect(ev).toMatchObject({ kind: 'state_our_goalie', result: 'goalie', goalie_id: 'g1', period: 1 });
  });

  it('"Notre filet désert" records an empty net as the starting state', async () => {
    const d = makeDeps();
    renderWithSync(<Home />, d.deps);
    await fillNames();
    await userEvent.selectOptions(screen.getByLabelText(t.home.startGoalie), t.home.startGoalieEmpty);
    await userEvent.click(screen.getByRole('button', { name: t.home.create }));
    await screen.findByText('K7QX');
    expect((await d.deps.store.load('K7QX'))[0]).toMatchObject({ kind: 'state_our_goalie', result: 'empty', goalie_id: null });
  });

  it('keeps the game and its code when only the starting goalie cannot be recorded', async () => {
    const d = makeDeps({ goalies: [{ id: 'g1', name: 'Mallet' }] });
    vi.spyOn(d.deps.store, 'add').mockRejectedValueOnce(new Error('disk'));
    renderWithSync(<Home />, d.deps);
    await fillNames();
    await screen.findByRole('option', { name: 'Mallet' });
    await userEvent.selectOptions(screen.getByLabelText(t.home.startGoalie), 'g1');
    await userEvent.click(screen.getByRole('button', { name: t.home.create }));
    expect(await screen.findByText('K7QX')).toBeInTheDocument();
    expect(await screen.findByText(t.home.startGoalieFailed)).toBeInTheDocument();
    expect(screen.queryByText(t.errors.server)).toBeNull();
    expect(d.fg.games).toHaveLength(1);
  });

  it('an away game sends home: false and venue: away', async () => {
    const d = makeDeps();
    renderWithSync(<Home />, d.deps);
    await fillNames();
    await userEvent.click(screen.getByRole('button', { name: t.venues.away }));
    await userEvent.click(screen.getByRole('button', { name: t.home.create }));
    await screen.findByText('K7QX');
    expect(d.fg.games.at(-1)).toMatchObject({ venue: 'away', home: false, sheet_side: null });
  });

  it('switching the competition back to Championnat ticks the overtime box again', async () => {
    renderWithSync(<Home />, makeDeps().deps);
    await userEvent.click(screen.getByRole('button', { name: t.competitions.playoffs }));
    expect(screen.getByLabelText(t.home.overtimePossible)).not.toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: t.competitions.championnat }));
    expect(screen.getByLabelText(t.home.overtimePossible)).toBeChecked();
  });

  it('"Plus tard" (the default) records no starting state', async () => {
    const d = makeDeps();
    renderWithSync(<Home />, d.deps);
    await fillNames();
    await userEvent.click(screen.getByRole('button', { name: t.home.create }));
    await screen.findByText('K7QX');
    expect(await d.deps.store.load('K7QX')).toEqual([]);
  });

  it('lists the goalies, adds one and refuses a duplicate', async () => {
    const d = makeDeps({ goalies: [{ id: 'g1', name: 'Mallet' }] });
    renderWithSync(<Home />, d.deps);
    await userEvent.click(screen.getByRole('button', { name: t.home.tabGoalies }));
    expect(await screen.findByText('Mallet')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(t.goalies.nameLabel), 'Bernard');
    await userEvent.click(screen.getByRole('button', { name: t.goalies.add }));
    expect(await screen.findByText('Bernard')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(t.goalies.nameLabel), ' mallet');
    await userEvent.click(screen.getByRole('button', { name: t.goalies.add }));
    expect(await screen.findByText(t.goalies.duplicate)).toBeInTheDocument();
    expect(d.fgo.list).toHaveLength(2);
  });

  it('corrects a goalie name', async () => {
    const d = makeDeps({ goalies: [{ id: 'g1', name: 'Malet' }] });
    renderWithSync(<Home />, d.deps);
    await userEvent.click(screen.getByRole('button', { name: t.home.tabGoalies }));
    await userEvent.click(await screen.findByRole('button', { name: t.goalies.rename }));
    const input = screen.getByRole('textbox', { name: t.goalies.rename });
    await userEvent.clear(input);
    await userEvent.type(input, 'Mallet');
    await userEvent.click(screen.getByRole('button', { name: t.goalies.save }));
    expect(await screen.findByText('Mallet')).toBeInTheDocument();
    expect(d.fgo.list[0].name).toBe('Mallet');
  });

  it('offers no way to delete a goalie', async () => {
    renderWithSync(<Home />, makeDeps({ goalies: [{ id: 'g1', name: 'Mallet' }] }).deps);
    await userEvent.click(screen.getByRole('button', { name: t.home.tabGoalies }));
    await screen.findByText('Mallet');
    expect(screen.queryByRole('button', { name: /suppr|supprimer|delete/i })).toBeNull();
  });
});
